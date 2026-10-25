// Voix off des Shorts narrés, + horodatage des mots pour les sous-titres.
// ElevenLabs si une voix est configurée pour la langue (guide d'installation → Voix off, data/elevenlabs.json),
// sinon la synthèse vocale du système (`say` sur macOS, WinRT sur Windows).
// Choisit automatiquement la meilleure voix système installée (Premium/Enhanced en priorité).
// Usage : node scripts/gen-voice.mjs [--force]
//
// 💡 Pour une voix bien plus naturelle : Réglages Système → Accessibilité → Contenu énoncé → Voix du système
//    → Gérer les voix → télécharger "Thomas (Premium)" (FR) et "Ava (Premium)" ou "Zoe (Premium)" (EN),
//    puis relancer avec --force.
// 💡 Windows : Paramètres → Heure et langue → Voix → Ajouter des voix → Français (Julie, Paul, Hortense),
//    puis relancer avec --force.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadApps, ROOT } from "../shared/catalog.mjs";
import { installedVoices, isMain, IS_WIN, speakToFile } from "../shared/platform.mjs";
import { synthesize, voiceFor } from "../shared/elevenlabs.mjs";
import { videoId } from "../shared/timeline.mjs";

const MANIFEST = join(ROOT, "content/voices.json");

export function pickVoice(lang) {
  const all = installedVoices();
  const loc = lang === "fr" ? ["fr_FR", "fr_CA"] : ["en_US", "en_GB"];
  const good = lang === "fr"
    ? /^(Thomas|Audrey|Aurélie|Amélie|Marie|Daniel|Microsoft (Denise|Julie|Hortense|Paul))/
    : /^(Ava|Zoe|Evan|Nathan|Samantha|Allison|Tom|Susan|Joelle|Noelle|Microsoft (Aria|Jenny|Guy|Zira|Mark))/;
  const q = (v) => /premium/i.test(v.name) ? 3 : /enhanced|amélior/i.test(v.name) ? 2 : 0;
  const cands = all
    .filter((v) => loc.includes(v.locale) && !/(Jacques|Grandma|Grandpa|Rocko|Eddy|Flo|Reed|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Jester|Organ|Superstar|Zarvox|Whisper|Trinoids|News|Albert|Fred|Junior|Ralph|Kathy)/.test(v.name))
    .map((v) => ({ ...v, score: q(v) + (good.test(v.name) ? 1 : 0) + (v.locale === loc[0] ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score);
  // Windows n'a pas toujours de voix française : sans elle, la voix par défaut lirait le français avec l'accent anglais.
  return cands[0]?.name ?? (IS_WIN ? null : lang === "fr" ? "Thomas" : "Samantha");
}

/** Répartit la durée sur les mots selon leur longueur (+ pauses à la ponctuation). */
function wordTimings(text, dur) {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = (w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length) + 1.5 + (/[.,:;!?]$/.test(w) ? 3 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  const lead = 0.08;
  const usable = Math.max(0.3, dur - lead - 0.12);
  let t = lead;
  return words.map((w) => {
    const d = (weight(w) / total) * usable;
    const r = { w, s: +t.toFixed(3), e: +(t + d * 0.92).toFixed(3) };
    t += d;
    return r;
  });
}

const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

/** Voix système : fichier brut → voix off traitée (silences coupés, coupe-bas, compression, présence, niveau). */
function systemSegment(voice, lang, text, raw, out) {
  speakToFile(voice, lang === "fr" ? 205 : 195, text, raw);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse," +
    "highpass=f=90,equalizer=f=200:t=q:w=1:g=2,equalizer=f=3500:t=q:w=1.2:g=4,acompressor=threshold=-20dB:ratio=3.5:attack=4:release=90:makeup=4,loudnorm=I=-15:TP=-1.5",
    "-ar", "48000", "-ac", "1", out]);
  unlinkSync(raw);
  return null;
}

/**
 * ElevenLabs : le son arrive déjà propre, on le coupe juste au premier / dernier caractère prononcé
 * (d'après l'alignement) et on égalise le niveau. Renvoie les mots horodatés, décalés de la coupe.
 */
async function elevenSegment(voice, lang, lines, k, raw, out) {
  const { audio, words } = await synthesize(voice, lang, lines[k], { previous: lines.slice(0, k).join(" "), next: lines.slice(k + 1).join(" ") });
  writeFileSync(raw, audio);
  const from = words ? Math.max(0, words[0].s - 0.04) : 0;
  const to = words ? words.at(-1).e + 0.15 : null;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-ss", from.toFixed(3), ...(to ? ["-to", to.toFixed(3)] : []), "-af",
    (words ? "" : "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,") +
    "highpass=f=70,acompressor=threshold=-18dB:ratio=2.5:attack=5:release=120:makeup=2,loudnorm=I=-15:TP=-1.5",
    "-ar", "48000", "-ac", "1", out]);
  unlinkSync(raw);
  return words?.map((x) => ({ w: x.w, s: +(x.s - from).toFixed(3), e: +(x.e - from).toFixed(3) })) ?? null;
}

/** Génère les voix off manquantes ou périmées (toutes, ou seulement la vidéo `only`). Renvoie true si content/voices.json a changé. */
export async function ensureVoices(force = false, only = null) {
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const eleven = { fr: voiceFor("fr"), en: voiceFor("en") };
  const system = { fr: eleven.fr ? null : pickVoice("fr"), en: eleven.en ? null : pickVoice("en") };
  let changed = false;
  for (const lang of ["fr", "en"]) if (!eleven[lang] && !system[lang]) console.warn(`⚠️  Aucune voix ${lang} : Shorts narrés ${lang} rendus sans voix off (voir l'en-tête de scripts/gen-voice.mjs ou configure ElevenLabs).`);
  for (const app of loadApps()) {
    for (const [i, story] of (app.stories ?? []).entries()) {
      for (const lang of ["fr", "en"]) {
        const el = eleven[lang];
        const label = el ? `ElevenLabs · ${el.name}` : system[lang];
        if (!label) continue;
        const id = videoId(app.slug, "story", lang, i);
        if (only && id !== only) continue;
        const lines = story.narration[lang];
        const sig = JSON.stringify([el ? el.sig : system[lang], lines]);
        if (!force && manifest[id]?.sig === sig) continue;
        const dir = join(ROOT, "public/voice", id);
        mkdirSync(dir, { recursive: true });
        const segments = [];
        for (const [k, text] of lines.entries()) {
          const raw = join(dir, `seg${k}.raw.${el ? "mp3" : IS_WIN ? "wav" : "aiff"}`);
          const out = join(dir, `seg${k}.wav`);
          const words = el ? await elevenSegment(el, lang, lines, k, raw, out) : systemSegment(system[lang], lang, text, raw, out);
          const d = dur(out);
          segments.push({ file: `voice/${id}/seg${k}.wav`, dur: +d.toFixed(3), words: words ?? wordTimings(text, d) });
        }
        manifest[id] = { sig, voice: label, segments };
        changed = true;
        writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
        console.log(`🎙️  ${id} (${label}) — ${segments.map((s) => s.dur.toFixed(1)).join(" / ")} s`);
      }
    }
  }
  return changed;
}

if (isMain(import.meta.url)) {
  const label = (lang) => (voiceFor(lang) ? `ElevenLabs · ${voiceFor(lang).name}` : pickVoice(lang) ?? "aucune");
  console.log(`Voix : FR = ${label("fr")}, EN = ${label("en")}`);
  await ensureVoices(process.argv.includes("--force"));
}
