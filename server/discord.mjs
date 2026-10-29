// Webhook Discord : à l'heure de sortie d'une story, sa miniature + titre et légende TikTok dans un embed,
// pour la mettre à la main sur Instagram / TikTok (miniature à télécharger, texte à copier).
//
// Config : data/discord-config.json → { "webhook": "https://discord.com/api/webhooks/…", "userId": "…" }
// (ou DISCORD_WEBHOOK). userId : ton identifiant Discord, mentionné à chaque envoi pour recevoir la notification.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, getState, save, video } from "./state.mjs";
import { thumbFile } from "./render.mjs";
import { buildMetadata, tiktokCaption } from "./youtube.mjs";
import { logEvent } from "./events.mjs";
import * as tt from "./tiktok.mjs";

const CONFIG = join(DATA, "discord-config.json");
// Story sortie il y a plus longtemps (serveur éteint, première mise en route) : pas de rattrapage.
const LATE = 12 * 3600000;

export const readConfig = () => (existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : {});
export const writeConfig = (patch) => writeFileSync(CONFIG, JSON.stringify({ ...readConfig(), ...patch }, null, 2), { mode: 0o600 });
export const webhook = () => process.env.DISCORD_WEBHOOK || readConfig().webhook || null;
export const isWebhook = (u) => /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u);
export const isUserId = (id) => /^\d{17,20}$/.test(id);

/** Webhook masqué (fin du jeton seulement) et utilisateur mentionné, pour le guide d'installation. */
export function status() {
  const url = webhook(), userId = readConfig().userId ?? null;
  return { configured: !!url, hookHint: url ? `…${url.slice(-6)}` : null, userId };
}

/** Mention de l'utilisateur configuré : texte du message + autorisation explicite (rien d'autre n'est pingué). */
function ping(id = readConfig().userId) {
  return id ? { content: `<@${id}>`, allowed_mentions: { users: [id] } } : { allowed_mentions: { parse: [] } };
}

async function post(url, payload, file) {
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  if (file) form.append("files[0]", new Blob([readFileSync(file.path)], { type: "image/jpeg" }), file.name);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Discord ${res.status} : ${(await res.text()).slice(0, 200)}`);
}

/** Message d'essai depuis le guide d'installation (avec la mention, pour vérifier la notification). */
export async function test(url = webhook(), userId = readConfig().userId) {
  if (!url) throw new Error("Aucun webhook Discord");
  await post(url, { ...ping(userId), embeds: [{ title: "TikTube Planner ✓", description: "Webhook connecté : la miniature, le titre et la légende de chaque story arriveront ici à sa sortie.", color: 0xf7931a }] });
}

/** Titre et légende de la story tels qu'envoyés sur TikTok (le post s'il existe, sinon la même construction). */
function caption(v, app) {
  const p = tt.posts().find((x) => x.videoId === v.id);
  return p ? { title: p.title, description: p.description } : tiktokCaption(buildMetadata(v, app));
}

export async function send(v, app) {
  const url = webhook();
  if (!url) throw new Error("Aucun webhook Discord (data/discord-config.json)");
  if (!existsSync(thumbFile(v.id))) throw new Error("Miniature pas encore rendue");
  const st = video(v.id);
  const { title, description } = caption(v, app);
  const name = `${v.id}.jpg`;
  const embed = {
    title: title.slice(0, 256),
    ...(st.youtubeId ? { url: `https://youtube.com/shorts/${st.youtubeId}` } : {}),
    image: { url: `attachment://${name}` },
    color: 0xf7931a,
    footer: { text: `Story ${v.lang.toUpperCase()} · légende TikTok juste en dessous` },
    timestamp: st.publishAt ?? new Date().toISOString(),
  };
  await post(url, { ...ping(), embeds: [embed], attachments: [{ id: 0, filename: name }] }, { path: thumbFile(v.id), name });
  // Légende TikTok (titre + description) en un seul message texte : un appui long → « Copier le texte » sur mobile.
  await post(url, { content: [title, description].filter(Boolean).join("\n\n").slice(0, 2000), allowed_mentions: { parse: [] } });
  st.discordAt = new Date().toISOString();
  save();
  logEvent("info", `Discord : miniature envoyée — « ${title} »`, v.id);
}

/** Stories sorties (heure passée, sur YouTube ou envoyées sur TikTok) pas encore postées sur Discord. Chaque minute. */
export async function tick(catalog) {
  if (!webhook()) return;
  const now = Date.now();
  for (const v of catalog.videos) {
    if (v.kind !== "tale") continue;
    const st = getState().videos[v.id];
    const at = st?.publishAt ? new Date(st.publishAt).getTime() : null;
    if (!at || at > now || at < now - LATE || st.discordAt || st.discordError === st.publishAt) continue;
    const out = st.youtubeId || tt.posts().some((p) => p.videoId === v.id && p.status === "sent");
    if (!out || !existsSync(thumbFile(v.id))) continue;
    try {
      await send(v, catalog.apps.find((a) => a.slug === v.slug));
    } catch (e) {
      // Une seule tentative par créneau : pas de relance chaque minute sur un webhook supprimé.
      st.discordError = st.publishAt;
      save();
      logEvent("error", `Discord : échec de l'envoi de ${v.id} — ${e.message}`, v.id);
    }
  }
}
