// Dossier surveillé TikTok : chaque dossier déposé dans ~/Desktop/Tiktok (un « lot ») est analysé,
// transformé en posts (carrousels + vidéos) avec la bonne légende, programmé, puis rangé dans « Programmés ».
//
// Structure attendue (souple) :
//   ~/Desktop/Tiktok/<lot>/LEGENDES.md (ou .txt)        ← légendes, n'importe quel format lisible
//   ~/Desktop/Tiktok/<lot>/fr/<carrousel>/01.png …      ← un dossier d'images = un carrousel
//   ~/Desktop/Tiktok/<lot>/<sujet>/en/slide-1.png …     ← la langue peut être n'importe où dans le chemin
//   ~/Desktop/Tiktok/<lot>/…/video.mp4                  ← chaque vidéo = un post vidéo
// Les aperçus (« apercu », « preview », planches contact) sont ignorés. Sans légende, Claude en écrit une.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { execClaude } from "../shared/platform.mjs";
import { addImages, createPost, deletePost, MEDIA, prepareImage, scheduleDrafts, ttSettings } from "./tiktok.mjs";
import { ocr } from "./smartimport.mjs";
import { logEvent } from "./events.mjs";
import { loadProfile } from "../shared/profile.mjs";

const IMG = /\.(png|jpe?g|webp|heic)$/i;
const VID = /\.(mp4|mov|m4v)$/i;
const TXT = /\.(md|markdown|txt)$/i;
const SKIP = /^(aper[cç]us?|previews?|planches?|contact|sheets?|thumbs?|miniatures?|_.*)$/i;
const DONE_NAME = "Programmés";
// macOS peut écrire « é » décomposé (NFD) : on compare en forme normalisée, sans accents ni casse.
const isDone = (n) => n.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() === "programmes";

export const watchDir = () => resolve((ttSettings().watchDir ?? join(homedir(), "Desktop/Tiktok")).replace(/^~/, homedir()));
export const watchState = { running: false, current: null, step: "", lastScan: null, lastResult: null, pending: [] };

const visible = (n) => !n.startsWith(".") && n !== "Icon\r";
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!visible(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const langOf = (rel) => rel.split("/").map((s) => s.toLowerCase()).find((s) => s === "fr" || s === "en" || /^(fr|en)[-_]/.test(s) || /[-_](fr|en)$/.test(s))?.match(/fr|en/)?.[0] ?? "";

/** Lots prêts : dossiers de premier niveau (hors « Programmés »), sans fichier modifié depuis 60 s (copie terminée). */
export function pendingBatches() {
  const root = watchDir();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && visible(e.name) && !isDone(e.name))
    .map((e) => {
      const dir = join(root, e.name);
      const files = walk(dir);
      const newest = Math.max(0, ...files.map((f) => statSync(f).mtimeMs));
      const media = files.filter((f) => IMG.test(f) || VID.test(f)).length;
      return { name: e.name, dir, files, media, stable: Date.now() - newest > 60000 };
    })
    .filter((b) => b.media > 0);
}

/** Découpe un lot en carrousels (dossiers d'images « feuilles ») et vidéos. */
function analyse(batch) {
  const byDir = new Map();
  for (const f of batch.files.filter((x) => IMG.test(x))) {
    const d = dirname(f);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(f);
  }
  const dirs = [...byDir.keys()];
  const carousels = [];
  for (const d of dirs) {
    const rel = relative(batch.dir, d) || ".";
    if (rel.split("/").some((s) => SKIP.test(s))) continue;
    // Images à la racine d'un dossier qui contient des carrousels = aperçus → ignorées
    if (dirs.some((o) => o !== d && o.startsWith(d + "/"))) continue;
    const imgs = byDir.get(d).filter((f) => !/aper[cç]u|preview|sheet|contact/i.test(basename(f))).sort((a, b) => basename(a).localeCompare(basename(b), undefined, { numeric: true }));
    if (!imgs.length) continue;
    carousels.push({ id: `c${carousels.length + 1}`, rel, lang: langOf(rel), images: imgs.slice(0, 35) });
  }
  const videos = batch.files.filter((x) => VID.test(x)).map((f, i) => ({ id: `v${i + 1}`, rel: relative(batch.dir, f), lang: langOf(relative(batch.dir, f)), file: f }));
  const docs = batch.files.filter((x) => TXT.test(x)).map((f) => ({ name: relative(batch.dir, f), text: readFileSync(f, "utf8").slice(0, 30000) }));
  return { carousels, videos, docs };
}

