import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, font, useTheme } from "../lib/theme";
import type { Feature, Screen } from "../lib/types";
import { Backdrop, clamp, EASE_IN_OUT, SceneWrap, Sfx } from "../components/fx";
import { FadeText, Kinetic, plain } from "../components/text";
import { Device } from "../components/devices";
import { Chip, StatCard } from "../components/ui";
import { Bokeh, FloorShadow, MonoTag, Particles } from "../components/pro";
import { FeatureWidget } from "../components/widgets";

const SWAP = 92; // frame du changement d'écran (si 2 écrans)

/** Appareil 3D : entrée spring, flottement, bascule vers le texte, swap d'écran. */
const DeviceStage: React.FC<{ screens: Screen[]; dur: number; side: 1 | -1; phoneW: number; browserW: number; browserH: number }> = ({
  screens,
  dur,
  side,
  phoneW,
  browserW,
  browserH,
}) => {
  const { u, isShort } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 110, mass: 1 } });
  // Caméra en orbite lente sur toute la scène + micro-flottement.
  const idle = interpolate(frame, [0, dur], [-9, 9], { easing: EASE_IN_OUT }) + Math.sin(frame / 22) * 1.5;
  const float = Math.sin(frame / 18) * 10 * u;
  const tiltY = isShort ? (1 - enter) * -40 + idle : side * (14 + (1 - enter) * 40) + idle;
  const tiltX = (1 - enter) * 28 + (isShort ? 8 : 4);
  const two = screens.length > 1;
  const swap = two ? interpolate(frame, [SWAP, SWAP + 14], [0, 1], { ...clamp, easing: EASE_IN_OUT }) : 0;
  const dist = (isShort ? 1100 : 1300) * u;
  const devices = two ? screens.slice(0, 2) : [screens[0]];
  return (
    <div style={{ perspective: 2200 * u, width: "100%", height: "100%", position: "relative" }}>
      {!isShort && screens[0].device !== "browser" ? (
        <FloorShadow width={phoneW * 1.3 * (0.6 + 0.4 * enter)} y={`calc(50% + ${phoneW * 1.12}px)`} opacity={0.5 * enter} />
      ) : null}
      {devices.map((sc, i) => {
        const x = i === 0 ? -swap * dist : (1 - swap) * dist;
        const r = i === 0 ? swap * -25 : (1 - swap) * 25;
        if ((i === 0 && swap >= 1) || (i === 1 && swap <= 0)) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translateX(${x}px) translateY(${(1 - enter) * 700 * u + float}px) rotateX(${tiltX}deg) rotateY(${tiltY + r}deg) scale(${0.82 + 0.18 * enter})`,
              transformStyle: "preserve-3d",
            }}
          >
            <Device screen={sc} phoneWidth={phoneW} browserWidth={browserW} browserHeight={browserH} dur={dur} />
          </div>
        );
      })}
    </div>
  );
};

export const FeatureScene: React.FC<{ feature: Feature; index: number; dur: number; compact?: boolean }> = ({ feature, index, dur, compact }) => {
  const { t, u, isShort, b, dark } = useTheme();
  const frame = useCurrentFrame();
  const side: 1 | -1 = index % 2 === 0 ? 1 : -1;
  const isBrowser = feature.screens[0].device === "browser";
  const widget = feature.widget;
  const two = feature.screens.length > 1 && !widget;
  const big = interpolate(frame, [0, dur], [0, 1]);

  const giant = (
    <div
      style={{
        position: "absolute",
        fontFamily: font(b.heading),
        fontWeight: b.headingWeight,
        fontSize: (isShort ? 900 : 900) * u,
        lineHeight: 1,
        color: "transparent",
        WebkitTextStroke: `${3 * u}px ${dark ? "rgba(255,255,255,0.08)" : alpha(b.primary, 0.12)}`,
        ...(isShort ? { right: -60 * u, top: 640 * u } : side === 1 ? { right: 120 * u, top: 60 * u } : { left: 120 * u, top: 60 * u }),
        transform: `translateY(${big * -60 * u}px)`,
      }}
    >
      {String(index + 1).padStart(2, "0")}
    </div>
  );

  const textBlock = (align: "left" | "center") => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: 26 * u }}>
      <MonoTag text={`feature ${String(index + 1).padStart(2, "0")}${feature.chip ? ` · ${plain(t(feature.chip))}` : ""}`} size={(isShort ? 24 : 20) * u} start={2} />
      <Kinetic text={t(feature.title)} size={(isShort ? 104 : 88) * u} start={4} stagger={3} align={align} maxWidth={(isShort ? 960 : 780) * u} />
      <FadeText text={t(feature.text)} size={(isShort ? 40 : 36) * u} start={16} align={align} style={{ maxWidth: (isShort ? 900 : 720) * u }} />
      {!isShort && feature.chip && !widget ? <Chip text={t(feature.chip)} size={28 * u} start={30} style={{ marginTop: 10 * u }} /> : null}
      {!isShort && feature.stat && !widget ? <StatCard value={feature.stat.value} label={t(feature.stat.label)} size={96 * u} start={42} style={{ marginTop: 10 * u }} /> : null}
    </div>
  );

  return (
    <SceneWrap dur={dur} push={0.04}>
      <Backdrop seed={30 + index * 7} />
      <Particles count={20} seed={index} />
      {giant}
      {widget ? (
        isShort ? (
          <>
            <AbsoluteFill style={{ top: 285 * u, bottom: "auto", height: 520 * u, alignItems: "center", padding: `0 ${60 * u}px` }}>{textBlock("center")}</AbsoluteFill>
            {/* Avec sous-titres (Shorts narrés), le widget est réduit pour leur laisser la place en dessous. */}
            <div style={{ position: "absolute", top: 770 * u, left: (compact ? 103 : 33) * u }}>
              <FeatureWidget widget={widget} width={(compact ? 860 : 1000) * u} />
            </div>
          </>
        ) : (
          <>
            <AbsoluteFill style={{ justifyContent: "center", ...(side === 1 ? { left: 140 * u, right: "auto" } : { left: "auto", right: 140 * u }), width: 760 * u }}>
              {textBlock("left")}
            </AbsoluteFill>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...(side === 1 ? { left: 900 * u, right: 60 * u, width: "auto" } : { left: 60 * u, right: 900 * u, width: "auto" }) }}>
              <FeatureWidget widget={widget} width={860 * u} />
            </AbsoluteFill>
          </>
        )
      ) : isShort ? (
        <>
          <AbsoluteFill style={{ top: 285 * u, bottom: "auto", height: 560 * u, alignItems: "center", padding: `0 ${60 * u}px` }}>{textBlock("center")}</AbsoluteFill>
          <AbsoluteFill style={isBrowser ? { top: 820 * u, bottom: 400 * u, height: "auto" } : { top: 770 * u, height: "auto" }}>
            <DeviceStage
              screens={feature.screens}
              dur={dur}
              side={side}
              phoneW={600 * u}
              browserW={1000 * u}
              browserH={720 * u}
            />
          </AbsoluteFill>
          <div style={{ position: "absolute", top: isBrowser ? 1450 * u : 1060 * u, left: 40 * u }}>
            {feature.chip ? <Chip text={t(feature.chip)} size={34 * u} start={30} /> : null}
          </div>
          <div style={{ position: "absolute", top: isBrowser ? 1220 * u : 1300 * u, right: 50 * u }}>
            {feature.stat ? <StatCard value={feature.stat.value} label={t(feature.stat.label)} size={96 * u} start={42} /> : null}
          </div>
        </>
      ) : (
        <>
          <AbsoluteFill
            style={{
              justifyContent: "center",
              ...(side === 1 ? { left: 140 * u, right: "auto" } : { left: "auto", right: 140 * u }),
              width: 800 * u,
            }}
          >
            {textBlock("left")}
          </AbsoluteFill>
          <AbsoluteFill style={side === 1 ? { left: 860 * u, right: 0, width: "auto" } : { left: 0, right: 860 * u, width: "auto" }}>
            <DeviceStage
              screens={feature.screens}
              dur={dur}
              side={(side * -1) as 1 | -1}
              phoneW={410 * u}
              browserW={1000 * u}
              browserH={640 * u}
            />
          </AbsoluteFill>
        </>
      )}
      <Bokeh seed={index + 3} count={5} opacity={0.28} />
      <Sfx name="whoosh" at={0} volume={0.55} />
      {feature.chip && !widget ? <Sfx name="pop" at={30} volume={0.4} /> : null}
      {feature.stat && !widget ? <Sfx name="tick" at={46} volume={0.4} /> : null}
      {two ? <Sfx name="swipe" at={SWAP - 2} volume={0.6} /> : null}
    </SceneWrap>
  );
};
