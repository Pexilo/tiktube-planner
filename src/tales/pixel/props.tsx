import React from "react";
import { random, useCurrentFrame } from "remotion";
import { loadFont as silkscreen } from "@remotion/google-fonts/Silkscreen";
import { loadFont as pixelify } from "@remotion/google-fonts/PixelifySans";
import { loadFont as vt323 } from "@remotion/google-fonts/VT323";
import { tokenize } from "../../components/text";
import { Canvas, COLS, GROUND, P, PAL, PixelArt, ROWS, shade, Sprite, useDrop } from "./engine";

/*
 * Bibliothèque pixel art des stories : décors plein écran, objets, textes et infos, tous sur la grille de 90 × 160
 * cellules (P = 12 px). Positions et tailles en cellules. Règles de style : src/tales/pixel/PIXEL.md.
 */

export const SILK = silkscreen("normal", { weights: ["400", "700"] }).fontFamily;
export const PIXELIFY = pixelify("normal", { weights: ["500", "700"] }).fontFamily;
export const VT = vt323("normal", { weights: ["400"] }).fontFamily;

const GREEN = "#3E7A3A";
const GREEN2 = "#4E9A48";
const WOOD = "#8A5A3A";
const WOOD2 = "#6E4A30";
const GOLD = "#E8C547";
const SAND = "#C9A46A";

/* ------------------------------------------------------------------ Décors (plein écran) */

const SKIES = {
  night: [PAL.ink, "#14121C", PAL.ink2, "#231F33", "#2E2742"],
  dusk: ["#2E2742", "#4A2C4F", "#7A3A5C", "#B8506A", "#E07A5F"],
  day: ["#3A7BC8", "#4F8FD6", "#6AA6E0", "#8CBDE8", "#B5D6F0"],
  void: [PAL.ink, PAL.ink, PAL.ink2, PAL.ink2, PAL.ink3],
  office: ["#2B2A35", "#2B2A35", "#33313F", "#33313F", "#3B3948"],
};
export type SkyKind = keyof typeof SKIES;

/** Ciel plein écran en bandes tramées (dithering) ; étoiles qui scintillent la nuit. */
export const Sky: React.FC<{ kind?: SkyKind; seed?: string }> = ({ kind = "night", seed = "sky" }) => {
  const frame = useCurrentFrame();
  const c = new Canvas();
  const bands = SKIES[kind];
  const bandH = Math.ceil(ROWS / bands.length);
  bands.forEach((col, i) => {
    c.rect(0, i * bandH, COLS, bandH, col);
    if (i > 0) for (let x = 0; x < COLS; x += 2) c.set(x + ((i * bandH) % 2), i * bandH, bands[i - 1]);
  });
  if (kind === "night" || kind === "dusk")
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(random(`${seed}x${i}`) * COLS);
      const y = Math.floor(random(`${seed}y${i}`) * ROWS * 0.45);
      if (Math.floor((frame + random(`${seed}t${i}`) * 60) / 30) % 4 !== 0) c.set(x, y, random(`${seed}c${i}`) > 0.8 ? PAL.cyan : PAL.paper2);
    }
  if (kind === "day")
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(random(`${seed}cx${i}`) * (COLS - 20)) + ((frame / 20) % 6);
      const y = 10 + Math.floor(random(`${seed}cy${i}`) * 40);
      c.rect(x, y, 14, 3, "#EAF3FA").rect(x + 3, y - 2, 8, 2, "#EAF3FA");
    }
  return <PixelArt canvas={c} />;
};

/** Silhouette de ville (fenêtres allumées la nuit) posée sur la ligne `ground`. */
export const City: React.FC<{ ground?: number; kind?: "night" | "day"; seed?: string }> = ({ ground = GROUND, kind = "night", seed = "city" }) => {
  const c = new Canvas();
  let x = 0;
  for (let i = 0; x < COLS; i++) {
    const w = 8 + Math.floor(random(`${seed}w${i}`) * 9);
    const h = 18 + Math.floor(random(`${seed}h${i}`) * 34);
    const col = kind === "night" ? (i % 2 ? "#1E1B29" : "#262236") : i % 2 ? "#7D8FA8" : "#8FA0B8";
    c.rect(x, ground - h, w, h, col);
    for (let wy = ground - h + 3; wy < ground - 4; wy += 4)
      for (let wx = x + 2; wx < x + w - 2; wx += 3)
        if (random(`${seed}${i}-${wx}-${wy}`) > (kind === "night" ? 0.62 : 0.4)) c.set(wx, wy, kind === "night" ? (random(`${seed}k${wx}${wy}`) > 0.85 ? PAL.pink : "#F2D27A") : "#C9DCEB");
    x += w + 1;
  }
  return <PixelArt canvas={c} />;
};

