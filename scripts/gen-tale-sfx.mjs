// Bruitages des stories crypto (shared/tale-sfx.mjs) : crée ceux qui manquent dans public/audio/tale-sfx/.
// - Sons d'animation : synthétisés ici (doux, courts, esprit pixel), sans dépendance.
// - Sons narratifs : ElevenLabs (sound effects) si une clé est enregistrée, sinon une version synthétisée de secours
//   (refaite par ElevenLabs dès qu'une clé existe). Un fichier <nom>.wav.json garde la recette : prompt changé → son refait.
// Usage : node scripts/gen-tale-sfx.mjs [--force] [nom…]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../shared/catalog.mjs";
import { sfxConfig, soundEffect } from "../shared/elevenlabs.mjs";
import { isMain } from "../shared/platform.mjs";
import { ANIM_SFX, STORY_SFX, sfxFile } from "../shared/tale-sfx.mjs";

const SR = 44100;
/** Version des recettes synthétisées : à incrémenter quand une recette change (les fichiers sont refaits). */
const SYNTH_VERSION = 1;

/* ------------------------------------------------------------------ synthèse */

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buf = (sec) => new Float32Array(Math.round(sec * SR));
/** Enveloppe attaque linéaire + décroissance exponentielle (temps en s). */
const env = (t, a, d) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));

/** Ajoute un oscillateur à fréquence variable `f(t)` (Hz) : sine, triangle ou carré adouci. */
function tone(out, { at = 0, len, f, type = "sine", amp = 1, a = 0.002, d = 0.08 }) {
  let ph = 0;
  const n0 = Math.round(at * SR);
  const n = Math.round(len * SR);
  for (let i = 0; i < n && n0 + i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f(t)) / SR;
    const s = Math.sin(ph);
    const v = type === "sine" ? s : type === "tri" ? (2 / Math.PI) * Math.asin(s) : Math.tanh(s * 4) * 0.8;
    out[n0 + i] += v * amp * env(t, a, d);
  }
}

/** Bruit filtré passe-bande (fréquence centrale `f(t)`, résonance q), enveloppé par `shape(t)`. */
function noise(out, { at = 0, len, f, q = 1.2, amp = 1, shape, seed = 1 }) {
  const r = rng(seed);
  let lp = 0;
  let bp = 0;
  const n0 = Math.round(at * SR);
  const n = Math.round(len * SR);
  for (let i = 0; i < n && n0 + i < out.length; i++) {
    const t = i / SR;
    // Filtre d'état variable (Chamberlin).
    const k = 2 * Math.sin((Math.PI * Math.min(f(t), SR / 6)) / SR);
    const x = r() * 2 - 1;
    const hp = x - lp - bp / q;
    bp += k * hp;
    lp += k * bp;
    out[n0 + i] += bp * amp * shape(t);
  }
}

/** Passe-bas à un pôle (adoucit les carrés et les clics). */
function lowpass(x, hz) {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += k * (x[i] - y);
  return x;
}

/** Petite réverbération (Schroeder : 4 peignes + 2 passe-tout), mélangée à `mix`. */
function reverb(x, mix = 0.2, size = 1) {
  const wet = new Float32Array(x.length);
  for (const [ms, g] of [[29.7, 0.77], [37.1, 0.75], [41.1, 0.73], [43.7, 0.71]]) {
    const dl = Math.round(ms * size * SR / 1000);
    const line = new Float32Array(dl);
    let p = 0;
    for (let i = 0; i < x.length; i++) {
      const y = line[p];
      line[p] = x[i] + y * g;
      wet[i] += y / 4;
      p = (p + 1) % dl;
    }
  }
  for (const [ms, g] of [[5, 0.7], [1.7, 0.7]]) {
    const dl = Math.round(ms * SR / 1000);
    const line = new Float32Array(dl);
    let p = 0;
    for (let i = 0; i < wet.length; i++) {
      const b = line[p];
      const y = -g * wet[i] + b;
      line[p] = wet[i] + g * y;
      wet[i] = y;
      p = (p + 1) % dl;
    }
  }
  for (let i = 0; i < x.length; i++) x[i] = x[i] * (1 - mix) + wet[i] * mix;
  return x;
}

