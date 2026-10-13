// Série "Keynote" : motion design calme et détaillé.
// Pas de flash, pas de secousse : fondus, mises au point, mouvements lents, et chaque élément de l'app
// qui se détache de l'écran pour être montré de près.
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { buildTimeline, musicFor } from "../../shared/timeline.mjs";
import { alpha, font, MONO, ThemeProvider, useTheme } from "../lib/theme";
import type { KeynoteDetail, VideoProps } from "../lib/types";
import { Grain, Sfx } from "../components/fx";
import { tokenize, plain } from "../components/text";
import { PHONE_RATIO } from "../components/devices";
import { StoreBadge, storeBadges } from "../components/pro";

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const soft = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease } as const;
const fade = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], soft);

/* ------------------------------------------------------------------ fond calme */

const CalmBackdrop: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const { b, W, H, dark } = useTheme();
  const frame = useCurrentFrame();
  const t = frame / 30;
  const m = Math.max(W, H);
  const glow = (c: string, x: number, y: number, s: number, o: number) => (
    <div style={{ position: "absolute", left: x * W - (s * m) / 2, top: y * H - (s * m) / 2, width: s * m, height: s * m, borderRadius: "50%", background: `radial-gradient(circle, ${c} 0%, transparent 60%)`, opacity: o }} />
  );
  const r = (k: string) => random(`kb${seed}${k}`);
  return (
    <AbsoluteFill style={{ background: dark ? `linear-gradient(180deg, ${b.bg} 0%, ${b.bg2} 140%)` : `linear-gradient(180deg, ${b.bg} 0%, ${alpha(b.bg2, 0.9)} 160%)`, overflow: "hidden" }}>
      {glow(alpha(b.primary, dark ? 0.35 : 0.22), 0.25 + 0.05 * Math.sin(t / 7 + r("a") * 6), 0.2 + 0.04 * Math.cos(t / 9), 1.1, 1)}
      {glow(alpha(b.secondary, dark ? 0.22 : 0.18), 0.8 + 0.05 * Math.cos(t / 8 + r("b") * 6), 0.85 + 0.04 * Math.sin(t / 10), 1.0, 1)}
      <Grain opacity={dark ? 0.045 : 0.035} />
    </AbsoluteFill>
  );
};

/** Fondu enchaîné doux (entrée/sortie), légère mise au point. */
const CalmScene: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const i = fade(frame, 0, 18);
  const o = 1 - fade(frame, dur - 16, dur);
  const blur = (1 - i) * 8 + (1 - o) * 8;
  return <AbsoluteFill style={{ opacity: Math.min(i, o), filter: blur > 0.2 ? `blur(${blur}px)` : undefined, transform: `scale(${1.015 - 0.015 * i})` }}>{children}</AbsoluteFill>;
};

/* ------------------------------------------------------------------ texte */

