// Voix off des Shorts narrés avec la synthèse vocale macOS (`say`), + horodatage des mots pour les sous-titres.
// Choisit automatiquement la meilleure voix installée (Premium/Enhanced en priorité).
// Usage : node scripts/gen-voice.mjs [--force]
//
// 💡 Pour une voix bien plus naturelle : Réglages Système → Accessibilité → Contenu énoncé → Voix du système
//    → Gérer les voix → télécharger "Thomas (Premium)" (FR) et "Ava (Premium)" ou "Zoe (Premium)" (EN),
//    puis relancer avec --force.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadApps, ROOT } from "../shared/catalog.mjs";
import { videoId } from "../shared/timeline.mjs";

const MANIFEST = join(ROOT, "content/voices.json");

function installedVoices() {
  return execFileSync("say", ["-v", "?"], { encoding: "utf8" })
    .split("\n")
    .map((l) => l.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/))
    .filter(Boolean)
    .map((m) => ({ name: m[1].trim(), locale: m[2] }));
}

export function pickVoice(lang) {
  const all = installedVoices();
  const loc = lang === "fr" ? ["fr_FR", "fr_CA"] : ["en_US", "en_GB"];
  const good = lang === "fr" ? /^(Thomas|Audrey|Aurélie|Amélie|Marie|Daniel)/ : /^(Ava|Zoe|Evan|Nathan|Samantha|Allison|Tom|Susan|Joelle|Noelle)/;
  const q = (v) => /premium/i.test(v.name) ? 3 : /enhanced|amélior/i.test(v.name) ? 2 : 0;
  const cands = all
    .filter((v) => loc.includes(v.locale) && !/(Jacques|Grandma|Grandpa|Rocko|Eddy|Flo|Reed|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Jester|Organ|Superstar|Zarvox|Whisper|Trinoids|News|Albert|Fred|Junior|Ralph|Kathy)/.test(v.name))
    .map((v) => ({ ...v, score: q(v) + (good.test(v.name) ? 1 : 0) + (v.locale === loc[0] ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score);
  return cands[0]?.name ?? (lang === "fr" ? "Thomas" : "Samantha");
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

export function ensureVoices(force = false) {
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const voices = { fr: pickVoice("fr"), en: pickVoice("en") };
  let changed = false;
  for (const app of loadApps()) {
    (app.stories ?? []).forEach((story, i) => {
      for (const lang of ["fr", "en"]) {
        const id = videoId(app.slug, "story", lang, i);
        const lines = story.narration[lang];
        const sig = JSON.stringify([voices[lang], lines]);
        if (!force && manifest[id]?.sig === sig) continue;
        const dir = join(ROOT, "public/voice", id);
        mkdirSync(dir, { recursive: true });
        const segments = lines.map((text, k) => {
          const raw = join(dir, `seg${k}.raw.aiff`);
          const out = join(dir, `seg${k}.wav`);
          execFileSync("say", ["-v", voices[lang], "-r", lang === "fr" ? "205" : "195", "-o", raw, text]);
          // Traitement "voix off" : coupe-bas, compression, présence, un peu de chaleur, niveau homogène.
          execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af",
            "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse," +
            "highpass=f=90,equalizer=f=200:t=q:w=1:g=2,equalizer=f=3500:t=q:w=1.2:g=4,acompressor=threshold=-20dB:ratio=3.5:attack=4:release=90:makeup=4,loudnorm=I=-15:TP=-1.5",
            "-ar", "48000", "-ac", "1", out]);
          execFileSync("rm", ["-f", raw]);
          const d = dur(out);
          return { file: `voice/${id}/seg${k}.wav`, dur: +d.toFixed(3), words: wordTimings(text, d) };
        });
        manifest[id] = { sig, voice: voices[lang], segments };
        changed = true;
        console.log(`🎙️  ${id} (${voices[lang]}) — ${segments.map((s) => s.dur.toFixed(1)).join(" / ")} s`);
      }
    });
  }
  if (changed) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Voix : FR = ${pickVoice("fr")}, EN = ${pickVoice("en")}`);
  ensureVoices(process.argv.includes("--force"));
}
