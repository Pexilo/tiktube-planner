// Journal d'événements (affiché dans l'onglet Avancement) + durées de rendu pour les estimations.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, getState, save } from "./state.mjs";

export const events = [];

/** type : render | upload | schedule | autopilot | error | info */
export function logEvent(type, msg, id = null) {
  const e = { at: new Date().toISOString(), type, msg, id };
  events.unshift(e);
  events.length = Math.min(events.length, 200);
  try {
    appendFileSync(join(DATA, "events.log"), `${e.at} [${type}] ${msg}\n`);
  } catch {}
}

/** Mémorise la durée d'un rendu (moyenne glissante par type de vidéo). */
export function recordDuration(kind, sec) {
  const s = getState();
  s.renderStats ??= {};
  const arr = (s.renderStats[kind] ??= []);
  arr.push(Math.round(sec));
  if (arr.length > 12) arr.shift();
  save();
}

const DEFAULT_SEC = { short: 130, story: 140, long: 300 };
export function avgSeconds(kind) {
  const arr = getState().renderStats?.[kind];
  return arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : DEFAULT_SEC[kind] ?? 150;
}
