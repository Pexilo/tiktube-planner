// Dessin en cellules pour la grille HD : une règle d'ombrage unique (pièce = masque ; bord haut-gauche éclairci d'un ton,
// bande bas-droite assombrie d'un ton, trait sombre contre ce que la pièce recouvre) et les accessoires simples qu'on
// n'a pas besoin de pixeliser (étiquettes, post-it, bureau, clavier, tasse, carte de forum).
import { Canvas } from "../pixel/engine";
import { drawText, LINE, textWidth, tr, wrap } from "../pixel/font";
import { tone, type RampName } from "./palette";

export type Pt = [number, number];
/** Direction d'un angle en degrés : 0 = vers le bas, 90 = vers l'avant (la droite), 180 = vers le haut. */
export const dir = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
export const go = (p: Pt, deg: number, len: number): Pt => [p[0] + dir(deg)[0] * len, p[1] + dir(deg)[1] * len];

/** Peint une pièce (forme tracée par `shape`) sur `c`, ombrée sur la rampe `ramp` autour du ton `base`. */
export function part(c: Canvas, shape: (m: Canvas) => void, ramp: RampName, base: number, line = true) {
  const m = new Canvas();
  shape(m);
  const has = (x: number, y: number) => m.cells.has(`${x},${y}`);
  const col = (s: number) => tone(ramp, s);
  const pts = [...m.cells.keys()].map((k) => k.split(",").map(Number));
  if (line)
    for (const [x, y] of pts)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(x + dx, y + dy) && c.cells.has(`${x + dx},${y + dy}`)) c.cells.set(`${x + dx},${y + dy}`, col(0));
  for (const [x, y] of pts) {
    const s = !has(x + 1, y + 1) || !has(x + 2, y + 2) ? base - 1 : !has(x - 1, y) || !has(x, y - 1) ? base + 1 : base;
    c.cells.set(`${x},${y}`, col(s));
  }
  return c;
}

/** Texte bitmap en cellules (lettres 5 × 7 × k), coin haut gauche en (x, y) ; renvoie la largeur. */
export const text = (c: Canvas, s: string, x: number, y: number, color: string, k = 1) => drawText(c, s, x, y, color, k);

/* ------------------------------------------------------------------ Accessoires */

/** Étiquette de prix suspendue (origine = trou de la ficelle) : carton orange, œillet, texte sur 1 ou 2 lignes. */
export function priceTag(lines: string[]) {
  const c = new Canvas();
  const w = Math.max(...lines.map(textWidth)) + 14;
  const h = lines.length * LINE + 5;
  part(c, (m) => m.rows(0, Array.from({ length: h }, (_, j): [number, number] => [Math.max(0, 4 - j, j - h + 5), w]), "#000"), "orange", 3, false);
  part(c, (m) => m.circle(4, h / 2, 1.8, "#000"), "orange", 1, false);
  c.set(4, Math.floor(h / 2), tone("ink", 1));
  lines.forEach((l, i) => text(c, l, 10, 3 + i * LINE, tone("ink", 1)));
  return c;
}

/** Post-it (w × h, origine = coin haut gauche) : coin bas-droit corné, texte encre sur plusieurs lignes. */
export function stickyNote(lines: string[], ramp: RampName = "lime", w = 30, h = 26) {
  const c = new Canvas();
  const f = 7;
  // Feuille au coin bas-droit coupé en diagonale, puis le rabat replié (plus sombre) et son pli.
  part(c, (m) => m.rows(0, Array.from({ length: h }, (_, y): [number, number] => [0, y < h - f ? w - 1 : w - 1 - (y - (h - f))]), "#000"), ramp, 3, false);
  for (let v = 0; v < f; v++) for (let u = 0; u < f - v; u++) c.set(w - f + u, h - f + v, tone(ramp, u + v === f - 1 ? 1 : 2));
  c.rect(0, 0, w, 2, tone(ramp, 2));
  const total = lines.length * LINE - 3;
  lines.forEach((l, i) => text(c, l, Math.floor((w - textWidth(l)) / 2), Math.floor((h - total) / 2) + i * LINE, tone("ink", 1)));
  return c;
}

/** Bureau vu de face (origine = coin bas gauche, plateau à `h` cellules du sol) : plateau, pieds, caisson à tiroir. */
export function desk(w = 88, h = 21) {
  const c = new Canvas();
  part(c, (m) => m.rect(3, -h + 3, 4, h - 3, "#000"), "wood", 2);
  part(c, (m) => m.rect(w - 7, -h + 3, 4, h - 3, "#000"), "wood", 2);
  part(c, (m) => m.rect(w - 32, -h + 3, 25, 11, "#000"), "wood", 3);
  part(c, (m) => m.rect(w - 23, -h + 7, 7, 2, "#000"), "stone", 4, false);
  part(c, (m) => m.rect(0, -h, w, 3, "#000"), "wood", 4);
  c.rect(0, -h, w, 1, tone("wood", 5));
  return c;
}

/** Clavier beige vu de profil (origine = coin bas gauche) : boîtier en pente, touches. */
export function keyboard(w = 16) {
  const c = new Canvas();
  part(c, (m) => m.rows(-3, [[2, w - 1], [0, w - 1], [0, w - 1]], "#000"), "stone", 5, false);
  for (let x = 2; x < w - 1; x += 2) c.set(x, -3, tone("stone", 3));
  return c;
}

