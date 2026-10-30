// Composants de récit des stories HD : apparitions et trajets par paliers (jamais de glissé lisse sur un sprite),
// personnages qui marchent, textes du récit (titre, étiquette, tampon, compteur, message de forum).
// Positions en cellules HD (grille 180 × 320) ; frames relatives au plan (useBeat().at("mot")).
import React, { useContext } from "react";
import { useCurrentFrame } from "remotion";
import type { AnimSfxName } from "../../../shared/tale-sfx.mjs";
import { Sound } from "../kit/sfx";
import { LINE, wrap } from "../pixel/font";
import { TitleOff } from "../pixel/props";
import { forumPost } from "./draw";
import { GROUND, P } from "./grid";
import { tone, type RampName } from "./palette";
import { hdPerson, type HDLook, type HDPose } from "./people";
import { Cells } from "./pixelize";
import { Txt, useHDSlot, Z } from "./stage";

/** Frame d'apparition des éléments déjà en place à la coupe (posés, sans son). */
export const STILL = -30;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Frame tenue par paliers de `step` frames : les mouvements avancent par à-coups, comme une animation pixel. */
const held = (frame: number, step = 2) => Math.floor(frame / step) * step;

/** Décale ses enfants de (dx, dy) cellules sans créer d'empilement : les textes gardent leur calque au-dessus de la lumière. */
const Offset: React.FC<{ dx: number; dy: number; children: React.ReactNode }> = ({ dx, dy, children }) => (
  <div style={{ position: "absolute", left: dx * P, top: dy * P }}>{children}</div>
);

/** Visible de `at` (inclus) à `out` (exclu). */
export const Show: React.FC<{ at?: number; out?: number; children: React.ReactNode }> = ({ at = STILL, out, children }) => {
  const f = useCurrentFrame();
  return f >= at && (out === undefined || f < out) ? <>{children}</> : null;
};

/** Arrivée : tombe de `from` cellules en 2 frames, s'écrase d'une cellule, se pose ; joue `sound` (sauf s'il est déjà là). */
export const Drop: React.FC<{ at?: number; out?: number; from?: number; sound?: AnimSfxName | false; volume?: number; children: React.ReactNode }> = ({
  at = STILL,
  out,
  from = 6,
  sound = "a-pop",
  volume = 1,
  children,
}) => {
  const f = useCurrentFrame();
  const t = f - at;
  return (
    <>
      {sound && at > 1 ? <Sound name={sound} at={at} volume={volume} /> : null}
      {t >= 0 && (out === undefined || f < out) ? <Offset dx={0} dy={t >= 3 ? 0 : [-from, -Math.ceil(from / 3), 1][t]}>{children}</Offset> : null}
    </>
  );
};

/** Trajet par paliers (toutes les 2 frames) de (0, 0) à (dx, dy) cellules entre `at` et `at + dur`, `arc` = bosse vers le haut. */
export const Move: React.FC<{ at: number; dur: number; dx?: number; dy?: number; arc?: number; ease?: "in" | "out" | "inout"; children: React.ReactNode }> = ({
  at,
  dur,
  dx = 0,
  dy = 0,
  arc = 0,
  ease = "inout",
  children,
}) => {
  const u = clamp01((held(useCurrentFrame()) - at) / Math.max(1, dur));
  const e = ease === "out" ? 1 - (1 - u) ** 2 : ease === "in" ? u * u : u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2;
  return (
    <Offset dx={Math.round(dx * e)} dy={Math.round(dy * e - arc * 4 * u * (1 - u))}>
      {children}
    </Offset>
  );
};

/** Clignote à partir de `at` (visible la moitié de chaque période de `every` frames). */
export const Blink: React.FC<{ at?: number; every?: number; children: React.ReactNode }> = ({ at = 0, every = 16, children }) => {
  const f = useCurrentFrame();
  return f < at || Math.floor((f - at) / (every / 2)) % 2 === 0 ? <>{children}</> : null;
};

/**
 * Personnage HD (people.ts) au sol en (x, y). Avec `to`, il marche de x à `to` en `dur` frames (pas de 3 frames, une
 * cellule à la fois), puis prend la pose `pose`. Tourné dans le sens de sa marche, ou vers `face`.
 */
export const Person: React.FC<{ look: HDLook; x: number; y?: number; pose?: HDPose; at?: number; out?: number; to?: number; dur?: number; face?: "left" | "right" }> = ({
  look,
  x,
  y = GROUND,
  pose = "stand",
  at = STILL,
  out,
  to,
  dur = 60,
  face,
}) => {
  const f = useCurrentFrame();
  const t = f - at;
  const moving = to !== undefined && t < dur;
  const p: HDPose = moving ? "walk" : pose;
  const dir = face ?? (to !== undefined && to < x ? "left" : "right");
  const step = p === "stand" ? 0 : Math.floor(Math.max(0, t) / 3) % 8;
  const col = Math.round(to === undefined ? x : x + (to - x) * clamp01(t / dur));
  if (t < 0 || (out !== undefined && f >= out)) return null;
  return (
    <Cells
      draw={() => {
        const c = hdPerson(look, p, step * 3);
        return dir === "left" ? c.flipX(1) : c;
      }}
      deps={[look, p, step, dir]}
      x={col}
      y={y}
    />
  );
};

/**
 * Étiquette : bloc de couleur (lime par défaut), texte encre, qui tombe en place. Dates, lieux, prix, noms.
 * `layer="world"` : étiquette posée sur le décor (prix d'une courbe, d'un objet) : éclairée comme lui, et un personnage
 * dessiné après elle passe devant. Par défaut, calque du récit (au-dessus de tout).
 */