/** Ligne de titre : fondu + légère montée, mots *mis en valeur* en couleur (ou serif italique). */
const CalmTitle: React.FC<{ text: string; size: number; at: number; align?: "left" | "center"; maxWidth?: number }> = ({ text, size, at, align = "center", maxWidth }) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const p = fade(frame, at, at + 22);
  const fs = b.heading === "Anton" ? size * 1.08 : size;
  return (
    <div
      style={{
        fontFamily: font(b.heading),
        fontWeight: b.heading === "Anton" ? 400 : Math.min(b.headingWeight, 700),
        fontSize: fs,
        lineHeight: 1.08,
        letterSpacing: `${(b.tracking ?? -0.03) * 0.8}em`,
        color: b.text,
        textAlign: align,
        textTransform: b.uppercase ? "uppercase" : undefined,
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px)`,
        filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined,
        maxWidth,
      }}
    >
      {tokenize(text).map((tk, i) => (
        <span key={i} style={tk.hl ? (b.serif ? { fontFamily: font(b.serif), fontStyle: "italic", fontWeight: 600, color: b.primary, textTransform: "none" } : { color: b.primary }) : undefined}>
          {tk.w}
          {tk.suffix ?? ""}{" "}
        </span>
      ))}
    </div>
  );
};

const CalmText: React.FC<{ text: string; size: number; at: number; align?: "left" | "center"; maxWidth?: number }> = ({ text, size, at, align = "center", maxWidth }) => {
  const { b } = useTheme();
  const frame = useCurrentFrame();
  const p = fade(frame, at, at + 20);
  return <div style={{ fontFamily: font(b.body), fontWeight: 500, fontSize: size, lineHeight: 1.4, color: b.muted, textAlign: align, opacity: p, transform: `translateY(${(1 - p) * 14}px)`, maxWidth }}>{plain(text)}</div>;
};

const MonoLine: React.FC<{ text: string; size: number; at: number; align?: "left" | "center" }> = ({ text, size, at, align = "center" }) => {
  const { b, dark } = useTheme();
  const frame = useCurrentFrame();
  const p = fade(frame, at, at + 18);
  return (
    <div style={{ display: "flex", justifyContent: align === "center" ? "center" : "flex-start", alignItems: "center", gap: size * 0.8, opacity: p }}>
      <span style={{ width: size * 2.2 * p, height: 1.5, background: b.primary }} />
      <span style={{ fontFamily: MONO, fontSize: size, letterSpacing: "0.2em", textTransform: "uppercase", color: dark ? alpha("#ffffff", 0.7) : alpha(b.text, 0.6), fontWeight: 500 }}>{text}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ appareils & découpe */

const BEZEL = 0.034;

/** Rectangle (en px) de l'écran dans un appareil de largeur w. */
const screenBox = (device: KeynoteDetail["device"], w: number, aspect: number) => {
  if (device === "browser") {
    const bar = Math.max(30, w * 0.04);
    return { x: 0, y: bar, w, h: w * aspect, outerH: w * aspect + bar };
  }
  if (device === "plain") return { x: 0, y: 0, w, h: w * aspect, outerH: w * aspect };
  const bz = w * BEZEL;
  const sw = w - bz * 2;
  return { x: bz, y: bz, w: sw, h: sw * PHONE_RATIO, outerH: sw * PHONE_RATIO + bz * 2 };
};

const DeviceFrame: React.FC<{ d: KeynoteDetail; w: number }> = ({ d, w }) => {
  const { asset, dark, app, b } = useTheme();
  const box = screenBox(d.device, w, d.aspect);
  const src = staticFile(asset(d.src));
  if (d.device === "plain") {
    return <Img src={src} style={{ width: w, display: "block", filter: `drop-shadow(0 ${w * 0.06}px ${w * 0.08}px rgba(0,0,0,${dark ? 0.55 : 0.25}))` }} />;
  }
  if (d.device === "browser") {
    const bar = box.y;
    return (
      <div style={{ width: w, height: box.outerH, borderRadius: w * 0.018, overflow: "hidden", background: "#fff", boxShadow: `0 ${w * 0.05}px ${w * 0.12}px rgba(0,0,0,${dark ? 0.5 : 0.18}), 0 0 0 1px rgba(0,0,0,0.06)` }}>
        <div style={{ height: bar, background: dark ? "#1d1d24" : "#f2f1f4", display: "flex", alignItems: "center", gap: bar * 0.22, padding: `0 ${bar * 0.45}px` }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: bar * 0.3, height: bar * 0.3, borderRadius: "50%", background: c }} />
          ))}
          <div style={{ marginLeft: bar * 0.5, height: bar * 0.58, borderRadius: bar * 0.3, background: dark ? "#2a2a33" : "#fff", padding: `0 ${bar * 0.5}px`, display: "flex", alignItems: "center", fontFamily: font(b.body), fontSize: bar * 0.32, color: "#777" }}>{app.url}</div>
        </div>
        <Img src={src} style={{ width: w, height: box.h, display: "block", objectFit: "cover", objectPosition: "top" }} />
      </div>
    );
  }
  const r = w * 0.16;
  return (
    <div style={{ position: "relative", width: w, height: box.outerH, borderRadius: r, background: "linear-gradient(145deg,#7a7a8e,#1d1d25 18%,#0c0c11 50%,#24242d 84%,#8a8a9e)", boxShadow: `0 ${w * 0.12}px ${w * 0.26}px rgba(0,0,0,${dark ? 0.55 : 0.25})` }}>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: r - box.x, overflow: "hidden", background: "#000" }}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    </div>
  );
};

/** Découpe d'une zone de capture (rect en fractions), affichée à la largeur `w`. */
const Crop: React.FC<{ d: KeynoteDetail; w: number; radius: number }> = ({ d, w, radius }) => {
  const { asset } = useTheme();
  const [rx, ry, rw, rh] = d.rect;
  const imgW = w / rw;
  const imgH = imgW * (d.device === "phone" || !d.device ? PHONE_RATIO : d.aspect);
  const h = imgH * rh;
  return (
    <div style={{ width: w, height: h, borderRadius: radius, overflow: "hidden", position: "relative" }}>
      <Img src={staticFile(asset(d.src))} style={{ position: "absolute", left: -rx * imgW, top: -ry * imgH, width: imgW, height: imgH }} />
    </div>
  );
};
const cropAspect = (d: KeynoteDetail) => ((d.device === "phone" || !d.device ? PHONE_RATIO : d.aspect) * d.rect[3]) / d.rect[2];

/* ------------------------------------------------------------------ scènes */

const IntroScene: React.FC<{ dur: number; headline: string }> = ({ dur, headline }) => {
  const { app, b, u, isShort, asset, t, dark } = useTheme();
  const frame = useCurrentFrame();
  const ic = fade(frame, 4, 34);
  const tr = interpolate(frame, [10, 60], [0.28, (b.tracking ?? -0.03) * 0.6], soft);
  const size = (isShort ? 220 : 190) * u;
  return (
    <CalmScene dur={dur}>
      <CalmBackdrop seed={1} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 * u, maxWidth: (isShort ? 900 : 1300) * u }}>
          <div style={{ position: "relative", opacity: ic, transform: `scale(${0.92 + 0.08 * ic})` }}>
            <div style={{ position: "absolute", inset: -size * 0.5, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(b.primary, dark ? 0.45 : 0.3)}, transparent 62%)` }} />
            <Img src={staticFile(asset(app.icon))} style={{ position: "relative", width: size, height: size, borderRadius: size * 0.225, boxShadow: `0 ${size * 0.14}px ${size * 0.35}px rgba(0,0,0,${dark ? 0.5 : 0.2})` }} />
          </div>
          <div style={{ fontFamily: font(b.heading), fontWeight: b.heading === "Anton" ? 400 : Math.min(b.headingWeight, 700), fontSize: (isShort ? 110 : 96) * u, letterSpacing: `${tr}em`, color: b.text, textTransform: b.uppercase ? "uppercase" : undefined, opacity: fade(frame, 14, 40), whiteSpace: "nowrap" }}>{app.name}</div>
          <MonoLine text={t(app.category)} size={20 * u} at={30} />
          <div style={{ height: 10 * u }} />
          <CalmTitle text={headline} size={(isShort ? 70 : 62) * u} at={48} />
        </div>
      </AbsoluteFill>
      <Sfx name="shimmer" at={6} volume={0.16} />
    </CalmScene>
  );
};

