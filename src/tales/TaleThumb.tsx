import React from "react";
import { AbsoluteFill, Freeze } from "remotion";
import { cleanTitle, taleThumbFrame, taleTimeline } from "../../shared/tales.mjs";
import { SfxMute } from "../components/fx";
import { font, MONO, ThemeProvider } from "../lib/theme";
import { TaleProvider } from "./kit/core";
import { Canvas, COLS, P, PAL, PixelArt } from "./pixel/engine";
import { Title, titleHeight, titleLineCount, TitleOff } from "./pixel/props";
import type { TaleVideoProps } from "./TaleVideo";
import type { StoryProps } from "./types";

/*
 * Miniature d'une story (1080 × 1920, écrite à la main, jamais par Claude) : un plan de la story figé (le hook par défaut,
 * `tale.thumb.beat` à `tale.thumb.at` sinon : shared/tales.mjs → taleThumbFrame), sans sous-titres ni titre à l'écran,
 * plein cadre et agrandi autour du sol pour que le sujet remplisse l'image. Une version par plateforme (THUMB_VARIANTS).
 * Même police, même grille et même palette que la vidéo (PIXEL.md).
 */

/** Ligne du sol de la scène dans la vidéo (px) : point fixe du zoom, le sujet grandit vers le haut. */
const GROUND_PX = 1260;
/**
 * Les grilles de profil TikTok et Instagram recadrent la miniature en 3:4 au centre : 240 px coupés en haut et en bas.
 * - youtube : sans texte (le titre de la vidéo s'affiche sous la miniature), envoyée par l'API ;
 * - instagram : texte sous le sol, remonté pour rester au-dessus de la coupe du bas ;
 * - tiktok : texte en haut, sous la coupe du haut (le compteur de vues de TikTok couvre le bas de la grille), la scène
 *   descend sous le texte.
 * `ground` = où tombe la ligne du sol (px), `zoom` = agrandissement du plan, `textY` = ligne du haut du texte (cellules),
 * `shade` = voile encre sous le texte (sur le reflet du sol ; en haut, le fond est déjà sombre et le voile s'y verrait).
 */
export const THUMB_VARIANTS = {
  youtube: { ground: 1260, zoom: 1.18, textY: null, shade: false },
  instagram: { ground: 1200, zoom: 1.18, textY: 110, shade: true },
  tiktok: { ground: 1480, zoom: 1, textY: 24, shade: false },
} as const;
export type ThumbVariant = keyof typeof THUMB_VARIANTS;
/** Lignes de texte au plus sur la miniature : au-delà, le texte passe sous l'interface de la plateforme et se lit mal. */
const MAX_LINES = 2;

/** Met en avant (bloc rose) le premier mot qui porte un chiffre (« $388M », « 8,000 ») si le titre n'a pas de *mot*. */
export function thumbText(title: string) {
  const t = cleanTitle(title);
  if (t.includes("*")) return t;
  return t.replace(/\S*\d\S*/, (w) => {
    const [, core, tail] = /^(.*?)([.,!?:;]*)$/.exec(w)!;
    return `*${core}*${tail}`;
  });
}

/**
 * Texte de la miniature : celui demandé (`thumb.title` : "hook", texte libre, le titre YouTube sinon), ou à défaut le
 * premier de hook / titre YouTube qui tient sur MAX_LINES lignes. Si aucun ne tient, le texte demandé (signalé en console).
 */
function pickText(tale: TaleVideoProps["tale"]) {
  const t = tale.thumb?.title;
  const asked = thumbText(t === "hook" && tale.hook ? tale.hook : t && t !== "hook" ? t : tale.yt.title);
  const fits = [asked, tale.hook, tale.yt.title].filter(Boolean).map((s) => thumbText(s)).find((s) => titleLineCount(s) <= MAX_LINES);
  if (!fits) console.warn(`Miniature ${tale.id} : « ${asked} » dépasse ${MAX_LINES} lignes, raccourcir thumb.title.`);
  return fits ?? asked;
}

/** Voile encre sous le texte : le reflet du sol reste lisible derrière sans gêner la lecture. */
const Shade: React.FC<{ text: string; y: number }> = ({ text, y }) => {
  const [y0, h] = [y - 4, Math.ceil(titleHeight(text)) + 8];
  return (
    <div style={{ position: "absolute", left: 0, top: y0 * P, opacity: 0.55 }}>
      <PixelArt canvas={new Canvas().rect(0, 0, COLS, h, PAL.ink)} />
    </div>
  );
};

export const TaleThumb: React.FC<TaleVideoProps & { Story: React.FC<StoryProps>; variant: ThumbVariant }> = ({ tale, app, Story, variant }) => {
  const timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments);
  const { ground, zoom, textY, shade } = THUMB_VARIANTS[variant];
  const text = textY === null ? null : pickText(tale);
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
              <AbsoluteFill style={{ transform: `translateY(${ground - GROUND_PX}px) scale(${zoom})`, transformOrigin: `50% ${GROUND_PX}px` }}>
                <Freeze frame={taleThumbFrame(tale, timeline)}>
                  <Story tale={tale} timeline={timeline} />
                </Freeze>
              </AbsoluteFill>
            </TitleOff.Provider>
          </TaleProvider>
        </SfxMute.Provider>
        {text !== null && textY !== null ? (
          <>
            {shade ? <Shade text={text} y={textY} /> : null}
            <Title text={text} y={textY} at={-1000} />
          </>
        ) : null}
      </AbsoluteFill>
    </ThemeProvider>
  );
};

export const makeTaleThumb = (Story: React.FC<StoryProps>, variant: ThumbVariant): React.FC<TaleVideoProps> => {
  const C: React.FC<TaleVideoProps> = (p) => <TaleThumb {...p} Story={Story} variant={variant} />;
  return C;
};
