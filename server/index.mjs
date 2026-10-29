// Studio YouTube local — lance avec `npm start` puis ouvre http://localhost:4321
import express from "express";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { cp, readdir, rename, rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { loadCatalog, ROOT } from "../shared/catalog.mjs";
import { openPath, revealPath, spawnNpx } from "../shared/platform.mjs";
import { awaitingOk, getState, langOn, pubsOn, save, setStorage, updateSettings, video, videoOn, OUT } from "./state.mjs";
import { outDirFor, tempDirFor } from "../shared/storage.mjs";
import { generateSchedule } from "./scheduler.mjs";
import { cancelQueue, cleanupPublished, current, dropPausedFromQueue, enqueue, isRendered, queue, renderBusy, STAGES } from "./render.mjs";
import { avgSeconds, events, logEvent } from "./events.mjs";
import multer from "multer";
import { homedir, tmpdir } from "node:os";
import * as tt from "./tiktok.mjs";
import * as ig from "./instagram.mjs";
import * as discord from "./discord.mjs";
import { smartImport } from "./smartimport.mjs";
import * as watch from "./watchfolder.mjs";
import { setupRoutes } from "./setup.mjs";
import { loadProfile } from "../shared/profile.mjs";
import { authUrl, buildMetadata, forget as forgetYt, handleCallback, PORT, refreshChannel, reschedule, status as ytStatus, tiktokCaption, uploadMany, uploadOne, uploadState, uploadsToday } from "./youtube.mjs";
import { setupTaleRoutes } from "./tales.mjs";

const app = express();
app.use(express.json());
// OUT suit le dossier de stockage des Réglages : le service statique est recréé quand il change.
let outStatic = { dir: null, mw: null };
app.use("/out", (req, res, next) => {
  if (outStatic.dir !== OUT) outStatic = { dir: OUT, mw: express.static(OUT) };
  outStatic.mw(req, res, next);
});
// Voix et bruitages sont refaits sous le même nom : le navigateur revalide à chaque lecture (304 si rien n'a changé).
app.use("/public", express.static(join(ROOT, "public"), { setHeaders: (res) => res.setHeader("Cache-Control", "no-cache") }));
app.use(express.static(join(ROOT, "server/ui")));

const catalog = () => loadCatalog();
// Catalogue limité aux langues actives : base de toutes les actions (rendu, planning, envois).
const activeCatalog = () => {
  const c = loadCatalog();
  return { ...c, videos: c.videos.filter((v) => langOn(v.lang)) };
};

// Premier lancement : planning par défaut
if (Object.keys(getState().videos).length === 0) generateSchedule(activeCatalog());

function snapshot() {
  const c = catalog();
  const s = getState();
  const videos = c.videos.map((v) => {
    const st = s.videos[v.id] ?? {};
    const rendered = isRendered(v.id);
    return {
      id: v.id,
      slug: v.slug,
      appName: v.appName,
      kind: v.kind,
      format: v.format,
      lang: v.lang,
      paused: !langOn(v.lang),
      title: v.title,
      durationSec: v.durationSec,
      color: v.color,
      external: !!v.external,
      publishAt: st.publishAt ?? null,
      locked: !!st.locked,
      rendered,
      thumb: rendered || !!st.cleanedAt, // la miniature reste après le nettoyage J+1
      renderedAt: st.renderedAt ?? null,
      renderError: st.renderError ?? null,
      youtubeId: st.youtubeId ?? null,
      uploadError: st.uploadError ?? null,
      thumbError: st.thumbError ?? null,
      published: !!st.youtubeId && st.publishAt && new Date(st.publishAt) < new Date(),
    };
  });
  return {
    apps: c.apps.map((a) => ({ slug: a.slug, name: a.name, color: a.brand.primary, icon: `/public/apps/${a.slug}/${a.icon}` })),
    videos,
    settings: s.settings,
    render: {
      current: { ...current },
      queue: [...queue],
      stages: STAGES,
      avgSec: { short: avgSeconds("short"), story: avgSeconds("story"), long: avgSeconds("long") },
    },
    autopilot: { ...autopilotInfo },
    events: events.slice(0, 60),
    upload: { ...uploadState, today: uploadsToday() },
    youtube: ytStatus(),
    profile: loadProfile(),
  };
}

app.get("/api/state", (_req, res) => res.json(snapshot()));
setupRoutes(app);
setupTaleRoutes(app, { activeCatalog });

app.post("/api/render", (req, res) => {
  const c = activeCatalog();
  const active = new Set(c.videos.map((v) => v.id));
  let ids = (req.body.ids ?? []).filter((id) => active.has(id));
  if (req.body.all) ids = c.videos.filter((v) => !isRendered(v.id) && !getState().videos[v.id]?.youtubeId).map((v) => v.id); // déjà sur YouTube (fichier nettoyé J+1) : rien à refaire
  if (req.body.force) ids.forEach((id) => (video(id).rendered = false));
  enqueue(ids, c);
  res.json({ queued: ids.length });
});
app.post("/api/render/cancel", (_req, res) => {
  cancelQueue();
  res.json({ ok: true });
});

app.post("/api/schedule/generate", (_req, res) => {
  generateSchedule(activeCatalog());
  logEvent("schedule", "Planning régénéré");
  res.json({ ok: true });
});

app.patch("/api/videos/:id", async (req, res) => {
  const st = video(req.params.id);
  // Déjà programmée sur YouTube : la date change dans YouTube, et le post TikTok d'une story suit.
  if (st.youtubeId) {
    if (req.body.publishAt === undefined) return res.json({ ok: true });
    if (new Date(st.publishAt).getTime() <= Date.now()) return res.status(400).json({ error: "Déjà sortie sur YouTube : la date ne se change plus." });
    const at = new Date(req.body.publishAt);
    if (at.getTime() < Date.now() + 10 * 60000) return res.status(400).json({ error: "Trop proche : choisis une heure au moins 10 min plus tard." });
    const v = catalog().videos.find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: "Vidéo introuvable" });
    try {
      await reschedule(v, at.toISOString());
    } catch (e) {
      return res.status(400).json({ error: `YouTube : ${e?.errors?.[0]?.message ?? e.message}` });
    }
    tt.syncTalePosts();
    logEvent("schedule", `Date changée sur YouTube : ${v.title} → ${at.toLocaleString("fr-BE", { timeZone: "Europe/Brussels", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, v.id);
    return res.json({ ok: true });
  }
  if (req.body.publishAt !== undefined) {
    // L'autopilote passe toutes les 10 min et YouTube veut l'envoi 15 min avant : en dessous de 30 min, le créneau serait raté.
    if (new Date(req.body.publishAt).getTime() < Date.now() + 30 * 60000)
      return res.status(400).json({ error: "Trop proche : choisis une heure au moins 30 min plus tard (YouTube doit recevoir la vidéo avant)." });
    st.publishAt = new Date(req.body.publishAt).toISOString();
    st.locked = true;
  }
  if (req.body.locked !== undefined) st.locked = !!req.body.locked;
  save();
  tt.syncTalePosts(); // le post TikTok d'une story suit tout de suite, sans attendre le prochain passage
  res.json({ ok: true });
});

app.patch("/api/settings", (req, res) => {
  delete req.body.storagePath; // changé uniquement via /api/settings/storage (déplacement des fichiers)
  updateSettings(req.body);
  if (req.body.accountShare !== undefined) dropPausedFromQueue(); // une langue peut perdre son dernier compte
  if (req.body.pubsEnabled !== undefined) {
    if (req.body.pubsEnabled) {
      const n = tt.rescheduleOverduePubs();
      logEvent("info", `Pubs réactivées${n ? ` : ${n} post(s) TikTok en retard reprogrammé(s)` : ""}`);
      void autopilot().catch((e) => console.error("autopilote", e)); // créneaux YouTube passés pendant la pause : replanifiés tout de suite
    } else logEvent("info", "Pubs en pause : rien n'est envoyé sur YouTube ni TikTok (les stories continuent)");
  }
  res.json(getState().settings);
});

// Dossier de stockage : vidéos rendues + temporaires. Les vidéos déjà rendues sont déplacées vers le nouveau dossier.
app.get("/api/settings/storage", (_req, res) => {
  const p = getState().settings.storagePath;
  res.json({ path: p, out: OUT, tmp: tempDirFor(p), projectOut: outDirFor(""), busy: renderBusy() });
});
app.post("/api/settings/storage", async (req, res) => {
  const raw = String(req.body.path ?? "").trim().replace(/^~(?=$|[\\/])/, homedir());
  if (raw && !isAbsolute(raw)) return res.status(400).json({ error: "Donne un chemin complet (ex. D:\\Studio ou /Volumes/SSD/Studio)." });
  const next = !raw || resolve(raw) === resolve(ROOT) ? "" : resolve(raw);
  if (renderBusy()) return res.status(409).json({ error: "Un rendu est en cours : attends la fin (ou vide la file) avant de changer de dossier." });
  const from = OUT;
  const to = outDirFor(next);
  try {
    mkdirSync(to, { recursive: true });
    mkdirSync(tempDirFor(next), { recursive: true });
    const probe = join(to, ".write-test");
    writeFileSync(probe, "");
    unlinkSync(probe);
  } catch (e) {
    return res.status(400).json({ error: `Dossier inutilisable : ${e.message}` });
  }
  let moved = 0;
  if (resolve(from) !== resolve(to)) {
    for (const name of await readdir(from)) {
      const a = join(from, name), b = join(to, name);
      // Aperçus de stories : refaits à la demande, et _public/ contient des jonctions vers public/ qu'on ne copie pas.
      if (name === "tales-preview" || existsSync(b)) continue; // déjà là (retour vers un ancien dossier) : on ne l'écrase pas
      // Autre disque : rename échoue (EXDEV), on copie puis on supprime.
      await rename(a, b).catch(async () => {
        await cp(a, b, { recursive: true });
        await rm(a, { recursive: true, force: true });
      });
      moved++;
    }
    tt.retargetVideoFiles(from, to);
  }
  updateSettings({ storagePath: next });
  setStorage(next);
  logEvent("info", `Dossier de stockage : ${next || "dossier du projet"}${moved ? ` (${moved} fichier(s) déplacé(s))` : ""}`);
  res.json({ ok: true, moved, path: next, out: OUT, tmp: tempDirFor(next) });
});

app.get("/api/videos/:id/metadata", (req, res) => {
  const c = catalog();
  const v = c.videos.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).end();
  res.json(buildMetadata(v, c.apps.find((a) => a.slug === v.slug)));
});

// Vidéo supprimée à la main dans YouTube Studio : on oublie l'upload pour la reprogrammer.
app.post("/api/videos/:id/unlink", (req, res) => {
  const st = video(req.params.id);
  for (const k of ["youtubeId", "uploadedAt", "uploadError", "thumbError", "publishAt", "locked"]) delete st[k];
  save();
  res.json({ ok: true });
});

app.post("/api/videos/:id/reveal", (req, res) => {
  const f = join(OUT, `${req.params.id}.mp4`);
  if (existsSync(f)) revealPath(f);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- YouTube
// ?lang=fr|en : la chaîne qui publiera les vidéos de cette langue
app.get("/api/youtube/auth", (req, res) => {
  try {
    res.redirect(authUrl(String(req.query.lang ?? "en")));
  } catch (e) {
    res.status(400).send(`<p style="font-family:system-ui">${e.message}. Suis le guide docs/YOUTUBE_SETUP.md.</p>`);
  }
});
app.get("/oauth/callback", async (req, res) => {
  try {
    await handleCallback(String(req.query.code), String(req.query.state ?? "en"));
    res.redirect(loadProfile().setupDone ? "/?connected=1" : "/setup.html#3");
  } catch (e) {
    res.status(500).send(`Erreur OAuth : ${e.message}`);
  }
});

app.post("/api/upload", async (req, res) => {
  const c = activeCatalog();
  const ids = new Set(req.body.ids ?? []);
  if (!pubsOn() && c.videos.some((v) => ids.has(v.id) && !videoOn(v))) return res.status(400).json({ error: "Pubs en pause : réactive les pubs pour les envoyer sur YouTube." });
  const list = c.videos
    .filter((v) => ids.has(v.id) && isRendered(v.id) && !getState().videos[v.id]?.youtubeId)
    .sort((a, b) => (getState().videos[a.id]?.publishAt ?? "").localeCompare(getState().videos[b.id]?.publishAt ?? ""));
  res.json({ queued: list.length });
  void uploadMany(list, c);
});

// Créneau raté : la vidéo part tout de suite en public au lieu d'attendre un nouveau créneau.
app.post("/api/videos/:id/publish-now", async (req, res) => {
  const c = activeCatalog();
  const v = c.videos.find((x) => x.id === req.params.id);
  if (!v || !videoOn(v)) return res.status(400).json({ error: "Vidéo introuvable ou en pause." });
  if (!isRendered(v.id)) return res.status(400).json({ error: "Vidéo pas encore rendue." });
  if (uploadState.id) return res.status(409).json({ error: "Un envoi est déjà en cours, réessaie dans un instant." });
  try {
    res.json({ youtubeId: await uploadOne(v, c.apps.find((a) => a.slug === v.slug), { now: true }) });
  } catch (e) {
    const msg = e?.errors?.[0]?.reason ?? e.message;
    logEvent("error", `Échec de l'envoi de ${v.id} : ${msg}`, v.id);
    res.status(500).json({ error: String(msg) });
  } finally {
    uploadState.id = null;
    uploadState.progress = 0;
  }
});

