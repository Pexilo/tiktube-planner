// Contrat d'une story crypto : content/tales/<slug>.json. Écrit par le pipeline serveur (server/tales.mjs),
// lu par Remotion (Root.tsx, TaleVideo.tsx) et par les visuels écrits par Claude (src/tales/stories/<slug>.tsx).
import type { VoiceTrack } from "../lib/types";
import type { StorySfxName } from "../../shared/tale-sfx.mjs";

export type TaleStatus = "idea" | "script" | "approved" | "voiced" | "composing" | "composed" | "rendered" | "error";
export type TaleRole = "hook" | "context" | "build" | "twist" | "product" | "payoff" | "outro";

export type TaleBeat = {
  id: string;
  role: TaleRole;
  /** Phrase dite par la voix off (anglais ; traduite dans une story traduite). */
  text: string;
  /** Brief visuel pour Claude : ce que l'image doit montrer pendant cette phrase. */
  visual: string;
  /** Bruitages narratifs (au plus 2) calés sur un mot de la phrase (début de la phrase sans mot) : shared/tale-sfx.mjs.
   * `vol` = volume réglé à la main (multiplie le gain de base du son, 1 par défaut). */
  sfx?: { cue: StorySfxName; word?: string; vol?: number }[];
};

export type TaleLang = "en" | "fr";

/**
 * Traduction d'une story (l'anglais est la base) : écrite par Claude à la validation du script (texte, accroche, titre,
 * mots des bruitages), puis après la composition (textes à l'écran et mots-repères des visuels). Même beats, mêmes visuels.
 */
export type TaleLocale = {
  /** Empreinte du script anglais traduit : un script modifié se retraduit. */
  src: string;
  hook: string;
  summary: string;
  beats: { id: string; text: string }[];
  yt: { title: string; description: string; hashtags: string[] };
  /** Mot anglais (bruitage, repère `at("…")`) → mot de la phrase traduite, par beat. */
  anchors?: Record<string, Record<string, string>>;
  /** Textes à l'écran des visuels : anglais → traduction (`{}` = partie variable, ex. "DAY {}" → "JOUR {}"). */
  ui?: { src: string; text: Record<string, string>; anchors?: Record<string, Record<string, string>> };
  voice?: VoiceTrack & { sig?: string };
  timeline?: TaleTimeline;
  /** Notes du créateur pour la traduction. */
  notes?: string[];
  at?: string;
  /** Corrigée à la main depuis le dashboard (date). */
  edited?: string;
  /** Écarts aux règles restés après les deux essais de Claude. */
  warnings?: string[];
  /** Dernière erreur de cette langue (traduction, voix, textes à l'écran) : n'arrête pas la version anglaise. */
  error?: string;
};

/** Ajouté par shared/tales.mjs → localizedTale à une story rendue dans une autre langue que la base. */
export type TaleI18n = {
  lang: TaleLang;
  text: Record<string, string>;
  anchors: Record<string, Record<string, string>>;
  /** Phrases anglaises et leurs mots horodatés (voix anglaise), dans l'ordre des beats rendus. */
  base: { text: string; words: { w: string; s: number; e: number }[] | null }[];
};

/** Frames (30 fps), un élément par beat dans le même ordre ; `from` relatif au début de la vidéo. */
export type TaleTimeline = { beats: { id: string; from: number; dur: number }[]; totalFrames: number };

export type Tale = {
  slug: string;
  /** tale-<slug>-<lang> : id de composition Remotion et de vidéo. */
  id: string;
  /** "en" dans le JSON (la base) ; une autre langue seulement pour une story traduite (localizedTale). */
  lang: TaleLang;
  /** Traductions de la story, publiées à la même heure que la base sur les comptes de leur langue. */
  locales?: Partial<Record<TaleLang, TaleLocale>>;
  /** Présent seulement sur une story traduite (localizedTale). */
  i18n?: TaleI18n;
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
