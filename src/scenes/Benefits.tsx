import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, useTheme } from "../lib/theme";
import { Backdrop, Burst, Flash, SceneWrap, Sfx, useSpring } from "../components/fx";
import { Kinetic, plain } from "../components/text";
import { AppIcon, Glass } from "../components/ui";

/** Checklist des bénéfices + prix qui claque (16:9). */
export const BenefitsScene: React.FC<{ dur: number }> = ({ dur }) => {
  const { app, t, u, b, lang, dark } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = app.benefits.map((_, i) => 18 + i * 18);
  const priceAt = 100;
  const price = useSpring(priceAt, { damping: 11, stiffness: 200 });
  const float = Math.sin(frame / 20) * 14 * u;
  return (
    <SceneWrap dur={dur}>
      <Backdrop seed={55} intensity={1.1} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: `0 ${140 * u}px`, gap: 100 * u }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 34 * u }}>
          {/* Un nom qui finit déjà par « ? » (Where'd Gains Go?) n'en prend pas un second. */}
          <Kinetic text={lang === "fr" ? `Pourquoi *${app.name.replace(/\?$/, "")}* ?` : `Why *${app.name.replace(/\?$/, "")}*?`} size={84 * u} align="left" start={2} />
          {app.benefits.map((bn, i) => {
            const s = spring({ frame: frame - starts[i], fps, config: { damping: 11, stiffness: 200 } });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 26 * u, opacity: Math.min(1, s * 2), transform: `translateX(${(1 - s) * -80 * u}px)` }}>
                <div
                  style={{
                    width: 58 * u,
                    height: 58 * u,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${b.primary}, ${b.secondary})`,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32 * u,
                    fontWeight: 900,
                    transform: `scale(${s})`,
                    boxShadow: `0 10px 30px ${b.primary}66`,
                    fontFamily: font(b.body),
                  }}
                >
                  ✓
                </div>
                <div style={{ fontFamily: font(b.body), fontWeight: 700, fontSize: 46 * u, color: b.text }}>{plain(t(bn))}</div>
              </div>
            );
          })}
        </div>
        <div style={{ width: 640 * u, display: "flex", flexDirection: "column", alignItems: "center", gap: 50 * u }}>
          <div style={{ transform: `translateY(${float}px)` }}>
            <AppIcon size={260 * u} />
          </div>
          <div style={{ position: "relative", transform: `scale(${0.5 + 0.5 * price}) rotate(${(1 - price) * 8}deg)`, opacity: Math.min(1, price * 2) }}>
            <AbsoluteFill>
              <Burst at={priceAt} radius={380 * u} />
            </AbsoluteFill>
            <Glass radius={40 * u} style={{ padding: `${34 * u}px ${46 * u}px`, textAlign: "center" }}>
              <div style={{ fontFamily: font(b.heading), fontWeight: b.headingWeight, fontSize: 54 * u, color: dark ? "#fff" : b.text, textTransform: b.uppercase ? "uppercase" : undefined, lineHeight: 1.15 }}>
                {plain(t(app.price))}
              </div>
            </Glass>
          </div>
        </div>
      </AbsoluteFill>
      <Flash at={priceAt} strength={0.3} />
      {starts.map((s) => (
        <Sfx key={s} name="pop" at={s} volume={0.4} />
      ))}
      <Sfx name="hit" at={priceAt} volume={0.6} />
    </SceneWrap>
  );
};
