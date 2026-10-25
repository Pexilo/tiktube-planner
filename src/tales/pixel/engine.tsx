import React from "react";
import { useCurrentFrame } from "remotion";

/*
 * Moteur pixel art des stories : tout est dessiné sur une même grille (P px par pixel), pour un rendu cohérent.
 * Les formes (cercles, rectangles, segments épais) sont rastérisées en cellules, puis un contour encre est ajouté
 * automatiquement autour de chaque silhouette. Les personnages sont des marionnettes : leurs membres sont des segments
 * dont les angles donnent les poses (marche, attente, bras levés…).
 */

/** Taille d'un pixel à l'écran (px). 1080 / 12 = 90 pixels de large : gros pixels, lisibles sur téléphone. */
export const P = 12;

export const PAL = {
  ink: "#0B0B0E",
  ink2: "#1B1A22",
  ink3: "#2B2A35",
  paper: "#EFEADF",
  paper2: "#D9D2C1",
  pink: "#FF2E88",
  pink2: "#B81E60",
  lime: "#C6F24E",
  lime2: "#8DB22A",
  cyan: "#5CE1FF",
  cyan2: "#2A9CC0",
  orange: "#FF9D2E",
  orange2: "#C46A10",
  btc: "#F7931A",
  skin1: "#F2C29B",
  skin2: "#C98E62",
  skin3: "#8A5A3A",
  hair1: "#2B2118",
  hair2: "#6B4426",
  hair3: "#D9B26B",
  grey: "#6B675D",
  grey2: "#45423B",
};

type Cells = Map<string, string>;

const GLYPHS: Record<string, string[]> = {
  B: ["##.", "#.#", "##.", "#.#", "##."],
  $: [".##", "##.", ".#.", ".##", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  E: ["###", "#..", "##.", "#..", "###"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  "?": ["##.", "..#", ".#.", "...", ".#."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "##."],
};
const key = (x: number, y: number) => `${x},${y}`;

/** Grille de cellules colorées ; les formes sont peintes dans l'ordre (la dernière gagne). */
export class Canvas {
  cells: Cells = new Map();
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = Math.round(y); j < Math.round(y + h); j++) for (let i = Math.round(x); i < Math.round(x + w); i++) this.cells.set(key(i, j), c);
    return this;
  }
  circle(cx: number, cy: number, r: number, c: string, filter?: (x: number, y: number) => boolean) {
    for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++)
      for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
        const dx = i + 0.5 - cx;
        const dy = j + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r && (!filter || filter(i, j))) this.cells.set(key(i, j), c);
      }
    return this;
  }
  /** Segment épais (membre) de (x1, y1) à (x2, y2). */
  limb(x1: number, y1: number, x2: number, y2: number, w: number, c: string) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (let j = Math.floor(Math.min(y1, y2) - w); j <= Math.ceil(Math.max(y1, y2) + w); j++)
      for (let i = Math.floor(Math.min(x1, x2) - w); i <= Math.ceil(Math.max(x1, x2) + w); i++) {
        const px = i + 0.5;
        const py = j + 0.5;
        const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (len * len)));
        if (Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1))) <= w / 2) this.cells.set(key(i, j), c);
      }
    return this;
  }
  set(x: number, y: number, c: string) {
    this.cells.set(key(Math.round(x), Math.round(y)), c);
    return this;
  }
  /** Efface une cellule (trou dans une forme). */
  del(x: number, y: number) {
    this.cells.delete(key(Math.round(x), Math.round(y)));
    return this;
  }
  /** Rangées d'une forme : pour chaque ligne y, une plage [x0, x1] (triangles, losanges…). */
  rows(y0: number, spans: [number, number][], c: string) {
    spans.forEach(([x0, x1], i) => this.rect(x0, y0 + i, x1 - x0 + 1, 1, c));
    return this;
  }
  /** Glyphe 3 × 5 (B, $, T, E, D, ?, !, 0-9) en (x, y). */
  glyph(ch: string, x: number, y: number, c: string) {
    const g = GLYPHS[ch];
    if (g) g.forEach((row, j) => [...row].forEach((v, i) => v === "#" && this.set(x + i, y + j, c)));
    return this;
  }
  /** Contour encre autour de toutes les cellules peintes (4-voisinage). */
  outline(c = PAL.ink) {
    const add: [number, number][] = [];
    for (const k of this.cells.keys()) {
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.cells.has(key(x + dx, y + dy))) add.push([x + dx, y + dy]);
    }
    for (const [x, y] of add) this.cells.set(key(x, y), c);
    return this;
  }
  flipX(w: number) {
    const next: Cells = new Map();
    for (const [k, c] of this.cells) {
      const [x, y] = k.split(",").map(Number);
      next.set(key(w - 1 - x, y), c);
    }
    this.cells = next;
    return this;
  }
}

