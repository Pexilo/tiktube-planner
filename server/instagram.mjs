// Module Instagram : chaque post vidéo TikTok part aussi en Reel sur Instagram, à la même heure.
// Contrairement à TikTok, l'API Instagram publie directement (pas de brouillon à finir dans l'app).
// L'API ne programme pas : c'est la plateforme qui publie à l'heure prévue, elle doit donc tourner.
//
// Config : data/instagram-config.json { appId, accessToken } (voir docs/INSTAGRAM_SETUP.md)
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, isTaleId } from "./state.mjs";
import { logEvent } from "./events.mjs";
import { notify } from "../shared/platform.mjs";
import { postLang, postOn, posts as ttPosts } from "./tiktok.mjs";

const CONFIG = join(DATA, "instagram-config.json");
const STORE = join(DATA, "instagram.json");
const API = "https://graph.instagram.com/v25.0";

/* ------------------------------------------------------------------ état */

let store = existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : { items: {} };
const saveStore = () => writeFileSync(STORE, JSON.stringify(store, null, 2));
/** ttPostId → { status: publishing | published | error, mediaId, permalink, error, at, attempts, retryAt } */
export const items = () => store.items;

// since : seuls les posts dont l'heure tombe après l'activation partent (pas de rattrapage de l'historique TikTok).
const DEFAULT_SETTINGS = { enabled: false, scope: "tales", langs: ["fr", "en"], since: null };
export const igSettings = () => ({ ...DEFAULT_SETTINGS, ...(store.settings ?? {}) });
export function updateIgSettings(patch) {
  const next = { ...igSettings(), ...patch };
  if (patch.enabled && !igSettings().enabled) next.since = new Date().toISOString();
  store.settings = next;
  saveStore();
  return next;
}

export const igState = { publishing: null, lastError: null, user: null };

export function config() {
  return existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : null;
}

export function status() {
  const c = config();
  return {
    configured: !!c?.accessToken && !/^COLLE_ICI/.test(c.accessToken),
    connected: !!igState.user,
    user: igState.user,
    publishing: igState.publishing,
    lastError: igState.lastError,
  };
}

/* ------------------------------------------------------------------ API Graph Instagram */

/** Token longue durée (60 jours) : renouvelé chaque semaine tant que la plateforme tourne. */
async function accessToken() {
  const c = config();
  if (!status().configured) throw new Error("data/instagram-config.json : accessToken manquant");
  const age = Date.now() - new Date(c.refreshedAt ?? 0).getTime();
  if (age > 7 * 86400000) {
    const r = await fetch(`${API.replace(/\/v[\d.]+$/, "")}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.accessToken)}`);
    const j = await r.json();
    if (j.access_token) {
      Object.assign(c, { accessToken: j.access_token, refreshedAt: new Date().toISOString() });
      writeFileSync(CONFIG, JSON.stringify(c, null, 2));
    } else if (!c.refreshedAt) {
      // Token tout neuf (< 24 h) : Meta refuse de le renouveler, on retentera la semaine prochaine.
      c.refreshedAt = new Date().toISOString();
      writeFileSync(CONFIG, JSON.stringify(c, null, 2));
    }
  }
  return config().accessToken;
}

async function api(path, { method = "GET", params = {} } = {}) {
  const q = new URLSearchParams({ ...params, access_token: await accessToken() });
  const r = await fetch(method === "GET" ? `${API}${path}?${q}` : `${API}${path}`, method === "GET" ? {} : { method, body: q });
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.error_user_msg ?? j.error.message} (code ${j.error.code}${j.error.error_subcode ? `/${j.error.error_subcode}` : ""})`);
  return j;
}

export async function refreshUser() {
  try {
    igState.user = await api("/me", { params: { fields: "user_id,username,profile_picture_url,account_type" } });
    igState.lastError = null;
  } catch (e) {
    igState.user = null;
    igState.lastError = e.message;
  }
  return igState.user;
}

export const quota = () => api(`/${igState.user.user_id}/content_publishing_limit`, { params: { fields: "config,quota_usage" } }).then((j) => j.data?.[0]);

/* ------------------------------------------------------------------ publication d'un Reel */

/** Légende Instagram : titre + description, 2 200 caractères et 30 hashtags max. */
export function igCaption(p) {
  let n = 0;
  const text = [p.title, p.description].filter(Boolean).join("\n\n").replace(/#[\p{L}\p{N}_]+/gu, (h) => (++n <= 30 ? h : ""));
  return text.replace(/[ \t]+\n/g, "\n").trim().slice(0, 2200);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function publishReel(p) {
  const file = p.videoFile;
  if (!file || !existsSync(file)) throw new Error("Vidéo introuvable (rends-la d'abord)");
  const me = igState.user ?? (await refreshUser());
  if (!me) throw new Error(igState.lastError ?? "Instagram non connecté");
  // 1. Conteneur Reel en envoi « resumable » : le fichier part depuis le disque, pas besoin d'URL publique.
  const box = await api(`/${me.user_id}/media`, { method: "POST", params: { media_type: "REELS", upload_type: "resumable", caption: igCaption(p), share_to_feed: "true" } });
  const size = statSync(file).size;
  const up = await fetch(box.uri, { method: "POST", headers: { Authorization: `OAuth ${await accessToken()}`, offset: "0", file_size: String(size) }, body: readFileSync(file) });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw new Error(`Envoi de la vidéo : HTTP ${up.status} ${uj.debug_info?.message ?? uj.error?.message ?? ""}`.trim());
  // 2. Instagram traite la vidéo (quelques secondes à quelques minutes).
  for (let i = 0; ; i++) {
    const s = await api(`/${box.id}`, { params: { fields: "status_code,status" } });
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Traitement Instagram : ${s.status ?? s.status_code}`);
    if (i > 120) throw new Error("Traitement Instagram trop long (10 min)");
    await sleep(5000);
  }
  // 3. Publication.
  const pub = await api(`/${me.user_id}/media_publish`, { method: "POST", params: { creation_id: box.id } });
  const info = await api(`/${pub.id}`, { params: { fields: "permalink" } }).catch(() => ({}));
  return { mediaId: pub.id, permalink: info.permalink ?? null };
}

