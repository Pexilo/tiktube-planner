// Rend des images clés d'une composition pour contrôle visuel rapide.
// Usage : node scripts/preview-frames.mjs <compositionId> [frame1,frame2,...] [outDir]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { ROOT } from "../shared/catalog.mjs";
import { outDir as storageOut } from "../shared/storage.mjs";

const [id, framesArg, outDirArg] = process.argv.slice(2);
const outDir = outDirArg ?? join(storageOut(), "preview");
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(ROOT, "src/index.ts"), publicDir: join(ROOT, "public") });
for (const cid of id.split(",")) {
  const comp = await selectComposition({ serveUrl, id: cid });
  const frames = framesArg ? framesArg.split(",").map(Number) : [0];
  for (const f of frames) {
    const output = join(outDir, `${cid}-${String(f).padStart(4, "0")}.jpg`);
    await renderStill({ composition: comp, serveUrl, output, frame: Math.min(f, comp.durationInFrames - 1), imageFormat: "jpeg", jpegQuality: 80, scale: 0.5 });
    console.log(output);
  }
}
