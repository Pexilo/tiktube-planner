// Récupère une image libre de Wikimedia Commons pour une story HD : copie locale dans public/tales/hd/<slug>/ et sa licence
// dans public/tales/hd/<slug>/sources.json (titre, auteur, licence, lien). Refuse tout ce qui n'est pas libre
// (seuls domaine public, CC0, CC BY et CC BY-SA passent ; jamais NC ni ND). Un SVG arrive rendu en PNG transparent.
// Usage :
//   node scripts/hd-source.mjs <slug> --search "bitcoin logo"            candidats (licence, taille) ; rien n'est téléchargé
//   node scripts/hd-source.mjs <slug> "Bitcoin.svg" [--as btc.png] [--width 1200] [--dry]
// La dernière ligne de sortie est le chemin à donner à <Pix src="…"> (ou le JSON des infos avec --dry).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "tiktube-planner/1.0 (pixel art story sourcing; local tool)";
const FREE = /^(public domain|pd\b|cc0|cc[ -]by(-sa)?\b)/i;

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const [slug] = args;
if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail('Usage : node scripts/hd-source.mjs <slug> --search "…" | "<fichier Commons>" [--as nom.png] [--width 1200] [--dry]');

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) fail(`Commons : HTTP ${r.status}`);
  return r.json();
}
const strip = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
/** Infos utiles d'une page de fichier : URL (rendu à la largeur demandée), licence, auteur, et si elle est libre. */
function info(page) {
  const ii = page.imageinfo?.[0] ?? {};
  const m = ii.extmetadata ?? {};
  const license = strip(m.LicenseShortName?.value) || strip(m.License?.value);
  return {
    title: page.title,
    url: ii.thumburl ?? ii.url,
    page: ii.descriptionurl,
    mime: ii.mime,
    size: `${ii.width}×${ii.height}`,
    author: strip(m.Artist?.value),
    license,
    licenseUrl: m.LicenseUrl?.value ?? "",
    credit: strip(m.Credit?.value),
    free: FREE.test(license) && !/\b(nc|nd)\b/i.test(license),
  };
}
const IIPROP = { prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: opt("--width") ?? "1200" };

const search = opt("--search");
if (search) {
  const r = await api({ action: "query", generator: "search", gsrsearch: search, gsrnamespace: "6", gsrlimit: "12", ...IIPROP });
  const pages = r.query?.pages ?? [];
  if (!pages.length) fail(`Aucun fichier pour « ${search} ».`);
  for (const p of pages) {
    const i = info(p);
    console.log(`${i.free ? "libre    " : "NON LIBRE"}  ${i.title.replace(/^File:/, "")}  ·  ${i.license || "licence ?"}  ·  ${i.size}  ·  ${i.mime}`);
  }
  process.exit(0);
}

const title = args.slice(1).find((a, k, all) => !a.startsWith("--") && !["--as", "--width"].includes(all[k - 1]));
if (!title) fail("Fichier Commons manquant (ex. \"Bitcoin.svg\").");
const r = await api({ action: "query", titles: `File:${title.replace(/^File:/, "")}`, ...IIPROP });
const page = r.query?.pages?.[0];
if (!page || page.missing || !page.imageinfo) fail(`Fichier introuvable sur Commons : ${title}`);
const i = info(page);
if (!i.free) fail(`Licence non libre (${i.license || "inconnue"}) : ${i.page}`);
const ext = extname(new URL(i.url).pathname).toLowerCase() || ".png";
const name = (opt("--as") ?? title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "") + ext).toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
if (args.includes("--dry")) {
  console.log(JSON.stringify({ ...i, file: `tales/hd/${slug}/${name}` }, null, 2));
  process.exit(0);
}
const res = await fetch(i.url, { headers: { "User-Agent": UA } });
if (!res.ok) fail(`Téléchargement : HTTP ${res.status} (${i.url})`);
const dir = join(ROOT, "public", "tales", "hd", slug);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, name), Buffer.from(await res.arrayBuffer()));
const file = join(dir, "sources.json");
const meta = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
meta[name] = { title: i.title, page: i.page, author: i.author, license: i.license, licenseUrl: i.licenseUrl, credit: i.credit, fetched: new Date().toISOString().slice(0, 10) };
writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`tales/hd/${slug}/${name}`);
