import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, EASE_OUT, Sfx } from "../../components/fx";
import { tokenize } from "../../components/text";
import { Count } from "../../components/widgets";
import { CYAN, GREY, INK, LIME, monoStyle, PAPER, PINK, useEnter } from "./core";

/*
 * Objets schématiques : pictos, personnages, wallets, coupures de presse, tampons, compteurs, titres.
 * Chaque objet est centré sur (x, y) dans le repère du parent et apparaît à la frame `at` (avec un petit son discret).
 */

/** Pictos 24 × 24 au trait (encre). */
const ICONS = {
  key: "M8 15m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M11 12L21 2M17 6l3 3M15 8l2 2",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.8-1",
  laptop: "M4 5h16v11H4zM2 19h20",
  harddrive: "M3 6h18v12H3zM16 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 15h4",
  phone: "M7 2h10v20H7zM11 18h2",
  document: "M6 2h8l5 5v15H6zM14 2v5h5M9 12h7M9 16h7",
  trash: "M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15",
  truck: "M2 7h12v9H2zM14 10h4l3 3v3h-7M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  search: "M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M15 15l6 6",
  warning: "M12 3L22 20H2zM12 9v5M12 17v.5",
  skull: "M12 3a8 8 0 0 0-8 8c0 3 2 4 3 5v3h10v-3c1-1 3-2 3-5a8 8 0 0 0-8-8zM9 11m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M15 11m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M10 19v-2M14 19v-2",
  fire: "M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6c0 3 1 4 2 4c0-4-1-7 1-10z",
  rocket: "M12 2c4 3 5 8 4 13H8c-1-5 0-10 4-13zM12 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 15l-3 4h4M16 15l3 4h-4",
  bank: "M3 9L12 3l9 6zM5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18",
  building: "M5 3h14v18H5zM9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2",
  server: "M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.5M7 16.5h.5",
  chartDown: "M3 3v18h18M6 8l4 4 3-3 6 7M15 16h4v-4",
  chartUp: "M3 3v18h18M6 16l4-4 3 3 6-7M15 8h4v4",
  clock: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 3",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  globe: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18M3 12h18",
  link: "M10 14a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1.5 1.5M14 10a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1.5-1.5",
  shield: "M12 2l8 3v6c0 5-3.5 9-8 11c-4.5-2-8-6-8-11V5z",
  gavel: "M14 3l7 7M10 7l7 7M12 5l-4 4 7 7 4-4M8 13l-6 6",
  person: "M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21c0-5 4-8 8-8s8 3 8 8",
  wallet: "M3 6h18v13H3zM16 12h5v4h-5a2 2 0 0 1 0-4zM5 6l11-3v3",
  bubble: "M4 4h16v11h-9l-5 4v-4H4z",
  dollar: "M12 2v20M17 6c-1-2-3-2.5-5-2.5c-3 0-5 1.5-5 3.5c0 5 10 3 10 8.5c0 2-2 3.5-5 3.5c-2.5 0-4.5-1-5.5-3",
  eye: "M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  question: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 16.5v.5",
  pizza: "M12 21L3 5c5-3 13-3 18 0zM10 9m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M14.5 10m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M12 14m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0",
  plane: "M2 13l20-8-6 16-4-6zM12 15l10-10",
  crown: "M3 18h18M4 16L3 7l5 4 4-6 4 6 5-4-1 9z",
  qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM6 6h1M17 6h1M6 17h1",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  bomb: "M10 14m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M15 9l3-3M18 6l2-1M19 3v1M21 5h-1",
  check: "M4 12l5 5L20 6",
  cross: "M5 5l14 14M19 5L5 19",
  arrowRight: "M3 12h18M14 5l7 7-7 7",
} as const;
export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Picto au trait. `fill` remplit la forme (sous le trait), `box` le pose sur une pastille papier bordée. */
export const Icon: React.FC<{ name: IconName; x?: number; y?: number; at?: number; size?: number; color?: string; fill?: string; box?: string; rot?: number }> = ({
  name,
  x,
  y,
  at = 0,
  size = 120,
  color = INK,
  fill = "none",
  box,
  rot = 0,
}) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 11, stiffness: 240, mass: 0.7 });
  if (frame < at) return null;
  const svg = (
    <svg viewBox="0 0 24 24" width={box ? size * 0.62 : size} height={box ? size * 0.62 : size} style={{ overflow: "visible" }}>
      <path d={ICONS[name]} fill={fill} stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const body = box ? (
    <div style={{ width: size, height: size, background: box, border: `5px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, display: "grid", placeItems: "center" }}>{svg}</div>
  ) : (
    svg
  );
  return (
    <div style={{ position: x === undefined ? "relative" : "absolute", left: x, top: y, transform: `${x === undefined ? "" : "translate(-50%, -50%) "}scale(${0.3 + 0.7 * p}) rotate(${rot + (1 - p) * -14}deg)`, opacity: Math.min(1, p * 2) }}>
      {body}
      <Sfx name="pop" at={at} volume={0.25} />
    </div>
  );
};

export type ActorKind = "person" | "hacker" | "suit" | "cop" | "dev" | "crowd";

/**
 * Personnage schématique (≈ 160 × 220 à size = 1) avec étiquette dessous, bulle optionnelle (`say` à partir de `sayAt`)
 * et picto tenu (`hold`). `color` = couleur du corps. `alert` affiche un "!" au-dessus de la tête.
 */
export const Actor: React.FC<{
  x: number;
  y: number;
  at?: number;
  kind?: ActorKind;
  label?: string;
  color?: string;
  size?: number;
  say?: string;
  sayAt?: number;
  hold?: IconName;
  alert?: number;
  flip?: boolean;
}> = ({ x, y, at = 0, kind = "person", label, color = CYAN, size = 1, say, sayAt, hold, alert, flip }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 12, stiffness: 200 });
  if (frame < at) return null;
  const bob = Math.sin((frame - at) / 14) * 3;
  const w = 160 * size;
  const h = 220 * size;
  const fig = (dx: number, s: number, c: string, k: ActorKind) => <Figure key={dx} dx={dx} s={s} c={c} kind={k} />;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `translate(-50%, -50%) translateY(${(1 - p) * 80 + bob}px) scaleX(${flip ? -1 : 1})`, opacity: Math.min(1, p * 2) }}>
      <svg viewBox="0 0 160 220" width={w} height={h} style={{ overflow: "visible" }}>
        {kind === "crowd" ? [fig(-46, 0.78, LIME, "person"), fig(46, 0.78, PINK, "person"), fig(0, 0.9, color, "person")] : fig(0, 1, color, kind)}
      </svg>
      {hold ? (
        <div style={{ position: "absolute", right: -w * 0.28, top: h * 0.42, transform: `scaleX(${flip ? -1 : 1})` }}>
          <Icon name={hold} at={at + 6} size={86 * size} box={PAPER} />
        </div>
      ) : null}
      {alert !== undefined && frame >= alert ? (
        <div style={{ position: "absolute", left: "50%", top: -60 * size, transform: `translateX(-50%) scale(${interpolate(frame, [alert, alert + 6], [0.2, 1], clamp)})`, fontFamily: "var(--heading)", fontWeight: 800, fontSize: 90 * size, color: PINK, WebkitTextStroke: `4px ${INK}`, paintOrder: "stroke fill" }}>!</div>
      ) : null}
      {label ? (
        <div style={{ position: "absolute", left: "50%", top: h + 6, transform: `translateX(-50%) scaleX(${flip ? -1 : 1})`, ...monoStyle(14, INK), background: PAPER, border: `3px solid ${INK}`, padding: "4px 10px" }}>{label}</div>
      ) : null}
      {say && sayAt !== undefined && frame >= sayAt ? (
        <div style={{ position: "absolute", left: "50%", bottom: h + 20, transform: `scaleX(${flip ? -1 : 1})` }}>
          <Bubble at={sayAt} text={say} />
        </div>
      ) : null}
    </div>
  );
};

const Figure: React.FC<{ dx: number; s: number; c: string; kind: ActorKind }> = ({ dx, s, c, kind }) => {
  const sw = 6;
  const tf = `translate(${80 + dx} 220) scale(${s}) translate(-80 -220)`;
  return (
    <g transform={tf}>
      {kind === "hacker" ? (
        <>
          <path d="M80 18c-34 0-52 26-52 62v14h104V80c0-36-18-62-52-62z" fill={INK} stroke={INK} strokeWidth={sw} />
          <ellipse cx={80} cy={78} rx={24} ry={28} fill="#24242a" />
          <path d="M68 74h8M84 74h8" stroke={LIME} strokeWidth={5} strokeLinecap="round" />
          <path d="M22 216c0-62 22-104 58-104s58 42 58 104z" fill={INK} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M22 216c0-62 22-104 58-104s58 42 58 104z" fill={c} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <circle cx={80} cy={66} r={38} fill={PAPER} stroke={INK} strokeWidth={sw} />
          <path d="M66 62h.5M94 62h.5" stroke={INK} strokeWidth={8} strokeLinecap="round" />
          {kind === "suit" ? <path d="M80 112l-10 18 10 50 10-50z" fill={PINK} stroke={INK} strokeWidth={4} strokeLinejoin="round" /> : null}
          {kind === "cop" ? <path d="M40 46h80l-6-20H46zM34 46h92" fill={INK} stroke={INK} strokeWidth={sw} strokeLinejoin="round" /> : null}
          {kind === "dev" ? <path d="M42 150h76v46H42zM34 200h92" fill={PAPER} stroke={INK} strokeWidth={sw} strokeLinejoin="round" /> : null}
        </>
      )}
    </g>
  );
};

/** Bulle de dialogue (ancrée en bas au centre). */
export const Bubble: React.FC<{ at: number; text: string; color?: string; width?: number }> = ({ at, text, color = PAPER, width = 420 }) => {
  const p = useEnter(at, { damping: 11, stiffness: 260 });
  return (
    <div style={{ transform: `translateX(-50%) scale(${0.4 + 0.6 * p})`, transformOrigin: "50% 100%", opacity: Math.min(1, p * 2), width: "max-content", maxWidth: width }}>
      <div style={{ background: color, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, padding: "14px 20px", fontFamily: "var(--body)", fontWeight: 700, fontSize: 34, lineHeight: 1.15, color: INK }}>{text}</div>
      <svg width={40} height={30} style={{ position: "absolute", left: "50%", marginLeft: -20, bottom: -26, overflow: "visible" }}>
        <path d="M4 0L20 26L32 0" fill={color} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/**
 * Wallet façon fiche du registre : adresse mono, solde qui défile, tampon d'état optionnel (`status` à `statusAt`).
 * `tone` "ink" = fiche sombre (wallet suspect / hacker).
 */
export const Wallet: React.FC<{
  x: number;
  y: number;
  at?: number;
  label?: string;
  address: string;
  balance?: string;
  w?: number;
  tone?: "paper" | "ink";
  status?: string;
  statusAt?: number;
  statusColor?: string;
}> = ({ x, y, at = 0, label = "WALLET", address, balance, w = 440, tone = "paper", status, statusAt, statusColor = PINK }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 14, stiffness: 170 });
  if (frame < at) return null;
  const dark = tone === "ink";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translate(-50%, -50%) translateY(${(1 - p) * 90}px) rotate(${(1 - p) * -6}deg)`, opacity: Math.min(1, p * 2.4) }}>
      <div style={{ background: dark ? INK : PAPER, border: `5px solid ${dark ? PAPER : INK}`, boxShadow: `10px 10px 0 ${dark ? PINK : INK}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: dark ? PAPER : INK, padding: "8px 14px" }}>
          <span style={{ ...monoStyle(13, INK), background: dark ? PINK : LIME, padding: "3px 8px" }}>{label}</span>
        </div>
        <div style={{ padding: "16px 20px 20px" }}>
          <div style={{ ...monoStyle(17, dark ? PAPER : INK), textTransform: "none", letterSpacing: "0.02em" }}>{address}</div>
          {balance ? (
            <div style={{ marginTop: 10, fontFamily: "var(--heading)", fontWeight: 800, fontSize: 76, letterSpacing: "-0.04em", lineHeight: 1, color: dark ? PAPER : INK }}>
              <Count value={balance} start={at + 8} dur={30} />
            </div>
          ) : null}
        </div>
      </div>
      {status && statusAt !== undefined ? (
        <div style={{ position: "absolute", right: -30, bottom: -26 }}>
          <Stamp at={statusAt} text={status} color={statusColor} size={34} />
        </div>
      ) : null}
    </div>
  );
};

/** Coupure de presse (bord déchiré) : média + date en mono, titre en gras. */
export const Headline: React.FC<{ x: number; y: number; at?: number; outlet: string; date?: string; text: string; w?: number; rot?: number }> = ({
  x,
  y,
  at = 0,
  outlet,
  date,
  text,
  w = 760,
  rot = -2.5,
}) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 13, stiffness: 160 });
  if (frame < at) return null;
  const jag = Array.from({ length: 21 }, (_, i) => `${(i / 20) * 100}% ${i % 2 ? 100 : 97}%`).join(", ");
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translate(-50%, -50%) translateY(${(1 - p) * -120}px) rotate(${rot + (1 - p) * 8}deg)`, opacity: Math.min(1, p * 2.4), filter: `drop-shadow(10px 10px 0 ${INK})` }}>
      <div style={{ background: "#F7F3E8", padding: "22px 28px 40px", clipPath: `polygon(0 0, 100% 0, ${jag}, 0 100%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `3px solid ${INK}`, paddingBottom: 8 }}>
          <span style={{ fontFamily: "var(--heading)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", color: INK, textTransform: "uppercase" }}>{outlet}</span>
          {date ? <span style={monoStyle(13, GREY)}>{date}</span> : null}
        </div>
        <div style={{ marginTop: 14, fontFamily: "var(--heading)", fontWeight: 800, fontSize: 54, lineHeight: 1.02, letterSpacing: "-0.035em", color: INK }}>{text}</div>
      </div>
      <Sfx name="swipe" at={at} volume={0.4} />
    </div>
  );
};

/** Tampon encreur qui claque (grossit puis s'écrase). Positionné en (x, y) si fournis, sinon en flux. */
export const Stamp: React.FC<{ at: number; text: string; x?: number; y?: number; color?: string; size?: number; rot?: number }> = ({ at, text, x, y, color = PINK, size = 48, rot = -8 }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 11, stiffness: 320, mass: 0.6 });
  if (frame < at) return null;
  return (
    <div
      style={{
        position: x === undefined ? "relative" : "absolute",
        left: x,
        top: y,
        display: "inline-block",
        transform: `${x === undefined ? "" : "translate(-50%, -50%) "}scale(${2.2 - 1.2 * p}) rotate(${rot * p}deg)`,
        opacity: Math.min(1, (frame - at) / 2),
        fontFamily: "var(--heading)",
        fontWeight: 800,
        fontSize: size,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        color,
        border: `${size * 0.11}px solid ${color}`,
        outline: `${size * 0.05}px solid ${color}`,
        outlineOffset: size * 0.08,
        padding: `${size * 0.1}px ${size * 0.32}px`,
        whiteSpace: "nowrap",
        background: "rgba(239,234,223,0.6)",
      }}
    >
      {text}
      <Sfx name="pop" at={at} volume={0.5} />
    </div>
  );
};

/** Grand nombre qui défile jusqu'à `value` ("$7,500,000", "8,000 BTC"), étiquette mono dessous. */
export const Counter: React.FC<{ x: number; y: number; at?: number; value: string; label?: string; size?: number; color?: string; dur?: number; align?: "center" | "left" }> = ({
  x,
  y,
  at = 0,
  value,
  label,
  size = 140,
  color = INK,
  dur = 36,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const o = interpolate(frame, [at, at + 6], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(${align === "center" ? "-50%" : "0"}, -50%)`, opacity: o, textAlign: align }}>
      <div style={{ fontFamily: "var(--heading)", fontWeight: 800, fontSize: size, letterSpacing: "-0.045em", lineHeight: 0.95, color, whiteSpace: "nowrap" }}>
        <Count value={value} start={at} dur={dur} />
      </div>
      {label ? <div style={{ ...monoStyle(16, GREY), marginTop: 10 }}>{label}</div> : null}
    </div>
  );
};

