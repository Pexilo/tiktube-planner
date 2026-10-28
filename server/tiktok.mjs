// Module TikTok : brouillons programmés (vidéos + carrousels photo) envoyés dans la boîte TikTok.
// L'API TikTok ne programme pas les posts : la plateforme envoie le brouillon à l'heure prévue,
// tu reçois une notification TikTok, tu ajoutes un son et tu publies.
//
// Config : data/tiktok-config.json (voir tiktok-config.example.json et docs/TIKTOK_SETUP.md)
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DATA, getState, isTaleId, langOn, LANGS, pickAccount, pubsOn } from "./state.mjs";
import { logEvent } from "./events.mjs";
import { copyToClipboard, notify } from "../shared/platform.mjs";

const run = promisify(execFile);
export const PORT = Number(process.env.PORT ?? 4321);
const REDIRECT = `http://localhost:${PORT}/tiktok/callback/`;
const CONFIG = join(DATA, "tiktok-config.json");
// Un compte par langue : data/tiktok-token-fr.json et data/tiktok-token-en.json (même app TikTok).
const tokenFile = (lang) => join(DATA, `tiktok-token-${lang}.json`);
// Ancien jeton unique : devient le compte EN.
const LEGACY = join(DATA, "tiktok-token.json");
if (existsSync(LEGACY) && !existsSync(tokenFile("en"))) renameSync(LEGACY, tokenFile("en"));
const hasToken = (lang) => existsSync(tokenFile(lang));
/** Compte qui reçoit les posts de cette langue (le sien, ou celui de l'autre langue s'il est partagé), sinon null. */
export const accountFor = (lang) => pickAccount("tiktok", hasToken, lang);
const STORE = join(DATA, "tiktok.json");
export const MEDIA = join(DATA, "tiktok-media");
mkdirSync(MEDIA, { recursive: true });
const API = "https://open.tiktokapis.com";

/* ------------------------------------------------------------------ état */

let store = existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : { posts: [] };
const saveStore = () => writeFileSync(STORE, JSON.stringify(store, null, 2));
export const posts = () => store.posts;
/** Dossier de stockage déplacé : les posts qui pointaient vers l'ancien out/ suivent les fichiers. */
export function retargetVideoFiles(from, to) {
  let n = 0;
  for (const p of store.posts) if (p.videoFile?.startsWith(from)) (p.videoFile = to + p.videoFile.slice(from.length)), n++;
  if (n) saveStore();
}

/* ------------------------------------------------------------------ réglages + programmation automatique */

const DEFAULT_SETTINGS = { frTimes: ["12:30", "19:00"], enTimes: ["15:00", "21:00"], watch: true, watchDir: "~/Desktop/Tiktok" };
export const ttSettings = () => ({ ...DEFAULT_SETTINGS, ...(store.settings ?? {}) });
export function updateTtSettings(patch) {
  store.settings = { ...ttSettings(), ...patch };
  saveStore();
  return store.settings;
}

const FR_HINT = /\b(le|la|les|des|tu|ton|ta|tes|pour|avec|est|une|qui|pas|sur|dans|et)\b/gi;
const EN_HINT = /\b(the|you|your|and|with|for|is|are|this|what|how|to|of|it)\b/gi;
export function postLang(p) {
  if (p.lang) return p.lang;
  const t = `${p.title} ${p.description}`;
  return (t.match(EN_HINT)?.length ?? 0) > (t.match(FR_HINT)?.length ?? 0) ? "en" : "fr";
}

/** Post d'une story crypto (jamais concerné par la pause des pubs). */
const isTalePost = (p) => isTaleId(p.videoId) || p.source === "tales";
/** Le post peut-il partir (langue active, et pubs actives sauf pour une story) ? */
export const postOn = (p) => langOn(postLang(p)) && (isTalePost(p) || pubsOn());

