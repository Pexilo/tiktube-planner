import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";
import { tokenize } from "../../components/text";
import { Canvas, COLS, GROUND, P, PAL, PixelArt, Sprite, useDrop } from "./engine";
import { useBg } from "./backdrop";
import { EXTRA_ICONS } from "./icons";
import { FINE_ICONS } from "./fine";
import { SAFE_TOP, useTextSlot } from "./layout";
import { enterSound, Sound } from "../kit/sfx";
import { drawText, LINE, measure, PixelText, textWidth, TP, wrap } from "./font";

/*
 * Bibliothèque pixel art des stories : objets, textes et infos (fonds : backdrop.tsx), tous sur la grille de 90 × 160
 * cellules (P = 12 px). Positions et tailles en cellules. Règles de style : src/tales/pixel/PIXEL.md.
 */


const GREEN = "#3E7A3A";
const GREEN2 = "#4E9A48";
const WOOD = "#8A5A3A";
const WOOD2 = "#6E4A30";
const GOLD = "#E8C547";
const SAND = "#C9A46A";

/* ------------------------------------------------------------------ Objets */

/*
 * Deux familles, une seule logique d'échelle :
 * - les OBJETS DU MONDE (Prop, Move) sont à l'échelle du personnage (20 pixels ≈ 1,70 m, donc 1 pixel ≈ 8,5 cm) :
 *   ils sont posés au sol (ou sur un bureau) ou roulent / volent dans la scène ;
 * - les ICÔNES (Icon, Fly) sont des symboles plus grands, lisibles seuls : une pièce, une clé, un wallet en l'air,
 *   en gros plan ou au-dessus d'une tête. Jamais posées au sol à côté d'un personnage comme si c'était un objet réel.
 */

type Drawer = { w: number; h: number; draw: (c: Canvas, t: number) => void; fine?: boolean };

const TRUCK_GREEN = "#6CC062";

/** Objets du monde, dessinés tournés vers la droite (véhicules, chien robot). Tailles réalistes. */
const WORLD = {
  bin: { w: 8, h: 12, draw: (c) => { c.rect(0, 2, 8, 10, GREEN).rect(2, 4, 1, 7, "#2E5A2B").rect(5, 4, 1, 7, "#2E5A2B").rect(0, 0, 8, 2, GREEN2); } },
  truck: { w: 56, h: 28, draw: (c, t) => { c.rect(0, 2, 42, 21, GREEN2).rect(0, 2, 42, 2, TRUCK_GREEN); for (let i = 5; i < 40; i += 6) c.rect(i, 6, 1, 15, GREEN); c.rect(41, 9, 15, 14, PAL.lime).rect(46, 11, 8, 5, PAL.cyan).rect(54, 20, 2, 2, PAL.orange); for (const wx of [10, 46]) { c.circle(wx, 24.5, 3.5, PAL.ink3); c.set(wx + (Math.floor(t / 3) % 2), 24, PAL.paper2); } } },
  car: { w: 40, h: 15, draw: (c, t) => { c.rect(0, 6, 40, 6, PAL.cyan2).rect(10, 1, 20, 6, PAL.cyan2).rect(12, 2, 7, 4, PAL.paper2).rect(21, 2, 7, 4, PAL.paper2).rect(38, 7, 2, 2, PAL.lime); for (const wx of [8, 31]) { c.circle(wx, 12, 3, PAL.ink3); c.set(wx + (Math.floor(t / 3) % 2), 12, PAL.paper2); } } },
  house: { w: 40, h: 44, draw: (c) => { for (let i = 0; i < 15; i++) c.rect(20 - Math.round(i * 1.4), i, 2 * Math.round(i * 1.4) + 1, 1, PAL.pink2); c.rect(28, 3, 4, 7, "#7A4A2A").rect(3, 14, 34, 30, PAL.paper2).rect(17, 32, 6, 12, "#7A4A2A"); for (const [x, y] of [[6, 18], [27, 18], [6, 30], [27, 30]]) c.rect(x, y, 7, 6, PAL.cyan).rect(x + 3, y, 1, 6, PAL.paper2); } },
  bank: { w: 60, h: 50, draw: (c) => { for (let i = 0; i < 10; i++) c.rect(30 - 3 * i, i, 6 * i + 1, 1, PAL.paper2); c.rect(27, 4, 7, 3, GOLD).rect(1, 10, 58, 3, PAL.paper); for (let k = 0; k < 6; k++) c.rect(5 + 9 * k, 13, 4, 30, PAL.paper2); c.rect(0, 43, 60, 3, PAL.paper).rect(0, 46, 60, 4, PAL.paper2); } },
  desk: { w: 18, h: 9, draw: (c) => { c.rect(0, 0, 18, 2, WOOD).rect(1, 2, 2, 7, WOOD2).rect(15, 2, 2, 7, WOOD2).rect(10, 2, 5, 3, WOOD2).set(12, 3, GOLD); } },
  chair: { w: 7, h: 11, draw: (c) => { c.rect(0, 0, 2, 6, WOOD).rect(0, 5, 7, 2, WOOD).rect(5, 7, 2, 4, WOOD2).rect(0, 7, 2, 4, WOOD2); } },
  computer: { w: 9, h: 9, draw: (c) => { c.rect(0, 0, 9, 6, PAL.ink3).rect(1, 1, 7, 4, "#16324A").rect(2, 2, 4, 1, PAL.lime).rect(2, 3, 3, 1, PAL.cyan).rect(4, 6, 1, 2, PAL.grey).rect(2, 8, 5, 1, PAL.grey); } },
  laptop: { w: 6, h: 4, draw: (c) => { c.rect(1, 0, 4, 3, PAL.ink3).rect(2, 1, 2, 1, PAL.cyan).rect(0, 3, 6, 1, PAL.grey); } },
  server: { w: 8, h: 24, draw: (c, t) => { c.rect(0, 0, 8, 24, PAL.ink3); for (let i = 0; i < 5; i++) c.rect(1, 1 + i * 4.6, 6, 3, PAL.ink2).set(6, 2 + i * 4.6, (i + Math.floor(t / 8)) % 3 === 0 ? PAL.pink : PAL.lime); } },
  lamp: { w: 6, h: 32, draw: (c) => { c.rect(2, 3, 2, 29, PAL.grey).rect(0, 0, 6, 3, PAL.ink3).rect(1, 3, 4, 1, "#F2D27A"); } },
  tree: { w: 16, h: 30, draw: (c) => { c.rect(7, 18, 3, 12, WOOD2).circle(8, 10, 8, "#4E8A3A").circle(5, 8, 4, "#5E9E48").circle(11, 12, 4, "#3E6E2E"); } },
  sign: { w: 10, h: 16, draw: (c) => { c.rect(0, 0, 10, 7, PAL.paper).rect(1, 1, 8, 1, PAL.paper2).rect(4, 7, 2, 9, WOOD2); } },
  drone: { w: 10, h: 4, draw: (c, t) => { c.rect(3, 1, 4, 2, PAL.ink3).rect(0, 1, 10, 1, PAL.grey).set(5, 3, PAL.pink); const r = Math.floor(t / 2) % 2 ? 3 : 1; c.rect(1 - r / 2 + 0.5, 0, r, 1, PAL.paper2).rect(8.5 - r / 2, 0, r, 1, PAL.paper2); } },
  robotdog: { w: 10, h: 8, draw: (c, t) => { const s = Math.floor(t / 4) % 2; c.rect(1, 2, 7, 3, PAL.paper2).rect(7, 0, 3, 3, PAL.paper2).set(9, 1, PAL.cyan); for (const [i, lx] of [1, 3, 5, 7].entries()) c.rect(lx, 5, 1, (i + s) % 2 ? 3 : 2, PAL.grey); } },
  rocket: { w: 12, h: 36, draw: (c, t) => { c.rows(0, [[5, 6], [4, 7], [4, 7], [3, 8], [3, 8]], PAL.paper); c.rect(3, 5, 6, 24, PAL.paper).circle(6, 12, 1.8, PAL.cyan).rect(0, 22, 3, 8, PAL.pink).rect(9, 22, 3, 8, PAL.pink).rect(4, 29, 4, 4 + (Math.floor(t / 3) % 2) * 3, PAL.orange); } },
  fire: { w: 8, h: 10, draw: (c, t) => { const k = Math.floor(t / 4) % 2; c.circle(4, 6.5, 3.5, PAL.orange).circle(4 - k, 4, 2.5, PAL.orange).circle(4, 7, 2, "#FFD25A").set(4 + k, 1, PAL.orange); } },
  chest: { w: 9, h: 7, draw: (c) => { c.rect(0, 2, 9, 5, WOOD).rect(0, 0, 9, 2, "#A06A40").rect(0, 2, 9, 1, GOLD).set(4, 3, GOLD); } },
  bag: { w: 5, h: 6, draw: (c) => { c.rect(2, 0, 1, 1, "#B89A5A").circle(2.5, 3.5, 2.6, SAND); } },
  drive: { w: 3, h: 2, draw: (c) => { c.rect(0, 0, 3, 2, PAL.pink); } },
  phone: { w: 2, h: 3, draw: (c) => { c.rect(0, 0, 2, 3, PAL.ink3).set(0, 1, PAL.cyan); } },
  coin: { w: 3, h: 3, draw: (c) => { c.rect(0, 0, 3, 3, PAL.btc).set(1, 1, "#FFB547"); } },
} satisfies Record<string, Drawer>;

