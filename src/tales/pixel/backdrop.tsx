import React, { createContext, useContext, useLayoutEffect, useRef } from "react";
import { random, useCurrentFrame } from "remotion";
import { Canvas, COLS, GROUND, P, PAL, PixelArt, ROWS, shade } from "./engine";

/*
 * Fonds minimalistes : un aplat de la palette Where'd Gains Go? + un sol en bande d'un ton voisin.
 * Pas de décor chargé : le fond pose l'ambiance par sa couleur, les personnages et quelques objets racontent.
 * Le fond se choisit sur le beat (`<Beat id bg="pink">`) ; les textes lisent ce contexte pour rester lisibles.
 */

/** Fonds autorisés : encre (défaut), encre profonde, papier, rose, lime, cyan. */
export const TONES = { ink: PAL.ink, deep: PAL.ink2, paper: PAL.paper, pink: PAL.pink, lime: PAL.lime, cyan: PAL.cyan } as const;
export type Tone = keyof typeof TONES;
const LIGHT: Tone[] = ["paper", "lime", "cyan"];
export const isLight = (t: Tone) => LIGHT.includes(t);

export const BgCtx = createContext<{ tone: Tone; light: boolean }>({ tone: "ink", light: false });
/** Fond du plan courant. */
export const useBg = () => useContext(BgCtx);
/** Couleur de texte lisible sur le fond courant (encre sur fond clair, papier sur fond sombre). */
export const useTextColor = () => (useBg().light ? PAL.ink : PAL.paper);

/** Ton « en retrait » du fond courant (sol, collines, silhouettes) : un cran plus sombre sur fond clair, plus clair sur encre. */
export const recess = (tone: Tone, k = 1) => (tone === "ink" ? shade("#2B2A35", 1 - 0.15 * (k - 1)) : tone === "deep" ? shade("#33313F", 1 - 0.15 * (k - 1)) : shade(TONES[tone], 0.86 - 0.1 * (k - 1)));

/* ------------------------------------------------------------------ Lumière (« shader » pixel) */

/*
 * Le fond reste un aplat, mais il est ÉCLAIRÉ cellule par cellule, comme un shader : on calcule une intensité lumineuse
 * pour chaque cellule de la grille (halo, projecteur, lumière du haut, vignettage), puis on la quantifie en 5 tons du fond
 * avec un tramage ordonné (matrice de Bayer 4 × 4). Résultat : des dégradés doux mais 100 % pixel art, sur la grille.
 * La lumière vit un peu (le halo respire par paliers) et peut porter des particules (poussière, étincelles).
 */

/** Type d'éclairage du plan : halo central, projecteur sur le sol, lumière venant du haut, ou aucun (aplat pur). */
export type Light = "glow" | "spot" | "top" | "none";
/** Particules d'ambiance : poussière qui flotte, étincelles qui scintillent, ou rien. */
export type Ambient = "dust" | "sparks" | "none";

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};
/** Rampe de 5 tons autour du fond (du plus sombre au plus clair) : le fond est le ton du milieu. */
const ramp = (tone: Tone): string[] => {
  const b = TONES[tone];
  if (tone === "ink") return ["#050507", "#08080B", b, "#17161E", "#24222E"];
  if (tone === "deep") return ["#0B0B0E", "#131219", b, "#26242F", "#353241"];
  return [shade(b, 0.74), shade(b, 0.87), b, mix(b, "#FFFFFF", 0.16), mix(b, "#FFFFFF", 0.32)];
};
/** Modulo toujours positif (le temps du fond peut être négatif sur le plan qui boucle). */
const mod = (n: number, m: number) => ((n % m) + m) % m;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

/** Intensité lumineuse 0..1 d'une cellule (0,5 = ton du fond). `t` fait respirer la lumière par paliers. */
function intensity(light: Light, x: number, y: number, t: number, ground: number, floor: boolean) {
  const breathe = mod(Math.floor(t / 10), 4) * 0.012; // la lumière respire : 4 paliers, toutes les 10 frames
  const vx = (x - COLS / 2) / (COLS / 2);
  const vy = (y - ROWS * 0.42) / (ROWS * 0.6);
  let i = 0.5 - 0.22 * Math.max(0, vx * vx + vy * vy - 0.25); // vignettage : coins plus sombres
  if (light === "glow") {
    const d = Math.hypot((x - COLS / 2) / 48, (y - 52) / 62);
    i += 0.34 * Math.max(0, 1 - d) + breathe;
  } else if (light === "spot") {
    const half = 5 + y * 0.34; // cône qui s'élargit vers le bas
    const k = Math.max(0, 1 - Math.abs(x - COLS / 2) / half);
    if (y < ground) i += 0.32 * Math.min(1, k * 1.6) * (0.55 + 0.45 * (y / ground)) + breathe;
  } else if (light === "top") {
    i += 0.3 * Math.max(0, 1 - y / (ROWS * 0.75)) + breathe;
  }
  if (floor && y >= ground) {
    // Sol : plus sombre, avec une flaque de lumière sous la source.
    const pool = light === "none" ? 0 : Math.max(0, 1 - Math.hypot((x - COLS / 2) / 34, (y - ground - 4) / 9));
    i = 0.3 + 0.28 * pool - 0.08 * Math.min(1, (y - ground) / 40);
  }
  return Math.max(0, Math.min(1, i));
}