/**
 * Programme tous les brouillons complets sur les prochains créneaux libres :
 * créneaux FR et EN séparés (réglages), lots alternés pour ne pas enchaîner deux posts de la même app.
 * `only` = ids à programmer (sinon tous les brouillons complets). Pubs en pause : leurs brouillons restent brouillons.
 */
export function scheduleDrafts(only = null) {
  const s = ttSettings();
  const ready = store.posts.filter((p) => p.status === "draft" && (!only || only.has(p.id)) && (isTalePost(p) || pubsOn()) && (p.type === "video" ? p.videoFile || p.videoId : p.images.length));
  const taken = new Set(store.posts.filter((p) => p.publishAt && (p.status === "scheduled" || p.status === "sending")).map((p) => p.publishAt.slice(0, 16)));
  let n = 0;
  for (const lang of ["fr", "en"]) {
    if (!langOn(lang)) continue; // FR en pause : les brouillons FR restent brouillons
    const groups = new Map();
    for (const p of ready.filter((x) => postLang(x) === lang).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.createdAt.localeCompare(b.createdAt))) {
      const k = p.batch ?? p.source ?? "";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    const lane = [];
    const qs = [...groups.values()];
    while (qs.some((q) => q.length)) for (const q of qs) if (q.length) lane.push(q.shift());
    const times = ((lang === "en" ? s.enTimes : s.frTimes) ?? []).filter(Boolean).sort();
    if (!times.length) continue;
    let day = new Date();
    day.setHours(0, 0, 0, 0);
    let ti = 0;
    for (const p of lane) {
      let when;
      for (;;) {
        const [h, m] = times[ti].split(":").map(Number);
        when = new Date(day);
        when.setHours(h, m, 0, 0);
        if (++ti >= times.length) {
          ti = 0;
          day = new Date(day.getTime() + 86400000);
        }
        if (when.getTime() > Date.now() + 15 * 60000 && !taken.has(when.toISOString().slice(0, 16))) break;
      }
      taken.add(when.toISOString().slice(0, 16));
      Object.assign(p, { publishAt: when.toISOString(), status: "scheduled" });
      n++;
    }
  }
  saveStore();
  return n;
}
export const tiktokState = { sending: null, lastError: null, users: {} };
const newId = () => `tt-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

export function config() {
  return existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : null;
}

export function status() {
  const c = config();
  return {
    configured: !!(c?.clientKey && c?.clientSecret),
    hosting: !!(c?.hosting?.host && c?.hosting?.publicBaseUrl),
    hostingDomain: c?.hosting?.publicBaseUrl ? c.hosting.publicBaseUrl.replace(/^https?:\/\//, "").split("/")[0] : null,
    connected: LANGS.some(hasToken),
    accounts: Object.fromEntries(LANGS.map((l) => [l, { connected: hasToken(l), user: tiktokState.users[l] ?? null, usedFor: LANGS.filter((x) => accountFor(x) === l) }])),
    user: tiktokState.users[accountFor("en")] ?? null,
    sending: tiktokState.sending,
    lastError: tiktokState.lastError,
  };
}

/* ------------------------------------------------------------------ OAuth (PKCE desktop) */

let pending = null; // { verifier, state, lang }

/** Connexion du compte d'une langue. TikTok connecte le compte ouvert dans le navigateur : change de compte sur tiktok.com avant. */
export function authUrl(lang = "en") {
  const c = config();
  if (!c?.clientKey) throw new Error("data/tiktok-config.json manquant (clientKey/clientSecret)");
  const verifier = randomBytes(48).toString("base64url");
  // TikTok desktop : code_challenge = SHA-256 du verifier encodé en HEX (pas en base64url).
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const state = randomBytes(12).toString("hex");
  pending = { verifier, state, lang: LANGS.includes(lang) ? lang : "en" };
  const q = new URLSearchParams({
    client_key: c.clientKey,
    scope: "user.info.basic,video.upload",
    response_type: "code",
    redirect_uri: REDIRECT,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

async function tokenRequest(params, lang) {
  const c = config();
  const body = new URLSearchParams({ client_key: c.clientKey, client_secret: c.clientSecret, ...params });
  const r = await fetch(`${API}/v2/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!j.access_token) throw new Error(`OAuth TikTok : ${j.error_description ?? j.error ?? JSON.stringify(j)}`);
  const tok = { ...j, obtained_at: Date.now() };
  writeFileSync(tokenFile(lang), JSON.stringify(tok, null, 2));
  return tok;
}