/** Dessine une grille en SVG (rectangles fusionnés par lignes, rendu net). `p` = taille d'un pixel. */
export const PixelArt: React.FC<{ canvas: Canvas; p?: number; style?: React.CSSProperties }> = ({ canvas, p = P, style }) => {
  const rows = new Map<number, [number, string][]>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [k, c] of canvas.cells) {
    const [x, y] = k.split(",").map(Number);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push([x, c]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const rects: React.ReactNode[] = [];
  for (const [y, list] of rows) {
    list.sort((a, b) => a[0] - b[0]);
    let start = list[0][0];
    let color = list[0][1];
    let prev = start;
    const flush = (end: number) => rects.push(<rect key={`${y}-${start}`} x={start * p} y={y * p} width={(end - start + 1) * p} height={p} fill={color} />);
    for (const [x, c] of list.slice(1)) {
      if (x === prev + 1 && c === color) {
        prev = x;
        continue;
      }
      flush(prev);
      start = x;
      prev = x;
      color = c;
    }
    flush(prev);
  }
  if (!rects.length) return null;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", ...style }} width={1} height={1} shapeRendering="crispEdges">
      {rects}
    </svg>
  );
};

/* ------------------------------------------------------------------ Personnages */

export type Look = {
  skin?: string;
  hair?: string;
  shirt: string;
  pants?: string;
  shoes?: string;
  /** Accessoire de rôle. */
  wear?: "hood" | "cap" | "tie" | "glasses" | "beanie" | "none";
  /** Objet tenu à la main avant. */
  hold?: "drive" | "laptop" | "phone" | "coin" | "bag" | "none";
};

export type Pose = "idle" | "walk" | "cheer" | "point" | "shrug" | "sit";

const shade = (hex: string, k = 0.72) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Personnage de profil (regard vers la droite), 18 × 34 pixels environ, pieds en (9, 33).
 * `t` = phase de l'animation (frames), `pose` = attitude.
 */
