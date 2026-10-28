// File de rendu : bundle Remotion (mis en cache), rendu MP4, mastering audio (-14 LUFS), miniature.
import { existsSync, readdirSync, renameSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { ROOT } from "../shared/catalog.mjs";
import { ensureMusic, ensureSfx } from "../scripts/gen-all-audio.mjs";
import { ensureTaleSfx } from "../scripts/gen-tale-sfx.mjs";
import { ensureVoices } from "../scripts/gen-voice.mjs";
import { langOn, OUT, save, video } from "./state.mjs";
import { logEvent, recordDuration } from "./events.mjs";

const run = promisify(execFile);

export const queue = []; // ids en attente
/** Ids à remixer seulement (stories : bruitages changés) : audio rendu à nouveau, image existante copiée telle quelle. */
const audioOnly = new Set();
export const STAGES = ["Voix off", "Musique", "Préparation", "Rendu des images", "Mastering audio", "Miniature"];
export const current = { id: null, progress: 0, stage: "", stageIndex: -1, startedAt: null, stageStartedAt: null };
const stage = (i) => Object.assign(current, { stage: STAGES[i], stageIndex: i, stageStartedAt: Date.now() });
let serveUrl = null;
let bundledAt = 0;
/** Dossier du bundle en service (serveUrl peut être remis à null pour forcer un nouveau bundle). */
let bundleDir = null;
let working = false;
let catalogRef = null;

export const outFile = (id) => join(OUT, `${id}.mp4`);
/** Appelés après chaque rendu réussi, avec la vidéo du catalogue (ex. stories : statut + brouillon TikTok). */
export const onRendered = [];

/**
 * Mastering -14 LUFS en 2 passes, mode linéaire : un simple gain, qui préserve les nuances
 * (intro douce, montées) au lieu de les écraser comme le mode dynamique.
 * `inputs` = arguments d'entrée ffmpeg, `map` = mappage + options vidéo, `pre` = filtres audio avant normalisation.
 */
export async function master(inputs, map, pre, out) {
  const chain = pre ? `${pre},` : "";
  const { stderr } = await run("ffmpeg", ["-hide_banner", ...inputs, ...map.filter((a) => a !== "-c:v" && a !== "copy"), "-af", `${chain}loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"], { maxBuffer: 64 * 1024 * 1024 }).catch((e) => e);
  const m = /\{[\s\S]*"input_i"[\s\S]*?\}/.exec(String(stderr));
  let filter = `${chain}loudnorm=I=-14:TP=-1.5:LRA=11`;
  if (m) {
    const j = JSON.parse(m[0]);
    filter = `${chain}loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  }
  await run("ffmpeg", ["-v", "error", "-y", ...inputs, ...map, "-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", out]);
}
export const thumbFile = (id) => join(OUT, `${id}.jpg`);

/** Date de dernière modification du code / contenu → rebundle si nécessaire. */
function sourcesMtime() {
  let max = 0;
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else max = Math.max(max, statSync(p).mtimeMs);
    }
  };
  ["src", "content", "shared"].forEach((d) => walk(join(ROOT, d)));
  return max;
}

async function getBundle() {
  const m = sourcesMtime();
  if (!serveUrl || m > bundledAt) {
    stage(2);
    serveUrl = await bundle({ entryPoint: join(ROOT, "src/index.ts"), publicDir: join(ROOT, "public") });
    bundledAt = Date.now();
    // Chaque bundle copie tout public/ (voix, sons) dans le dossier temporaire : l'ancien part, sinon le disque se remplit.
    if (bundleDir && bundleDir !== serveUrl) rmSync(bundleDir, { recursive: true, force: true });
    bundleDir = serveUrl;
  }
  return serveUrl;
}

export function enqueue(ids, catalog, { audioOnly: onlyAudio = false } = {}) {
  catalogRef = catalog;
  for (const id of ids) {
    if (onlyAudio) audioOnly.add(id);
    else audioOnly.delete(id); // un rendu complet demandé l'emporte
  }
  const before = queue.length;
  for (const id of ids) if (!queue.includes(id) && current.id !== id) queue.push(id);
  if (queue.length > before) logEvent("info", `${queue.length - before} vidéo(s) ajoutée(s) à la file de rendu`);
  void work();
}

/** Retire de la file les vidéos dont la langue est en pause. */
export function dropPausedFromQueue() {
  const keep = queue.filter((id) => langOn(catalogRef?.videos.find((x) => x.id === id)?.lang));
  queue.length = 0;
  queue.push(...keep);
}

