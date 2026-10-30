// Bruitages des stories crypto (pas de musique) : catalogue partagé entre le générateur (scripts/gen-tale-sfx.mjs),
// le serveur (vocabulaire du script) et Remotion (calage des sons). Module pur (sans fs) : il est chargé dans le bundle.
//
// Deux familles :
// - "anim" : petits sons liés à l'animation (une tuile qui tombe, un tampon, un compteur, une pièce qui vole), joués par
//   les composants du kit eux-mêmes. Synthétisés : bruitages physiques doux (carton, papier, bois, métal, verre), sans bip
//   ni arpège de jeu vidéo, très bas sous la voix.
// - "story" : sons narratifs choisis par le script selon ce qui est dit (suspense, révélation, tension), calés sur un mot.
//   Générés une fois par ElevenLabs (sound effects), réutilisés par toutes les stories.

/** Dossier (dans public/) des fichiers <nom>.wav. */
export const TALE_SFX_DIR = "audio/tale-sfx";

/**
 * Mode d'un son narratif, qui fixe son calage sur le mot :
 * - hit : démarre sur le mot (impact, stinger, objet) ;
 * - swell : se termine sur le mot (montée, souffle inversé : le mot « tombe » au sommet ; le fichier est coupé à son pic) ;
 * `influence` (facultatif) : fidélité d'ElevenLabs au prompt (0 à 1, 0,5 par défaut).
 * - bed : nappe qui démarre sur le mot et tient jusqu'à la fin de la phrase (bouclée, s'efface sous la voix).
 */
export const STORY_SFX = {
  boom: { mode: "hit", dur: 3, gain: 0.55, use: "big reveal or shocking number (deep sub impact)", prompt: "deep cinematic sub boom impact with a long dark reverb tail, documentary trailer hit, no music" },
  hit: { mode: "hit", dur: 2, gain: 0.45, use: "a sharp turn or a dark detail (tense stinger)", prompt: "short tense cinematic stinger hit, dark metallic impact, documentary, no music" },
  riser: { mode: "swell", dur: 3, gain: 0.2, influence: 0.6, use: "builds suspense INTO the word (the twist, the reveal)", prompt: "trailer tension build-up: rising string-like noise whoosh accelerating into a sudden stop at full intensity, reverse reverb suck-in, documentary, no music, no melody" },
  reverse: { mode: "swell", dur: 1.5, gain: 0.4, use: "a short suck-in right before a key word", prompt: "short reverse cymbal swell sucking in, cinematic transition, no music" },
  whoosh: { mode: "hit", dur: 1.5, gain: 0.4, use: "a jump in time or place", prompt: "deep cinematic whoosh pass-by, airy transition sound, no music" },
  glitch: { mode: "hit", dur: 1.2, gain: 0.4, use: "a hack, a bug, an exploit, data, a crash", prompt: "digital glitch error burst, data corruption stutter, short electronic glitch" },
  drone: { mode: "bed", dur: 8, gain: 0.3, loop: true, use: "mystery or dread under a whole sentence", prompt: "dark ominous low drone, mysterious tense atmosphere, no melody, no music" },
  heartbeat: { mode: "bed", dur: 5, gain: 0.4, loop: true, use: "fear, a risky moment, waiting for the outcome", prompt: "slow tense human heartbeat, low muffled thumps, close" },
  clock: { mode: "bed", dur: 4, gain: 0.3, loop: true, use: "a deadline, time running out, years passing", prompt: "clock ticking steadily, close mechanical tick, quiet room, tense" },
  static: { mode: "bed", dur: 4, gain: 0.22, loop: true, use: "something hidden, surveillance, a signal, the dark web", prompt: "low radio static and electrical hum, unsettling, quiet" },
  typing: { mode: "bed", dur: 4, gain: 0.3, loop: true, use: "someone coding, hacking, writing a message", prompt: "fast mechanical keyboard typing in a quiet dark room" },
  siren: { mode: "bed", dur: 5, gain: 0.22, loop: true, use: "police, an arrest, an investigation closing in", prompt: "distant police siren wailing in a city at night, far away" },
  cash: { mode: "hit", dur: 1.5, gain: 0.4, use: "money in: a payout, a fortune, a price", prompt: "cash register cha-ching with coins clinking" },
  fall: { mode: "hit", dur: 2.5, gain: 0.2, influence: 0.6, use: "money out: a crash, a loss, a failure", prompt: "dramatic failure sound effect: descending whoosh falling down in pitch with a low boom at the start, power-down, sad and heavy, short reverb tail fading to silence, no music, no melody" },
  shimmer: { mode: "hit", dur: 2, gain: 0.35, use: "a discovery, a hidden treasure, a lucky break", prompt: "magical airy shimmer reveal, soft sparkle swell, no music" },
  slam: { mode: "hit", dur: 2, gain: 0.45, use: "prison, a seizure, a door closing for good", prompt: "heavy metal prison door slam with echo" },
  gavel: { mode: "hit", dur: 1.5, gain: 0.45, use: "a court ruling, a judge, a verdict", prompt: "single wooden gavel strike in a courtroom with room reverb" },
  camera: { mode: "hit", dur: 1, gain: 0.4, use: "a photo, evidence, being caught, the press", prompt: "single camera shutter click with flash charge" },
};
export const STORY_SFX_NAMES = Object.keys(STORY_SFX);