/**
 * Titre cinétique : les mots tombent un par un (`stagger`), *mot* = surligné rose (bloc encre décalé).
 * `on` = "dark" (texte papier, sur le fond registre) ou "paper" (texte encre, sur une planche).
 */
export const Title: React.FC<{ x: number; y: number; at?: number; text: string; size?: number; w?: number; on?: "dark" | "paper"; align?: "center" | "left"; stagger?: number }> = ({
  x,
  y,
  at = 0,
  text,
  size = 110,
  w = 920,
  on = "dark",
  align = "center",
  stagger = 3,
}) => {
  const frame = useCurrentFrame();
  const toks = tokenize(text);
  const base = on === "dark" ? PAPER : INK;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translate(${align === "center" ? "-50%" : "0"}, -50%)`, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `${size * 0.08}px ${size * 0.24}px` }}>
      {toks.map((tk, i) => {
        const t0 = at + i * stagger;
        const p = interpolate(frame, [t0, t0 + 10], [0, 1], { ...clamp, easing: EASE_OUT });
        if (frame < t0) return <span key={i} style={{ visibility: "hidden", fontSize: size }}>{tk.w}</span>;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: "var(--heading)",
              fontWeight: 800,
              fontSize: size,
              lineHeight: 0.98,
              letterSpacing: "-0.045em",
              textTransform: "uppercase",
              color: tk.hl ? INK : base,
              background: tk.hl ? PINK : "transparent",
              boxShadow: tk.hl ? `${size * 0.06}px ${size * 0.06}px 0 ${on === "dark" ? PAPER : INK}` : undefined,
              padding: tk.hl ? `0 ${size * 0.08}px` : 0,
              transform: `translateY(${(1 - p) * size * 0.5}px) scale(${1.25 - 0.25 * p})`,
              opacity: p,
            }}
          >
            {tk.w}
            {tk.suffix}
          </span>
        );
      })}
    </div>
  );
};

/** Post-it (lime par défaut) légèrement penché, pour une citation ou un détail. */
export const Note: React.FC<{ x: number; y: number; at?: number; text: string; w?: number; color?: string; rot?: number; size?: number }> = ({ x, y, at = 0, text, w = 380, color = LIME, rot = 3, size = 34 }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 12, stiffness: 200 });
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 2), background: color, border: `4px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: "20px 22px", fontFamily: "var(--body)", fontWeight: 700, fontSize: size, lineHeight: 1.15, color: INK }}>
      {text}
    </div>
  );
};

