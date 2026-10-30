import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { SFX_MAX_GAIN, STORY_SFX, sfxFile } from "../../shared/tale-sfx.mjs";
import { TALE_VOICE_DELAY, taleTimeline } from "../../shared/tales.mjs";
import { clamp, SfxMute } from "../components/fx";
import { FeatureWidget } from "../components/widgets";
import { font, MONO, ThemeProvider, useTheme } from "../lib/theme";
import type { AppContent } from "../lib/types";
import { loopHoldFrom, TaleProvider, useTale, type Word } from "./kit/core";
import { Sound } from "./kit/sfx";
import { Canvas, P, PAL, PixelArt } from "./pixel/engine";
import { CAPTION_ROW, SAFE_LEFT, SAFE_RIGHT, SAFE_TOP } from "./pixel/layout";
import { drawText, PixelText, textWidth } from "./pixel/font";
import { Backdrop } from "./pixel/backdrop";
import { Label } from "./pixel/props";
import type { StoryProps, Tale } from "./types";
import { GROUND as HD_GROUND, P as HP } from "./hd/grid";
import { RAMPS, tone } from "./hd/palette";
import { Pix } from "./hd/pixelize";
import { CRT, crtMonitor } from "./hd/sources";
import { Stage as HDStage, Txt, type Scene } from "./hd/stage";

/*
 * Habillage fixe d'une story crypto en pixel art (écrit à la main, jamais par Claude) :
 * fond encre, voix off + sous-titres pixel mot à mot, pas de musique : des bruitages narratifs choisis par le script (suspense,
 * révélation, tension, calés sur un mot) et les petits sons d'animation joués par le kit,
 * moment produit (~5 s : le vrai widget Where'd Gains Go? dans un écran pixel). Pas de carte de fin : le dernier plan boucle
 * sur le premier (<Beat loop>), la plateforme relance la vidéo sans saut d'image.
 * Claude n'écrit que <Story /> : les plans, sur la grille de 90 × 160 cellules.
 */

export type TaleVideoProps = { tale: Tale; app: AppContent };

/** Nappes narratives (drone, battements, horloge…) : baisse supplémentaire pendant que le narrateur parle. */
const DUCK = 0.45;

/**
 * Enveloppe de ducking, une valeur par frame (0 = pas de baisse, 1 = baisse complète) : la nappe descend 4 frames avant
 * chaque mot et remonte doucement (~0,5 s) dans les pauses. Calculée sur les mots horodatés de la voix (ou estimés).
 */
function duckEnvelope(totalFrames: number, timeline: { beats: { from: number }[] }, words: Word[][]) {
  const speak = new Float32Array(totalFrames);
  words.forEach((ws, i) =>
    ws.forEach((w) => {
      const a = timeline.beats[i].from + TALE_VOICE_DELAY + Math.floor(w.s * 30) - 4;
      const b = timeline.beats[i].from + TALE_VOICE_DELAY + Math.ceil(w.e * 30) + 2;
      for (let f = Math.max(0, a); f < Math.min(totalFrames, b); f++) speak[f] = 1;
    }),
  );
  const env = new Float32Array(totalFrames);
  let v = 0;
  for (let f = 0; f < totalFrames; f++) {
    v = speak[f] ? Math.min(1, v + 0.25) : Math.max(0, v - 1 / 15);
    env[f] = v;
  }
  return env;
}
/** Pixel de lettre des sous-titres (px) : 9 px, plus discret que les titres (12 px). Lettres de 45 × 63 px. */
const CAP_P = 9;
/** Stories HD : une cellule de la grille (6 px), lettres de 30 × 42 px, alignées sur le reste de l'image. */
const CAP_P_HD = 6;
/** Caractères au plus par groupe : le bloc tient dans la largeur de la zone sûre (≤ 900 px). */
const CAP_CHARS = 15;

