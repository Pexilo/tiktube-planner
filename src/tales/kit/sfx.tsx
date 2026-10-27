import React, { createContext, useContext } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { sfxFile, type AnimSfxName } from "../../../shared/tale-sfx.mjs";

/*
 * Sons d'animation des stories crypto (shared/tale-sfx.mjs) : chaque composant du kit joue son petit son au moment où il
 * apparaît (tuile, tampon, compteur, pièce qui vole…), très bas sous la voix. Les sons narratifs (suspense, révélation)
 * viennent du script et sont joués par l'habillage (TaleVideo), pas ici.
 */

/** Niveau des sons d'animation : présents mais discrets, toujours sous la voix. */
export const ANIM_GAIN = 0.2;

/** true = aucun son d'animation dans ce sous-arbre (ex. le premier plan figé à la fin du plan qui boucle). */
export const SoundOff = createContext(false);

/**
 * Son d'animation joué à la frame `at` (relative au plan). `loopFor` = boucle le son pendant ce nombre de frames
 * (frappe au clavier pendant que le texte s'écrit). À poser hors de tout `return null` du composant : le son doit rester monté.
 */
export const Sound: React.FC<{ name: AnimSfxName; at?: number; volume?: number; loopFor?: number }> = ({ name, at = 0, volume = 1, loopFor }) =>
  useContext(SoundOff) ? null : (
    <Sequence from={Math.round(at)} durationInFrames={loopFor ? Math.max(1, Math.round(loopFor)) : undefined} layout="none" name={`son ${name}`}>
      <Audio src={staticFile(sfxFile(name))} volume={ANIM_GAIN * volume} loop={!!loopFor} />
    </Sequence>
  );

/** Son d'apparition seulement si l'élément arrive pendant le plan (à la frame 0, la coupe du plan a déjà son son). */
export const enterSound = (name: AnimSfxName, at: number, volume = 1) => (at > 1 ? <Sound name={name} at={at} volume={volume} /> : null);