function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const p = execClaude(["-p", "--output-format", "json", "--model", "sonnet", "--max-turns", "1"], { maxBuffer: 32 * 1024 * 1024, timeout: 300000 }, (err, stdout) => {
      if (err) return reject(err);
      try {
        const w = JSON.parse(stdout);
        const t = String(w.result ?? stdout);
        resolve(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)));
      } catch (e) {
        reject(new Error(`Réponse IA illisible : ${e.message}`));
      }
    });
    p.stdin.end(prompt);
  });
}

/** Demande à Claude d'associer chaque carrousel / vidéo à sa légende (recopiée telle quelle) ou d'en écrire une. */
async function plan(batch, a) {
  const items = [
    ...a.carousels.map((c, i) => ({ id: c.id, type: "carrousel", dossier: c.rel, langue: c.lang || "?", slides: c.images.length, texte_des_slides: (c.ocr ?? []).join(" / ").replace(/\s+/g, " ").slice(0, 700) })),
    ...a.videos.map((v) => ({ id: v.id, type: "vidéo", fichier: v.rel, langue: v.lang || "?" })),
  ];
  const prompt = `Tu prépares des posts TikTok à partir d'un dossier « ${batch.name} » déposé par ${loadProfile().ownerName || "le créateur"} (fondateur d'apps SaaS).
Pour CHAQUE élément ci-dessous (carrousel photo ou vidéo), donne le titre et la légende à publier.

RÈGLES
- Si un document de légendes contient la légende de cet élément (repère par le nom de dossier, le titre, le sujet, la langue), RECOPIE-LA MOT POUR MOT dans "description" (texte + emojis + hashtags, sans les backticks ni les puces Markdown). Ne réécris rien, n'ajoute rien. "source": "document".
- Sinon, écris une légende dans la langue des slides, au ton TikTok naturel : 2 à 4 lignes, une question ou un appel à commenter/enregistrer, puis 6 à 10 hashtags pertinents (FR : marché belge/français). "source": "ia".
- "titre" : l'accroche du carrousel en 90 caractères max (titre donné dans le document s'il existe, sans guillemets, sinon la phrase d'accroche de la 1re slide). Même langue que l'élément.
- "langue" : "fr" ou "en".
- "ordre" : rang de publication conseillé dans ce lot (1 = en premier), d'après les conseils du document s'il y en a ; la version FR et la version EN d'un même carrousel ont le même rang.
- "ignorer": true uniquement si l'élément n'est clairement pas un post (planche d'aperçu, maquette, doublon).
- Ne mélange jamais les langues : légende EN pour un élément EN.

DOCUMENTS DU DOSSIER :
${a.docs.map((d) => `===== ${d.name} =====\n${d.text}`).join("\n\n") || "(aucun)"}

ÉLÉMENTS :
${JSON.stringify(items, null, 1)}

Réponds UNIQUEMENT avec ce JSON :
{"posts":[{"id":"c1","titre":"…","description":"…","langue":"fr","ordre":1,"source":"document|ia","ignorer":false}]}`;
  const json = await askClaude(prompt);
  const byId = new Map((json.posts ?? []).map((p) => [p.id, p]));
  const missing = items.filter((i) => !byId.has(i.id)).map((i) => i.id);
  if (missing.length) throw new Error(`L'IA n'a pas traité : ${missing.join(", ")}`);
  return byId;
}