export async function publish(p) {
  if (igState.publishing) throw new Error("Une publication Instagram est déjà en cours");
  igState.publishing = p.id;
  const it = (store.items[p.id] = { ...store.items[p.id], status: "publishing", at: new Date().toISOString(), error: null });
  saveStore();
  try {
    Object.assign(it, await publishReel(p), { status: "published", publishedAt: new Date().toISOString(), retryAt: null, attempts: 0 });
    igState.lastError = null;
    logEvent("upload", `Instagram : Reel publié — « ${p.title} »`, p.id);
    notify("Studio · Instagram", `Reel publié : « ${p.title.slice(0, 60)} »`);
  } catch (e) {
    const msg = String(e.message ?? e).slice(0, 300);
    // Coupure réseau passagère : nouvel essai dans 15 min (5 tentatives max) plutôt qu'une erreur.
    if (/ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND|EAI_AGAIN|socket|fetch failed|timeout/i.test(msg) && (it.attempts ?? 0) < 5) {
      Object.assign(it, { status: "waiting", attempts: (it.attempts ?? 0) + 1, retryAt: new Date(Date.now() + 15 * 60000).toISOString(), error: `Coupure réseau (${msg.slice(0, 60)})` });
      logEvent("info", `Instagram : « ${p.title} » — coupure réseau, nouvel essai dans 15 min`, p.id);
    } else {
      Object.assign(it, { status: "error", error: msg });
      igState.lastError = `${p.title} : ${msg}`;
      logEvent("error", `Instagram : échec de la publication de « ${p.title} » — ${msg}`, p.id);
    }
  } finally {
    igState.publishing = null;
    saveStore();
  }
}

/* ------------------------------------------------------------------ quels posts TikTok partent sur Instagram */

const isTalePost = (p) => isTaleId(p.videoId) || p.source === "tales";

/** Le post TikTok est-il concerné par Instagram (réglages : stories ou tout, langues) ? */
export function eligible(p) {
  const s = igSettings();
  return p.type === "video" && (s.scope === "all" || isTalePost(p)) && s.langs.includes(postLang(p)) && postOn(p);
}

/** Posts qu'Instagram doit encore publier : leur vidéo ne doit pas être nettoyée du disque. */
export function pending() {
  const s = igSettings();
  if (!s.enabled) return [];
  return ttPosts().filter((p) => eligible(p) && p.publishAt && p.publishAt >= s.since && !["published", "skipped"].includes(store.items[p.id]?.status));
}

/** Échec qu'on ne veut pas retenter : le post sort de la file Instagram (sa vidéo peut alors être nettoyée). */
export function skip(id) {
  store.items[id] = { ...store.items[id], status: "skipped", at: new Date().toISOString() };
  saveStore();
}

/** Planificateur : publie le prochain Reel dont l'heure est arrivée (appelé chaque minute). */
export async function tick() {
  if (!igSettings().enabled || igState.publishing || !status().configured) return;
  if (!igState.user && !(await refreshUser())) return;
  const now = new Date().toISOString();
  const due = pending()
    .filter((p) => p.status !== "draft" && p.publishAt <= now)
    .filter((p) => { const it = store.items[p.id]; return !it || (it.status === "waiting" && it.retryAt <= now); })
    .sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  if (due[0]) await publish(due[0]);
}
