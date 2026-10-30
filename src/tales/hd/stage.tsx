// Plateau HD : décor éclairé sur la grille de 180 × 320 cellules, puis trois couches au-dessus des objets :
// 1. la lumière, un « shader » par cellule : une carte d'éclairage MULTIPLIÉE sur tout le plan, décor et objets compris,
//    en paliers tramés (Bayer) : ce qui sort du faisceau tombe dans l'ombre, la lumière reste sur la grille ;
// 2. l'air : faisceaux visibles et poussière qui ne brille que dans la lumière ;
// 3. la caméra : vignette, grain, lignes de balayage (seule couche douce, elle ne touche pas au dessin).
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { SoundOff } from "../kit/sfx";
import { useBg } from "../pixel/backdrop";
import { Canvas, PixelArt } from "../pixel/engine";
import { drawText, LINE, textWidth, wrap } from "../pixel/font";
import { useTextSlot } from "../pixel/layout";
import { COLS, GROUND, P, ROWS } from "./grid";
import { bayer, hexRgb, mixHex, RAMPS } from "./palette";

export type Cone = { kind: "cone"; x: number; top?: number; spread?: number; core?: number; power?: number; beam?: number; color?: string };
export type Lamp =
  /** Projecteur au plafond : cône vers le bas, flaque au sol, faisceau visible dans l'air (`beam`, 0 = invisible). */
  | Cone
  /** Halo rond (écran, lampe de bureau). */
  | { kind: "glow"; x: number; y: number; r: number; power?: number }
  /** Jour diffus qui tombe du haut. */
  | { kind: "top"; power?: number };

export type Scene = {
  /** Mur et sol en pleine lumière (tons de la palette). Sans sol : le mur descend jusqu'en bas. */
  wall: string;
  floor?: string | false;
  ground?: number;
  /** Lumière minimale hors des lampes (0..1, défaut 0,3). */
  ambient?: number;
  lamps: Lamp[];
  /** Teinte des ombres (multipliée) : froide par défaut. */
  shadow?: string;
  /** Particules de poussière (nombre, défaut 70) et leur couleur. */
  dust?: number;
  dustColor?: string;
  /** Marbrure du mur (0 = aplat, défaut 0,4). */
  mottle?: number;
  seed?: number;
};

/**
 * Ordre des calques d'un plan HD : objets (auto), lumière, textes, caméra. Un texte posé dans un conteneur qui crée son
 * propre empilement (Glow, Reflect, transform, filter) perd sa place au-dessus de la lumière : les textes restent dehors.
 */
export const Z = { light: 20, ui: 30, camera: 40 };
/** Clarté d'une couleur hex : fond clair (texte encre) ou sombre (texte papier). */
export const isLightHex = (hex: string) => {
  const [r, g, b] = hexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
};
const full: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: COLS * P, height: ROWS * P, imageRendering: "pixelated" };
const mod = (n: number, m: number) => ((n % m) + m) % m;
const sstep = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** Bruit de valeur déterministe (0..1), pour les marbrures et les particules. */
const h2 = (x: number, y: number, s: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x: number, y: number, s: number) => {
  const [xi, yi] = [Math.floor(x), Math.floor(y)];
  const [u, v] = [x - xi, y - yi].map((f) => f * f * (3 - 2 * f));
  const [a, b, c, d] = [h2(xi, yi, s), h2(xi + 1, yi, s), h2(xi, yi + 1, s), h2(xi + 1, yi + 1, s)];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/** Part d'un projecteur en (x, y) : 1 dans le cœur du cône, 0 hors du cône ; au sol, une flaque elliptique. */
export function coneAt(l: Cone, x: number, y: number, ground = GROUND) {
  const top = l.top ?? -30;
  if (y < top) return 0;
  const half = (l.core ?? 10) + (l.spread ?? 0.3) * (Math.min(y, ground) - top);
  let k = sstep(1, 0.6, Math.abs(x - l.x) / half);
  if (y > ground) k *= sstep(1, 0.25, Math.hypot((x - l.x) / half, (y - ground) / (half * 0.3)));
  return k;
}
/** Éclairage total (0..1) de la cellule (x, y). */
export function lightAt(s: Scene, x: number, y: number, breathe = 0) {
  const g = s.ground ?? GROUND;
  let v = s.ambient ?? 0.3;
  for (const l of s.lamps) {
    if (l.kind === "top") v += (l.power ?? 0.5) * Math.max(0, 1 - y / (ROWS * 0.85));
    else if (l.kind === "glow") v += (l.power ?? 0.6) * Math.max(0, 1 - Math.hypot(x - l.x, y - l.y) / l.r) ** 1.6;
    else v += (l.power ?? 0.75) * coneAt(l, x, y, g);
  }
  return Math.min(1, v * (1 + breathe));
}

/** Décor en pleine lumière : mur légèrement marbré (deux tons tramés), sol avec liseré et lignes de fuite. */
const Backdrop: React.FC<{ scene: Scene }> = ({ scene }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const g = scene.ground ?? GROUND;
    const seed = scene.seed ?? 7;
    const mottle = scene.mottle ?? 0.25;
    const img = ctx.createImageData(COLS, ROWS);
    const wall = hexRgb(scene.wall);
    const wall2 = hexRgb(mixHex(scene.wall, RAMPS.ink[3], 0.14));
    const floor = scene.floor ? hexRgb(scene.floor) : null;
    const floor2 = scene.floor ? hexRgb(mixHex(scene.floor, RAMPS.ink[3], 0.16)) : null;
    const edge = scene.floor ? hexRgb(mixHex(scene.floor, "#FFF4E0", 0.3)) : null;
    const lines = new Set([4, 11, 22, 38, 60, 90]);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        let c = wall;
        if (floor && y >= g) c = y === g ? edge! : lines.has(y - g) ? floor2! : floor;
        else if (mottle > 0) {
          const n = 0.75 * vnoise(x / 26, y / 26, seed) + 0.25 * vnoise(x / 8, y / 8, seed + 1);
          if (n + (bayer(x, y) - 0.5) * 0.3 > 1 - mottle * 0.5) c = wall2;
        }
        img.data.set([...c, 255], (y * COLS + x) * 4);
      }
    ctx.putImageData(img, 0, 0);
  }, [scene]);
  return <canvas ref={ref} width={COLS} height={ROWS} style={full} />;
};

