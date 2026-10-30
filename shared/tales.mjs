// Stories crypto ("tales") : contrat partagé entre Remotion (rendu), le serveur (pipeline) et les scripts.
// Une story = content/tales/<slug>.json (script, voix, timeline) + src/tales/stories/<slug>.tsx (visuels écrits par Claude).
// Module pur (sans fs) : il est aussi chargé dans le bundle Remotion.
import { FPS } from "./timeline.mjs";

/** App mise en avant (discrètement) dans les stories. */
export const TALE_APP = "wheredgainsgo";
/** Respiration après chaque phrase (s) et queue finale après l'outro (s), courte : la vidéo boucle sur le hook. */
export const TALE_PAD = 0.3;
export const TALE_TAIL = 0.3;
/** La voix démarre ce nombre de frames après le début de son beat. */
export const TALE_VOICE_DELAY = 4;

export const taleId = (slug, lang = "en") => `tale-${slug}-${lang}`;

/**
 * Langues des stories : l'anglais est la base (script, visuels, bruitages), les autres en sont des traductions
 * (`tale.locales[lang]` : texte des phrases, accroche, titre, voix, timeline, textes à l'écran) publiées à la même heure.
 */
export const TALE_LANGS = ["en", "fr"];
export const TALE_BASE_LANG = "en";

/** Langues dans lesquelles la story peut être rendue : la base, et chaque traduction qui a sa timeline (voix posée). */
export const taleLangs = (tale) => [TALE_BASE_LANG, ...TALE_LANGS.filter((l) => l !== TALE_BASE_LANG && tale.locales?.[l]?.timeline)];

/**
 * Story dans une langue : la base telle quelle, ou la traduction posée sur la base (mêmes beats, mêmes visuels, mêmes
 * bruitages). `i18n` sert au kit : textes à l'écran traduits, mots-repères anglais → mot de la phrase traduite, et
 * mots horodatés de la voix anglaise pour caler à la même place relative un repère qui n'a pas d'équivalent.
 * null si la traduction n'existe pas.
 */
export function localizedTale(tale, lang = TALE_BASE_LANG) {
  if (!lang || lang === TALE_BASE_LANG) return tale;
  const loc = tale.locales?.[lang];
  if (!loc) return null;
  const byId = new Map((loc.beats ?? []).map((b) => [b.id, b]));
  const anchors = {};
  for (const src of [loc.anchors, loc.ui?.anchors])
    for (const [id, m] of Object.entries(src ?? {})) anchors[id] = { ...anchors[id], ...m };
  return {
    ...tale,
    id: taleId(tale.slug, lang),
    lang,
    hook: loc.hook || tale.hook,
    summary: loc.summary || tale.summary,
    yt: { ...tale.yt, ...loc.yt },
    beats: tale.beats.map((b) => ({ ...b, text: byId.get(b.id)?.text || b.text })),
    voice: loc.voice,
    timeline: loc.timeline,
    i18n: { lang, text: loc.ui?.text ?? {}, anchors, base: tale.beats.map((b, i) => ({ text: b.text, words: tale.voice?.segments?.[i]?.words ?? null })) },
  };
}

/** Durées estimées (s) quand la voix n'existe pas encore : ~2,7 mots/s, minimum 1,6 s. */
export const estimateDur = (text) => Math.max(1.6, text.split(/\s+/).filter(Boolean).length / 2.7);

/**
 * Timeline en frames : un beat par phrase, calé sur la durée réelle de la voix (ou estimée).
 * @param {{ id: string, text: string }[]} beats
 * @param {{ dur: number }[] | null} segments voix (même ordre que beats)
 */
export function taleTimeline(beats, segments = null) {
  let from = 0;
  const out = beats.map((b, i) => {
    const sec = (segments?.[i]?.dur ?? estimateDur(b.text)) + TALE_PAD + (i === beats.length - 1 ? TALE_TAIL : 0);
    const dur = TALE_VOICE_DELAY + Math.ceil(sec * FPS);
    const r = { id: b.id, from, dur };
    from += dur;
    return r;
  });
  return { beats: out, totalFrames: from };
}

/**
 * Story telle qu'elle est rendue : sans passage pub (`product.off`), le beat produit sort de la vidéo (plan, voix, sous-titres)
 * et la timeline se recale sur les beats restants. Le script le garde : on peut remettre le passage pub sans rien régénérer.
 */
export function renderedTale(base, lang = TALE_BASE_LANG) {
  const tale = localizedTale(base, lang);
  if (!tale) return null;
  const i = tale.product?.off ? tale.beats.findIndex((b) => b.id === tale.product.beat) : -1;
  if (i < 0) return tale;
  const beats = tale.beats.filter((_, k) => k !== i);
  const voice = tale.voice ? { ...tale.voice, segments: tale.voice.segments.filter((_, k) => k !== i) } : tale.voice;
  const i18n = tale.i18n ? { ...tale.i18n, base: tale.i18n.base.filter((_, k) => k !== i) } : undefined;
  return { ...tale, beats, voice, timeline: taleTimeline(beats, voice?.segments), ...(i18n ? { i18n } : {}) };
}

/**
 * Titre de story publiable : sans emoji ni hashtag (#shorts compris, YouTube reconnaît les Shorts au format), espaces
 * resserrés. Appliqué à l'écriture du script et à la construction des titres YouTube, TikTok et Instagram.
 */
export const cleanTitle = (s) =>
  String(s ?? "")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?:;])/g, "$1")
    .replace(/[\s|·•–—-]+$/u, "")
    .trim();

/** Part du beat où l'image de la miniature est prise : les éléments du plan sont tous entrés. */
const THUMB_AT = 0.6;

/**
 * Frame de la vidéo qui sert de visuel à la miniature (et de couverture Instagram) : dans le beat `tale.thumb.beat`,
 * le hook par défaut (son premier plan est pensé pour accrocher sans le son).
 */
export function taleThumbFrame(tale, timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments)) {
  const i = Math.max(0, tale.beats.findIndex((b) => b.id === tale.thumb?.beat));
  const b = timeline.beats[i];
  return Math.min(timeline.totalFrames - 1, b.from + Math.round(b.dur * THUMB_AT));
}
