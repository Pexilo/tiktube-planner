import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { clamp, EASE_IN_OUT, EASE_OUT } from "../../components/fx";
import { Count } from "../../components/widgets";
import { GREY, INK, LIME, monoStyle, PAPER, PAPER_2, PINK, useEnter, useProgress } from "../kit/core";

/*
 * Dessin schématique à l'encre : traits qui se tracent, flèches, transferts de jetons, chaînes de blocs, courbes de prix.
 * Tout est en coordonnées du parent (scène, planche ou caméra).
 */

type Pt = [number, number];

/** Calque SVG sans taille propre : dessine n'importe où dans le repère du parent. */
const Layer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>{children}</svg>
);

/** Trait SVG (`d`) qui se dessine de `at` à `at + dur`. `dashed` = pointillés (tracés progressivement eux aussi). */
export const InkPath: React.FC<{ d: string; at: number; dur?: number; color?: string; width?: number; dashed?: boolean; fill?: string }> = ({
  d,
  at,
  dur = 20,
  color = INK,
  width = 6,
  dashed,
  fill,
}) => {
  const p = useProgress(at, dur, "inout");
  if (p <= 0) return null;
  const id = `m${Math.abs(hash(d + at))}`;
  const evo = evolvePath(p, d);
  return (
    <Layer>
      {dashed ? (
        <>
          <defs>
            <mask id={id} maskUnits="userSpaceOnUse" x={-5000} y={-5000} width={10000} height={10000}>
              <path d={d} fill="none" stroke="#fff" strokeWidth={width * 3} strokeLinecap="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
            </mask>
          </defs>
          <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={`${width * 2.4} ${width * 2}`} strokeLinecap="round" mask={`url(#${id})`} />
        </>
      ) : (
        <path d={d} fill={p >= 1 ? fill ?? "none" : "none"} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
      )}
    </Layer>
  );
};

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** Courbe quadratique de `from` à `to`, `bend` = flèche latérale (unités, signe = côté). */
const curve = (from: Pt, to: Pt, bend: number) => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const cx = mx + (-(y2 - y1) / len) * bend;
  const cy = my + ((x2 - x1) / len) * bend;
  return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, c: [cx, cy] as Pt };
};

const head = (tip: Pt, from: Pt, size: number) => {
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const p = (da: number): Pt => [tip[0] - size * Math.cos(a + da), tip[1] - size * Math.sin(a + da)];
  const l = p(0.45);
  const r = p(-0.45);
  return `M ${l[0]} ${l[1]} L ${tip[0]} ${tip[1]} L ${r[0]} ${r[1]}`;
};

/** Flèche qui se trace de `from` à `to` (courbée si `bend`), avec étiquette mono optionnelle au milieu. */
export const Arrow: React.FC<{ from: Pt; to: Pt; at: number; dur?: number; bend?: number; color?: string; width?: number; dashed?: boolean; label?: string; labelColor?: string }> = ({
  from,
  to,
  at,
  dur = 18,
  bend = 0,
  color = INK,
  width = 6,
  dashed,
  label,
  labelColor = PINK,
}) => {
  const { d, c } = curve(from, to, bend);
  const frame = useCurrentFrame();
  const mid = getPointAtLength(d, getLength(d) / 2) ?? { x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2 };
  return (
    <>
      <InkPath d={d} at={at} dur={dur} color={color} width={width} dashed={dashed} />
      {frame >= at + dur * 0.85 ? <InkPath d={head(to, bend ? c : from, width * 5)} at={at + dur * 0.85} dur={5} color={color} width={width} /> : null}
      {label ? (
        <Tag x={mid.x} y={mid.y - 34} at={at + dur * 0.6} color={labelColor}>
          {label}
        </Tag>
      ) : null}
    </>
  );
};

