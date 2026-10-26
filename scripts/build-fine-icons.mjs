// Génère src/tales/pixel/fine-bitmaps.ts : une sélection d'icônes pixelarticons (MIT, © Gerrit Halfmann,
// https://github.com/halfmage/pixelarticons) rastérisées en bitmaps 24 × 24. La couleur et l'ombrage sont ajoutés au rendu
// (src/tales/pixel/fine.tsx), aux couleurs de la palette WGG.
//
// Usage : npm i --no-save pixelarticons@2.4.2 && node scripts/build-fine-icons.mjs [dossier svg]
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2] ?? "node_modules/pixelarticons/svg";
const OUT = "src/tales/pixel/fine-bitmaps.ts";

// [nom dans le kit, icône pixelarticons, couleur (jeton de fine.tsx)]
const PICKS = [
  // argent et crypto
  ["wallet", "wallet", "wood"],
  ["money", "money", "lime"],
  ["banknote", "banknote", "lime"],
  ["dollar", "dollar", "lime"],
  ["euro", "euro", "lime"],
  ["card", "credit-card", "cyan"],
  ["bank", "university", "paper"],
  ["store", "store", "pink"],
  ["receipt", "receipt", "paper"],
  ["invoice", "invoice", "paper"],
  ["gem", "diamond-gem", "cyan"],
  ["gift", "gift", "pink"],
  ["percent", "percent", "lime"],
  // sécurité, hack
  ["key", "key", "gold"],
  ["lock", "lock", "gold"],
  ["unlock", "unlock", "gold"],
  ["shield", "shield", "cyan"],
  ["eye", "eye", "paper"],
  ["search", "search", "paper"],
  ["bug", "bug", "lime"],
  ["skull", "skull", "paper"],
  ["bomb", "bomb", "grey"],
  ["fire", "fire", "orange"],
  ["zap", "zap", "gold"],
  ["warning", "warning-diamond", "orange"],
  ["siren", "siren", "pink"],
  ["target", "target", "pink"],
  ["link", "link", "grey"],
  // tech
  ["terminal", "terminal", "ink"],
  ["code", "code", "cyan"],
  ["database", "database", "cyan"],
  ["server", "server", "grey"],
  ["cpu", "cpu", "lime"],
  ["gpu", "gpu", "lime"],
  ["computer", "computer", "grey"],
  ["laptop", "laptop", "grey"],
  ["smartphone", "smartphone", "grey"],
  ["usb", "usb", "pink"],
  ["qr", "qr-code", "paper"],
  ["cloud", "cloud", "paper"],
  ["globe", "globe", "cyan"],
  ["blocks", "blocks", "lime"],
  ["robot", "robot", "grey"],
  ["power", "power", "pink"],
  // marché
  ["chartUp", "trending-up", "lime"],
  ["chartDown", "chart-column-decreasing", "pink"],
  ["chartLine", "chart-line", "cyan"],
  ["analytics", "analytics", "cyan"],
  ["trophy", "trophy", "gold"],
  ["crown", "crown", "gold"],
  ["star", "star", "gold"],
  ["sparkles", "sparkles", "gold"],
  ["heart", "heart", "pink"],
  ["thumbsUp", "thumbs-up", "lime"],
  ["thumbsDown", "thumbs-down", "pink"],
  // messages, temps, lieux
  ["mail", "mail", "paper"],
  ["message", "message", "paper"],
  ["megaphone", "megaphone", "pink"],
  ["bell", "bell", "gold"],
  ["clock", "clock", "paper"],
  ["hourglass", "hourglass", "sand"],
  ["calendar", "calendar", "paper"],
  ["flag", "flag", "pink"],
  ["pin", "map-pin", "pink"],
  ["file", "file-text", "paper"],
  ["script", "script", "paper"],
  ["briefcase", "briefcase", "wood"],
  ["package", "package", "sand"],
  ["trash", "trash", "grey"],
  ["home", "home", "paper"],
  ["building", "building", "paper"],
  ["factory", "factory", "grey"],
  ["truck", "truck", "lime"],
  ["car", "car", "cyan"],
  ["user", "user", "paper"],
  ["users", "users", "paper"],
  ["dog", "dog", "sand"],
  ["alien", "alien", "lime"],
  ["trex", "t-rex", "lime"],
  ["snowflake", "snowflake", "cyan"],
  ["moon", "moon", "gold"],
  ["sun", "sun", "gold"],
];

/** Contours d'un attribut d (M m H h V v L l Z z) : liste de polygones fermés. */
function polygons(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  const polys = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let cmd = "";
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case "M":
      case "m": {
        const nx = num();
        const ny = num();
        [x, y] = cmd === "m" ? [x + nx, y + ny] : [nx, ny];
        cur = [[x, y]];
        polys.push(cur);
        cmd = cmd === "m" ? "l" : "L";
        break;
      }
      case "L":
      case "l": {
        const nx = num();
        const ny = num();
        [x, y] = cmd === "l" ? [x + nx, y + ny] : [nx, ny];
        cur.push([x, y]);
        break;
      }
      case "H":
      case "h":
        x = cmd === "h" ? x + num() : num();
        cur.push([x, y]);
        break;
      case "V":
      case "v":
        y = cmd === "v" ? y + num() : num();
        cur.push([x, y]);
        break;
      case "Z":
      case "z":
        [x, y] = cur[0];
        break;
      default:
        throw new Error(`commande SVG non gérée : ${cmd}`);
    }
  }
  return polys;
}

/** Remplissage « nonzero » (règle SVG par défaut) testé au centre de chaque pixel. */
function raster(svg) {
  const polys = [...svg.matchAll(/ d="([^"]+)"/g)].flatMap((m) => polygons(m[1]));
  const rows = [];
  for (let j = 0; j < 24; j++) {
    let row = "";
    for (let i = 0; i < 24; i++) {
      const [px, py] = [i + 0.5, j + 0.5];
      let wind = 0;
      for (const p of polys)
        for (let k = 0; k < p.length; k++) {
          const [x0, y0] = p[k];
          const [x1, y1] = p[(k + 1) % p.length];
          if (y0 <= py && y1 > py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) > 0) wind++;
          else if (y0 > py && y1 <= py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) < 0) wind--;
        }
      row += wind ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

const out = [
  "// Généré par scripts/build-fine-icons.mjs : ne pas modifier à la main.",
  "// Icônes pixelarticons 2.4.2 (MIT, © 2019 Gerrit Halfmann, https://github.com/halfmage/pixelarticons), bitmaps 24 × 24.",
  "export const FINE_BITMAPS = {",
];
for (const [name, src, color] of PICKS) {
  const svg = fs.readFileSync(path.join(SRC, `${src}.svg`), "utf8");
  out.push(`  ${name}: { color: "${color}", rows: [${raster(svg).map((r) => `"${r}"`).join(", ")}] },`);
}
out.push("} as const;", "");
fs.writeFileSync(OUT, out.join("\n"));
console.log(`${PICKS.length} icônes → ${OUT}`);