/** Paliers de la carte d'éclairage (tramés entre eux). */
const LEVELS = 9;
/** Lumière (multipliée, fixe pendant le plan) + air (faisceaux qui respirent toutes les 10 frames, poussière, en écran). */
const LightLayer: React.FC<{ scene: Scene; offset?: number }> = ({ scene, offset = 0 }) => {
  const frame = useCurrentFrame() + offset;
  const mul = useRef<HTMLCanvasElement>(null);
  const air = useRef<HTMLCanvasElement>(null);
  const levels = useMemo(() => {
    const [dark, lite] = [hexRgb(scene.shadow ?? "#17152B"), hexRgb("#FFF9F0")];
    return Array.from({ length: LEVELS + 1 }, (_, i) => dark.map((v, j) => Math.round(v + ((lite[j] - v) * i) / LEVELS)));
  }, [scene.shadow]);
  useLayoutEffect(() => {
    const [m, a] = [mul.current?.getContext("2d"), air.current?.getContext("2d")];
    if (!m || !a) return;
    const g = scene.ground ?? GROUND;
    const breathe = [0, 0.012, 0.024, 0.012][Math.floor(frame / 10) & 3];
    const cones = scene.lamps.filter((l): l is Cone => l.kind === "cone" && (l.beam ?? 0.5) > 0);
    const beam = hexRgb(cones[0]?.color ?? "#FFE6BC");
    const [mi, ai] = [m.createImageData(COLS, ROWS), a.createImageData(COLS, ROWS)];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const o = (y * COLS + x) * 4;
        const lv = Math.min(LEVELS, Math.floor(lightAt(scene, x, y) * LEVELS + bayer(x, y)));
        mi.data.set([...levels[lv], 255], o);
        if (y >= g) continue;
        // Le faisceau pâlit en descendant : visible dans l'air, il ne voile pas les objets posés au sol.
        let b = 0;
        for (const l of cones) b += (l.beam ?? 0.5) * (1 + 4 * breathe) * coneAt(l, x, y, g) * (0.1 + 0.9 * Math.max(0, 1 - (y - (l.top ?? -30)) / (g - (l.top ?? -30))) ** 1.6);
        const q = Math.min(3, Math.floor(b * 3 + bayer(x + 2, y + 1)));
        if (q > 0) ai.data.set([...beam, q * 19], o);
      }
    // Poussière : elle monte par paliers d'une cellule et ne se voit que dans la lumière.
    const dust = hexRgb(scene.dustColor ?? "#FFF1D6");
    const seed = scene.seed ?? 7;
    const amb = scene.ambient ?? 0.3;
    for (let i = 0; i < (scene.dust ?? 70); i++) {
      const sp = 5 + Math.floor(h2(i, 3, seed) * 7);
      const y = Math.floor(mod(h2(i, 2, seed) * g - frame / sp, g));
      const x = Math.floor(h2(i, 1, seed) * COLS + 2.5 * Math.sin((frame / sp + i * 7) / 6));
      if (x < 0 || x >= COLS || Math.floor((frame + i * 5) / 4) % 11 === 0) continue;
      const k = Math.min(1, (lightAt(scene, x, y) - amb) * 1.6);
      if (k < 0.12) continue;
      const big = h2(i, 4, seed) < 0.12;
      for (const [dx, dy] of big ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]) ai.data.set([...dust, Math.round(255 * Math.min(1, 0.2 + k))], ((y + dy) * COLS + x + dx) * 4);
    }
    m.putImageData(mi, 0, 0);
    a.putImageData(ai, 0, 0);
  }, [scene, frame, levels]);
  return (
    <>
      <canvas ref={mul} width={COLS} height={ROWS} style={{ ...full, mixBlendMode: "multiply", zIndex: Z.light }} />
      <canvas ref={air} width={COLS} height={ROWS} style={{ ...full, mixBlendMode: "screen", zIndex: Z.light }} />
    </>
  );
};