/**
 * Fond éclairé plein écran : aplat de la palette + lumière tramée + sol optionnel (liseré d'un pixel sur la ligne du sol)
 * + particules d'ambiance. Dessiné dans un <canvas> à la résolution de la grille (90 × 160), agrandi sans lissage.
 * `offset` décale le temps de l'animation (lumière, particules) : le plan qui boucle le règle pour que sa dernière frame
 * précède exactement la frame 0 du premier plan.
 */
export const Backdrop: React.FC<{ tone?: Tone; floor?: boolean; ground?: number; light?: Light; ambient?: Ambient; seed?: string; offset?: number }> = ({
  tone = "ink",
  floor = true,
  ground = GROUND,
  light = "glow",
  ambient = "none",
  seed = "bg",
  offset = 0,
}) => {
  const frame = useCurrentFrame() + offset;
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const tones = ramp(tone);
    const img = ctx.createImageData(COLS, ROWS);
    const put = (x: number, y: number, col: string) => {
      const [r, g, b] = hex(col);
      const o = (y * COLS + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    };
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const v = light === "none" && !(floor && y >= ground) ? 0.5 : intensity(light, x, y, frame, ground, floor);
        const lvl = Math.max(0, Math.min(4, Math.floor(v * 4 + BAYER[y % 4][x % 4] - 0.5 + 0.5)));
        put(x, y, tones[lvl]);
      }
    if (floor) for (let x = 0; x < COLS; x++) put(x, ground, tones[light === "none" ? 3 : 4]);
    // Particules : poussière qui monte lentement (paliers d'une cellule), étincelles qui clignotent.
    if (ambient !== "none")
      for (let i = 0; i < 26; i++) {
        const x0 = Math.floor(random(`${seed}px${i}`) * COLS);
        const y0 = Math.floor(random(`${seed}py${i}`) * ground);
        if (ambient === "dust") {
          const y = mod(Math.floor(y0 - frame / (5 + (i % 4))), ground);
          const x = (x0 + mod(Math.floor((frame + i * 13) / 40), 2)) % COLS;
          put(x, y, tones[4]);
        } else if (mod(Math.floor((frame + random(`${seed}pt${i}`) * 48) / 6), 8) === 0) {
          const spark = isLight(tone) ? "#FFFFFF" : PAL.paper;
          put(x0, y0, spark);
          if (x0 > 0) put(x0 - 1, y0, tones[4]);
          if (x0 < COLS - 1) put(x0 + 1, y0, tones[4]);
          if (y0 > 0) put(x0, y0 - 1, tones[4]);
          if (y0 < ROWS - 1) put(x0, y0 + 1, tones[4]);
        }
      }
    ctx.putImageData(img, 0, 0);
  }, [tone, floor, ground, light, ambient, seed, frame]);
  return <canvas ref={ref} width={COLS} height={ROWS} style={{ position: "absolute", left: 0, top: 0, width: COLS * P, height: ROWS * P, imageRendering: "pixelated" }} />;
};

/** Monticule en aplat (tas, décharge, colline), posé sur le sol, centré en `x`, `w` × `h` cellules, contour encre. */
export const Mound: React.FC<{ x?: number; w?: number; h?: number; ground?: number; color?: string }> = ({ x = COLS / 2, w = 70, h = 30, ground = GROUND, color }) => {
  const { tone } = useBg();
  const col = color ?? recess(tone, 2);
  const c = new Canvas();
  for (let i = 0; i < w; i++) {
    const u = (i + 0.5 - w / 2) / (w / 2);
    const hh = Math.round(h * Math.sqrt(Math.max(0, 1 - u * u)));
    if (hh > 0) c.rect(i, h - hh, 1, hh, col);
  }
  c.outline();
  return (
    <div style={{ position: "absolute", left: Math.round(x - w / 2) * P, top: (ground - h) * P }}>
      <PixelArt canvas={c} />
    </div>
  );
};

/** Silhouette de ville en aplat (immeubles sans fenêtres), d'un ton voisin du fond, posée sur le sol. */
export const Skyline: React.FC<{ ground?: number; seed?: string; color?: string }> = ({ ground = GROUND, seed = "skyline", color }) => {
  const { tone } = useBg();
  const col = color ?? recess(tone, 1);
  const c = new Canvas();
  let x = 0;
  for (let i = 0; x < COLS; i++) {
    const w = 7 + Math.floor(random(`${seed}w${i}`) * 9);
    const h = 14 + Math.floor(random(`${seed}h${i}`) * 30);
    c.rect(x, ground - h, w, h, col);
    x += w + 1;
  }
  return <PixelArt canvas={c} />;
};
