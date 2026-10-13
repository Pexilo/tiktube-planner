import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, useTheme } from "../lib/theme";

type Word = { w: string; s: number; e: number };

/** Groupes de ≤ 3 mots, coupés à la ponctuation (lecture confortable). */
const chunk = (words: Word[]) => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 3 || /[.,:;!?]$/.test(w.w)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

/** Sous-titres animés style TikTok : mot actif surligné, rebond à chaque groupe. `offset` = frame de début de la voix. */
export const Captions: React.FC<{ words: Word[]; offset: number; y: number }> = ({ words, offset, y }) => {
  const { b, u, W } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - offset) / fps;
  const groups = chunk(words);
  const gi = groups.findIndex((g, i) => t >= g[0].s - 0.05 && (i === groups.length - 1 ? t <= g[g.length - 1].e + 0.6 : t < groups[i + 1][0].s - 0.05));
  if (gi < 0) return null;
  const g = groups[gi];
  const start = offset + Math.round(g[0].s * fps);
  const pop = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 260, mass: 0.6 } });
  const size = 70 * u;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${size * 0.12}px ${size * 0.26}px`,
          maxWidth: W - 120 * u,
          transform: `scale(${0.7 + 0.3 * pop}) translateY(${(1 - pop) * 20 * u}px)`,
          opacity: Math.min(1, pop * 2),
        }}
      >
        {g.map((w, i) => {
          const active = t >= w.s && t < (g[i + 1]?.s ?? w.e + 0.4);
          return (
            <span
              key={i}
              style={{
                fontFamily: font(b.body),
                fontWeight: 900,
                fontSize: size,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color: "#fff",
                padding: `${size * 0.04}px ${size * 0.16}px`,
                borderRadius: size * 0.18,
                background: active ? b.primary : "transparent",
                transform: active ? "scale(1.08) rotate(-2deg)" : "none",
                WebkitTextStroke: active ? undefined : `${size * 0.07}px #000`,
                paintOrder: "stroke fill",
                textShadow: "0 6px 18px rgba(0,0,0,0.55)",
              }}
            >
              {w.w}
            </span>
          );
        })}
      </div>
    </div>
  );
};
