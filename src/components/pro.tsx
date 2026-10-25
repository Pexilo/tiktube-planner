// Couche "motion designer pro" : transitions de marque, profondeur (bokeh, particules),
// habillage éditorial (HUD mono), lens flare, badges de stores.
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { alpha, font, MONO, useTheme } from "../lib/theme";
import { clamp, EASE_IN_OUT, EASE_OUT } from "./fx";

/* ------------------------------------------------------------------ Transitions */

export type TransitionType = "bars" | "iris" | "slice" | "streak";
export const TRANSITION_LEN = 16; // la coupe tombe au milieu (frame 8)
const CALM_TRANSITIONS = true;

/** Recouvre la coupe entre deux scènes avec un motif de marque (8 frames d'entrée, 8 de sortie). */
export const Transition: React.FC<{ type: TransitionType }> = ({ type }) => {
  if (CALM_TRANSITIONS) return null; // les scènes glissent d'elles-mêmes (SceneWrap)
  const { b, W, H, dark } = useTheme();
  const frame = useCurrentFrame();
  const half = TRANSITION_LEN / 2;
  const inP = (d = 0) => interpolate(frame, [d, half + d * 0.5], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const outP = (d = 0) => interpolate(frame, [half + d * 0.5, TRANSITION_LEN + d], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const diag = Math.hypot(W, H);
  const cols = [b.primary, b.secondary, b.accent, dark ? b.bg2 : b.text];

  if (type === "bars") {
    return (
      <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: diag * 1.2, height: diag * 1.2, marginLeft: -diag * 0.6, marginTop: -diag * 0.6, transform: "rotate(-18deg)", display: "flex", flexDirection: "column" }}>
          {cols.map((c, i) => {
            const x = frame < half ? -1 + inP(i * 0.8) : outP(i * 0.8);
            return <div key={i} style={{ flex: 1, background: c, transform: `translateX(${x * 105}%)` }} />;
          })}
        </div>
      </AbsoluteFill>
    );
  }
  if (type === "iris") {
    const grow = inP() * diag * 0.6;
    const hole = outP() * diag * 0.62;
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            frame < half
              ? `radial-gradient(circle at 50% 50%, ${b.primary} ${grow}px, transparent ${grow + 1}px)`
              : `radial-gradient(circle at 50% 50%, transparent ${hole}px, ${b.primary} ${hole + 1}px, ${b.primary} ${hole + 40}px, ${b.secondary} ${hole + 41}px)`,
        }}
      />
    );
  }
  if (type === "slice") {
    const panel = (i: number) => {
      const dir = i % 2 ? 1 : -1;
      const x = frame < half ? dir * (1 - inP(i)) : -dir * outP(i);
      return <div key={i} style={{ flex: 1, background: cols[i % 2], transform: `translateX(${x * 102}%)` }} />;
    };
    return <AbsoluteFill style={{ pointerEvents: "none", display: "flex", flexDirection: "column" }}>{[0, 1, 2].map(panel)}</AbsoluteFill>;
  }
  // streak : flash + traînées horizontales (whip pan)
  const f = interpolate(frame, [half - 3, half, half + 5], [0, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const y = random(`sy${i}`) * H;
        const h = 2 + random(`sh${i}`) * 10;
        const p = interpolate(frame, [i * 0.4, TRANSITION_LEN], [-1.2, 1.2], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y,
              left: p * W,
              width: W * (0.5 + random(`sw${i}`)),
              height: h,
              borderRadius: h,
              background: `linear-gradient(90deg, transparent, ${i % 3 ? "#fff" : b.primary}, transparent)`,
              filter: "blur(2px)",
              opacity: 0.8,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: "#fff", opacity: f * 0.55 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Profondeur */

/** Formes floues au premier plan (bokeh) qui dérivent en parallaxe. */
export const Bokeh: React.FC<{ seed?: number; count?: number; opacity?: number }> = ({ seed = 0, count = 6, opacity = 0.35 }) => {
  const { b, W, H, u } = useTheme();
  const frame = useCurrentFrame();
  if (b.backdrop === "ledger") return null; // style net du registre : pas de halos flous
  const cols = [b.primary, b.secondary, b.accent];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`bk${seed}-${i}-${k}`);
        const size = (120 + r("s") * 260) * u;
        const speed = 0.4 + r("v") * 1.2;
        const x = (r("x") * 1.2 - 0.1) * W + Math.sin(frame / (40 + i * 7)) * 30 * u - frame * speed * u;
        const y = (r("y") * 1.2 - 0.1) * H + Math.cos(frame / (50 + i * 5)) * 40 * u;
        const square = r("q") > 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ((x % (W + size)) + W + size) % (W + size) - size,
              top: y,
              width: size,
              height: size,
              borderRadius: square ? size * 0.28 : "50%",
              background: `radial-gradient(circle at 35% 30%, ${alpha(cols[i % 3], 0.9)}, ${alpha(cols[i % 3], 0.2)} 70%)`,
              filter: `blur(${(18 + r("b") * 26) * u}px)`,
              opacity: opacity * (0.5 + r("o") * 0.5),
              transform: `rotate(${frame * 0.3 + r("r") * 90}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Poussière lumineuse qui monte doucement et scintille. */
export const Particles: React.FC<{ count?: number; seed?: number }> = ({ count = 26, seed = 0 }) => {
  const { b, W, H, u, dark } = useTheme();
  const frame = useCurrentFrame();
  if (b.backdrop === "ledger") return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`pt${seed}-${i}-${k}`);
        const s = (3 + r("s") * 6) * u;
        const y = (((r("y") * H - frame * (0.6 + r("v") * 1.6) * u) % H) + H) % H;
        const tw = 0.55 + 0.15 * Math.sin(frame / 40 + i); // lueur douce, sans scintillement
        const c = dark ? (i % 4 === 0 ? b.accent : "#ffffff") : i % 2 ? b.primary : b.secondary;
        return (
          <div
            key={i}
            style={{ position: "absolute", left: r("x") * W, top: y, width: s, height: s, borderRadius: "50%", background: c, opacity: tw * (dark ? 0.7 : 0.45), boxShadow: `0 0 ${s * 3}px ${c}` }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Lens flare horizontal (ligne lumineuse + halo) au moment d'un impact. */
export const Flare: React.FC<{ at: number; y?: string }> = ({ at, y = "50%" }) => {
  if (CALM_TRANSITIONS) return null;
  const { b, W } = useTheme();
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 6, at + 26], [0, 1, 0], clamp);
  if (p <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <div style={{ position: "absolute", top: y, left: 0, width: W, height: 3, marginTop: -1.5, background: `linear-gradient(90deg, transparent, ${b.secondary}, #fff, ${b.primary}, transparent)`, transform: `scaleX(${0.2 + p})`, opacity: p, filter: "blur(1px)" }} />
      <div style={{ position: "absolute", top: y, left: "50%", width: W * 0.5, height: W * 0.5, marginLeft: -W * 0.25, marginTop: -W * 0.25, borderRadius: "50%", background: `radial-gradient(circle, ${alpha("#ffffff", 0.55)}, ${alpha(b.primary, 0.15)} 35%, transparent 60%)`, opacity: p }} />
    </AbsoluteFill>
  );
};

/** Fuite de lumière chaude qui traverse l'image (look pellicule). */
export const LightLeak: React.FC<{ start?: number; dur?: number }> = ({ start = 0, dur = 50 }) => {
  if (CALM_TRANSITIONS) return null;
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + dur], [0, 1], clamp);
  const o = Math.sin(p * Math.PI) * 0.45;
  if (o <= 0.01) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: o,
        background: `radial-gradient(60% 50% at ${-20 + p * 140}% ${30 + p * 20}%, ${alpha(b.accent, 0.9)}, ${alpha(b.secondary, 0.4)} 40%, transparent 70%)`,
      }}
    />
  );
};

