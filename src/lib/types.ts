export type Lang = "fr" | "en";
/** Texte localisé. Dans les titres, *mot* = mis en valeur (couleur d'accent). */
export type L = { fr: string; en: string };

/**
 * Écran affiché dans un appareil. Chemin relatif à public/apps/<slug>/ ; "{lang}" est remplacé.
 * Les .mp4 sont joués comme vidéo. `focus` (browser) = zone à cadrer [x, y] en 0..1, `zoom` = grossissement.
 */
export type Screen = {
  src: string;
  device?: "phone" | "browser";
  focus?: [number, number];
  focusTo?: [number, number];
  zoom?: number;
  /** Vidéo : seconde de départ et vitesse de lecture. */
  start?: number;
  rate?: number;
};

export type Feature = {
  id: string;
  title: L;
  text: L;
  chip?: L;
  stat?: { value: string; label: L };
  screens: Screen[];
};

export type Brand = {
  mode: "dark" | "light";
  bg: string;
  bg2: string;
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  accent: string;
  heading: string;
  body: string;
  serif?: string;
  headingWeight: number;
  uppercase?: boolean;
  tracking?: number;
};

export type ShortDef = {
  hook: L;
  features: string[];
  yt: { title: L };
};

export type AppContent = {
  slug: string;
  name: string;
  url: string;
  links: { label: L; url: string }[];
  platforms: string[];
  music: string;
  musicPool?: string[];
  brand: Brand;
  icon: string;
  tagline: L;
  category: L;
  cta: { title: L; sub: L; badge: L };
  problems: L[];
  benefits: L[];
  price: L;
  features: Feature[];
  shorts: ShortDef[];
  stories?: StoryDef[];
  keynote?: KeynoteDef;
  long: { hook: L[]; features: string[]; yt: { title: L } };
  description: L;
  tags: string[];
  seo?: { category: string; keywords: { fr: string[]; en: string[] }; hashtags: { fr: string[]; en: string[] } };
};

export type StoryDef = {
  hook: L;
  features: string[];
  narration: { fr: string[]; en: string[] };
  yt: { title: L };
};

/** Voix off générée (scripts/gen-voice.mjs) : un segment par scène, mots horodatés pour les sous-titres. */
export type VoiceTrack = {
  voice: string;
  segments: { file: string; dur: number; words: { w: string; s: number; e: number }[] }[];
};

export type KeynoteDetail = {
  id: string;
  src: string;
  /** Zone de l'élément dans la capture, en fractions : [x, y, largeur, hauteur]. */
  rect: [number, number, number, number];
  device?: "phone" | "browser" | "plain";
  /** hauteur / largeur de l'image source */
  aspect: number;
  label: L;
  title: L;
  text: L;
};

export type KeynoteDef = {
  musicPool: string[];
  details: KeynoteDetail[];
  videos: { format: "short" | "long"; intro: L; details: string[]; yt: { title: L } }[];
};

export type VideoProps = {
  app: AppContent;
  lang: Lang;
  kind: "short" | "long" | "story" | "keynote";
  shortIndex: number;
  voice?: VoiceTrack | null;
};