/** Trottoir et rue sous la ligne `ground`. */
export const Street: React.FC<{ ground?: number }> = ({ ground = GROUND }) => {
  const c = new Canvas();
  c.rect(0, ground, COLS, 5, PAL.paper2).rect(0, ground, COLS, 1, PAL.paper);
  c.rect(0, ground + 5, COLS, ROWS - ground - 5, PAL.ink3);
  for (let x = 2; x < COLS; x += 12) c.rect(x, ground + 12, 6, 1, PAL.paper2);
  return <PixelArt canvas={c} />;
};

/** Intérieur : mur (rayures tramées), plinthe, parquet, fenêtre optionnelle (nuit ou jour). */
export const Room: React.FC<{ ground?: number; wall?: string; window?: "night" | "day" | "none" }> = ({ ground = GROUND, wall = "#4A4458", window = "night" }) => {
  const c = new Canvas();
  c.rect(0, 0, COLS, ground, wall);
  for (let x = 0; x < COLS; x += 6) for (let y = 0; y < ground; y += 2) c.set(x, y, shade(wall, 0.88));
  if (window !== "none") {
    c.rect(54, 22, 26, 30, PAL.paper2).rect(56, 24, 22, 26, window === "night" ? "#1B2340" : "#8CBDE8").rect(66, 24, 2, 26, PAL.paper2).rect(56, 36, 22, 2, PAL.paper2);
    if (window === "night") c.set(60, 28, PAL.paper).set(72, 31, PAL.paper).set(63, 43, PAL.cyan);
  }
  c.rect(0, ground - 3, COLS, 3, shade(wall, 0.6));
  c.rect(0, ground, COLS, ROWS - ground, WOOD2);
  for (let y = ground + 3; y < ROWS; y += 4) c.rect(0, y, COLS, 1, shade(WOOD2, 0.8));
  return <PixelArt canvas={c} />;
};

/** Colline plein écran posée sur `ground` : décharge (déchets colorés), herbe ou sable. `height` en cellules. */
export const Hill: React.FC<{ ground?: number; kind?: "landfill" | "grass" | "sand"; height?: number; seed?: string }> = ({ ground = GROUND, kind = "landfill", height = 36, seed = "hill" }) => {
  const c = new Canvas();
  const [a, b] = kind === "landfill" ? ["#6E5B42", "#5A4A36"] : kind === "grass" ? ["#4E8A3A", "#3E6E2E"] : [SAND, "#B08A52"];
  const top = (x: number) => Math.round(height * Math.exp(-(((x - COLS / 2) / (COLS / 3)) ** 2)));
  for (let x = 0; x < COLS; x++) for (let j = 0; j < top(x); j++) c.set(x, ground - j, (x + j) % 2 === 0 && j > top(x) - 3 ? b : j % 7 === 0 && x % 3 === 0 ? b : a);
  c.rect(0, ground + 1, COLS, ROWS - ground - 1, shade(a, 0.7));
  if (kind === "landfill")
    for (let i = 0; i < 18; i++) {
      const x = 14 + Math.floor(random(`${seed}${i}`) * (COLS - 28));
      const y = ground - top(x) + 2 + Math.floor(random(`${seed}d${i}`) * 14);
      c.rect(x, y, 2 + (i % 3), 2, [PAL.cyan2, PAL.pink2, PAL.lime2, PAL.paper2, PAL.orange2][i % 5]);
    }
  return <PixelArt canvas={c} />;
};

/* ------------------------------------------------------------------ Objets */

type Drawer = { w: number; h: number; draw: (c: Canvas, t: number) => void };

