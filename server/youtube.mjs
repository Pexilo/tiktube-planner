// Connexion OAuth YouTube (client "Application de bureau") + upload programmé (publishAt).
// YouTube publie lui-même à l'heure prévue : le Mac n'a pas besoin d'être allumé à ce moment-là.
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { google } from "googleapis";
import { loadTale, ROOT } from "../shared/catalog.mjs";
import { buildTimeline, FPS } from "../shared/timeline.mjs";
import { DATA, getState, save, video, videoOn } from "./state.mjs";
import { outFile, thumbFile } from "./render.mjs";
import { logEvent } from "./events.mjs";
import { signature } from "../shared/profile.mjs";

export const PORT = Number(process.env.PORT ?? 4321);
const REDIRECT = `http://localhost:${PORT}/oauth/callback`;
const TOKEN = join(DATA, "youtube-token.json");
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

export const uploadState = { id: null, progress: 0, queue: [], lastError: null, channel: null };

function secretPath() {
  for (const p of [join(ROOT, "client_secret.json"), join(DATA, "client_secret.json")]) if (existsSync(p)) return p;
  return null;
}

function client() {
  const p = secretPath();
  if (!p) return null;
  const j = JSON.parse(readFileSync(p, "utf8"));
  const c = j.installed ?? j.web;
  const oauth = new google.auth.OAuth2(c.client_id, c.client_secret, REDIRECT);
  if (existsSync(TOKEN)) oauth.setCredentials(JSON.parse(readFileSync(TOKEN, "utf8")));
  oauth.on("tokens", (t) => {
    const old = existsSync(TOKEN) ? JSON.parse(readFileSync(TOKEN, "utf8")) : {};
    writeFileSync(TOKEN, JSON.stringify({ ...old, ...t }, null, 2));
  });
  return oauth;
}

export function status() {
  return {
    hasSecret: !!secretPath(),
    connected: existsSync(TOKEN),
    channel: uploadState.channel,
  };
}

export function authUrl() {
  const c = client();
  if (!c) throw new Error("client_secret.json introuvable à la racine du projet");
  return c.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
}

export async function handleCallback(code) {
  const c = client();
  const { tokens } = await c.getToken(code);
  writeFileSync(TOKEN, JSON.stringify(tokens, null, 2));
  await refreshChannel();
}

export async function refreshChannel() {
  const c = client();
  if (!c || !existsSync(TOKEN)) return null;
  try {
    const yt = google.youtube({ version: "v3", auth: c });
    const r = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
    const ch = r.data.items?.[0];
    uploadState.channel = ch ? { id: ch.id, title: ch.snippet.title, thumb: ch.snippet.thumbnails?.default?.url, subs: ch.statistics?.subscriberCount } : null;
  } catch (e) {
    uploadState.lastError = `Chaîne : ${e.message}`;
  }
  return uploadState.channel;
}

const plain = (t) => t.replace(/\*/g, "");
const ts = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Chapitres YouTube (vidéos 16:9) : 1er à 0:00, chacun ≥ 10 s — sinon YouTube les ignore. */
function chapters(v, app) {
  const fr = v.lang === "fr";
  const tl = buildTimeline(app, "long");
  const byId = Object.fromEntries(app.features.map((f) => [f.id, f]));
  const segs = [];
  for (const s of tl.scenes) {
    const label =
      s.type === "hook" || s.type === "problem" ? (fr ? "Le problème" : "The problem")
      : s.type === "reveal" ? (fr ? `Découvre ${app.name}` : `Meet ${app.name}`)
      : s.type === "feature" ? plain(byId[s.featureId].title[v.lang])
      : s.type === "montage" ? (fr ? "Aperçu de l'app" : "App overview")
      : s.type === "benefits" ? (fr ? "Prix & avantages" : "Pricing & benefits")
      : fr ? "Télécharger" : "Download";
    const last = segs[segs.length - 1];
    if (last && last.label === label) last.dur += s.dur;
    else segs.push({ label, from: s.from, dur: s.dur });
  }
  const out = [];
  let cur = null;
  for (const sg of segs) {
    if (!cur) cur = { ...sg, labels: [sg.label] };
    else {
      cur.dur += sg.dur;
      cur.labels.push(sg.label);
    }
    if (cur.dur >= 10 * FPS) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) {
    const prev = out[out.length - 1];
    prev.dur += cur.dur;
    prev.labels.push(...cur.labels);
  }
  return out.map((c) => `${ts(c.from / FPS)} ${c.labels.slice(0, 2).join(" · ")}`);
}

