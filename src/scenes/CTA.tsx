import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, useTheme } from "../lib/theme";
import { Backdrop, Burst, clamp, Flash, Rings, SceneWrap, Sfx } from "../components/fx";
import { FadeText, Kinetic, plain } from "../components/text";
import { AppIcon, Glass } from "../components/ui";
import { Bokeh, Flare, Particles, StoreBadge, storeBadges } from "../components/pro";

/** URL tapée au clavier dans une pastille. */
const TypedUrl: React.FC<{ start: number; size: number }> = ({ start, size }) => {
  const { app, b, dark } = useTheme();
  const frame = useCurrentFrame();
  const n = Math.floor(interpolate(frame, [start, start + app.url.length * 1.4], [0, app.url.length], clamp));
  const s = spring({ frame: frame - start + 4, fps: 30, config: { damping: 12, stiffness: 200 } });
  const cursor = Math.floor(frame / 8) % 2 === 0 || n < app.url.length;
  return (
    <div style={{ transform: `scale(${s})`, opacity: Math.min(1, s * 2) }}>
      <Glass radius={999} style={{ padding: `${size * 0.45}px ${size * 0.9}px`, display: "flex", alignItems: "center", gap: size * 0.4 }}>
        <span style={{ fontSize: size * 0.8 }}>🔗</span>
        <span style={{ fontFamily: font(b.body), fontWeight: 800, fontSize: size, color: dark ? "#fff" : b.text, letterSpacing: "-0.01em" }}>
          {app.url.slice(0, n)}
          <span style={{ opacity: cursor ? 1 : 0, color: b.primary }}>|</span>
        </span>
      </Glass>
    </div>
  );
};

/** Pastille "Lien en description" qui pulse sur le temps, flèche qui rebondit. */
const LinkBadge: React.FC<{ start: number; size: number }> = ({ start, size }) => {
  const { app, t, b } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - start, fps, config: { damping: 10, stiffness: 180 } });
  const beat = 0;
  const bounce = Math.abs(Math.sin(((frame - start) / 15) * Math.PI)) * size * 0.35;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.3, transform: `scale(${s * (1 + beat * 0.05)})`, opacity: Math.min(1, s * 2) }}>
      <div
        style={{
          padding: `${size * 0.5}px ${size * 1.1}px`,
          borderRadius: 999,
          background: `linear-gradient(100deg, ${b.primary}, ${b.secondary})`,
          color: "#fff",
          fontFamily: font(b.body),
          fontWeight: 800,
          fontSize: size,
          boxShadow: `0 ${size * 0.4}px ${size * 1.4}px ${b.primary}88`,
          textTransform: b.uppercase ? "uppercase" : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {plain(t(app.cta.badge))}
      </div>
      <div style={{ fontSize: size * 1.3, transform: `translateY(${bounce}px)`, color: b.primary, fontWeight: 900, fontFamily: font(b.body) }}>↓</div>
    </div>
  );
};

export const CTAScene: React.FC<{ dur: number }> = ({ dur }) => {
  const { app, t, u, isShort, b, dark, lang } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icon = spring({ frame: frame - 1, fps, config: { damping: 9, stiffness: 150 } });
  const beat = 0;
  const iconSize = (isShort ? 250 : 300) * u;
  const urlAt = 44;
  const badgeAt = 96;
  const platAt = 70;

  const iconEl = (
    <div style={{ position: "relative", width: iconSize, height: iconSize }}>
      <AbsoluteFill>
        <Rings at={2} size={iconSize} count={4} />
        <Rings at={badgeAt} size={iconSize} count={2} color={b.secondary} />
        <Burst at={3} radius={iconSize * 1.2} count={24} />
      </AbsoluteFill>
      <AppIcon size={iconSize} style={{ transform: `scale(${icon * (1 + beat)}) rotate(${(1 - icon) * 20}deg)` }} />
    </div>
  );

  const badges = storeBadges(app.platforms, lang);
  const platforms = (
    <div style={{ display: "flex", gap: 16 * u, flexWrap: "wrap", justifyContent: isShort ? "center" : "flex-start", maxWidth: (isShort ? 960 : 1000) * u }}>
      {badges.map((bd, i) => {
        const s = spring({ frame: frame - platAt - i * 4, fps, config: { damping: 10, stiffness: 200 } });
        return (
          <div key={bd.key} style={{ transform: `scale(${s}) translateY(${(1 - s) * 30}px)`, opacity: Math.min(1, s * 2) }}>
            <StoreBadge badge={bd} h={(isShort ? 84 : 76) * u} />
          </div>
        );
      })}
    </div>
  );

  return (
    <SceneWrap dur={dur} exit={false} push={0.05}>
      <Backdrop seed={42} intensity={1.5} grid={dark} />
      <Particles count={34} seed={42} />
      {isShort ? (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 270 * u }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 * u, width: 960 * u }}>
            {iconEl}
            <Kinetic text={t(app.cta.title)} size={98 * u} mode="rise" start={8} stagger={4} maxWidth={960 * u} />
            <FadeText text={t(app.price)} size={40 * u} start={34} color={b.text} weight={700} />
            <TypedUrl start={urlAt} size={44 * u} />
            {platforms}
          </div>
          <div style={{ position: "absolute", top: 1330 * u }}>
            <LinkBadge start={badgeAt} size={40 * u} />
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 110 * u, padding: `0 ${140 * u}px` }}>
          {iconEl}
          <div style={{ display: "flex", flexDirection: "column", gap: 30 * u, maxWidth: 1050 * u }}>
            <Kinetic text={t(app.cta.title)} size={104 * u} mode="rise" start={8} stagger={4} align="left" />
            <FadeText text={`${plain(t(app.price))} · ${plain(t(app.cta.sub))}`} size={36 * u} start={34} align="left" color={b.text} weight={600} />
            <div style={{ display: "flex", alignItems: "center", gap: 30 * u }}>
              <TypedUrl start={urlAt} size={42 * u} />
            </div>
            {platforms}
            <div style={{ alignSelf: "flex-start", marginTop: 10 * u }}>
              <LinkBadge start={badgeAt} size={34 * u} />
            </div>
          </div>
        </AbsoluteFill>
      )}
      <Bokeh seed={42} count={5} opacity={0.22} />
      <Flash at={2} strength={0.6} />
      <Flare at={3} y={isShort ? "20%" : "50%"} />
      <Sfx name="impact" at={0} volume={0.6} />
      <Sfx name="shimmer" at={4} volume={0.5} />
      {Array.from({ length: Math.ceil(app.url.length / 3) }).map((_, i) => (
        <Sfx key={i} name="click" at={urlAt + i * 4.2} volume={0.3} />
      ))}
      {storeBadges(app.platforms, lang).map((bd, i) => (
        <Sfx key={bd.key} name="pop" at={platAt + i * 4} volume={0.35} />
      ))}
      <Sfx name="ding" at={badgeAt} volume={0.6} />
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(frame, [dur - 8, dur], [0, 0.9], clamp), pointerEvents: "none" }} />
    </SceneWrap>
  );
};
