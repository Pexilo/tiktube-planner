import React from "react";
import { AbsoluteFill, Freeze } from "remotion";
import { cleanTitle, taleThumbFrame, taleTimeline } from "../../shared/tales.mjs";
import { SfxMute } from "../components/fx";
import { font, MONO, ThemeProvider } from "../lib/theme";
import { TaleProvider } from "./kit/core";
import { Canvas, COLS, P, PAL, PixelArt } from "./pixel/engine";
import { Title, titleHeight, TitleOff } from "./pixel/props";
import type { TaleVideoProps } from "./TaleVideo";
import type { StoryProps } from "./types";

/*
 * Miniature d'une story (1080 × 1920, écrite à la main, jamais par Claude) : un plan de la story figé (le hook par défaut,
 * `tale.thumb.beat` à `tale.thumb.at` sinon : shared/tales.mjs → taleThumbFrame), sans sous-titres ni titre à l'écran,
 * plein cadre et agrandi autour du sol pour que le sujet remplisse l'image, le texte posé sous le sol, à la place des
 * sous-titres de la vidéo. Même police, même grille et même palette que la vidéo (PIXEL.md).
 */

/** Ligne du sol de la scène (px) : point fixe du zoom, le sujet grandit vers le haut. */
const GROUND_PX = 1260;
/** Zoom du plan : le haut du cadre (vide, sous l'interface de la plateforme) sort de l'image. */
const ZOOM = 1.18;
/** Ligne du haut du texte (cellules) : sous le sol, dans la zone des sous-titres. */
const TEXT_Y = 117;

/** Met en avant (bloc rose) le premier mot qui porte un chiffre (« $388M », « 8,000 ») si le titre n'a pas de *mot*. */
export function thumbText(title: string) {
  const t = cleanTitle(title);
  if (t.includes("*")) return t;
  return t.replace(/\S*\d\S*/, (w) => {
    const [, core, tail] = /^(.*?)([.,!?:;]*)$/.exec(w)!;
    return `*${core}*${tail}`;
  });
}

/** Voile encre sous le texte : le reflet du sol reste lisible derrière sans gêner la lecture. */
const Shade: React.FC<{ text: string }> = ({ text }) => {
  const [y0, h] = [TEXT_Y - 4, Math.ceil(titleHeight(text)) + 8];
  return (
    <div style={{ position: "absolute", left: 0, top: y0 * P, opacity: 0.55 }}>
      <PixelArt canvas={new Canvas().rect(0, 0, COLS, h, PAL.ink)} />
    </div>
  );
};

export const TaleThumb: React.FC<TaleVideoProps & { Story: React.FC<StoryProps> }> = ({ tale, app, Story }) => {
  const timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments);
  const title = tale.thumb?.title;
  const text = thumbText(title === "hook" && tale.hook ? tale.hook : title && title !== "hook" ? title : tale.yt.title);
  return (
    <ThemeProvider app={app} lang={tale.lang ?? "en"}>
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
            <TitleOff.Provider value={true}>
              <AbsoluteFill style={{ transform: `scale(${ZOOM})`, transformOrigin: `50% ${GROUND_PX}px` }}>
                <Freeze frame={taleThumbFrame(tale, timeline)}>
                  <Story tale={tale} timeline={timeline} />
                </Freeze>
              </AbsoluteFill>
            </TitleOff.Provider>
          </TaleProvider>
        </SfxMute.Provider>
        <Shade text={text} />
        <Title text={text} y={TEXT_Y} at={-1000} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

export const makeTaleThumb = (Story: React.FC<StoryProps>): React.FC<TaleVideoProps> => {
  const C: React.FC<TaleVideoProps> = (p) => <TaleThumb {...p} Story={Story} />;
  return C;
};