/* ------------------------------------------------------------------ Habillage éditorial */

/** Repères de cadre + labels mono + barre de progression rythmée. */
export const HUD: React.FC<{ section: string; counter?: string; progress: number; beatFrame: number }> = ({ section, counter, progress, beatFrame }) => {
  const { app, b, u, isShort, dark } = useTheme();
  const frame = useCurrentFrame();
  const ink = dark ? "rgba(255,255,255,0.72)" : alpha(b.text, 0.6);
  const m = (isShort ? 60 : 56) * u;
  const top = (isShort ? 190 : 44) * u;
  const L = 34 * u;
  const corner = (pos: React.CSSProperties, rot: number) => (
    <div style={{ position: "absolute", width: L, height: L, borderTop: `${2 * u}px solid ${ink}`, borderLeft: `${2 * u}px solid ${ink}`, transform: `rotate(${rot}deg)`, opacity: 0.55, ...pos }} />
  );
  const pulse = 0 * beatFrame; // plus de pulsation sur le temps
  const label: React.CSSProperties = { fontFamily: MONO, fontSize: 19 * u, letterSpacing: "0.14em", textTransform: "uppercase", color: ink, fontWeight: 500 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {!isShort ? (
        <>
          {corner({ left: m * 0.6, top: m * 0.6 }, 0)}
          {corner({ right: m * 0.6, top: m * 0.6 }, 90)}
          {corner({ right: m * 0.6, bottom: m * 0.6 }, 180)}
          {corner({ left: m * 0.6, bottom: m * 0.6 }, 270)}
        </>
      ) : null}
      <div style={{ position: "absolute", top, left: m + (isShort ? 0 : 20 * u), display: "flex", alignItems: "center", gap: 14 * u }}>
        <div style={{ width: 10 * u, height: 10 * u, borderRadius: "50%", background: b.primary, boxShadow: `0 0 ${12 * u * (0.5 + pulse)}px ${b.primary}`, transform: `scale(${1 + pulse * 0.4})` }} />
        <div style={{ ...label, fontFamily: font(b.heading), fontWeight: b.headingWeight, letterSpacing: "0.02em", fontSize: 22 * u, color: dark ? "#fff" : b.text, textTransform: b.uppercase ? "uppercase" : "none" }}>{app.name}</div>
        <div style={{ ...label, opacity: 0.8 }}>/ {section}</div>
      </div>
      {counter ? <div style={{ position: "absolute", top, right: m + (isShort ? 0 : 20 * u), ...label }}>{counter}</div> : null}
      <div style={{ position: "absolute", left: m + 20 * u, right: m + 20 * u, [isShort ? "top" : "bottom"]: isShort ? top + 44 * u : 52 * u, height: 3 * u, background: dark ? "rgba(255,255,255,0.12)" : alpha(b.text, 0.1), borderRadius: 4 }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: `linear-gradient(90deg, ${b.primary}, ${b.secondary})`, borderRadius: 4 }} />
        <div style={{ position: "absolute", left: `${progress * 100}%`, top: -4 * u, width: 11 * u, height: 11 * u, marginLeft: -5.5 * u, borderRadius: "50%", background: "#fff", boxShadow: `0 0 ${10 * u}px ${b.primary}`, transform: `scale(${1 + pulse * 0.5})` }} />
      </div>
      {!isShort ? (
        <div style={{ position: "absolute", bottom: 70 * u, right: m + 20 * u, ...label, fontSize: 16 * u, opacity: 0.7 }}>
          {app.url} · {String(Math.floor(frame / 30 / 60)).padStart(2, "0")}:{String(Math.floor(frame / 30) % 60).padStart(2, "0")}:{String(frame % 30).padStart(2, "0")}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Badges de stores */

const APPLE = "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";
const PLAY = "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z";

type Badge = { key: string; icon: "apple" | "play" | "watch" | "globe" | "mac"; small: string; big: string };

export const storeBadges = (platforms: string[], lang: "fr" | "en"): Badge[] => {
  const fr = lang === "fr";
  const out: Badge[] = [];
  const has = (p: string) => platforms.includes(p);
  if (has("iPhone") || has("iPad") || has("Apple Watch")) out.push({ key: "ios", icon: "apple", small: fr ? "Télécharger dans" : "Download on the", big: "App Store" });
  if (has("Mac")) out.push({ key: "mac", icon: "mac", small: fr ? "Télécharger pour" : "Download for", big: "Mac" });
  if (has("Android")) out.push({ key: "play", icon: "play", small: fr ? "Disponible sur" : "Get it on", big: "Google Play" });
  if (has("Garmin")) out.push({ key: "garmin", icon: "watch", small: fr ? "Disponible sur" : "Available on", big: "Connect IQ" });
  if (has("Web")) out.push({ key: "web", icon: "globe", small: fr ? "Gratuit sur" : "Free on", big: fr ? "le web" : "the web" });
  return out;
};

export const StoreBadge: React.FC<{ badge: Badge; h: number }> = ({ badge, h }) => {
  const icon =
    badge.icon === "apple" || badge.icon === "mac" ? (
      <svg viewBox="0 0 24 24" width={h * 0.5} height={h * 0.5} fill="#fff"><path d={APPLE} /></svg>
    ) : badge.icon === "play" ? (
      <svg viewBox="0 0 24 24" width={h * 0.46} height={h * 0.46}>
        <defs>
          <linearGradient id="gp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00D7FE" /><stop offset=".5" stopColor="#FFCE00" /><stop offset="1" stopColor="#FF3A44" /></linearGradient>
        </defs>
        <path d={PLAY} fill="url(#gp)" />
      </svg>
    ) : (
      <div style={{ fontSize: h * 0.42, lineHeight: 1 }}>{badge.icon === "watch" ? "⌚" : "🌐"}</div>
    );
  return (
    <div style={{ height: h, display: "inline-flex", alignItems: "center", gap: h * 0.18, padding: `0 ${h * 0.34}px 0 ${h * 0.26}px`, borderRadius: h * 0.22, background: "#000", border: `${Math.max(1, h / 45)}px solid #a6a6a6`, boxShadow: `0 ${h * 0.15}px ${h * 0.4}px rgba(0,0,0,0.3)` }}>
      {icon}
      <div style={{ display: "flex", flexDirection: "column", color: "#fff", fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif", lineHeight: 1.05 }}>
        <span style={{ fontSize: h * 0.2, fontWeight: 500, whiteSpace: "nowrap" }}>{badge.small}</span>
        <span style={{ fontSize: h * 0.4, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{badge.big}</span>
      </div>
    </div>
  );
};

/** Ombre portée au sol sous un appareil (ancre la 3D). */
export const FloorShadow: React.FC<{ width: number; y: number | string; opacity?: number }> = ({ width, y, opacity = 0.45 }) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: y,
      width,
      height: width * 0.14,
      marginLeft: -width / 2,
      borderRadius: "50%",
      background: `radial-gradient(ellipse at center, rgba(0,0,0,${opacity}) 0%, transparent 70%)`,
      filter: "blur(10px)",
    }}
  />
);

/** Petite étiquette mono "FEATURE 01 / 03". */
export const MonoTag: React.FC<{ text: string; size: number; start: number; color?: string }> = ({ text, size, start, color }) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const n = Math.floor(interpolate(frame, [start, start + text.length * 0.8], [0, text.length], clamp));
  const p = interpolate(frame, [start, start + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.7, fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.18em", color: color ?? b.primary, textTransform: "uppercase", opacity: p }}>
      <span style={{ display: "inline-block", width: size * 2.4 * p, height: Math.max(2, size * 0.12), background: color ?? b.primary }} />
      {text.slice(0, n)}
      <span style={{ opacity: n < text.length || Math.floor(frame / 8) % 2 ? 1 : 0 }}>▍</span>
    </div>
  );
};