/** Sons d'animation (synthétisés) : nom → durée (s). Joués par le kit, jamais par le script. */
export const ANIM_SFX = {
  "a-pop": 0.25,
  "a-thud": 0.35,
  "a-blip": 0.12,
  "a-stamp": 0.5,
  "a-count": 1.05,
  "a-coin": 0.3,
  "a-swish": 0.4,
  "a-type": 2,
  "a-rise": 1,
  "a-ping": 0.8,
  "a-twinkle": 0.45,
  "a-cut": 0.45,
  "a-tick": 0.08,
};
export const ANIM_SFX_NAMES = Object.keys(ANIM_SFX);

export const sfxFile = (name) => `${TALE_SFX_DIR}/${name}.wav`;

/** Au plus 2 sons narratifs par phrase. */
export const MAX_SFX_PER_BEAT = 2;
/** Volume réglable d'un son narratif (multiplie son gain de base) : de 10 % à 300 %, 1 = niveau par défaut (non écrit). */
export const SFX_VOL_MIN = 0.1;
export const SFX_VOL_MAX = 3;
/** Niveau maximal d'un son une fois son volume appliqué (fichiers crête à 0 dBFS) : ≈ -1,4 dBFS, jamais de saturation. */
export const SFX_MAX_GAIN = 0.85;

/**
 * Nettoie les sons narratifs d'un beat : noms connus, au plus MAX_SFX_PER_BEAT, `word` gardé seulement s'il est dans la phrase
 * (sinon le son part au début de la phrase), `vol` borné (gardé seulement s'il diffère de 1).
 * @param {unknown} list
 * @param {string} text
 */
export function cleanSfx(list, text) {
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const words = String(text ?? "").split(/\s+/).map(norm);
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ cue: String(x?.cue ?? ""), word: String(x?.word ?? "").trim(), vol: Number(x?.vol ?? 1) }))
    .filter((x) => STORY_SFX[x.cue])
    .slice(0, MAX_SFX_PER_BEAT)
    .map(({ cue, word, vol }) => {
      const v = Number.isFinite(vol) ? +Math.min(SFX_VOL_MAX, Math.max(SFX_VOL_MIN, vol)).toFixed(2) : 1;
      return { cue, ...(word && words.some((w) => w.includes(norm(word)) && norm(word)) ? { word } : {}), ...(v !== 1 ? { vol: v } : {}) };
    });
}