export async function handleCallback(query) {
  if (!pending || query.state !== pending.state) throw new Error("État OAuth invalide — relance la connexion.");
  if (query.error) throw new Error(`${query.error} : ${query.error_description ?? ""}`);
  const { lang, verifier } = pending;
  await tokenRequest({ code: String(query.code), grant_type: "authorization_code", redirect_uri: REDIRECT, code_verifier: verifier }, lang);
  pending = null;
  await refreshUser(lang);
}

async function accessToken(lang) {
  if (!lang || !hasToken(lang)) throw new Error("TikTok non connecté");
  let t = JSON.parse(readFileSync(tokenFile(lang), "utf8"));
  if (Date.now() > t.obtained_at + (t.expires_in - 300) * 1000) t = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token }, lang);
  return t.access_token;
}

async function api(path, body, lang) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(lang)}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json();
  if (j.error && j.error.code !== "ok") throw new Error(`${j.error.code} : ${j.error.message}`);
  return j.data;
}

/** Retire le compte d'une langue : ses posts partiront sur le compte de l'autre langue. */
export function forget(lang) {
  if (!LANGS.includes(lang)) return;
  rmSync(tokenFile(lang), { force: true });
  delete tiktokState.users[lang];
}

export async function refreshUser(only) {
  for (const lang of only ? [only] : LANGS) {
    if (!hasToken(lang)) {
      delete tiktokState.users[lang];
      continue;
    }
    try {
      const r = await fetch(`${API}/v2/user/info/?fields=open_id,display_name,avatar_url`, { headers: { Authorization: `Bearer ${await accessToken(lang)}` } });
      const j = await r.json();
      tiktokState.users[lang] = j.data?.user ?? null;
    } catch (e) {
      tiktokState.lastError = `Compte ${lang.toUpperCase()} : ${e.message}`;
    }
  }
  return tiktokState.users;
}

/* ------------------------------------------------------------------ hébergement des images (FTP / SFTP) */

async function uploadImages(post) {
  const h = config()?.hosting;
  if (!h?.host || !h?.publicBaseUrl) throw new Error("Hébergement des images non configuré (hosting dans data/tiktok-config.json)");
  const remoteDir = `${(h.remoteDir ?? "/www/tiktok").replace(/\/$/, "")}/${post.id}`;
  const files = post.images.map((f) => join(MEDIA, post.id, f));
  if (h.protocol === "sftp") {
    const { default: SftpClient } = await import("ssh2-sftp-client");
    const s = new SftpClient();
    await s.connect({ host: h.host, port: h.port ?? 22, username: h.user, password: h.password });
    await s.mkdir(remoteDir, true);
    for (const f of files) await s.fastPut(f, `${remoteDir}/${basename(f)}`);
    await s.end();
  } else {
    const { Client } = await import("basic-ftp");
    const c = new Client();
    await c.access({ host: h.host, port: h.port ?? 21, user: h.user, password: h.password, secure: h.protocol === "ftps" });
    await c.ensureDir(remoteDir);
    for (const f of files) await c.uploadFrom(f, basename(f));
    c.close();
  }
  return post.images.map((f) => `${h.publicBaseUrl.replace(/\/$/, "")}/${post.id}/${f}`);
}

