// Rend les plans de la preuve de concept HD (src/tales/hd/proto-index.tsx) en PNG dans out/hd/.
// Usage : node scripts/hd-stills.mjs [hd-b1,hd-b2,…] [frame]   (sans liste : toutes les compositions, frame 45)
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [ids, frameArg] = process.argv.slice(2);
const out = join(ROOT, "out", "hd");
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(ROOT, "src/tales/hd/proto-index.tsx"), publicDir: join(ROOT, "public") });
const wanted = ids ? ids.split(",") : null;
for (const composition of (await getCompositions(serveUrl)).filter((c) => !wanted || wanted.includes(c.id))) {
  const output = join(out, `${composition.id}.png`);
  await renderStill({ composition, serveUrl, output, frame: Number(frameArg ?? 45) });
  console.log(output);
}
