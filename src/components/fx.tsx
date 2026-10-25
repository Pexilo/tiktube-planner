import React, { createContext, useContext } from "react";
import { AbsoluteFill, Audio, Easing, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, MONO, useTheme } from "../lib/theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const useSpring = (delay = 0, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 150, mass: 0.9, ...config } });
};

/* ------------------------------------------------------------------ SFX */

export type SfxName =
  | "whoosh" | "whoosh-fast" | "impact" | "hit" | "pop" | "click" | "riser" | "shimmer" | "swipe" | "ding" | "glitch" | "tick";

/** Bruitages "boom" retirés (hit, impact, glitch, tick) ; les autres sont joués plus doucement. */
const MUTED: SfxName[] = ["hit", "impact", "glitch", "tick"];
/** true = aucun bruitage dans ce sous-arbre (les stories crypto : voix + musique seulement). */
export const SfxMute = createContext(false);
export const Sfx: React.FC<{ name: SfxName; at?: number; volume?: number }> = ({ name, at = 0, volume = 0.8 }) =>
  useContext(SfxMute) || MUTED.includes(name) ? null : (
    <Sequence from={Math.round(at)} layout="none">
      <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume * 0.55} />
    </Sequence>
  );

/* ------------------------------------------------------------------ Fonds */

/** Fond de marque animé : aurora (dark) ou blush pastel (light). `seed` varie la composition par scène. */
export const Backdrop: React.FC<{ seed?: number; intensity?: number; grid?: boolean }> = ({ seed = 0, intensity = 1, grid = false }) => {
  const { b, W, H, dark } = useTheme();
  const frame = useCurrentFrame();
  const t = frame / 30;
  const m = Math.max(W, H);
  const r = (k: string) => random(`${seed}-${k}`);
  const blob = (color: string, i: number, s: number, o: number) => {
    const x = 0.15 + r(`x${i}`) * 0.7 + 0.08 * Math.sin(t * (0.35 + r(`sx${i}`) * 0.4) + i);
    const y = 0.1 + r(`y${i}`) * 0.8 + 0.07 * Math.cos(t * (0.3 + r(`sy${i}`) * 0.4) + i * 2);
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x * W - (s * m) / 2,
          top: y * H - (s * m) / 2,
          width: s * m,
          height: s * m,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color} 0%, transparent 62%)`,
          opacity: o * intensity,
        }}
      />
    );
  };
  if (b.backdrop === "ledger") return <Ledger seed={seed} intensity={intensity} />;
  return (
    <AbsoluteFill style={{ background: b.bg, overflow: "hidden" }}>
      {dark ? (
        <>
          {blob(b.bg2, 0, 1.3, 0.9)}
          {blob(b.primary, 1, 0.95, 0.55)}
          {blob(b.secondary, 2, 0.8, 0.4)}
          {blob(b.accent, 3, 0.55, 0.18)}
        </>
      ) : (
        <>
          {blob(b.bg2, 0, 1.2, 1)}
          {blob(alpha(b.primary, 0.55), 1, 0.9, 0.45)}
          {blob(alpha(b.secondary, 0.6), 2, 0.8, 0.4)}
          {blob(alpha(b.accent, 0.5), 3, 0.5, 0.25)}
        </>
      )}
      {grid ? <PerspectiveGrid /> : null}
      <Grain opacity={dark ? 0.07 : 0.05} />
      <Vignette strength={dark ? 0.55 : 0.12} />
    </AbsoluteFill>
  );
};

/** Fond "registre" (identité du site) : papier ligné sombre, marge rose en pointillés, bandeau mono qui défile. */
const Ledger: React.FC<{ seed: number; intensity: number }> = ({ seed, intensity }) => {
  const { app, b, u, W, H, isShort, t } = useTheme();
  const frame = useCurrentFrame();
  const rule = 64 * u;
  const tape = `${t(app.tape) || app.name} · `.repeat(12);
  const tapeH = 46 * u;
  const glowX = 0.3 + 0.4 * random(`lg${seed}`) + 0.05 * Math.sin(frame / 50);
  return (
    <AbsoluteFill style={{ background: b.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: glowX * W - 0.6 * H, top: 0.1 * H, width: 1.2 * H, height: 1.2 * H, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(b.primary, 0.16 * intensity)} 0%, transparent 60%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${alpha(b.text, 0.05)} ${Math.max(1, 1.5 * u)}px, transparent ${Math.max(1, 1.5 * u)}px)`,
          backgroundSize: `100% ${rule}px`,
          backgroundPosition: `0 ${(frame * 0.6 * u) % rule}px`,
        }}
      />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: (isShort ? 36 : 70) * u, borderLeft: `${3 * u}px dashed ${alpha(b.primary, 0.55)}` }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: (isShort ? 36 : 70) * u, borderLeft: `${3 * u}px dashed ${alpha(b.primary, 0.25)}` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: tapeH, background: b.primary, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 700, fontSize: 20 * u, letterSpacing: "0.14em", textTransform: "uppercase", color: b.bg, transform: `translateX(${-((frame * 3 * u) % (W * 2))}px)` }}>{tape}</div>
      </div>
      <Grain opacity={0.06} />
      <Vignette strength={0.45} />
    </AbsoluteFill>
  );
};