/** Convertit une image déposée en JPEG ≤ 1080×1920 (format attendu par TikTok). */
export async function prepareImage(postId, srcPath, index) {
  const dir = join(MEDIA, postId);
  mkdirSync(dir, { recursive: true });
  const name = `${String(index + 1).padStart(2, "0")}-${randomBytes(3).toString("hex")}.jpg`;
  await run("ffmpeg", ["-v", "error", "-y", "-i", srcPath, "-vf", "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", join(dir, name)]);
  return name;
}

/* ------------------------------------------------------------------ envoi dans la boîte TikTok */

async function sendVideo(file, lang) {
  const size = statSync(file).size;
  // Règles TikTok : morceaux de 5 à 64 Mo (le dernier peut aller jusqu'à 128 Mo) ; < 64 Mo → un seul morceau.
  const CH = 10 * 1024 * 1024;
  const chunk = size <= 64 * 1024 * 1024 ? size : CH;
  const total = size <= 64 * 1024 * 1024 ? 1 : Math.floor(size / CH);
  const d = await api("/v2/post/publish/inbox/video/init/", { source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: total } }, lang);
  const buf = readFileSync(file);
  for (let i = 0; i < total; i++) {
    const start = i * chunk;
    const end = i === total - 1 ? size - 1 : start + chunk - 1;
    const r = await fetch(d.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
      body: buf.subarray(start, end + 1),
    });
    if (r.status >= 300) throw new Error(`Envoi vidéo : HTTP ${r.status} ${await r.text()}`);
  }
  return d.publish_id;
}

async function sendPhotos(post, lang) {
  const urls = await uploadImages(post);
  const d = await api("/v2/post/publish/content/init/", {
    post_info: { title: post.title.slice(0, 90), description: post.description.slice(0, 4000) },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: urls },
    post_mode: "MEDIA_UPLOAD",
    media_type: "PHOTO",
  }, lang);
  return d.publish_id;
}

/** Notification système + légende copiée dans le presse-papiers (TikTok ne la transmet pas pour les vidéos). */
async function notifySent(post) {
  copyToClipboard([post.title, post.description].filter(Boolean).join("\n\n"));
  notify("Studio YouTube · TikTok", `Brouillon envoyé dans ta boîte TikTok : « ${post.title.slice(0, 60)} ». Légende copiée — ajoute un son et publie.`);
}

export async function sendPost(post) {
  if (tiktokState.sending) throw new Error("Un envoi TikTok est déjà en cours");
  tiktokState.sending = post.id;
  post.status = "sending";
  saveStore();
  try {
    const account = accountFor(postLang(post));
    if (!account) throw new Error(`Aucun compte TikTok ${postLang(post).toUpperCase()} connecté`);
    let publishId;
    if (post.type === "photo") {
      if (!post.images?.length) throw new Error("Aucune image dans ce carrousel");
      publishId = await sendPhotos(post, account);
    } else {
      const file = post.videoFile;
      if (!file || !existsSync(file)) throw new Error("Vidéo introuvable (rends-la d'abord)");
      publishId = await sendVideo(file, account);
    }
    Object.assign(post, { status: "sent", account, publishId, sentAt: new Date().toISOString(), error: null, retryAt: null, waiting: null, attempts: 0 });
    tiktokState.lastError = null;
    logEvent("upload", `TikTok : brouillon envoyé — « ${post.title} »`, post.id);
    void notifySent(post);
  } catch (e) {
    if (/spam_risk_too_many_pending_share/.test(String(e.message))) {
      // Trop de brouillons non publiés dans TikTok : on réessaie plus tard, sans le marquer en erreur.
      const retry = new Date(Date.now() + 2 * 3600000);
      Object.assign(post, { status: "scheduled", retryAt: retry.toISOString(), waiting: "TikTok bloque : trop de brouillons en attente dans ta boîte. Publie ou supprime-en quelques-uns." });
      logEvent("info", `TikTok : « ${post.title} » en attente (boîte TikTok pleine), nouvel essai à ${retry.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}`, post.id);
      return;
    }
    // Coupure réseau / FTP passagère : nouvel essai dans 15 min (5 tentatives max) plutôt qu'une erreur.
    if (/ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND|EAI_AGAIN|socket|fetch failed|timeout/i.test(String(e.message)) && (post.attempts ?? 0) < 5) {
      const retry = new Date(Date.now() + 15 * 60000);
      Object.assign(post, { status: "scheduled", attempts: (post.attempts ?? 0) + 1, retryAt: retry.toISOString(), waiting: `Coupure réseau pendant l'envoi (${String(e.message).slice(0, 60)}).` });
      logEvent("info", `TikTok : « ${post.title} » — coupure réseau, nouvel essai à ${retry.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}`, post.id);
      return;
    }
    Object.assign(post, { status: "error", error: String(e.message ?? e).slice(0, 300) });
    tiktokState.lastError = `${post.title} : ${post.error}`;
    logEvent("error", `TikTok : échec de l'envoi de « ${post.title} » — ${post.error}`, post.id);
  } finally {
    tiktokState.sending = null;
    saveStore();
  }
}

