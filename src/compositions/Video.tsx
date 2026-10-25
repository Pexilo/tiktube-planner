import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { BAR, BEAT, buildTimeline, musicFor } from "../../shared/timeline.mjs";
import { font, ThemeProvider, useTheme } from "../lib/theme";
import type { VideoProps } from "../lib/types";
import { clamp } from "../components/fx";
import { HUD, LightLeak, Transition, TRANSITION_LEN, type TransitionType } from "../components/pro";
import { HookScene } from "../scenes/Hook";
import { Captions } from "../components/captions";
import { ProblemScene } from "../scenes/Problem";
import { RevealScene } from "../scenes/Reveal";
import { FeatureScene } from "../scenes/Feature";
import { MontageScene } from "../scenes/Montage";
import { BenefitsScene } from "../scenes/Benefits";
import { CTAScene } from "../scenes/CTA";

/** Petit zoom "punch" sur chaque temps après le drop : l'image respire avec le kick. */
const BeatPulse: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const on = frame >= from && frame < to;
  const k = on ? 0 * BEAT : 0; // plus de zoom sur chaque temps (confort visuel)
  return <AbsoluteFill style={{ transform: `scale(${1 + k * 0.012})` }}>{children}</AbsoluteFill>;
};

const TRANSITION_FOR: Record<string, TransitionType[]> = {
  problem: ["slice"],
  reveal: ["iris"],
  feature: ["bars", "slice", "streak"],
  montage: ["streak"],
  benefits: ["bars"],
  cta: ["iris"],
};

/** Habillage éditorial global (section courante, compteur, progression) — après le hook. */
const Overlay: React.FC<{ tl: ReturnType<typeof buildTimeline>; dropFrame: number }> = ({ tl, dropFrame }) => {
  const { lang } = useTheme();
  const frame = useCurrentFrame();
  const fr = lang === "fr";
  const hookEnd = tl.scenes[0].dur;
  const o = interpolate(frame, [hookEnd, hookEnd + 10, tl.totalFrames - 12, tl.totalFrames], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  const sc = [...tl.scenes].reverse().find((s) => frame >= s.from) ?? tl.scenes[0];
  const nFeat = tl.scenes.filter((s) => s.type === "feature").length;
  const labels: Record<string, string> = {
    problem: fr ? "le problème" : "the problem",
    reveal: fr ? "présentation" : "introducing",
    feature: `feature ${String((sc.featureIndex ?? 0) + 1).padStart(2, "0")}`,
    montage: fr ? "aperçu" : "overview",
    benefits: fr ? "tarifs" : "pricing",
    cta: fr ? "télécharger" : "download",
  };
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <HUD
        section={labels[sc.type] ?? ""}
        counter={sc.type === "feature" ? `${String((sc.featureIndex ?? 0) + 1).padStart(2, "0")} / ${String(nFeat).padStart(2, "0")}` : undefined}
        progress={frame / tl.totalFrames}
        beatFrame={Math.max(0, frame - dropFrame)}
      />
    </AbsoluteFill>
  );
};

const VOICE_DELAY = 8; // la voix démarre 8 frames après le début de la scène

const Scenes: React.FC<VideoProps> = ({ app, kind, shortIndex, voice }) => {
  const { t, u } = useTheme();
  const tl = buildTimeline(app, kind, shortIndex, voice);
  const byId = Object.fromEntries(app.features.map((f) => [f.id, f]));
  const dropFrame = tl.dropBar * BAR;
  const ctaFrame = tl.ctaBar * BAR;
  return (
    <>
      <BeatPulse from={dropFrame} to={ctaFrame}>
        {tl.scenes.map((s, i) => {
          let el: React.ReactNode = null;
          if (s.type === "hook")
            el =
              kind === "story" ? (
                <HookScene lines={[t(app.stories![shortIndex].hook)]} lineDur={s.dur} />
              ) : (
                <HookScene lines={kind === "short" ? [t(app.shorts[shortIndex].hook)] : app.long.hook.map(t)} />
              );
          if (s.type === "problem") el = <ProblemScene dur={s.dur} />;
          if (s.type === "reveal") el = <RevealScene dur={s.dur} drop={s.from === dropFrame} />;
          if (s.type === "feature") el = <FeatureScene feature={byId[s.featureId!]} index={s.featureIndex!} dur={s.dur} compact={kind === "story"} />;
          if (s.type === "montage") el = <MontageScene dur={s.dur} />;
          if (s.type === "benefits") el = <BenefitsScene dur={s.dur} />;
          if (s.type === "cta") el = <CTAScene dur={s.dur} />;
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur} name={`${s.type}${s.featureId ? `:${s.featureId}` : ""}`}>
              {el}
            </Sequence>
          );
        })}
      </BeatPulse>
      <Overlay tl={tl} dropFrame={dropFrame} />
      {tl.scenes.slice(1).map((s, i) => {
        const opts = TRANSITION_FOR[s.type] ?? ["bars"];
        const type = opts[(s.featureIndex ?? i) % opts.length];
        return (
          <Sequence key={`t${i}`} from={s.from - TRANSITION_LEN / 2} durationInFrames={TRANSITION_LEN} name={`transition:${type}`}>
            <Transition type={type} />
          </Sequence>
        );
      })}
      <Sequence from={dropFrame} durationInFrames={60}>
        <LightLeak dur={50} />
      </Sequence>
      {kind === "story" && voice
        ? tl.scenes
            .filter((s) => s.voiceSeg !== undefined && voice.segments[s.voiceSeg])
            .map((s) => {
              const seg = voice.segments[s.voiceSeg!];
              return (
                <Sequence key={`v${s.voiceSeg}`} from={s.from} durationInFrames={s.dur} name={`voix ${s.voiceSeg}`}>
                  <Sequence from={VOICE_DELAY} layout="none">
                    <Audio src={staticFile(seg.file)} volume={1} />
                  </Sequence>
                  {s.type !== "hook" ? <Captions words={seg.words} offset={VOICE_DELAY} y={(s.type === "cta" ? 1440 : s.type === "feature" && byId[s.featureId!]?.widget ? 1500 : 1390) * u} /> : null}
                </Sequence>
              );
            })
        : null}
    </>
  );
};

export const Video: React.FC<VideoProps> = (props) => {
  const { app, lang, kind, shortIndex, voice } = props;
  const tl = buildTimeline(app, kind, shortIndex, voice);
  const music = musicFor(app, kind, shortIndex, voice);
  // Vidéo narrée : musique à niveau constant sous la voix (pas de remontée entre les phrases).
  const bed = kind === "story" && voice ? 0.32 : 1;
  return (
    <ThemeProvider app={app} lang={lang}>
      <AbsoluteFill style={{ background: app.brand.bg, ["--heading" as string]: font(app.brand.heading) }}>
        <Scenes {...props} />
        <Audio
          src={staticFile(music.file)}
          volume={(f) => interpolate(f, [0, 3, tl.totalFrames - 10, tl.totalFrames], [0.6, 0.85, 0.85, 0], clamp) * bed}
        />
      </AbsoluteFill>
    </ThemeProvider>
  );
};