export const PerspectiveGrid: React.FC = () => {
  const { b, dark } = useTheme();
  const frame = useCurrentFrame();
  const off = (frame * 2.2) % 80;
  return (
    <AbsoluteFill style={{ perspective: 900, overflow: "hidden", opacity: dark ? 0.35 : 0.18 }}>
      <div
        style={{
          position: "absolute",
          left: "-50%",
          right: "-50%",
          top: "55%",
          height: "120%",
          transform: "rotateX(72deg)",
          transformOrigin: "top center",
          backgroundImage: `linear-gradient(${alpha(b.primary, 0.8)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(b.primary, 0.8)} 2px, transparent 2px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `0 ${off}px`,
          maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
};

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  const x = Math.floor(random(`gx${frame}`) * 512);
  const y = Math.floor(random(`gy${frame}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("fx/noise.png")})`,
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: "512px 512px",
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 85% 75% at 50% 50%, transparent 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Énorme texte en contour qui défile derrière (motion design "poster"). */
export const Marquee: React.FC<{ text: string; y: number; speed?: number; size: number; opacity?: number; reverse?: boolean }> = ({
  text,
  y,
  speed = 6,
  size,
  opacity = 0.12,
  reverse,
}) => {
  const { b, dark } = useTheme();
  const frame = useCurrentFrame();
  const x = ((reverse ? 1 : -1) * frame * speed) % 4000;
  const s = `${text} • `.repeat(8);
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        whiteSpace: "nowrap",
        transform: `translateX(${x - (reverse ? 4000 : 0)}px)`,
        fontFamily: `var(--heading)`,
        fontWeight: b.headingWeight,
        fontSize: size,
        lineHeight: 1,
        color: "transparent",
        WebkitTextStroke: `${Math.max(2, size / 60)}px ${dark ? "rgba(255,255,255,0.9)" : alpha(b.primary, 0.9)}`,
        opacity,
        textTransform: b.uppercase ? "uppercase" : undefined,
        letterSpacing: "-0.02em",
      }}
    >
      {s}
    </div>
  );
};

/* ------------------------------------------------------------------ Impacts */

/** Flash radial sur un impact. */
export const Flash: React.FC<{ at: number; strength?: number; color?: string }> = () => null; // plus de flash (confort visuel)

/** Secousse de caméra qui décroît après chaque frappe. */
export const useShake = (_hits: number[], _amp = 18, _decay = 7) => "none"; // plus de secousse caméra

/** Anneaux qui se propagent (impact du logo, CTA). */
export const Rings: React.FC<{ at: number; size: number; color?: string; count?: number }> = ({ at, size, color, count = 3 }) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const p = interpolate(frame, [at + i * 6, at + i * 6 + 36], [0, 1], { ...clamp, easing: EASE_OUT });
        if (p <= 0 || p >= 1) return null;
        const s = size * (0.6 + p * 1.6);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: s,
              height: s,
              marginLeft: -s / 2,
              marginTop: -s / 2,
              borderRadius: "50%",
              border: `${Math.max(2, size * 0.02 * (1 - p))}px solid ${color ?? b.primary}`,
              opacity: (1 - p) * 0.8,
            }}
          />
        );
      })}
    </>
  );
};

/** Explosion de particules radiale. */
export const Burst: React.FC<{ at: number; radius: number; count?: number; colors?: string[] }> = () => null; // plus d'explosion de particules

/** Balayage lumineux diagonal. */
export const LightSweep: React.FC<{ start: number; duration?: number; radius?: number | string; opacity?: number }> = ({
  start,
  duration = 22,
  radius = 0,
  opacity = 0.7,
}) => {
  const frame = useCurrentFrame();
  if (frame < start || frame > start + duration) return null;
  const p = interpolate(frame, [start, start + duration], [-0.6, 1.6], { ...clamp, easing: EASE_IN_OUT });
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "-50%",
          bottom: "-50%",
          width: "45%",
          left: `${p * 100}%`,
          transform: "rotate(20deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
          mixBlendMode: "screen",
          opacity,
          filter: "blur(6px)",
        }}
      />
    </div>
  );
};

/** Enveloppe de scène : entrée "punch" (zoom + flou) et sortie rapide, légère poussée caméra. */
export const SceneWrap: React.FC<{ dur: number; children: React.ReactNode; push?: number; enter?: boolean; exit?: boolean }> = ({
  dur,
  children,
  push = 0.04,
  enter = true,
  exit = true,
}) => {
  const frame = useCurrentFrame();
  // Entrée cinématique : la scène monte, se met au point et s'agrandit (sans flash ni coupe sèche).
  const inP = enter ? interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: EASE_OUT }) : 1;
  const outP = exit ? interpolate(frame, [dur - 10, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }) : 0;
  const scale = (1 + push * (frame / dur)) * (0.94 + 0.06 * inP) * (1 - outP * 0.03);
  const blur = (1 - inP) * 12 + outP * 10;
  return (
    <AbsoluteFill
      style={{
        transform: `translateY(${(1 - inP) * 7}%) scale(${scale})`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        opacity: (0.3 + 0.7 * inP) * (1 - 0.6 * outP), // pas de passage au noir entre les scènes
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
