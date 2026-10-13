import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, font, useTheme } from "../lib/theme";
import { clamp } from "./fx";

type Token = { w: string; hl: boolean; suffix?: string };

const PUNCT = /^[?!:;,.…»)%]+$/;

/**
 * "Un *mot fort* ici" → tokens avec mise en valeur.
 * La ponctuation isolée ("?", ",") est collée au mot précédent (espace insécable) pour ne jamais passer seule à la ligne.
 */
export const tokenize = (text: string): Token[] => {
  const out: Token[] = [];
  let hl = false;
  for (const part of text.split(/(\*)/)) {
    if (part === "*") {
      hl = !hl;
      continue;
    }
    const glued = part.length > 0 && !/^\s/.test(part);
    part
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w, i) => {
        const prev = out[out.length - 1];
        const lead = w.match(/^[?!:;,.…»)%]+/)?.[0];
        if (prev && i === 0 && glued && lead) {
          prev.suffix = (prev.suffix ?? "") + lead;
          w = w.slice(lead.length);
          if (!w) return;
        } else if (prev && PUNCT.test(w)) {
          prev.suffix = (prev.suffix ?? "") + "\u00A0" + w;
          return;
        }
        out.push({ w, hl });
      });
  }
  return out;
};

export const plain = (text: string) => text.replace(/\*/g, "");

export type KineticMode = "slam" | "rise" | "pop" | "blur";

/**
 * Typographie cinétique : chaque mot entre avec un décalage.
 * slam = arrive de très près (x2.4) et claque ; rise = monte depuis un masque ; pop = rebond.
 */