/** Petite étiquette mono sur fond coloré, bordure encre. */
export const Tag: React.FC<{ x: number; y: number; at: number; color?: string; textColor?: string; size?: number; rot?: number; children: React.ReactNode }> = ({
  x,
  y,
  at,
  color = LIME,
  textColor = INK,
  size = 15,
  rot = -2,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 12, stiffness: 260 });
  if (frame < at) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${0.5 + 0.5 * p}) rotate(${rot}deg)`,
        opacity: Math.min(1, p * 2),
        ...monoStyle(size, textColor),
        background: color,
        border: `3px solid ${INK}`,
        padding: "5px 12px",
        boxShadow: `5px 5px 0 ${INK}`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Transfert : flèche pointillée puis jeton qui glisse de `from` à `to` (de `at` à `at + dur`).
 * `token` = symbole dans la pièce ("₿", "Ξ", "$"…), `amount` = montant qui suit le jeton.
 */
export const Transfer: React.FC<{ from: Pt; to: Pt; at: number; dur?: number; bend?: number; token?: string; amount?: string; color?: string; size?: number }> = ({
  from,
  to,
  at,
  dur = 36,
  bend = -60,
  token = "₿",
  amount,
  color = ORANGE_COIN,
  size = 64,
}) => {
  const frame = useCurrentFrame();
  const { d } = curve(from, to, bend);
  const p = interpolate(frame, [at + 8, at + dur], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const pt = getPointAtLength(d, getLength(d) * p) ?? { x: from[0], y: from[1] };
  const landed = frame >= at + dur;
  return (
    <>
      <InkPath d={d} at={at} dur={10} color={GREY} width={4} dashed />
      {frame >= at + 6 ? (
        <div style={{ position: "absolute", left: pt.x, top: pt.y, transform: `translate(-50%, -50%) scale(${landed ? 1 : 1.08})` }}>
          <Coin symbol={token} size={size} color={color} />
          {amount ? <div style={{ position: "absolute", left: "50%", top: size * 0.62, transform: "translateX(-50%)", ...monoStyle(14, INK), background: PAPER, border: `3px solid ${INK}`, padding: "3px 8px" }}>{amount}</div> : null}
        </div>
      ) : null}
    </>
  );
};
const ORANGE_COIN = "#F7931A";

/** Pièce plate à bord encre (₿ orange par défaut). */
export const Coin: React.FC<{ symbol?: string; size?: number; color?: string }> = ({ symbol = "₿", size = 64, color = ORANGE_COIN }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      border: `${Math.max(3, size * 0.06)}px solid ${INK}`,
      boxShadow: `${size * 0.08}px ${size * 0.08}px 0 ${INK}`,
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--heading)",
      fontWeight: 800,
      fontSize: size * 0.56,
      color: INK,
      lineHeight: 1,
    }}
  >
    {symbol}
  </div>
);

/**
 * Chaîne de blocs horizontale : `count` blocs qui s'enchaînent à partir de `at`, numérotés depuis `first`.
 * `highlight` = index du bloc mis en avant (rose), `label` affiché au-dessus.
 */
export const Chain: React.FC<{ x: number; y: number; at: number; count?: number; first?: number; highlight?: number; label?: string; size?: number; stagger?: number }> = ({
  x,
  y,
  at,
  count = 5,
  first = 1,
  highlight,
  label,
  size = 120,
  stagger = 5,
}) => {
  const gap = size * 0.45;
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      {label ? <div style={{ position: "absolute", left: 0, top: -size * 0.5, ...monoStyle(15, GREY) }}>{label}</div> : null}
      {Array.from({ length: count }).map((_, i) => (
        <Block key={i} i={i} at={at + i * stagger} size={size} gap={gap} n={first + i} hot={i === highlight} last={i === count - 1} />
      ))}
    </div>
  );
};

const Block: React.FC<{ i: number; at: number; size: number; gap: number; n: number; hot: boolean; last: boolean }> = ({ i, at, size, gap, n, hot, last }) => {
  const frame = useCurrentFrame();
  const p = useEnter(at, { damping: 13, stiffness: 240 });
  if (frame < at) return null;
  const left = i * (size + gap);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left,
          top: 0,
          width: size,
          height: size,
          background: hot ? PINK : PAPER,
          border: `5px solid ${INK}`,
          boxShadow: `8px 8px 0 ${INK}`,
          transform: `translateY(${(1 - p) * -80}px)`,
          opacity: Math.min(1, p * 2),
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: size * 0.1,
          boxSizing: "border-box",
        }}
      >
        <div style={{ height: size * 0.09, background: INK, width: "70%" }} />
        <div style={{ height: size * 0.09, background: INK, width: "45%" }} />
        <div style={{ ...monoStyle(size * 0.1, INK), letterSpacing: 0 }}>#{n.toLocaleString("en-US")}</div>
      </div>
      {!last ? <div style={{ position: "absolute", left: left + size + 4, top: size / 2 - 4, width: interpolate(frame, [at + 4, at + 10], [0, gap - 8], clamp), height: 8, background: INK }} /> : null}
    </>
  );
};

/**
 * Courbe de prix qui se trace : `points` = valeurs (normalisées automatiquement) dans un cadre w × h.
 * `labels` = repères { i (index du point), text, color } ; `start` / `end` = étiquettes de valeur au début / à la tête.
 */
export const PriceChart: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  dur?: number;
  points: number[];
  color?: string;
  start?: string;
  end?: string;
  labels?: { i: number; text: string; color?: string }[];
  grid?: boolean;
}> = ({ x, y, w, h, at, dur = 40, points, color = PINK, start, end, labels = [], grid = true }) => {
  const frame = useCurrentFrame();
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pts = points.map((v, i): Pt => [(i / Math.max(1, points.length - 1)) * w, h - ((v - min) / (max - min || 1)) * h]);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const p = useProgress(at, dur, "inout");
  const tip = getPointAtLength(d, getLength(d) * p) ?? { x: pts[0][0], y: pts[0][1] };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      {grid ? (
        <div style={{ position: "absolute", inset: 0, borderLeft: `4px solid ${INK}`, borderBottom: `4px solid ${INK}`, backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${h / 4 - 2}px, rgba(11,11,14,0.12) ${h / 4 - 2}px ${h / 4}px)` }} />
      ) : null}
      <InkPath d={d} at={at} dur={dur} color={color} width={8} />
      {frame >= at ? <div style={{ position: "absolute", left: tip.x, top: tip.y, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: "50%", background: color, border: `4px solid ${INK}` }} /> : null}
      {start ? <Tag x={pts[0][0] + 10} y={pts[0][1] - 40} at={at} color={PAPER}>{start}</Tag> : null}
      {end && p >= 1 ? <Tag x={Math.min(w - 40, tip.x)} y={tip.y - 46} at={at + dur} color={color}>{end}</Tag> : null}
      {labels.map((l, k) => {
        const lp = pts[Math.max(0, Math.min(pts.length - 1, l.i))];
        const when = at + (l.i / Math.max(1, pts.length - 1)) * dur;
        return <Tag key={k} x={lp[0]} y={lp[1] - 46} at={when} color={l.color ?? LIME}>{l.text}</Tag>;
      })}
    </div>
  );
};