const DetailScene: React.FC<{ d: KeynoteDetail; index: number; total: number; dur: number }> = ({ d, index, total, dur }) => {
  const { u, isShort, W, H, t, b, dark } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const plainObj = d.device === "plain";
  const browser = d.device === "browser";

  // --- placement de l'appareil
  const devW = plainObj ? (isShort ? 760 : 620) * u : browser ? (isShort ? 1000 : 1060) * u : (isShort ? 640 : 430) * u;
  const box = screenBox(d.device, devW, d.aspect);
  const cx = isShort ? W / 2 : 1300 * u;
  const cy = isShort ? (plainObj ? 1180 * u : browser ? 1160 * u : 760 * u + box.outerH / 2) : H / 2;
  const devLeft = cx - devW / 2;
  const devTop = isShort && !plainObj && !browser ? 760 * u : cy - box.outerH / 2;

  // --- zone source de l'élément (px absolus)
  const [rx, ry, rw, rh] = d.rect;
  const src = { x: devLeft + box.x + rx * box.w, y: devTop + box.y + ry * box.h, w: rw * box.w, h: rh * box.h };

  // --- carte cible
  const ca = cropAspect(d);
  const maxW = (isShort ? 940 : 760) * u;
  const maxH = (isShort ? 640 : 640) * u;
  const tw = Math.min(maxW, maxH / ca);
  const th = tw * ca;
  const tgt = { x: cx - tw / 2, y: (isShort ? 1130 * u : H / 2) - th / 2, w: tw, h: th };

  const lift = plainObj ? 0 : spring({ frame: frame - 34, fps, config: { damping: 26, stiffness: 70, mass: 1.1 } });
  const L = (a: number, z: number) => a + (z - a) * lift;
  const card = { x: L(src.x, tgt.x), y: L(src.y, tgt.y), w: L(src.w, tgt.w) };
  const float = Math.sin(frame / 26) * 5 * u * lift;
  const push = interpolate(frame, [0, dur], [1, 1.05], soft);
  const devBlur = 10 * lift;
  const intro = fade(frame, 0, 26);
  const tilt = plainObj ? interpolate(frame, [0, dur], [10, -10], soft) : 0;

  // --- ligne de légende : du point d'origine jusqu'à la carte
  const lineP = fade(frame, 62, 90);
  const ox = src.x + src.w / 2;
  const oy = src.y + src.h / 2;
  const ex = card.x + card.w / 2;
  const ey = card.y + card.w * ca + 6 * u;

  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, alignItems: isShort ? "center" : "flex-start", maxWidth: (isShort ? 920 : 640) * u }}>
      <MonoLine text={`${String(index + 1).padStart(2, "0")} · ${t(d.label)}`} size={(isShort ? 22 : 19) * u} at={22} align={isShort ? "center" : "left"} />
      <CalmTitle text={t(d.title)} size={(isShort ? 74 : 64) * u} at={30} align={isShort ? "center" : "left"} maxWidth={(isShort ? 920 : 640) * u} />
      <CalmText text={t(d.text)} size={(isShort ? 36 : 30) * u} at={44} align={isShort ? "center" : "left"} maxWidth={(isShort ? 860 : 600) * u} />
      <div style={{ display: "flex", gap: 10 * u, marginTop: 12 * u, opacity: fade(frame, 50, 70) }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: i === index ? 34 * u : 10 * u, height: 10 * u, borderRadius: 10 * u, background: i === index ? b.primary : dark ? "rgba(255,255,255,0.22)" : alpha(b.text, 0.15) }} />
        ))}
      </div>
    </div>
  );

  return (
    <CalmScene dur={dur}>
      <CalmBackdrop seed={10 + index} />
      {/* appareil (flouté pendant la mise au point) */}
      <div
        style={{
          position: "absolute",
          left: devLeft,
          top: devTop + (1 - intro) * 40 * u,
          opacity: (plainObj ? 1 : 1 - 0.5 * lift) * intro,
          filter: devBlur > 0.3 ? `blur(${devBlur}px)` : undefined,
          transform: `scale(${push}) perspective(${1800 * u}px) rotateY(${tilt}deg) translateY(${plainObj ? Math.sin(frame / 28) * 8 * u : 0}px)`,
          transformOrigin: `${ox - devLeft}px ${oy - devTop}px`,
        }}
      >
        <DeviceFrame d={d} w={devW} />
      </div>
      {/* point d'origine + ligne */}
      {!plainObj ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: lineP }}>
          <line x1={ox} y1={oy} x2={ox + (ex - ox) * lineP} y2={oy + (ey - oy) * lineP} stroke={b.primary} strokeWidth={2 * u} strokeDasharray={`${6 * u} ${6 * u}`} />
          <circle cx={ox} cy={oy} r={8 * u} fill={b.primary} />
          <circle cx={ox} cy={oy} r={(14 + 6 * Math.sin(frame / 12)) * u} fill="none" stroke={alpha(b.primary, 0.5)} strokeWidth={2 * u} />
        </svg>
      ) : null}
      {/* la carte qui se détache */}
      {!plainObj ? (
        <div
          style={{
            position: "absolute",
            left: card.x,
            top: card.y + float,
            opacity: fade(frame, 30, 40),
            borderRadius: 26 * u,
            boxShadow: `0 ${30 * u * lift}px ${70 * u * lift}px rgba(0,0,0,${dark ? 0.55 : 0.22}), 0 0 0 ${1.5 * u}px ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)"}`,
            transform: `perspective(${1600 * u}px) rotateX(${(1 - lift) * 8}deg)`,
          }}
        >
          <Crop d={d} w={card.w} radius={26 * u * Math.max(0.4, lift)} />
        </div>
      ) : null}
      {/* texte */}
      {isShort ? (
        <AbsoluteFill style={{ top: 250 * u, height: "auto", alignItems: "center", padding: `0 ${70 * u}px` }}>{textBlock}</AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ left: 140 * u, width: 680 * u, justifyContent: "center" }}>{textBlock}</AbsoluteFill>
      )}
      {!plainObj ? <Sfx name="swipe" at={36} volume={0.12} /> : null}
    </CalmScene>
  );
};