/** Fondu de sortie sur les `sec` dernières secondes (évite tout clic en fin de fichier). */
function fadeOut(x, sec = 0.03) {
  const n = Math.round(sec * SR);
  for (let i = 0; i < n && i < x.length; i++) x[x.length - 1 - i] *= i / n;
  return x;
}

const glide = (a, b, sec) => (t) => a * Math.pow(b / a, Math.min(1, t / sec));
const bell = (len) => (t) => Math.sin(Math.PI * Math.min(1, t / len)) ** 2;

/** Recettes des sons d'animation : doux, secs, au pitch « pixel ». */
const ANIM = {
  "a-pop": () => {
    const x = buf(ANIM_SFX["a-pop"]);
    tone(x, { len: 0.2, f: glide(820, 360, 0.07), amp: 0.9, d: 0.05 });
    tone(x, { len: 0.12, f: glide(1640, 720, 0.07), type: "tri", amp: 0.15, d: 0.03 });
    return reverb(lowpass(x, 3200), 0.12);
  },
  "a-thud": () => {
    const x = buf(ANIM_SFX["a-thud"]);
    tone(x, { len: 0.3, f: glide(170, 70, 0.12), amp: 1, d: 0.09 });
    noise(x, { len: 0.06, f: () => 500, q: 0.8, amp: 0.5, shape: (t) => env(t, 0.001, 0.015), seed: 3 });
    return lowpass(x, 1800);
  },
  "a-blip": () => {
    const x = buf(ANIM_SFX["a-blip"]);
    tone(x, { len: 0.05, f: () => 880, type: "square", amp: 0.5, d: 0.03 });
    tone(x, { at: 0.045, len: 0.07, f: () => 1320, type: "square", amp: 0.5, d: 0.035 });
    return lowpass(x, 2600);
  },
  "a-stamp": () => {
    const x = buf(ANIM_SFX["a-stamp"]);
    tone(x, { len: 0.4, f: glide(130, 52, 0.2), amp: 1, d: 0.13 });
    noise(x, { len: 0.08, f: () => 1100, q: 0.7, amp: 0.8, shape: (t) => env(t, 0.001, 0.02), seed: 5 });
    return reverb(lowpass(x, 2400), 0.18, 1.3);
  },
  "a-count": () => {
    const x = buf(ANIM_SFX["a-count"]);
    for (let i = 0; i < 12; i++) tone(x, { at: i / 12, len: 0.03, f: () => 520 * Math.pow(2, i / 12), type: "square", amp: i === 11 ? 0.6 : 0.32, d: 0.012 });
    return lowpass(x, 2800);
  },
  "a-coin": () => {
    const x = buf(ANIM_SFX["a-coin"]);
    tone(x, { len: 0.06, f: () => 988, type: "square", amp: 0.4, d: 0.05 });
    tone(x, { at: 0.055, len: 0.24, f: () => 1319, type: "square", amp: 0.4, d: 0.08 });
    tone(x, { at: 0.055, len: 0.24, f: () => 2638, amp: 0.12, d: 0.05 });
    return reverb(lowpass(x, 3600), 0.12);
  },
  "a-swish": () => {
    const x = buf(ANIM_SFX["a-swish"]);
    noise(x, { len: 0.4, f: (t) => 500 + 2200 * Math.sin(Math.PI * Math.min(1, t / 0.38)), q: 1.6, amp: 0.9, shape: bell(0.38), seed: 7 });
    return lowpass(x, 5000);
  },
  "a-type": () => {
    const x = buf(ANIM_SFX["a-type"]);
    const r = rng(11);
    for (let t = 0.01; t < 1.95; t += 0.055 + r() * 0.06) {
      noise(x, { at: t, len: 0.02, f: () => 2600 + r() * 1400, q: 1.1, amp: 0.55 + r() * 0.3, shape: (u) => env(u, 0.0005, 0.004), seed: Math.floor(t * 1000) });
      tone(x, { at: t, len: 0.02, f: () => 180, amp: 0.25, d: 0.006 });
    }
    return lowpass(x, 6000);
  },
  "a-rise": () => {
    const x = buf(ANIM_SFX["a-rise"]);
    for (let i = 0; i < 8; i++) tone(x, { at: i * 0.11, len: 0.12, f: () => 392 * Math.pow(2, (i * 2) / 12), type: "tri", amp: 0.5, d: 0.06 });
    return reverb(lowpass(x, 3000), 0.15);
  },
  "a-ping": () => {
    const x = buf(ANIM_SFX["a-ping"]);
    tone(x, { len: 0.7, f: () => 1480, amp: 0.6, d: 0.16 });
    tone(x, { len: 0.5, f: () => 2220, amp: 0.15, d: 0.08 });
    return fadeOut(reverb(x, 0.3, 1.6), 0.1);
  },
  "a-twinkle": () => {
    const x = buf(ANIM_SFX["a-twinkle"]);
    [2093, 2637, 3136].forEach((hz, i) => tone(x, { at: i * 0.06, len: 0.25, f: () => hz, amp: 0.4, d: 0.06 }));
    return fadeOut(reverb(x, 0.3), 0.08);
  },
  "a-cut": () => {
    const x = buf(ANIM_SFX["a-cut"]);
    noise(x, { len: 0.45, f: (t) => 300 + 1200 * Math.min(1, t / 0.25), q: 0.9, amp: 0.8, shape: bell(0.42), seed: 13 });
    return lowpass(x, 2500);
  },
  "a-tick": () => {
    const x = buf(ANIM_SFX["a-tick"]);
    noise(x, { len: 0.03, f: () => 3200, q: 1.4, amp: 0.8, shape: (t) => env(t, 0.0003, 0.004), seed: 17 });
    return x;
  },
};

