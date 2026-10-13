#!/usr/bin/env python3
"""
Générateur audio 100 % synthétisé (libre de droits, aucun risque Content ID).

  python3 scripts/gen-audio.py sfx   --out public/audio/sfx
  python3 scripts/gen-audio.py music --style playful --bars 16 --drop 2 --cta 12 --seed 1 --out x.wav

Tout est calé sur 120 BPM (1 temps = 0,5 s, 1 mesure = 2 s), comme la timeline vidéo.
Structure musicale : intro filtrée + montée -> DROP (mesure `drop`) -> groove -> montée
-> CTA (mesure `cta`) -> accord final sur la dernière mesure.
"""
import argparse
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT


# ----------------------------------------------------------------------------- utils

def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def sos_filter(x, kind, freq, order=2):
    nyq = SR / 2
    if isinstance(freq, (list, tuple)):
        wn = [min(0.99, f / nyq) for f in freq]
    else:
        wn = min(0.99, freq / nyq)
    sos = signal.butter(order, wn, btype=kind, output="sos")
    return signal.sosfilt(sos, x)


def sweep_lowpass(x, f0, f1, block=512):
    """Filtre passe-bas dont la coupure glisse de f0 à f1 (exponentiel)."""
    out = np.zeros_like(x)
    n = len(x)
    zi = None
    for i in range(0, n, block):
        p = i / max(1, n - 1)
        fc = f0 * (f1 / f0) ** p
        sos = signal.butter(2, min(0.99, fc / (SR / 2)), btype="lowpass", output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg, zi = signal.sosfilt(sos, x[i : i + block], zi=zi)
        out[i : i + block] = seg
    return out


def poly_blep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    tt = t[m] / dt[m] if np.ndim(dt) else t[m] / dt
    y[m] = tt + tt - tt * tt - 1
    m2 = t > 1 - (dt if not np.ndim(dt) else dt)
    if np.ndim(dt):
        tt = (t[m2] - 1) / dt[m2]
    else:
        tt = (t[m2] - 1) / dt
    y[m2] = tt * tt + tt + tt + 1
    return y


def saw(freq, dur, phase0=0.0):
    n = int(dur * SR)
    dt = freq / SR
    t = (phase0 + np.arange(n) * dt) % 1.0
    return 2 * t - 1 - poly_blep(t, dt)


def square(freq, dur):
    s1 = saw(freq, dur)
    s2 = saw(freq, dur, 0.5)
    return (s1 - s2) * 0.5


def sine(freq, dur, phase=0.0):
    return np.sin(2 * np.pi * freq * t_axis(dur) + phase)


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    env = np.concatenate([
        np.linspace(0, 1, max(1, a_n), endpoint=False),
        np.linspace(1, s, max(1, d_n), endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, max(1, r_n)),
    ])
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def exp_env(dur, tau):
    return np.exp(-t_axis(dur) / tau)


def noise(dur, rng):
    return rng.uniform(-1, 1, int(dur * SR))


def place(buf, x, start_s, gain=1.0, pan=0.0):
    """Ajoute le mono x dans le buffer stéréo buf à start_s (pan -1..1)."""
    i = int(round(start_s * SR))
    if i >= buf.shape[0] or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    x = x[: buf.shape[0] - i]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(x), 0] += x * gain * l * 1.414
    buf[i : i + len(x), 1] += x * gain * r * 1.414


def reverb(buf, decay=1.8, mix=0.25, rng=None, lp=6000):
    rng = rng or np.random.default_rng(7)
    n = int(decay * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(buf)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / decay)
        ir = sos_filter(ir, "lowpass", lp)
        ir[: int(0.012 * SR)] = 0  # pré-délai
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        out[:, ch] = signal.fftconvolve(buf[:, ch], ir)[: len(buf)]
    return buf + out * mix


def normalize(buf, peak=0.97):
    m = np.max(np.abs(buf)) + 1e-9
    return buf * (peak / m)


def write(path, buf):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    buf = np.clip(buf, -1, 1)
    wavfile.write(path, SR, (buf * 32767).astype(np.int16))


# ----------------------------------------------------------------------------- drums

def kick(rng, hard=False, soft=False):
    d = 0.5
    t = t_axis(d)
    f = 45 + (170 if hard else 140) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (0.32 if hard else 0.26))
    click = sos_filter(noise(d, rng), "highpass", 3000) * np.exp(-t / 0.004) * 0.5
    k = body + click
    if hard:
        k = np.tanh(k * 2.6) / np.tanh(2.6)
    if soft:
        k *= 0.75
    return k


def clap(rng):
    d = 0.35
    t = t_axis(d)
    n = sos_filter(noise(d, rng), "bandpass", [900, 3200])
    env = np.zeros_like(t)
    for off in (0, 0.011, 0.022):
        m = t >= off
        env[m] += np.exp(-(t[m] - off) / 0.006) * 0.6
    m = t >= 0.03
    env[m] += np.exp(-(t[m] - 0.03) / 0.11)
    return n * env * 1.2