/*
 * Pièces des cryptos : un même gabarit (disque de 13 pixels à la couleur officielle, reflet en haut à gauche, bord ombré en
 * bas à droite) et le logo en pixels blancs, un caractère = une couleur.
 */
const inCoin = (x: number, y: number) => (x + 0.5 - 6.5) ** 2 + (y + 0.5 - 6.5) ** 2 <= 6.5 ** 2;
const logoCoin = (fill: string, hi: string, rim: string, glyph: string[], ink: Record<string, string>, gx: number, gy: number): Drawer => ({
  w: 13,
  h: 13,
  draw: (c) => {
    for (let y = 0; y < 13; y++)
      for (let x = 0; x < 13; x++) if (inCoin(x, y)) c.set(x, y, !inCoin(x + 1, y) || !inCoin(x, y + 1) ? rim : !inCoin(x - 1, y) || !inCoin(x, y - 1) ? hi : fill);
    glyph.forEach((row, j) => [...row].forEach((v, i) => ink[v] && c.set(gx + i, gy + j, ink[v])));
  },
});
const WHITE = { "#": PAL.paper };
/** ₿ : barres en haut et en bas, fût et panses de 2 pixels. */
const BTC_GLYPH = ["..#.#..", "######.", ".##..##", ".##..##", ".#####.", ".##..##", ".##..##", "######.", "..#.#.."];
/** Octaèdre Ethereum : losange haut (facettes claires à gauche, plus sombres à droite et en bas), chevron bas séparé d'une ligne. */
const ETH_GLYPH = ["...W...", "..WWA..", "..WWA..", ".WWWAA.", "WWWWAAA", ".AAABB.", "..AAB..", "W.....A", ".WW.AA.", "..WWA..", "...W..."];
/** ₮ : barre du haut, fût, et l'anneau horizontal (un ton plus pâle) qui passe derrière le fût. */
const USDT_GLYPH = [".#######.", ".#######.", "...###...", ".rr###rr.", "r..###..r", ".rr###rr.", "...###...", "...###..."];
/** Ð : D à fût de 2 pixels, barre horizontale qui dépasse à gauche. */
const DOGE_GLYPH = ["#####..", ".##.##.", ".##..##", ".##..##", "####.##", ".##..##", ".##..##", ".##.##.", "#####.."];

