// Détoure une photo pour une story HD : écrit un PNG à vraie transparence (canal alpha) d'après des polygones ou des cercles
// tracés en px de la source. Une photo détourée ne se masque jamais en repeignant la couleur du mur (src/tales/hd/HD.md § 7).
// Usage :
//   node scripts/hd-cutout.mjs <source> <sortie.png> --poly "x,y x,y …" [--poly "…"] [--circle "cx,cy,r" …]
// Les formes s'additionnent ; tout le reste devient transparent. Ajoute ensuite l'entrée de sources.json (licence de la source).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const [src, out] = args;
if (!src || !out || !out.endsWith(".png")) {
  console.error('Usage : node scripts/hd-cutout.mjs <source> <sortie.png> --poly "x,y x,y …" [--circle "cx,cy,r"]');
  process.exit(1);
}
const all = (flag) => args.flatMap((a, i) => (args[i - 1] === flag ? [a] : []));
const polys = all("--poly").map((s) => s.trim().split(/\s+/).map((p) => p.split(",").map(Number)));
const circles = all("--circle").map((s) => s.split(",").map(Number));
if (!polys.length && !circles.length) {
  console.error("Aucune forme : --poly ou --circle");
  process.exit(1);
}
const [W, H] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", src], { encoding: "utf8" }).trim().split(",").map(Number);

const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [poly[i], poly[j]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
// Masque en niveaux de gris (PGM binaire) : 255 = garder.
const mask = Buffer.alloc(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const [cx, cy] = [x + 0.5, y + 0.5];
    if (polys.some((p) => inPoly(p, cx, cy)) || circles.some(([a, b, r]) => (cx - a) ** 2 + (cy - b) ** 2 <= r * r)) mask[y * W + x] = 255;
  }
const dir = mkdtempSync(join(tmpdir(), "cutout-"));
const pgm = join(dir, "mask.pgm");
writeFileSync(pgm, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), mask]));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-i", pgm, "-filter_complex", "[0]format=rgba[c];[1]format=gray[m];[c][m]alphamerge", out]);
rmSync(dir, { recursive: true, force: true });
console.log(`${out} (${W} × ${H}, ${polys.length} polygone(s), ${circles.length} cercle(s))`);