const PROPS = {
  bin: { w: 14, h: 18, draw: (c) => { c.rect(1, 4, 12, 14, GREEN).rect(3, 6, 1, 10, "#2E5A2B").rect(7, 6, 1, 10, "#2E5A2B").rect(10, 6, 1, 10, "#2E5A2B").rect(0, 2, 14, 2, GREEN2).rect(6, 1, 2, 1, GREEN2); } },
  truck: { w: 42, h: 26, draw: (c, t) => { c.rect(10, 2, 30, 18, GREEN2).rect(10, 2, 30, 2, "#6CC062"); for (let i = 14; i < 38; i += 5) c.rect(i, 6, 1, 12, GREEN); c.rect(0, 8, 11, 12, PAL.lime).rect(2, 10, 6, 4, PAL.cyan).rect(0, 18, 3, 2, PAL.orange); for (const wx of [7, 32]) { c.circle(wx, 22, 3.4, PAL.ink3); c.set(wx + (Math.floor(t / 3) % 2), 22, PAL.paper2); } } },
  laptop: { w: 14, h: 10, draw: (c) => { c.rect(2, 0, 10, 7, PAL.ink3).rect(3, 1, 8, 5, PAL.cyan2).rect(4, 2, 4, 1, PAL.lime).rect(4, 4, 6, 1, PAL.paper2).rect(0, 7, 14, 2, PAL.grey); } },
  computer: { w: 22, h: 19, draw: (c) => { c.rect(0, 0, 22, 14, PAL.ink3).rect(1, 1, 20, 11, "#16324A"); for (let y = 3; y < 11; y += 2) c.rect(3, y, 6 + ((y * 7) % 9), 1, y === 3 ? PAL.lime : PAL.cyan); c.rect(9, 14, 4, 3, PAL.grey).rect(5, 17, 12, 2, PAL.grey); } },
  chair: { w: 10, h: 16, draw: (c) => { c.rect(0, 0, 2, 16, WOOD2).rect(0, 8, 10, 2, WOOD).rect(8, 10, 2, 6, WOOD2).rect(0, 2, 2, 5, WOOD); } },
  desk: { w: 32, h: 12, draw: (c) => { c.rect(0, 0, 32, 2, WOOD).rect(1, 2, 2, 10, WOOD2).rect(29, 2, 2, 10, WOOD2).rect(19, 2, 9, 5, WOOD2).rect(22, 4, 3, 1, GOLD); } },
  server: { w: 14, h: 26, draw: (c, t) => { c.rect(0, 0, 14, 26, PAL.ink3); for (let i = 0; i < 6; i++) c.rect(1, 1 + i * 4, 12, 3, PAL.ink2).set(11, 2 + i * 4, (i + Math.floor(t / 8)) % 3 === 0 ? PAL.pink : PAL.lime); } },
  phone: { w: 7, h: 12, draw: (c) => { c.rect(0, 0, 7, 12, PAL.ink3).rect(1, 1, 5, 9, PAL.cyan2).rect(2, 2, 3, 1, PAL.paper); } },
  drive: { w: 9, h: 6, draw: (c) => { c.rect(0, 0, 9, 6, PAL.pink).rect(1, 1, 4, 2, PAL.paper).set(7, 4, PAL.ink); } },
  coin: { w: 9, h: 9, draw: (c) => { c.circle(4.5, 4.5, 4.5, PAL.btc).circle(4.5, 4.5, 3.4, "#FFB547").glyph("B", 3, 2, PAL.ink); } },
  eth: { w: 9, h: 13, draw: (c) => { c.rows(0, [[4, 4], [3, 5], [3, 5], [2, 6], [2, 6], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5], [4, 4], [4, 4]], "#8C8FE6"); c.rows(0, [[4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [4, 7], [4, 8]], "#6266C9"); } },
  stable: { w: 9, h: 9, draw: (c) => { c.circle(4.5, 4.5, 4.5, "#26A17B").circle(4.5, 4.5, 3.4, "#3CC195").glyph("T", 3, 2, PAL.paper); } },
  doge: { w: 9, h: 9, draw: (c) => { c.circle(4.5, 4.5, 4.5, "#C2A633").circle(4.5, 4.5, 3.4, "#E0C55A").glyph("D", 3, 2, PAL.ink); } },
  wallet: { w: 14, h: 10, draw: (c) => { c.rect(0, 1, 14, 9, "#7A4A2A").rect(0, 1, 14, 1, "#9A5E36").rect(8, 3, 6, 4, "#5E381F").set(10, 5, PAL.lime); } },
  bank: { w: 34, h: 28, draw: (c) => { for (let i = 0; i < 6; i++) c.rect(14 - 3 * i, i, 6 + 6 * i, 1, PAL.paper2); c.rect(1, 6, 32, 2, PAL.paper); for (let k = 0; k < 5; k++) c.rect(3 + 6 * k, 8, 3, 16, PAL.paper2); c.rect(0, 24, 34, 4, PAL.paper).rect(15, 2, 4, 2, GOLD); } },
  house: { w: 26, h: 22, draw: (c) => { for (let i = 0; i < 9; i++) c.rect(12 - i * 1.4, i, 2 + i * 2.8, 1, PAL.pink2); c.rect(2, 9, 22, 13, PAL.paper2).rect(11, 14, 4, 8, "#7A4A2A").rect(4, 12, 5, 4, PAL.cyan).rect(17, 12, 5, 4, PAL.cyan); } },
  car: { w: 28, h: 13, draw: (c) => { c.rect(0, 5, 28, 5, PAL.cyan2).rect(6, 1, 15, 5, PAL.cyan2).rect(8, 2, 5, 3, PAL.paper2).rect(15, 2, 5, 3, PAL.paper2).rect(26, 6, 2, 2, PAL.lime); c.circle(6, 10.5, 2.6, PAL.ink3).circle(22, 10.5, 2.6, PAL.ink3); } },
  pizza: { w: 12, h: 12, draw: (c) => { c.rect(0, 0, 12, 2, "#C98E3A"); for (let y = 2; y < 12; y++) { const k = Math.floor((y - 2) / 2); c.rect(1 + k, y, Math.max(1, 10 - 2 * k), 1, "#F2C94C"); } c.circle(4, 4, 1.2, "#C0392B").circle(7.5, 4.5, 1.2, "#C0392B").circle(5.5, 7.5, 1.2, "#C0392B"); } },
  key: { w: 13, h: 6, draw: (c) => { c.circle(3, 3, 3, GOLD).del(3, 3).rect(6, 2, 7, 2, GOLD).rect(10, 4, 1, 1, GOLD).rect(12, 4, 1, 2, GOLD); } },
  lock: { w: 10, h: 12, draw: (c) => { c.rect(2, 0, 6, 1, PAL.grey).rect(2, 1, 1, 4, PAL.grey).rect(7, 1, 1, 4, PAL.grey).rect(0, 5, 10, 7, GOLD).set(5, 7, PAL.ink).set(5, 8, PAL.ink); } },
  chest: { w: 16, h: 12, draw: (c) => { c.rect(0, 4, 16, 8, WOOD).rect(0, 0, 16, 4, "#A06A40").rect(0, 4, 16, 1, GOLD).rect(7, 4, 2, 3, GOLD); } },
  bag: { w: 12, h: 14, draw: (c) => { c.rect(4, 0, 4, 2, "#B89A5A").circle(6, 8.5, 5.5, SAND).glyph("$", 5, 6, "#5E4A26"); } },
  doc: { w: 10, h: 13, draw: (c) => { c.rect(0, 0, 10, 13, PAL.paper); for (let y = 3; y < 12; y += 2) c.rect(2, y, y === 3 ? 4 : 6, 1, PAL.grey); c.rect(7, 0, 3, 3, PAL.paper2); } },
  gavel: { w: 16, h: 14, draw: (c) => { c.rect(3, 0, 9, 5, WOOD).rect(3, 2, 9, 1, GOLD); c.limb(9, 5, 14, 11, 2, WOOD2); c.rect(0, 12, 9, 2, WOOD2); } },
  drone: { w: 20, h: 8, draw: (c, t) => { c.rect(7, 3, 6, 3, PAL.ink3).rect(2, 2, 16, 1, PAL.grey).set(10, 6, PAL.pink); const r = Math.floor(t / 2) % 2 ? 5 : 3; c.rect(2.5 - r / 2, 0, r, 1, PAL.paper2).rect(17.5 - r / 2, 0, r, 1, PAL.paper2); } },
  robotdog: { w: 20, h: 14, draw: (c, t) => { const s = Math.floor(t / 4) % 2; c.rect(4, 4, 12, 5, PAL.paper2).rect(15, 1, 5, 4, PAL.paper2).set(18, 2, PAL.cyan); for (const [i, lx] of [5, 8, 12, 15].entries()) c.rect(lx, 9, 2, (i + s) % 2 ? 5 : 4, PAL.grey); } },
  rocket: { w: 10, h: 26, draw: (c, t) => { c.rows(0, [[4, 5], [3, 6], [3, 6], [2, 7]], PAL.paper); c.rect(2, 4, 6, 16, PAL.paper).circle(5, 9, 1.6, PAL.cyan).rect(0, 15, 2, 6, PAL.pink).rect(8, 15, 2, 6, PAL.pink).rect(3, 20, 4, 3 + (Math.floor(t / 3) % 2) * 2, PAL.orange); } },
  fire: { w: 10, h: 12, draw: (c, t) => { const k = Math.floor(t / 4) % 2; c.circle(5, 8, 4, PAL.orange).circle(5 - k, 5, 3, PAL.orange).circle(5, 8.5, 2.4, "#FFD25A").set(5 + k, 2, PAL.orange); } },
  skull: { w: 10, h: 10, draw: (c) => { c.circle(5, 4.5, 4.5, PAL.paper).rect(2, 7, 6, 3, PAL.paper).rect(2, 3, 2, 2, PAL.ink).rect(6, 3, 2, 2, PAL.ink).set(5, 6, PAL.ink).set(3, 9, PAL.ink).set(5, 9, PAL.ink); } },
  bomb: { w: 11, h: 11, draw: (c, t) => { c.circle(5, 6, 4.5, PAL.ink3).set(3, 4, PAL.grey).rect(5, 0, 1, 2, PAL.grey).set(6 + (Math.floor(t / 3) % 2), 0, PAL.orange); } },
  crown: { w: 14, h: 9, draw: (c) => { c.rect(0, 4, 14, 5, GOLD).rect(0, 1, 2, 3, GOLD).rect(6, 0, 2, 4, GOLD).rect(12, 1, 2, 3, GOLD).set(3, 6, PAL.pink).set(7, 6, PAL.cyan).set(10, 6, PAL.pink); } },
  chart: { w: 18, h: 14, draw: (c) => { c.rect(0, 0, 18, 14, PAL.paper).rect(1, 12, 16, 1, PAL.grey).rect(1, 1, 1, 12, PAL.grey); [[2, 10], [5, 8], [8, 9], [11, 5], [14, 3]].forEach(([x, y], i, a) => i && c.limb(a[i - 1][0], a[i - 1][1], x, y, 1.2, PAL.pink)); } },
  sign: { w: 18, h: 16, draw: (c) => { c.rect(0, 0, 18, 9, PAL.paper2).rect(1, 1, 16, 7, PAL.paper).rect(8, 9, 2, 7, WOOD2); } },
} satisfies Record<string, Drawer>;
export type PropName = keyof typeof PROPS;
export const PROP_NAMES = Object.keys(PROPS) as PropName[];

