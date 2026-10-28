// Dossier de stockage (Réglages) : vidéos rendues (out/) et fichiers temporaires (bundles Remotion, Chrome, ffmpeg, envois).
// Vide = dossier du projet, comme avant. Les clés et l'état (data/) ne bougent jamais.
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./catalog.mjs";

/** Dossier temporaire du système, mémorisé avant toute redirection. */
const SYSTEM_TMP = tmpdir();

/** Chemin réglé : variable posée par le serveur pour ses scripts enfants, sinon data/state.json (scripts lancés à la main). */
export function configuredStorage() {
  if (process.env.STUDIO_STORAGE !== undefined) return process.env.STUDIO_STORAGE;
  const f = join(ROOT, "data", "state.json");
  if (!existsSync(f)) return "";
  try {
    return JSON.parse(readFileSync(f, "utf8")).settings?.storagePath ?? "";
  } catch {
    return "";
  }
}

export const outDirFor = (path) => join(path || ROOT, "out");
export const tempDirFor = (path) => (path ? join(path, "tmp") : SYSTEM_TMP);
export const outDir = () => outDirFor(configuredStorage());

/** Redirige le temporaire du processus (et de ses enfants : Chrome, ffmpeg, scripts) vers le dossier de stockage. */
export function applyStorageEnv(path) {
  const tmp = tempDirFor(path);
  process.env.STUDIO_STORAGE = path;
  for (const k of process.platform === "win32" ? ["TEMP", "TMP"] : ["TMPDIR"]) process.env[k] = tmp;
}
