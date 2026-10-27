// Vérifie les visuels d'une story crypto avant de la promouvoir : typecheck isolé, règles du kit,
// puis une image fixe par beat (rendue avec le JSON de la story) et une planche contact.
// Usage : node scripts/tale-check.mjs <slug> [--draft | --stories] [--frames=12,140,…]
// Sortie : la dernière ligne de stdout est un JSON { ok, errors, stills, sheet, frames }. Code de sortie 0 si ok.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { ROOT } from "../shared/catalog.mjs";
import { taleTimeline } from "../shared/tales.mjs";

const run = promisify(execFile);
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const errors = [];
const done = (extra = {}) => {
  const out = { ok: errors.length === 0, errors, ...extra };
  console.log(JSON.stringify(out));
  process.exit(out.ok ? 0 : 1);
};
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  errors.push("Usage : node scripts/tale-check.mjs <slug> [--draft | --stories]");
  done();
}

const jsonFile = join(ROOT, "content", "tales", `${slug}.json`);
const draft = join(ROOT, "src", "tales", "drafts", `${slug}.tsx`);
const promoted = join(ROOT, "src", "tales", "stories", `${slug}.tsx`);
const storyFile = args.includes("--stories") ? promoted : args.includes("--draft") ? draft : existsSync(draft) ? draft : promoted;
if (!existsSync(jsonFile)) errors.push(`JSON introuvable : content/tales/${slug}.json`);
if (!existsSync(storyFile)) errors.push(`Visuels introuvables : ${storyFile.slice(ROOT.length + 1).replaceAll("\\", "/")}`);
if (errors.length) done();