/** Métadonnées YouTube optimisées SEO (titre, description, tags, catégorie). */
export function buildMetadata(v, app) {
  if (v.kind === "tale") return buildTaleMetadata(v, app);
  if (v.external) return buildExternalMetadata(v, app);
  if (v.kind === "keynote") return buildKeynoteMetadata(v, app);
  const lang = v.lang;
  const fr = lang === "fr";
  const seo = app.seo ?? { category: "28", keywords: { fr: [], en: [] }, hashtags: { fr: [], en: [] } };

  // Titre : accroche + nom de l'app (mot-clé de marque), #shorts en fin pour les Shorts.
  const def = v.kind === "story" ? app.stories[v.shortIndex] : v.kind === "short" ? app.shorts[v.shortIndex] : null;
  let title = v.title;
  if (def) {
    const base = title.replace(/\s*#shorts\s*/i, "").trim();
    title = base.toLowerCase().includes(app.name.toLowerCase()) ? `${base} #shorts` : `${base} | ${app.name} #shorts`;
  }
  title = title.slice(0, 100);

  const main = app.links[0];
  const vous = fr && /\bvous\b|\bvotre\b/i.test(app.description.fr);
  const sep = fr ? " : " : ": ";
  const lines = [];
  // 2 premières lignes = ce que YouTube affiche dans les résultats : mot-clé + lien.
  const hook = def ? plain(def.hook[lang]) : plain(app.long.hook[app.long.hook.length - 1][lang]);
  lines.push(`${hook} ${app.name} — ${plain(app.category[lang])}.`);
  lines.push(`👉 ${fr ? (vous ? "Essayez" : "Essaie") : "Try"} ${app.name}${sep}${main.url}`);
  lines.push("");
  lines.push(app.description[lang]);
  lines.push("");
  if (v.kind === "long") {
    lines.push(fr ? "⏱️ Chapitres" : "⏱️ Chapters", ...chapters(v, app), "");
    lines.push(fr ? "✅ Ce que fait l'app :" : "✅ What it does:");
    for (const id of app.long.features) {
      const f = app.features.find((x) => x.id === id);
      lines.push(`• ${plain(f.title[lang])} — ${f.text[lang]}`);
    }
    lines.push("");
  } else {
    const feats = def.features.map((id) => app.features.find((x) => x.id === id));
    for (const f of feats) lines.push(`✅ ${plain(f.title[lang])}`);
    lines.push("");
  }
  lines.push(`💰 ${plain(app.price[lang])}`);
  lines.push("");
  lines.push(fr ? "🔗 Liens :" : "🔗 Links:");
  for (const l of app.links) lines.push(`${l.label[lang]}${sep}${l.url}`);
  lines.push("");
  lines.push(fr ? `${app.name} est idéal si ${vous ? "vous cherchez" : "tu cherches"} : ${seo.keywords[lang].slice(1, 6).join(", ")}.` : `${app.name} is perfect if you're looking for: ${seo.keywords[lang].slice(1, 6).join(", ")}.`);
  lines.push("");
  if (signature(lang, vous)) lines.push(signature(lang, vous));
  // Les 3 premiers hashtags s'affichent au-dessus du titre.
  const hashtags = [...(v.kind !== "long" ? ["Shorts"] : []), app.name.replace(/\s/g, ""), ...seo.hashtags[lang]]
    .slice(0, 4)
    .map((h) => `#${h.replace(/[^\p{L}\p{N}]/gu, "")}`);
  lines.push("", hashtags.join(" "));

  // Tags : marque + mots-clés de la langue, limite YouTube 500 caractères.
  const tags = [];
  let len = 0;
  for (const t of [app.name, app.slug, ...seo.keywords[lang], ...app.tags]) {
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    if (len + t.length + 3 > 480) break;
    tags.push(t);
    len += t.length + 3;
  }
  return { title, description: lines.join("\n").slice(0, 4900), tags, categoryId: seo.category };
}

/** Métadonnées de la série calme "Keynote" : chaque élément montré devient une ligne de description. */
function buildKeynoteMetadata(v, app) {
  const lang = v.lang;
  const fr = lang === "fr";
  const vous = fr && /\bvous\b|\bvotre\b/i.test(app.description.fr);
  const seo = app.seo ?? { category: "28", keywords: { fr: [], en: [] }, hashtags: { fr: [], en: [] } };
  const sep = fr ? " : " : ": ";
  const def = app.keynote.videos[v.shortIndex];
  const byId = Object.fromEntries(app.keynote.details.map((d) => [d.id, d]));
  const lines = [`${plain(def.intro[lang])} ${app.name} — ${plain(app.category[lang])}.`, `👉 ${fr ? (vous ? "Essayez" : "Essaie") : "Try"} ${app.name}${sep}${app.links[0].url}`, "", app.description[lang], ""];
  lines.push(fr ? "🔎 Dans cette vidéo :" : "🔎 In this video:");
  for (const id of def.details) lines.push(`• ${plain(byId[id].title[lang])} — ${byId[id].text[lang]}`);
  lines.push("", `💰 ${plain(app.price[lang])}`, "", fr ? "🔗 Liens :" : "🔗 Links:");
  for (const l of app.links) lines.push(`${l.label[lang]}${sep}${l.url}`);
  lines.push("", fr ? `${app.name} est idéal si ${vous ? "vous cherchez" : "tu cherches"} : ${seo.keywords[lang].slice(1, 6).join(", ")}.` : `${app.name} is perfect if you're looking for: ${seo.keywords[lang].slice(1, 6).join(", ")}.`);
  if (signature(lang, vous)) lines.push("", signature(lang, vous));
  const hashtags = [...(v.format !== "long" ? ["Shorts"] : []), app.name.replace(/\s/g, ""), ...seo.hashtags[lang]].slice(0, 4).map((h) => `#${h.replace(/[^\p{L}\p{N}]/gu, "")}`);
  lines.push("", hashtags.join(" "));
  const tags = [];
  let len = 0;
  for (const t of [app.name, app.slug, ...seo.keywords[lang], ...app.tags]) {
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase()) || len + t.length + 3 > 480) continue;
    tags.push(t);
    len += t.length + 3;
  }
  return { title: v.title.slice(0, 100), description: lines.join("\n").slice(0, 4900), tags, categoryId: seo.category };
}

