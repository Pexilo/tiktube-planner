// Guide d'installation (server/ui/setup.html) : vérifications, profil, clés YouTube / TikTok / Instagram, hébergement des photos.
// Tout est enregistré en local : data/ (clés, jetons) et content/profile.json — jamais envoyé ailleurs.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import multer from "multer";
import { loadApps, ROOT } from "../shared/catalog.mjs";
import { has, hasOcr, hasVenv, hasVoices, IS_WIN, openPath } from "../shared/platform.mjs";
import * as el from "../shared/elevenlabs.mjs";
import { loadProfile, saveProfile } from "../shared/profile.mjs";
import { DATA } from "./state.mjs";
import * as yt from "./youtube.mjs";
import * as tt from "./tiktok.mjs";
import * as ig from "./instagram.mjs";
import { watchDir } from "./watchfolder.mjs";

const TT_CONFIG = join(DATA, "tiktok-config.json");
const readTT = () => (existsSync(TT_CONFIG) ? JSON.parse(readFileSync(TT_CONFIG, "utf8")) : {});
const writeTT = (c) => writeFileSync(TT_CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 });

/* ------------------------------------------------------------------ hébergement (FTP / SFTP) */

async function withHosting(h, fn) {
  if (h.protocol === "sftp") {
    const { default: SftpClient } = await import("ssh2-sftp-client");
    const s = new SftpClient();
    await s.connect({ host: h.host, port: h.port ?? 22, username: h.user, password: h.password, readyTimeout: 15000 });
    try {
      return await fn({ put: (local, remote) => s.put(local, remote), mkdir: (d) => s.mkdir(d, true), rm: (f) => s.delete(f) });
    } finally {
      await s.end();
    }
  }
  const { Client } = await import("basic-ftp");
  const c = new Client(15000);
  await c.access({ host: h.host, port: h.port ?? 21, user: h.user, password: h.password, secure: h.protocol === "ftps" });
  try {
    return await fn({ put: (local, remote) => c.uploadFrom(local, remote), mkdir: (d) => c.ensureDir(d).then(() => c.cd("/")), rm: (f) => c.remove(f) });
  } finally {
    c.close();
  }
}
const remotePath = (h, rel) => `${(h.remoteDir ?? "/").replace(/\/$/, "")}/${rel}`.replace(/\/{2,}/g, "/");
const publicUrl = (h, rel) => `${h.publicBaseUrl.replace(/\/$/, "")}/${rel}`;

/** Dépose un fichier à `rel` sous le dossier d'hébergement et vérifie qu'il est accessible en ligne. */
async function putAndCheck(local, rel, expect) {
  const h = readTT().hosting;
  if (!h?.host || !h?.publicBaseUrl) throw new Error("Hébergement non configuré");
  await withHosting(h, async (x) => {
    const dir = rel.includes("/") ? remotePath(h, rel.slice(0, rel.lastIndexOf("/"))) : null;
    if (dir) await x.mkdir(dir);
    await x.put(local, remotePath(h, rel));
  });
  const url = publicUrl(h, rel);
  const r = await fetch(url, { cache: "no-store" }).catch((e) => ({ ok: false, status: e.message }));
  const body = r.ok ? await r.text() : "";
  return { url, ok: r.ok && (!expect || body.includes(expect)), status: r.status };
}

/* ------------------------------------------------------------------ état */

export function setupStatus() {
  const apps = readdirSync(join(ROOT, "content/apps")).filter((f) => f.endsWith(".json"));
  const c = readTT();
  return {
    checks: {
      node: process.versions.node,
      ffmpeg: has("ffmpeg"),
      python: hasVenv(),
      ocr: hasOcr(),
      claude: has("claude"),
      say: hasVoices(),
    },
    platform: IS_WIN ? "windows" : "mac",
    profile: loadProfile(),
    apps: apps.map((f) => f.replace(/\.json$/, "")),
    youtube: yt.status(),
    tiktok: { ...tt.status(), hasKeys: !!(c.clientKey && c.clientSecret), clientKeyHint: c.clientKey ? `${c.clientKey.slice(0, 4)}…` : null },
    instagram: { ...ig.status(), enabled: ig.igSettings().enabled },
    hosting: c.hosting ? { ...c.hosting, password: c.hosting.password ? "••••••" : "" } : null,
    elevenlabs: el.status(),
    watch: { dir: watchDir(), exists: existsSync(watchDir()), enabled: tt.ttSettings().watch, slots: { fr: tt.ttSettings().frTimes, en: tt.ttSettings().enTimes } },
    redirect: { youtube: `http://localhost:${yt.PORT}/oauth/callback`, tiktok: `http://localhost:${yt.PORT}/tiktok/callback/` },
  };
}

/* ------------------------------------------------------------------ routes */