/** Épingle de lieu qui tombe + étiquette ; ondes optionnelles (`pulse`). */
export const Pin: React.FC<{ x: number; y: number; at?: number; label?: string; color?: string; pulse?: boolean }> = ({ x, y, at = 0, label, color = PINK, pulse = true }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 10, stiffness: 220 });
  if (frame < at) return null;
  const r = ((frame - at) % 40) / 40;
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      {pulse ? <div style={{ position: "absolute", left: -60 * r, top: -18 * r, width: 120 * r, height: 36 * r, borderRadius: "50%", border: `4px solid ${color}`, opacity: 1 - r }} /> : null}
      <svg width={70} height={96} viewBox="0 0 70 96" style={{ position: "absolute", left: -35, top: -92, transform: `translateY(${(1 - p) * -140}px)`, overflow: "visible" }}>
        <path d="M35 92C35 92 6 56 6 34a29 29 0 0 1 58 0c0 22-29 58-29 58z" fill={color} stroke={INK} strokeWidth={6} />
        <circle cx={35} cy={34} r={11} fill={PAPER} stroke={INK} strokeWidth={5} />
      </svg>
      {label ? <div style={{ position: "absolute", left: 0, top: 14, transform: "translateX(-50%)", ...monoStyle(15, INK), background: PAPER, border: `3px solid ${INK}`, padding: "4px 10px", opacity: p }}>{label}</div> : null}
    </div>
  );
};