const tale = JSON.parse(readFileSync(jsonFile, "utf8"));
const src = readFileSync(storyFile, "utf8");
const outDir = join(ROOT, "out", "tales-preview", slug);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1. Règles du kit (cf. src/tales/KIT.md)
if (!/export\s+const\s+Story\b/.test(src)) errors.push("Le fichier doit exporter `export const Story: React.FC<StoryProps>`.");
for (const [re, why] of [
  [/<Audio\b|<Video\b|<OffthreadVideo\b/, "Pas d'<Audio>/<Video> : la voix, la musique et les sons sont gérés par l'habillage et le kit."],
  [/staticFile\s*\(|<Img\b|<img\b|https?:\/\//, "Pas d'images ni de fichiers externes : tout est dessiné avec le kit (SVG, CSS)."],
  [/\brequire\s*\(|\bfetch\s*\(|Math\.random\s*\(|Date\.now\s*\(/, "Interdit : require, fetch, Math.random, Date.now (le rendu doit être déterministe)."],
  [/blur\(|rotate\(|filter\s*:/, "Pixel art : pas de flou, pas de rotation, pas de filtre CSS (cf. src/tales/pixel/PIXEL.md)."],
])
  if (re.test(src)) errors.push(why);
const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
const ALLOWED = ["react", "remotion", "../kit", "../types"];
for (const i of imports) if (!ALLOWED.includes(i)) errors.push(`Import non autorisé : "${i}" (autorisés : ${ALLOWED.join(", ")}).`);
const ids = new Set(tale.beats.map((b) => b.id));
for (const m of src.matchAll(/<Beat\s+id=["']([^"']+)["']/g)) if (!ids.has(m[1])) errors.push(`<Beat id="${m[1]}"> : beat inconnu (ids : ${[...ids].join(", ")}).`);
const lastId = tale.beats.at(-1)?.id;
if (lastId && !new RegExp(`<Beat\\s+id=["']${lastId}["'][^>]*\\bloop\\b`).test(src)) errors.push(`Le dernier beat doit boucler sur le premier : <Beat id="${lastId}" loop> (cf. KIT.md).`);

// 2. Typecheck isolé (le brouillon et ce qu'il importe)
const tsconfig = join(outDir, "tsconfig.json");
writeFileSync(tsconfig, JSON.stringify({ extends: join(ROOT, "tsconfig.json").replaceAll("\\", "/"), compilerOptions: { noEmit: true }, include: [], files: [storyFile.replaceAll("\\", "/"), join(ROOT, "src/tales/types.ts").replaceAll("\\", "/")] }));
try {
  await run(process.execPath, [join(ROOT, "node_modules/typescript/bin/tsc"), "-p", tsconfig], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
} catch (e) {
  const lines = String(e.stdout ?? e.message).split(/\r?\n/).filter((l) => /error TS/.test(l));
  errors.push(...(lines.length ? lines.slice(0, 25).map((l) => l.replace(ROOT, "").replaceAll("\\", "/")) : [String(e.message).slice(0, 400)]));
}
rmSync(tsconfig, { force: true });
if (errors.length) done();

// 3. Une image par beat (aux 2/3 du beat : la plupart des éléments sont arrivés), avec le vrai JSON
const timeline = tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments);
const extra = (args.find((a) => a.startsWith("--frames="))?.slice(9) ?? "").split(",").filter(Boolean).map(Number);
// + la jointure de la boucle : dernière frame et frame 0 doivent être identiques (loop-end.png / loop-start.png).
const frames = [...timeline.beats.map((b) => b.from + Math.round(b.dur * 0.66)), timeline.totalFrames - 1, 0, ...extra].filter((f) => f >= 0 && f < timeline.totalFrames);
// Les images fixes n'ont pas besoin de la voix : un public minimal (liens vers apps/, fx/ et les bruitages, qu'une nappe
// bouclée doit charger même pour une image fixe) évite de copier tout public/ (plusieurs centaines de Mo) dans chaque bundle.
const publicDir = join(ROOT, "out", "tales-preview", "_public");
mkdirSync(join(publicDir, "audio"), { recursive: true });
mkdirSync(join(ROOT, "public", "audio", "tale-sfx"), { recursive: true });
for (const d of ["apps", "fx", "audio/tale-sfx"]) if (!existsSync(join(publicDir, d))) symlinkSync(join(ROOT, "public", d), join(publicDir, d), "junction");
let serveUrl;
try {
  serveUrl = await bundle({
    entryPoint: join(ROOT, "src/tales/preview/index.tsx"),
    publicDir,
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@tale-story$": storyFile, "@tale-json$": jsonFile } } }),
  });
} catch (e) {
  errors.push(`Bundle : ${String(e.message ?? e).slice(0, 800)}`);
  done();
}
// Un seul navigateur pour toutes les images (en lancer un par image est lent et peut expirer).
const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id: "tale-preview", puppeteerInstance: browser });
const stills = [];
for (const [i, frame] of frames.entries()) {
  const name = i < timeline.beats.length ? `beat-${String(i + 1).padStart(2, "0")}.png` : i === timeline.beats.length ? "loop-end.png" : i === timeline.beats.length + 1 ? "loop-start.png" : `frame-${frame}.png`;
  const output = join(outDir, name);
  try {
    await renderStill({ composition, serveUrl, output, frame, imageFormat: "png", scale: 0.5, puppeteerInstance: browser });
    stills.push(output.replaceAll("\\", "/"));
  } catch (e) {
    errors.push(`Rendu frame ${frame}${i < tale.beats.length ? ` (beat ${tale.beats[i].id})` : ""} : ${String(e.message ?? e).split("\n")[0].slice(0, 400)}`);
  }
}

await browser.close({ silent: true }).catch(() => {});
rmSync(serveUrl, { recursive: true, force: true }); // le bundle temporaire de cette vérification

// 4. Planche contact (4 colonnes)
let sheet = null;
const beatsPng = readdirSync(outDir).filter((f) => /^beat-\d+\.png$/.test(f));
if (beatsPng.length) {
  const cols = Math.min(4, beatsPng.length);
  const rows = Math.ceil(beatsPng.length / cols);
  sheet = join(outDir, "sheet.png");
  await run("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", join(outDir, "beat-%02d.png"), "-vf", `scale=270:-1,tile=${cols}x${rows}:padding=6:color=0x222222`, "-frames:v", "1", sheet]).catch((e) => {
    errors.push(`Planche contact : ${e.message.slice(0, 200)}`);
    sheet = null;
  });
}
done({ stills, sheet: sheet?.replaceAll("\\", "/") ?? null, frames });
