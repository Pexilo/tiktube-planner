// Palette HD des stories : chaque couleur Where'd Gains Go? (PAL) devient une rampe de 5 à 8 tons, interpolée en OKLab.
// Les ombres glissent vers l'encre bleutée (PAL.ink2), les lumières vers un papier chaud : le décalage de teinte du pixel art
// fait main. Tout ce qui est dessiné ou pixelisé (pixelize.tsx) est verrouillé sur ces tons : c'est ce qui fait tenir
// ensemble photos, logos et dessins dans un même univers.
import { PAL } from "../pixel/engine";

export type RGB = [number, number, number];
export type Lab = [number, number, number];

export const hexRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
export const rgbHex = (c: readonly number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const gam = (v: number) => (v <= 0.0031308 ? 12.92 * Math.max(0, v) : 1.055 * v ** (1 / 2.4) - 0.055) * 255;

export function toLab(c: readonly number[]): Lab {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromLab([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
/** Mélange de deux couleurs en OKLab (t = 0 : a, t = 1 : b). */
export const mixHex = (a: string, b: string, t: number) => {
  const [x, y] = [toLab(hexRgb(a)), toLab(hexRgb(b))];
  return rgbHex(fromLab(x.map((v, i) => v + (y[i] - v) * t) as Lab));
};

const SHADOW = PAL.ink2;
const LIGHT = "#FFF4E0";
/** Rampe du plus sombre au plus clair : `dark` tons vers l'ombre, la base, puis `light` tons vers la lumière. */
const ramp = (base: string, dark = 3, light = 2, reach = 0.82, glow = 0.68) => [
  ...Array.from({ length: dark }, (_, i) => mixHex(base, SHADOW, (reach * (dark - i)) / dark)),
  base,
  ...Array.from({ length: light }, (_, i) => mixHex(base, LIGHT, (glow * (i + 1)) / light)),
];

/** Les rampes de la série. `tomato` = mi-rose mi-orange (sauce, pepperoni) ; `wood` part du brun de peau foncé. */
export const RAMPS = {
  ink: ["#050507", PAL.ink, "#131218", PAL.ink2, PAL.ink3, "#3D3B49", "#555263"],
  stone: ["#28261F", PAL.grey2, PAL.grey, "#8F8A7D", "#B4AD9D", PAL.paper2, PAL.paper, "#FFFCF4"],
  pink: ramp(PAL.pink),
  tomato: ramp(mixHex(PAL.pink, PAL.orange, 0.5)),
  orange: ramp(PAL.btc, 3, 3),
  lime: ramp(PAL.lime, 3, 1),
  cyan: ramp(PAL.cyan, 3, 1),
  skin: [mixHex(PAL.skin3, SHADOW, 0.45), PAL.skin3, PAL.skin2, PAL.skin1, mixHex(PAL.skin1, LIGHT, 0.5)],
  hair: [mixHex(PAL.hair1, SHADOW, 0.5), PAL.hair1, PAL.hair2, mixHex(PAL.hair2, PAL.hair3, 0.45), PAL.hair3],
  wood: ramp(PAL.skin3, 3, 2, 0.75, 0.55),
} satisfies Record<string, string[]>;
export type RampName = keyof typeof RAMPS;
export const RAMP_NAMES = Object.keys(RAMPS) as RampName[];

/** Un ton de la palette : sa rampe et sa place dans la rampe (0 = le plus sombre). */
export type Swatch = { hex: string; rgb: RGB; lab: Lab; ramp: RampName; step: number };
export const SWATCHES: Swatch[] = RAMP_NAMES.flatMap((r) => RAMPS[r].map((hex, step) => ({ hex, rgb: hexRgb(hex), lab: toLab(hexRgb(hex)), ramp: r, step })));
/** Index des tons de chaque rampe dans SWATCHES. */
export const IDX = Object.fromEntries(RAMP_NAMES.map((r) => [r, SWATCHES.flatMap((s, i) => (s.ramp === r ? [i] : []))])) as Record<RampName, number[]>;
/** Ton `step` de la rampe `r` (borné), en hex. */
export const tone = (r: RampName, step: number) => RAMPS[r][Math.max(0, Math.min(RAMPS[r].length - 1, step))];
/** Ton voisin dans la même rampe (d > 0 : plus clair). */
export const shift = (i: number, d: number) => {
  const r = IDX[SWATCHES[i].ramp];
  return r[Math.max(0, Math.min(r.length - 1, SWATCHES[i].step + d))];
};
const BY_HEX = new Map(SWATCHES.map((s, i) => [s.hex.toLowerCase(), i] as const).reverse());

/* ------------------------------------------------------------------ Quantification tramée */

const WL = 1.4; // la clarté compte plus que la teinte : les volumes se lisent
const d2 = (a: Lab, b: Lab) => WL * (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function nearestIn(lab: Lab, set: readonly number[]) {
  let best = set[0];
  let bd = Infinity;
  for (const i of set) {
    const d = d2(lab, SWATCHES[i].lab);
    if (d < bd) [bd, best] = [d, i];
  }
  return best;
}
/** Index du ton d'une couleur hex : exact si elle est dans la palette, sinon le plus proche. */
export const swatchOf = (hex: string) => BY_HEX.get(hex.toLowerCase()) ?? nearestIn(toLab(hexRgb(hex)), SWATCHES.map((_, i) => i));

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));
/** Seuil de Bayer 4 × 4 de la cellule (x, y), dans ]0, 1[. */
export const bayer = (x: number, y: number) => BAYER[y & 3][x & 3];

/** Resserre la part de trame : `strength` 1 = trame sur tout l'intervalle, 0,5 = seulement au milieu, 0 = aplats. */
const sharpen = (t: number, strength: number) => (strength <= 0 ? (t < 0.5 ? 0 : 1) : Math.max(0, Math.min(1, 0.5 + (t - 0.5) / strength)));

/**
 * Ton tramé : on prend le ton le plus proche, puis le ton « de l'autre côté » de la couleur, et le seuil de Bayer choisit
 * entre les deux selon la position de la couleur sur le segment (trame ordonnée à deux tons, nette sur la grille).
 */
export function ditherIn(lab: Lab, set: readonly number[], b: number, strength: number) {
  const p1 = nearestIn(lab, set);
  if (strength <= 0) return p1;
  const A = SWATCHES[p1].lab;
  const p2 = nearestIn([2 * lab[0] - A[0], 2 * lab[1] - A[1], 2 * lab[2] - A[2]], set);
  if (p2 === p1) return p1;
  const B = SWATCHES[p2].lab;
  const v = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const t = (WL * (lab[0] - A[0]) * v[0] + (lab[1] - A[1]) * v[1] + (lab[2] - A[2]) * v[2]) / (WL * v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return b < sharpen(t, strength) ? p2 : p1;
}

/** Camaïeu : seule la clarté compte, posée sur les tons de `set` triés du plus sombre au plus clair. */
export function monoIn(L: number, sorted: readonly number[], b: number, strength: number) {
  const Ls = sorted.map((i) => SWATCHES[i].lab[0]);
  if (L <= Ls[0]) return sorted[0];
  for (let i = 0; i < sorted.length - 1; i++)
    if (L <= Ls[i + 1]) return b < sharpen((L - Ls[i]) / (Ls[i + 1] - Ls[i]), strength) ? sorted[i + 1] : sorted[i];
  return sorted[sorted.length - 1];
}