/** Icônes (symboles lisibles seuls, ≈ 7 à 15 pixels) : les bases ici, l'iconographie étendue dans icons.tsx. */
const BASE_ICONS = {
  coin: logoCoin(PAL.btc, "#FFB547", PAL.orange2, BTC_GLYPH, WHITE, 3, 2),
  eth: logoCoin("#627EEA", "#8FA2F0", "#4357B5", ETH_GLYPH, { W: PAL.paper, A: "#C8D1FA", B: "#9AABF2" }, 3, 1),
  stable: logoCoin("#26A17B", "#4CC59C", "#1A7358", USDT_GLYPH, { "#": PAL.paper, r: "#B5E6D3" }, 2, 2),
  doge: logoCoin("#C2A633", "#E0C55A", "#8C7520", DOGE_GLYPH, WHITE, 3, 2),
  wallet: { w: 14, h: 10, draw: (c) => { c.rect(0, 1, 14, 9, "#7A4A2A").rect(0, 1, 14, 1, "#9A5E36").rect(8, 3, 6, 4, "#5E381F").set(10, 5, PAL.lime); } },
  key: { w: 13, h: 6, draw: (c) => { c.circle(3, 3, 3, GOLD).del(3, 3).rect(6, 2, 7, 2, GOLD).rect(10, 4, 1, 1, GOLD).rect(12, 4, 1, 2, GOLD); } },
  lock: { w: 10, h: 12, draw: (c) => { c.rect(2, 0, 6, 1, PAL.grey).rect(2, 1, 1, 4, PAL.grey).rect(7, 1, 1, 4, PAL.grey).rect(0, 5, 10, 7, GOLD).set(5, 7, PAL.ink).set(5, 8, PAL.ink); } },
  unlock: { w: 10, h: 12, draw: (c) => { c.rect(2, 0, 6, 1, PAL.grey).rect(2, 1, 1, 4, PAL.grey).rect(7, 0, 1, 2, PAL.grey).rect(0, 5, 10, 7, GOLD).set(5, 7, PAL.ink).set(5, 8, PAL.ink); } },
  drive: { w: 11, h: 7, draw: (c) => { c.rect(0, 0, 11, 7, PAL.pink).rect(1, 1, 5, 2, PAL.paper).rect(1, 5, 9, 1, PAL.pink2).set(9, 2, PAL.ink); } },
  phone: { w: 7, h: 12, draw: (c) => { c.rect(0, 0, 7, 12, PAL.ink3).rect(1, 1, 5, 9, PAL.cyan2).rect(2, 2, 3, 1, PAL.paper); } },
  laptop: { w: 14, h: 10, draw: (c) => { c.rect(2, 0, 10, 7, PAL.ink3).rect(3, 1, 8, 5, PAL.cyan2).rect(4, 2, 4, 1, PAL.lime).rect(4, 4, 6, 1, PAL.paper2).rect(0, 7, 14, 2, PAL.grey); } },
  doc: { w: 10, h: 13, draw: (c) => { c.rect(0, 0, 10, 13, PAL.paper); for (let y = 3; y < 12; y += 2) c.rect(2, y, y === 3 ? 4 : 6, 1, PAL.grey); c.rect(7, 0, 3, 3, PAL.paper2); } },
  bag: { w: 12, h: 14, draw: (c) => { c.rect(4, 0, 4, 2, "#B89A5A").circle(6, 8.5, 5.5, SAND).glyph("$", 5, 6, "#5E4A26"); } },
  chest: { w: 16, h: 12, draw: (c) => { c.rect(0, 4, 16, 8, WOOD).rect(0, 0, 16, 4, "#A06A40").rect(0, 4, 16, 1, GOLD).rect(7, 4, 2, 3, GOLD); } },
  gavel: { w: 16, h: 14, draw: (c) => { c.rect(3, 0, 9, 5, WOOD).rect(3, 2, 9, 1, GOLD); c.limb(9, 5, 14, 11, 2, WOOD2); c.rect(0, 12, 9, 2, WOOD2); } },
  pizza: { w: 12, h: 12, draw: (c) => { c.rect(0, 0, 12, 2, "#C98E3A"); for (let y = 2; y < 12; y++) { const k = Math.floor((y - 2) / 2); c.rect(1 + k, y, Math.max(1, 10 - 2 * k), 1, "#F2C94C"); } c.circle(4, 4, 1.2, "#C0392B").circle(7.5, 4.5, 1.2, "#C0392B").circle(5.5, 7.5, 1.2, "#C0392B"); } },
  chart: { w: 18, h: 14, draw: (c) => { c.rect(0, 0, 18, 14, PAL.paper).rect(1, 12, 16, 1, PAL.grey).rect(1, 1, 1, 12, PAL.grey); [[2, 10], [5, 8], [8, 9], [11, 5], [14, 3]].forEach(([x, y], i, a) => i && c.limb(a[i - 1][0], a[i - 1][1], x, y, 1.2, PAL.pink)); } },
  skull: { w: 10, h: 10, draw: (c) => { c.circle(5, 4.5, 4.5, PAL.paper).rect(2, 7, 6, 3, PAL.paper).rect(2, 3, 2, 2, PAL.ink).rect(6, 3, 2, 2, PAL.ink).set(5, 6, PAL.ink).set(3, 9, PAL.ink).set(5, 9, PAL.ink); } },
  bomb: { w: 11, h: 11, draw: (c, t) => { c.circle(5, 6, 4.5, PAL.ink3).set(3, 4, PAL.grey).rect(5, 0, 1, 2, PAL.grey).set(6 + (Math.floor(t / 3) % 2), 0, PAL.orange); } },
  crown: { w: 14, h: 9, draw: (c) => { c.rect(0, 4, 14, 5, GOLD).rect(0, 1, 2, 3, GOLD).rect(6, 0, 2, 4, GOLD).rect(12, 1, 2, 3, GOLD).set(3, 6, PAL.pink).set(7, 6, PAL.cyan).set(10, 6, PAL.pink); } },
  fire: { w: 10, h: 12, draw: (c, t) => { const k = Math.floor(t / 4) % 2; c.circle(5, 8, 4, PAL.orange).circle(5 - k, 5, 3, PAL.orange).circle(5, 8.5, 2.4, "#FFD25A").set(5 + k, 2, PAL.orange); } },
  warning: { w: 13, h: 12, draw: (c) => { for (let y = 0; y < 12; y++) { const h = Math.floor(y / 2); c.rect(6 - h, y, 2 * h + 1, 1, PAL.orange); } c.rect(6, 3, 1, 5, PAL.ink).set(6, 9, PAL.ink); } },
  check: { w: 11, h: 9, draw: (c) => ["........lll", ".......lll.", "......lll..", "l....lll...", "ll..lll....", "lllll......", ".lll.......", "..l........"].forEach((row, y) => [...row].forEach((ch, x) => ch === "l" && c.set(x, y, PAL.lime))) },
  cross: { w: 9, h: 9, draw: (c) => { for (let i = 0; i < 9; i++) c.rect(i, i, 2, 1, PAL.pink).rect(7 - i, i, 2, 1, PAL.pink); } },
} satisfies Record<string, Drawer>;

const ICONS = { ...BASE_ICONS, ...EXTRA_ICONS, ...FINE_ICONS };