/** Taille d'un objet en cellules (sans le contour). */
export const propSize = (name: PropName) => ({ w: PROPS[name].w, h: PROPS[name].h });

const propCanvas = (name: PropName, t: number, flip: boolean) => {
  const d: Drawer = PROPS[name];
  const c = new Canvas();
  d.draw(c, t);
  if (flip) c.flipX(d.w);
  return c.outline();
};

/**
 * Objet de la bibliothèque, posé en (x, y) cellules : par défaut (x, y) = milieu du bas (posé sur le sol).
 * `anchor="center"` pour un objet en l'air. Apparaît à `at` avec une petite chute en paliers. `flip` = miroir.
 */
export const Prop: React.FC<{ name: PropName; x: number; y?: number; at?: number; anchor?: "bottom" | "center"; flip?: boolean; out?: number }> = ({
  name,
  x,
  y = GROUND,
  at = 0,
  anchor = "bottom",
  flip = false,
  out,
}) => {
  const frame = useCurrentFrame();
  if (out !== undefined && frame >= out) return null;
  const { w, h } = PROPS[name];
  return <Sprite canvas={propCanvas(name, frame - at, flip)} x={x} y={y} w={w} h={h} at={at} anchor={anchor} />;
};

/**
 * Déplace un objet de `from` à `to` (cellules, centre) entre `at` et `at + dur`, en paliers d'une cellule.
 * `arc` = hauteur de la parabole (cellules). Après l'arrivée, l'objet reste posé sauf si `vanish`.
 * `flip` = miroir (par défaut : retourné quand il va vers la gauche ; mettre false pour un sprite déjà tourné à gauche).
 */
