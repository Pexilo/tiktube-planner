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