/**
 * Sous-titres pixel : petits groupes de mots (coupés à la ponctuation), mot prononcé en lime, sur un bloc encre. Dans le bas de la
 * zone sûre (lignes CAPTION_ROW–SAFE_END), centrés entre le bord gauche et la colonne des boutons de la plateforme.
 */
const PixelCaptions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  // Story HD (premier plan sur un plateau HD, enregistré par les <Beat> rendus avant les sous-titres) : pixels de la grille HD.
  const { tale, looks } = useTale();
  const cp = looks.get(tale.beats[0].id)?.scene ? CAP_P_HD : CAP_P;
  const t = (frame - TALE_VOICE_DELAY) / 30;
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const len = cur.reduce((a, x) => a + x.w.length + 1, 0) + w.w.length;
    if (cur.length && len > CAP_CHARS) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.,:;!?]$/.test(w.w)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const gi = groups.findIndex((g, i) => t >= g[0].s - 0.05 && (i === groups.length - 1 ? t <= g.at(-1)!.e + 0.6 : t < groups[i + 1][0].s - 0.05));
  if (gi < 0) return null;
  const g = groups[gi];
  // Une seule grille au pas des lettres (CAP_P) : bloc encre, mots en papier, mot prononcé sur un bloc lime.
  const sizes = g.map((w) => textWidth(w.w));
  const gap = 4;
  const pad = 2;
  const inner = sizes.reduce((a, s) => a + s, 0) + gap * (g.length - 1);
  const h = 7 + pad * 2;
  const c = new Canvas().rect(1, 1, inner + pad * 2, h, PAL.ink3).rect(0, 0, inner + pad * 2, h, PAL.ink);
  let x = pad;
  g.forEach((w, i) => {
    const active = t >= w.s && t < (g[i + 1]?.s ?? w.e + 0.4);
    if (active) c.rect(x - 1, 1, sizes[i] + 2, h - 2, PAL.lime);
    drawText(c, w.w, x, pad, active ? PAL.ink : PAL.paper);
    x += sizes[i] + gap;
  });
  const wPx = (inner + pad * 2 + 1) * cp;
  const mid = ((SAFE_LEFT + SAFE_RIGHT) / 2) * P;
  const left = Math.max(SAFE_LEFT * P, Math.min(SAFE_RIGHT * P - wPx, mid - wPx / 2));
  return (
    <div style={{ position: "absolute", left: Math.round(left / cp) * cp, top: CAPTION_ROW * P }}>
      <PixelArt canvas={c} p={cp} />
    </div>
  );
};

/** Moniteur pixel (cadre, pied) : écran de 70 × 60 cellules en (MON_X + 2, MON_Y + 2), centré dans la zone sûre. */
const MON_X = Math.round((SAFE_LEFT + SAFE_RIGHT) / 2) - 37;
const MON_Y = SAFE_TOP + 15;
const monitor = new Canvas().rect(0, 0, 74, 64, PAL.ink3).rect(1, 1, 72, 1, "#3B3948").rect(2, 2, 70, 60, "#0E1A14").rect(33, 64, 8, 5, PAL.grey).rect(24, 69, 26, 3, PAL.grey).set(68, 62, PAL.lime).outline();
const desk = new Canvas().rect(0, 0, 84, 3, "#8A5A3A").rect(2, 3, 3, 10, "#6E4A30").rect(79, 3, 3, 10, "#6E4A30").outline();

/** Plateau du moment produit des stories HD : le moniteur 2010 dans un projecteur, l'écran qui éclaire la pièce. */
const CAMEO_SCENE: Scene = {
  wall: RAMPS.ink[5],
  floor: RAMPS.ink[6],
  ambient: 0.16,
  lamps: [{ kind: "cone", x: 90, top: -40, spread: 0.3, core: 16, power: 0.7, beam: 0.35 }, { kind: "glow", x: 90, y: 112, r: 92, power: 0.45 }],
  dust: 60,
  seed: 21,
};
const CAMEO_W = 168;

