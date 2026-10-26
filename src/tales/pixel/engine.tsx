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
  /** Ligne d’un pixel d’épaisseur (Bresenham) : nette, sans épaisseur variable. `step` > 1 = pointillés. */
  line(x0: number, y0: number, x1: number, y1: number, c: string, step = 1) {
    let [x, y] = [Math.round(x0), Math.round(y0)];
    const [tx, ty] = [Math.round(x1), Math.round(y1)];
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; ; n++) {
      if (n % step === 0) this.set(x, y, c);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
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
  /** Coupe : courte (défaut), longue, chauve. */
  hairStyle?: "short" | "long" | "bald";
  shirt: string;
  pants?: string;
  shoes?: string;
  /** Accessoire de rôle (un seul). */
  wear?: "hood" | "cap" | "tie" | "glasses" | "beanie" | "none";
  /** Petit objet tenu dans la main avant (à l'échelle du personnage). */
  hold?: "drive" | "laptop" | "phone" | "coin" | "bag" | "doc" | "none";
};

export type Pose = "idle" | "walk" | "cheer" | "point" | "shrug" | "sit";

const shade = (hex: string, k = 0.72) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/*
 * Personnage simple, dessiné à la main en gabarits de 12 × 20 pixels (≈ 1,70 m : 1 pixel ≈ 8,5 cm), de profil vers la droite.
 * Lettres : H cheveux · S peau · E œil · T haut · A bras (haut plus sombre) · P jambe avant · Q jambe arrière · B chaussures
 * · K capuche · D visage dans l'ombre · G yeux lumineux · C bonnet / casquette · I monture de lunettes · L verre.
 */
const HEAD: Record<"short" | "long" | "bald", string[]> = {
  short: ["....HHHH....", "...HHHHHH...", "..HHHSSSS...", "..HHSSSES...", "..HHSSSSS...", "...HSSSS....", ".....SS....."],
  long: ["....HHHH....", "...HHHHHH...", "..HHHSSSS...", "..HHSSSES...", "..HHSSSSS...", "..HHSSSS....", "..HH.SS....."],
  bald: ["....SSSS....", "...SSSSSS...", "..SSSSSSS...", "..SSSSSES...", "..SSSSSSS...", "...SSSSS....", ".....SS....."],
};
const HOOD = ["....KKKK....", "...KKKKKK...", "..KKKDDDDK..", "..KKKDDGD...", "..KKKDDDD...", "..KKKKKKK...", "...KKKKK...."];
const BODY = ["....TTTT....", "...TTTTTT...", "...TTTTTT...", "...TTTTTT...", "...TTTTTT...", "...PPPPPP..."];
const LEGS = {
  stand: ["...QQ..PP...", "...QQ..PP...", "...QQ..PP...", "...QQ..PP...", "...QQ..PP...", "...QQ..PP...", "...BBB.BBB.."],
  strideA: ["...QQPPP....", "..QQ...PP...", "..QQ...PP...", ".QQ.....PP..", ".QQ.....PP..", "QQ.......PP.", "BB.......BBB"],
  strideB: ["...PPQQQ....", "..PP...QQ...", "..PP...QQ...", ".PP.....QQ..", ".PP.....QQ..", "PP.......QQ.", "BB.......BBB"],
};
const SIT = ["...QQQQQQQ..", "...PPPPPPP..", ".........PP.", ".........PP.", ".........PP.", ".........PP.", ".........BBB"];

/** Pose du bras avant : cellules du bras (A) puis de la main (S). */
const ARMS: Record<string, { arm: [number, number][]; hand: [number, number] }> = {
  down: { arm: [[6, 8], [6, 9], [6, 10]], hand: [6, 11] },
  fwd: { arm: [[7, 8], [8, 9]], hand: [9, 10] },
  back: { arm: [[4, 8], [3, 9]], hand: [2, 10] },
  up: { arm: [[8, 8], [9, 7], [10, 6], [10, 5]], hand: [10, 4] },
  point: { arm: [[7, 8], [8, 8], [9, 8]], hand: [10, 8] },
  shrug: { arm: [[7, 8]], hand: [8, 7] },
};

/**
 * Sprite d'un personnage (12 × 20, pieds sur la ligne 19, contour encre ajouté).
 * Marche : cycle de 4 poses (foulée, passage, foulée inverse, passage), 4 frames vidéo chacune.
 */