def snare(rng, big=False):
    d = 0.5 if big else 0.3
    t = t_axis(d)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    nz = sos_filter(noise(d, rng), "bandpass", [1500, 9000]) * np.exp(-t / (0.2 if big else 0.11))
    return tone * 0.6 + nz * 1.1


def hat(rng, open_=False):
    d = 0.35 if open_ else 0.06
    t = t_axis(d)
    n = sos_filter(noise(d, rng), "highpass", 7500)
    return n * np.exp(-t / (0.12 if open_ else 0.018))


def shaker(rng):
    d = 0.1
    t = t_axis(d)
    n = sos_filter(noise(d, rng), "bandpass", [4500, 11000])
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.035)
    return n * env


def crash(rng, dur=2.2):
    t = t_axis(dur)
    n = sos_filter(noise(dur, rng), "highpass", 3500)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (431, 587, 797, 1033, 1287)) / 5
    metal = sos_filter(metal, "highpass", 2500)
    return (n * 0.8 + metal * 0.25) * np.exp(-t / 0.9)


# ----------------------------------------------------------------------------- instruments

def supersaw(freq, dur, voices=5, spread=0.14):
    out = np.zeros(int(dur * SR))
    for v in range(voices):
        det = (v - (voices - 1) / 2) / max(1, voices - 1) * spread  # demi-tons
        out += saw(freq * 2 ** (det / 12), dur, phase0=(v * 0.37) % 1)
    return out / voices


def pluck(freq, dur, bright=1.0):
    s = saw(freq, dur) * 0.7 + square(freq * 2, dur) * 0.2
    t = t_axis(dur)
    dark = sos_filter(s, "lowpass", 900 + 600 * bright)
    brt = s - dark
    return dark * np.exp(-t / 0.28) + brt * np.exp(-t / (0.035 * bright + 0.01))


def fm_bell(freq, dur, ratio=3.5, index=2.5, tau=1.0):
    t = t_axis(dur)
    i_env = index * np.exp(-t / (tau * 0.35))
    return np.sin(2 * np.pi * freq * t + i_env * np.sin(2 * np.pi * freq * ratio * t)) * np.exp(-t / tau)


def marimba(freq, dur):
    t = t_axis(dur)
    base = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.35)
    over = np.sin(2 * np.pi * freq * 3.93 * t) * np.exp(-t / 0.05) * 0.35
    att = np.sin(2 * np.pi * freq * 9.2 * t) * np.exp(-t / 0.012) * 0.2
    return base + over + att


# ----------------------------------------------------------------------------- instruments (v2)

def bass808(freq, dur, rng=None):
    t = t_axis(dur)
    f = freq * (1 + 1.0 * np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    return np.tanh(x * 2.2) / np.tanh(2.2)


def strings(freq, dur):
    out = np.zeros(int(dur * SR))
    t = t_axis(dur)
    for v, det in enumerate((-0.09, -0.03, 0.03, 0.09)):
        vib = 1 + 0.004 * np.sin(2 * np.pi * (5 + v * 0.3) * t)
        ph = np.cumsum(freq * 2 ** (det / 12) * vib) / SR
        out += 2 * (ph % 1) - 1
    out = sos_filter(out / 4, "lowpass", 2400)
    return out * adsr(len(out), 0.25, 0.3, 0.85, 0.35)


def epiano(freq, dur):
    t = t_axis(dur)
    x = fm_bell(freq, dur, ratio=1.0, index=1.4, tau=0.9) + 0.3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.4)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    return x * trem


def lead_saw(freq, dur):
    t = t_axis(dur)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.12) / 0.2, 0, 1)
    out = np.zeros(len(t))
    for det in (-0.07, 0, 0.07):
        ph = np.cumsum(freq * 2 ** (det / 12) * vib) / SR
        out += 2 * (ph % 1) - 1
    out = sos_filter(out / 3, "lowpass", 3800)
    return out * adsr(len(out), 0.01, 0.12, 0.75, 0.08)


def flute(freq, dur, rng):
    t = t_axis(dur)
    vib = 1 + 0.005 * np.sin(2 * np.pi * 5 * t) * np.clip((t - 0.1) / 0.2, 0, 1)
    ph = 2 * np.pi * np.cumsum(freq * vib) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    breath = sos_filter(noise(dur, rng), "bandpass", [freq * 1.5, min(12000, freq * 6)]) * 0.12
    return (x + breath) * adsr(len(t), 0.05, 0.1, 0.8, 0.1)


def square_lead(freq, dur):
    x = sos_filter(square(freq, dur), "lowpass", 2600)
    return x * adsr(len(x), 0.004, 0.06, 0.6, 0.05)


def snap(rng):
    d = 0.18
    t = t_axis(d)
    n = sos_filter(noise(d, rng), "bandpass", [1800, 6000])
    return n * np.exp(-t / 0.03) * 1.3


