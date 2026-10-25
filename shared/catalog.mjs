// Catalogue : charge les apps depuis content/apps/*.json et liste toutes les vidéos.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, musicFor, videosFor, FPS } from "./timeline.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const APP_ORDER = ["hyrox", "sociaflow", "beautyflow", "mrrkit", "decido", "revenuepilot"];

export function loadApps() {
  const dir = join(ROOT, "content", "apps");
  const apps = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  // L'app d'exemple ("example": true, ex. MRRKit) disparaît dès qu'on a ajouté sa propre app :
  // ni rendue, ni programmée, ni uploadée sur ta chaîne.
  const own = apps.filter((a) => !a.example);
  return (own.length ? own : apps).sort((a, b) => APP_ORDER.indexOf(a.slug) - APP_ORDER.indexOf(b.slug));
}

/** Toutes les vidéos avec leurs métadonnées (titre, durée, musique…). */
export function loadVoices() {
  const f = join(ROOT, "content", "voices.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}

export function loadCatalog() {
  const apps = loadApps();
  const voices = loadVoices();
  const videos = [];
  for (const app of apps) {
    for (const v of videosFor(app)) {
      const voice = v.kind === "story" ? voices[v.id] ?? null : null;
      const t = buildTimeline(app, v.kind, v.shortIndex, voice);
      const title =
        v.kind === "short" ? app.shorts[v.shortIndex].yt.title[v.lang]
        : v.kind === "story" ? app.stories[v.shortIndex].yt.title[v.lang]
        : v.kind === "keynote" ? app.keynote.videos[v.shortIndex].yt.title[v.lang]
        : app.long.yt.title[v.lang];
      videos.push({
        ...v,
        appName: app.name,
        title,
        durationSec: t.totalFrames / FPS,
        format: v.kind === "long" ? "long" : v.kind === "keynote" ? app.keynote.videos[v.shortIndex].format : "short",
        music: musicFor(app, v.kind, v.shortIndex, voice),
        hasVoice: !!voice,
        color: app.brand.primary,
      });
    }
  }
  // Vidéos déjà montées ailleurs (content/external.json) : on ajoute juste musique + mastering, puis on programme.
  const extFile = join(ROOT, "content", "external.json");
  const ext = existsSync(extFile) ? JSON.parse(readFileSync(extFile, "utf8")).videos ?? [] : [];
  for (const e of ext) {
    const app = apps.find((a) => a.slug === e.slug);
    if (!app || !existsSync(e.src)) continue;
    const bars = Math.ceil(e.durationSec / 2);
    const pool = app.musicPool?.length ? app.musicPool : [app.music];
    const style = pool[(e.order + 1) % pool.length];
    const seed = 20 + e.order + (e.kind === "long" ? 10 : 0);
    videos.push({
      id: e.id,
      slug: e.slug,
      kind: e.kind,
      format: e.kind === "long" ? "long" : "short",
      lang: e.lang,
      shortIndex: 100 + e.order,
      appName: app.name,
      title: e.title,
      durationSec: e.durationSec,
      // Musique de secours : utilisée si la vidéo est muette (vérifié au rendu, même si "hasAudio").
      music: { file: `audio/music/v3-ext-${e.slug}-${e.kind}-${seed}-${style}-${bars}b.wav`, style, kind: e.kind, theme: app.sound ?? [], bars, drop: 1, cta: Math.max(2, bars - 2), seed },
      color: app.brand.primary,
      external: e,
    });
  }
  return { apps, videos };
}