export const Fly: React.FC<{ name: PropName; from: [number, number]; to: [number, number]; at: number; dur?: number; arc?: number; vanish?: boolean; flip?: boolean }> = ({
  name,
  from,
  to,
  at,
  dur = 20,
  arc = 0,
  vanish = false,
  flip,
}) => {
  const frame = useCurrentFrame();
  if (frame < at || (vanish && frame >= at + dur)) return null;
  const k = Math.min(1, (frame - at) / dur);
  const x = Math.round(from[0] + (to[0] - from[0]) * k);
  const y = Math.round(from[1] + (to[1] - from[1]) * k - arc * 4 * k * (1 - k));
  const { w, h } = PROPS[name];
  return <Sprite canvas={propCanvas(name, frame - at, flip ?? to[0] < from[0])} x={x} y={y} w={w} h={h} at={at} anchor="center" drop={false} />;
};

/* ------------------------------------------------------------------ Textes et infos */

const cell = (v: number) => Math.round(v) * P;

/** Titre (Silkscreen) en haut de l'écran : mots qui tombent un par un, *mot* = bloc rose. `y` en lignes. */
export const Title: React.FC<{ text: string; y?: number; at?: number; size?: number }> = ({ text, y = 18, at = 0, size = 76 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 4 * P, right: 4 * P, top: cell(y), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${P}px ${2 * P}px` }}>
      {tokenize(text).map((tk, i) => {
        const t0 = at + i * 4;
        const d = frame < t0 ? null : frame - t0 < 2 ? -2 : frame - t0 < 4 ? -1 : 0;
        return (
          <span
            key={i}
            style={{
              fontFamily: SILK,
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1,
              color: tk.hl ? PAL.ink : PAL.paper,
              background: tk.hl ? PAL.pink : "transparent",
              padding: tk.hl ? `${P}px ${P}px` : `${P}px 0`,
              boxShadow: tk.hl ? `${P / 2}px ${P / 2}px 0 ${PAL.ink}` : undefined,
              textShadow: tk.hl ? undefined : `${P / 2}px ${P / 2}px 0 ${PAL.ink}`,
              visibility: d === null ? "hidden" : "visible",
              transform: `translateY(${(d ?? 0) * P}px)`,
            }}
          >
            {tk.w}
            {tk.suffix}
          </span>
        );
      })}
    </div>
  );
};

/** Grand nombre (Silkscreen) qui défile par paliers jusqu'à `value`, centré en (x, y) cellules, étiquette dessous. */
export const Counter: React.FC<{ value: string; x?: number; y: number; at: number; size?: number; color?: string; label?: string }> = ({ value, x = COLS / 2, y, at, size = 96, color = PAL.lime, label }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const m = value.match(/^([^\d]*)(\d[\d,]*)(.*)$/);
  const k = Math.min(1, Math.floor(((frame - at) / 30) * 12) / 12);
  const shown = m ? `${m[1]}${Math.round(Number(m[2].replace(/,/g, "")) * k).toLocaleString("en-US")}${m[3]}` : value;
  return (
    <div style={{ position: "absolute", left: cell(x), top: cell(y), transform: "translate(-50%, -50%)", textAlign: "center" }}>
      <div style={{ fontFamily: SILK, fontWeight: 700, fontSize: size, color, textShadow: `${P / 2}px ${P / 2}px 0 ${PAL.ink}`, whiteSpace: "nowrap" }}>{shown}</div>
      {label ? <div style={{ fontFamily: PIXELIFY, fontWeight: 700, fontSize: 36, color: PAL.paper, marginTop: P, textTransform: "uppercase", textShadow: `${P / 4}px ${P / 4}px 0 ${PAL.ink}` }}>{label}</div> : null}
    </div>
  );
};

/** Étiquette (Pixelify) dans une boîte à bord encre, centrée en (x, y) cellules. */
export const Label: React.FC<{ x: number; y: number; at?: number; text: string; color?: string; textColor?: string; size?: number; out?: number }> = ({
  x,
  y,
  at = 0,
  text,
  color = PAL.paper,
  textColor = PAL.ink,
  size = 34,
  out,
}) => {
  const frame = useCurrentFrame();
  const d = useDrop(at);
  if (d === null || (out !== undefined && frame >= out)) return null;
  return (
    <div style={{ position: "absolute", left: cell(x), top: cell(y + d), transform: "translate(-50%, -50%)", fontFamily: PIXELIFY, fontWeight: 700, fontSize: size, lineHeight: 1.1, textTransform: "uppercase", color: textColor, background: color, padding: `${P / 2}px ${P}px`, boxShadow: `0 0 0 ${P / 4}px ${PAL.ink}, ${P / 2}px ${P / 2}px 0 ${P / 4}px ${PAL.ink}`, whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
};

/** Bulle de dialogue (Pixelify) : (x, y) = pointe de la bulle, en cellules (au-dessus d'une tête : y = sol − 36). */
export const Bubble: React.FC<{ x: number; y: number; at: number; text: string; out?: number; width?: number }> = ({ x, y, at, text, out, width = 30 }) => {
  const frame = useCurrentFrame();
  const d = useDrop(at);
  if (d === null || (out !== undefined && frame >= out)) return null;
  const tail = new Canvas().rows(0, [[0, 3], [0, 2], [0, 1], [0, 0]], PAL.paper);
  return (
    <div style={{ position: "absolute", left: cell(x), top: cell(y + d), transform: "translate(-20%, -100%)" }}>
      <div style={{ maxWidth: width * P, width: "max-content", background: PAL.paper, boxShadow: `0 0 0 ${P / 4}px ${PAL.ink}, ${P / 2}px ${P / 2}px 0 ${P / 4}px ${PAL.ink}`, padding: `${P}px ${P * 1.5}px`, fontFamily: PIXELIFY, fontWeight: 700, fontSize: 36, lineHeight: 1.15, color: PAL.ink, marginBottom: 4 * P }}>{text}</div>
      <div style={{ position: "absolute", left: 2 * P, bottom: 0 }}>
        <PixelArt canvas={tail} />
      </div>
    </div>
  );
};

/** Tampon (Silkscreen) à double bord, centré en (x, y) cellules : « DENIED », « HACKED », « NO BACKUP ». */
export const Stamp: React.FC<{ x?: number; y: number; at: number; text: string; color?: string; size?: number }> = ({ x = COLS / 2, y, at, text, color = PAL.pink, size = 72 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const hit = frame - at < 3;
  return (
    <div style={{ position: "absolute", left: cell(x), top: cell(y), transform: "translate(-50%, -50%)", fontFamily: SILK, fontWeight: 700, fontSize: hit ? size * 1.25 : size, color, padding: `${P / 2}px ${P * 1.5}px`, boxShadow: `inset 0 0 0 ${P / 2}px ${color}, 0 0 0 ${P / 2}px ${PAL.ink}`, background: "rgba(11,11,14,0.75)", whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
};

/**
 * Écran de terminal (VT323) : bord pixel, lignes tapées une à une (≈ 1 caractère par frame) à partir de `at`.
 * (x, y) = coin haut gauche, w × h en cellules. Idéal pour un post de forum, un message de transaction, un code.
 */
export const Screen: React.FC<{ x: number; y: number; w: number; h: number; at?: number; lines: string[]; color?: string; title?: string; speed?: number }> = ({
  x,
  y,
  w,
  h,
  at = 0,
  lines,
  color = PAL.lime,
  title,
  speed = 1.2,
}) => {
  const frame = useCurrentFrame();
  const d = useDrop(at);
  if (d === null) return null;
  let budget = Math.max(0, (frame - at - 4) * speed);
  const shown = lines.map((l) => {
    const s = l.slice(0, Math.max(0, Math.floor(budget)));
    budget -= l.length;
    return s;
  });
  return (
    <div style={{ position: "absolute", left: cell(x), top: cell(y + d), width: w * P, height: h * P, background: "#0E1A14", boxShadow: `0 0 0 ${P}px ${PAL.ink3}, 0 0 0 ${P + P / 4}px ${PAL.ink}, ${P}px ${P}px 0 ${P + P / 4}px ${PAL.ink}`, padding: P, boxSizing: "border-box", overflow: "hidden" }}>
      {title ? <div style={{ fontFamily: VT, fontSize: 34, color: PAL.ink, background: color, padding: `0 ${P / 2}px`, marginBottom: P / 2, display: "inline-block" }}>{title}</div> : null}
      {shown.map((l, i) => (
        <div key={i} style={{ fontFamily: VT, fontSize: 44, lineHeight: 1.05, color, whiteSpace: "pre-wrap" }}>
          {l}
          {i === shown.findIndex((s, j) => s.length < lines[j].length) && Math.floor(frame / 8) % 2 ? "█" : ""}
        </div>
      ))}
    </div>
  );
};

/** Courbe de prix pixel : `points` normalisés dans un cadre w × h cellules en (x, y) (coin haut gauche), tracée par paliers. */
export const Chart: React.FC<{ x: number; y: number; w: number; h: number; at: number; dur?: number; points: number[]; color?: string; labels?: { i: number; text: string }[] }> = ({
  x,
  y,
  w,
  h,
  at,
  dur = 30,
  points,
  color = PAL.pink,
  labels = [],
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pts = points.map((v, i) => [Math.round((i / Math.max(1, points.length - 1)) * (w - 3)) + 2, Math.round((h - 3) - ((v - min) / (max - min || 1)) * (h - 5)) + 1] as const);
  const reveal = Math.floor(Math.min(1, (frame - at) / dur) * (w - 2)) + 2;
  const c = new Canvas().rect(0, 0, w, h, PAL.ink2).rect(1, h - 2, w - 2, 1, PAL.grey).rect(1, 1, 1, h - 2, PAL.grey);
  for (let gy = 4; gy < h - 2; gy += 5) for (let gx = 3; gx < w - 1; gx += 2) c.set(gx, gy, PAL.ink3);
  pts.forEach(([px, py], i) => {
    if (i === 0) return;
    const [ax, ay] = pts[i - 1];
    if (ax > reveal) return;
    const bx = Math.min(px, reveal);
    const by = Math.round(ay + ((py - ay) * (bx - ax)) / Math.max(1, px - ax));
    c.limb(ax, ay, bx, by, 1.3, color);
  });
  return (
    <>
      <div style={{ position: "absolute", left: cell(x), top: cell(y) }}>
        <PixelArt canvas={c} />
      </div>
      {labels.map((l, k) => {
        const p = pts[Math.max(0, Math.min(pts.length - 1, l.i))];
        return p[0] <= reveal ? <Label key={k} x={x + p[0]} y={y + p[1] - 4} at={at} text={l.text} color={k % 2 ? PAL.lime : PAL.paper} size={28} /> : null;
      })}
    </>
  );
};

/** Jauge pixel (pleine ou tramée) qui se remplit par paliers jusqu'à `to` (0..1). (x, y) = coin haut gauche, en cellules. */
export const Bar: React.FC<{ x: number; y: number; w: number; at: number; to: number; color?: string; label?: string; dither?: boolean }> = ({ x, y, w, at, to, color = PAL.lime, label, dither = false }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const fill = Math.round(Math.min(1, Math.floor(((frame - at) / 24) * 8) / 8) * to * (w - 2));
  const c = new Canvas().rect(0, 0, w, 4, PAL.ink3);
  for (let i = 0; i < fill; i++) for (let j = 1; j < 3; j++) if (!dither || (i + j) % 2 === 0) c.set(1 + i, j, color);
  c.outline();
  return (
    <>
      {label ? <div style={{ position: "absolute", left: cell(x), top: cell(y) - 46, fontFamily: PIXELIFY, fontWeight: 700, fontSize: 32, color: PAL.paper, textTransform: "uppercase", textShadow: `${P / 4}px ${P / 4}px 0 ${PAL.ink}` }}>{label}</div> : null}
      <div style={{ position: "absolute", left: cell(x), top: cell(y) }}>
        <PixelArt canvas={c} />
      </div>
    </>
  );
};

/** Flèche en pointillés pixel de `from` à `to` (cellules), tracée par paliers, pointe au bout. */
export const Arrow: React.FC<{ from: [number, number]; to: [number, number]; at: number; dur?: number; color?: string }> = ({ from, to, at, dur = 10, color = PAL.paper }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = Math.min(1, (frame - at) / dur);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const c = new Canvas();
  const n = Math.floor(len * k);
  for (let s = 0; s <= n; s += 2) c.set(from[0] + ((to[0] - from[0]) * s) / len, from[1] + ((to[1] - from[1]) * s) / len, color);
  if (k >= 1) {
    const ux = (to[0] - from[0]) / len;
    const uy = (to[1] - from[1]) / len;
    for (let s = 1; s <= 3; s++) {
      c.set(to[0] - ux * s - uy * s, to[1] - uy * s + ux * s, color);
      c.set(to[0] - ux * s + uy * s, to[1] - uy * s - ux * s, color);
    }
    c.set(to[0], to[1], color);
  }
  return <PixelArt canvas={c} />;
};

/** Épingle de lieu pixel, pointe en (x, y) cellules, étiquette dessous. */
export const Pin: React.FC<{ x: number; y: number; at: number; label?: string; color?: string }> = ({ x, y, at, label, color = PAL.pink }) => {
  const c = new Canvas().circle(4, 4, 4, color).set(4, 4, PAL.paper).set(3, 4, PAL.paper).rows(8, [[2, 6], [3, 5], [4, 4]], color).outline();
  return (
    <>
      <Sprite canvas={c} x={x} y={y} w={9} h={11} at={at} />
      {label ? <Label x={x} y={y + 3} at={at + 2} text={label} size={28} /> : null}
    </>
  );
};
