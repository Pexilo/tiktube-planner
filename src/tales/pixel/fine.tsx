import { Canvas, PAL } from "./engine";
import { FINE_BITMAPS } from "./fine-bitmaps";

/*
 * Icônes fines (« px-… ») : les bitmaps 24 × 24 de pixelarticons (MIT), dessinés au pas du pixel de texte (6 px, comme la
 * police), donc 12 cellules de côté : deux fois plus de détail que les icônes dessinées à la main, même taille à l'écran.
 * Les traits de 2 pixels fins font 1 cellule, comme le reste du kit. La couleur et le volume sont ajoutés ici :
 * - icône « pleine » (formes fermées) : traits foncés, intérieur à la couleur, reflet en haut à gauche, ombre en bas à droite ;
 * - icône « au trait » (peu d'intérieur) : traits à la couleur, bas des traits ombré.
 * Puis un contour encre de 2 pixels fins (= 1 cellule), comme toutes les icônes.
 */

type Tint = { fill: string; dark?: string };
const TINTS: Record<string, Tint> = {
  btc: { fill: PAL.btc },
  gold: { fill: "#E8C547" },
  lime: { fill: PAL.lime },
  pink: { fill: PAL.pink },
  cyan: { fill: PAL.cyan },
  paper: { fill: PAL.paper, dark: PAL.grey },
  grey: { fill: "#A8A294", dark: PAL.grey2 },
  wood: { fill: "#A0683F" },
  sand: { fill: "#C9A46A" },
  orange: { fill: PAL.orange },
  ink: { fill: PAL.ink3, dark: PAL.paper2 },
};

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) =>
  "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k).toString(16).padStart(2, "0")).join("");

export type FineName = `px-${keyof typeof FINE_BITMAPS}`;

function paint(rows: readonly string[], tint: Tint) {
  const on = (x: number, y: number) => rows[y]?.[x] === "#";
  // Extérieur = cases vides joignables depuis le bord ; le reste des cases vides est l'intérieur des formes.
  const outside = new Set<string>();
  const stack: [number, number][] = [];
  for (let i = -1; i <= 24; i++) stack.push([i, -1], [i, 24], [-1, i], [24, i]);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    const k = `${x},${y}`;
    if (x < -1 || y < -1 || x > 24 || y > 24 || outside.has(k) || on(x, y)) continue;
    outside.add(k);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let strokes = 0;
  let inside = 0;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) on(x, y) ? strokes++ : !outside.has(`${x},${y}`) && inside++;
  const solid = inside >= strokes * 0.5;
  const dark = tint.dark ?? mix(tint.fill, PAL.ink, 0.5);
  const light = mix(tint.fill, "#FFFFFF", 0.45);
  const shade = mix(tint.fill, PAL.ink, 0.22);
  const c = new Canvas();
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      if (on(x, y)) c.set(x, y, solid ? dark : on(x, y + 1) ? tint.fill : shade);
      else if (solid && !outside.has(`${x},${y}`))
        c.set(x, y, on(x, y - 1) || on(x - 1, y) ? light : on(x, y + 1) || on(x + 1, y) ? shade : tint.fill);
    }
  return c.outline().outline();
}

const cache = new Map<string, Canvas>();

/** Les icônes fines au format des icônes du kit : 12 × 12 cellules, dessinées en pixels de 6 px (`fine`). */
export const FINE_ICONS = Object.fromEntries(
  Object.entries(FINE_BITMAPS).map(([name, { color, rows }]) => [
    `px-${name}`,
    {
      w: 12,
      h: 12,
      fine: true,
      draw: (c: Canvas) => {
        if (!cache.has(name)) cache.set(name, paint(rows, TINTS[color]));
        for (const [k, v] of cache.get(name)!.cells) c.cells.set(k, v);
      },
    },
  ]),
) as unknown as Record<FineName, { w: number; h: number; fine: true; draw: (c: Canvas, t: number) => void }>;