export const Kinetic: React.FC<{
  text: string;
  size: number;
  start?: number;
  stagger?: number;
  mode?: KineticMode;
  align?: "left" | "center";
  color?: string;
  weight?: number;
  exitAt?: number;
  lineHeight?: number;
  maxWidth?: number;
  heading?: boolean;
  /** Coup de marqueur animé derrière les *mots* mis en valeur. */
  marker?: boolean;
  style?: React.CSSProperties;
}> = ({ text, size, start = 0, stagger = 3, mode = "rise", align = "center", color, weight, exitAt, lineHeight, maxWidth, heading = true, marker = true, style }) => {
  const { b, dark } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = tokenize(text);
  const fam = heading ? b.heading : b.body;
  const condensed = fam === "Anton";
  const fs = condensed ? size * 1.12 : size;
  const baseColor = color ?? b.text;
  return (
    <div
      style={{
        fontFamily: font(fam),
        fontSize: fs,
        fontWeight: weight ?? (heading ? b.headingWeight : 600),
        letterSpacing: `${heading ? b.tracking ?? -0.03 : -0.01}em`,
        lineHeight: lineHeight ?? (condensed ? 1.02 : 1.06),
        textAlign: align,
        textTransform: heading && b.uppercase ? "uppercase" : undefined,
        color: baseColor,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: "0.25em",
        maxWidth,
        ...style,
      }}
    >
      {tokens.map((tk, i) => {
        const d = start + i * stagger;
        const cfg =
          mode === "slam"
            ? { damping: 14, stiffness: 260, mass: 0.7 }
            : mode === "pop"
              ? { damping: 9, stiffness: 200, mass: 0.6 }
              : { damping: 20, stiffness: 170, mass: 0.8 };
        const p = spring({ frame: frame - d, fps, config: cfg });
        const e = exitAt !== undefined ? interpolate(frame, [exitAt + i * 1.2, exitAt + 6 + i * 1.2], [0, 1], clamp) : 0;
        let transform = "";
        let blur = e * 14;
        let opacity = Math.min(1, p * 1.6) * (1 - e);
        if (mode === "slam") {
          transform = `scale(${2.4 - 1.4 * p}) translateY(${(1 - p) * -10}%)`;
          blur += (1 - Math.min(1, p)) * 22;
          opacity = frame < d ? 0 : Math.min(1, (frame - d) / 2) * (1 - e);
        } else if (mode === "pop") {
          transform = `scale(${p}) rotate(${(1 - p) * -8}deg)`;
        } else if (mode === "blur") {
          transform = `scale(${1.25 - 0.25 * p})`;
          blur += (1 - p) * 18;
        } else {
          transform = `translateY(${(1 - p) * 110 - e * 40}%)`;
          blur += (1 - p) * 8;
        }
        const useSerif = tk.hl && b.serif;
        const hlStyle: React.CSSProperties = tk.hl
          ? useSerif
            ? { fontFamily: font(b.serif), fontWeight: 600, fontStyle: "italic", color: b.primary, letterSpacing: "-0.01em", fontSize: "1.06em", textTransform: "none" }
            : {
                backgroundImage: `linear-gradient(100deg, ${b.primary} 0%, ${b.secondary} 50%, ${dark ? b.accent : b.primary} 100%)`,
                backgroundSize: "200% 100%",
                backgroundPosition: `${interpolate(frame, [d, d + 90], [0, 100], clamp)}% 0%`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }
          : {};
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              position: "relative",
              isolation: "isolate",
              overflow: mode === "rise" ? "hidden" : "visible",
              paddingBottom: "0.14em",
              marginBottom: "-0.14em",
              paddingTop: "0.04em",
            }}
          >
            {tk.hl && marker ? (
              <span
                style={{
                  position: "absolute",
                  left: "-0.06em",
                  right: "-0.06em",
                  bottom: "0.16em",
                  height: "0.3em",
                  borderRadius: "0.08em",
                  background: `linear-gradient(90deg, ${alpha(b.primary, dark ? 0.55 : 0.3)}, ${alpha(b.secondary, dark ? 0.45 : 0.25)})`,
                  transform: `scaleX(${interpolate(frame, [d + 8, d + 18], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) }) * (1 - e)}) skewX(-12deg)`,
                  transformOrigin: "left center",
                  zIndex: -1,
                }}
              />
            ) : null}
            <span
              style={{
                display: "inline-block",
                position: "relative",
                transform,
                filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                opacity,
                ...hlStyle,
              }}
            >
              {tk.w}
            </span>
            {tk.suffix ? (
              <span style={{ display: "inline-block", transform, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity }}>{tk.suffix}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

/** Texte courant qui apparaît en fondu + montée. */
export const FadeText: React.FC<{ text: string; size: number; start?: number; color?: string; align?: "left" | "center"; weight?: number; style?: React.CSSProperties }> = ({
  text,
  size,
  start = 0,
  color,
  align = "center",
  weight = 500,
  style,
}) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 14], [0, 1], clamp);
  return (
    <div
      style={{
        fontFamily: font(b.body),
        fontSize: size,
        fontWeight: weight,
        color: color ?? b.muted,
        textAlign: align,
        lineHeight: 1.3,
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
        filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined,
        ...style,
      }}
    >
      {plain(text)}
    </div>
  );
};

/** Compteur à rouleaux (odomètre) pour les chiffres. */
export const Odometer: React.FC<{ value: string; start: number; size: number; color?: string; duration?: number }> = ({ value, start, size, color, duration = 36 }) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const chars = value.split("");
  const digitIdx = chars.map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
  const n = digitIdx.length;
  const H = size * 1.08;
  return (
    <div
      style={{
        display: "flex",
        fontFamily: font(b.heading),
        fontWeight: b.headingWeight,
        fontSize: size,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        height: H,
        overflow: "hidden",
        fontVariantNumeric: "tabular-nums",
        color: color ?? b.text,
      }}
    >
      {chars.map((c, i) => {
        const k = digitIdx.indexOf(i);
        if (k < 0) {
          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", height: H, whiteSpace: "pre" }}>
              {c}
            </span>
          );
        }
        const target = Number(c);
        const spins = n - k;
        const t0 = start + k * 3;
        const p = interpolate(frame, [t0, t0 + duration], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
        const pPrev = interpolate(frame - 1, [t0, t0 + duration], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
        const total = spins * 10 + target;
        const offs = (p * total) % 10;
        const vel = (p - pPrev) * total;
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", height: H, width: "0.62em" }}>
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                display: "flex",
                flexDirection: "column",
                transform: `translateY(${-offs * H}px)`,
                filter: vel > 0.15 ? `blur(${Math.min(6, vel * 3)}px)` : undefined,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                <span key={j} style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", width: "0.62em" }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
};
