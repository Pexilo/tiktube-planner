import React, { createContext, useContext } from "react";
import { interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TALE_VOICE_DELAY } from "../../../shared/tales.mjs";
import { clamp, EASE_IN_OUT, EASE_OUT } from "../../components/fx";
import type { Tale, TaleTimeline } from "../types";

/*
 * Noyau du kit "Crypto stories" : contexte de la story, beats calés sur la voix, scène (Stage), caméra, planche (Board).
 * Style registre de Where'd Gains Go? : papier crème, encre noire, ombres franches, accents rose / lime / cyan.
 * Coordonnées de la scène : 1000 × 1080 unités (= pixels en 1080 × 1920), origine en haut à gauche de la scène.
 */

export const INK = "#0B0B0E";
export const PAPER = "#EFEADF";
export const PAPER_2 = "#E4DECE";
export const GREY = "#6b675d";
export const PINK = "#FF2E88";
export const LIME = "#C6F24E";
export const CYAN = "#5CE1FF";
export const ORANGE = "#FF9D2E";
export const UP = "#4E7A00";
export const STAGE_W = 1000;
export const STAGE_H = 1080;
/** Position de la scène dans l'image 1080 × 1920 (au-dessus des sous-titres). */
export const STAGE_BOX = { left: 40, top: 300, width: STAGE_W, height: STAGE_H };

export type Word = { w: string; s: number; e: number };
type TaleCtx = { tale: Tale; timeline: TaleTimeline; words: Word[][] };
const Ctx = createContext<TaleCtx | null>(null);

/** Mots horodatés estimés (même règle que scripts/gen-voice.mjs) quand la voix n'existe pas encore. */
export function estimateWords(text: string, dur: number): Word[] {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = (w: string) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length) + 1.5 + (/[.,:;!?]$/.test(w) ? 3 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  const usable = Math.max(0.3, dur - 0.2);
  let t = 0.08;
  return words.map((w) => {
    const d = (weight(w) / total) * usable;
    const r = { w, s: +t.toFixed(3), e: +(t + d * 0.92).toFixed(3) };
    t += d;
    return r;
  });
}

export const TaleProvider: React.FC<{ tale: Tale; timeline: TaleTimeline; children: React.ReactNode }> = ({ tale, timeline, children }) => {
  const words = tale.beats.map((b, i) => tale.voice?.segments[i]?.words ?? estimateWords(b.text, (timeline.beats[i].dur - TALE_VOICE_DELAY) / 30 - 0.3));
  return <Ctx.Provider value={{ tale, timeline, words }}>{children}</Ctx.Provider>;
};

export const useTale = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("TaleProvider manquant");
  return v;
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Infos d'un beat. `at(mot)` = frame (relative au début du beat) où le mot commence à être dit :
 * `at("landfill")` (1re occurrence, insensible à la casse et à la ponctuation), `at(3)` (4e mot), `at("bitcoin", 2)` (2e occurrence).
 * Mot introuvable → 0. `end` = frame où la phrase se termine.
 */
export function useBeatInfo(id: string) {
  const { tale, timeline, words } = useTale();
  const i = tale.beats.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`Beat inconnu : ${id}`);
  const ws = words[i];
  const toFrame = (sec: number) => TALE_VOICE_DELAY + Math.round(sec * 30);
  const at = (word: string | number, nth = 1) => {
    if (typeof word === "number") return toFrame(ws[Math.max(0, Math.min(ws.length - 1, word))]?.s ?? 0);
    const target = norm(word);
    let seen = 0;
    for (const w of ws) if (norm(w.w).includes(target) && ++seen === nth) return toFrame(w.s);
    return 0;
  };
  return { index: i, beat: tale.beats[i], from: timeline.beats[i].from, dur: timeline.beats[i].dur, words: ws, at, end: toFrame(ws.at(-1)?.e ?? 0) };
}

const BeatCtx = createContext<ReturnType<typeof useBeatInfo> | null>(null);
/** Dans un <Beat> : infos du beat courant (frames relatives au début du beat). */
export const useBeat = () => {
  const v = useContext(BeatCtx);
  if (!v) throw new Error("useBeat() hors d'un <Beat>");
  return v;
};

/**
 * Séquence d'un beat : visible pendant la phrase (+ `tail` frames de chevauchement pour fondre avec le suivant).
 * À l'intérieur, useCurrentFrame() part de 0 au début du beat.
 */
export const Beat: React.FC<{ id: string; tail?: number; children: React.ReactNode }> = ({ id, tail = 0, children }) => {
  const info = useBeatInfo(id);
  return (
    <Sequence from={info.from} durationInFrames={info.dur + tail} name={`beat ${id} · ${info.beat.role}`} layout="none">
      <BeatCtx.Provider value={info}>{children}</BeatCtx.Provider>
    </Sequence>
  );
};

/** Ressort d'entrée standard (0 → 1) à partir de la frame `at`. */
export const useEnter = (at: number, cfg: Partial<{ damping: number; stiffness: number; mass: number }> = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 170, mass: 0.8, ...cfg } });
};

