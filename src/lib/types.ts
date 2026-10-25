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
  /** Composant du site recréé et animé (remplace l'appareil dans la scène). Cf. components/widgets.tsx. */
  widget?: Widget;
};

type Cell = { label: L; value: string; tone?: "up" | "down" | "pink" | "lime" | "cyan" };
/** Couleurs : "pink" | "lime" | "cyan" | "orange" | "up" | "down". Montants en texte ("−$1,743.20") : ils défilent jusqu'à leur valeur. */
export type Widget = { form?: string; ledger?: string } & (
  | { type: "pnl"; value: string; change: string; note?: L; cells: Cell[] }
  | { type: "address"; title: L; sub: L; inputLabel?: L; address: string; chains: string[]; button: L; tape?: L }
  | { type: "grade"; wallet: string; grade: string; gradeLabel?: L; stats: Cell[]; scores: { label: L; value: number; color: string }[] }
  | { type: "whatif"; title: L; you: L; other: L; bestLabel: L; rows: { label: L; delta: string; you: number; other: number; best?: boolean }[] }
  | { type: "regrets"; title: L; rows: { date: string; label: L; value: string; bar: number }[] }
  | { type: "gas"; title: L; label: L; burned: string; cells: Cell[]; thats: L; equivalents: { n: string; label: L; emoji: string }[] }
  | { type: "trophies"; title: L; caseLabel: L; held: string; heldLabel: L; items: { icon: string; color: string; name: L; text: L }[]; almost?: { label: L; hint: L; name: L; progress: number } }
  | { type: "math"; title: L; formulas: (string | L)[]; lotsLabel: L; lots: { qty: string; at: string; used: number }[] }
);

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
  /** "ledger" : fond registre (lignes, marge pointillée, bandeau défilant `app.tape`) au lieu des halos. */
  backdrop?: "aurora" | "ledger";
};

/** Direction musicale d'une vidéo (ElevenLabs Music) : genre imposé et humeur propre à l'annonce. */
export type MusicDef = { style?: string; mood?: string[] };

export type ShortDef = {
  hook: L;
  features: string[];
  yt: { title: L };
  music?: MusicDef;
};

export type AppContent = {
  slug: string;
  name: string;
  url: string;
  links: { label: L; url: string }[];
  platforms: string[];
  music: string;
  musicPool?: string[];
  /** Thème sonore du projet (mots décrivant l'ambiance), ajouté à chaque musique ElevenLabs de l'app. */
  sound?: string[];
  brand: Brand;
  icon: string;
  tagline: L;
  category: L;
  /** Texte du bandeau défilant (fond "ledger"). */
  tape?: L;
  cta: { title: L; sub: L; badge: L };
  problems: L[];
  benefits: L[];
  price: L;
  features: Feature[];
  shorts: ShortDef[];
  stories?: StoryDef[];
  keynote?: KeynoteDef;
  long: { hook: L[]; features: string[]; yt: { title: L }; music?: MusicDef };
  description: L;
  tags: string[];
  seo?: { category: string; keywords: { fr: string[]; en: string[] }; hashtags: { fr: string[]; en: string[] } };
};

export type StoryDef = {
  hook: L;
  features: string[];
  narration: { fr: string[]; en: string[] };
  yt: { title: L };
  music?: MusicDef;
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
  videos: { format: "short" | "long"; intro: L; details: string[]; yt: { title: L }; music?: MusicDef }[];
};

export type VideoProps = {
  app: AppContent;
  lang: Lang;
  kind: "short" | "long" | "story" | "keynote";
  shortIndex: number;
  voice?: VoiceTrack | null;
};