export type PropName = keyof typeof WORLD;
export type IconName = keyof typeof ICONS;
export const PROP_NAMES = Object.keys(WORLD) as PropName[];
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Taille d'un objet du monde ou d'une icône, en cellules (sans le contour). */
export const propSize = (name: PropName) => ({ w: WORLD[name].w, h: WORLD[name].h });
export const iconSize = (name: IconName) => ({ w: ICONS[name].w, h: ICONS[name].h });

const render = (d: Drawer, t: number, flip: boolean) => {
  const c = new Canvas();
  d.draw(c, t);
  if (flip) c.flipX(d.w);
  // Les icônes fines arrivent déjà ombrées et contourées (fine.tsx).
  return d.fine ? c : c.outline();
};
/** Taille d'un pixel du dessin : les icônes fines sont au pas du pixel de texte. */
const pixelOf = (d: Drawer) => (d.fine ? P / 2 : P);

/**
 * Objet du monde, à l'échelle du personnage, posé en (x, y) cellules : (x, y) = milieu du bas (sur le sol par défaut,
 * ou `y={GROUND - 9}` sur un bureau). Apparaît à `at` (petite chute en paliers), disparaît à `out`. `flip` = tourné vers la gauche.
 */
export const Prop: React.FC<{ name: PropName; x: number; y?: number; at?: number; flip?: boolean; out?: number }> = ({ name, x, y = GROUND, at = 0, flip = false, out }) => {
  const frame = useCurrentFrame();
  const sound = enterSound("a-thud", at, 0.8);
  if (out !== undefined && frame >= out) return sound;
  const d: Drawer = WORLD[name];
  return (
    <>
      {sound}
      <Sprite canvas={render(d, frame - at, flip)} x={x} y={y} w={d.w} h={d.h} at={at} />
    </>
  );
};

/** Objet du monde qui se déplace de `from` à `to` ([x, y] = milieu du bas) : camion qui passe, drone qui vole, disque qui tombe. */
export const Move: React.FC<{ name: PropName; from: [number, number]; to: [number, number]; at: number; dur?: number; arc?: number; vanish?: boolean }> = ({
  name,
  from,
  to,
  at,
  dur = 30,
  arc = 0,
  vanish = false,
}) => {
  const frame = useCurrentFrame();
  const sound = <Sound name="a-swish" at={at} volume={0.7} />;
  if (frame < at || (vanish && frame >= at + dur)) return sound;
  const k = Math.min(1, (frame - at) / dur);
  const d: Drawer = WORLD[name];
  const x = Math.round(from[0] + (to[0] - from[0]) * k);
  const y = Math.round(from[1] + (to[1] - from[1]) * k - arc * 4 * k * (1 - k));
  return (
    <>
      {sound}
      <Sprite canvas={render(d, frame - at, to[0] < from[0])} x={x} y={y} w={d.w} h={d.h} at={at} drop={false} />
    </>
  );
};

/** Icônes de pièces : elles tintent en volant. */
const COINS: IconName[] = ["coin", "eth", "stable", "doge"];

/** Icône (symbole) centrée en (x, y) cellules : en l'air, en gros plan, au-dessus d'une tête. */
export const Icon: React.FC<{ name: IconName; x: number; y: number; at?: number; out?: number }> = ({ name, x, y, at = 0, out }) => {
  const frame = useCurrentFrame();
  const sound = enterSound("a-pop", at);
  if (out !== undefined && frame >= out) return sound;
  const d: Drawer = ICONS[name];
  return (
    <>
      {sound}
      <Sprite canvas={render(d, frame - at, false)} x={x} y={y} w={d.w} h={d.h} at={at} anchor="center" p={pixelOf(d)} />
    </>
  );
};

/**
 * Icône qui vole de `from` à `to` (centres, cellules) entre `at` et `at + dur`, en paliers d'une cellule.
 * `arc` = hauteur de la parabole. Après l'arrivée elle reste, sauf si `vanish`. Son : tintement pour une pièce, souffle sinon
 * (`sound={false}` = muet).
 */
export const Fly: React.FC<{ name: IconName; from: [number, number]; to: [number, number]; at: number; dur?: number; arc?: number; vanish?: boolean; sound?: boolean }> = ({
  name,
  from,
  to,
  at,
  dur = 20,
  arc = 0,
  vanish = false,
  sound: withSound = true,
}) => {
  const frame = useCurrentFrame();
  const sound = withSound ? COINS.includes(name) ? <Sound name="a-coin" at={at} volume={0.6} /> : <Sound name="a-swish" at={at} volume={0.5} /> : null;
  if (frame < at || (vanish && frame >= at + dur)) return sound;
  const k = Math.min(1, (frame - at) / dur);
  const d: Drawer = ICONS[name];
  const x = Math.round(from[0] + (to[0] - from[0]) * k);
  const y = Math.round(from[1] + (to[1] - from[1]) * k - arc * 4 * k * (1 - k));
  return (
    <>
      {sound}
      <Sprite canvas={render(d, frame - at, false)} x={x} y={y} w={d.w} h={d.h} at={at} anchor="center" drop={false} p={pixelOf(d)} />
    </>
  );
};

/* ------------------------------------------------------------------ Textes et infos */

/*
 * Toutes les infos utilisent la police bitmap (font.tsx) et sont dessinées comme UNE grille au pas du pixel de texte (6 px) :
 * fond, bordure de 1 pixel, ombre de 1 pixel et lettres tombent toutes sur la même grille. Aucune police système.
 */

/** Cadre de texte : fond, bordure encre 1 px, ombre 1 px, texte centré. Renvoie la grille et sa taille (pixels de texte). */
function textBox(text: string, { fill, ink = PAL.ink, color = PAL.ink, pad = 2, max = 70, k = 1 }: { fill: string; ink?: string; color?: string; pad?: number; max?: number; k?: number }) {
  const lines = wrap(text, Math.floor((max * P) / (TP * k)));
  const tw = Math.max(0, ...lines.map(textWidth)) * k;
  const th = (lines.length * LINE - 3) * k;
  const w = tw + pad * 2 + 2;
  const h = th + pad * 2 + 2;
  const c = new Canvas().rect(1, 1, w, h, ink).rect(0, 0, w, h, ink).rect(1, 1, w - 2, h - 2, fill);
  lines.forEach((l, i) => drawText(c, l, 1 + pad + Math.floor((tw - textWidth(l) * k) / 2), 1 + pad + i * LINE * k, color, k));
  return { c, w: w + 1, h: h + 1 };
}

