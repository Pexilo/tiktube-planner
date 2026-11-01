// Génère le logo WGG pixel (photo de profil YouTube / TikTok / Instagram) dans public/brand/ :
// une grille de 36 × 36 cellules aux couleurs de la palette WGG, exportée en SVG (net à toute taille) et en PNG carrés.
// Tout tient dans le cercle inscrit : le recadrage rond des réseaux ne coupe rien.
//
// Usage : node scripts/brand-logo.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUT = "public/brand";
const N = 36;
const C = { ink: "#0B0B0E", ink3: "#2B2A35", paper: "#EFEADF", light: "#FFFCF4", pink: "#FF2E88", lime: "#C6F24E", lime2: "#8DB22A", cyan: "#5CE1FF" };

const W = ["##....##", "##....##", "##....##", "##....##", "##.##.##", "##.##.##", "##.##.##", "########", "###..###", "##....##"];
const G = [".######.", "########", "##....##", "##......", "##......", "##..####", "##..####", "##....##", "########", ".######."];

/** La grille : fond encre tramé, WGG papier en relief rose (2 cellules), liseré clair en haut à gauche, barre lime / cyan / rose. */
function grid() {
  const g = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x % 3 === 0 && y % 3 === 0 ? C.ink3 : C.ink)));
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
  const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); };
  const cells = [];
  [W, G, G].forEach((glyph, i) => glyph.forEach((line, r) => [...line].forEach((ch, c) => ch === "#" && cells.push([3 + i * 10 + c, 11 + r]))));
  const on = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const d of [2, 1]) for (const [x, y] of cells) put(x + d, y + d, C.pink);
  for (const [x, y] of cells) put(x, y, on.has(`${x - 1},${y}`) && on.has(`${x},${y - 1}`) ? C.paper : C.light);
  rect(4, 25, 11, 2, C.lime);
  rect(5, 27, 11, 1, C.lime2);
  rect(17, 25, 4, 2, C.cyan);
  rect(23, 25, 2, 2, C.pink);
  return g;
}

/** SVG : une bande par suite de cellules de même couleur sur une ligne, sans anticrénelage. */
function svg(g) {
  const runs = [];
  g.forEach((row, y) => { for (let x = 0; x < N; ) { let e = x; while (e < N && row[e] === row[x]) e++; runs.push(`<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${row[x]}"/>`); x = e; } });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="1080" height="1080" shape-rendering="crispEdges">\n${runs.join("\n")}\n</svg>\n`;
}

function png(g, size) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0, o = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++, o += 3) raw.set(rgb(g[Math.floor((y * N) / size)][Math.floor((x * N) / size)]), o);
  }
  const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
const g = grid();
writeFileSync(join(OUT, "wgg-logo.svg"), svg(g));
// Multiples de 36 : chaque cellule fait un nombre entier de pixels. 1080 pour les trois réseaux, 360 pour un usage léger.
for (const size of [1080, 360]) writeFileSync(join(OUT, `wgg-logo-${size}.png`), png(g, size));
console.log(`Logo WGG → ${OUT}/ (wgg-logo.svg, wgg-logo-1080.png, wgg-logo-360.png)`);