/** Tasse (origine = milieu du bas) : corps cylindrique rose, anse, bord clair, café. */
export function mug(ramp: RampName = "pink") {
  const c = new Canvas();
  part(c, (m) => m.rect(4, -8, 3, 1, "#000").rect(6, -8, 1, 5, "#000").rect(4, -4, 3, 1, "#000"), ramp, 2, false);
  part(c, (m) => m.rect(-4, -10, 8, 10, "#000"), ramp, 3);
  c.rect(-4, -10, 8, 1, tone(ramp, 5)).rect(-3, -10, 6, 1, tone("wood", 1));
  return c;
}

/** Chaise de bureau de profil (origine = sol sous le vérin) : assise à 14 cellules, dossier à gauche. */
export function chair() {
  const c = new Canvas();
  part(c, (m) => m.rect(-1, -12, 3, 9, "#000"), "stone", 3);
  part(c, (m) => m.rect(-10, -3, 21, 2, "#000"), "ink", 4);
  for (const x of [-9, 0, 9]) part(c, (m) => m.circle(x + 0.5, -0.5, 1.6, "#000"), "ink", 3);
  part(c, (m) => m.rect(-14, -38, 5, 25, "#000").rect(-13, -40, 3, 2, "#000"), "ink", 5);
  part(c, (m) => m.rect(-12, -15, 22, 4, "#000"), "ink", 5);
  return c;
}

/**
 * Message de forum (style BitcoinTalk 2010, origine = coin haut gauche) : barre de titre, ligne auteur · date,
 * avatar, texte. `w` = largeur en cellules. Rendu net (texte bitmap), pas pixelisé.
 */
export function forumPost(o: { title: string; author: string; date: string; body: string; w?: number; avatar?: RampName; chars?: number; cursor?: boolean }) {
  const W = o.w ?? 150;
  const c = new Canvas();
  const body = wrap(o.body, W - 34);
  const H = 26 + body.length * LINE + 6;
  c.rect(0, 0, W, H, tone("stone", 6));
  c.rect(0, 0, W, 13, tone("cyan", 1)).rect(0, 12, W, 1, tone("cyan", 0));
  text(c, o.title, 5, 3, tone("stone", 7));
  c.rect(0, 13, W, 10, tone("stone", 5));
  // Auteur et date traduits d'abord (story traduite) : la fin de `meta` n'est pas une clé du dictionnaire.
  const [author, date] = [tr(o.author), tr(o.date)];
  text(c, author, 5, 15, tone("cyan", 0));
  text(c, ` · ${date}`, 5 + textWidth(author), 15, tone("stone", 2));
  // Avatar : petit portrait de profil (cheveux, peau, lunettes).
  part(c, (m) => m.rect(5, 27, 20, 20, "#000"), o.avatar ?? "cyan", 4, false);
  part(c, (m) => m.circle(15, 37, 6.5, "#000"), "skin", 3, false);
  part(c, (m) => m.circle(14.5, 35.5, 7, "#000", (x, y) => y < 34 || x < 11), "hair", 2, false);
  c.rect(16, 36, 5, 1, tone("ink", 2)).rect(16, 38, 5, 1, tone("ink", 2)).rect(16, 37, 1, 1, tone("ink", 2)).rect(20, 37, 1, 1, tone("ink", 2)).set(18, 37, tone("ink", 1));
  c.rect(5, 46, 20, 1, tone("stone", 3));
  // Texte qui s'écrit : `chars` caractères visibles (la carte garde sa taille finale), curseur bloc après le dernier.
  let budget = o.chars ?? Infinity;
  body.forEach((l, i) => {
    const s = l.slice(0, Math.max(0, budget));
    const end = budget >= 0 && budget <= l.length;
    budget -= l.length + 1;
    const w = text(c, s, 30, 28 + i * LINE, tone("ink", 2));
    if (o.cursor && end) c.rect(30 + (s ? w + 2 : 0), 28 + i * LINE, 4, 7, tone("cyan", 2));
  });
  return c;
}

/** Contenu d'écran minuscule (w × h, origine = coin haut gauche) : barre de titre et lignes de texte simulées, en cyan. */
export function screenPage(w: number, h: number, seed = 3) {
  const c = new Canvas();
  c.rect(0, 0, w, 3, tone("cyan", 2)).rect(1, 1, Math.min(w - 2, 14), 1, tone("cyan", 4));
  for (let y = 5, i = 0; y < h - 1; y += 2, i++) {
    const len = 4 + ((i * 7 + seed * 5) % Math.max(5, w - 8));
    c.rect(2, y, Math.min(len, w - 4), 1, i === 0 ? tone("lime", 3) : tone("cyan", 3));
  }
  return c;
}


/** Guirlande de fanions (origine = attache gauche), `w` cellules de large : ficelle qui pend, triangles aux couleurs WGG. */
export function bunting(w = 120, sag = 8) {
  const c = new Canvas();
  const ramps: RampName[] = ["pink", "lime", "cyan", "orange"];
  const yAt = (x: number) => Math.round(sag * 4 * (x / w) * (1 - x / w));
  for (let x = 0; x <= w; x++) c.set(x, yAt(x), tone("stone", 4));
  for (let i = 0, x = 3; x + 7 < w; i++, x += 10) {
    const y = yAt(x + 3);
    part(c, (m) => m.rows(y + 1, Array.from({ length: 8 }, (_, j): [number, number] => [x + Math.floor(j / 2), x + 7 - Math.floor(j / 2)]).filter(([a, b]) => a <= b), "#000"), ramps[i % 4], 3, false);
  }
  return c;
}