/** Stories crypto : l'histoire et ses sources d'abord, une seule ligne discrète vers l'app, puis les hashtags. Aucun lien. */
function buildTaleMetadata(v, app) {
  const tale = loadTale(v.taleSlug);
  const base = tale.yt.title.replace(/\s*#shorts\s*/i, "").trim();
  const title = `${base} #shorts`.slice(0, 100);
  const tags = [...new Set(tale.yt.hashtags.map((h) => h.replace(/^#/, "")))];
  const hashtags = ["Shorts", ...tags].slice(0, 8).map((h) => `#${h.replace(/[^\p{L}\p{N}]/gu, "")}`);
  const noLinks = (s) => String(s ?? "").replace(/\s*\(?\b(?:https?:\/\/|www\.)\S+/gi, "").trim();
  const lines = [noLinks(tale.yt.description), "", noLinks(tale.summary), ""];
  if (tale.sources?.length) {
    lines.push("Sources:");
    for (const s of tale.sources) lines.push(`• ${noLinks(s.title)}${s.date ? ` (${s.date})` : ""}`);
    lines.push("");
  }
  lines.push(`Check your own wallet's real P&L with ${app.name}.`, "", hashtags.join(" "));
  const out = [];
  let len = 0;
  for (const t of ["crypto stories", ...tags]) {
    if (out.some((x) => x.toLowerCase() === t.toLowerCase()) || len + t.length + 3 > 480) continue;
    out.push(t);
    len += t.length + 3;
  }
  return { title, description: lines.join("\n").slice(0, 4900), tags: out, categoryId: "27" };
}

/** Légende TikTok tirée des métadonnées YouTube : 2 premières lignes + hashtags (sans #shorts). */
export function tiktokCaption(m) {
  const hashtags = (m.description.match(/#[\p{L}\p{N}_]+/gu) ?? []).filter((h) => h.toLowerCase() !== "#shorts").slice(0, 6).join(" ");
  const first = m.description.split("\n").filter(Boolean).slice(0, 2).join("\n");
  return { title: m.title.replace(/\s*#shorts/i, "").slice(0, 90), description: `${first}\n\n${hashtags}` };
}

/** Métadonnées des vidéos externes : leur légende d'origine + liens, prix, mots-clés et hashtags de l'app. */
function buildExternalMetadata(v, app) {
  const lang = v.lang;
  const fr = lang === "fr";
  const seo = app.seo ?? { category: "28", keywords: { fr: [], en: [] }, hashtags: { fr: [], en: [] } };
  const sep = fr ? " : " : ": ";
  const lines = [v.external.caption, `👉 ${fr ? "Essaie" : "Try"} ${app.name}${sep}${app.links[0].url}`, "", app.description[lang], "", `💰 ${plain(app.price[lang])}`, ""];
  lines.push(fr ? "🔗 Liens :" : "🔗 Links:");
  for (const l of app.links) lines.push(`${l.label[lang]}${sep}${l.url}`);
  if (app.slug === "mrrkit") lines.push("", fr ? "Chiffres affichés = données de démo de l'app." : "Figures shown are the app's demo data.");
  if (signature(lang)) lines.push("", signature(lang));
  const extra =
    app.slug === "mrrkit"
      ? fr ? ["indiehacker", "buildinpublic", "saas", "mrr", "devios", "entrepreneur"] : ["indiehacker", "buildinpublic", "saas", "mrr", "iosdev", "solofounder"]
      : seo.hashtags[lang];
  // Hashtags fournis avec la vidéo (ex. LEGENDES.md) en priorité, sinon ceux de l'app.
  const own = v.external.hashtags ?? extra;
  const hashtags = [...(v.kind !== "long" ? ["Shorts"] : []), ...own.slice(0, 3), app.name.replace(/\s/g, ""), ...own.slice(3)].slice(0, 8).map((h) => `#${h}`);
  lines.push("", hashtags.join(" "));
  const tags = [];
  let len = 0;
  for (const t of [app.name, ...(v.external.hashtags ?? []), ...seo.keywords[lang], ...app.tags]) {
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase()) || len + t.length + 3 > 480) continue;
    tags.push(t);
    len += t.length + 3;
  }
  return { title: v.title.slice(0, 100), description: lines.join("\n").slice(0, 4900), tags, categoryId: seo.category };
}

const today = () => new Date().toISOString().slice(0, 10);
export const uploadsToday = () => getState().uploadsLog.filter((u) => u.at.slice(0, 10) === today()).length;

/** `now` : publiée tout de suite en public (créneau raté), sinon privée et programmée sur `publishAt`. */
export async function uploadOne(v, app, { now = false } = {}) {
  const c = client();
  if (!c || !existsSync(TOKEN)) throw new Error("YouTube non connecté");
  const st = video(v.id);
  if (st.youtubeId) return st.youtubeId;
  if (!existsSync(outFile(v.id))) throw new Error("Vidéo pas encore rendue");
  if (now) Object.assign(st, { publishAt: new Date().toISOString(), locked: true });
  const publishAt = st.publishAt;
  if (!now && (!publishAt || new Date(publishAt).getTime() < Date.now() + 15 * 60 * 1000))
    throw new Error("Date de publication absente ou trop proche (min. 15 min) — régénère le planning");

  const meta = buildMetadata(v, app);
  const yt = google.youtube({ version: "v3", auth: c });
  const size = statSync(outFile(v.id)).size;
  uploadState.id = v.id;
  uploadState.progress = 0;
  const res = await yt.videos.insert(
    {
      part: ["snippet", "status"],
      notifySubscribers: true,
      requestBody: {
        snippet: {
          title: meta.title,
          description: meta.description,
          tags: meta.tags,
          categoryId: meta.categoryId,
          defaultLanguage: v.lang,
          defaultAudioLanguage: v.lang,
        },
        status: {
          ...(now ? { privacyStatus: "public" } : { privacyStatus: "private", publishAt }),
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: false,
          embeddable: true,
        },
      },
      media: { mimeType: "video/mp4", body: createReadStream(outFile(v.id)) },
    },
    {
      onUploadProgress: (e) => {
        uploadState.progress = e.bytesRead / size;
      },
    },
  );
  const id = res.data.id;
  Object.assign(st, { youtubeId: id, uploadedAt: new Date().toISOString(), uploadError: null });
  getState().uploadsLog.push({ at: new Date().toISOString(), id: v.id });
  save();
  if (now) logEvent("upload", `Publiée sur YouTube : ${meta.title}`, v.id);
  else logEvent("upload", `Programmée sur YouTube : ${meta.title} → ${new Date(publishAt).toLocaleString("fr-BE", { timeZone: "Europe/Brussels", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, v.id);

  if (v.format === "long" && existsSync(thumbFile(v.id))) {
    try {
      await yt.thumbnails.set({ videoId: id, media: { mimeType: "image/jpeg", body: createReadStream(thumbFile(v.id)) } });
    } catch (e) {
      // Les miniatures personnalisées exigent une chaîne vérifiée (numéro de téléphone).
      st.thumbError = e.message;
      save();
    }
  }
  return id;
}

/** Envoie une liste de vidéos à la suite, en respectant le quota quotidien. */
export async function uploadMany(list, catalog) {
  if (uploadState.id) return;
  const max = getState().settings.maxUploadsPerDay;
  uploadState.queue = list.map((v) => v.id);
  uploadState.total = list.length;
  for (const v of list) {
    if (!videoOn(v)) continue; // langue ou pubs mises en pause pendant le lot
    if (uploadsToday() >= max) {
      uploadState.lastError = `Quota du jour atteint (${max} uploads). La suite partira demain.`;
      logEvent("info", uploadState.lastError);
      break;
    }
    const app = catalog.apps.find((a) => a.slug === v.slug);
    try {
      await uploadOne(v, app);
      uploadState.lastError = null;
    } catch (e) {
      const msg = e?.errors?.[0]?.reason ?? e.message;
      video(v.id).uploadError = String(msg).slice(0, 300);
      save();
      uploadState.lastError = `${v.id} : ${msg}`;
      logEvent("error", `Échec de l'envoi de ${v.id} : ${msg}`, v.id);
      if (/quota|EPIPE|uploadLimitExceeded/i.test(msg)) break; // YouTube coupe la connexion quand la limite est atteinte
    } finally {
      uploadState.queue = uploadState.queue.filter((x) => x !== v.id);
    }
  }
  uploadState.id = null;
  uploadState.progress = 0;
  uploadState.queue = [];
}