export function personSprite(look: Look, pose: Pose, t: number): Canvas {
  const c = new Canvas();
  const col: Record<string, string> = {
    H: look.hair ?? PAL.hair1,
    S: look.skin ?? PAL.skin1,
    E: PAL.ink,
    T: look.shirt,
    A: shade(look.shirt, 0.78),
    P: look.pants ?? PAL.ink3,
    Q: shade(look.pants ?? PAL.ink3, 0.7),
    B: look.shoes ?? PAL.ink,
    K: look.wear === "hood" ? look.shirt : PAL.ink3,
    D: "#1A1922",
    G: PAL.lime,
    C: shade(look.shirt, 0.85),
    I: PAL.ink,
    L: PAL.cyan,
  };
  const paint = (rows: string[], y0: number) => rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== "." && c.set(i, y0 + j, col[ch])));
  const step = Math.floor(t / 4) % 4;
  const walking = pose === "walk";
  const sit = pose === "sit";
  const dy = sit ? 1 : 0; // assis : le buste descend d'une ligne
  // Tête
  paint(look.wear === "hood" ? HOOD : HEAD[look.hairStyle ?? "short"], dy);
  if (look.wear === "cap") paint(["...CCCC.....", "...CCCCCCC.."], dy);
  if (look.wear === "beanie") paint(["....CCCC....", "...CCCCCC...", "...CCCCCC..."], dy);
  if (look.wear === "glasses") paint(["......ILI..."], 3 + dy);
  // Corps
  paint(BODY, 7 + dy);
  if (look.wear === "tie") for (let y = 8; y < 12; y++) c.set(6, y + dy, PAL.pink);
  // Jambes
  if (sit) paint(SIT, 13);
  else paint(walking ? (step === 0 ? LEGS.strideA : step === 2 ? LEGS.strideB : LEGS.stand) : LEGS.stand, 13);
  // Bras avant
  const arms = walking ? (step === 0 ? ARMS.fwd : step === 2 ? ARMS.back : ARMS.down) : pose === "cheer" ? ARMS.up : pose === "point" ? ARMS.point : pose === "shrug" ? ARMS.shrug : ARMS.down;
  for (const [x, y] of arms.arm) c.set(x, y + dy, col.A);
  const [hx, hy] = [arms.hand[0], arms.hand[1] + dy];
  c.set(hx, hy, col.S);
  if (pose === "shrug") c.set(2, 7 + dy, col.S);
  // Objet tenu (petit, à l'échelle)
  if (look.hold === "drive") c.rect(hx, hy - 1, 3, 2, PAL.pink);
  if (look.hold === "laptop") c.rect(hx - 3, hy, 5, 1, PAL.grey);
  if (look.hold === "phone") c.rect(hx + 1, hy - 1, 1, 2, PAL.ink3);
  if (look.hold === "coin") c.rect(hx + 1, hy - 1, 2, 2, PAL.btc);
  if (look.hold === "bag") c.rect(hx, hy, 3, 3, "#C9A46A");
  if (look.hold === "doc") c.rect(hx + 1, hy - 2, 2, 3, PAL.paper);
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
 * `p` = taille d'un pixel du dessin (P par défaut ; P / 2 pour les icônes fines, dont les coordonnées sont en demi-cellules).
 */
export const Sprite: React.FC<{ canvas: Canvas; x: number; y: number; w: number; h: number; at?: number; anchor?: "bottom" | "center" | "topleft"; drop?: boolean; p?: number }> = ({
  canvas,
  x,
  y,
  w,
  h,
  at = 0,
  anchor = "bottom",
  drop = true,
  p = P,
}) => {
  const d = useDrop(at);
  if (d === null) return null;
  const left = anchor === "topleft" ? x : x - Math.floor(w / 2);
  const top = anchor === "topleft" ? y : anchor === "center" ? y - Math.floor(h / 2) : y - h;
  return (
    <div style={{ position: "absolute", left: Math.round(left) * P, top: (Math.round(top) + (drop ? d : 0)) * P }}>
      <PixelArt canvas={canvas} p={p} />
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
  judge: { shirt: PAL.ink, hair: PAL.paper2, hairStyle: "long", skin: PAL.skin1, pants: PAL.ink },
  worker: { shirt: PAL.orange, wear: "cap", pants: "#2A3F78", skin: PAL.skin3 },
  founder: { shirt: PAL.pink, hair: PAL.hair1, hairStyle: "long", skin: PAL.skin2 },
  whale: { shirt: PAL.paper, wear: "glasses", hairStyle: "bald", skin: PAL.skin1, pants: PAL.ink2 },
} satisfies Record<string, Look>;
export type LookName = keyof typeof LOOKS;

/**
 * Personnage pixel (12 × 20 cellules ≈ 1,70 m). `x` = colonne des pieds, `y` = ligne du sol (cellules). `look` = un rôle du casting ou une tenue.
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
  const canvas = personSprite(hold ? { ...base, hold } : base, moving ? "walk" : pose, t);
  if (dir === "left") canvas.flipX(12);
  return (
    <div style={{ position: "absolute", left: (col - 6) * P, top: (y - 20) * P }}>
      <PixelArt canvas={canvas} />
    </div>
  );
};

export { shade };