/** Pixels de texte → cellules. */
const cells = (tp: number) => (tp * TP) / P;

/** Place une grille au pas du texte (6 px), centrée en (x, y) cellules ; `dy` = décalage vertical en cellules (chute). */
const TextGrid: React.FC<{ c: Canvas; w: number; h: number; x: number; y: number; dy?: number; anchor?: "center" | "bottom" }> = ({ c, w, h, x, y, dy = 0, anchor = "center" }) => (
  <div style={{ position: "absolute", left: Math.round((x * P - (w * TP) / 2) / TP) * TP, top: Math.round(((y + dy) * P - (anchor === "center" ? (h * TP) / 2 : h * TP)) / TP) * TP }}>
    <PixelArt canvas={c} p={TP} />
  </div>
);

/** Miniature : le titre à l'écran de la story est masqué (la miniature pose le sien à la même place). */
export const TitleOff = createContext(false);

type TitleWord = { s: string; hl: boolean; w: number; i: number };
const TITLE_K = 2;
const TITLE_SPACE = 4 * TITLE_K;
/** Hauteur d'une ligne de titre, en pixels de texte (6 px). */
const TITLE_LINE = LINE * TITLE_K + 4;
/** Mots du titre répartis en lignes de 84 cellules au plus. */
function titleLines(text: string) {
  const maxW = 84 * 2; // pixels de texte (6 px)
  const words: TitleWord[] = tokenize(text).map((t, i) => ({ s: `${t.w}${t.suffix ?? ""}`, hl: t.hl, w: textWidth(`${t.w}${t.suffix ?? ""}`) * TITLE_K + (t.hl ? 4 : 0), i }));
  const lines: TitleWord[][] = [[]];
  let lw = 0;
  for (const wd of words) {
    if (lines.at(-1)!.length && lw + TITLE_SPACE + wd.w > maxW) {
      lines.push([]);
      lw = 0;
    }
    lw += (lines.at(-1)!.length ? TITLE_SPACE : 0) + wd.w;
    lines.at(-1)!.push(wd);
  }
  return lines;
}
/** Hauteur d'un titre en cellules. */
export const titleHeight = (text: string) => cells(titleLines(text).length * TITLE_LINE);

/** Titre en haut de l'écran (lettres de 12 px) : mots qui tombent un par un, *mot* = bloc rose. `y` = ligne du haut. */
export const Title: React.FC<{ text: string; y?: number; at?: number }> = ({ text, y = SAFE_TOP, at = 0 }) => {
  const frame = useCurrentFrame();
  const { light } = useBg();
  const off = useContext(TitleOff);
  const k = TITLE_K;
  const space = TITLE_SPACE;
  const lines = titleLines(text);
  const lineH = TITLE_LINE;
  const widest = Math.max(0, ...lines.map((ln) => ln.reduce((a, wd, j) => a + wd.w + (j ? space : 0), 0)));
  // Masqué ou non, la place reste réservée : les autres textes du plan gardent la position qu'ils ont dans la vidéo.
  const dy = useTextSlot({ x0: COLS / 2 - cells(widest) / 2, y0: y, x1: COLS / 2 + cells(widest) / 2, y1: y + cells(lines.length * lineH) });
  if (off) return null;
  return (
    <>
      {lines.map((ln, li) => {
        const total = ln.reduce((a, wd, j) => a + wd.w + (j ? space : 0), 0);
        let cx = Math.floor((90 * 2 - total) / 2);
        return ln.map((wd, wi) => {
          const left = cx;
          cx += wd.w + space;
          const joined = wd.hl && ln[wi + 1]?.hl; // le bloc rose continue jusqu'au mot suivant
          const t0 = at + wd.i * 4;
          if (frame < t0) return null;
          const d = frame - t0 < 2 ? -4 : frame - t0 < 4 ? -2 : 0;
          const c = new Canvas();
          if (wd.hl) {
            const bw = wd.w + (joined ? space : 0);
            c.rect(1, 1, bw, 7 * k + 4, PAL.ink).rect(0, 0, bw, 7 * k + 4, PAL.pink);
            drawText(c, wd.s, 2, 2, PAL.ink, k);
          } else {
            if (!light) drawText(c, wd.s, 1, 3, PAL.ink, k);
            drawText(c, wd.s, 0, 2, light ? PAL.ink : PAL.paper, k);
          }
          return (
            <div key={`${li}-${wd.i}`} style={{ position: "absolute", left: left * TP, top: (y + dy) * P + (li * lineH + d) * TP }}>
              <PixelArt canvas={c} p={TP} />
            </div>
          );
        });
      })}
    </>
  );
};

/** Grand nombre (lettres de 12 px) qui défile par paliers jusqu'à `value`, centré en (x, y) cellules, étiquette dessous. */
export const Counter: React.FC<{ value: string; x?: number; y: number; at: number; color?: string; label?: string }> = ({ value, x = COLS / 2, y, at, color: colorProp, label }) => {
  const frame = useCurrentFrame();
  const { light } = useBg();
  const color = colorProp ?? (light ? PAL.ink : PAL.lime);
  const full = textWidth(value) * 2;
  const lab = label ? measure(label) : null;
  const half = Math.max(cells(full + 1), lab?.wCells ?? 0) / 2;
  const dy = useTextSlot(frame >= at ? { x0: x - half, y0: y - 4, x1: x + half, y1: y + (lab ? 5 + lab.hCells : 4) } : null);
  const sound = /\d/.test(value) ? <Sound name="a-count" at={at} volume={0.7} /> : <Sound name="a-pop" at={at} />;
  if (frame < at) return sound;
  const m = value.match(/^([^\d]*)(\d[\d,]*)(.*)$/);
  const k = Math.min(1, Math.floor(((frame - at) / 30) * 12) / 12);
  const shown = m ? `${m[1]}${Math.round(Number(m[2].replace(/,/g, "")) * k).toLocaleString("en-US")}${m[3]}` : value;
  const c = new Canvas();
  const ox = Math.floor((full - textWidth(shown) * 2) / 2);
  if (!light) drawText(c, shown, ox + 1, 1, PAL.ink, 2);
  drawText(c, shown, ox, 0, color, 2);
  return (
    <>
      {sound}
      <TextGrid c={c} w={full + 1} h={15} x={x} y={y + dy} />
      {label ? <PixelText text={label} x={x} y={y + dy + 5} slot={false} /> : null}
    </>
  );
};