/** Recettes synthétisées propres à certains sons narratifs (les autres prennent la recette de leur mode). */
const STORY = {
  heartbeat: (x) => {
    for (let t = 0; t < 5; t += 1.25) {
      tone(x, { at: t, len: 0.25, f: glide(75, 45, 0.1), amp: 1, d: 0.06 });
      tone(x, { at: t + 0.28, len: 0.25, f: glide(65, 40, 0.1), amp: 0.7, d: 0.07 });
    }
    return lowpass(x, 400);
  },
  clock: (x) => {
    for (let i = 0; i < 8; i++) {
      noise(x, { at: i * 0.5, len: 0.04, f: () => (i % 2 ? 2400 : 3000), q: 3, amp: 0.8, shape: (t) => env(t, 0.0005, 0.006), seed: 20 + i });
      tone(x, { at: i * 0.5, len: 0.05, f: () => (i % 2 ? 1200 : 1500), amp: 0.25, d: 0.01 });
    }
    return reverb(x, 0.15);
  },
  typing: (x) => {
    const y = ANIM["a-type"]();
    for (let i = 0; i < x.length; i++) x[i] = y[i % y.length];
    return x;
  },
  cash: (x) => {
    noise(x, { len: 0.12, f: () => 3000, q: 2, amp: 0.5, shape: (t) => env(t, 0.001, 0.03), seed: 31 });
    tone(x, { at: 0.08, len: 1, f: () => 2093, amp: 0.5, d: 0.25 });
    tone(x, { at: 0.08, len: 1, f: () => 2637, amp: 0.35, d: 0.2 });
    const r = rng(32);
    for (let i = 0; i < 9; i++) tone(x, { at: 0.2 + i * 0.07 + r() * 0.03, len: 0.15, f: () => 3500 + r() * 2500, amp: 0.2, d: 0.04 });
    return fadeOut(reverb(x, 0.2), 0.2);
  },
  gavel: (x) => {
    tone(x, { len: 0.4, f: glide(420, 260, 0.05), type: "tri", amp: 0.8, d: 0.05 });
    noise(x, { len: 0.05, f: () => 1600, q: 1.2, amp: 0.8, shape: (t) => env(t, 0.0005, 0.01), seed: 41 });
    return fadeOut(reverb(x, 0.35, 2), 0.3);
  },
  camera: (x) => {
    noise(x, { len: 0.03, f: () => 4000, q: 2, amp: 1, shape: (t) => env(t, 0.0005, 0.005), seed: 51 });
    noise(x, { at: 0.07, len: 0.03, f: () => 3000, q: 2, amp: 0.8, shape: (t) => env(t, 0.0005, 0.006), seed: 52 });
    tone(x, { at: 0.15, len: 0.8, f: glide(1500, 5000, 0.8), amp: 0.08, a: 0.2, d: 0.3 });
    return fadeOut(x, 0.1);
  },
  siren: (x) => {
    tone(x, { len: 5, f: (t) => 700 + 250 * Math.sin((2 * Math.PI * t) / 1.25), amp: 0.6, a: 0.01, d: 100 });
    return reverb(lowpass(x, 1500), 0.5, 2.2);
  },
  glitch: (x) => {
    const r = rng(61);
    for (let t = 0; t < 0.9; t += 0.04 + r() * 0.05) {
      if (r() < 0.5) tone(x, { at: t, len: 0.04, f: () => 200 + r() * 1800, type: "square", amp: 0.5, a: 0.001, d: 1 });
      else noise(x, { at: t, len: 0.035, f: () => 1000 + r() * 4000, q: 0.7, amp: 0.7, shape: () => 1, seed: Math.floor(r() * 1e6) });
    }
    return fadeOut(x, 0.2);
  },
  shimmer: (x) => {
    [1568, 2093, 2349, 2637, 3136, 3520].forEach((hz, i) => tone(x, { at: i * 0.08, len: 1.2, f: () => hz, amp: 0.25, d: 0.3 }));
    return fadeOut(reverb(x, 0.45, 2), 0.3);
  },
  fall: (x) => {
    tone(x, { len: 1.8, f: glide(600, 90, 1.5), type: "tri", amp: 0.7, a: 0.01, d: 0.8 });
    return fadeOut(reverb(lowpass(x, 2000), 0.3), 0.3);
  },
  whoosh: (x) => {
    noise(x, { len: 1.4, f: (t) => 250 + 900 * Math.sin(Math.PI * Math.min(1, t / 1.2)), q: 0.9, amp: 0.9, shape: bell(1.2), seed: 71 });
    return lowpass(x, 3000);
  },
  reverse: (x) => {
    const y = buf(1.5);
    noise(y, { len: 1.5, f: () => 3500, q: 0.8, amp: 0.8, shape: (t) => env(t, 0.001, 0.4), seed: 81 });
    reverb(y, 0.5, 2);
    for (let i = 0; i < x.length; i++) x[i] = y[y.length - 1 - i];
    return fadeOut(x, 0.01);
  },
  static: (x) => {
    noise(x, { len: 4, f: () => 2500, q: 0.4, amp: 0.4, shape: () => 1, seed: 91 });
    tone(x, { len: 4, f: () => 60, amp: 0.15, a: 0.01, d: 100 });
    const r = rng(92);
    for (let i = 0; i < 40; i++) noise(x, { at: r() * 3.9, len: 0.01, f: () => 3000, q: 1, amp: 1, shape: () => 1, seed: i });
    return x;
  },
};

