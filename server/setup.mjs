// Guide d'installation (server/ui/setup.html) : vérifications, profil, clés YouTube / TikTok, hébergement des photos.
// Tout est enregistré en local : data/ (clés, jetons) et content/profile.json — jamais envoyé ailleurs.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import multer from "multer";
import { ROOT } from "../shared/catalog.mjs";
import { loadProfile, saveProfile } from "../shared/profile.mjs";
import { DATA } from "./state.mjs";
import * as yt from "./youtube.mjs";
import * as tt from "./tiktok.mjs";
import { watchDir } from "./watchfolder.mjs";
import { execFile } from "node:child_process";

const TT_CONFIG = join(DATA, "tiktok-config.json");
const has = (cmd) => {
  try {
    execFileSync("/bin/sh", ["-c", `command -v ${cmd}`], { stdio: "ignore", env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin` } });
    return true;
  } catch {
    return false;
  }
};
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
      python: existsSync(join(ROOT, ".venv/bin/python")),
      ocr: existsSync(join(ROOT, "tools/ocr")) || has("swiftc"),
      claude: has("claude"),
      say: has("say"),
    },
    profile: loadProfile(),
    apps: apps.map((f) => f.replace(/\.json$/, "")),
    youtube: yt.status(),
    tiktok: { ...tt.status(), hasKeys: !!(c.clientKey && c.clientSecret), clientKeyHint: c.clientKey ? `${c.clientKey.slice(0, 4)}…` : null },
    hosting: c.hosting ? { ...c.hosting, password: c.hosting.password ? "••••••" : "" } : null,
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
    if (existsSync(watchDir())) execFile("open", [watchDir()]);
    res.json({ ok: existsSync(watchDir()) });
  });

  app.get("/api/setup/tiktok-icon", (_req, res) => res.download(join(ROOT, "docs/tiktok-app-icon.png"), "app-icon-1024.png"));
}
