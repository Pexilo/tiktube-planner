// Contrat d'une story crypto : content/tales/<slug>.json. Écrit par le pipeline serveur (server/tales.mjs),
// lu par Remotion (Root.tsx, TaleVideo.tsx) et par les visuels écrits par Claude (src/tales/stories/<slug>.tsx).
import type { VoiceTrack } from "../lib/types";
import type { StorySfxName } from "../../shared/tale-sfx.mjs";

export type TaleStatus = "idea" | "script" | "approved" | "voiced" | "composing" | "composed" | "rendered" | "error";
export type TaleRole = "hook" | "context" | "build" | "twist" | "product" | "payoff" | "outro";

export type TaleBeat = {
  id: string;
  role: TaleRole;
  /** Phrase dite par la voix off (anglais). */
  text: string;
  /** Brief visuel pour Claude : ce que l'image doit montrer pendant cette phrase. */
  visual: string;
  /** Bruitages narratifs (au plus 2) calés sur un mot de la phrase (début de la phrase sans mot) : shared/tale-sfx.mjs.
   * `vol` = volume réglé à la main (multiplie le gain de base du son, 1 par défaut). */
  sfx?: { cue: StorySfxName; word?: string; vol?: number }[];
};

/** Frames (30 fps), un élément par beat dans le même ordre ; `from` relatif au début de la vidéo. */
export type TaleTimeline = { beats: { id: string; from: number; dur: number }[]; totalFrames: number };

export type Tale = {
  slug: string;
  /** tale-<slug>-en : id de composition Remotion et de vidéo. */
  id: string;
  lang: "en";
  status: TaleStatus;
  /** "recent" = moins de 60 jours ; "offbeat" = plus ancienne mais insolite. */
  type: "recent" | "offbeat";
  /** Date de l'événement (AAAA-MM-JJ). */
  eventDate: string;
  /** Accroche affichée à l'écran (≤ 8 mots, *mot* = accent). */
  hook: string;
  summary: string;
  sources: { title: string; url: string; date?: string }[];
  facts: string[];
  beats: TaleBeat[];
  /** Le seul moment produit (~5 s) : feature WGG liée à l'histoire. `off` = vidéo sans passage pub (shared/tales.mjs → renderedTale). */
  product: { featureId: string; beat: string; off?: boolean };
  /** Ancien choix de musique (les stories n'ont plus de musique, seulement des bruitages). */
  music?: { style: string; mood: string[] };
  /** Titre court, sans emoji ni hashtag (shared/tales.mjs → cleanTitle). */
  yt: { title: string; description: string; hashtags: string[] };
  /** Miniature : beat dont l'image est figée sous le titre (le hook par défaut). */
  thumb?: { beat?: string };
  /** Après la voix : un segment par beat (même ordre). */
  voice?: VoiceTrack & { sig?: string };
  timeline?: TaleTimeline;
  compose?: { notes: string[]; log?: string; at?: string };
  /** Bruitages modifiés après la production, pas encore remixés dans la vidéo (POST /api/tales/:slug/sfx). */
  sfxPending?: boolean;
  /** Bruitages d'avant le dernier retravail par Claude (un niveau d'annulation). */
  sfxPrevious?: { id: string; sfx: NonNullable<TaleBeat["sfx"]> }[];
  /** Notes données à Claude pour retravailler les bruitages. */
  sfxNotes?: string[];
  error?: string | null;
};

/** Props du composant visuel écrit par Claude : `export const Story: React.FC<StoryProps>`. */
export type StoryProps = {
  tale: Tale;
  /** Timeline effective (voix réelle ou estimée). */
  timeline: TaleTimeline;
};
