// Génère les SFX + toutes les musiques nécessaires au catalogue (seulement celles qui manquent).
// Musique : ElevenLabs Music si une clé est enregistrée (data/elevenlabs.json), sinon synthèse Python (scripts/gen-audio.py).
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isMain, PY } from "../shared/platform.mjs";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { loadCatalog, ROOT } from "../shared/catalog.mjs";
import { composeMusic, musicConfig } from "../shared/elevenlabs.mjs";

export { PY };
const GEN = join(ROOT, "scripts/gen-audio.py");
const BAR_MS = 2000; // 120 BPM, 4/4 : la grille de la timeline vidéo

// Description de chaque style pour ElevenLabs (mêmes noms que STYLES dans gen-audio.py).
const STYLES = {
  aggressive: ["aggressive electro house", "distorted reese bass", "hard punchy kick", "huge supersaw leads", "E minor"],
  house: ["uplifting deep house", "groovy bassline", "four-on-the-floor kick", "warm chord stabs", "offbeat open hi-hats", "F major"],
  elegant: ["elegant nu-disco", "smooth Rhodes chords", "silky strings", "tasteful claps", "luxurious", "A major"],
  synthwave: ["retro synthwave", "analog polysynth pads", "pulsing arpeggiated bass", "gated reverb snare", "neon 80s", "C minor"],
  playful: ["playful upbeat pop", "bouncy synth plucks", "marimba", "hand claps", "cheerful", "G major"],
  lofi: ["lo-fi hip hop", "dusty swung drums", "half-time feel", "mellow Rhodes", "vinyl crackle", "warm", "A major"],
  futurebass: ["future bass", "wobbly supersaw chords", "pitched synth chops", "half-time feel", "euphoric", "F sharp major"],
  tropical: ["tropical house", "marimba and steel drum plucks", "soft kick", "sunny and breezy", "G sharp major"],
  cinematic: ["epic cinematic trailer music", "hybrid orchestral", "taiko drums", "big brass and strings", "D minor"],
  trap: ["modern trap beat", "deep 808 bass", "rapid hi-hat rolls", "dark bell melody", "half-time feel", "hard-hitting", "F minor"],
  ambient: ["calm ambient", "soft evolving pads", "gentle piano notes", "airy", "no drums", "A major"],
  chill: ["chillhop", "soft brushed drums", "mellow clean guitar", "relaxed", "half-time feel", "G major"],
  piano: ["solo felt piano", "calm and reflective", "soft room reverb", "no drums", "F major"],
  // --- styles ElevenLabs uniquement (la synthèse Python de secours prend le style de SYNTH)
  phonk: ["drift phonk", "cowbell melody", "distorted 808 bass", "Memphis-style drums", "dark and gritty", "G minor"],
  darksynth: ["darksynth", "menacing analog bass", "cold arpeggios", "pounding drums", "cyberpunk", "D minor"],
  dreamtrap: ["dreamy cloud trap", "washed-out synth pads", "soft 808s", "airy bell melody", "half-time feel", "nostalgic", "E flat major"],
  electropop: ["bright electropop", "punchy synth bass", "sparkling arpeggios", "confident claps", "modern tech ad", "A major"],
};
const SYNTH = { phonk: "trap", darksynth: "synthwave", dreamtrap: "lofi", electropop: "house" };
const CALM = new Set(["ambient", "chill", "piano", "lofi"]); // pas de drop ni de montée
const COMMON = ["instrumental only", "120 BPM", "4/4", "polished modern production", "clean mix"];
const NO_VOICE = ["vocals", "singing", "lyrics", "spoken word", "voice", "rap", "choir", "humming"];
// Rôle de la musique selon le type de vidéo.
const ROLE = {
  short: ["scroll-stopping social ad music", "hooks from the very first beat", "catchy motif"],
  story: ["music bed under a voice-over", "leaves room for narration", "sparse midrange", "no busy lead melody"],
  long: ["product video soundtrack", "evolves and builds over the video"],
  keynote: ["calm product walkthrough", "unobtrusive background"],
};

/**
 * Plan de composition calé sur la timeline : intro jusqu'au drop, corps jusqu'au CTA, final.
 * Chaque section dure un nombre entier de mesures, entre 3 s et 120 s (limites de l'API).
 */