export function cancelQueue() {
  audioOnly.clear();
  if (queue.length) logEvent("info", `File de rendu vidée (${queue.length} vidéo(s) retirée(s))`);
  queue.length = 0;
}

async function work() {
  if (working) return;
  working = true;
  while (queue.length) {
    const id = queue.shift();
    const v = catalogRef.videos.find((x) => x.id === id);
    if (!v || !langOn(v.lang)) continue;
    Object.assign(current, { id, progress: 0, startedAt: Date.now() });
    stage(0);
    const st = video(id);
    try {
      if (v.external) {
        // Vidéo externe muette : musique calée sur la grille 120 BPM (frame 0 = premier temps) + mastering.
        const d = v.external.durationSec;
        const tmp = join(OUT, `${id}.tmp.mp4`);
        // La piste audio d'origine est-elle vraiment audible ? (certaines exports ont une piste muette)
        let audible = false;
        if (v.external.hasAudio) {
          const { stderr } = await run("ffmpeg", ["-hide_banner", "-i", v.external.src, "-af", "volumedetect", "-f", "null", "-"]).catch((e) => e);
          const m = /max_volume: (-?[\d.]+) dB/.exec(String(stderr));
          audible = !!m && Number(m[1]) > -60;
        }
        if (!audible) {
          stage(1);
          await ensureMusic(v.music);
          stage(4);
          await master(["-i", v.external.src, "-i", join(ROOT, "public", v.music.file)], ["-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-t", String(d)],
            `atrim=0:${d},afade=t=out:st=${Math.max(0, d - 1.2)}:d=1.2`, tmp);
        } else {
          // Déjà sonorisée : on garde l'audio d'origine, mastering au standard YouTube uniquement.
          stage(4);
          await master(["-i", v.external.src], ["-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy"], null, tmp);
        }
        renameSync(tmp, outFile(id));
        stage(5);
        const thumbArgs = v.external.cover ? ["-i", v.external.cover] : ["-ss", "2", "-i", outFile(id), "-frames:v", "1"];
        await run("ffmpeg", ["-v", "error", "-y", ...thumbArgs, "-vf", v.kind === "long" ? "scale=1280:720" : "scale=360:-2", "-q:v", "3", thumbFile(id)]);
        Object.assign(st, { rendered: true, renderedAt: new Date().toISOString(), renderError: null });
        logEvent("render", `Vidéo externe prête${!audible ? " (musique ajoutée)" : " (son d'origine)"} : ${v.title}`, id);
        save();
        Object.assign(current, { id: null, progress: 0, stage: "", stageIndex: -1 });
        continue;
      }
      ensureSfx();
      // Voix manquante ou périmée (texte modifié, passage à ElevenLabs, autre voix) : régénérée avant le rendu.
      if (v.kind === "story" && (await ensureVoices(false, id))) {
        serveUrl = null;
        const fresh = (await import("../shared/catalog.mjs")).loadCatalog().videos.find((x) => x.id === id);
        Object.assign(v, fresh);
      }
      stage(1);
      // Remotion copie public/ au moment du bundle : un fichier audio créé après → nouveau bundle.
      if (v.music && (await ensureMusic(v.music))) serveUrl = null;
      // Stories crypto : pas de musique, des bruitages (bibliothèque commune, créée une fois).
      if (v.kind === "tale" && (await ensureTaleSfx())) serveUrl = null;
      const url = await getBundle();
      stage(3);
      const composition = await selectComposition({ serveUrl: url, id });
      if (audioOnly.delete(id) && v.kind === "tale" && existsSync(outFile(id))) {
        // Remix : seul le son est rendu (pas de capture d'images), puis remonté sur la piste vidéo existante, copiée sans réencodage.
        const wav = join(OUT, `${id}.remix.wav`);
        await renderMedia({ composition, serveUrl: url, codec: "wav", outputLocation: wav, onProgress: ({ progress }) => (current.progress = progress) });
        stage(4);
        const tmp = join(OUT, `${id}.tmp.mp4`);
        await master(["-i", outFile(id), "-i", wav], ["-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy"], null, tmp);
        renameSync(tmp, outFile(id));
        unlinkSync(wav);
        Object.assign(st, { rendered: true, renderedAt: new Date().toISOString(), renderError: null });
        logEvent("render", `Son remixé : ${v.title} (${Math.round((Date.now() - current.startedAt) / 1000)} s, image inchangée)`, id);
        for (const f of onRendered) Promise.resolve().then(() => f(v)).catch((e) => console.error("après rendu", e));
        save();
        Object.assign(current, { id: null, progress: 0, stage: "", stageIndex: -1 });
        continue;
      }
      const raw = join(OUT, `${id}.raw.mp4`);
      await renderMedia({
        composition,
        serveUrl: url,
        codec: "h264",
        crf: 17,
        audioBitrate: "320k",
        outputLocation: raw,
        onProgress: ({ progress }) => {
          current.progress = progress;
        },
      });
      stage(4);
      const tmp = join(OUT, `${id}.tmp.mp4`);
      await master(["-i", raw], ["-c:v", "copy"], null, tmp);
      renameSync(tmp, outFile(id));
      unlinkSync(raw);
      stage(5);
      if (v.kind === "long") {
        const thumbComp = await selectComposition({ serveUrl: url, id: `${v.slug}-thumb-${v.lang}` });
        await renderStill({ composition: thumbComp, serveUrl: url, output: thumbFile(id), imageFormat: "jpeg", jpegQuality: 92 });
      } else if (v.format === "long") {
        // Keynote 16:9 : miniature = une image de la 1re scène de détail
        await run("ffmpeg", ["-v", "error", "-y", "-ss", "8.5", "-i", outFile(id), "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "3", thumbFile(id)]);
      } else {
        // Aperçu pour le dashboard : une image du milieu du short
        await run("ffmpeg", ["-v", "error", "-y", "-ss", v.kind === "tale" ? (v.durationSec / 2).toFixed(2) : "7", "-i", outFile(id), "-frames:v", "1", "-vf", "scale=360:-2", thumbFile(id)]);
      }
      Object.assign(st, { rendered: true, renderedAt: new Date().toISOString(), renderError: null });
      const secs = (Date.now() - current.startedAt) / 1000;
      recordDuration(v.kind, secs);
      logEvent("render", `Vidéo prête : ${v.title} (${Math.round(secs / 60)} min ${Math.round(secs % 60)} s)`, id);
      for (const f of onRendered) Promise.resolve().then(() => f(v)).catch((e) => console.error("après rendu", e));
    } catch (e) {
      console.error(`Rendu ${id} échoué`, e);
      st.renderError = String(e?.message ?? e).slice(0, 500);
      logEvent("error", `Échec du rendu de ${id} : ${st.renderError.slice(0, 140)}`, id);
    }
    save();
    Object.assign(current, { id: null, progress: 0, stage: "", stageIndex: -1 });
  }
  working = false;
}

export const isRendered = (id) => existsSync(outFile(id));
/** Un rendu tourne ou attend (le dossier de stockage ne peut pas changer pendant ce temps). */
export const renderBusy = () => working || queue.length > 0;

/**
 * J+1 après la sortie sur YouTube : le MP4 ne sert plus (gardé tant qu'un post TikTok non envoyé en a besoin),
 * et le cache Remotion (anciens bundles du dossier temporaire, cache webpack) repart à zéro. La miniature reste.
 */
export function cleanupPublished(catalog, state, tiktokPosts) {
  if (working || queue.length) return;
  const dayAgo = Date.now() - 86400000;
  const cleaned = [];
  for (const v of catalog.videos) {
    const st = state.videos[v.id];
    if (!st?.youtubeId || !st.publishAt || new Date(st.publishAt).getTime() > dayAgo || !isRendered(v.id)) continue;
    if (tiktokPosts.some((p) => p.status !== "sent" && (p.videoId === v.id || p.videoFile === outFile(v.id)))) continue;
    for (const f of [outFile(v.id), join(OUT, `${v.id}.tmp.mp4`), join(OUT, `${v.id}.raw.mp4`), join(OUT, `${v.id}.remix.wav`)]) rmSync(f, { force: true });
    st.cleanedAt = new Date().toISOString();
    cleaned.push(v.title);
  }
  if (!cleaned.length) return;
  const tmp = tmpdir();
  for (const d of readdirSync(tmp)) {
    const p = join(tmp, d);
    if (/^remotion-(webpack-bundle-|v[d.]+-assets)/.test(d) && p !== bundleDir && !(bundleDir ?? "").startsWith(p)) rmSync(p, { recursive: true, force: true });
  }
  rmSync(join(ROOT, "node_modules/.cache/webpack"), { recursive: true, force: true });
  save();
  logEvent("info", `Nettoyage J+1 : ${cleaned.length} vidéo(s) publiée(s) retirée(s) du disque (${cleaned.join(", ")}) et cache Remotion vidé`);
}