/** Étiquette dans un cadre (date, lieu, nom, rôle), centrée en (x, y) cellules. */
export const Label: React.FC<{ x: number; y: number; at?: number; text: string; color?: string; textColor?: string; out?: number; slot?: boolean; max?: number; sound?: boolean }> = ({
  x,
  y,
  at = 0,
  text,
  color = PAL.paper,
  textColor = PAL.ink,
  out,
  slot = true,
  max = 70,
  sound: withSound = true,
}) => {
  const frame = useCurrentFrame();
  const d = useDrop(at);
  const visible = d !== null && !(out !== undefined && frame >= out);
  const { c, w, h } = textBox(text, { fill: color, color: textColor, max });
  const dy = useTextSlot(visible && slot ? { x0: x - cells(w) / 2, y0: y - cells(h) / 2, x1: x + cells(w) / 2, y1: y + cells(h) / 2 } : null);
  const sound = withSound ? enterSound("a-blip", at, 0.5) : null;
  if (!visible) return sound;
  return (
    <>
      {sound}
      <TextGrid c={c} w={w} h={h} x={x} y={y + dy} dy={d ?? 0} />
    </>
  );
};

/** Bulle de dialogue : (x, y) = pointe de la bulle, en cellules (au-dessus d'une tête : y = sol − 22). */
export const Bubble: React.FC<{ x: number; y: number; at: number; text: string; out?: number; width?: number }> = ({ x, y, at, text, out, width = 44 }) => {
  const frame = useCurrentFrame();
  const d = useDrop(at);
  const visible = d !== null && !(out !== undefined && frame >= out);
  const { c, w, h } = textBox(text, { fill: PAL.paper, max: width, pad: 3 });
  const dy = useTextSlot(visible ? { x0: x - 2, y0: y - cells(h + 4), x1: x - 2 + cells(w), y1: y } : null);
  const sound = enterSound("a-pop", at, 0.8);
  if (!visible) return sound;
  // Queue : 4 pixels qui descendent vers la pointe, à gauche de la bulle.
  c.rect(4, h - 1, 4, 1, PAL.paper).rect(4, h, 3, 1, PAL.paper).rect(4, h + 1, 2, 1, PAL.paper).rect(4, h + 2, 1, 1, PAL.paper);
  for (const [px, py] of [[3, h - 1], [3, h], [3, h + 1], [3, h + 2], [3, h + 3], [8, h - 1], [7, h], [6, h + 1], [5, h + 2], [4, h + 3]]) c.set(px, py, PAL.ink);
  return (
    <>
      {sound}
      <div style={{ position: "absolute", left: Math.round((x * P - 4 * TP) / TP) * TP, top: Math.round(((y + dy + (d ?? 0)) * P - (h + 4) * TP) / TP) * TP }}>
        <PixelArt canvas={c} p={TP} />
      </div>
    </>
  );
};

/** Tampon (lettres de 12 px, double cadre), centré en (x, y) cellules : « DENIED », « HACKED », « NO BACKUP ». */
export const Stamp: React.FC<{ x?: number; y: number; at: number; text: string; color?: string }> = ({ x = COLS / 2, y, at, text, color = PAL.pink }) => {
  const frame = useCurrentFrame();
  const tw = textWidth(text) * 2;
  const w = tw + 12;
  const h = 14 + 12;
  const dy = useTextSlot(frame >= at ? { x0: x - cells(w + 1) / 2, y0: y - cells(h + 1) / 2, x1: x + cells(w + 1) / 2, y1: y + cells(h + 1) / 2 } : null);
  const sound = <Sound name="a-stamp" at={at} />;
  if (frame < at) return sound;
  const hit = frame - at < 3; // impact : couleurs inversées pendant 3 frames (sur la grille, sans changer de taille)
  const c = new Canvas().rect(1, 1, w, h, PAL.ink).rect(0, 0, w, h, hit ? color : PAL.ink2);
  if (!hit) c.rect(0, 0, w, 1, color).rect(0, h - 1, w, 1, color).rect(0, 0, 1, h, color).rect(w - 1, 0, 1, h, color).rect(2, 2, w - 4, 1, color).rect(2, h - 3, w - 4, 1, color).rect(2, 2, 1, h - 4, color).rect(w - 3, 2, 1, h - 4, color);
  drawText(c, text, 6, 6, hit ? PAL.ink : color, 2);
  return (
    <>
      {sound}
      <TextGrid c={c} w={w + 1} h={h + 1} x={x} y={y + dy} />
    </>
  );
};