export function planFor(m) {
  const style = STYLES[m.style] ?? [m.style];
  const calm = CALM.has(m.style) || m.kind === "keynote";
  const theme = m.theme ?? [];
  const total = m.bars * BAR_MS;
  const cuts = [...new Set([0, m.drop * BAR_MS, m.cta * BAR_MS, total])].filter((t) => t >= 0 && t <= total).sort((a, b) => a - b);
  let parts = cuts.slice(1).map((end, i) => ({ start: cuts[i], end }));
  // Section trop courte (< 3 s) : fusionnée avec la suivante (ou la précédente pour la dernière).
  for (let i = 0; i < parts.length && parts.length > 1; ) {
    if (parts[i].end - parts[i].start >= 3000) { i++; continue; }
    if (i < parts.length - 1) parts.splice(i, 2, { start: parts[i].start, end: parts[i + 1].end });
    else parts.splice(i - 1, 2, { start: parts[i - 1].start, end: parts[i].end });
  }
  // Section de plus de 120 s (vidéo externe longue) : découpée en morceaux de 60 s, en mesures entières.
  parts = parts.flatMap((p) => {
    const out = [];
    for (let s = p.start; s < p.end; ) {
      const left = p.end - s;
      const len = left <= 120000 ? left : left - 60000 < 4000 ? left - 4000 : 60000;
      out.push({ start: s, end: s + len });
      s += len;
    }
    return out;
  });
  const role = (p) =>
    p.start === 0 && p.end <= m.drop * BAR_MS ? "intro"
    : p.start >= m.cta * BAR_MS ? "outro"
    : "main";
  const DIRECTIONS = calm
    ? { intro: ["soft gentle start", "sparse"], main: ["main theme", "steady and warm"], outro: ["gentle resolution", "clean ending on the tonic"] }
    // Intro audible dès la 1re image (c'est l'accroche du Short), qui monte jusqu'au drop.
    : { intro: ["hook intro", "beat and motif audible from the first second", "rising tension"], main: ["the drop", "full energy", "driving groove"], outro: ["final hook", "big last section", "clean ending on the tonic"] };
  const NAMES = { intro: "Intro", main: calm ? "Theme" : "Drop", outro: "Outro" };
  // La 1re section fixe le ton du morceau : genre + thème du projet + humeur de l'annonce + rôle ; les suivantes le rappellent.
  const first = [...style, ...theme, ...(ROLE[m.kind] ?? []), ...COMMON];
  const chunks = parts.map((p, i) => {
    const r = role(p);
    return {
      text: `[${NAMES[r]}]`,
      duration_ms: p.end - p.start,
      positive_styles: [...(i === 0 ? first : [style[0], ...theme.slice(0, 2), "120 BPM"]), ...DIRECTIONS[r]],
      negative_styles: [...NO_VOICE, ...(i === 0 ? ["silence", "quiet intro", "fade-in"] : []), ...(calm ? ["heavy drums", "drop", "aggressive"] : [])],
    };
  });
  return { chunks };
}

const meta = (out) => `${out}.json`;
/** mp3 ElevenLabs → wav 44,1 kHz stéréo à la durée exacte de la vidéo, crête ramenée à -1 dBFS. */
function toWav(mp3, out, totalSec) {
  const shape = `aresample=44100,apad,atrim=0:${totalSec},afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, totalSec - 0.25)}:d=0.25`;
  // volumedetect écrit sur stderr.
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", mp3, "-af", `${shape},volumedetect`, "-f", "null", "-"], { encoding: "utf8" });
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(probe.stderr ?? "")?.[1] ?? -1);
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", mp3, "-af", `${shape},volume=${(-1 - peak).toFixed(2)}dB`,
    "-ac", "2", "-c:a", "pcm_s16le", out], { stdio: "inherit" });
}

/** Niveau moyen (dBFS) des `sec` premières secondes. */
function openingLevel(file, sec) {
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-t", String(sec), "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  return Number(/mean_volume: (-?[\d.]+) dB/.exec(probe.stderr ?? "")?.[1] ?? 0);
}

async function elevenMusic(m, out, cfg, plan) {
  const tmp = `${out}.el.mp3`;
  // Short : l'accroche doit s'entendre. Si le modèle rend une intro quasi muette, on recompose une fois avec une autre graine.
  for (const seed of m.kind === "short" ? [m.seed, m.seed + 1000] : [m.seed]) {
    writeFileSync(tmp, await composeMusic(cfg.model, plan, seed));
    try {
      toWav(tmp, out, (m.bars * BAR_MS) / 1000);
    } finally {
      unlinkSync(tmp);
    }
    const level = openingLevel(out, 4);
    if (level >= -24) break;
    console.warn(`⚠ Intro trop discrète (${level} dBFS) : ${seed === m.seed ? "nouvel essai" : "gardée quand même"}`);
  }
  writeFileSync(meta(out), JSON.stringify({ source: "elevenlabs", model: cfg.model, style: m.style, plan }, null, 2));
}

/**
 * Crée la musique si elle manque. Avec ElevenLabs, une piste issue de la synthèse Python (sans fichier .json à côté)
 * ou composée avec un autre plan (style, thème ou humeur modifiés) est recomposée. Renvoie true si un fichier a été (re)créé.
 */
export async function ensureMusic(m, force = false) {
  const out = join(ROOT, "public", m.file);
  const cfg = musicConfig();
  const plan = cfg && planFor(m);
  const prev = existsSync(meta(out)) ? JSON.parse(readFileSync(meta(out), "utf8")) : null;
  const upToDate = prev?.source === "elevenlabs" && prev.model === cfg?.model && JSON.stringify(prev.plan) === JSON.stringify(plan);
  if (existsSync(out) && !force && (!cfg || upToDate)) return false;
  mkdirSync(dirname(out), { recursive: true });
  if (cfg) {
    try {
      console.log(`♪ ElevenLabs Music : ${m.style}, ${m.bars} mesures → ${m.file}`);
      await elevenMusic(m, out, cfg, plan);
      return true;
    } catch (e) {
      console.warn(`⚠ ElevenLabs Music indisponible (${e.message}) : synthèse Python en secours`);
      if (existsSync(out) && !force) return false;
    }
  }
  execFileSync(PY, [GEN, "music", "--style", SYNTH[m.style] ?? m.style, "--bars", String(m.bars), "--drop", String(m.drop),
    "--cta", String(m.cta), "--seed", String(m.seed), "--out", out], { stdio: "inherit" });
  if (existsSync(meta(out))) unlinkSync(meta(out));
  return true;
}

export function ensureSfx(force = false) {
  if (existsSync(join(ROOT, "public/audio/sfx/impact.wav")) && !force) return;
  execFileSync(PY, [GEN, "sfx", "--out", join(ROOT, "public/audio/sfx")], { stdio: "inherit" });
}

if (isMain(import.meta.url)) {
  const force = process.argv.includes("--force");
  ensureSfx(force);
  const seen = new Set();
  for (const v of loadCatalog().videos) {
    if (!v.music || seen.has(v.music.file)) continue;
    seen.add(v.music.file);
    await ensureMusic(v.music, force);
  }
  console.log(`✓ ${seen.size} musiques prêtes`);
}
