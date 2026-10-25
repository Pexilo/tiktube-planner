import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TALE_VOICE_DELAY, taleTimeline } from "../../shared/tales.mjs";
import { Captions } from "../components/captions";
import { Backdrop, clamp, EASE_IN_OUT, Sfx } from "../components/fx";
import { FeatureWidget } from "../components/widgets";
import { font, MONO, ThemeProvider, useTheme } from "../lib/theme";
import type { AppContent } from "../lib/types";
import { INK, LIME, monoStyle, PAPER, PINK, STAGE_BOX, Stage, TaleProvider, useEnter, useTale } from "./kit/core";
import { Title } from "./kit/things";
import type { StoryProps, Tale } from "./types";

/*
 * Habillage fixe d'une story crypto (écrit à la main, jamais par Claude) :
 * fond registre (pas d'en-tête : il casse l'immersion), voix off + sous-titres mot à mot, musique sous la voix,
 * moment produit (~5 s, feature WGG réelle) et carte de fin. Claude n'écrit que <Story /> (les visuels de la scène).
 */

export type TaleVideoProps = { tale: Tale; app: AppContent };

/** Bandeau défilant du fond : identité de la série plutôt que la pub de l'app. */
const TAPE = { fr: "Crypto stories · histoires vraies on-chain · abonne-toi pour la suite", en: "Crypto stories · true stories on-chain · follow for the next one" };
const MUSIC_BED = 0.3;
const END = 54; // durée de la carte de fin (frames), sur la queue du dernier beat

/** Moment produit : la feature WGG liée à l'histoire, sur une fiche qui couvre la scène pendant le beat "product". */
const ProductCameo: React.FC<{ dur: number }> = ({ dur }) => {
  const { app } = useTheme();
  const { tale } = useTale();
  const frame = useCurrentFrame();
  const feature = app.features.find((f) => f.id === tale.product.featureId) ?? app.features.find((f) => f.widget);
  const enter = useEnter(0, { damping: 15, stiffness: 150 });
  const out = interpolate(frame, [dur - 10, dur], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  if (!feature?.widget) return null;
  return (
    <div style={{ position: "absolute", ...STAGE_BOX, transform: `translateX(${(1 - enter) * 1100 - out * 1100}px)` }}>
      <div style={{ position: "absolute", inset: 0, background: INK, border: `4px solid ${PAPER}`, boxShadow: `14px 14px 0 ${PINK}` }} />
      <div style={{ position: "absolute", left: 30, right: 30, top: 26, display: "flex", alignItems: "center", gap: 14 }}>
        <Img src={staticFile(`apps/${app.slug}/${app.icon}`)} style={{ width: 54, height: 54, borderRadius: 14, border: `3px solid ${PAPER}` }} />
        <div style={{ ...monoStyle(15, PAPER) }}>{app.name}</div>
        <div style={{ marginLeft: "auto", ...monoStyle(14, INK), background: LIME, padding: "4px 10px" }}>{app.url}</div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 130 }}>
        <FeatureWidget widget={feature.widget} width={920} />
      </div>
      <Sfx name="whoosh" at={0} volume={0.45} />
    </div>
  );
};

/** Carte de fin : invitation à s'abonner, l'app en tout petit. */
const EndCard: React.FC = () => {
  const { app } = useTheme();
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  return (
    <AbsoluteFill style={{ background: `rgba(11,11,14,${0.93 * o})` }}>
      <Title x={540} y={860} at={2} text="Follow for the *next* story" size={104} w={900} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1110, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, opacity: interpolate(frame, [16, 26], [0, 0.85], clamp) }}>
        <Img src={staticFile(`apps/${app.slug}/${app.icon}`)} style={{ width: 40, height: 40, borderRadius: 10 }} />
        <span style={monoStyle(14, PAPER)}>told by {app.name} · {app.url}</span>
      </div>
    </AbsoluteFill>
  );
};

const Inner: React.FC<TaleVideoProps & { Story: React.FC<StoryProps> }> = ({ tale, Story }) => {
  const { timeline } = useTale();
  const product = tale.beats.findIndex((b) => b.id === tale.product.beat);
  return (
    <>
      <Backdrop seed={7} />
      <Stage>
        <Story tale={tale} timeline={timeline} />
      </Stage>
      {product >= 0 ? (
        <Sequence from={timeline.beats[product].from} durationInFrames={timeline.beats[product].dur} name="produit">
          <ProductCameo dur={timeline.beats[product].dur} />
        </Sequence>
      ) : null}
      {tale.beats.map((b, i) => {
        const seg = tale.voice?.segments[i];
        const tb = timeline.beats[i];
        const words = seg?.words;
        return (
          <Sequence key={b.id} from={tb.from} durationInFrames={tb.dur} name={`voix ${b.id}`} layout="none">
            {seg ? (
              <Sequence from={TALE_VOICE_DELAY} layout="none">
                <Audio src={staticFile(seg.file)} volume={1} />
              </Sequence>
            ) : null}
            <CaptionsFor index={i} words={words} />
          </Sequence>
        );
      })}
      <Sequence from={timeline.totalFrames - END} durationInFrames={END} name="fin">
        <EndCard />
      </Sequence>
    </>
  );
};

/** Sous-titres d'un beat (mots réels de la voix, ou estimés tant qu'elle n'existe pas). */
const CaptionsFor: React.FC<{ index: number; words?: { w: string; s: number; e: number }[] }> = ({ index, words }) => {
  const { words: all } = useTale();
  return <Captions words={words ?? all[index]} offset={TALE_VOICE_DELAY} y={STAGE_BOX.top + STAGE_BOX.height + 50} />;
};

export const TaleVideo: React.FC<TaleVideoProps & { Story: React.FC<StoryProps> }> = (props) => {
  const { tale, app } = props;
  const timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments);
  const branded: AppContent = { ...app, tape: TAPE };
  return (
    <ThemeProvider app={branded} lang="en">
      <AbsoluteFill
        style={{
          background: app.brand.bg,
          ["--heading" as string]: font(app.brand.heading),
          ["--body" as string]: font(app.brand.body),
          ["--mono" as string]: MONO,
        }}
      >
        <TaleProvider tale={tale} timeline={timeline}>
          <Inner {...props} />
        </TaleProvider>
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