/** Moment produit d'une story HD : le moniteur pixelisé des plans, et dedans la vraie feature (HTML net, jamais pixelisée). */
const CameoHD: React.FC<{ widget: React.ComponentProps<typeof FeatureWidget>["widget"]; name: string; url: string }> = ({ widget, name, url }) => {
  const s = CAMEO_W / CRT.w;
  const left = 90 - Math.round((CAMEO_W + 2) / 2);
  const top = HD_GROUND - (Math.round((CAMEO_W * CRT.h) / CRT.w) + 2);
  const [sx, sy] = [left + 1 + Math.round(CRT.screen[0] * s) + 2, top + 1 + Math.round(CRT.screen[1] * s) + 2];
  const [sw, sh] = [Math.floor(CRT.screen[2] * s) - 4, Math.floor(CRT.screen[3] * s) - 4];
  return (
    <HDStage scene={CAMEO_SCENE}>
      <Pix src={crtMonitor()} w={CAMEO_W} x={90} y={HD_GROUND} ramps={["stone", "ink", "lime"]} dither={0.45} />
      <div style={{ position: "absolute", left: sx * HP, top: sy * HP, width: sw * HP, height: sh * HP, overflow: "hidden", borderRadius: 24, background: RAMPS.ink[1] }}>
        <div style={{ position: "absolute", left: 16, top: 16, width: 800, transform: `scale(${(sw * HP - 32) / 800})`, transformOrigin: "0 0" }}>
          <FeatureWidget widget={widget} width={800} />
        </div>
      </div>
      <Txt text={name} x={90} y={214} />
      <Txt text={url} x={90} y={226} box={tone("lime", 3)} color={tone("ink", 1)} />
    </HDStage>
  );
};

/** Moment produit : un bureau, un écran pixel, et dedans la vraie feature Where'd Gains Go? liée à l'histoire. */
const ProductCameo: React.FC<{ dur: number }> = ({ dur }) => {
  const { app } = useTheme();
  const { tale, looks } = useTale();
  const frame = useCurrentFrame();
  const feature = app.features.find((f) => f.id === tale.product.featureId) ?? app.features.find((f) => f.widget);
  // Entrée et sortie en volets de lignes (paliers d'une cellule), pas en fondu.
  const rows = Math.min(160, Math.floor(frame * 16));
  const outRows = Math.max(0, Math.floor((frame - (dur - 8)) * 20));
  if (!feature?.widget) return null;
  // Story HD (premier plan sur un plateau HD) : le caméo prend le même moniteur et la même lumière que les plans.
  if (looks.get(tale.beats[0].id)?.scene)
    return (
      <AbsoluteFill style={{ clipPath: `inset(${outRows * P}px 0 ${(160 - rows) * P}px 0)` }}>
        <Sound name="a-cut" volume={0.6} />
        <Sound name="a-blip" at={10} volume={0.6} />
        <CameoHD widget={feature.widget} name={app.name} url={app.url} />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ clipPath: `inset(${outRows * P}px 0 ${(160 - rows) * P}px 0)` }}>
      <Backdrop tone="deep" />
      <Sound name="a-cut" volume={0.6} />
      <Sound name="a-blip" at={10} volume={0.6} />
      <div style={{ position: "absolute", left: MON_X * P, top: MON_Y * P }}>
        <PixelArt canvas={monitor} />
      </div>
      <div style={{ position: "absolute", left: (MON_X - 5) * P, top: (MON_Y + 72) * P }}>
        <PixelArt canvas={desk} />
      </div>
      <div style={{ position: "absolute", left: (MON_X + 2) * P, top: (MON_Y + 2) * P, width: 70 * P, height: 60 * P, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 20, top: 24 }}>
          <FeatureWidget widget={feature.widget} width={800} />
        </div>
      </div>
      <PixelText text={app.name} x={MON_X + 37} y={SAFE_TOP} />
      <Label x={MON_X + 37} y={SAFE_TOP + 8} text={app.url} color={PAL.lime} />
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
        // Dernier beat : les sous-titres s'arrêtent quand l'image revient sur la frame 0 (qui n'en a pas).
        const ws = seg?.words ?? words[i];
        const last = i === tale.beats.length - 1;
        const dur = last ? loopHoldFrom(timeline.totalFrames - tb.from, TALE_VOICE_DELAY + Math.round((ws.at(-1)?.e ?? 0) * 30)) : tb.dur;
        return (
          <Sequence key={b.id} from={tb.from} durationInFrames={Math.max(1, dur)} name={`voix ${b.id}`} layout="none">
            {seg ? (
              <Sequence from={TALE_VOICE_DELAY} layout="none">
                <Audio src={staticFile(seg.file)} volume={1} />
              </Sequence>
            ) : null}
            <Sequence durationInFrames={Math.max(1, dur)} layout="none">
              <PixelCaptions words={ws} />
            </Sequence>
          </Sequence>
        );
      })}
    </>
  );
};

