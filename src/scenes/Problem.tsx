import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, useTheme } from "../lib/theme";
import { Backdrop, clamp, EASE_OUT, SceneWrap, Sfx, useShake } from "../components/fx";
import { Kinetic, plain } from "../components/text";

/** Les 3 douleurs, barrées une à une, puis tout s'effondre avant le drop. */
export const ProblemScene: React.FC<{ dur: number }> = ({ dur }) => {
  const { app, t, u, b, lang } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = app.problems.map((_, i) => 12 + i * 40);
  const shake = useShake(starts.map((s) => s + 22), 7 * u, 5);
  const fall = dur - 26;
  return (
    <SceneWrap dur={dur} exit={false}>
      <Backdrop seed={21} intensity={0.8} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: shake }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 44 * u, width: 1400 * u }}>
          <div style={{ fontFamily: font(b.body), fontWeight: 800, fontSize: 30 * u, letterSpacing: "0.3em", color: b.primary, textTransform: "uppercase" }}>
            {lang === "fr" ? "Le problème" : "The problem"}
          </div>
          {app.problems.map((p, i) => {
            const s = starts[i];
            const x = spring({ frame: frame - s, fps, config: { damping: 10, stiffness: 220 } });
            const strike = interpolate(frame, [s + 20, s + 30], [0, 1], { ...clamp, easing: EASE_OUT });
            const f = interpolate(frame, [fall + i * 3, fall + i * 3 + 20], [0, 1], { ...clamp, easing: (v) => v * v });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 36 * u,
                  transform: `translateY(${f * 900 * u}px) rotate(${f * (i % 2 ? 14 : -12)}deg)`,
                  opacity: 1 - f * 0.6,
                }}
              >
                <div
                  style={{
                    flex: "none",
                    width: 84 * u,
                    height: 84 * u,
                    borderRadius: "50%",
                    background: "#FF3B4E",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 50 * u,
                    fontWeight: 900,
                    fontFamily: font(b.body),
                    transform: `scale(${x})`,
                    boxShadow: "0 12px 40px rgba(255,59,78,0.45)",
                  }}
                >
                  ✕
                </div>
                <div style={{ position: "relative" }}>
                  <Kinetic text={plain(t(p))} size={76 * u} start={s} stagger={2} align="left" />
                  <div
                    style={{
                      position: "absolute",
                      left: -10 * u,
                      right: -10 * u,
                      top: "52%",
                      height: 8 * u,
                      borderRadius: 8,
                      background: "#FF3B4E",
                      transform: `scaleX(${strike})`,
                      transformOrigin: "left center",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {starts.map((s) => (
        <React.Fragment key={s}>
          <Sfx name="glitch" at={s} volume={0.45} />
          <Sfx name="swipe" at={s + 20} volume={0.5} />
        </React.Fragment>
      ))}
      <Sfx name="whoosh" at={fall} volume={0.6} />
    </SceneWrap>
  );
};