/**
 * Stories : le post TikTok suit le créneau YouTube de sa story, y compris quand il bouge.
 * Créneau raté et pas encore sur YouTube : le post repasse en brouillon jusqu'au nouveau créneau.
 */
export function syncTalePosts() {
  const vids = getState().videos;
  let changed = false;
  for (const p of store.posts) {
    if (!isTaleId(p.videoId) || !["draft", "scheduled"].includes(p.status)) continue;
    const st = vids[p.videoId];
    const ok = st?.publishAt && (st.youtubeId || new Date(st.publishAt).getTime() > Date.now() + 30 * 60000);
    const next = ok ? { publishAt: st.publishAt, status: "scheduled" } : { publishAt: null, status: "draft" };
    if (p.publishAt === next.publishAt && p.status === next.status) continue;
    Object.assign(p, next, { retryAt: null, waiting: null });
    changed = true;
  }
  if (changed) saveStore();
}

/** Planificateur : envoie les brouillons dont l'heure est arrivée (appelé chaque minute). */
export async function tick() {
  syncTalePosts();
  if (!status().connected || tiktokState.sending) return;
  const at = (p) => (p.retryAt && p.retryAt > p.publishAt ? p.retryAt : p.publishAt);
  // Pas de compte pour la langue du post : il reste programmé et part dès qu'un compte est connecté.
  const due = store.posts.filter((p) => p.status === "scheduled" && postOn(p) && accountFor(postLang(p)) && p.publishAt && new Date(at(p)) <= new Date()).sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  for (const p of due.slice(0, 3)) {
    await sendPost(p); // TikTok : 6 requêtes / minute max
    if (p.waiting) break; // boîte pleine : inutile d'essayer les suivants maintenant
  }
}

/**
 * Fin de la pause des pubs : les posts pubs dont l'heure est passée pendant la pause ne partent pas tous d'un coup,
 * ils reprennent les prochains créneaux libres. Renvoie le nombre de posts reprogrammés.
 */
export function rescheduleOverduePubs() {
  const late = store.posts.filter((p) => p.status === "scheduled" && !isTalePost(p) && p.publishAt && new Date(p.publishAt).getTime() < Date.now() + 15 * 60000);
  for (const p of late) Object.assign(p, { status: "draft", publishAt: null, retryAt: null });
  return late.length ? scheduleDrafts(new Set(late.map((p) => p.id))) : 0;
}

/* ------------------------------------------------------------------ gestion des posts */

export function createPost(data) {
  const p = {
    id: newId(),
    type: data.type === "video" ? "video" : "photo",
    title: data.title ?? "",
    description: data.description ?? "",
    images: [],
    videoFile: data.videoFile ?? null,
    videoId: data.videoId ?? null,
    publishAt: data.publishAt ?? null,
    status: data.publishAt ? "scheduled" : "draft",
    source: data.source ?? null,
    createdAt: new Date().toISOString(),
  };
  store.posts.push(p);
  saveStore();
  return p;
}