def tom(rng, freq=90):
    d = 0.6
    t = t_axis(d)
    f = freq * (1 + 0.6 * np.exp(-t / 0.05))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    return np.tanh(body * 1.6) + sos_filter(noise(d, rng), "lowpass", 900) * np.exp(-t / 0.05) * 0.4


def vinyl(dur, rng):
    n = int(dur * SR)
    x = sos_filter(rng.standard_normal(n), "bandpass", [800, 5000]) * 0.015
    pops = np.zeros(n)
    idx = rng.integers(0, n, int(dur * 6))
    pops[idx] = rng.uniform(0.2, 0.6, len(idx)) * rng.choice([-1, 1], len(idx))
    return x + sos_filter(pops, "highpass", 1500)


def stereo_delay(buf, time_s, fb=0.35, mix=0.3, taps=5):
    out = np.zeros_like(buf)
    d = int(time_s * SR)
    for k in range(1, taps + 1):
        g = fb ** (k - 1) * mix
        ch_from, ch_to = (0, 1) if k % 2 else (1, 0)
        out[k * d :, ch_to] += buf[: len(buf) - k * d, ch_from] * g
    return buf + out


# ----------------------------------------------------------------------------- styles (v2)

MAJ = {0: [0, 4, 7], 5: [5, 9, 12], 7: [7, 11, 14], 9: [9, 12, 16], 2: [2, 5, 9], 4: [4, 7, 11]}
MIN = {0: [0, 3, 7], 8: [8, 12, 15], 3: [3, 7, 10], 10: [10, 14, 17], 5: [5, 8, 12], 7: [7, 10, 14]}
SCALE_MAJ = [0, 2, 4, 5, 7, 9, 11]
SCALE_MIN = [0, 2, 3, 5, 7, 8, 10]

STYLES = {
    # --- styles d'origine (+ mélodie)
    "aggressive": dict(root=40, scale=MIN, prog=[0, 8, 3, 10], drums="four", kick="hard", snare="clap", hats="16",
                       bass="rolling", chords="stab", arp=None, pad=True, lead="lead_saw", verb=0.18),
    "house": dict(root=41, scale=MAJ, prog=[0, 9, 5, 7], drums="four", kick="normal", snare="clap", hats="offbeat",
                  bass="offbeat", chords="house", arp="pluck", pad=True, lead="pluck_lead", verb=0.22),
    "elegant": dict(root=45, scale=MAJ, prog=[0, 7, 9, 5], drums="four", kick="soft", snare="clap", hats="shaker",
                    bass="sub", chords=None, arp="bell", pad=True, lead="flute", verb=0.32),
    "synthwave": dict(root=36, scale=MIN, prog=[0, 8, 3, 10], drums="four", kick="normal", snare="bigsnare", hats="8",
                      bass="eighths", chords=None, arp="saw16", pad=True, lead="lead_saw", verb=0.28),
    "playful": dict(root=43, scale=MAJ, prog=[0, 7, 9, 5], drums="four", kick="normal", snare="clap", hats="offbeat",
                    bass="bouncy", chords="stab", arp="marimba", pad=False, lead="square_lead", verb=0.2),
    # --- nouveaux styles
    "lofi": dict(root=45, scale=MAJ, prog=[5, 4, 2, 0], drums="half", kick="soft", snare="snap", hats="swing",
                 bass="sub", chords="epiano", arp=None, pad=False, lead="flute", verb=0.3, sevenths=True, vinyl=True, master_lp=7500),
    "futurebass": dict(root=42, scale=MAJ, prog=[5, 7, 9, 0], drums="half", kick="hard", snare="clap", hats="16",
                       bass="808", chords="wobble", arp=None, pad=True, lead="pluck_lead", verb=0.25, sevenths=True),
    "tropical": dict(root=44, scale=MAJ, prog=[0, 5, 9, 7], drums="four", kick="soft", snare="snap", hats="shaker",
                     bass="offbeat", chords=None, arp="marimba", pad=True, lead="flute", verb=0.24),
    "cinematic": dict(root=38, scale=MIN, prog=[0, 8, 3, 10], drums="epic", kick="hard", snare="bigsnare", hats=None,
                      bass="sub", chords="strings", arp=None, pad=False, lead="lead_saw", verb=0.4),
    "trap": dict(root=41, scale=MIN, prog=[0, 8, 5, 7], drums="trap", kick="hard", snare="clap", hats="trap",
                 bass="808", chords=None, arp=None, pad=True, lead="bell_lead", verb=0.26),
    # --- styles calmes (vidéos "Keynote") : aucun impact, aucun roulement, aucune montée
    "ambient": dict(root=45, scale=MAJ, prog=[0, 9, 5, 7], drums=None, kick="soft", snare="snap", hats=None,
                    bass="sub", chords="epiano", arp="bell", pad=True, lead="flute", verb=0.45, sevenths=True, calm=True, master_lp=9000),
    "chill": dict(root=43, scale=MAJ, prog=[5, 4, 2, 0], drums="half", kick="soft", snare="snap", hats="swing",
                  bass="sub", chords="epiano", arp=None, pad=True, lead="flute", verb=0.32, sevenths=True, calm=True, vinyl=True, master_lp=8000),
    "piano": dict(root=41, scale=MAJ, prog=[0, 7, 9, 5], drums=None, kick="soft", snare="snap", hats=None,
                  bass="sub", chords="strings", arp="bell", pad=False, lead="bell_lead", verb=0.42, sevenths=True, calm=True, master_lp=10000),
}

