// Rend une story crypto en MP4 (et sa miniature) hors de la file du serveur : aucun état modifié, rien de publié.
// Usage : node scripts/render-tale.mjs <slug> [dossier de sortie]   →  <dossier>/<slug>.mp4 et <slug>-thumb.jpg (défaut : out/tales)
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [slug, outArg] = process.argv.slice(2);
if (!slug) throw new Error("Usage : node scripts/render-tale.mjs <slug> [dossier]");
const out = outArg ?? join(ROOT, "out", "tales");
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(ROOT, "src/index.ts"), publicDir: join(ROOT, "public") });
const id = `tale-${slug}-en`;
const thumb = await selectComposition({ serveUrl, id: `${id}-thumb` });
await renderStill({ composition: thumb, serveUrl, output: join(out, `${slug}-thumb.jpg`), imageFormat: "jpeg", jpegQuality: 92 });
console.log(join(out, `${slug}-thumb.jpg`));
const composition = await selectComposition({ serveUrl, id });
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  crf: 17,
  outputLocation: join(out, `${slug}.mp4`),
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 10);
    if (p !== last) console.log(`${(last = p) * 10}%`);
  },
});
console.log(join(out, `${slug}.mp4`));