/** Traite un lot : crée les posts, les programme, range le dossier. */
export async function processBatch(batch, { dryRun = false } = {}) {
  watchState.current = batch.name;
  watchState.step = "Lecture des images";
  const a = analyse(batch);
  // OCR des 3 premières slides de chaque carrousel : de quoi reconnaître le sujet
  const firsts = a.carousels.flatMap((c) => c.images.slice(0, 3));
  const texts = firsts.length ? await ocr(firsts) : [];
  let k = 0;
  for (const c of a.carousels) {
    const start = k;
    c.ocr = c.images.slice(0, 3).map(() => texts[k++]?.text ?? "");
    if (!c.lang) c.lang = texts[start]?.lang ?? "";
  }
  watchState.step = "Association des légendes (IA)";
  const p = await plan(batch, a);
  const result = [];
  for (const c of a.carousels) result.push({ ...c, ...p.get(c.id), type: "photo" });
  for (const v of a.videos) result.push({ ...v, ...p.get(v.id), type: "video" });
  const keep = result.filter((r) => !r.ignorer);
  if (dryRun) return keep.map((r) => ({ rel: r.rel, type: r.type, n: r.images?.length, lang: r.langue, ordre: r.ordre, source: r.source, titre: r.titre, description: r.description }));

  watchState.step = "Création des posts";
  const created = [];
  try {
    for (const r of keep.sort((x, y) => (x.ordre ?? 99) - (y.ordre ?? 99) || (x.langue === "en") - (y.langue === "en"))) {
      const post = createPost({
        type: r.type,
        title: String(r.titre ?? "").slice(0, 90),
        description: String(r.description ?? "").slice(0, 4000),
        source: `${batch.name} · ${r.rel}`,
      });
      created.push(post.id);
      Object.assign(post, {
        lang: r.langue === "en" ? "en" : "fr",
        batch: batch.name,
        order: r.ordre ?? 99,
        match: { confidence: r.source === "document" ? "high" : "medium", reasons: [r.source === "document" ? "légende du document du dossier" : "légende écrite par l'IA (aucune dans le dossier)"], caption: null, images: (r.images ?? [r.file]).map((f) => relative(batch.dir, f)) },
      });
      if (r.type === "photo") {
        const names = [];
        for (const [i, f] of r.images.entries()) names.push(await prepareImage(post.id, f, i));
        addImages(post.id, names);
      } else {
        const dir = join(MEDIA, post.id);
        mkdirSync(dir, { recursive: true });
        const dest = join(dir, `video${extname(r.file).toLowerCase()}`);
        copyFileSync(r.file, dest);
        post.videoFile = dest;
      }
    }
  } catch (e) {
    created.forEach((id) => deletePost(id));
    throw e;
  }
  // Rangement : <watch>/Programmés/<lot>
  const doneDir = join(watchDir(), readdirSync(watchDir()).find(isDone) ?? DONE_NAME);
  mkdirSync(doneDir, { recursive: true });
  let dest = join(doneDir, batch.name);
  for (let i = 2; existsSync(dest); i++) dest = join(doneDir, `${batch.name} (${i})`);
  renameSync(batch.dir, dest);
  const ai = keep.filter((r) => r.source !== "document").length;
  logEvent("schedule", `TikTok : lot « ${batch.name} » → ${keep.length} post(s) programmé(s)${ai ? ` dont ${ai} avec légende écrite par l'IA` : ""}, dossier rangé dans ${DONE_NAME}`);
  return { batch: batch.name, posts: keep.length, ai };
}

/** Passe complète : traite chaque lot prêt, un par un. */
export async function scan() {
  if (watchState.running) return watchState.lastResult;
  watchState.running = true;
  watchState.lastScan = new Date().toISOString();
  const results = [];
  try {
    const batches = pendingBatches();
    watchState.pending = batches.map((b) => ({ name: b.name, media: b.media, stable: b.stable }));
    for (const b of batches.filter((x) => x.stable)) {
      try {
        results.push(await processBatch(b));
      } catch (e) {
        results.push({ batch: b.name, error: String(e.message ?? e).slice(0, 300) });
        logEvent("error", `TikTok : lot « ${b.name} » non traité — ${e.message}`);
      }
    }
    // Programmation en une fois à la fin : les lots s'alternent (jamais deux posts de la même app d'affilée)
    if (results.some((r) => r.posts)) scheduleDrafts();
  } finally {
    watchState.running = false;
    watchState.current = null;
    watchState.step = "";
    watchState.pending = pendingBatches().map((b) => ({ name: b.name, media: b.media, stable: b.stable }));
    if (results.length) watchState.lastResult = { at: new Date().toISOString(), results };
  }
  return watchState.lastResult;
}
