import React, { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import { loadFont as anton } from "@remotion/google-fonts/Anton";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as outfit } from "@remotion/google-fonts/Outfit";
import { loadFont as instrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as jakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as playfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as nunito } from "@remotion/google-fonts/Nunito";
import { loadFont as jetbrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as bricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as spaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import type { AppContent, Brand, L, Lang } from "./types";

const opts = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };
const FONTS: Record<string, string> = {
  Anton: anton("normal", { weights: ["400"], ...opts }).fontFamily,
  Montserrat: montserrat("normal", { weights: ["500", "600", "700", "800"], ...opts }).fontFamily,
  Outfit: outfit("normal", { weights: ["400", "500", "600", "700", "800"], ...opts }).fontFamily,
  "Instrument Serif": instrumentSerif("italic", { weights: ["400"], ...opts }).fontFamily,
  "Plus Jakarta Sans": jakarta("normal", { weights: ["500", "600", "700", "800"], ...opts }).fontFamily,
  "Playfair Display": playfair("italic", { weights: ["600", "700"], ...opts }).fontFamily,
  Inter: inter("normal", { weights: ["500", "600", "700", "800", "900"], ...opts }).fontFamily,
  Nunito: nunito("normal", { weights: ["600", "700", "800", "900"], ...opts }).fontFamily,
  "Bricolage Grotesque": bricolage("normal", { weights: ["600", "700", "800"], ...opts }).fontFamily,
  "Space Grotesk": spaceGrotesk("normal", { weights: ["400", "500", "700"], ...opts }).fontFamily,
};
export const MONO = `${jetbrains("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily}, ui-monospace, monospace`;
export const font = (name?: string) => (name ? `${FONTS[name] ?? name}, system-ui, sans-serif` : "system-ui");

export type Theme = {
  app: AppContent;
  lang: Lang;
  b: Brand;
  isShort: boolean;
  /** Unité de base : 1 = 1px en 1080 de large (short) ou 1080 de haut (long). */
  u: number;
  W: number;
  H: number;
  t: (l: L | undefined) => string;
  asset: (src: string) => string;
  dark: boolean;
};

const Ctx = createContext<Theme | null>(null);

export const ThemeProvider: React.FC<{ app: AppContent; lang: Lang; children: React.ReactNode }> = ({ app, lang, children }) => {
  const { width: W, height: H } = useVideoConfig();
  const isShort = H > W;
  const value: Theme = {
    app,
    lang,
    b: app.brand,
    isShort,
    u: isShort ? W / 1080 : H / 1080,
    W,
    H,
    t: (l) => (l ? l[lang] ?? l.en : ""),
    asset: (src) => `apps/${app.slug}/${src.replaceAll("{lang}", lang)}`,
    dark: app.brand.mode === "dark",
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTheme = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("ThemeProvider manquant");
  return v;
};

/** "#RRGGBB" + alpha 0..1 → rgba() */
export const alpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
