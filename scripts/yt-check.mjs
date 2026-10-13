// Vérifie le statut YouTube des vidéos envoyées (privé / programmé / bloqué).
// Usage : node scripts/yt-check.mjs [youtubeId,...]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { google } from "googleapis";
import { ROOT } from "../shared/catalog.mjs";

const sec = JSON.parse(readFileSync(join(ROOT, "client_secret.json"), "utf8"));
const c = sec.installed ?? sec.web;
const auth = new google.auth.OAuth2(c.client_id, c.client_secret);
auth.setCredentials(JSON.parse(readFileSync(join(ROOT, "data/youtube-token.json"), "utf8")));
const state = JSON.parse(readFileSync(join(ROOT, "data/state.json"), "utf8"));
const ids = process.argv[2]?.split(",") ?? Object.values(state.videos).map((v) => v.youtubeId).filter(Boolean);
const yt = google.youtube({ version: "v3", auth });
for (let i = 0; i < ids.length; i += 50) {
  const r = await yt.videos.list({ part: ["status", "snippet", "processingDetails"], id: ids.slice(i, i + 50) });
  for (const v of r.data.items) {
    console.log(v.id, "|", v.snippet.title, "|", v.status.privacyStatus, "| publishAt:", v.status.publishAt ?? "—", "| upload:", v.status.uploadStatus, v.status.rejectionReason ?? "", "| cat:", v.snippet.categoryId);
  }
}