export function setupRoutes(app) {
  const up = multer({ dest: join(tmpdir(), "studio-setup"), limits: { fileSize: 2 * 1024 * 1024 } });

  app.get("/api/setup/status", (_req, res) => res.json(setupStatus()));

  app.post("/api/setup/profile", (req, res) => {
    const { ownerName, signature, lang, setupDone } = req.body ?? {};
    res.json(saveProfile(Object.fromEntries(Object.entries({ ownerName, signature, lang, setupDone }).filter(([, v]) => v !== undefined))));
  });

  // client_secret.json (Google Cloud → OAuth « Application de bureau »)
  app.post("/api/setup/youtube-secret", up.single("file"), (req, res) => {
    try {
      const raw = req.file ? readFileSync(req.file.path, "utf8") : JSON.stringify(req.body);
      const j = JSON.parse(raw);
      const c = j.installed ?? j.web;
      if (!c?.client_id || !c?.client_secret) throw new Error("Ce fichier n'est pas un identifiant OAuth Google (client_id / client_secret manquants).");
      if (j.web) throw new Error("Identifiant de type « Application Web » : crée plutôt un identifiant « Application de bureau » (Desktop app).");
      writeFileSync(join(DATA, "client_secret.json"), JSON.stringify(j, null, 2), { mode: 0o600 });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    } finally {
      if (req.file) unlinkSync(req.file.path);
    }
  });

  app.post("/api/setup/tiktok", (req, res) => {
    const { clientKey, clientSecret } = req.body ?? {};
    if (!clientKey?.trim() || !clientSecret?.trim()) return res.status(400).json({ error: "Client key et client secret requis." });
    writeTT({ ...readTT(), clientKey: clientKey.trim(), clientSecret: clientSecret.trim() });
    res.json({ ok: true });
  });

  // Token Instagram (Meta → Configuration de l'API avec la connexion Instagram → Générez des tokens d'accès)
  app.post("/api/setup/instagram", async (req, res) => {
    try {
      const user = await ig.saveToken(req.body?.accessToken, req.body?.appId);
      if (!user) throw new Error(ig.status().lastError ?? "Instagram ne répond pas, réessaie.");
      res.json({ ok: true, username: user.username });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Hébergement des photos de carrousels : enregistre puis teste (dépôt d'un fichier + lecture via l'URL publique)
  app.post("/api/setup/hosting", async (req, res) => {
    const b = req.body ?? {};
    const prev = readTT().hosting ?? {};
    const h = {
      protocol: ["ftp", "ftps", "sftp"].includes(b.protocol) ? b.protocol : "ftp",
      host: String(b.host ?? "").replace(/^\w+:\/\//, "").trim(),
      port: Number(b.port) || (b.protocol === "sftp" ? 22 : 21),
      user: String(b.user ?? "").trim(),
      password: b.password && b.password !== "••••••" ? b.password : prev.password ?? "",
      remoteDir: String(b.remoteDir ?? "/").trim() || "/",
      publicBaseUrl: String(b.publicBaseUrl ?? "").trim().replace(/\/$/, ""),
    };
    if (!h.host || !h.user || !/^https:\/\//.test(h.publicBaseUrl)) return res.status(400).json({ error: "Serveur, utilisateur et URL publique (https://…) requis." });
    writeTT({ ...readTT(), hosting: h });
    const token = randomBytes(6).toString("hex");
    const local = join(tmpdir(), `studio-ping-${token}.txt`);
    writeFileSync(local, `studio-ok-${token}`);
    try {
      const r = await putAndCheck(local, `studio-ping-${token}.txt`, `studio-ok-${token}`);
      await withHosting(h, (x) => x.rm(remotePath(h, `studio-ping-${token}.txt`))).catch(() => {});
      res.json(r.ok ? { ok: true, url: h.publicBaseUrl } : { ok: false, error: `Le fichier a été envoyé mais ${r.url} ne le renvoie pas (HTTP ${r.status}). Vérifie que « dossier distant » correspond bien à « URL publique ».` });
    } catch (e) {
      res.json({ ok: false, error: `Connexion impossible : ${e.message}` });
    } finally {
      unlinkSync(local);
    }
  });

  // Fichier de vérification « URL prefix » donné par TikTok → déposé à la racine de l'hébergement
  app.post("/api/setup/hosting-file", up.single("file"), async (req, res) => {
    try {
      if (!req.file) throw new Error("Aucun fichier");
      const name = basename(req.file.originalname).replace(/[^\w.\-]/g, "");
      if (!/\.txt$/i.test(name)) throw new Error("Le fichier de vérification TikTok est un .txt");
      res.json(await putAndCheck(req.file.path, name));
    } catch (e) {
      res.status(400).json({ error: e.message });
    } finally {
      if (req.file) unlinkSync(req.file.path);
    }
  });

  // Page de confidentialité (exigée par TikTok) générée et publiée sur ton hébergement
  app.post("/api/setup/privacy", async (req, res) => {
    try {
      const h = readTT().hosting;
      if (!h?.publicBaseUrl) throw new Error("Configure d'abord l'hébergement");
      const p = loadProfile();
      const owner = (req.body?.owner || p.ownerName || "the owner").trim();
      const html = readFileSync(join(ROOT, "server/templates/privacy.html"), "utf8")
        .replaceAll("{{OWNER}}", owner.replace(/[<>&"]/g, ""))
        .replaceAll("{{PREFIX}}", h.publicBaseUrl.replace(/^https:\/\//, "") + "/")
        .replaceAll("{{SITE}}", new URL(h.publicBaseUrl).origin)
        .replaceAll("{{DATE}}", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
      const local = join(tmpdir(), `privacy-${randomBytes(4).toString("hex")}.html`);
      writeFileSync(local, html);
      const r = await putAndCheck(local, "privacy/index.html", "Privacy Policy");
      unlinkSync(local);
      res.json({ ...r, url: publicUrl(h, "privacy/") });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Dossier surveillé TikTok : création (+ « Programmés » et un mode d'emploi) et ouverture dans le Finder
  app.post("/api/setup/watch-folder", (req, res) => {
    try {
      if (req.body?.dir) tt.updateTtSettings({ watchDir: String(req.body.dir).trim() });
      const dir = watchDir();
      mkdirSync(join(dir, "Programmés"), { recursive: true });
      const readme = join(dir, "_LISEZ-MOI.md");
      if (!existsSync(readme)) writeFileSync(readme, readFileSync(join(ROOT, "server/templates/watch-readme.md"), "utf8"));
      tt.updateTtSettings({ watch: true });
      res.json({ ok: true, dir });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/setup/open-folder", (_req, res) => {
    if (existsSync(watchDir())) openPath(watchDir());
    res.json({ ok: existsSync(watchDir()) });
  });

  app.get("/api/setup/tiktok-icon", (_req, res) => res.download(join(ROOT, "docs/tiktok-app-icon.png"), "app-icon-1024.png"));

  /* ---------------------------------------------------------------- ElevenLabs (voix off) */

  // Clé vérifiée auprès d'ElevenLabs avant d'être enregistrée dans data/elevenlabs.json.
  app.post("/api/setup/elevenlabs/key", async (req, res) => {
    const apiKey = String(req.body?.apiKey ?? "").trim();
    if (!apiKey) return res.json({ error: "Colle ta clé d'API ElevenLabs" });
    try {
      const subscription = await el.checkKey(apiKey);
      el.writeConfig({ apiKey });
      res.json({ ok: true, subscription });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  app.get("/api/setup/elevenlabs/catalog", async (_req, res) => {
    try {
      const [voices, models, subscription] = await Promise.all([el.listVoices(), el.listModels(), el.checkKey(el.readConfig().apiKey)]);
      res.json({ voices, models, subscription });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  app.post("/api/setup/elevenlabs", (req, res) => {
    const { model, preset, voices } = req.body ?? {};
    const clean = (v) => (v?.id ? { id: String(v.id), name: String(v.name ?? v.id) } : null);
    el.writeConfig({ model, preset: el.PRESETS[preset] ? preset : "punchy", voices: { fr: clean(voices?.fr), en: clean(voices?.en) } });
    res.json(el.status());
  });

  // Voix de la Voice Library collée par lien ou ID : ajoutée à « My Voices » pour pouvoir la choisir.
  app.post("/api/setup/elevenlabs/add-voice", async (req, res) => {
    try {
      res.json({ ok: true, voice: await el.addLibraryVoice(req.body?.input) });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  // Écoute d'essai avec les réglages affichés (pas forcément enregistrés) : consomme quelques crédits.
  app.post("/api/setup/elevenlabs/test", async (req, res) => {
    const { lang = "fr", voiceId, voiceName, model, preset } = req.body ?? {};
    if (!voiceId) return res.json({ error: "Choisis une voix" });
    const sample = loadApps().flatMap((a) => a.stories ?? []).map((s) => s.narration?.[lang]?.[0]).find(Boolean)
      ?? (lang === "fr" ? "Ton exchange dit que t'es en gain. Mais t'es vraiment en gain ?" : "Your exchange says you're up. But are you actually up?");
    try {
      const voice = { id: voiceId, name: voiceName, model: model || el.DEFAULT_MODEL, settings: el.PRESETS[preset] ?? el.PRESETS.punchy };
      const { audio, words } = await el.synthesize(voice, lang, sample);
      res.json({ ok: true, text: sample, timestamps: !!words, audio: `data:audio/mpeg;base64,${audio.toString("base64")}` });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  app.post("/api/setup/elevenlabs/forget", (_req, res) => {
    el.writeConfig({ apiKey: null });
    res.json(el.status());
  });
}