TRANSPOSE = [0, 2, -2, 3, -3, 5, -1]
ARP_PATTERNS = [
    [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3],
    [0, 2, 1, 3, 0, 2, 4, 3, 0, 2, 1, 3, 4, 2, 3, 1],
    [0, 0, 2, 1, 3, 3, 2, 1, 0, 0, 2, 1, 4, 3, 2, 1],
    [2, 1, 0, 1, 3, 2, 1, 2, 4, 3, 2, 3, 1, 2, 3, 4],
]
MARIMBA_RHYTHM = [0, 3, 6, 8, 10, 13, 14]
MELODY_RHYTHMS = [
    [0, 3, 6, 8, 10, 12, 14],
    [0, 2, 4, 7, 8, 11, 12, 14],
    [0, 4, 6, 8, 12, 14],
    [0, 3, 6, 10, 12],
    [0, 2, 3, 6, 8, 10, 11, 14],
]


def chord_of(st, deg, root):
    ch = [root + 12 + x for x in st["scale"][deg]]
    if st.get("sevenths"):
        third = ch[1] - ch[0]
        ch.append(ch[2] + (4 if third == 4 else 3))
    return ch


def make_melody(st, root, prog, rng):
    """Motif de 4 mesures (A B A' C) : notes de l'accord sur les temps forts, mouvement conjoint, fin sur la tonique."""
    scale = SCALE_MAJ if st["scale"] is MAJ else SCALE_MIN
    pitches = sorted({root + 24 + o * 12 + s for o in (-1, 0, 1) for s in scale})
    lo, hi = root + 19, root + 36
    pitches = [p for p in pitches if lo <= p <= hi]
    rA = MELODY_RHYTHMS[rng.integers(len(MELODY_RHYTHMS))]
    rB = MELODY_RHYTHMS[rng.integers(len(MELODY_RHYTHMS))]
    phrase = []  # (bar_in_phrase, step, midi, length_steps)

    def bar_notes(bar_i, rhythm, deg, end_on_root=False):
        chord = [c + 12 for c in chord_of(st, deg, root)]
        chord_pcs = {c % 12 for c in chord}
        cur = rng.choice([p for p in pitches if p % 12 in chord_pcs])
        notes = []
        for k, step in enumerate(rhythm):
            strong = step in (0, 8)
            if strong:
                cands = [p for p in pitches if p % 12 in chord_pcs]
                cur = min(cands, key=lambda p: abs(p - cur) + rng.random() * 4 + (3 if p == cur else 0))
            else:
                idx = pitches.index(min(pitches, key=lambda p: abs(p - cur)))
                idx = int(np.clip(idx + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(pitches) - 1))
                cur = pitches[idx]
            nxt = rhythm[k + 1] if k + 1 < len(rhythm) else 16
            notes.append([bar_i, step, cur, min(4, nxt - step)])
        if end_on_root:
            tonic = [p for p in pitches if p % 12 == root % 12]
            last = notes[-1]
            last[2] = min(tonic, key=lambda p: abs(p - last[2]))
            last[3] = 16 - last[1]
        return notes

    a = bar_notes(0, rA, prog[0])
    b = bar_notes(1, rB, prog[1])
    a2 = [[2, s, p + (2 if rng.random() < 0.3 else 0), l] for (_, s, p, l) in a]  # variation
    c = bar_notes(3, rA[: max(2, len(rA) - 2)], prog[3], end_on_root=True)
    phrase = a + b + a2 + c
    snap_set = set(pitches)
    return [(bi, s, p if p in snap_set else min(pitches, key=lambda q: abs(q - p)), l) for (bi, s, p, l) in phrase]


def play_lead(kind, freq, dur, rng):
    if kind == "lead_saw":
        return lead_saw(freq, dur) * 0.9
    if kind == "flute":
        return flute(freq, dur, rng)
    if kind == "square_lead":
        return square_lead(freq, dur) * 0.7
    if kind == "bell_lead":
        return fm_bell(freq, max(dur, 0.6), ratio=3.5, index=1.6, tau=0.5)
    return pluck(freq, max(dur, 0.25), 1.4)  # pluck_lead