/** 0 → 1 linéaire (avec easing) entre `at` et `at + dur`. */
export const useProgress = (at: number, dur: number, ease: "out" | "inout" = "out") => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + Math.max(1, dur)], [0, 1], { ...clamp, easing: ease === "out" ? EASE_OUT : EASE_IN_OUT });
};

/** Scène : zone de 1000 × 1080 unités entre l'en-tête et les sous-titres. Tout le dessin de la story vit dedans. */
export const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", ...STAGE_BOX, ...style }}>{children}</div>
);

export type CameraKey = { at: number; x: number; y: number; zoom?: number };
/**
 * Caméra sur une grande planche : chaque clé centre le point (x, y) de la planche au milieu de la scène, avec un zoom.
 * Transitions douces (ease in-out) de `move` frames vers chaque clé. Les enfants sont placés en coordonnées planche.
 */
export const Camera: React.FC<{ keys: CameraKey[]; move?: number; children: React.ReactNode }> = ({ keys, move = 24, children }) => {
  const frame = useCurrentFrame();
  const ks = [...keys].sort((a, b) => a.at - b.at);
  let x = ks[0].x;
  let y = ks[0].y;
  let z = ks[0].zoom ?? 1;
  for (const k of ks.slice(1)) {
    const p = interpolate(frame, [k.at, k.at + move], [0, 1], { ...clamp, easing: EASE_IN_OUT });
    x += (k.x - x) * p;
    y += (k.y - y) * p;
    z += ((k.zoom ?? 1) - z) * p;
  }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${STAGE_W / 2}px, ${STAGE_H / 2}px) scale(${z}) translate(${-x}px, ${-y}px)` }}>
        {children}
      </div>
    </div>
  );
};

/** Place un élément en (x, y) (coordonnées scène ou planche). `anchor` = "center" (défaut) ou "topleft". */
export const At: React.FC<{ x: number; y: number; anchor?: "center" | "topleft"; rot?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, anchor = "center", rot = 0, children, style }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `${anchor === "center" ? "translate(-50%, -50%) " : ""}rotate(${rot}deg)`, ...style }}>{children}</div>
);

export type From = "up" | "down" | "left" | "right" | "scale" | "drop" | "fade";
/** Apparition animée d'un élément à la frame `at` ; disparition optionnelle à `out`. */
export const Appear: React.FC<{ at: number; from?: From; out?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, from = "up", out, children, style }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, from === "drop" ? { damping: 12, stiffness: 220 } : {});
  const q = out === undefined ? 0 : interpolate(frame, [out, out + 10], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const d = (1 - p) * 120;
  const tr =
    from === "up" ? `translateY(${d}px)`
    : from === "down" ? `translateY(${-d}px)`
    : from === "left" ? `translateX(${-d}px)`
    : from === "right" ? `translateX(${d}px)`
    : from === "scale" ? `scale(${0.4 + 0.6 * p})`
    : from === "drop" ? `translateY(${-d * 1.6}px) rotate(${(1 - p) * -8}deg)`
    : "none";
  if (frame < at) return null;
  return <div style={{ opacity: Math.min(1, p * 2.2) * (1 - q), transform: tr, ...style }}>{children}</div>;
};

/**
 * Planche de papier (ou d'encre) avec ombre franche colorée et en-tête mono optionnel ("CASE FILE · 2013").
 * Dimensions en unités scène.
 */
export const Board: React.FC<{
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  at?: number;
  tone?: "paper" | "ink";
  shadow?: string;
  label?: string;
  tag?: string;
  ruled?: boolean;
  children?: React.ReactNode;
}> = ({ x = 0, y = 0, w = STAGE_W, h = STAGE_H, at = 0, tone = "paper", shadow = PINK, label, tag, ruled = true, children }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 14, stiffness: 150 });
  const ink = tone === "ink";
  const drift = Math.sin(frame / 50) * 0.3;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: ink ? INK : PAPER,
        border: `4px solid ${ink ? PAPER : INK}`,
        boxShadow: `14px 14px 0 ${shadow}`,
        transform: `translateY(${(1 - p) * 140}px) rotate(${(1 - p) * -5 + drift}deg)`,
        opacity: Math.min(1, p * 2.5),
        overflow: "hidden",
      }}
    >
      {ruled ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${ink ? "rgba(239,234,223,0.07)" : "rgba(11,11,14,0.07)"} 2px, transparent 2px)`,
            backgroundSize: "100% 54px",
          }}
        />
      ) : null}
      {label || tag ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 58, background: ink ? PAPER : INK, display: "flex", alignItems: "center", gap: 14, padding: "0 18px" }}>
          {tag ? <span style={{ ...monoStyle(16, INK), background: PINK, padding: "5px 10px" }}>{tag}</span> : null}
          {label ? <span style={monoStyle(16, ink ? INK : PAPER)}>{label}</span> : null}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, top: label || tag ? 58 : 0 }}>{children}</div>
    </div>
  );
};

/** Style des étiquettes mono du site (majuscules espacées). */
export const monoStyle = (size = 17, color: string = INK): React.CSSProperties => ({
  fontFamily: "var(--mono)",
  fontWeight: 700,
  fontSize: size * 1.4,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color,
  whiteSpace: "nowrap",
});