/** Version synthétisée de secours d'un son narratif (sans clé ElevenLabs) : sa recette, ou celle de son mode. */
function storySynth(name) {
  const s = STORY_SFX[name];
  const x = buf(s.dur);
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (STORY[name]) return STORY[name](x);
  if (s.mode === "hit") {
    tone(x, { len: s.dur, f: glide(90, 34, 0.6), amp: 1, a: 0.003, d: s.dur / 4 });
    noise(x, { len: 0.3, f: () => 900, q: 0.6, amp: 0.6, shape: (t) => env(t, 0.001, 0.05), seed });
    return fadeOut(reverb(lowpass(x, 2000), 0.3, 1.8), 0.3);
  }
  if (s.mode === "swell") {
    const rise = (t) => Math.pow(Math.min(1, t / s.dur), 2.5);
    noise(x, { len: s.dur, f: (t) => 400 + 4000 * rise(t), q: 1.5, amp: 0.8, shape: rise, seed });
    tone(x, { len: s.dur, f: glide(180, 720, s.dur), amp: 0.3, a: s.dur * 0.9, d: 1 });
    return fadeOut(x, 0.02);
  }
  // Nappe : sinus graves désaccordés qui respirent, bouclable (nombre entier de cycles du souffle).
  const breath = s.dur / 2;
  for (const [hz, amp] of [[55, 0.5], [55.5, 0.4], [82.4, 0.25], [110.3, 0.12]]) {
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      ph += (2 * Math.PI * hz) / SR;
      x[i] += Math.sin(ph) * amp * (0.7 + 0.3 * Math.sin((2 * Math.PI * i) / SR / breath));
    }
  }
  noise(x, { len: s.dur, f: () => 600, q: 0.5, amp: 0.08, shape: () => 1, seed });
  return lowpass(x, 900);
}