export const Label: React.FC<{ text: string; x: number; y: number; at?: number; out?: number; color?: string; ink?: string; k?: number; sound?: AnimSfxName | false; layer?: "ui" | "world" }> = ({
  text,
  x,
  y,
  at = STILL,
  out,
  color = tone("lime", 3),
  ink = tone("ink", 1),
  k = 1,
  sound = "a-pop",
  layer = "ui",
}) => (
  <Drop at={at} out={out} from={3} sound={sound}>
    <Txt text={text} x={x} y={y} k={k} box={color} color={ink} layer={layer} />
  </Drop>
);

/** Tampon : gros bloc (rose par défaut), lettres de 12 px, qui s'abat avec un bruit de tampon. */
export const Stamp: React.FC<{ text: string; x: number; y: number; at: number; out?: number; color?: string; ink?: string; k?: number }> = ({
  text,
  x,
  y,
  at,
  out,
  color = tone("pink", 3),
  ink = tone("stone", 7),
  k = 2,
}) => (
  <Drop at={at} out={out} from={2} sound="a-stamp">
    <Txt text={text} x={x} y={y} k={k} box={color} color={ink} />
  </Drop>
);

/**
 * Titre en lettres de `k` × 6 px ; `*mot*` = surligné dans un bloc rose sur sa propre ligne (le hook de la story).
 * Absent de la miniature, qui pose son propre titre (TitleOff).
 */
export const Title: React.FC<{ text: string; y: number; x?: number; at?: number; out?: number; k?: number }> = ({ text, y, x = 90, at = STILL, out, k = 2 }) => {
  const off = useContext(TitleOff);
  let yy = y;
  if (off) return null;
  const parts = text.split("*").map((s, i) => ({ s: s.trim(), hl: i % 2 === 1 })).filter((p) => p.s);
  return (
    <Show at={at} out={out}>
      {parts.map((p, i) => {
        const el = p.hl ? <Txt key={i} text={p.s} x={x} y={yy} k={k} box={tone("pink", 3)} color={tone("stone", 7)} /> : <Txt key={i} text={p.s} x={x} y={yy} k={k} />;
        yy += (wrap(p.s, Math.floor(150 / k)).length * LINE - 3) * k + (p.hl ? 6 : 0) + 4;
        return el;
      })}
    </Show>
  );
};

/**
 * Compteur qui défile par paliers de `from` à `to` entre `at` et `at + dur` (son de comptage pendant qu'il tourne).
 * `log` = progression géométrique (41 → 1,1 milliard reste lisible), `format` = mise en forme du nombre.
 */
export const Counter: React.FC<{
  from: number;
  to: number;
  at: number;
  dur: number;
  x: number;
  y: number;
  k?: number;
  log?: boolean;
  format?: (v: number) => string;
  box?: string;
  color?: string;
  out?: number;
}> = ({ from, to, at, dur, x, y, k = 2, log = false, format = (v) => Math.round(v).toLocaleString("en-US"), box, color, out }) => {
  const f = useCurrentFrame();
  const u = clamp01((held(f) - at) / Math.max(1, dur));
  const e = 1 - (1 - u) ** 3;
  const v = log ? from * (to / from) ** e : from + (to - from) * e;
  return (
    <>
      {at > 1 ? <Sound name="a-count" at={at} loopFor={dur} volume={0.7} /> : null}
      <Show at={STILL} out={out}>
        <Txt text={format(v)} x={x} y={y} k={k} box={box} color={color} />
      </Show>
    </>
  );
};

/**
 * Message de forum (style BitcoinTalk 2010, draw.ts : forumPost), coin haut gauche en (x, y), largeur `w`. Avec `typeAt`,
 * le texte s'écrit à `cps` caractères par seconde (bruit de frappe), curseur clignotant ; la carte garde sa taille finale.
 */
export const Card: React.FC<{ title: string; author: string; date: string; body: string; y: number; x?: number; w?: number; at?: number; out?: number; typeAt?: number; cps?: number; avatar?: RampName }> = ({
  title,
  author,
  date,
  body,
  y,
  x = 17,
  w = 146,
  at = STILL,
  out,
  typeAt,
  cps = 28,
  avatar,
}) => {
  const f = useCurrentFrame();
  const n = typeAt === undefined ? body.length : Math.max(0, Math.min(body.length, Math.floor(((f - typeAt) * cps) / 30)));
  const typing = typeAt !== undefined && f >= typeAt - 10 && Math.floor(f / 8) % 2 === 0;
  const visible = f >= at && (out === undefined || f < out);
  const h = 26 + wrap(body, w - 34).length * LINE + 6;
  const dy = useHDSlot(visible ? { x0: x - 1, y0: y - 1, x1: x + w + 2, y1: y + h + 2 } : null);
  return (
    <>
      {at > 1 ? <Sound name="a-pop" at={at} /> : null}
      {typeAt !== undefined && typeAt > 1 ? <Sound name="a-type" at={typeAt} loopFor={Math.ceil((body.length * 30) / cps)} volume={0.8} /> : null}
      {visible ? (
        <div style={{ position: "absolute", left: 0, top: dy * P, zIndex: Z.ui }}>
          <Cells draw={() => forumPost({ title, author, date, body, w, avatar, chars: n, cursor: typing })} deps={[title, body, n, typing, w]} x={x} y={y} outline="ink" />
        </div>
      ) : null}
    </>
  );
};
