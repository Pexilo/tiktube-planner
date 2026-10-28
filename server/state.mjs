// État persistant de la plateforme (data/state.json) : réglages, planning, rendus, uploads.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../shared/catalog.mjs";
import { applyStorageEnv, outDirFor, tempDirFor } from "../shared/storage.mjs";

export const DATA = join(ROOT, "data");
mkdirSync(DATA, { recursive: true });
const FILE = join(DATA, "state.json");

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000);
  return d.toISOString().slice(0, 10);
};

const DEFAULTS = {
  settings: {
    startDate: tomorrow(),
    timezone: "Europe/Brussels",
    shortTime: "18:00",
    shortTime2: "12:30",
    shortsPerDay: 1,
    longWeekday: 3, // 0 = dimanche … 3 = mercredi
    longTime: "17:00",
    maxUploadsPerDay: 6,
    uploadHorizonDays: 14,
    autopilot: false,
    frEnabled: true, // FR en pause = aucune action (rendu, voix, planning, YouTube, TikTok) sur les vidéos FR
    pubsEnabled: true, // Pubs en pause = rien ne part (YouTube, TikTok) pour les vidéos des apps ; les stories continuent
    taleTime: "20:00", // Stories crypto : créneau dédié, séparé des pubs
    talesPerDay: 1,
    taleAutoTikTok: true, // brouillon TikTok créé dès qu'une story est rendue
    storagePath: "", // vidéos rendues + temporaires (Remotion, Chrome, ffmpeg) ; vide = dossier du projet
  },
  /** id → { publishAt, locked, rendered, renderedAt, youtubeId, uploadedAt, error } */
  videos: {},
  uploadsLog: [], // { at, id }
};

let state = load();

/** Vidéos rendues et miniatures. Liaison vivante : suit le dossier de stockage choisi dans les Réglages. */
export let OUT;
export function setStorage(path) {
  OUT = outDirFor(path);
  mkdirSync(OUT, { recursive: true });
  mkdirSync(tempDirFor(path), { recursive: true });
  applyStorageEnv(path);
}
setStorage(state.settings.storagePath);

function load() {
  if (!existsSync(FILE)) return structuredClone(DEFAULTS);
  const s = JSON.parse(readFileSync(FILE, "utf8"));
  return { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...s.settings } };
}

export const getState = () => state;

export function save() {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, FILE);
}

export function video(id) {
  state.videos[id] ??= {};
  return state.videos[id];
}

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  save();
}

/** Langue active ? (FR peut être mis en pause depuis le dashboard, sans rien supprimer.) */
export const langOn = (lang) => lang !== "fr" || state.settings.frEnabled !== false;

/**
 * Un compte par langue et par réseau (YouTube, TikTok, Instagram). Une langue sans compte à elle
 * utilise celui de l'autre langue : un seul compte suffit pour tout publier.
 */
export const LANGS = ["fr", "en"];
export const pickAccount = (has, lang) => (has(lang) ? lang : (LANGS.find(has) ?? null));

/** Vidéo (ou post TikTok) d'une story crypto : jamais concernée par la pause des pubs. */
export const isTaleId = (id) => /^tale-/.test(id ?? "");
/** Pubs actives ? (mises en pause depuis le dashboard : rien n'est envoyé ni programmé, rien n'est supprimé.) */
export const pubsOn = () => state.settings.pubsEnabled !== false;
/** Une vidéo du catalogue peut-elle partir (langue active, et pubs actives sauf pour une story) ? */
export const videoOn = (v) => langOn(v.lang) && (v.kind === "tale" || isTaleId(v.id) || pubsOn());
/** L'autopilote doit-il attendre ? En retouche, ou story rendue pas encore validée à la main (chaque nouveau rendu se revalide). */
export const awaitingOk = (v) => !!state.videos[v.id]?.hold || ((v.kind === "tale" || isTaleId(v.id)) && !state.videos[v.id]?.released);
