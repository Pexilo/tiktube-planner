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
    pubsEnabled: true, // Pubs en pause = rien ne part (YouTube, TikTok) pour les vidéos des apps ; les stories continuent
    taleTime: "20:00", // Stories crypto : créneau dédié, séparé des pubs
    talesPerDay: 1,
    taleAutoTikTok: true, // brouillon TikTok créé dès qu'une story est rendue
    taleFrench: true, // chaque story (écrite en anglais) a aussi sa version française, publiée à la même heure sur les comptes FR
    storagePath: "", // vidéos rendues + temporaires (Remotion, Chrome, ffmpeg) ; vide = dossier du projet
    accountShare: {}, // { youtube: { en: true } } = la chaîne EN publie aussi les vidéos FR (pas de chaîne FR)
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

/**
 * Un compte par langue et par réseau (YouTube, TikTok, Instagram). Une langue sans compte ne publie rien,
 * sauf si le compte de l'autre langue est partagé (réglage accountShare : un seul compte pour les deux langues).
 */
export const LANGS = ["fr", "en"];
// Chaque réseau inscrit sa fonction « cette langue a-t-elle un compte qui la publie ? ».
const publishers = [];
export const registerPublisher = (fn) => publishers.push(fn);
/**
 * Langue active : au moins un réseau a un compte qui la publie. Sans compte FR, rien n'est rendu, planifié
 * ni envoyé en FR (rien n'est supprimé). Tant qu'aucun compte n'est connecté (installation), tout reste actif.
 */
export function langOn(lang) {
  if (!publishers.some((f) => LANGS.some(f))) return true;
  return publishers.some((f) => f(lang));
}
export const accountShared = (net, lang) => !!state.settings.accountShare?.[net]?.[lang];
export function pickAccount(net, has, lang) {
  if (has(lang)) return lang;
  const other = LANGS.find((l) => l !== lang);
  return has(other) && accountShared(net, other) ? other : null;
}

/** Vidéo (ou post TikTok) d'une story crypto : jamais concernée par la pause des pubs. */
export const isTaleId = (id) => /^tale-/.test(id ?? "");
/** Pubs actives ? (mises en pause depuis le dashboard : rien n'est envoyé ni programmé, rien n'est supprimé.) */
export const pubsOn = () => state.settings.pubsEnabled !== false;
/** Une vidéo du catalogue peut-elle partir (langue active, et pubs actives sauf pour une story) ? */
export const videoOn = (v) => langOn(v.lang) && (v.kind === "tale" || isTaleId(v.id) || pubsOn());
/** L'autopilote doit-il attendre ? En retouche, ou story rendue pas encore validée à la main (chaque nouveau rendu se revalide). */
export const awaitingOk = (v) => !!state.videos[v.id]?.hold || ((v.kind === "tale" || isTaleId(v.id)) && !state.videos[v.id]?.released);
