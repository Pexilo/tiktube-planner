import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, useTheme } from "../lib/theme";
import { Backdrop, Burst, clamp, Flash, Rings, SceneWrap, Sfx } from "../components/fx";
import { FadeText, Kinetic } from "../components/text";
import { AppIcon, Chip } from "../components/ui";
import { Flare, Particles } from "../components/pro";

/** Lettres du nom qui montent une à une. */
const Letters: React.FC<{ text: string; size: number; start: number }> = ({ text, size, start }) => {
  const { b, W, u } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const base = b.heading === "Anton" ? size * 1.1 : size;
  // Le nom doit tenir dans la largeur, même pendant l'animation de tracking.
  const fs = Math.min(base, (W - 140 * u) / (text.length * (b.heading === "Anton" ? 0.52 : 0.62)));
  // Tracking qui se resserre (grand classique du logo reveal).
  const tr = interpolate(frame, [start, start + 40], [text.length > 8 ? 0.12 : 0.4, b.tracking ?? -0.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 4) });
  return (
    <div
      style={{
        display: "flex",
        fontFamily: font(b.heading),
        fontWeight: b.headingWeight,
        fontSize: fs,
        letterSpacing: `${tr}em`,
        color: b.text,
        textTransform: b.uppercase ? "uppercase" : undefined,
        lineHeight: 1.05,
        overflow: "hidden",
        paddingBottom: fs * 0.08,
      }}
    >
      {text.split("").map((c, i) => {
        const p = spring({ frame: frame - start - i * 1.6, fps, config: { damping: 15, stiffness: 200 } });
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${(1 - p) * 105}%) rotate(${(1 - p) * 12}deg)`, opacity: Math.min(1, p * 2) }}>
            {c}
          </span>
        );
      })}
    </div>
  );
};

export const RevealScene: React.FC<{ dur: number; drop: boolean }> = ({ dur, drop }) => {
  const { app, t, u, isShort, b, dark } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 140, mass: 0.9 } });
  const beat = 0;
  const iconSize = (isShort ? 340 : 260) * u;
  const long = dur > 60;
  return (
    <SceneWrap dur={dur} push={0.06}>
      <Backdrop seed={9} intensity={1.35} grid={dark} />
      <Particles count={30} seed={9} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 34 * u, transform: `translateY(${(long ? -40 : -20) * u}px)` }}>
          <div style={{ position: "relative", width: iconSize, height: iconSize }}>
            <AbsoluteFill style={{ transform: "scale(1)" }}>
              <Rings at={8} size={iconSize} />
              <Burst at={8} radius={iconSize * 1.1} />
            </AbsoluteFill>
            <AppIcon
              size={iconSize}
              style={{ transform: `scale(${s * (1 + beat)}) rotate(${(1 - s) * -28}deg)`, opacity: Math.min(1, s * 3) }}
            />
          </div>
          <Letters text={app.name} size={(isShort ? 170 : 150) * u} start={12} />
          <FadeText text={t(app.category)} size={(isShort ? 42 : 40) * u} start={24} style={{ maxWidth: 900 * u }} />
          {long ? (
            <>
              <div style={{ height: 6 * u }} />
              <Kinetic text={t(app.tagline)} size={60 * u} start={48} stagger={3} mode="rise" color={b.text} />
              <div style={{ display: "flex", gap: 18 * u, marginTop: 16 * u }}>
                {app.platforms.map((p, i) => (
                  <Chip key={p} text={p} size={28 * u} start={70 + i * 5} color={[b.primary, b.secondary, b.accent][i % 3]} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </AbsoluteFill>
      <Flash at={6} strength={drop ? 0.7 : 0.45} />
      <Flare at={7} y={`${long ? 40 : 45}%`} />
      <Sfx name="whoosh" at={0} volume={0.6} />
      <Sfx name="shimmer" at={7} volume={0.55} />
      
      {long ? app.platforms.map((p, i) => <Sfx key={p} name="pop" at={70 + i * 5} volume={0.35} />) : null}
    </SceneWrap>
  );
};