/**
 * Écran de terminal : bord pixel, lignes tapées une à une (≈ 1 caractère par frame) à partir de `at`.
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
  const dy = useTextSlot(d !== null ? { x0: x, y0: y, x1: x + w, y1: y + h } : null);
  const chars = lines.reduce((a, l) => a + l.length, 0);
  const sound = chars ? <Sound name="a-type" at={at + 4} loopFor={chars / speed} volume={0.6} /> : null;
  if (d === null) return sound;
  const bezel = new Canvas().rect(0, 0, w, h, PAL.ink3).rect(1, 1, w - 2, h - 2, "#0E1A14").outline();
  const typed = Math.max(0, Math.floor((frame - at - 4) * speed));
  const blink = Math.floor(frame / 8) % 2 === 0;
  let budget = typed;
  const shown = lines.map((l) => {
    const s = l.slice(0, Math.max(0, budget));
    budget -= l.length;
    return s;
  });
  const cursorLine = shown.findIndex((s, j) => s.length < lines[j].length);
  const top = y + dy + d;
  return (
    <>
      {sound}
      <div style={{ position: "absolute", left: x * P, top: top * P }}>
        <PixelArt canvas={bezel} />
      </div>
      {title ? <Label x={x + 2 + Math.ceil(measure(title).wCells / 2) + 1} y={top + 3} text={title} color={color} slot={false} /> : null}
      {shown.map((s, i) => (
        <PixelText key={i} text={`${s}${i === cursorLine && blink ? "█" : ""}`} x={x + 3} y={top + (title ? 7 : 3) + i * 6} color={color} align="left" shadow={false} max={w - 6} slot={false} />
      ))}
    </>
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
  const sound = <Sound name="a-rise" at={at} volume={0.6} />;
  if (frame < at) return sound;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pts = points.map((v, i) => [Math.round((i / Math.max(1, points.length - 1)) * (w - 4)) + 2, Math.round(h - 3 - ((v - min) / (max - min || 1)) * (h - 5))] as const);
  const reveal = Math.floor(Math.min(1, (frame - at) / dur) * (w - 2)) + 2;
  const c = new Canvas().rect(0, 0, w, h, PAL.ink2).line(1, h - 2, w - 2, h - 2, PAL.grey).line(1, 1, 1, h - 2, PAL.grey);
  for (let gy = 4; gy < h - 2; gy += 5) c.line(3, gy, w - 2, gy, PAL.ink3, 2);
  pts.forEach(([px, py], i) => {
    if (i === 0) return;
    const [ax, ay] = pts[i - 1];
    if (ax > reveal) return;
    const bx = Math.min(px, reveal);
    const by = Math.round(ay + ((py - ay) * (bx - ax)) / Math.max(1, px - ax));
    c.line(ax, ay, bx, by, color);
  });
  c.outline();
  return (
    <>
      {sound}
      <div style={{ position: "absolute", left: x * P, top: y * P }}>
        <PixelArt canvas={c} />
      </div>
      {labels.map((l, k) => {
        const p = pts[Math.max(0, Math.min(pts.length - 1, l.i))];
        return p[0] <= reveal ? <Label key={k} x={x + p[0]} y={y + p[1] - 4} at={at} text={l.text} color={k % 2 ? PAL.lime : PAL.paper} sound={false} /> : null;
      })}
    </>
  );
};

/** Jauge pixel (pleine ou tramée) qui se remplit par paliers jusqu'à `to` (0..1). (x, y) = coin haut gauche, en cellules. */
export const Bar: React.FC<{ x: number; y: number; w: number; at: number; to: number; color?: string; label?: string; dither?: boolean }> = ({ x, y, w, at, to, color = PAL.lime, label, dither = false }) => {
  const frame = useCurrentFrame();
  const sound = <Sound name="a-rise" at={at} volume={0.5} />;
  if (frame < at) return sound;
  const fill = Math.round(Math.min(1, Math.floor(((frame - at) / 24) * 8) / 8) * to * (w - 2));
  const c = new Canvas().rect(0, 0, w, 4, PAL.ink3);
  for (let i = 0; i < fill; i++) for (let j = 1; j < 3; j++) if (!dither || (i + j) % 2 === 0) c.set(1 + i, j, color);
  c.outline();
  return (
    <>
      {sound}
      {label ? <PixelText text={label} x={x} y={y - 3} align="left" /> : null}
      <div style={{ position: "absolute", left: x * P, top: y * P }}>
        <PixelArt canvas={c} />
      </div>
    </>
  );
};

const DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Flèche nette d'un pixel d'épaisseur de `from` à `to` (cellules), tracée par paliers, pointe à 45°. `dashed` = pointillés. */
export const Arrow: React.FC<{ from: [number, number]; to: [number, number]; at: number; dur?: number; color?: string; dashed?: boolean }> = ({ from, to, at, dur = 10, color = PAL.paper, dashed = false }) => {
  const frame = useCurrentFrame();
  const sound = enterSound("a-tick", at, 0.6);
  if (frame < at) return sound;
  const k = Math.min(1, Math.floor(((frame - at) / dur) * 8) / 8);
  const ex = Math.round(from[0] + (to[0] - from[0]) * k);
  const ey = Math.round(from[1] + (to[1] - from[1]) * k);
  const c = new Canvas().line(from[0], from[1], ex, ey, color, dashed ? 2 : 1);
  if (k >= 1) {
    const ang = Math.atan2(from[1] - to[1], from[0] - to[0]);
    const back = (Math.round((ang / (Math.PI * 2)) * 8) + 8) % 8;
    for (const side of [1, 7]) {
      const [dx, dy] = DIRS[(back + side) % 8];
      for (let s = 1; s <= 3; s++) c.set(to[0] + dx * s, to[1] + dy * s, color);
    }
  }
  c.outline();
  return (
    <>
      {sound}
      <PixelArt canvas={c} />
    </>
  );
};

/** Épingle de lieu, pointe en (x, y) cellules, étiquette au-dessus de la tête de l'épingle. */
const PIN = ["..#####..", ".#######.", "###...###", "###...###", ".#######.", "..#####..", "...###...", "....#...."];
export const Pin: React.FC<{ x: number; y: number; at: number; label?: string; color?: string }> = ({ x, y, at, label, color = PAL.pink }) => {
  const c = new Canvas();
  PIN.forEach((row, j) => [...row].forEach((v, i) => v === "#" && c.set(i, j, color)));
  for (const [i, j] of [[3, 2], [4, 2], [5, 2], [3, 3], [4, 3], [5, 3]]) c.set(i, j, PAL.paper);
  c.outline();
  return (
    <>
      {enterSound("a-pop", at, 0.8)}
      <Sprite canvas={c} x={x} y={y + 1} w={9} h={8} at={at} />
      {label ? <Label x={x} y={y - 13} at={at + 2} text={label} sound={false} /> : null}
    </>
  );
};


/* ------------------------------------------------------------------ Détails animés (richesse sans surcharge) */

/**
 * Onde : anneaux qui s'élargissent par paliers autour d'un point (x, y) cellules, toutes les `every` frames.
 * Pour attirer l'œil sur l'élément clé d'un plan (une alerte, un wallet piraté, une pièce).
 */
export const Pulse: React.FC<{ x: number; y: number; at?: number; color?: string; max?: number; every?: number }> = ({ x, y, at = 0, color, max = 12, every = 24 }) => {
  const frame = useCurrentFrame();
  const { light } = useBg();
  const sound = enterSound("a-ping", at, 0.45);
  if (frame < at) return sound;
  const col = color ?? (light ? PAL.ink : PAL.lime);
  const t = (frame - at) % every;
  const r = 3 + Math.floor(t / 2);
  if (r > max) return sound;
  const c = new Canvas();
  const size = max * 2 + 3;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot(i + 0.5 - size / 2, j + 0.5 - size / 2);
      // Anneau d'un pixel ; il se « dissout » en tramage quand il s'éloigne (1 pixel sur 2 au-delà des 2/3).
      if (d <= r && d > r - 1 && (r < (max * 2) / 3 || (i + j) % 2 === 0)) c.set(i, j, col);
    }
  return (
    <>
      {sound}
      <Sprite canvas={c} x={x} y={y} w={size} h={size} anchor="center" drop={false} />
    </>
  );
};

