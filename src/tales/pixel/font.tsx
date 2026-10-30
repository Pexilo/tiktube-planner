import React from "react";
import { useBg } from "./backdrop";
import { useTextSlot } from "./layout";
import { Canvas, P, PAL, PixelArt } from "./engine";

/*
 * Police bitmap des stories : chaque lettre est une grille de 5 × 7 pixels (majuscules), dessinée sur la grille.
 * Un pixel de texte = 6 px à l'écran (TEXT = moitié d'une cellule) pour le texte courant, 12 px (une cellule) pour les titres.
 * Une seule police, aucun repli sur une police système : tout caractère inconnu devient « ? ».
 */

/** Taille d'un pixel de texte courant (px écran). */
export const TP = P / 2;

const G: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ",": ["..", "..", "..", "..", "..", ".#", "#."],
  ":": [".", ".", "#", ".", ".", "#", "."],
  ";": ["..", "..", ".#", "..", "..", ".#", "#."],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "'": ["#", "#", ".", ".", ".", ".", "."],
  '"': ["#.#", "#.#", "...", "...", "...", "...", "..."],
  "-": ["....", "....", "....", "####", "....", "....", "...."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "(": [".#", "#.", "#.", "#.", "#.", "#.", ".#"],
  ")": ["#.", ".#", ".#", ".#", ".#", ".#", "#."],
  "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "#": [".#.#.", "#####", ".#.#.", ".#.#.", ".#.#.", "#####", ".#.#."],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  "<": ["...#", "..#.", ".#..", "#...", ".#..", "..#.", "...#"],
  ">": ["#...", ".#..", "..#.", "...#", "..#.", ".#..", "#..."],
  "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "~": [".....", ".....", ".#..#", "#.##.", ".....", ".....", "....."],
  "→": [".....", "..#..", "...#.", "#####", "...#.", "..#..", "....."],
  "←": [".....", "..#..", ".#...", "#####", ".#...", "..#..", "....."],
  "↑": ["..#..", ".###.", "#.#.#", "..#..", "..#..", "..#..", "..#.."],
  "↓": ["..#..", "..#..", "..#..", "..#..", "#.#.#", ".###.", "..#.."],
  "≈": [".....", ".#..#", "#.##.", ".....", ".#..#", "#.##.", "....."],
  "·": [".", ".", ".", "#", ".", ".", "."],
  "•": ["...", "...", ".#.", "###", ".#.", "...", "..."],
  "₿": [".#.#.", "####.", "#...#", "####.", "#...#", "####.", ".#.#."],
  "€": ["..###", ".#...", "####.", ".#...", "####.", ".#...", "..###"],
  "£": ["..##.", ".#..#", ".#...", "###..", ".#...", ".#...", "#####"],
  "█": ["#####", "#####", "#####", "#####", "#####", "#####", "#####"],
};
const ALIASES: Record<string, string> = {
  "’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"', "—": "-", "–": "-", "…": "...", "×": "x",
  " ": " ", " ": " ", "œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE", "ß": "ss",
};

/** Lettres accentuées (é, è, à, ç…) : la lettre de base, la police n'a que des majuscules de 7 pixels sans place pour l'accent. */
const glyph = (ch: string) => G[ch] ?? G[ch.toUpperCase()] ?? G[ch.normalize("NFD")[0]?.toUpperCase()] ?? G["?"];

/*
 * Textes à l'écran d'une story traduite (shared/tales.mjs → localizedTale) : les visuels sont écrits en anglais, chaque
 * texte dessiné par la police passe par ce dictionnaire (anglais → traduction, insensible à la casse ; `{}` = partie
 * variable). Posé par <TaleProvider> au rendu : une composition par page, donc une seule langue à la fois.
 */
let DICT: { exact: Map<string, string>; patterns: { re: RegExp; to: string }[] } | null = null;
let RAW = 0;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function setTextLocale(text: Record<string, string> | null | undefined) {
  const entries = Object.entries(text ?? {}).filter(([k, v]) => k.trim() && typeof v === "string");
  if (!entries.length) return void (DICT = null);
  DICT = { exact: new Map(), patterns: [] };
  for (const [k, v] of entries) {
    if (k.includes("{}")) DICT.patterns.push({ re: new RegExp(`^${k.trim().split("{}").map(esc).join("(.+?)")}$`, "i"), to: v });
    else DICT.exact.set(k.trim().toUpperCase(), v);
  }
}
/** Texte tel qu'il s'affiche dans la langue de la story (inchangé dans la langue de base). */
export function tr(s: string): string {
  if (!DICT || RAW || !s) return s;
  const t = s.trim();
  const hit = DICT.exact.get(t.toUpperCase());
  if (hit !== undefined) return hit;
  for (const p of DICT.patterns) {
    const m = p.re.exec(t);
    if (m) {
      let k = 1;
      return p.to.replace(/\{\}/g, () => m[k++] ?? "");
    }
  }
  return s;
}
/** Dessine sans traduction (sous-titres : déjà les mots de la voix). */
export function untranslated<T>(fn: () => T): T {
  RAW++;
  try {
    return fn();
  } finally {
    RAW--;
  }
}
const norm = (s: string) => [...tr(s)].map((c) => ALIASES[c] ?? c).join("");

