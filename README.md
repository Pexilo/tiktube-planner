# 🎬 TikTube Planner — motion-design videos + YouTube & TikTok autopilot for your apps

**TikTube Planner** ("Studio" in the app) is a local macOS platform that turns a JSON description of your app into polished motion-design videos (Shorts 9:16, 16:9, narrated Shorts, a calm "Keynote" series) with generated music, then **schedules them on YouTube** and **sends your TikTok carousels and videos** to your inbox at the right time.

Everything runs on your Mac. No SaaS, no subscription: your keys stay in `data/` (git-ignored).

> 🇫🇷 Version française plus bas.

---

## What it does

| | |
|---|---|
| 🎞️ **Videos as code** | [Remotion](https://remotion.dev) (React → MP4). One `content/apps/<app>.json` = Shorts, 16:9 videos and a Keynote series in FR + EN. |
| 🎵 **Generated music** | 13 styles (house, lo-fi, cinematic, piano…) synthesised in Python on a 120 BPM grid, so animations land on the beat. Mastered at −14 LUFS. |
| 🎙️ **Narrated Shorts** | macOS voices + burned-in subtitles + music ducking. |
| ▶️ **YouTube autopilot** | YouTube Data API v3: SEO titles/descriptions/tags FR + EN, scheduled private uploads (`publishAt`), 1–2 Shorts/day + 1 long video/week. YouTube publishes even if your Mac is off. |
| 🎵 **TikTok scheduler** | Content Posting API (inbox/draft mode). Drop a folder into `~/Desktop/Tiktok`: slides are OCR-read, matched with the right caption from your `.md` (copied verbatim, or written by Claude if missing), scheduled on FR/EN slots, then moved to `Programmés`. |
| 📊 **Dashboard** | Light/dark, pipeline (to render → ready → scheduled → published), YouTube + TikTok calendar, live render progress, menu bar icon. |

## Install (macOS)

```bash
git clone https://github.com/louisv2304/tiktube-planner.git
cd tiktube-planner
./install.sh
```

`install.sh` installs what's missing (Node 20+, ffmpeg, Python via Homebrew), the npm modules, a Python venv for music, compiles the macOS OCR helper, then **starts the server and opens the step-by-step setup guide** at http://localhost:4321/setup.html:

1. **Checks** — what's installed on your Mac.
2. **Profile** — your name + the signature added under every YouTube description.
3. **Your apps** — how to add your own app (an example app, MRRKit, is included).
4. **YouTube** — create a free Google OAuth "Desktop app" credential, drop the JSON, connect your channel.
5. **TikTok (Sandbox)** — create a TikTok developer app in Sandbox mode (works immediately for your own account), paste the keys, connect.
6. **TikTok photos** *(optional, for carousels)* — FTP/SFTP access to a website you own, domain verification file upload, auto-generated privacy policy page.
7. **TikTok folder** — creates `~/Desktop/Tiktok` and gives you a ready-to-copy prompt so Claude can generate carousels and drop them straight into it.

Next launches: `npm start` (or the menu bar app: `npm run menubar`).

### Optional

- [Claude Code](https://claude.com/claude-code) CLI — writes TikTok captions when your folder has none, and resolves ambiguous slide/caption matches.
- `npm run studio` — Remotion Studio to tweak animations live.

## Add your app

1. Copy `content/apps/mrrkit.json` → `content/apps/myapp.json`, edit `slug`, `name`, `brand` colors, `price`, `links`, FR/EN copy, `features`, `keynote`, `seo`.
2. Put `icon.png` (1024²) and your screenshots in `public/apps/myapp/` with the file names used in the JSON.
3. Dashboard → **Videos** → Render. Turn on the **autopilot** in Settings when you're happy.

## TikTok folder format

```
~/Desktop/Tiktok/
  MyApp-2026-10-12/
    CAPTIONS.md                 ← any readable format; one caption per carousel (FR/EN)
    fr/01-hook/01.png 02.png …  ← one folder of images = one carousel
    en/01-hook/01.png …
    teaser.mp4                  ← each video = one video post
```

Previews (`apercu*`, `previews/`, contact sheets) are ignored. TikTok limits pending inbox drafts (~5): the platform retries every 2 h instead of failing.

## Project layout

```
src/        Remotion compositions (scenes, keynote series, captions, devices)
shared/     timeline (120 BPM grid), catalog, profile
server/     Express API, render queue, YouTube, TikTok, watch folder, setup guide, dashboard UI
scripts/    music/SFX synthesis (Python), voices, menu bar installer
content/    your apps (JSON), profile, imported external videos
public/     app screenshots, generated audio
data/       ⚠️ local only (git-ignored): OAuth tokens, TikTok config, state
```

## Security

- Secrets live only in `data/` (`client_secret.json`, `youtube-token.json`, `tiktok-config.json`, `tiktok-token.json`) — all git-ignored.
- Nothing is sent anywhere except Google/TikTok APIs and your own FTP host.

## 💜 Support the developer

TikTube Planner is free. If it saves you time, the only thing I ask: **[download one of my apps](https://taap.be/louis.valli)** and leave a rating if you like it. 🙏

Not required, but always appreciated: follow me on [X (@fj_2304)](https://x.com/fj_2304), [TikTok (@smartcom.digital)](https://www.tiktok.com/@smartcom.digital) and [LinkedIn](https://www.linkedin.com/in/louis-valli/).

## License

MIT — built with [Claude Code](https://claude.com/claude-code).

---

## 🇫🇷 En français

**TikTube Planner** est une plateforme locale pour Mac qui transforme la description JSON de ton app en vidéos motion design (Shorts, 16:9, Shorts narrés, série « Keynote ») avec musique générée, puis **les programme sur YouTube** et **envoie tes carrousels et vidéos TikTok** en brouillon à l'heure prévue.

### Installation

```bash
git clone https://github.com/louisv2304/tiktube-planner.git
cd tiktube-planner
./install.sh
```

Le script installe ce qui manque, puis lance le serveur et ouvre le **guide pas à pas** (http://localhost:4321/setup.html) : profil, ajout de ton app, connexion YouTube (identifiant Google « Application de bureau »), TikTok en mode **Sandbox**, hébergement des photos pour les carrousels, et création du dossier TikTok (avec un prompt prêt à copier pour que Claude y dépose tes carrousels). Le guide existe en français et en anglais (bouton FR/EN).

Lancements suivants : `npm start`, ou l'icône de la barre des menus (`npm run menubar`).

### Ajouter ton app

Duplique `content/apps/mrrkit.json`, adapte les textes, couleurs, prix et liens, et place tes captures dans `public/apps/<ton-app>/`. Puis dashboard → **Vidéos** → Rendre.

### TikTok

Dépose un dossier dans `~/Desktop/Tiktok` (sous-dossiers `fr/` / `en/` d'images + un fichier de légendes) : la plateforme associe chaque carrousel à sa légende, programme tout (FR 12:30 · 19:00, EN 15:00 · 21:00 par défaut) et range le dossier dans `Programmés`.

### 💜 Soutenir le développeur

TikTube Planner est gratuit. S'il te fait gagner du temps, tout ce que je demande : **[télécharge une de mes apps](https://taap.be/louis.valli)** et laisse une note si elle te plaît 🙏 — et si tu veux, suis-moi sur [X](https://x.com/fj_2304), [TikTok](https://www.tiktok.com/@smartcom.digital) et [LinkedIn](https://www.linkedin.com/in/louis-valli/).

### Sécurité

Tes clés restent dans `data/` (ignoré par git) et ne quittent jamais ton Mac, sauf vers les API Google / TikTok et ton propre hébergement FTP.
