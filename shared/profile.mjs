// Profil du créateur (content/profile.json) : nom affiché et signature ajoutée en bas des descriptions YouTube.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./catalog.mjs";

const FILE = join(ROOT, "content", "profile.json");
const DEFAULTS = { ownerName: "", lang: "fr", signature: { fr: "", fr_vous: "", en: "" } };

export function loadProfile() {
  const p = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  return { ...DEFAULTS, ...p, signature: { ...DEFAULTS.signature, ...(p.signature ?? {}) } };
}
export function saveProfile(patch) {
  const p = { ...loadProfile(), ...patch };
  if (patch.signature) p.signature = { ...loadProfile().signature, ...patch.signature };
  writeFileSync(FILE, JSON.stringify(p, null, 2) + "\n");
  return p;
}
/** Ligne de signature pour une description (vide si non configurée). */
export function signature(lang, vous = false) {
  const s = loadProfile().signature;
  return (lang === "fr" ? (vous && s.fr_vous) || s.fr : s.en) || "";
}