const BentoScene: React.FC<{ dur: number; details: KeynoteDetail[] }> = ({ dur, details }) => {
  const { u, isShort, W, t, app, dark } = useTheme();
  const frame = useCurrentFrame();
  const items = details.slice(0, isShort ? 4 : 6);
  const cols = isShort ? 2 : 3;
  const gap = 28 * u;
  const cellW = isShort ? (W - 140 * u - gap) / 2 : (1640 * u - gap * 2) / 3;
  const cellH = isShort ? 420 * u : 330 * u;
  return (
    <CalmScene dur={dur}>
      <CalmBackdrop seed={50} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 46 * u, flexDirection: "column" }}>
        <CalmTitle text={t(app.tagline)} size={(isShort ? 66 : 60) * u} at={4} maxWidth={(isShort ? 920 : 1500) * u} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellW}px)`, gap }}>
          {items.map((d, i) => {
            const p = fade(frame, 14 + i * 7, 40 + i * 7);
            const ca = d.device === "plain" ? d.aspect : cropAspect(d);
            const w = Math.min(cellW - 40 * u, (cellH - 40 * u) / ca);
            return (
              <div
                key={d.id}
                style={{
                  width: cellW,
                  height: cellH,
                  borderRadius: 30 * u,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                  boxShadow: dark ? "inset 0 0 0 1px rgba(255,255,255,0.1)" : "inset 0 0 0 1px rgba(0,0,0,0.05), 0 20px 50px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 26 * u + Math.sin(frame / 30 + i) * 3 * u}px)`,
                }}
              >
                {d.device === "plain" ? <DeviceFrame d={d} w={w} /> : <Crop d={d} w={w} radius={18 * u} />}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </CalmScene>
  );
};

