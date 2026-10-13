import React from "react";
import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, font, useTheme } from "../lib/theme";
import type { Screen } from "../lib/types";
import { clamp, EASE_IN_OUT } from "./fx";

export const PHONE_RATIO = 2622 / 1206;
const WEB_RATIO = 1656 / 3010;

const isVideo = (src: string) => /\.(mp4|mov|webm)$/i.test(src);

/** Contenu d'un écran : image ou vidéo (muette, accélérée si `rate`). */
const Media: React.FC<{ screen: Screen; style?: React.CSSProperties }> = ({ screen, style }) => {
  const { asset } = useTheme();
  const { fps } = useVideoConfig();
  const src = staticFile(asset(screen.src));
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block", ...style };
  if (isVideo(screen.src)) {
    return <OffthreadVideo src={src} muted trimBefore={Math.round((screen.start ?? 0) * fps)} playbackRate={screen.rate ?? 1} style={s} />;
  }
  return <Img src={src} style={s} />;
};

/** iPhone (cadre titane + reflet) autour d'une vraie capture ou d'un enregistrement. */
export const Phone: React.FC<{ screen: Screen; width: number; glare?: number; style?: React.CSSProperties }> = ({ screen, width, glare = 0.3, style }) => {
  const { dark } = useTheme();
  const bezel = width * 0.034;
  const screenW = width - bezel * 2;
  const screenH = screenW * PHONE_RATIO;
  const h = screenH + bezel * 2;
  const r = width * 0.16;
  return (
    <div style={{ position: "relative", width, height: h, ...style }}>
      {[0.19, 0.28, 0.36].map((t, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: -width * 0.012,
            top: h * t,
            width: width * 0.014,
            height: i === 0 ? h * 0.035 : h * 0.06,
            borderRadius: 4,
            background: "linear-gradient(90deg,#6a6a7c,#2a2a33)",
          }}
        />
      ))}
      <div style={{ position: "absolute", right: -width * 0.012, top: h * 0.3, width: width * 0.014, height: h * 0.09, borderRadius: 4, background: "linear-gradient(90deg,#2a2a33,#6a6a7c)" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: r,
          background: "linear-gradient(145deg, #7a7a8e 0%, #22222b 16%, #0c0c11 50%, #2a2a34 84%, #8a8a9e 100%)",
          boxShadow: `0 ${width * 0.14}px ${width * 0.3}px rgba(0,0,0,${dark ? 0.6 : 0.28}), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 ${width * 0.005}px rgba(255,255,255,0.3)`,
        }}
      />
      <div style={{ position: "absolute", left: bezel, top: bezel, width: screenW, height: screenH, borderRadius: r - bezel, overflow: "hidden", background: "#000" }}>
        <Media screen={screen} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(115deg, transparent ${18 + glare * 40}%, rgba(255,255,255,0.12) ${28 + glare * 40}%, transparent ${42 + glare * 40}%)`,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

/** Fenêtre navigateur : cadre la capture web avec zoom + panoramique (focus → focusTo) pendant `dur`. */
export const Browser: React.FC<{ screen: Screen; width: number; height: number; dur: number; style?: React.CSSProperties }> = ({ screen, width, height, dur, style }) => {
  const { app, b, dark, asset } = useTheme();
  const frame = useCurrentFrame();
  const bar = Math.max(34, width * 0.045);
  const vpH = height - bar;
  const zoom = screen.zoom ?? 1;
  const imgW = width * zoom;
  const imgH = imgW * WEB_RATIO;
  const p = interpolate(frame, [0, dur], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const f0 = screen.focus ?? [0.5, 0.3];
  const f1 = screen.focusTo ?? f0;
  const fx = f0[0] + (f1[0] - f0[0]) * p;
  const fy = f0[1] + (f1[1] - f0[1]) * p;
  const left = Math.min(0, Math.max(width - imgW, width / 2 - fx * imgW));
  const top = Math.min(0, Math.max(vpH - imgH, vpH / 2 - fy * imgH));
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.022,
        overflow: "hidden",
        background: "#fff",
        boxShadow: `0 ${width * 0.06}px ${width * 0.14}px rgba(0,0,0,${dark ? 0.55 : 0.22}), 0 0 0 1px ${alpha("#000", 0.08)}`,
        ...style,
      }}
    >
      <div style={{ height: bar, background: dark ? "#1d1d24" : "#f1f0f3", display: "flex", alignItems: "center", padding: `0 ${bar * 0.45}px`, gap: bar * 0.22 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: bar * 0.32, height: bar * 0.32, borderRadius: "50%", background: c }} />
        ))}
        <div
          style={{
            marginLeft: bar * 0.5,
            flex: 1,
            maxWidth: width * 0.5,
            height: bar * 0.6,
            borderRadius: bar * 0.3,
            background: dark ? "#2a2a33" : "#ffffff",
            display: "flex",
            alignItems: "center",
            paddingLeft: bar * 0.4,
            fontFamily: font(b.body),
            fontSize: bar * 0.34,
            color: dark ? "#bbb" : "#666",
            fontWeight: 500,
          }}
        >
          🔒 {app.url}
        </div>
      </div>
      <div style={{ position: "relative", width, height: vpH, overflow: "hidden" }}>
        <Img src={staticFile(asset(screen.src))} style={{ position: "absolute", left, top, width: imgW, height: imgH }} />
      </div>
    </div>
  );
};

/** Choisit le bon appareil selon l'écran. */
export const Device: React.FC<{ screen: Screen; phoneWidth: number; browserWidth: number; browserHeight: number; dur: number; style?: React.CSSProperties }> = ({
  screen,
  phoneWidth,
  browserWidth,
  browserHeight,
  dur,
  style,
}) =>
  screen.device === "browser" ? (
    <Browser screen={screen} width={browserWidth} height={browserHeight} dur={dur} style={style} />
  ) : (
    <Phone screen={screen} width={phoneWidth} style={style} />
  );
