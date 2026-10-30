import React from "react";
import { AbsoluteFill, Freeze } from "remotion";
import { cleanTitle, taleThumbFrame, taleTimeline } from "../../shared/tales.mjs";
import { SfxMute } from "../components/fx";
import { font, MONO, ThemeProvider } from "../lib/theme";
import { TaleProvider } from "./kit/core";
import { Canvas, COLS, P, PAL, PixelArt } from "./pixel/engine";
import { SAFE_TOP } from "./pixel/layout";
import { Title, titleHeight, TitleOff } from "./pixel/props";
import type { TaleVideoProps } from "./TaleVideo";
import type { StoryProps } from "./types";

/*
 * Miniature d'une story (1080 × 1920, écrite à la main, jamais par Claude) : un plan de la story figé (le hook par défaut,
 * `tale.thumb.beat` sinon : shared/tales.mjs → taleThumbFrame), sans sous-titres ni titre à l'écran, et le titre YouTube
 * nettoyé dans un en-tête encre, le plan décalé dessous. Même police, même grille et même palette que la vidéo (PIXEL.md).
 */

/** Ligne du haut du titre (celle du titre des plans, sous la barre du haut de la plateforme), marge sous le titre, plus grand décalage du plan (cellules). */
const TITLE_Y = SAFE_TOP;
const BAND_PAD = 3;
const MAX_SHIFT = 24;

/** Met en avant (bloc rose) le premier mot qui porte un chiffre (« $388M », « 8,000 ») si le titre n'a pas de *mot*. */
export function thumbText(title: string) {
  const t = cleanTitle(title)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (t.includes("*")) return t;
  return t.replace(/\S*\d\S*/, (w) => {
    const [, core, tail] = /^(.*?)([.,!?:;]*)$/.exec(w)!;
    return `*${core}*${tail}`;
  });
}

/** Bas de l'en-tête encre (cellules) : le titre de la miniature et sa marge. */
const headerBottom = (text: string) => TITLE_Y + Math.ceil(titleHeight(text)) + BAND_PAD;
/**
 * Décalage du plan vers le bas (cellules entières) : le sujet (au-dessus du sol, ligne 105) descend sous l'en-tête, dans la
 * zone que les sous-titres occupent dans la vidéo, sans passer sous l'interface de la plateforme en bas.
 */
const sceneShift = (text: string) => Math.max(0, Math.min(MAX_SHIFT, headerBottom(text) - 40));

const Header: React.FC<{ text: string }> = ({ text }) => {
  const h = headerBottom(text);
  const band = new Canvas().rect(0, 0, COLS, h, PAL.ink).rect(0, h, COLS, 1, PAL.ink3);
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <PixelArt canvas={band} />
      </div>
      <Title text={text} y={TITLE_Y} at={-1000} />
    </>
  );
};

export const TaleThumb: React.FC<TaleVideoProps & { Story: React.FC<StoryProps> }> = ({ tale, app, Story }) => {
  const timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments);
  const text = thumbText(tale.thumb?.title === "hook" && tale.hook ? tale.hook : tale.yt.title);
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
              <AbsoluteFill style={{ transform: `translateY(${sceneShift(text) * P}px)` }}>
                <Freeze frame={taleThumbFrame(tale, timeline)}>
                  <Story tale={tale} timeline={timeline} />
                </Freeze>
              </AbsoluteFill>
            </TitleOff.Provider>
          </TaleProvider>
        </SfxMute.Provider>
        <Header text={text} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

export const makeTaleThumb = (Story: React.FC<StoryProps>): React.FC<TaleVideoProps> => {
  const C: React.FC<TaleVideoProps> = (p) => <TaleThumb {...p} Story={Story} />;
  return C;
};