/** Couche caméra : vignette, grain (figé : un grain qui défile alourdit beaucoup la vidéo), lignes de balayage. */
export const Post: React.FC<{ grain?: number; scan?: number; vignette?: number; offset?: number }> = ({ grain = 0.09, scan = 0.13, vignette = 0.5 }) => {
  return (
    <>
      <AbsoluteFill style={{ zIndex: Z.camera, background: `radial-gradient(ellipse 80% 62% at 50% 42%, transparent 52%, rgba(4,4,9,${vignette}) 100%)` }} />
      <AbsoluteFill style={{ zIndex: Z.camera, backgroundImage: `url(${staticFile("fx/noise.png")})`, opacity: grain, mixBlendMode: "overlay" }} />
      <AbsoluteFill style={{ zIndex: Z.camera, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,${scan}) 2px, rgba(0,0,0,${scan}) 3px)` }} />
    </>
  );
};

/**
 * Plan HD : décor, objets (`children`, éclairés), lumière, textes (calque Z.ui : jamais assombris), caméra.
 * `offset` décale le temps de la lumière, de la poussière et du grain (plan qui boucle). <Beat scene> le pose tout seul.
 */
export const Stage: React.FC<{ scene: Scene; offset?: number; children?: React.ReactNode; ui?: React.ReactNode }> = ({ scene, offset = 0, children, ui }) => (
  <AbsoluteFill style={{ background: scene.wall, overflow: "hidden", isolation: "isolate" }}>
    <Backdrop scene={scene} />
    {children}
    <LightLayer scene={scene} offset={offset} />
    {ui ? <AbsoluteFill style={{ zIndex: Z.ui }}>{ui}</AbsoluteFill> : null}
    <Post offset={offset} />
  </AbsoluteFill>
);

/**
 * Garde-fou de mise en page (pixel/layout.tsx) pour une boîte en cellules HD : renvoie le décalage vertical (cellules HD)
 * qui évite les autres textes du plan et les zones de la plateforme (rien au-dessus de la ligne 54 ni sous la ligne 242).
 */
export function useHDSlot(b: { x0: number; y0: number; x1: number; y1: number } | null) {
  return Math.round(2 * useTextSlot(b && { x0: b.x0 / 2, y0: b.y0 / 2, x1: b.x1 / 2, y1: b.y1 / 2 }));
}

/** Reflet sur sol brillant : `children` retournés sous la ligne `y`, estompés par bandes de 1/6 (paliers nets). */
export const Reflect: React.FC<{ y?: number; depth?: number; opacity?: number; children: React.ReactNode }> = ({ y = GROUND, depth = 40, opacity = 0.5, children }) => {
  const Y = y * P;
  const bh = (depth * P) / 6;
  const bands = Array.from({ length: 6 }, (_, i) => 5 - i).map((i) => `rgba(0,0,0,${((6 - i) / 6) ** 1.6}) ${Y - (i + 1) * bh}px ${Y - i * bh}px`);
  const mask = `linear-gradient(to bottom, transparent ${Y - depth * P}px, ${bands.join(", ")}, transparent ${Y}px)`;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: COLS * P, height: ROWS * P, transformOrigin: "0 0", transform: `translateY(${2 * Y}px) scaleY(-1)`, opacity, WebkitMaskImage: mask, maskImage: mask }}>
      <SoundOff.Provider value={true}>{children}</SoundOff.Provider>
    </div>
  );
};

/** Halo de lumière (bloom) autour d'éléments lumineux : écran, néon, pièces au soleil. Couche caméra, donc douce. */
export const Glow: React.FC<{ blur?: number; strength?: number; children: React.ReactNode }> = ({ blur = 18, strength = 0.6, children }) => (
  <>
    {children}
    <AbsoluteFill style={{ filter: `blur(${blur}px)`, mixBlendMode: "screen", opacity: strength }}>
      <SoundOff.Provider value={true}>{children}</SoundOff.Provider>
    </AbsoluteFill>
  </>
);

/**
 * Texte bitmap du kit sur la grille HD : une lettre = 5 × 7 cellules × `k`. (x, y) en cellules, y = haut du bloc.
 * `box` = étiquette (fond, bordure d'une cellule, ombre portée d'une cellule) ; `shadow` = ombre du texte (décalée de k).
 * Sans `color`, le texte s'adapte au fond du plan. `layer` : "ui" (défaut : au-dessus de la lumière, protégé par le
 * garde-fou de mise en page) ou "world" (texte du décor, éclairé comme lui : écran, enseigne, ticket).
 */
export const Txt: React.FC<{
  text: string;
  x: number;
  y: number;
  k?: number;
  color?: string;
  shadow?: string | false;
  align?: "left" | "center";
  max?: number;
  box?: string;
  border?: string;
  pad?: number;
  chars?: number;
  layer?: "ui" | "world";
}> = ({ text, x, y, k = 1, color: colorProp, shadow: shadowProp, align = "center", max = 150, box, border = RAMPS.ink[1], pad = 3, chars, layer = "ui" }) => {
  const { light } = useBg();
  const color = colorProp ?? (light && !box ? RAMPS.ink[1] : RAMPS.stone[6]);
  const shadow = shadowProp ?? (light || box ? false : RAMPS.ink[1]);
  const lines = wrap(text, Math.floor(max / k));
  const widths = lines.map(textWidth);
  const wMax = Math.max(0, ...widths);
  const p = box ? pad : 0;
  const [W, H] = [wMax * k + 2 * p, (lines.length * LINE - 3) * k + 2 * p];
  const c = new Canvas();
  if (box) c.rect(1, 1, W + 1, H + 1, border).rect(-1, -1, W + 2, H + 2, border).rect(0, 0, W, H, box);
  let budget = chars ?? Infinity;
  lines.forEach((l, i) => {
    const s = l.slice(0, Math.max(0, budget));
    budget -= l.length + 1;
    const ox = p + (align === "center" ? Math.floor(((wMax - widths[i]) * k) / 2) : 0);
    const oy = p + i * LINE * k;
    if (shadow) drawText(c, s, ox + k, oy + k, shadow, k);
    drawText(c, s, ox, oy, color, k);
  });
  const left = align === "center" ? Math.round(x - W / 2) : x;
  const dy = useHDSlot(layer === "ui" ? { x0: left - 1, y0: y - 1, x1: left + W + 2, y1: y + H + 2 } : null);
  return (
    <div style={{ position: "absolute", left: left * P, top: (y + dy) * P, zIndex: layer === "ui" ? Z.ui : undefined }}>
      <PixelArt canvas={c} p={P} />
    </div>
  );
};

/**
 * Vapeur : rubans qui montent en ondulant (l'onde et les bouffées remontent par paliers de 3 frames), s'élargissent
 * et pâlissent en haut ; transparence tramée sur la grille. (x, y) = base, `cols` = départs relatifs des rubans.
 */
export const Steam: React.FC<{ x: number; y: number; cols?: number[]; rise?: number; color?: string }> = ({ x, y, cols = [-9, 0, 9], rise = 36, color = "#FFF6E6" }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const W = Math.max(...cols.map(Math.abs)) * 2 + 24;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, rise + 2);
    const rgb = hexRgb(color);
    const t = Math.floor(frame / 3);
    cols.forEach((dx, i) => {
      for (let s = 0; s < rise; s++) {
        const u = s / rise;
        const puff = 0.5 + 0.5 * Math.sin((s - t * 1.4 + i * 11) / 4);
        const a = Math.min(1, s / 3) * (1 - u) ** 1.1 * (0.35 + 0.65 * puff);
        const cx = W / 2 + dx + (2 + 4 * u) * Math.sin((s + i * 9) / 5.5 - t * 0.3);
        const half = 0.8 + 2.2 * u;
        const yy = rise - s;
        // Coupe du ruban : dense au centre, tramée sur les bords.
        for (let xx = Math.floor(cx - half); xx <= Math.ceil(cx + half); xx++) {
          const v = a * Math.max(0, 1 - Math.abs(xx + 0.5 - cx) / (half + 0.5)) ** 0.7;
          if (xx < 0 || xx >= W || v < 0.06 || v < bayer(xx, yy) * 0.5) continue;
          img.data.set([...rgb, Math.round(60 + 160 * v)], (yy * W + xx) * 4);
        }
      }
    });
    ctx.putImageData(img, 0, 0);
  }, [frame, cols, rise, color, W]);
  return <canvas ref={ref} width={W} height={rise + 2} style={{ position: "absolute", left: (x - W / 2) * P, top: (y - rise - 1) * P, width: W * P, height: (rise + 2) * P, imageRendering: "pixelated" }} />;
};