/**
 * Frise chronologique horizontale : repères qui apparaissent l'un après l'autre (`stagger` frames).
 * `active` = index mis en avant (rose).
 */
export const Timeline: React.FC<{ x: number; y: number; w: number; at: number; items: { label: string; sub?: string }[]; active?: number; stagger?: number }> = ({
  x,
  y,
  w,
  at,
  items,
  active,
  stagger = 8,
}) => {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [at, at + 16], [0, w], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      <div style={{ position: "absolute", left: 0, top: -4, width: line, height: 8, background: INK }} />
      {items.map((it, i) => {
        const cx = items.length === 1 ? w / 2 : (i / (items.length - 1)) * w;
        const t = at + 8 + i * stagger;
        const hot = i === active;
        return frame >= t ? (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: cx - 16, top: -16, width: 32, height: 32, borderRadius: "50%", background: hot ? PINK : PAPER, border: `5px solid ${INK}` }} />
            <Tag x={cx} y={-60} at={t} color={hot ? PINK : PAPER}>{it.label}</Tag>
            {it.sub ? <div style={{ position: "absolute", left: cx, top: 36, transform: "translateX(-50%)", ...monoStyle(13, GREY), textAlign: "center" }}>{it.sub}</div> : null}
          </React.Fragment>
        ) : null;
      })}
    </div>
  );
};

/** Légende mono reliée à un point par un trait (`to`). */
export const Callout: React.FC<{ x: number; y: number; to: Pt; at: number; text: string; color?: string }> = ({ x, y, to, at, text, color = LIME }) => (
  <>
    <InkPath d={`M ${x} ${y} L ${to[0]} ${to[1]}`} at={at} dur={10} width={4} dashed />
    <Tag x={x} y={y} at={at + 6} color={color}>{text}</Tag>
  </>
);

/** Lignes caviardées : barres (encre, ou `color` sur fond sombre) qui se posent ; `reveal` (frame) les fait glisser pour montrer `text`. */
export const Redacted: React.FC<{ x: number; y: number; w: number; at: number; lines?: number; reveal?: number; text?: string; color?: string }> = ({ x, y, w, at, lines = 3, reveal, text, color = INK }) => {
  const frame = useCurrentFrame();
  const r = reveal === undefined ? 0 : interpolate(frame, [reveal, reveal + 14], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      {text ? <div style={{ position: "absolute", left: 0, top: 0, ...monoStyle(20, color === INK ? INK : PAPER), whiteSpace: "normal", lineHeight: "54px", opacity: r }}>{text}</div> : null}
      {Array.from({ length: lines }).map((_, i) => {
        const wi = interpolate(frame, [at + i * 4, at + i * 4 + 10], [0, w * (i === lines - 1 ? 0.6 : 1)], { ...clamp, easing: EASE_OUT });
        return <div key={i} style={{ position: "absolute", left: r * (w + 60), top: i * 54 + 8, width: wi, height: 34, background: color }} />;
      })}
    </div>
  );
};

/** Jauge horizontale hachurée (style "timeline" du site) qui se remplit jusqu'à `to` (0..1). */
export const Gauge: React.FC<{ x: number; y: number; w: number; at: number; to: number; color?: string; label?: string; value?: string; hatched?: boolean }> = ({
  x,
  y,
  w,
  at,
  to,
  color = PINK,
  label,
  value,
  hatched = true,
}) => {
  const p = useProgress(at, 28);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      {label ? <div style={{ ...monoStyle(14, GREY), marginBottom: 8 }}>{label}</div> : null}
      <div style={{ height: 34, background: PAPER_2, border: `4px solid ${INK}`, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(1, to)) * p * 100}%`,
            background: hatched ? `repeating-linear-gradient(-45deg, ${color} 0 8px, transparent 8px 16px)` : color,
            borderRight: p > 0.02 ? `4px solid ${INK}` : undefined,
          }}
        />
      </div>
      {value ? (
        <div style={{ marginTop: 8, fontFamily: "var(--heading)", fontWeight: 800, fontSize: 52, letterSpacing: "-0.04em", color: INK }}>
          <Count value={value} start={at} dur={28} />
        </div>
      ) : null}
    </div>
  );
};