// ---------------------------------------------------------------- TikTok (brouillons programmés)
const upload = multer({ dest: join(tmpdir(), "studio-tiktok-uploads"), limits: { fileSize: 40 * 1024 * 1024 } });
app.use("/tiktok-media", express.static(tt.MEDIA));

app.get("/api/tiktok", (_req, res) => {
  const c = catalog();
  res.json({
    status: tt.status(),
    settings: tt.ttSettings(),
    watch: { ...watch.watchState, dir: watch.watchDir() },
    posts: tt.posts(),
    instagram: { status: ig.status(), settings: ig.igSettings(), items: ig.items(), pending: ig.pending().map((p) => p.id) },
    videos: c.videos
      .filter((v) => v.format !== "long" && langOn(v.lang) && isRendered(v.id))
      .map((v) => ({ id: v.id, title: v.title, appName: v.appName, lang: v.lang })),
  });
});
app.get("/api/tiktok/auth", (req, res) => {
  try {
    res.redirect(tt.authUrl(String(req.query.lang ?? "en")));
  } catch (e) {
    res.status(400).send(`<p style="font-family:system-ui">${e.message}. Suis le guide docs/TIKTOK_SETUP.md.</p>`);
  }
});
app.get("/tiktok/callback/", async (req, res) => {
  try {
    await tt.handleCallback(req.query);
    res.redirect(loadProfile().setupDone ? "/?tiktok=1#tiktok" : "/setup.html#4");
  } catch (e) {
    res.status(500).send(`Erreur TikTok : ${e.message}`);
  }
});
app.post("/api/tiktok/import-md", (req, res) => {
  const items = tt.parseMarkdown(String(req.body.content ?? ""), req.body.name ?? "import.md");
  const created = items.map((it) => tt.createPost({ type: "photo", ...it }));
  logEvent("info", `TikTok : ${created.length} post(s) importé(s) depuis ${req.body.name ?? "un .md"}`);
  res.json({ created: created.length });
});
// Import intelligent : dossier / .md / images en vrac → carrousels associés à leurs légendes
const bigUpload = multer({ dest: join(tmpdir(), "studio-tiktok-uploads"), limits: { fileSize: 60 * 1024 * 1024, files: 600 } });
let lastImport = null;
app.post("/api/tiktok/smart-import", bigUpload.array("files", 600), async (req, res) => {
  const rels = JSON.parse(req.body.paths ?? "[]");
  const files = (req.files ?? []).map((f, i) => ({ path: f.path, rel: rels[i] ?? f.originalname }));
  try {
    logEvent("info", `TikTok : import intelligent de ${files.length} fichier(s)…`);
    lastImport = { at: new Date().toISOString(), ...(await smartImport(files)) };
    logEvent("info", `TikTok : ${lastImport.report.length} carrousel(s) créé(s) depuis l'import intelligent`);
    res.json(lastImport);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    for (const f of req.files ?? []) try { unlinkSync(f.path); } catch {}
  }
});
app.get("/api/tiktok/last-import", (_req, res) => res.json(lastImport));
// Programme tous les brouillons sur les prochains créneaux libres (créneaux FR / EN des réglages TikTok)
app.post("/api/tiktok/auto-schedule", (_req, res) => res.json({ scheduled: tt.scheduleDrafts() }));
app.patch("/api/tiktok/settings", (req, res) => res.json(tt.updateTtSettings(req.body)));
// Dossier surveillé (~/Desktop/Tiktok) : analyse + programmation + rangement dans « Programmés »
app.post("/api/tiktok/watch/scan", (_req, res) => {
  void watch.scan().catch((e) => console.error("dossier TikTok", e));
  res.json({ ok: true });
});
setInterval(() => {
  if (tt.ttSettings().watch) void watch.scan().catch((e) => console.error("dossier TikTok", e));
}, 2 * 60 * 1000);
app.post("/api/tiktok/posts", (req, res) => res.json(tt.createPost(req.body)));
app.patch("/api/tiktok/posts/:id", (req, res) => {
  try {
    res.json(tt.updatePost(req.params.id, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.delete("/api/tiktok/posts/:id", (req, res) => {
  tt.deletePost(req.params.id);
  res.json({ ok: true });
});
app.post("/api/tiktok/posts/:id/images", upload.array("images", 35), async (req, res) => {
  try {
    const p = tt.posts().find((x) => x.id === req.params.id);
    const names = [];
    for (const [i, f] of (req.files ?? []).entries()) {
      names.push(await tt.prepareImage(p.id, f.path, p.images.length + i));
      unlinkSync(f.path);
    }
    res.json(tt.addImages(p.id, names));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.post("/api/tiktok/posts/:id/send", async (req, res) => {
  const p = tt.posts().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).end();
  if (!langOn(tt.postLang(p))) return res.status(400).json({ error: `Aucun compte ${tt.postLang(p).toUpperCase()} connecté : connecte-en un dans Réglages pour envoyer ce post.` });
  if (!tt.postOn(p)) return res.status(400).json({ error: "Pubs en pause : réactive les pubs pour envoyer ce post." });
  res.json({ ok: true });
  await tt.sendPost(p).catch((e) => console.error("tiktok", e.message));
});
// Transforme une vidéo du catalogue en brouillon TikTok (légende = titre + description YouTube)
app.post("/api/tiktok/from-video", (req, res) => {
  const c = catalog();
  const v = c.videos.find((x) => x.id === req.body.videoId);
  if (!v) return res.status(404).json({ error: "Vidéo inconnue" });
  if (!langOn(v.lang)) return res.status(400).json({ error: `Aucun compte ${v.lang.toUpperCase()} connecté : connecte-en un dans Réglages pour l'ajouter.` });
  const m = buildMetadata(v, c.apps.find((a) => a.slug === v.slug));
  res.json(
    tt.createPost({
      type: "video",
      ...tiktokCaption(m),
      videoId: v.id,
      videoFile: join(OUT, `${v.id}.mp4`),
      publishAt: req.body.publishAt ?? null,
    }),
  );
});
setInterval(() => void tt.tick().catch((e) => console.error("tiktok", e)), 60 * 1000);

// ---------------------------------------------------------------- Comptes par langue (YouTube, TikTok, Instagram)
const NETS = { youtube: { forget: forgetYt }, tiktok: tt, instagram: ig };
app.post("/api/accounts/:net/:lang/forget", (req, res) => {
  const net = NETS[req.params.net];
  if (!net || !["fr", "en"].includes(req.params.lang)) return res.status(404).end();
  net.forget(req.params.lang);
  dropPausedFromQueue(); // dernier compte de cette langue retiré : ses rendus en attente sont annulés
  logEvent("info", `${req.params.net} : compte ${req.params.lang.toUpperCase()} retiré`);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- Instagram (Reels publiés à l'heure du post TikTok)
app.patch("/api/instagram/settings", (req, res) => res.json(ig.updateIgSettings(req.body)));
app.post("/api/instagram/refresh", async (_req, res) => {
  await ig.refreshUser();
  const linked = ig.status().connected ? await ig.syncExisting().catch(() => 0) : 0;
  res.json({ linked, status: ig.status() });
});
app.post("/api/instagram/posts/:id/publish", async (req, res) => {
  const p = tt.posts().find((x) => x.id === req.params.id);
  if (!p || p.type !== "video") return res.status(404).json({ error: "Post vidéo introuvable" });
  if (!tt.postOn(p)) return res.status(400).json({ error: "Langue ou pubs en pause : réactive-les pour publier ce post." });
  if (ig.igState.publishing) return res.status(409).json({ error: "Une publication Instagram est déjà en cours, réessaie dans un instant." });
  res.json({ ok: true });
  await ig.publish(p).catch((e) => console.error("instagram", e.message));
});
app.post("/api/instagram/posts/:id/skip", (req, res) => {
  ig.skip(req.params.id);
  res.json({ ok: true });
});
setInterval(() => void ig.tick().catch((e) => console.error("instagram", e)), 60 * 1000);

// ---------------------------------------------------------------- Discord (miniature + légende des stories à leur sortie)
app.post("/api/discord/send/:id", async (req, res) => {
  const c = catalog();
  const v = c.videos.find((x) => x.id === req.params.id && x.kind === "tale");
  if (!v) return res.status(404).json({ error: "Story inconnue" });
  try {
    await discord.send(v, c.apps.find((a) => a.slug === v.slug));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
setInterval(() => void discord.tick(activeCatalog()).catch((e) => console.error("discord", e)), 60 * 1000);

// ---------------------------------------------------------------- Remotion Studio
let studio = null;
app.post("/api/studio", (_req, res) => {
  if (!studio) {
    studio = spawnNpx(["remotion", "studio", "src/index.ts", "--port", "3123", "--no-open"], { cwd: ROOT, stdio: "ignore" });
    studio.on("exit", () => (studio = null));
  }
  res.json({ url: "http://localhost:3123" });
});

// ---------------------------------------------------------------- Autopilote
// Toutes les 10 min : rend puis envoie (programmées) les vidéos dont la publication tombe dans l'horizon.
const AUTOPILOT_EVERY = 10 * 60 * 1000;
const autopilotInfo = { lastRun: null, nextRun: Date.now() + 5000, lastSummary: "" };
async function autopilot() {
  const s = getState();
  autopilotInfo.lastRun = Date.now();
  autopilotInfo.nextRun = Date.now() + AUTOPILOT_EVERY;
  if (!s.settings.autopilot) {
    autopilotInfo.lastSummary = "Autopilote désactivé";
    return;
  }
  const c = activeCatalog();
  // Créneau raté (quota, Mac éteint…) : on replanifie plutôt que de laisser la vidéo bloquée.
  // Pubs en pause : leurs créneaux passés ne comptent pas (replanifiés à la réactivation), et rien ne part.
  const missed = c.videos.filter((v) => {
    const st = s.videos[v.id];
    if (!videoOn(v) || awaitingOk(v)) return false; // en retouche ou à valider : son créneau attend ton feu vert
    return st?.publishAt && !st.youtubeId && new Date(st.publishAt).getTime() < Date.now() + 30 * 60000;
  });
  if (missed.length) {
    // Une date fixée à la main mais ratée ne doit pas rester bloquée : elle repart dans le planning.
    for (const v of missed) s.videos[v.id].locked = false;
    logEvent("schedule", "Créneau raté détecté : planning recalculé automatiquement");
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (s.settings.startDate < tomorrow) updateSettings({ startDate: tomorrow });
    generateSchedule(c);
  }
  const horizon = Date.now() + s.settings.uploadHorizonDays * 86400000;
  const due = c.videos
    .filter((v) => {
      const st = s.videos[v.id];
      return videoOn(v) && !awaitingOk(v) && st?.publishAt && !st.youtubeId && new Date(st.publishAt).getTime() < horizon && new Date(st.publishAt).getTime() > Date.now() + 20 * 60000;
    })
    .sort((a, b) => s.videos[a.id].publishAt.localeCompare(s.videos[b.id].publishAt));
  const toRender = due.filter((v) => !isRendered(v.id)).map((v) => v.id);
  autopilotInfo.lastSummary = `${due.length} vidéo(s) à programmer dans l'horizon · ${toRender.length} à rendre · ${due.length - toRender.length} prête(s)`;
  if (toRender.length) enqueue(toRender, c);
  const ready = due.filter((v) => isRendered(v.id));
  if (ready.length && ytStatus().connected && !uploadState.id) await uploadMany(ready, c);
  // Reels pas encore publiés sur Instagram : comptés comme non envoyés pour garder leur vidéo sur le disque.
  cleanupPublished(c, s, [...tt.posts(), ...ig.pending().map((p) => ({ ...p, status: "instagram" }))]);
}
setInterval(() => void autopilot().catch((e) => console.error("autopilote", e)), AUTOPILOT_EVERY);

// Arrêt immédiat et propre (la file de rendu Remotion ne doit pas maintenir le process en vie).
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(sig, () => process.exit(0));

const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  logEvent("info", "Plateforme démarrée");
  console.log(`\n🎬 Studio YouTube prêt : ${url}\n`);
  if (!process.env.NO_OPEN) openPath(loadProfile().setupDone ? url : `${url}/setup.html`);
  void refreshChannel();
  if (tt.status().connected) void tt.refreshUser();
  if (ig.status().configured) void ig.refreshUser();
  setTimeout(() => void autopilot().catch(() => {}), 5000);
});
// Une seule instance : si le port est déjà pris, une autre plateforme tourne → on quitte.
server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${PORT} déjà utilisé : la plateforme tourne déjà.` : e);
  process.exit(1);
});
