// Réconcilie data/state.json avec la chaîne : oublie les uploads supprimés dans YouTube Studio.
// À lancer plateforme arrêtée. Usage : node scripts/yt-reconcile.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
const file = join(ROOT, "data/state.json");
const state = JSON.parse(readFileSync(file, "utf8"));
const linked = Object.entries(state.videos).filter(([, v]) => v.youtubeId);
const alive = new Set();
for (const auth of auths) {
  const r = await google.youtube({ version: "v3", auth }).videos.list({ part: ["id"], id: linked.map(([, v]) => v.youtubeId) });
  for (const x of r.data.items) alive.add(x.id);
}
for (const [id, v] of linked) {
  if (alive.has(v.youtubeId)) console.log(`✓ ${id} (${v.youtubeId})`);
  else {
    console.log(`✗ ${id} supprimée sur YouTube → à reprogrammer`);
    for (const k of ["youtubeId", "uploadedAt", "uploadError", "thumbError", "publishAt", "locked"]) delete v[k];
  }
}
for (const v of Object.values(state.videos)) delete v.renderError;
writeFileSync(file, JSON.stringify(state, null, 2));