const OutroScene: React.FC<{ dur: number }> = ({ dur }) => {
  const { app, b, u, isShort, asset, t, lang, dark } = useTheme();
  const frame = useCurrentFrame();
  const size = (isShort ? 200 : 180) * u;
  const badges = storeBadges(app.platforms, lang);
  return (
    <CalmScene dur={dur + 20}>
      <CalmBackdrop seed={99} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * u, maxWidth: (isShort ? 940 : 1400) * u }}>
          <Img src={staticFile(asset(app.icon))} style={{ width: size, height: size, borderRadius: size * 0.225, opacity: fade(frame, 4, 30), transform: `scale(${0.94 + 0.06 * fade(frame, 4, 30)})`, boxShadow: `0 ${size * 0.14}px ${size * 0.35}px rgba(0,0,0,${dark ? 0.5 : 0.2})` }} />
          <CalmTitle text={t(app.cta.title)} size={(isShort ? 78 : 72) * u} at={14} maxWidth={(isShort ? 920 : 1300) * u} />
          <CalmText text={t(app.price)} size={(isShort ? 36 : 32) * u} at={30} />
          <div style={{ opacity: fade(frame, 40, 58), fontFamily: font(b.body), fontWeight: 700, fontSize: (isShort ? 40 : 36) * u, color: b.primary }}>{app.url}</div>
          <div style={{ display: "flex", gap: 16 * u, flexWrap: "wrap", justifyContent: "center", opacity: fade(frame, 54, 74) }}>
            {badges.map((bd) => (
              <StoreBadge key={bd.key} badge={bd} h={(isShort ? 80 : 70) * u} />
            ))}
          </div>
          <div style={{ height: 8 * u }} />
          <MonoLine text={t(app.cta.badge)} size={(isShort ? 22 : 19) * u} at={70} />
        </div>
      </AbsoluteFill>
      <Sfx name="shimmer" at={6} volume={0.14} />
    </CalmScene>
  );
};

/* ------------------------------------------------------------------ composition */

const KeynoteScenes: React.FC<VideoProps> = ({ app, shortIndex }) => {
  const { t } = useTheme();
  const def = app.keynote!.videos[shortIndex];
  const tl = buildTimeline(app, "keynote", shortIndex);
  const byId = Object.fromEntries(app.keynote!.details.map((d) => [d.id, d]));
  const details = def.details.map((id) => byId[id]);
  return (
    <>
      {tl.scenes.map((s, i) => {
        let el: React.ReactNode = null;
        if (s.type === "k-intro") el = <IntroScene dur={s.dur} headline={t(def.intro)} />;
        if (s.type === "k-detail") el = <DetailScene d={byId[s.detailId!]} index={s.featureIndex!} total={def.details.length} dur={s.dur} />;
        if (s.type === "k-bento") el = <BentoScene dur={s.dur} details={details} />;
        if (s.type === "k-outro") el = <OutroScene dur={s.dur} />;
        return (
          <Sequence key={i} from={s.from} durationInFrames={s.dur} name={`${s.type}${s.detailId ? `:${s.detailId}` : ""}`}>
            {el}
          </Sequence>
        );
      })}
    </>
  );
};

export const KeynoteVideo: React.FC<VideoProps> = (props) => {
  const { app, lang, shortIndex } = props;
  const tl = buildTimeline(app, "keynote", shortIndex);
  const music = musicFor(app, "keynote", shortIndex);
  return (
    <ThemeProvider app={app} lang={lang}>
      <AbsoluteFill style={{ background: app.brand.bg }}>
        <KeynoteScenes {...props} />
        <Audio src={staticFile(music.file)} volume={(f) => interpolate(f, [0, 20, tl.totalFrames - 30, tl.totalFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

