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
 * Styles de musique des stories : uniquement des styles calmes (pas de drop ni de montée dans gen-all-audio.mjs).
 * La musique accompagne la voix en second plan ; les anciens styles « pub » sont ramenés au style calme le plus proche.
 */
export const TALE_MUSIC_STYLES = ["ambient", "piano", "lofi", "chill"];
const CALM_FOR = { cinematic: "ambient", synthwave: "ambient", darksynth: "ambient", trap: "lofi", dreamtrap: "lofi", phonk: "lofi", house: "chill" };

/** Musique (format de ensureMusic, scripts/gen-all-audio.mjs) : un fond discret sous la voix off, sans drop, qui ne fait que l'accompagner. */
export function taleMusic(tale, timeline) {
  const bars = Math.ceil(timeline.totalFrames / 60);
  const asked = tale.music?.style ?? "ambient";
  const style = TALE_MUSIC_STYLES.includes(asked) ? asked : CALM_FOR[asked] ?? "ambient";
  const seed = 50 + ([...tale.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 50);
  const outro = timeline.beats.at(-1);
  return {
    file: `audio/music/tale-${tale.slug}-${style}-${bars}b.wav`,
    style,
    kind: "story",
    theme: ["understated documentary underscore", "background bed under narration", "low and steady intensity", "no build-ups", ...(tale.music?.mood ?? []).slice(0, 2)],
    bars,
    drop: Math.max(1, Math.round(timeline.beats[0].dur / 60)),
    cta: Math.max(2, Math.floor(outro.from / 60)),
    seed,
  };
}