export function personCanvas(look: Look, pose: Pose, t: number): Canvas {
  const c = new Canvas();
  const skin = look.skin ?? PAL.skin1;
  const hair = look.hair ?? PAL.hair1;
  const pants = look.pants ?? PAL.ink3;
  const shoes = look.shoes ?? PAL.ink;
  const ph = (t / 16) * Math.PI * 2; // un pas toutes les 8 frames
  const walking = pose === "walk";
  const swing = walking ? Math.sin(ph) : 0;
  const bob = walking ? Math.round(Math.abs(Math.cos(ph)) * 1) : pose === "idle" ? (Math.floor(t / 20) % 2) * 0 : 0;
  const hipY = 22 - bob;
  const hip = 9;
  const leg = (a: number, col: string) => {
    const kx = hip + Math.sin(a) * 5.2;
    const ky = hipY + Math.cos(a) * 5.2;
    const back = walking ? Math.max(0, -Math.sin(a)) * 1.6 : 0;
    const fx = kx + Math.sin(a * 0.4 - back * 0.3) * 5.2;
    const fy = Math.min(33, ky + 5.2);
    c.limb(hip, hipY, kx, ky, 3.2, col);
    c.limb(kx, ky, fx, fy, 3, col);
    c.rect(Math.round(fx) - 1, 32, 4, 2, shoes);
  };
  const shoulderY = 12 - bob;
  const arm = (a: number, col: string, hand: boolean) => {
    const ex = 9 + Math.sin(a) * 4.6;
    const ey = shoulderY + Math.cos(a) * 4.6;
    const hx = ex + Math.sin(a + (pose === "point" ? 0 : 0.35)) * 4.4;
    const hy = ey + Math.cos(a + (pose === "point" ? 0 : 0.35)) * 4.4;
    c.limb(9, shoulderY, ex, ey, 3, col);
    c.limb(ex, ey, hx, hy, 2.6, col);
    if (hand) c.circle(hx, hy, 1.4, skin);
    return [hx, hy] as const;
  };
  // Membres arrière (plus sombres) d'abord.
  const legA = walking ? swing * 0.55 : 0.04;
  const armA = walking ? -swing * 0.6 : 0.12;
  if (pose === "sit") {
    c.limb(hip, hipY, hip + 6, hipY, 3.4, shade(pants));
    c.limb(hip + 6, hipY, hip + 6, 32, 3, shade(pants));
    c.rect(hip + 5, 32, 4, 2, shoes);
  } else leg(-legA, shade(pants));
  if (pose === "cheer") arm(Math.PI - 1.1, shade(look.shirt), true);
  else if (pose !== "shrug") arm(-armA, shade(look.shirt), true);
  // Torse
  c.limb(9, shoulderY + 1, 9, hipY - 1, 6.4, look.shirt);
  c.rect(6, hipY - 2, 7, 3, pants);
  if (look.wear === "tie") {
    c.rect(10, shoulderY + 1, 1, 7, PAL.pink);
    c.set(10, shoulderY, PAL.paper);
  }
  // Jambe avant
  if (pose === "sit") {
    c.limb(hip, hipY + 1, hip + 7, hipY + 1, 3.4, pants);
    c.limb(hip + 7, hipY + 1, hip + 7, 32, 3, pants);
    c.rect(hip + 6, 32, 4, 2, shoes);
  } else leg(legA, pants);
  // Tête (profil vers la droite)
  const hy = 6 - bob;
  if (look.wear === "hood") {
    c.circle(9, hy, 5.2, PAL.ink3);
    c.circle(10.3, hy + 0.6, 3.1, PAL.ink);
    c.set(11, hy, PAL.lime);
    c.set(12, hy, PAL.lime);
  } else {
    c.circle(9.2, hy, 4.4, skin);
    c.set(12, hy + 1, skin); // nez
    c.circle(8.4, hy - 1.2, 4.2, hair, (x, y) => y <= hy - 1 || x <= 7);
    c.set(11, hy - 0.4, PAL.ink); // œil
    if (look.wear === "glasses") c.rect(10, hy - 1, 3, 2, PAL.ink).set(11, hy - 0.4, PAL.cyan);
    if (look.wear === "cap") c.rect(5, hy - 5, 8, 2, look.shirt).rect(11, hy - 3, 4, 1, look.shirt);
    if (look.wear === "beanie") c.circle(8.8, hy - 1.4, 4.6, look.shirt, (_x, y) => y <= hy - 3).rect(5, hy - 3, 9, 1, shade(look.shirt));
    c.limb(9, hy + 3.5, 9, shoulderY, 2.4, skin); // cou
  }
  // Bras avant + objet tenu
  let hand: readonly [number, number];
  if (pose === "cheer") hand = arm(Math.PI - 0.95, look.shirt, true);
  else if (pose === "point") hand = arm(Math.PI / 2 + 0.05, look.shirt, true);
  else if (pose === "shrug") hand = arm(Math.PI / 2 - 0.2, look.shirt, true);
  else hand = arm(armA, look.shirt, true);
  const [hx, hy2] = hand;
  if (look.hold === "drive") c.rect(hx - 1, hy2 - 2, 5, 4, PAL.pink).set(hx + 2, hy2, PAL.ink);
  if (look.hold === "laptop") c.rect(hx - 4, hy2 - 1, 8, 2, PAL.grey).set(hx + 2, hy2 - 1, PAL.lime);
  if (look.hold === "phone") c.rect(hx, hy2 - 3, 2, 3, PAL.ink3);
  if (look.hold === "coin") c.circle(hx + 1, hy2 - 2, 2, PAL.btc);
  if (look.hold === "bag") c.rect(hx - 2, hy2, 5, 5, PAL.ink3);
  return c.outline();
}

/* ------------------------------------------------------------------ Placement sur la grille */

/** Grille de l'image : 90 colonnes × 160 lignes (P = 12 px). */
export const COLS = 1080 / P;
export const ROWS = 1920 / P;
/** Ligne du sol par défaut (pieds des personnages, base des objets). */
export const GROUND = 105;