/** Écrit un WAV mono 16 bits, normalisé à `peakDb` dBFS. */
function writeWav(file, x, peakDb = -3) {
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  if (!Number.isFinite(peak)) throw new Error(`Synthèse instable : ${file}`);
  const g = Math.pow(10, peakDb / 20) / peak;
  const data = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i] * g)) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

/* ------------------------------------------------------------------ ElevenLabs */

/** Une montée est générée avec cette marge (s) en plus, puis coupée à son pic. */
const SWELL_EXTRA = 1;

/** Instant (s) où une montée atteint son pic : premier passage à 1,5 dB de son niveau maximal (fenêtres de 50 ms). */
function swellPeak(mp3) {
  const p = spawnSync("ffmpeg", ["-hide_banner", "-i", mp3, "-af", `aresample=${SR},asetnsamples=${SR / 20},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level`, "-f", "null", "-"], { encoding: "utf8" });
  const rms = [...(p.stderr ?? "").matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => Number(m[1]) || -120);
  const max = Math.max(...rms);
  return (rms.findIndex((v) => v >= max - 1.5) + 1) / 20;
}

/**
 * mp3 ElevenLabs → WAV mono 44,1 kHz à la durée du catalogue, crête à -1 dBFS. Une montée garde ses `dur` dernières secondes
 * avant son pic (le mot tombe au sommet, pas après un plateau) ; les autres sons gardent leur début, avec un fondu de sortie
 * (sauf les nappes bouclées).
 */
function toWav(mp3, out, { dur, loop, mode }) {
  const end = mode === "swell" ? swellPeak(mp3) : dur;
  const start = Math.max(0, end - dur);
  const shape = mode === "swell"
    ? `aresample=${SR},atrim=${start}:${end},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,areverse,afade=t=in:d=0.015,apad,atrim=0:${dur},areverse`
    : `aresample=${SR},apad,atrim=0:${dur}${loop ? "" : `,afade=t=out:st=${Math.max(0, dur - 0.2)}:d=0.2`}`;
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", mp3, "-af", `${shape},volumedetect`, "-f", "null", "-"], { encoding: "utf8" });
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(probe.stderr ?? "")?.[1] ?? -1);
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", mp3, "-af", `${shape},volume=${(-1 - peak).toFixed(2)}dB`, "-ac", "1", "-c:a", "pcm_s16le", out], { stdio: "inherit" });
}

