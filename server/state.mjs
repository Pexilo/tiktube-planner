// État persistant de la plateforme (data/state.json) : réglages, planning, rendus, uploads.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../shared/catalog.mjs";

export const DATA = join(ROOT, "data");
export const OUT = join(ROOT, "out");
mkdirSync(DATA, { recursive: true });
mkdirSync(OUT, { recursive: true });
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
  },
  /** id → { publishAt, locked, rendered, renderedAt, youtubeId, uploadedAt, error } */
  videos: {},
  uploadsLog: [], // { at, id }
};

let state = load();

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
