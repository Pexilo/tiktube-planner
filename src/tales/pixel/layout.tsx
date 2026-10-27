import { createContext, useContext, useId } from "react";
import { useCurrentFrame } from "remotion";

/*
 * Garde-fou de mise en page du texte : dans un plan (un <Beat>), chaque texte (titre, compteur, étiquette, bulle, tampon,
 * texte libre, écran) déclare sa boîte sur la grille, dans l'ordre du rendu. S'il chevauche un texte déjà posé, il est
 * décalé juste en dessous (ou au-dessus s'il entrerait dans la zone des sous-titres). Les zones de la plateforme sont aussi
 * protégées : jamais de texte au-dessus de la ligne TOP, ni sous la ligne BOTTOM.
 * Le registre est remis à zéro à chaque passe de rendu : le rendu reste déterministe.
 */

/** Haut de la zone utile (sous la barre de TikTok / Shorts) et haut de la zone des sous-titres, en lignes. */
export const SAFE_TOP = 14;
export const SAFE_BOTTOM = 118;
/** Marge minimale entre deux textes (cellules). */
const GAP = 1;

export type Box = { x0: number; y0: number; x1: number; y1: number };
type Registry = { frame: number; boxes: (Box & { id: string })[] };

export const LayoutCtx = createContext<Registry | null>(null);
/** Registre neuf pour un plan (à fournir par <Beat>). */
export const newRegistry = (): Registry => ({ frame: -1, boxes: [] });

const hits = (a: Box, b: Box) => a.x0 < b.x1 + GAP && b.x0 < a.x1 + GAP && a.y0 < b.y1 + GAP && b.y0 < a.y1 + GAP;
const shift = (b: Box, dy: number): Box => ({ ...b, y0: b.y0 + dy, y1: b.y1 + dy });

/**
 * Réserve la place d'un texte et renvoie le décalage vertical (cellules) à appliquer pour ne chevaucher aucun texte
 * déjà posé dans le plan. Sans plan (habillage, planches), renvoie 0.
 */
export function useTextSlot(box: Box | null): number {
  const reg = useContext(LayoutCtx);
  const frame = useCurrentFrame();
  const id = useId();
  if (!reg || !box) return 0;
  // Nouvelle passe : autre frame, ou ce texte est déjà posé (même frame rendue deux fois, ou premier plan figé par <Freeze>
  // dans le plan qui boucle : sa frame vaut toujours 0, et sans ça chaque texte se pousserait lui-même un peu plus bas à chaque image).
  if (reg.frame !== frame || reg.boxes.some((o) => o.id === id)) {
    reg.frame = frame;
    reg.boxes = [];
  }
  const h = box.y1 - box.y0;
  // Zones protégées d'abord.
  let dy = 0;
  if (box.y0 < SAFE_TOP) dy = SAFE_TOP - box.y0;
  if (box.y1 + dy > SAFE_BOTTOM) dy = SAFE_BOTTOM - box.y1;
  // Puis les textes déjà posés : on descend sous celui qu'on touche ; si on sort de la zone utile, on remonte au-dessus.
  for (let i = 0; i < 24; i++) {
    const b = shift(box, dy);
    const other = reg.boxes.find((o) => hits(b, o));
    if (!other) break;
    const below = other.y1 + GAP - box.y0;
    dy = box.y0 + below + h <= SAFE_BOTTOM ? below : other.y0 - GAP - h - box.y0;
    if (box.y0 + dy < SAFE_TOP) break; // plus de place : on garde la dernière position plutôt que de sortir de l'écran
  }
  reg.boxes.push({ ...shift(box, dy), id });
  return dy;
}
