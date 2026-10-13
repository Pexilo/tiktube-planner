import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { useTheme } from "../lib/theme";
import type { Screen } from "../lib/types";
import { Backdrop, SceneWrap, Sfx, useSpring } from "../components/fx";
import { Kinetic } from "../components/text";
import { Browser, Phone } from "../components/devices";
import { Glass } from "../components/ui";

/** Rafale d'écrans plein cadre, une coupe toutes les 4 frames, inclinaisons alternées. */
const FlashCuts: React.FC<{ screens: Screen[]; step: number }> = ({ screens, step }) => {
  const { u, isShort, b } = useTheme();
  const frame = useCurrentFrame();
  const i = Math.floor(frame / step);
  const sc = screens[i % screens.length];
  const local = (frame % step) / step;
  const browser = sc.device === "browser";
  return (
    <AbsoluteFill style={{ background: i % 2 ? b.primary : b.bg, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <div style={{ transform: `scale(${(isShort ? 1.25 : 1.1) + local * 0.08}) rotate(${i % 2 ? 4 : -4}deg)` }}>
        {browser ? <Browser screen={{ ...sc, zoom: 1.2 }} width={(isShort ? 1000 : 1500) * u} height={(isShort ? 700 : 880) * u} dur={step} /> : <Phone screen={sc} width={(isShort ? 640 : 420) * u} />}
      </div>
    </AbsoluteFill>
  );
};

/** Mur d'écrans en perspective qui défile en colonnes opposées + tagline au centre. */
export const MontageScene: React.FC<{ dur: number }> = ({ dur }) => {
  const { app, t, u, isShort, W } = useTheme();
  const frame = useCurrentFrame();
  const cutsEnd = 0; // plus de rafale d'écrans
  const pop = useSpring(cutsEnd + 4, { damping: 12, stiffness: 180 });

  // Uniquement les images (les vidéos multipliées seraient trop lourdes à décoder).
  const seen = new Set<string>();
  const screens: Screen[] = [];
  for (const f of app.features)
    for (const s of f.screens)
      if (!/\.mp4$/.test(s.src) && !seen.has(s.src)) {
        seen.add(s.src);
        screens.push(s);
      }
  const browser = screens[0]?.device === "browser";
  const cols = browser ? (isShort ? 2 : 3) : isShort ? 3 : 5;
  const itemW = browser ? (isShort ? 760 : 820) * u : (isShort ? 380 : 360) * u;
  const itemH = browser ? itemW * 0.62 : itemW * 2.2;
  const gap = 50 * u;
  const perCol = 4;

  return (
    <SceneWrap dur={dur} push={0.1}>
      <Backdrop seed={77} intensity={1.2} />
      <AbsoluteFill style={{ perspective: 1800 * u, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            display: "flex",
            gap,
            transform: `translate(-50%, -50%) rotateX(22deg) rotateZ(-12deg) scale(${isShort ? 1.35 : 1.2})`,
          }}
        >
          {Array.from({ length: cols }).map((_, c) => {
            const dir = c % 2 ? 1 : -1;
            const y = dir * frame * 4 * u - (c % 2 ? (itemH + gap) * 1.5 : 0);
            return (
              <div key={c} style={{ display: "flex", flexDirection: "column", gap, transform: `translateY(${y}px)` }}>
                {Array.from({ length: perCol }).map((__, r) => {
                  const sc = screens[(c * perCol + r * 3 + c) % screens.length];
                  return browser ? (
                    <Browser key={r} screen={{ ...sc, zoom: 1 }} width={itemW} height={itemH} dur={dur} />
                  ) : (
                    <Phone key={r} screen={sc} width={itemW} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 2) }}>
          <Glass radius={48 * u} style={{ padding: `${40 * u}px ${56 * u}px`, maxWidth: isShort ? W - 140 * u : 1300 * u }}>
            <Kinetic text={t(app.tagline)} size={(isShort ? 78 : 84) * u} start={cutsEnd + 6} stagger={2} mode="pop" />
          </Glass>
        </div>
      </AbsoluteFill>
      {cutsEnd > 0 ? (
        <Sequence durationInFrames={cutsEnd} layout="none">
          <FlashCuts screens={screens} step={4} />
        </Sequence>
      ) : null}
      {Array.from({ length: cutsEnd / 4 }).map((_, k) => (
        <Sfx key={k} name="click" at={k * 4} volume={0.5} />
      ))}
      <Sfx name="whoosh" at={cutsEnd} volume={0.7} />
      <Sfx name="pop" at={cutsEnd + 6} volume={0.4} />
    </SceneWrap>
  );
};
