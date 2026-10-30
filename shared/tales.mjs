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
export function renderedTale(tale) {
  const i = tale.product?.off ? tale.beats.findIndex((b) => b.id === tale.product.beat) : -1;
  if (i < 0) return tale;
  const beats = tale.beats.filter((_, k) => k !== i);
  const voice = tale.voice ? { ...tale.voice, segments: tale.voice.segments.filter((_, k) => k !== i) } : tale.voice;
  return { ...tale, beats, voice, timeline: taleTimeline(beats, voice?.segments) };
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
