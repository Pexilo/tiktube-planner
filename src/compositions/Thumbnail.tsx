import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { alpha, font, ThemeProvider, useTheme } from "../lib/theme";
import type { VideoProps } from "../lib/types";
import { tokenize } from "../components/text";
import { PHONE_RATIO } from "../components/devices";

/** Miniature YouTube 1280x720 : statique (aucune animation), contraste max. */
const Thumb: React.FC = () => {
  const { app, t, b, dark, asset } = useTheme();
  const line = t(app.long.hook[app.long.hook.length - 1]);
  const f = app.features.find((x) => x.id === app.long.features[0])!;
  const shot = f.screens.find((s) => !/\.mp4$/.test(s.src)) ?? app.features.flatMap((x) => x.screens).find((s) => !/\.mp4$/.test(s.src))!;
  const browser = shot.device === "browser";
  const pw = 330;
  return (
    <AbsoluteFill style={{ background: b.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 78% 40%, ${alpha(b.primary, dark ? 0.7 : 0.45)} 0%, transparent 55%), radial-gradient(circle at 10% 90%, ${alpha(b.secondary, 0.5)} 0%, transparent 50%), ${b.bg}` }} />
      <div
        style={{
          position: "absolute",
          right: browser ? -120 : 90,
          top: browser ? 150 : 70,
          transform: browser ? "rotate(-4deg)" : "rotate(8deg)",
        }}
      >
        {browser ? (
          <div style={{ width: 760, height: 460, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,0.45)", background: "#fff" }}>
            <Img src={staticFile(asset(shot.src))} style={{ width: 760 * 1.25, marginLeft: -40 }} />
          </div>
        ) : (
          <div style={{ width: pw, height: pw * PHONE_RATIO, borderRadius: 52, padding: 11, background: "linear-gradient(145deg,#7a7a8e,#0c0c11 50%,#8a8a9e)", boxShadow: "0 40px 90px rgba(0,0,0,0.5)" }}>
            <Img src={staticFile(asset(shot.src))} style={{ width: "100%", height: "100%", borderRadius: 42, objectFit: "cover" }} />
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 70, top: 64, display: "flex", alignItems: "center", gap: 20 }}>
        <Img src={staticFile(asset(app.icon))} style={{ width: 96, height: 96, borderRadius: 22, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }} />
        <div style={{ fontFamily: font(b.heading), fontWeight: b.headingWeight, fontSize: 52, color: b.text, textTransform: b.uppercase ? "uppercase" : undefined }}>{app.name}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 210,
          width: browser ? 620 : 760,
          fontFamily: font(b.heading),
          fontWeight: b.headingWeight,
          fontSize: b.heading === "Anton" ? 104 : 88,
          lineHeight: 1.02,
          letterSpacing: `${b.tracking ?? -0.03}em`,
          color: b.text,
          textTransform: b.uppercase ? "uppercase" : undefined,
          textShadow: dark ? "0 6px 30px rgba(0,0,0,0.6)" : undefined,
        }}
      >
        {tokenize(line).map((tk, i) => (
          <span key={i} style={tk.hl ? { color: b.primary, ...(b.serif ? { fontFamily: font(b.serif), fontStyle: "italic", fontWeight: 600 } : {}) } : undefined}>
            {tk.w}{tk.suffix ?? ""}{" "}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 70,
          bottom: 60,
          padding: "14px 30px",
          borderRadius: 999,
          background: b.primary,
          color: "#fff",
          fontFamily: font(b.body),
          fontWeight: 800,
          fontSize: 32,
          textTransform: b.uppercase ? "uppercase" : undefined,
        }}
      >
        {t(app.price).split("·")[0].trim()}
      </div>
    </AbsoluteFill>
  );
};

export const Thumbnail: React.FC<VideoProps> = ({ app, lang }) => (
  <ThemeProvider app={app} lang={lang}>
    <Thumb />
  </ThemeProvider>
);