export function updatePost(id, patch) {
  const p = store.posts.find((x) => x.id === id);
  if (!p) throw new Error("Post introuvable");
  if (p.status === "sent" || p.status === "sending") throw new Error("Déjà envoyé");
  for (const k of ["title", "description", "publishAt", "type", "videoFile", "videoId", "images"]) if (patch[k] !== undefined) p[k] = patch[k];
  if (patch.publishAt !== undefined || p.status === "error") Object.assign(p, { status: p.publishAt ? "scheduled" : "draft", retryAt: null, waiting: null });
  saveStore();
  return p;
}

export function deletePost(id) {
  store.posts = store.posts.filter((x) => x.id !== id);
  rmSync(join(MEDIA, id), { recursive: true, force: true });
  saveStore();
}

export function addImages(id, names) {
  const p = store.posts.find((x) => x.id === id);
  p.images.push(...names);
  if (p.images.length > 35) p.images = p.images.slice(0, 35);
  saveStore();
  return p;
}

/* ------------------------------------------------------------------ import Markdown */

/**
 * Lit un .md contenant plusieurs posts. Formats acceptés (souples) :
 *   ## Titre du post                      ← un titre de section = un post
 *   **Titre :** …  / Title: …             ← titre explicite (prioritaire)
 *   **Description :** … / Légende : …     ← description sur la ligne ou les lignes suivantes
 *   > texte en citation                    ← description (style LEGENDES.md)
 *   **Hashtags :** #a #b                   ← ajoutés à la fin de la description
 * Les tableaux, « Son conseillé », « Beat map », « Meilleur créneau »… sont ignorés.
 */
export function parseMarkdown(md, sourceName) {
  const sections = [];
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (h && h[1].length >= 2) {
      cur = { heading: h[2], lines: [] };
      sections.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  const clean = (s) => s.replace(/\*\*/g, "").replace(/^\s*>\s?/, "").trim();
  const out = [];
  for (const s of sections) {
    let title = null;
    const desc = [];
    let hashtags = "";
    let mode = null;
    for (const raw of s.lines) {
      const line = raw.trim();
      if (!line) {
        if (mode === "desc" && desc.length) mode = null;
        continue;
      }
      const kv = /^\**\s*(titre|title|description|légende|legende|caption|texte|hashtags?)\s*\**\s*:\s*\**\s*(.*)$/i.exec(line);
      if (kv) {
        const key = kv[1].toLowerCase();
        const val = clean(kv[2]);
        if (key.startsWith("titre") || key === "title") title = val;
        else if (key.startsWith("hashtag")) hashtags = val;
        else {
          mode = "desc";
          if (val) desc.push(val);
        }
        continue;
      }
      if (/^\**\s*[\wÀ-ÿ' ]{2,30}\s*\**\s*:/.test(line) && !line.startsWith(">")) {
        mode = null; // autre champ (Son conseillé, Meilleur créneau…) → ignoré
        continue;
      }
      if (line.startsWith("|")) continue;
      if (line.startsWith(">") || mode === "desc") desc.push(clean(line));
    }
    const description = [desc.join("\n"), hashtags].filter(Boolean).join("\n\n").trim();
    if (!description && !title) continue;
    out.push({ title: (title ?? s.heading.replace(/^\d+\s*[—–-]\s*/, "").replace(/\s*\(\d+\s*s\)\s*$/, "")).trim(), description, source: sourceName });
  }
  return out;
}

export const exts = { image: [".jpg", ".jpeg", ".png", ".webp", ".heic"], isImage: (f) => [".jpg", ".jpeg", ".png", ".webp", ".heic"].includes(extname(f).toLowerCase()) };
export const listMedia = (id) => (existsSync(join(MEDIA, id)) ? readdirSync(join(MEDIA, id)) : []);