const SPARKLE = [
  ["...", ".#.", "..."],
  [".#.", "###", ".#."],
  ["..#..", "..#..", "#####", "..#..", "..#.."],
  [".#.", "###", ".#."],
];
/** Étincelle qui scintille (4 états, 4 frames chacun) en (x, y) cellules. Par petits groupes autour d'un objet précieux. */
export const Sparkle: React.FC<{ x: number; y: number; at?: number; color?: string; phase?: number }> = ({ x, y, at = 0, color, phase = 0 }) => {
  const frame = useCurrentFrame();
  const { light } = useBg();
  const sound = phase === 0 ? enterSound("a-twinkle", at, 0.35) : null;
  if (frame < at) return sound;
  const shape = SPARKLE[Math.floor((frame - at + phase * 4) / 4) % SPARKLE.length];
  const c = new Canvas();
  shape.forEach((row, j) => [...row].forEach((v, i) => v === "#" && c.set(i, j, color ?? (light ? PAL.ink : PAL.paper))));
  return (
    <>
      {sound}
      <Sprite canvas={c} x={x} y={y} w={shape[0].length} h={shape.length} anchor="center" drop={false} />
    </>
  );
};

/**
 * Pluie d'icônes : `count` icônes `name` tombent du haut jusqu'au sol (ou `to`), en décalé, entre les colonnes `from` et `toX`.
 * Pour « des millions qui partent », des documents, des alertes. Positions déterministes.
 */
export const Rain: React.FC<{ name: IconName; at: number; count?: number; from?: number; toX?: number; floor?: number; stagger?: number }> = ({
  name,
  at,
  count = 8,
  from = 8,
  toX = 82,
  floor = GROUND - 6,
  stagger = 5,
}) => (
  <>
    {Array.from({ length: count }).map((_, i) => {
      const x = Math.round(from + ((toX - from) * ((i * 37) % count)) / Math.max(1, count - 1));
      return <Fly key={i} name={name} from={[x, 6]} to={[x, floor]} at={at + i * stagger} dur={22} vanish sound={i < 4} />;
    })}
  </>
);

/**
 * Tuile : une icône sur un socle carré (bord 1 pixel, ombre 1 pixel), étiquette optionnelle dessous. (x, y) = centre, cellules.
 * Brique de base pour les plans sans personnage : grille d'icônes, comparaison, liste.
 */
export const Tile: React.FC<{ icon: IconName; x: number; y: number; at?: number; label?: string; color?: string; out?: number; labelMax?: number }> = ({
  icon,
  x,
  y,
  at = 0,
  label,
  color,
  out,
  labelMax = 40,
}) => {
  const frame = useCurrentFrame();
  const { light } = useBg();
  const d: Drawer = ICONS[icon];
  const s = Math.max(d.w, d.h) + 6;
  const visible = frame >= at && !(out !== undefined && frame >= out);
  const lab = label ? measure(label, 1, labelMax - 4) : null;
  const half = Math.max(s / 2 + 1, lab ? lab.wCells / 2 + 2 : 0);
  const dy = useTextSlot(visible ? { x0: x - half, y0: y - s / 2 - 1, x1: x + half, y1: y + s / 2 + 1 + (lab ? 3 + lab.hCells + 2 : 0) } : null);
  const pad = new Canvas().rect(1, 1, s, s, PAL.ink).rect(0, 0, s, s, color ?? (light ? PAL.paper : PAL.ink3));
  const sound = enterSound("a-pop", at);
  if (!visible) return sound;
  const cy = y + dy;
  return (
    <>
      {sound}
      <Sprite canvas={pad.outline()} x={x} y={cy} w={s + 1} h={s + 1} at={at} anchor="center" />
      <Sprite canvas={render(d, frame - at, false)} x={x} y={cy} w={d.w} h={d.h} at={at} anchor="center" p={pixelOf(d)} />
      {label ? <Label x={x} y={cy + Math.ceil(s / 2) + 3 + Math.ceil((lab?.hCells ?? 0) / 2)} at={at + 2} text={label} slot={false} max={labelMax - 4} sound={false} /> : null}
    </>
  );
};

const tileOf = (icon: IconName) => Math.max(ICONS[icon].w, ICONS[icon].h) + 6;

/**
 * Flux : une rangée de tuiles reliées par des flèches, chacune apparaissant à son `at` (calé sur un mot).
 * 2 à 4 étapes : d'où vient l'argent, où il va, les étapes d'un hack, avant / après. `y` = ligne des tuiles.
 * `arrows={false}` = simple rangée de tuiles (liste, comparaison). Le flux tient toujours dans la largeur de l'écran.
 */
export const Flow: React.FC<{ items: { icon: IconName; label?: string; at: number; color?: string }[]; y: number; gap?: number; arrows?: boolean }> = ({ items, y, gap = 5, arrows = true }) => {
  const natural = items.map((it) => Math.max(tileOf(it.icon) + 1, it.label ? Math.ceil(measure(it.label).wCells) + 3 : 0));
  const room = 84 - gap * (items.length - 1);
  const fits = natural.reduce((a, s) => a + s, 0) <= room;
  const sizes = fits ? natural : items.map(() => Math.floor(room / items.length));
  const total = sizes.reduce((a, s) => a + s, 0) + gap * (items.length - 1);
  let x = Math.round(COLS / 2 - total / 2);
  const centers = sizes.map((s) => {
    const cx = x + Math.floor(s / 2);
    x += s + gap;
    return cx;
  });
  return (
    <>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && arrows ? <Arrow from={[centers[i - 1] + Math.ceil(tileOf(items[i - 1].icon) / 2) + 2, y]} to={[centers[i] - Math.ceil(tileOf(it.icon) / 2) - 2, y]} at={it.at - 6} dur={6} /> : null}
          <Tile icon={it.icon} x={centers[i]} y={y} at={it.at} label={it.label} color={it.color} labelMax={sizes[i]} />
        </React.Fragment>
      ))}
    </>
  );
};
