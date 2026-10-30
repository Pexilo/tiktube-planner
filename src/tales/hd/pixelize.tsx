// Pixeliseur HD : une image source (photo, logo, capture, SVG dessiné) devient un sprite pixel art sur la grille HD,
// verrouillé sur la palette (palette.ts) : réduction à la taille voulue en cellules, retouche (contraste, saturation),
// quantification tramée (Bayer 4 × 4), nettoyage des pixels isolés, reflet haut-gauche / ombre bas-droite, contour d'une
// cellule. C'est le procédé « vraie image → pixel art » : la même recette pour tout, d'où un rendu homogène.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import type { Canvas } from "../pixel/engine";
import { bayer, ditherIn, IDX, monoIn, nearestIn, RAMP_NAMES, shift, SWATCHES, swatchOf, toLab, type Lab, type RampName } from "./palette";
import { P } from "./grid";

/**
 * Sprite : grille de tons (index dans SWATCHES, -1 = transparent), avec une cellule de marge pour le contour.
 * `ox`, `oy` : cellule où tombe l'origin (0, 0) d'un dessin en cellules (ancre "origin").
 */
export type Buf = { w: number; h: number; px: Int16Array; ox?: number; oy?: number };

export type Finish = {
  /** Reflet d'un ton plus clair sur les bords haut-gauche et ombre d'un ton sur les bords bas-droite (défaut : oui). */
  rim?: boolean;
  /** Contour d'une cellule : ton le plus sombre de la rampe voisine (défaut), encre, ou aucun. */
  outline?: "ramp" | "ink" | false;
  /** Remplace les pixels isolés (sans voisin de même ton) par la couleur de leurs voisins (défaut : oui). */
  clean?: boolean;
};

export type PixOpts = Finish & {
  /** Largeur en cellules (sans la marge du contour). */
  w: number;
  /** Hauteur en cellules (défaut : proportion de la source). */
  h?: number;
  /** Rampes autorisées (défaut : toutes). Avec `mono`, l'image passe en camaïeu sur ces rampes (seule la clarté compte). */
  ramps?: RampName[];
  mono?: boolean;
  /** Trame : 0 = aplats, 1 = trame pleine (défaut 0,6). */
  dither?: number;
  /** Retouches avant quantification : contraste et saturation (1 = neutre), luminosité (décalage de clarté, ±0,1). */
  contrast?: number;
  sat?: number;
  bright?: number;
  /** Couleur majoritaire (sur 4 × 4 échantillons) au lieu de la moyenne : bords nets pour les aplats (logos, pictos). */
  mode?: boolean;
  /** Seuil d'opacité de la source (0..1, défaut 0,5). */
  alpha?: number;
  /** Rognage de la source [x, y, largeur, hauteur] en px. */
  crop?: [number, number, number, number];
};

/** Source : URL data:, ou chemin dans public/ (ex. "tales/hd/wikipedia.png"). */
const load = (src: string) =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`Source introuvable : ${src.slice(0, 90)}`));
    img.src = /^(data:|https?:|\/)/.test(src) ? src : staticFile(src);
  });

/** Source → sprite. */
export async function pixelize(src: string, o: PixOpts): Promise<Buf> {
  const img = await load(src);
  const [sx, sy, sw, sh] = o.crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
  const w = o.w;
  const h = o.h ?? Math.max(1, Math.round((w * sh) / sw));
  const S = o.mode ? 4 : 1;
  const cv = document.createElement("canvas");
  cv.width = w * S;
  cv.height = h * S;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w * S, h * S);
  const d = ctx.getImageData(0, 0, w * S, h * S).data;
  const set = (o.ramps ?? RAMP_NAMES).flatMap((r) => IDX[r]);
  const sorted = [...set].sort((a, b) => SWATCHES[a].lab[0] - SWATCHES[b].lab[0]);
  const [k, sat, br, dith, thr] = [o.contrast ?? 1, o.sat ?? 1, o.bright ?? 0, o.dither ?? 0.6, (o.alpha ?? 0.5) * 255];
  const adjust = (i: number): Lab => {
    const [L, A, B] = toLab([d[i], d[i + 1], d[i + 2]]);
    return [(L - 0.55) * k + 0.55 + br, A * sat, B * sat];
  };
  const buf: Buf = { w: w + 2, h: h + 2, px: new Int16Array((w + 2) * (h + 2)).fill(-1) };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = -1;
      if (S === 1) {
        const i = (y * w + x) * 4;
        if (d[i + 3] >= thr) {
          const lab = adjust(i);
          c = o.mono ? monoIn(lab[0], sorted, bayer(x, y), dith) : ditherIn(lab, set, bayer(x, y), dith);
        }
      } else {
        const votes = new Map<number, number>();
        for (let j = 0; j < S * S; j++) {
          const i = ((y * S + Math.floor(j / S)) * w * S + x * S + (j % S)) * 4;
          if (d[i + 3] < thr) continue;
          const q = nearestIn(adjust(i), set);
          votes.set(q, (votes.get(q) ?? 0) + 1);
        }
        const n = [...votes.values()].reduce((a, b) => a + b, 0);
        if (n * 2 >= S * S) c = [...votes].sort((a, b) => b[1] - a[1])[0][0];
      }
      buf.px[(y + 1) * buf.w + x + 1] = c;
    }
  return finish(buf, o);
}