const norm = (s: string) => s.toLowerCase().replace(/[^p{L}p{N}]/gu, "");

/**
 * Bruitages narratifs du script (`beat.sfx`), calés sur le mot choisi (début de la phrase sans mot) :
 * un impact démarre sur le mot, une montée se termine sur le mot, une nappe tient du mot à la fin de la phrase
 * (bouclée, fondue, et plus basse pendant que le narrateur parle). Tout s'éteint avant la dernière frame : la boucle reste propre.
 */
const StorySfx: React.FC = () => {
  const { tale, timeline, words } = useTale();
  const total = timeline.totalFrames;
  const env = React.useMemo(() => duckEnvelope(total, timeline, words), [total, timeline, words]);
  return (
    <>
      {tale.beats.flatMap((b, i) =>
        (b.sfx ?? []).map((c, k) => {
          const def = STORY_SFX[c.cue];
          if (!def) return null;
          const tb = timeline.beats[i];
          const w = c.word ? words[i].find((x) => norm(x.w).includes(norm(c.word!)) && norm(c.word!)) : undefined;
          const at = tb.from + TALE_VOICE_DELAY + Math.round((w?.s ?? 0) * 30);
          const len = Math.round(def.dur * 30);
          let from = def.mode === "swell" ? at - len + 2 : def.mode === "bed" ? at - 3 : at - 1;
          const skip = Math.max(0, -from);
          from = Math.max(0, from);
          const dur = Math.min(def.mode === "bed" ? tb.from + tb.dur + 8 - from : len - skip, total - from);
          if (dur <= 0) return null;
          // Volume réglé à la main, plafonné pour qu'un son poussé ne sature pas.
          const gain = Math.min(SFX_MAX_GAIN, def.gain * (c.vol ?? 1));
          const fade = (f: number) => interpolate(f, [0, def.mode === "bed" ? 10 : 1, dur - (def.mode === "bed" ? 14 : 4), dur], [0, 1, 1, 0], clamp);
          return (
            <Sequence key={`${b.id}-${k}`} from={from} durationInFrames={dur} name={`bruitage ${c.cue}`} layout="none">
              <Audio
                src={staticFile(sfxFile(c.cue))}
                startFrom={skip}
                loop={def.mode === "bed"}
                volume={(f) => gain * fade(f) * (def.mode === "bed" ? 1 - DUCK * (env[from + f] ?? 0) : 1)}
              />
            </Sequence>
          );
        }),
      )}
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
            <StorySfx />
          </TaleProvider>
        </SfxMute.Provider>
      </AbsoluteFill>
    </ThemeProvider>
  );
};

/** Composant de composition pour une story donnée (Root et l'aperçu de tale-check). */
export const makeTaleVideo = (Story: React.FC<StoryProps>): React.FC<TaleVideoProps> => {
  const C: React.FC<TaleVideoProps> = (p) => <TaleVideo {...p} Story={Story} />;
  return C;
};