/** Largeur d'un texte en pixels de texte (lettres + 1 pixel d'espacement). */
export const textWidth = (s: string) => {
  const chars = [...norm(s)];
  return chars.reduce((w, c, i) => w + glyph(c)[0].length + (i < chars.length - 1 ? 1 : 0), 0);
};

/** Coupe un texte en lignes de `max` pixels de texte au plus (sur les espaces). */
export function wrap(s: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of norm(s).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && textWidth(next) > max) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Dessine un texte dans une grille, coin haut gauche en (x, y) (pixels de texte), chaque pixel de lettre = k × k. */
export function drawText(c: Canvas, s: string, x: number, y: number, color: string, k = 1) {
  let cx = x;
  for (const ch of norm(s)) {
    const g = glyph(ch);
    g.forEach((row, j) => [...row].forEach((v, i) => v === "#" && c.rect(cx + i * k, y + j * k, k, k, color)));
    cx += (g[0].length + 1) * k;
  }
  return cx - x - k;
}

/** Hauteur d'une ligne de texte (7 pixels) + interligne (3). */
export const LINE = 10;

/**
 * Texte bitmap. (x, y) en cellules ; `align` = ancrage horizontal ("center" : x est le milieu), y = haut du bloc.
 * `scale` 1 = texte courant (pixels de 6 px), 2 = titre (pixels de 12 px). `shadow` = ombre d'un pixel en bas à droite.
 * Sans `color` / `shadow`, le texte s'adapte au fond du plan (`<Beat bg>`).
 * `max` = largeur max en cellules (retour à la ligne). `chars` = nombre de caractères visibles (effet machine à écrire).
 */
export const PixelText: React.FC<{
  text: string;
  x: number;
  y: number;
  color?: string;
  scale?: 1 | 2;
  align?: "left" | "center";
  shadow?: string | false;
  max?: number;
  chars?: number;
  /** false = ne réserve pas de place (texte à l'intérieur d'un autre composant déjà réservé). */
  slot?: boolean;
}> = ({ text, x, y: yProp, color: colorProp, scale = 1, align = "center", shadow: shadowProp, max = 84, chars, slot = true }) => {
  // Par défaut : papier + ombre encre sur fond sombre, encre sans ombre sur fond clair.
  const { light } = useBg();
  // Garde-fou : la boîte complète du texte (toutes les lignes) ne doit chevaucher aucun autre texte du plan.
  const m = measure(text, scale, max);
  const x0 = align === "center" ? x - m.wCells / 2 : x;
  const dy = useTextSlot(slot ? { x0, y0: yProp, x1: x0 + m.wCells, y1: yProp + m.hCells } : null);
  const y = yProp + dy;
  const color = colorProp ?? (light ? PAL.ink : PAL.paper);
  const shadow = shadowProp ?? (light ? false : PAL.ink);
  const px = TP * scale;
  const maxPx = Math.floor((max * P) / px);
  const lines = wrap(text, maxPx);
  const c = new Canvas();
  let budget = chars ?? Infinity;
  const widths = lines.map(textWidth);
  const wMax = Math.max(0, ...widths);
  lines.forEach((l, i) => {
    const shown = l.slice(0, Math.max(0, budget));
    budget -= l.length + 1;
    const ox = align === "center" ? Math.floor((wMax - widths[i]) / 2) : 0;
    if (shadow) drawText(c, shown, ox + 1, i * LINE + 1, shadow);
    drawText(c, shown, ox, i * LINE, color);
  });
  const left = align === "center" ? x * P - Math.floor(wMax / 2) * px : x * P;
  return (
    <div style={{ position: "absolute", left: Math.round(left / px) * px, top: Math.round(y * P) }}>
      <PixelArt canvas={c} p={px} />
    </div>
  );
};

/** Mesure d'un bloc de texte en cellules (largeur, hauteur) pour placer un cadre autour. */
export function measure(text: string, scale: 1 | 2 = 1, max = 84) {
  const px = TP * scale;
  const lines = wrap(text, Math.floor((max * P) / px));
  const w = Math.max(0, ...lines.map(textWidth));
  return { lines, wPx: w, hPx: lines.length * LINE - 3, wCells: (w * px) / P, hCells: ((lines.length * LINE - 3) * px) / P };
}