def gen_music(style_name, bars, drop, cta, seed, out):
    st = STYLES[style_name]
    rng = np.random.default_rng(1000 + seed * 17 + len(style_name) * 31)
    tr = TRANSPOSE[seed % len(TRANSPOSE)]
    root = st["root"] + tr
    prog = st["prog"][seed % 4:] + st["prog"][: seed % 4] if seed else st["prog"]
    dur = bars * BAR + 0.05
    n = int(dur * SR)
    drums = np.zeros((n, 2))
    bass = np.zeros((n, 2))
    music = np.zeros((n, 2))
    lead = np.zeros((n, 2))
    fx = np.zeros((n, 2))
    kicks = []
    arp_pat = ARP_PATTERNS[seed % len(ARP_PATTERNS)]
    melody = make_melody(st, root, prog, rng) if st.get("lead") else []
    last = bars - 1
    hard = st["kick"] == "hard"
    soft = st["kick"] == "soft"

    def backbeat(t):
        s = st["snare"]
        if s == "clap":
            place(drums, clap(rng), t, 0.55, pan=0.05)
        elif s == "snap":
            place(drums, snap(rng), t, 0.5, pan=0.1)
        else:
            place(drums, snare(rng, big=True), t, 0.7)

    for b in range(bars):
        t0 = b * BAR
        deg = prog[b % 4]
        chord = chord_of(st, deg, root)
        bass_note = root - 12 + deg if deg < 7 else root - 24 + deg
        intro = b < drop
        final = b == last
        pre_drop = b == drop - 1
        pre_cta = b == cta - 1
        cta_zone = b >= cta

        if st["pad"] and not final:
            for i, m in enumerate(chord + [chord[0] + 12]):
                p = supersaw(midi_hz(m), BAR + 0.1, voices=5, spread=0.18)
                p = sos_filter(p, "lowpass", 1800 if not intro else 2500) * adsr(len(p), 0.08, 0.3, 0.8, 0.25)
                place(music, p, t0, 0.06, pan=-0.5 + i * 0.3)

        if final:
            for i, m in enumerate(chord + [chord[0] + 12, chord[1] + 12]):
                p = supersaw(midi_hz(m), BAR, voices=7, spread=0.22)
                p = sos_filter(p, "lowpass", 3500) * np.exp(-t_axis(BAR) / 0.9)
                place(music, p, t0, 0.11, pan=-0.6 + i * 0.25)
            if st.get("lead"):
                x = play_lead(st["lead"], midi_hz(root + 36), 1.6, rng) * np.exp(-t_axis(1.6) / 0.7)
                place(lead, x, t0, 0.1)
            s = sine(midi_hz(bass_note), 1.6) * np.exp(-t_axis(1.6) / 0.6)
            place(bass, s, t0, 0.8)
            if not st.get("calm"):
                place(drums, kick(rng, hard=hard), t0, 0.55)
                place(fx, crash(rng, 2.0), t0, 0.14)
            continue

        # ---------------- batterie
        pattern = st["drums"]
        if not intro:
            skip_last = pre_cta
            if pattern == "four":
                for q in range(4):
                    if skip_last and q == 3:
                        continue
                    place(drums, kick(rng, hard=hard, soft=soft), t0 + q * BEAT, 0.75)
                    kicks.append(t0 + q * BEAT)
                for q in (1, 3):
                    if not (skip_last and q == 3):
                        backbeat(t0 + q * BEAT)
            elif pattern in ("half", "trap"):
                ks = [0, 2.5] if pattern == "half" else [0, 1.75, 2.5]
                for k in ks:
                    place(drums, kick(rng, hard=hard, soft=soft), t0 + k * BEAT, 0.75)
                    kicks.append(t0 + k * BEAT)
                if not skip_last:
                    backbeat(t0 + 2 * BEAT)
            elif pattern == "epic":
                for k in (0, 1.5, 2, 3.5):
                    place(drums, tom(rng, 70 if k in (0, 2) else 95), t0 + k * BEAT, 0.8, pan=-0.2 if k % 2 else 0.2)
                place(drums, kick(rng, hard=True), t0, 0.9)
                kicks.append(t0)
                if not skip_last:
                    place(drums, snare(rng, big=True), t0 + 2 * BEAT, 0.6)
            hats = st["hats"]
            if hats == "16":
                for s16 in range(16):
                    place(drums, hat(rng), t0 + s16 * BEAT / 4, 0.15 if s16 % 2 else 0.08, pan=0.3)
            elif hats == "8":
                for e in range(8):
                    place(drums, hat(rng), t0 + e * BEAT / 2, 0.14 if e % 2 else 0.08, pan=0.3)
            elif hats == "offbeat":
                for q in range(4):
                    place(drums, hat(rng, open_=True), t0 + q * BEAT + BEAT / 2, 0.14, pan=0.25)
                    place(drums, hat(rng), t0 + q * BEAT + BEAT / 4, 0.05, pan=-0.3)
                    place(drums, hat(rng), t0 + q * BEAT + 3 * BEAT / 4, 0.05, pan=-0.3)
            elif hats == "shaker":
                for s16 in range(16):
                    place(drums, shaker(rng), t0 + s16 * BEAT / 4, 0.12 if s16 % 2 else 0.2, pan=0.35)
            elif hats == "swing":
                for e in range(8):
                    off = (BEAT / 2) * (0.16 if e % 2 else 0)
                    place(drums, hat(rng), t0 + e * BEAT / 2 + off, 0.1 if e % 2 else 0.06, pan=0.3)
            elif hats == "trap":
                for s16 in range(16):
                    place(drums, hat(rng), t0 + s16 * BEAT / 4, 0.1, pan=0.3)
                if b % 2 == 1:  # roulements en triolets
                    for k in range(6):
                        place(drums, hat(rng), t0 + 3 * BEAT + k * BEAT / 6, 0.08 + k * 0.01, pan=0.3)
            if (b - drop) % 8 == 0 and not st.get("calm"):
                place(fx, crash(rng), t0, 0.13)
            if (b - drop) % 4 == 3 and not pre_cta and pattern != "epic" and not st.get("calm"):
                for k in range(4):
                    place(drums, snare(rng), t0 + 3 * BEAT + k * BEAT / 4, 0.16 + k * 0.05, pan=-0.1)
        elif not st.get("calm"):
            for e in range(8):
                place(drums, hat(rng), t0 + e * BEAT / 2, 0.07 + 0.04 * (e % 2), pan=0.3)
            pass  # intro sans kick : départ doux

        if (pre_drop or pre_cta) and not st.get("calm"):
            steps = [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.125, 3.25, 3.375]
            for k, s in enumerate(steps):
                if pre_cta and s >= 3:
                    break
                place(drums, snare(rng), t0 + s * BEAT, 0.05 + 0.2 * k / len(steps), pan=0.1)
            rs_len = BAR - (BEAT if pre_cta else BEAT / 4)
            r = noise(rs_len, rng)
            r = sweep_lowpass(r, 400, 12000) * np.linspace(0, 1, len(r)) ** 2
            place(fx, r, t0, 0.1)

        # ---------------- basse
        if not intro:
            bn = midi_hz(bass_note)
            kind = st["bass"]
            if kind == "rolling":
                for s16 in range(16):
                    if s16 % 4 == 0:
                        continue
                    x = saw(bn, BEAT / 4) * adsr(int(BEAT / 4 * SR), 0.002, 0.05, 0.6, 0.03)
                    x = np.tanh(sos_filter(x, "lowpass", 700) * 2.5)
                    place(bass, x, t0 + s16 * BEAT / 4, 0.32)
            elif kind == "offbeat":
                for q in range(4):
                    x = pluck(bn, BEAT / 2, 0.6)
                    place(bass, sos_filter(x, "lowpass", 900), t0 + q * BEAT + BEAT / 2, 0.55)
            elif kind == "sub":
                for q in (0, 2):
                    x = sine(bn, BEAT * 2) * adsr(int(BEAT * 2 * SR), 0.01, 0.2, 0.7, 0.15)
                    place(bass, x, t0 + q * BEAT, 0.55)
            elif kind == "eighths":
                for e in range(8):
                    f = bn * (2 if e % 2 else 1)
                    x = saw(f, BEAT / 2) * adsr(int(BEAT / 2 * SR), 0.003, 0.08, 0.5, 0.05)
                    place(bass, sos_filter(x, "lowpass", 600), t0 + e * BEAT / 2, 0.42)
            elif kind == "bouncy":
                for e, mul in zip([0, 3, 4, 6, 7], [1, 2, 1, 2, 1.5]):
                    x = pluck(bn * mul, BEAT / 2, 0.5)
                    place(bass, sos_filter(x, "lowpass", 1100), t0 + e * BEAT / 2, 0.5)
            elif kind == "808":
                for k in ([0, 2.5] if st["drums"] != "trap" else [0, 1.75, 2.5]):
                    place(bass, bass808(bn, 1.0), t0 + k * BEAT, 0.5)

        # ---------------- accords
        ck = st["chords"]
        if ck and not intro:
            if ck in ("stab", "house"):
                hits = [0.5, 1.5, 2.5, 3.5] if ck == "stab" else [0, 0.75, 1.5, 2.5, 3.25]
                for h in hits:
                    for i, m in enumerate(chord):
                        x = supersaw(midi_hz(m + 12), 0.22, voices=3, spread=0.1) if ck == "stab" else (
                            saw(midi_hz(m + 12), 0.3) * 0.5 + sine(midi_hz(m + 12), 0.3) * 0.6)
                        x = sos_filter(x, "lowpass", 3200) * np.exp(-t_axis(len(x) / SR) / 0.09)
                        place(music, x, t0 + h * BEAT, 0.09, pan=-0.3 + i * 0.3)
            elif ck == "epiano":
                for h in (0, 1.5, 2.5):
                    for i, m in enumerate(chord):
                        place(music, epiano(midi_hz(m), 1.2), t0 + h * BEAT + i * 0.012, 0.08, pan=-0.3 + i * 0.2)
            elif ck == "wobble":
                for i, m in enumerate(chord + [chord[0] + 12]):
                    x = supersaw(midi_hz(m + 12), BAR, voices=7, spread=0.25)
                    x = sos_filter(x, "lowpass", 4200)
                    gate = 0.35 + 0.65 * (np.sin(2 * np.pi * (1 / (BEAT / 3)) * t_axis(BAR)) > -0.2)
                    gate = sos_filter(gate.astype(float), "lowpass", 60)
                    place(music, x * gate, t0, 0.08, pan=-0.45 + i * 0.3)
            elif ck == "strings":
                for i, m in enumerate(chord + [chord[0] - 12]):
                    place(music, strings(midi_hz(m), BAR + 0.3), t0, 0.12, pan=-0.5 + i * 0.33)

        # ---------------- arpège
        arp = st["arp"]
        if arp:
            tones = chord + [c + 12 for c in chord]
            for s16 in range(16):
                if intro and s16 % 2:
                    continue
                if arp == "marimba" and s16 not in MARIMBA_RHYTHM:
                    continue
                if arp == "bell" and s16 % 2:
                    continue
                m = tones[arp_pat[s16] % len(tones)] + 12
                st_ = t0 + s16 * BEAT / 4
                if arp == "pluck":
                    x, g = pluck(midi_hz(m), 0.35, 1.2) * 0.9, 0.06
                elif arp == "bell":
                    x, g = fm_bell(midi_hz(m + 12), 1.2, ratio=3.5, index=1.8, tau=0.7), 0.07
                elif arp == "saw16":
                    x, g = pluck(midi_hz(m), 0.2, 1.6), 0.065
                else:
                    x, g = marimba(midi_hz(m + 12), 0.6), 0.11
                place(music, x, st_, g * (0.7 if melody and not intro else 1), pan=0.4 * np.sin(s16 * 0.9))

        # ---------------- mélodie (après le drop ; se tait 1 phrase sur 3 pour respirer ; octave au CTA)
        if melody and not intro:
            phrase_i = (b - drop) // 4
            if phrase_i % 3 != 2 or cta_zone:
                bar_in = (b - drop) % 4
                for (bi, s, p, l) in melody:
                    if bi != bar_in:
                        continue
                    if pre_cta and s >= 12:
                        continue
                    ln = l * BEAT / 4
                    pitch = p + (12 if cta_zone and st["lead"] != "flute" else 0)
                    x = play_lead(st["lead"], midi_hz(pitch), ln * 0.95 + 0.05, rng)
                    place(lead, x, t0 + s * BEAT / 4, 0.16, pan=0.0)

    if st.get("vinyl"):
        v = vinyl(dur, rng)
        drums[: len(v), 0] += v[: n]
        drums[: len(v), 1] += v[: n]

    # ---------------- sidechain
    sc = np.ones(n)
    for kt in kicks:
        i = int(kt * SR)
        L = int(0.4 * SR)
        seg = 1 - 0.62 * np.exp(-np.arange(L) / SR / 0.11)
        j = min(n, i + L)
        sc[i:j] = np.minimum(sc[i:j], seg[: j - i])
    bass *= sc[:, None]
    music *= sc[:, None] ** 0.8
    lead *= sc[:, None] ** 0.3

    i_drop = int(drop * BAR * SR)
    if i_drop > 0:
        for ch in range(2):
            music[:i_drop, ch] = sweep_lowpass(music[:i_drop, ch], 800, 6000)
        music[:i_drop] *= np.linspace(0.85, 1.0, i_drop)[:, None]

    for bar_i in (drop, cta) if not st.get("calm") else ():
        place(fx, crash(rng), bar_i * BAR, 0.12)  # plus de "boom" de basse, juste une cymbale légère

    lead = stereo_delay(lead, BEAT * 0.75, fb=0.35, mix=0.28)
    mix = (drums * 0.9 + bass * 1.0 + reverb(music, 2.2, st["verb"] + 0.1, rng)
           + reverb(lead, 2.0, st["verb"] + 0.12, rng) * 1.1 + reverb(fx, 2.5, 0.3, rng))
    mix = reverb(mix, 1.2, 0.06, rng)
    for ch in range(2):
        mix[:, ch] = sos_filter(mix[:, ch], "highpass", 28)
        if st.get("master_lp"):
            mix[:, ch] = sos_filter(mix[:, ch], "lowpass", st["master_lp"])
    mix = normalize(mix, 1.0)
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    fin = int(1.2 * SR)  # départ en fondu (pas de "boom" à la première image)
    mix[:fin] *= (np.linspace(0, 1, fin) ** 1.5)[:, None]
    mix = normalize(mix, 0.93)
    fade = int(0.25 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    write(out, mix)


# ----------------------------------------------------------------------------- SFX

def gen_sfx(out_dir):
    rng = np.random.default_rng(42)
    os.makedirs(out_dir, exist_ok=True)

    def stereo(x, pan_from=0.0, pan_to=0.0):
        p = np.linspace(pan_from, pan_to, len(x))
        l = np.cos((p + 1) * np.pi / 4) * 1.414
        r = np.sin((p + 1) * np.pi / 4) * 1.414
        return np.stack([x * l, x * r], axis=1)

    def save(name, x, verb=0.0, peak=0.9):
        if x.ndim == 1:
            x = stereo(x)
        if verb:
            x = np.concatenate([x, np.zeros((int(0.8 * SR), 2))])
            x = reverb(x, 1.4, verb, rng)
        write(os.path.join(out_dir, name), normalize(x, peak))

    # whoosh : bruit en cloche avec bande passante qui balaie
    for name, d, peak in (("whoosh.wav", 0.7, 0.8), ("whoosh-fast.wav", 0.35, 0.75)):
        t = t_axis(d)
        nz = noise(d, rng)
        env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
        x = sweep_lowpass(nz, 300, 6000) * env
        x = x - sweep_lowpass(x, 150, 700) * 0.6
        save(name, stereo(x, -0.7, 0.7), verb=0.15, peak=peak)

    # impact : sub + corps + crash
    d = 2.0
    t = t_axis(d)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 90 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.55)
    body = sos_filter(noise(d, rng), "lowpass", 1800) * np.exp(-t / 0.08)
    cr = np.zeros_like(t)
    c = crash(rng, d)
    cr[: len(c)] = c
    save("impact.wav", np.tanh((sub * 1.2 + body * 0.6 + cr * 0.35) * 1.5), verb=0.25, peak=0.95)

    # hit : frappe courte pour les mots qui "claquent"
    k = kick(rng, hard=True)
    s = snare(rng)
    h = np.zeros(max(len(k), len(s)))
    h[: len(k)] += k
    h[: len(s)] += s * 0.7
    save("hit.wav", np.tanh(h * 1.8), verb=0.18, peak=0.9)

    # pop : bulle
    d = 0.14
    t = t_axis(d)
    f = 500 + 900 * (1 - np.exp(-t / 0.02))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    save("pop.wav", x, peak=0.7)

    # click UI
    d = 0.04
    t = t_axis(d)
    x = sos_filter(noise(d, rng), "bandpass", [2000, 7000]) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.006) * 0.5
    save("click.wav", x, peak=0.55)

    # riser : 2 mesures de tension (bruit + sinus qui monte)
    d = 2.0
    t = t_axis(d)
    nz = sweep_lowpass(noise(d, rng), 300, 14000) * (t / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(180 * (8 ** (t / d))) / SR) * (t / d) ** 3 * 0.35
    save("riser.wav", stereo(nz + tone, -0.3, 0.3), verb=0.2, peak=0.85)

    # shimmer : arpège de cloches aiguës (révélation du logo)
    d = 1.8
    x = np.zeros(int(d * SR))
    for i, m in enumerate([84, 88, 91, 96, 100]):
        b = fm_bell(midi_hz(m), 1.2, ratio=3.01, index=1.2, tau=0.6)
        j = int(i * 0.06 * SR)
        x[j : j + len(b)] += b[: len(x) - j] * (0.9 - i * 0.1)
    x += sos_filter(noise(d, rng), "highpass", 9000) * np.exp(-t_axis(d) / 0.5) * 0.15
    save("shimmer.wav", x, verb=0.45, peak=0.7)

    # swipe : balayage court aigu
    d = 0.3
    t = t_axis(d)
    x = sos_filter(noise(d, rng), "highpass", 2500) * np.sin(np.pi * t / d) ** 3
    save("swipe.wav", stereo(x, 0.6, -0.6), peak=0.6)

    # ding : notification (2 notes)
    d = 1.0
    x = np.zeros(int(d * SR))
    for off, m in ((0, 88), (0.09, 95)):
        b = fm_bell(midi_hz(m), 0.9, ratio=2.0, index=1.0, tau=0.35)
        j = int(off * SR)
        x[j : j + len(b)] += b[: len(x) - j]
    save("ding.wav", x, verb=0.2, peak=0.7)

    # glitch : coupures numériques pour le hook
    d = 0.28
    x = np.zeros(int(d * SR))
    pos = 0
    while pos < len(x):
        L = int(rng.uniform(0.01, 0.04) * SR)
        f = rng.choice([220, 440, 880, 1760, 3520])
        seg = np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * rng.uniform(0.3, 1)
        if rng.random() < 0.35:
            seg *= 0
        x[pos : pos + L] = seg[: len(x) - pos]
        pos += L
    x = np.round(x * 6) / 6
    save("glitch.wav", sos_filter(x, "lowpass", 6000), peak=0.5)

    # tick : métronome discret (compteurs)
    d = 0.03
    t = t_axis(d)
    save("tick.wav", np.sin(2 * np.pi * 3200 * t) * np.exp(-t / 0.004), peak=0.4)

    print(f"SFX générés dans {out_dir}")


# ----------------------------------------------------------------------------- CLI

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["sfx", "music"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--style", default="house")
    ap.add_argument("--bars", type=int, default=16)
    ap.add_argument("--drop", type=int, default=2)
    ap.add_argument("--cta", type=int, default=12)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    if a.mode == "sfx":
        gen_sfx(a.out)
    else:
        gen_music(a.style, a.bars, a.drop, a.cta, a.seed, a.out)
        print(f"Musique : {a.out}")