/* ------------------------------------------------------------------ point d'entrée */

const meta = (f) => `${f}.json`;
const readMeta = (f) => (existsSync(meta(f)) ? JSON.parse(readFileSync(meta(f), "utf8")) : null);

/**
 * Crée les bruitages manquants ou périmés. Renvoie le nombre de fichiers (re)créés (Remotion copie public/ au bundle :
 * > 0 → nouveau bundle). Sans clé ElevenLabs, les sons narratifs sont synthétisés ; une erreur ElevenLabs est remontée.
 * @param {{ force?: boolean, only?: string[], log?: (s: string) => void }} [opts]
 */
export async function ensureTaleSfx({ force = false, only = null, log = console.log } = {}) {
  const dir = join(ROOT, "public", "audio", "tale-sfx");
  mkdirSync(dir, { recursive: true });
  const want = (n) => !only?.length || only.includes(n);
  let made = 0;
  for (const name of Object.keys(ANIM)) {
    if (!want(name)) continue;
    const out = join(ROOT, "public", sfxFile(name));
    const recipe = { source: "synth", version: SYNTH_VERSION };
    if (!force && existsSync(out) && JSON.stringify(readMeta(out)) === JSON.stringify(recipe)) continue;
    writeWav(out, fadeOut(ANIM[name]()));
    writeFileSync(meta(out), JSON.stringify(recipe));
    made++;
  }
  let cfg = sfxConfig();
  for (const [name, s] of Object.entries(STORY_SFX)) {
    if (!want(name)) continue;
    const out = join(ROOT, "public", sfxFile(name));
    const el = cfg && { source: "elevenlabs", model: cfg.model, prompt: s.prompt, dur: s.dur, loop: !!s.loop, ...(s.influence ? { influence: s.influence } : {}) };
    const synth = { source: "synth", version: SYNTH_VERSION, dur: s.dur };
    const prev = readMeta(out);
    // Un son ElevenLabs déjà fait reste, même si la clé disparaît ; un son synthétisé à jour reste si ElevenLabs a échoué plus tôt.
    const same = (r) => r && JSON.stringify(prev) === JSON.stringify(r);
    const upToDate = same(el) || (!el && (same(synth) || (prev?.source === "elevenlabs" && prev.prompt === s.prompt && prev.dur === s.dur)));
    if (!force && existsSync(out) && upToDate) continue;
    let recipe = synth;
    if (el) {
      log(`♪ ElevenLabs SFX : ${name} (${s.dur} s)`);
      const tmp = `${out}.el.mp3`;
      try {
        const genDur = s.mode === "swell" ? s.dur + SWELL_EXTRA : s.dur;
        writeFileSync(tmp, await soundEffect(cfg.model, s.prompt, { dur: genDur, loop: !!s.loop, influence: s.influence }));
        toWav(tmp, out, s);
        recipe = el;
      } catch (e) {
        // Clé sans la permission « Sound Effects », plus de crédits… : version synthétisée, refaite au prochain essai.
        log(`⚠ ElevenLabs SFX indisponible (${e.message}) : sons narratifs synthétisés`);
        cfg = null;
      } finally {
        if (existsSync(tmp)) unlinkSync(tmp);
      }
    }
    if (recipe === synth) {
      if (!force && existsSync(out) && same(synth)) continue;
      writeWav(out, storySynth(name), -1);
    }
    writeFileSync(meta(out), JSON.stringify(recipe));
    made++;
  }
  if (made) log(`Bruitages : ${made} fichier(s) créé(s) dans public/audio/tale-sfx`);
  return made;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  await ensureTaleSfx({ force: args.includes("--force"), only: args.filter((a) => !a.startsWith("--")) });
}
