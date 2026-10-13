import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { alpha, font, useTheme } from "../lib/theme";
import { clamp, LightSweep, useSpring } from "./fx";
import { Odometer, plain } from "./text";

/** Panneau verre (Liquid Glass) adapté au mode clair/sombre. */
export const Glass: React.FC<{ style?: React.CSSProperties; radius?: number; children?: React.ReactNode }> = ({ style, radius = 32, children }) => {
  const { dark } = useTheme();
  return (
    <div
      style={{
        position: "relative",
        borderRadius: radius,
        background: dark
          ? "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.7) 100%)",
        backdropFilter: "blur(26px) saturate(170%)",
        WebkitBackdropFilter: "blur(26px) saturate(170%)",
        boxShadow: dark
          ? "inset 0 1.5px 0 rgba(255,255,255,0.45), inset 0 0 0 1px rgba(255,255,255,0.14), 0 30px 80px rgba(0,0,0,0.45)"
          : "inset 0 1.5px 0 #fff, inset 0 0 0 1px rgba(255,255,255,0.9), 0 24px 60px rgba(40,20,80,0.16)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Pastille qui "pop" avec un point de couleur. */
export const Chip: React.FC<{ text: string; size: number; start: number; color?: string; style?: React.CSSProperties }> = ({ text, size, start, color, style }) => {
  const { b, dark } = useTheme();
  const s = useSpring(start, { damping: 10, stiffness: 220 });
  const c = color ?? b.primary;
  return (
    <div style={{ transform: `scale(${s})`, opacity: Math.min(1, s * 2), transformOrigin: "left center", ...style }}>
      <Glass radius={999} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45, padding: `${size * 0.42}px ${size * 0.8}px` }}>
        <div style={{ width: size * 0.55, height: size * 0.55, borderRadius: "50%", background: c, boxShadow: `0 0 ${size * 0.6}px ${c}` }} />
        <div style={{ fontFamily: font(b.body), fontWeight: 700, fontSize: size, color: dark ? "#fff" : b.text, whiteSpace: "nowrap" }}>{plain(text)}</div>
      </Glass>
    </div>
  );
};

/** Grande carte chiffre (odomètre + légende). */
export const StatCard: React.FC<{ value: string; label: string; size: number; start: number; style?: React.CSSProperties }> = ({ value, label, size, start, style }) => {
  const { b } = useTheme();
  const s = useSpring(start, { damping: 12, stiffness: 180 });
  return (
    <div style={{ transform: `scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * -6}deg)`, opacity: Math.min(1, s * 2), ...style }}>
      <Glass radius={size * 0.35} style={{ padding: `${size * 0.3}px ${size * 0.45}px` }}>
        <Odometer value={value} start={start + 4} size={size} color={b.primary} />
        <div style={{ fontFamily: font(b.body), fontWeight: 600, fontSize: size * 0.24, color: b.muted, marginTop: size * 0.05 }}>{label}</div>
        <LightSweep start={start + 30} duration={20} />
      </Glass>
    </div>
  );
};

/** Icône d'app arrondie. */
export const AppIcon: React.FC<{ size: number; style?: React.CSSProperties; glow?: boolean }> = ({ size, style, glow = true }) => {
  const { app, b, asset } = useTheme();
  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      {glow ? (
        <div style={{ position: "absolute", inset: -size * 0.3, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(b.primary, 0.55)} 0%, transparent 65%)` }} />
      ) : null}
      <Img
        src={staticFile(asset(app.icon))}
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: size * 0.225,
          display: "block",
          boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.2)`,
        }}
      />
      <div style={{ position: "absolute", inset: 0, borderRadius: size * 0.225, overflow: "hidden" }}>
        <LightSweep start={8} duration={24} />
      </div>
    </div>
  );
};

/** Pastille de numéro de feature ("01"). */
export const IndexBadge: React.FC<{ n: number; size: number; start: number }> = ({ n, size, start }) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 10], [0, 1], clamp);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.5,
        fontFamily: font(b.body),
        fontWeight: 800,
        fontSize: size,
        color: b.primary,
        letterSpacing: "0.12em",
        opacity: p,
        transform: `translateX(${(1 - p) * -30}px)`,
      }}
    >
      {String(n).padStart(2, "0")}
      <div style={{ width: size * 3 * p, height: Math.max(2, size * 0.12), background: `linear-gradient(90deg, ${b.primary}, transparent)`, borderRadius: 4 }} />
    </div>
  );
};
