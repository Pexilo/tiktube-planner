import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TALE_VOICE_DELAY, taleTimeline } from "../../shared/tales.mjs";
import { clamp, SfxMute } from "../components/fx";
import { FeatureWidget } from "../components/widgets";
import { font, MONO, ThemeProvider, useTheme } from "../lib/theme";
import type { AppContent } from "../lib/types";
import { TaleProvider, useTale, type Word } from "./kit/core";
import { Canvas, COLS, P, PAL, PixelArt, Person } from "./pixel/engine";
import { Label, PIXELIFY, Room, Title } from "./pixel/props";
import type { StoryProps, Tale } from "./types";

/*
 * Habillage fixe d'une story crypto en pixel art (écrit à la main, jamais par Claude) :
 * fond encre, voix off + sous-titres pixel mot à mot, musique sous la voix, aucun bruitage,
 * moment produit (~5 s : le vrai widget Where'd Gains Go? dans un écran pixel) et carte de fin.
 * Claude n'écrit que <Story /> : les plans, sur la grille de 90 × 160 cellules.
 */

export type TaleVideoProps = { tale: Tale; app: AppContent };

const MUSIC_BED = 0.3;
const END = 54; // durée de la carte de fin (frames), sur la queue du dernier beat
/** Ligne du haut des sous-titres (cellules) : sous les plans, au-dessus du texte de la plateforme. */
export const CAPTION_ROW = 120;