/** Finitions communes à tous les sprites (pixelisés ou dessinés en cellules) : nettoyage, reflets, contour. */
export function finish(b: Buf, o: Finish): Buf {
  const { w, h, px } = b;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : px[y * w + x]);
  const pass = (f: (c: number, x: number, y: number) => number) => {
    const next = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) next[y * w + x] = f(px[y * w + x], x, y);
    px.set(next);
  };
  if (o.clean !== false)
    pass((c, x, y) => {
      if (c < 0) return c;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (at(x + dx, y + dy) === c) return c;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((v) => v >= 0);
      if (n.length < 3) return c;
      return n.sort((a, z) => n.filter((v) => v === z).length - n.filter((v) => v === a).length)[0];
    });
  if (o.rim !== false)
    pass((c, x, y) => {
      if (c < 0) return c;
      if (at(x - 1, y) < 0 || at(x, y - 1) < 0) return shift(c, 1);
      if (at(x + 1, y) < 0 || at(x, y + 1) < 0) return shift(c, -1);
      return c;
    });
  if (o.outline !== false) {
    const ink = IDX.ink[1];
    pass((c, x, y) => {
      if (c >= 0) return c;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].find((v) => v >= 0);
      return n === undefined ? -1 : o.outline === "ink" ? ink : IDX[SWATCHES[n].ramp][0];
    });
  }
  return b;
}

/**
 * Grille de cellules du moteur (Canvas, couleurs hex de la palette) → sprite. Les pièces dessinées en cellules sont
 * déjà ombrées (draw.ts : part) : par défaut seul le contour est ajouté (ton le plus sombre de la rampe voisine).
 */
export function fromCells(c: Canvas, o: Finish = {}): Buf {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const k of c.cells.keys()) {
    const [x, y] = k.split(",").map(Number);
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  const b: Buf = { w: x1 - x0 + 3, h: y1 - y0 + 3, px: new Int16Array((x1 - x0 + 3) * (y1 - y0 + 3)).fill(-1), ox: 1 - x0, oy: 1 - y0 };
  for (const [k, hex] of c.cells) {
    const [x, y] = k.split(",").map(Number);
    b.px[(y - y0 + 1) * b.w + x - x0 + 1] = swatchOf(hex);
  }
  return finish(b, { rim: false, clean: false, ...o });
}

/* ------------------------------------------------------------------ Rendu */

/** Ancrage d'un sprite en (x, y) : milieu du bas, centre, coin haut gauche, ou origine du dessin en cellules. */
export type Anchor = "bottom" | "center" | "topleft" | "origin";
/** Coin haut gauche (cellules) d'un sprite ancré en (x, y). */
export const corner = (b: Buf, x: number, y: number, anchor: Anchor): [number, number] => {
  const [X, Y] = [Math.round(x), Math.round(y)];
  if (anchor === "topleft") return [X, Y];
  if (anchor === "origin") return [X - (b.ox ?? 0), Y - (b.oy ?? 0)];
  if (anchor === "center") return [Math.round(x - b.w / 2), Math.round(y - b.h / 2)];
  return [Math.round(x - b.w / 2), Y - b.h];
};

/** Affiche un sprite (cellules de P px, sans lissage). */
export const BufView: React.FC<{ buf: Buf; x: number; y: number; anchor?: Anchor; flip?: boolean; onPaint?: () => void; style?: React.CSSProperties }> = ({ buf, x, y, anchor = "bottom", flip, onPaint, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(buf.w, buf.h);
    buf.px.forEach((c, i) => c >= 0 && img.data.set([...SWATCHES[c].rgb, 255], i * 4));
    ctx.putImageData(img, 0, 0);
    onPaint?.();
  }, [buf, onPaint]);
  const [l, t] = corner(buf, x, y, anchor);
  return (
    <canvas
      ref={ref}
      width={buf.w}
      height={buf.h}
      style={{ position: "absolute", left: l * P, top: t * P, width: buf.w * P, height: buf.h * P, imageRendering: "pixelated", transform: flip ? "scaleX(-1)" : undefined, ...style }}
    />
  );
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
const PENDING = new Map<string, Promise<Buf>>();
const DONE = new Map<string, Buf>();
const getPix = (key: string, src: string, o: PixOpts) => {
  if (!PENDING.has(key)) PENDING.set(key, pixelize(src, o).then((b) => (DONE.set(key, b), b)));
  return PENDING.get(key)!;
};

/** Image source pixelisée, posée en (x, y) cellules (ancre : milieu du bas par défaut). Calculée une fois par rendu. */
export const Pix: React.FC<PixOpts & { src: string; x: number; y: number; anchor?: Anchor; flip?: boolean; style?: React.CSSProperties }> = ({ src, x, y, anchor, flip, style, ...o }) => {
  const key = `${src.length > 160 ? hash(src) : src}|${JSON.stringify(o)}`;
  const [buf, setBuf] = useState<Buf | null>(() => DONE.get(key) ?? null);
  const [handle] = useState(() => (DONE.has(key) ? null : delayRender(`pixelize ${src.slice(0, 60)}`)));
  const done = useRef(false);
  useEffect(() => {
    if (!buf) getPix(key, src, o).then(setBuf, cancelRender);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const painted = useCallback(() => {
    if (handle !== null && !done.current) {
      done.current = true;
      continueRender(handle);
    }
  }, [handle]);
  return buf ? <BufView buf={buf} x={x} y={y} anchor={anchor} flip={flip} onPaint={painted} style={style} /> : null;
};

/** Dessin en cellules (Canvas du moteur) affiché comme un sprite HD, ancré par son origine. `draw` est mémorisé par `deps`. */
export const Cells: React.FC<Finish & { draw: () => Canvas; deps?: unknown[]; x: number; y: number; anchor?: Anchor; flip?: boolean; style?: React.CSSProperties }> = ({ draw, deps = [], x, y, anchor = "origin", flip, style, ...o }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buf = useMemo(() => fromCells(draw(), o), deps);
  return <BufView buf={buf} x={x} y={y} anchor={anchor} flip={flip} style={style} />;
};