/**
 * Entrée « pixel » : l'élément tombe de 2 cellules puis 1 puis se pose (4 frames), sans interpolation lisse.
 * Renvoie le décalage vertical en cellules, ou null avant `at`.
 */
export function useDrop(at: number) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const t = frame - at;
  return t < 2 ? -2 : t < 4 ? -1 : 0;
}

/**
 * Place une grille dessinée : (x, y) en cellules. `anchor` "bottom" (défaut) = (x, y) est le milieu du bas
 * (posé sur le sol), "center" = le centre, "topleft" = le coin haut gauche. `w` / `h` = taille du dessin en cellules.
 */
export const Sprite: React.FC<{ canvas: Canvas; x: number; y: number; w: number; h: number; at?: number; anchor?: "bottom" | "center" | "topleft"; drop?: boolean }> = ({
  canvas,
  x,
  y,
  w,
  h,
  at = 0,
  anchor = "bottom",
  drop = true,
}) => {
  const d = useDrop(at);
  if (d === null) return null;
  const left = anchor === "topleft" ? x : x - Math.floor(w / 2);
  const top = anchor === "topleft" ? y : anchor === "center" ? y - Math.floor(h / 2) : y - h;
  return (
    <div style={{ position: "absolute", left: Math.round(left) * P, top: (Math.round(top) + (drop ? d : 0)) * P }}>
      <PixelArt canvas={canvas} />
    </div>
  );
};

/* ------------------------------------------------------------------ Casting */

/** Les rôles du casting (une seule silhouette, le rôle se lit à la tenue et à l'accessoire). */
export const LOOKS = {
  dev: { shirt: PAL.cyan, hair: PAL.hair2 },
  hacker: { shirt: PAL.ink3, wear: "hood", pants: PAL.ink2 },
  suit: { shirt: PAL.ink2, wear: "tie", hair: PAL.hair1, skin: PAL.skin2 },
  cop: { shirt: "#3B5BA9", wear: "cap", pants: "#2A3F78", skin: PAL.skin3 },
  trader: { shirt: PAL.lime, wear: "glasses", hair: PAL.hair3 },
  teen: { shirt: PAL.orange, wear: "beanie", skin: PAL.skin2 },
  judge: { shirt: PAL.ink, hair: PAL.paper2, skin: PAL.skin1, pants: PAL.ink },
  worker: { shirt: PAL.orange, wear: "cap", pants: "#2A3F78", skin: PAL.skin3 },
  founder: { shirt: PAL.pink, hair: PAL.hair1, skin: PAL.skin2 },
  whale: { shirt: PAL.paper, wear: "glasses", hair: PAL.hair3, pants: PAL.ink2 },
} satisfies Record<string, Look>;
export type LookName = keyof typeof LOOKS;

/**
 * Personnage pixel. `x` = colonne des pieds, `y` = ligne du sol (cellules). `look` = un rôle du casting ou une tenue.
 * Avec `to` (colonne) il marche de `x` à `to` en `dur` frames (cycle de marche), puis prend `pose`.
 * `hold` = objet tenu (drive, laptop, phone, coin, bag).
 */
export const Person: React.FC<{
  look: LookName | Look;
  x: number;
  y?: number;
  at?: number;
  to?: number;
  dur?: number;
  pose?: Pose;
  face?: "right" | "left";
  hold?: Look["hold"];
}> = ({ look, x, y = GROUND, at = 0, to, dur = 60, pose = "idle", face, hold }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const t = frame - at;
  const moving = to !== undefined && t < dur;
  const k = to === undefined ? 0 : Math.min(1, t / dur);
  const col = Math.round(to === undefined ? x : x + (to - x) * k);
  const dir = face ?? (to !== undefined && to < x ? "left" : "right");
  const base = typeof look === "string" ? LOOKS[look] : look;
  const canvas = personCanvas(hold ? { ...base, hold } : base, moving ? "walk" : pose, t);
  if (dir === "left") canvas.flipX(19);
  return (
    <div style={{ position: "absolute", left: (col - 9) * P, top: (y - 34) * P }}>
      <PixelArt canvas={canvas} />
    </div>
  );
};

export { shade };
