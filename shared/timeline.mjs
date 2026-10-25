// Timeline partagée entre Remotion (rendu), le serveur (catalogue) et la génération musicale.
// Tout est calé sur une grille 120 BPM : 1 temps = 15 frames, 1 mesure = 60 frames (30 fps).

export const FPS = 30;
export const BEAT = 15;
export const BAR = 60;

export const FORMATS = {
  short: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
  thumb: { width: 1280, height: 720 },
};

/**
 * @typedef {{type: string, from: number, dur: number, featureId?: string, featureIndex?: number, lines?: number}} Scene
 * @typedef {{scenes: Scene[], totalFrames: number, bars: number, dropBar: number, ctaBar: number}} Timeline
 */

/** Nombre de mesures pour couvrir une phrase parlée (avec marge), minimum `min`. */
const barsFor = (sec, min) => Math.max(min, Math.ceil((sec + 0.7) / (BAR / FPS)));

/**
 * @param voice pour kind "story" : { segments: [{ dur }] } (hook, 3 features, CTA) — cf. content/voices.json
 * @returns {Timeline}
 */
export function buildTimeline(app, kind, shortIndex = 0, voice = null) {
  /** @type {Scene[]} */
  const scenes = [];
  let bar = 0;
  const push = (type, bars, extra = {}) => {
    scenes.push({ type, from: bar * BAR, dur: bars * BAR, ...extra });
    bar += bars;
  };

  let dropBar;
  let ctaBar;
  if (kind === "short") {
    const def = app.shorts[shortIndex];
    push("hook", 1);
    push("reveal", 1);
    dropBar = bar;
    def.features.forEach((id, i) => push("feature", 3, { featureId: id, featureIndex: i }));
    push("montage", 1);
    ctaBar = bar;
    push("cta", 4);
  } else if (kind === "keynote") {
    // Série calme "Keynote" : intro, un élément de l'app par scène (6 s), mosaïque, outro.
    const def = app.keynote.videos[shortIndex];
    const long = def.format === "long";
    push("k-intro", long ? 3 : 2);
    dropBar = 1;
    def.details.forEach((id, i) => push("k-detail", 3, { detailId: id, featureIndex: i }));
    push("k-bento", long ? 3 : 2);
    ctaBar = bar;
    push("k-outro", 4);
  } else if (kind === "story") {
    const def = app.stories[shortIndex];
    const seg = (i) => voice?.segments?.[i]?.dur ?? 4;
    push("hook", barsFor(seg(0), 2), { voiceSeg: 0 });
    push("reveal", 1);
    dropBar = bar - 1;
    def.features.forEach((id, i) => push("feature", barsFor(seg(i + 1), 3), { featureId: id, featureIndex: i, voiceSeg: i + 1 }));
    ctaBar = bar;
    push("cta", barsFor(seg(4) + 2, 4), { voiceSeg: 4 });
  } else {
    const hookLines = app.long.hook.length;
    push("hook", hookLines, { lines: hookLines });
    push("problem", 3);
    dropBar = bar;
    push("reveal", 2);
    app.long.features.forEach((id, i) => push("feature", 3, { featureId: id, featureIndex: i }));
    push("montage", 2);
    push("benefits", 3);
    ctaBar = bar;
    push("cta", 4);
  }
  return { scenes, totalFrames: bar * BAR, bars: bar, dropBar, ctaBar };
}

/** Identifiant de composition Remotion / de vidéo. */
export const videoId = (slug, kind, lang, shortIndex = 0) =>
  kind === "short" ? `${slug}-s${shortIndex + 1}-${lang}`
  : kind === "story" ? `${slug}-v${shortIndex + 1}-${lang}`
  : kind === "keynote" ? `${slug}-k${shortIndex + 1}-${lang}`
  : `${slug}-long-${lang}`;

/** Fichier musical attendu (relatif à public/). La musique ne dépend pas de la langue. */
export function musicFor(app, kind, shortIndex = 0, voice = null) {
  const t = buildTimeline(app, kind, shortIndex, voice);
  // Direction musicale propre à la vidéo (genre + humeur de l'annonce), sinon la playlist de l'app.
  const def = kind === "short" ? app.shorts[shortIndex]?.music
    : kind === "story" ? app.stories?.[shortIndex]?.music
    : kind === "keynote" ? app.keynote?.videos[shortIndex]?.music
    : app.long.music;
  // Thème sonore du projet + humeur de la vidéo : décrit à ElevenLabs Music (ignoré par la synthèse Python).
  const theme = [...(app.sound ?? []), ...(def?.mood ?? [])];
  if (kind === "keynote") {
    const pool = app.keynote?.musicPool ?? ["ambient"];
    const style = def?.style ?? pool[shortIndex % pool.length];
    const seed = 30 + shortIndex;
    return { file: `audio/music/v2-${app.slug}-keynote-${seed}-${style}-${t.bars}b.wav`, style, kind, theme, bars: t.bars, drop: t.dropBar, cta: t.ctaBar, seed };
  }
  const seed = kind === "long" ? 0 : kind === "story" ? 10 + shortIndex : shortIndex + 1;
  // Chaque app a une playlist de styles : deux vidéos d'affilée ne sonnent jamais pareil.
  const pool = app.musicPool?.length ? app.musicPool : [app.music];
  const style = def?.style ?? pool[(kind === "long" ? 0 : seed + (kind === "story" ? 1 : 0)) % pool.length];
  const file = `audio/music/v3-${app.slug}-${kind}-${seed}-${style}-${t.bars}b.wav`;
  return { file, style, kind, theme, bars: t.bars, drop: t.dropBar, cta: t.ctaBar, seed };
}

/** Liste complète des vidéos d'une app. */
export function videosFor(app, langs = ["fr", "en"]) {
  const out = [];
  for (const lang of langs) {
    app.shorts.forEach((_, i) => {
      out.push({ id: videoId(app.slug, "short", lang, i), slug: app.slug, kind: "short", lang, shortIndex: i });
    });
    (app.stories ?? []).forEach((_, i) => {
      out.push({ id: videoId(app.slug, "story", lang, i), slug: app.slug, kind: "story", lang, shortIndex: i });
    });
    out.push({ id: videoId(app.slug, "long", lang), slug: app.slug, kind: "long", lang, shortIndex: 0 });
    (app.keynote?.videos ?? []).forEach((k, i) => {
      out.push({ id: videoId(app.slug, "keynote", lang, i), slug: app.slug, kind: "keynote", format: k.format, lang, shortIndex: i });
    });
  }
  return out;
}