/** Sous-titres pixel : groupes de 3 mots max (coupés à la ponctuation), mot prononcé en lime, sur un bloc encre. */
const PixelCaptions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const t = (frame - TALE_VOICE_DELAY) / 30;
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 3 || /[.,:;!?]$/.test(w.w)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const gi = groups.findIndex((g, i) => t >= g[0].s - 0.05 && (i === groups.length - 1 ? t <= g.at(-1)!.e + 0.6 : t < groups[i + 1][0].s - 0.05));
  if (gi < 0) return null;
  const g = groups[gi];
  return (
    <div style={{ position: "absolute", left: 4 * P, right: 4 * P, top: CAPTION_ROW * P, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${P / 2}px ${P * 1.5}px`, background: PAL.ink, padding: `${P / 2}px ${P * 1.5}px`, boxShadow: `${P / 2}px ${P / 2}px 0 ${PAL.ink3}` }}>
        {g.map((w, i) => {
          const active = t >= w.s && t < (g[i + 1]?.s ?? w.e + 0.4);
          return (
            <span key={i} style={{ fontFamily: PIXELIFY, fontWeight: 700, fontSize: 62, lineHeight: 1.1, textTransform: "uppercase", color: active ? PAL.ink : PAL.paper, background: active ? PAL.lime : "transparent", padding: `0 ${P / 2}px` }}>
              {w.w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Moniteur pixel (cadre, pied) : écran de 70 × 60 cellules en (MON_X + 2, MON_Y + 2). */
const MON_X = 8;
const MON_Y = 22;
const monitor = new Canvas().rect(0, 0, 74, 64, PAL.ink3).rect(1, 1, 72, 1, "#3B3948").rect(2, 2, 70, 60, "#0E1A14").rect(33, 64, 8, 5, PAL.grey).rect(24, 69, 26, 3, PAL.grey).set(68, 62, PAL.lime).outline();
const desk = new Canvas().rect(0, 0, 84, 3, "#8A5A3A").rect(2, 3, 3, 10, "#6E4A30").rect(79, 3, 3, 10, "#6E4A30").outline();

/** Moment produit : un bureau, un écran pixel, et dedans la vraie feature Where'd Gains Go? liée à l'histoire. */
const ProductCameo: React.FC<{ dur: number }> = ({ dur }) => {
  const { app } = useTheme();
  const { tale } = useTale();
  const frame = useCurrentFrame();
  const feature = app.features.find((f) => f.id === tale.product.featureId) ?? app.features.find((f) => f.widget);
  // Entrée et sortie en volets de lignes (paliers d'une cellule), pas en fondu.
  const rows = Math.min(160, Math.floor(frame * 16));
  const outRows = Math.max(0, Math.floor((frame - (dur - 8)) * 20));
  if (!feature?.widget) return null;
  return (
    <AbsoluteFill style={{ clipPath: `inset(${outRows * P}px 0 ${(160 - rows) * P}px 0)` }}>
      <Room ground={105} window="none" wall="#33313F" />
      <div style={{ position: "absolute", left: MON_X * P, top: MON_Y * P }}>
        <PixelArt canvas={monitor} />
      </div>
      <div style={{ position: "absolute", left: (MON_X - 5) * P, top: 94 * P }}>
        <PixelArt canvas={desk} />
      </div>
      <div style={{ position: "absolute", left: (MON_X + 2) * P, top: (MON_Y + 2) * P, width: 70 * P, height: 60 * P, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 20, top: 24 }}>
          <FeatureWidget widget={feature.widget} width={800} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 12 * P, display: "flex", justifyContent: "center", alignItems: "center", gap: P }}>
        <Img src={staticFile(`apps/${app.slug}/${app.icon}`)} style={{ width: 4 * P, height: 4 * P, imageRendering: "pixelated" }} />
        <span style={{ fontFamily: PIXELIFY, fontWeight: 700, fontSize: 34, color: PAL.paper, textTransform: "uppercase" }}>{app.name}</span>
        <span style={{ fontFamily: PIXELIFY, fontWeight: 700, fontSize: 28, color: PAL.ink, background: PAL.lime, padding: `0 ${P / 2}px` }}>{app.url}</span>
      </div>
    </AbsoluteFill>
  );
};

/** Carte de fin : invitation à s'abonner, un personnage qui salue, l'app en tout petit. */
const EndCard: React.FC = () => {
  const { app } = useTheme();
  const frame = useCurrentFrame();
  const o = Math.min(1, Math.floor(frame / 3) / 3);
  return (
    <AbsoluteFill style={{ background: `rgba(11,11,14,${0.94 * o})` }}>
      <Title text="Follow for the *next* story" y={44} at={3} size={84} />
      <Person look="dev" x={COLS / 2} y={102} at={6} pose="cheer" face="left" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 106 * P, display: "flex", justifyContent: "center", alignItems: "center", gap: P, opacity: interpolate(frame, [16, 17], [0, 0.9], clamp) }}>
        <Img src={staticFile(`apps/${app.slug}/${app.icon}`)} style={{ width: 3 * P, height: 3 * P }} />
        <span style={{ fontFamily: PIXELIFY, fontWeight: 700, fontSize: 28, color: PAL.paper2, textTransform: "uppercase" }}>told by {app.name}</span>
      </div>
    </AbsoluteFill>
  );
};

const Inner: React.FC<TaleVideoProps & { Story: React.FC<StoryProps> }> = ({ tale, Story }) => {
  const { timeline, words } = useTale();
  const product = tale.beats.findIndex((b) => b.id === tale.product.beat);
  return (
    <>
      <Story tale={tale} timeline={timeline} />
      {product >= 0 ? (
        <Sequence from={timeline.beats[product].from} durationInFrames={timeline.beats[product].dur} name="produit">
          <ProductCameo dur={timeline.beats[product].dur} />
        </Sequence>
      ) : null}
      {tale.beats.map((b, i) => {
        const seg = tale.voice?.segments[i];
        const tb = timeline.beats[i];
        return (
          <Sequence key={b.id} from={tb.from} durationInFrames={tb.dur} name={`voix ${b.id}`} layout="none">
            {seg ? (
              <Sequence from={TALE_VOICE_DELAY} layout="none">
                <Audio src={staticFile(seg.file)} volume={1} />
              </Sequence>
            ) : null}
            <PixelCaptions words={seg?.words ?? words[i]} />
          </Sequence>
        );
      })}
      <Sequence from={timeline.totalFrames - END} durationInFrames={END} name="fin">
        <EndCard />
      </Sequence>
    </>
  );
};

export const TaleVideo: React.FC<TaleVideoProps & { Story: React.FC<StoryProps> }> = (props) => {
  const { tale, app } = props;
  const timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments);
  return (
    <ThemeProvider app={app} lang="en">
      <AbsoluteFill
        style={{
          background: PAL.ink,
          overflow: "hidden",
          ["--heading" as string]: font(app.brand.heading),
          ["--body" as string]: font(app.brand.body),
          ["--mono" as string]: MONO,
        }}
      >
        <SfxMute.Provider value={true}>
          <TaleProvider tale={tale} timeline={timeline}>
            <Inner {...props} />
          </TaleProvider>
        </SfxMute.Provider>
        {tale.musicTrack ? (
          <Audio
            src={staticFile(tale.musicTrack.file)}
            volume={(f) => interpolate(f, [0, 3, timeline.totalFrames - 12, timeline.totalFrames], [0.7, 1, 1, 0], clamp) * MUSIC_BED}
          />
        ) : null}
      </AbsoluteFill>
    </ThemeProvider>
  );
};

/** Composant de composition pour une story donnée (Root et l'aperçu de tale-check). */
export const makeTaleVideo = (Story: React.FC<StoryProps>): React.FC<TaleVideoProps> => {
  const C: React.FC<TaleVideoProps> = (p) => <TaleVideo {...p} Story={Story} />;
  return C;
};
