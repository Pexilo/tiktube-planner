// Vérifie le statut YouTube des vidéos envoyées (privé / programmé / bloqué).
// Usage : node scripts/yt-check.mjs [youtubeId,...]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { google } from "googleapis";
import { ROOT } from "../shared/catalog.mjs";

const sec = JSON.parse(readFileSync(join(ROOT, "client_secret.json"), "utf8"));
const c = sec.installed ?? sec.web;
// Une chaîne par langue (+ ancien jeton unique) : une vidéo privée n'est visible que par sa chaîne.
const auths = ["youtube-token-fr.json", "youtube-token-en.json", "youtube-token.json"]
  .map((f) => join(ROOT, "data", f))
  .filter((f) => existsSync(f))
  .map((f) => {
    const a = new google.auth.OAuth2(c.client_id, c.client_secret);
    a.setCredentials(JSON.parse(readFileSync(f, "utf8")));
    return a;
  });
const state = JSON.parse(readFileSync(join(ROOT, "data/state.json"), "utf8"));
const ids = process.argv[2]?.split(",") ?? Object.values(state.videos).map((v) => v.youtubeId).filter(Boolean);
const seen = new Set();
for (const auth of auths) for (let i = 0; i < ids.length; i += 50) {
  const r = await google.youtube({ version: "v3", auth }).videos.list({ part: ["status", "snippet", "processingDetails"], id: ids.slice(i, i + 50) });
  for (const v of r.data.items) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    console.log(v.id, "|", v.snippet.title, "|", v.status.privacyStatus, "| publishAt:", v.status.publishAt ?? "—", "| upload:", v.status.uploadStatus, v.status.rejectionReason ?? "", "| cat:", v.snippet.categoryId);
  }
}
