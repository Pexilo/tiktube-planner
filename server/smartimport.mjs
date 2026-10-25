// Import intelligent TikTok : on dépose un dossier (ou .md + images en vrac) et la plateforme
// 1) lit le texte de chaque image (OCR Vision local), 2) regroupe les images en carrousels et les ordonne,
// 3) associe chaque carrousel à la bonne légende du .md (clé, langue, mots communs, nombre de slides),
// 4) crée les brouillons avec un niveau de confiance — ce qui est douteux est signalé, jamais deviné en silence.
import { basename, dirname, extname, join } from "node:path";
import { execClaude, ocrImages } from "../shared/platform.mjs";
import { createPost, addImages, prepareImage, parseMarkdown } from "./tiktok.mjs";

/** Texte + langue de chaque image (Vision sur macOS, Windows.Media.Ocr sur Windows). */
export const ocr = ocrImages;

/* ------------------------------------------------------------------ texte */

const STOP = new Set(
  "les des une un le la de du et en pour pas que qui sur avec dans est ton ta tes mon ma mes ce cette ces plus mais ou au aux par the and for you your with this that are from have just one not but all can its our what how a to of in on is it".split(" "),
);
const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9€$%]+/g, " ");
const words = (s) => new Set(norm(s).split(" ").filter((w) => w.length >= 3 && !STOP.has(w)));
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}
const guessLang = (s) => {
  const t = ` ${norm(s)} `;
  const fr = (t.match(/ (le|la|les|des|est|pour|avec|ton|tes|vous|une|que|pas|chaque) /g) ?? []).length;
  const en = (t.match(/ (the|and|your|with|is|for|every|you|what|how|just|one) /g) ?? []).length;
  return fr === en ? "" : fr > en ? "fr" : "en";
};

/* ------------------------------------------------------------------ légendes (.md) */

/**
 * Lit un document de légendes. Chaque section `##` = un post (ou un carrousel).
 * Si la section contient des blocs **FR** / **EN**, on crée une légende par langue.
 * Clé : « D — … », « 01 — … », « Carrousel 3 … » ; titre : texte entre guillemets « fr » / "en" ;
 * nombre de slides : « (6 slides) ». Ordre conseillé : ligne « Ordre de publication … **E** … **F** … ».
 */
export function parseCaptionDoc(md, source) {
  const order = [];
  const ordLine = md.split("\n").find((l) => /ordre de publication|posting order|publication order/i.test(l));
  if (ordLine) for (const m of ordLine.matchAll(/\*\*([A-Z0-9]{1,3})\*\*/g)) order.push(m[1]);

  const sections = [];
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) sections.push((cur = { heading: h[1], lines: [] }));
    else if (/^#\s/.test(line)) cur = null;
    else if (cur) cur.lines.push(line);
  }
  const cands = [];
  for (const s of sections) {
    const key = (/^(?:carrousel|carousel|post|vid[ée]o|slide)?\s*#?\s*([A-Z]|\d{1,3})\s*[—–:\-.)]/i.exec(s.heading)?.[1] ?? "").toUpperCase();
    const slides = Number(/(\d+)\s*(?:slides?|images?|photos?)/i.exec(s.heading)?.[1] ?? 0) || null;
    const quoted = [...s.heading.matchAll(/[«"“]\s*([^»"”]+?)\s*[»"”]/g)].map((m) => m[1]);
    const bare = s.heading
      .replace(/^(?:carrousel|carousel|post)?\s*#?\s*([A-Z]|\d{1,3})\s*[—–:\-.)]\s*/i, "")
      .replace(/\(.*?\)|·.*$/g, "")
      .trim();
    // Blocs de langue
    const blocks = {};
    let lang = null;
    for (const raw of s.lines) {
      const l = raw.trim();
      const lm = /^(?:\*\*|###\s*|__)?\s*(FR|EN|FRAN[ÇC]AIS|ENGLISH|ANGLAIS)\s*(?:\*\*|__)?\s*:?\s*$/i.exec(l);
      if (lm) {
        lang = /^(fr|fran)/i.test(lm[1]) ? "fr" : "en";
        blocks[lang] = [];
        continue;
      }
      if (/^-{3,}$|^\*{3,}$/.test(l)) {
        lang = null; // séparateur : fin du bloc de langue (évite d'aspirer les notes de bas de page)
        continue;
      }
      if (lang) blocks[lang].push(l);
    }
    const langs = Object.keys(blocks);
    if (langs.length) {
      for (const lg of langs) {
        const description = blocks[lg].join("\n").replace(/\n{3,}/g, "\n\n").trim();
        const title = (quoted.length >= 2 ? (lg === "fr" ? quoted[0] : quoted[1]) : quoted[0]) ?? bare;
        cands.push({ key, lang: lg, title: title.trim(), description, slides, source, label: `${key ? `${key} · ` : ""}${title} (${lg.toUpperCase()})` });
      }
    } else {
      // Format simple (Titre/Description/Légende/citations) → réutilise le parseur standard
      const [p] = parseMarkdown(`## ${s.heading}\n${s.lines.join("\n")}`, source);
      if (p) cands.push({ key, lang: guessLang(p.description) || guessLang(p.title), title: p.title, description: p.description, slides, source, label: `${key ? `${key} · ` : ""}${p.title}` });
    }
  }
  return { cands, order };
}

/* ------------------------------------------------------------------ images → carrousels */

function fileInfo(rel) {
  const name = basename(rel, extname(rel));
  const lang = (/(?:^|[-_ .])(fr|en)(?:[-_ .]|$)/i.exec(name)?.[1] ?? "").toLowerCase();
  const ki = /([A-Z])[-_ ]?(\d{1,2})$/.exec(name.replace(/^(fr|en)[-_ ]/i, "")) ?? /([A-Z])[-_ ]?(\d{1,2})(?!.*\d)/.exec(name);
  const num = /(\d+)(?!.*\d)/.exec(name)?.[1];
  return { name, dir: dirname(rel), lang, key: ki ? ki[1].toUpperCase() : "", idx: ki ? Number(ki[2]) : num ? Number(num) : null };
}

/**
 * Mode de secours : noms quelconques dans un seul dossier. Chaque image vise une « place » (légende × n° de slide) :
 * une légende de N slides a exactement une slide 1, une slide 2… (lues sur les compteurs « k/N »).
 * Attribution gloutonne sur les meilleures ressemblances (langue + mots communs), places uniques.
 */
function groupByCaption(items, cands) {
  const pairs = [];
  for (const [ii, it] of items.entries()) {
    const lang = it.info.lang || it.ocrLang;
    const iw = words(it.text);
    for (const [ci, c] of cands.entries()) {
      if (lang && c.lang && lang !== c.lang) continue;
      if (it.counter && c.slides && it.counter.n !== c.slides) continue;
      const s = overlap(iw, words(`${c.title}\n${c.description}`)) * 100 + (lang && c.lang ? 25 : 0);
      pairs.push({ ii, ci, s });
    }
  }
  pairs.sort((a, b) => b.s - a.s);
  const slot = new Set();
  const size = new Map();
  const done = new Map();
  for (const p of pairs) {
    if (done.has(p.ii)) continue;
    const it = items[p.ii];
    const c = cands[p.ci];
    const k = it.counter?.k;
    if (k && slot.has(`${p.ci}|${k}`)) continue;
    if (c.slides && (size.get(p.ci) ?? 0) >= c.slides) continue;
    done.set(p.ii, p.ci);
    if (k) slot.add(`${p.ci}|${k}`);
    size.set(p.ci, (size.get(p.ci) ?? 0) + 1);
  }
  const groups = new Map();
  for (const [ii, it] of items.entries()) {
    const k = done.has(ii) ? `c${done.get(ii)}` : `x|${it.info.lang || it.ocrLang}|${it.counter?.n ?? "?"}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return groups;
}

function groupImages(items, cands = []) {
  // items: { path, rel, info, text, ocrLang, counter:{k,n} }
  const groups = new Map();
  const keyed = items.filter((i) => i.info.key);
  if (keyed.length >= items.length * 0.6) {
    for (const it of items) {
      const g = `${it.info.dir}|${it.info.lang || it.ocrLang}|${it.info.key || "?"}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    }
  } else {
    // Pas de clé dans les noms : un sous-dossier = un carrousel, sinon découpe sur les compteurs « 1/N ».
    const byDir = new Map();
    for (const it of items) {
      if (!byDir.has(it.info.dir)) byDir.set(it.info.dir, []);
      byDir.get(it.info.dir).push(it);
    }
    // Un seul dossier, noms sans ordre fiable → association image par image
    const only = byDir.size === 1 ? [...byDir.values()][0] : null;
    if (only && cands.length) {
      only.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));
      const seqOk = only.every((it, i) => it.counter && (i === 0 ? it.counter.k === 1 : it.counter.k === 1 || it.counter.k === only[i - 1].counter.k + 1));
      if (!seqOk) for (const [k, v] of groupByCaption(only, cands)) groups.set(k, v);
    }
    let n = 0;
    for (const [, list] of groups.size ? [] : byDir) {
      list.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));
      const hasCounters = list.filter((x) => x.counter).length >= list.length * 0.6;
      if (byDir.size > 1 && !hasCounters) {
        groups.set(`g${n++}`, list);
        continue;
      }
      let curG = null;
      for (const it of list) {
        if (!curG || (hasCounters && it.counter?.k === 1)) groups.set(`g${n++}`, (curG = []));
        curG.push(it);
      }
    }
  }
  return [...groups.values()].map((list) => {
    list.sort((a, b) => (a.info.idx ?? a.counter?.k ?? 0) - (b.info.idx ?? b.counter?.k ?? 0) || a.rel.localeCompare(b.rel, undefined, { numeric: true }));
    const langs = list.map((x) => x.info.lang || x.ocrLang).filter(Boolean);
    const lang = langs.sort((a, b) => langs.filter((x) => x === b).length - langs.filter((x) => x === a).length)[0] ?? "";
    const key = list.find((x) => x.info.key)?.info.key ?? "";
    const text = list.map((x) => x.text).join("\n");
    const total = list.find((x) => x.counter)?.counter.n ?? null;
    return { items: list, lang, key, text, words: words(text), total };
  });
}

/* ------------------------------------------------------------------ passe IA (Claude Code en local) */

/**
 * Demande à Claude (CLI `claude -p`, abonnement de l'utilisateur, aucune clé d'API) de reconstituer les carrousels :
 * quelles images vont ensemble, dans quel ordre, avec quelle légende — et d'écrire une légende propre s'il n'y en a pas.
 * Retourne null en cas d'échec (on garde alors l'association classique).
 */
async function aiMatch(items, cands) {
  const imgs = items.map((it, i) => ({
    id: `i${i + 1}`,
    fichier: basename(it.rel),
    dossier: it.info.dir === "." ? "" : it.info.dir,
    langue: it.info.lang || it.ocrLang || "?",
    compteur: it.counter ? `${it.counter.k}/${it.counter.n}` : null,
    texte: it.text.replace(/\s+/g, " ").slice(0, 500),
  }));
  const caps = cands.map((c, i) => ({ id: `c${i + 1}`, repere: c.key || null, langue: c.lang || "?", slides: c.slides, titre: c.title, legende: c.description.slice(0, 900) }));
  const prompt = `Tu prépares des carrousels TikTok (diaporamas de photos). On t'a déposé des IMAGES (texte lu par OCR) et des LÉGENDES.
Reconstitue les carrousels : regroupe les images qui forment une même histoire, mets-les dans l'ordre (les compteurs « k/N » font foi, sinon l'ordre logique du récit : accroche → contenu → appel à l'action), et associe chaque carrousel à la légende qui lui correspond (même sujet, même langue, même nombre de slides). Ne mélange jamais deux langues dans un carrousel. Chaque image doit apparaître exactement une fois ; chaque légende au plus une fois.
Si aucune légende ne correspond à un carrousel, écris-en une propre dans la langue des slides : un titre accrocheur (90 caractères max) et une description TikTok naturelle (2 à 4 lignes, un appel à commenter ou enregistrer, puis 6 à 10 hashtags pertinents).

IMAGES :
${JSON.stringify(imgs, null, 1)}

LÉGENDES :
${JSON.stringify(caps, null, 1)}

Réponds UNIQUEMENT avec ce JSON (aucun texte autour) :
{"carrousels":[{"legende":"c1 ou null","images":["i3","i1","..."],"confiance":"haute|moyenne|faible","raison":"courte justification en français","titre":"seulement si legende=null","description":"seulement si legende=null"}]}`;
  try {
    const { stdout } = await new Promise((resolve, reject) => {
      const p = execClaude(["-p", "--output-format", "json", "--model", "sonnet", "--max-turns", "1"], { maxBuffer: 32 * 1024 * 1024, timeout: 240000 }, (err, stdout, stderr) => (err ? reject(err) : resolve({ stdout, stderr })));
      p.stdin.end(prompt);
    });
    const wrapper = JSON.parse(stdout);
    const text = String(wrapper.result ?? wrapper.text ?? stdout);
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    // Validation stricte : images uniques et connues, légendes uniques.
    const seen = new Set();
    const usedCaps = new Set();
    const out = [];
    for (const g of json.carrousels ?? []) {
      const list = (g.images ?? []).map((id) => Number(String(id).replace("i", "")) - 1).filter((i) => i >= 0 && i < items.length && !seen.has(i));
      list.forEach((i) => seen.add(i));
      if (!list.length) continue;
      let ci = g.legende ? Number(String(g.legende).replace("c", "")) - 1 : null;
      if (ci !== null && (ci < 0 || ci >= cands.length || usedCaps.has(ci))) ci = null;
      if (ci !== null) usedCaps.add(ci);
      out.push({ list, ci, confidence: { haute: "high", moyenne: "medium", faible: "low" }[g.confiance] ?? "medium", reason: g.raison ?? "", title: g.titre ?? null, description: g.description ?? null });
    }
    const missing = items.map((_, i) => i).filter((i) => !seen.has(i));
    if (missing.length) out.push({ list: missing, ci: null, confidence: "low", reason: "images non attribuées par l'IA", title: null, description: null });
    return out;
  } catch (e) {
    console.error("Passe IA indisponible :", e.message);
    return null;
  }
}

/* ------------------------------------------------------------------ association */

function score(g, c) {
  const reasons = [];
  let s = 0;
  if (g.key && c.key) {
    if (g.key === c.key) {
      s += 50;
      reasons.push(`même repère « ${c.key} »`);
    } else s -= 30;
  }
  if (g.lang && c.lang) {
    if (g.lang === c.lang) {
      s += 25;
      reasons.push(`langue ${c.lang.toUpperCase()}`);
    } else s -= 40;
  }
  const sim = overlap(g.words, words(`${c.title}\n${c.description}`));
  if (sim > 0.05) {
    s += Math.round(sim * 45);
    reasons.push(`${Math.round(sim * 100)} % de mots communs entre les slides et la légende`);
  }
  const n = g.items.length;
  if (c.slides) {
    if (c.slides === n) {
      s += 10;
      reasons.push(`${n} slides comme annoncé`);
    } else s -= 10;
  }
  return { s, reasons };
}

export async function smartImport(files, { dryRun = false } = {}) {
  // files: [{ path: chemin temporaire, rel: chemin relatif d'origine }]
  const mds = files.filter((f) => /\.(md|markdown|txt)$/i.test(f.rel));
  const imgs = files.filter((f) => /\.(png|jpe?g|webp|heic)$/i.test(f.rel));
  const { readFileSync } = await import("node:fs");
  const cands = [];
  const order = [];
  for (const f of mds) {
    const r = parseCaptionDoc(readFileSync(f.path, "utf8"), basename(f.rel));
    cands.push(...r.cands);
    order.push(...r.order);
  }

  const ocrRes = imgs.length ? await ocr(imgs.map((f) => f.path)) : [];
  const items = imgs.map((f, i) => {
    const t = ocrRes[i]?.text ?? "";
    const m = /(?:^|\n)\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*(?:\n|$)/.exec(t);
    return { ...f, info: fileInfo(f.rel), text: t, ocrLang: ocrRes[i]?.lang ?? "", counter: m ? { k: Number(m[1]), n: Number(m[2]) } : null };
  });
  const groups = groupImages(items, cands);

  // Association gloutonne sur les meilleurs scores
  const pairs = [];
  groups.forEach((g, gi) => cands.forEach((c, ci) => pairs.push({ gi, ci, ...score(g, c) })));
  pairs.sort((a, b) => b.s - a.s);
  const gTaken = new Map();
  const cTaken = new Set();
  for (const p of pairs) {
    if (p.s < 30 || gTaken.has(p.gi) || cTaken.has(p.ci)) continue;
    gTaken.set(p.gi, p);
    cTaken.add(p.ci);
  }

  // Tout est sûr (noms de fichiers / dossiers explicites) ? On garde. Sinon → passe IA sur l'ensemble.
  const allSure = groups.every((g, gi) => {
    const p = gTaken.get(gi);
    if (!p) return false;
    const second = pairs.filter((x) => x.gi === gi && x.ci !== p.ci).sort((a, b) => b.s - a.s)[0];
    return p.s >= 70 && p.s - (second?.s ?? 0) >= 15;
  });
  let aiPlan = null;
  if (imgs.length && (!allSure || !cands.length)) aiPlan = await aiMatch(items, cands);
  if (aiPlan) {
    groups.length = 0;
    gTaken.clear();
    cTaken.clear();
    for (const a of aiPlan) {
      const list = a.list.map((i) => items[i]);
      groups.push({ items: list, lang: list[0].info.lang || list[0].ocrLang, key: "", text: "", words: new Set(), total: null, ai: a });
      if (a.ci !== null) cTaken.add(a.ci);
    }
  }

  const report = [];
  const rank = (g, c) => {
    const i = order.indexOf(c?.key ?? g.key);
    return (i < 0 ? 99 : i) * 10 + ((c?.lang ?? g.lang) === "en" ? 1 : 0);
  };
  const plan = groups
    .map((g, gi) =>
      g.ai
        ? { g, gi, p: { s: 100, reasons: [`analyse IA : ${g.ai.reason}`], ci: g.ai.ci }, c: g.ai.ci !== null ? cands[g.ai.ci] : null, ai: g.ai }
        : { g, gi, p: gTaken.get(gi), c: gTaken.has(gi) ? cands[gTaken.get(gi).ci] : null },
    )
    .sort((a, b) => rank(a.g, a.c) - rank(b.g, b.c));

  for (const [n, { g, gi, p, c, ai }] of plan.entries()) {
    const second = ai ? null : pairs.filter((x) => x.gi === gi && x.ci !== p?.ci).sort((a, b) => b.s - a.s)[0];
    const margin = ai ? 100 : p ? p.s - (second?.s ?? 0) : 0;
    const confidence = ai ? (ai.ci === null && !ai.title ? "none" : ai.confidence) : !p ? "none" : p.s >= 70 && margin >= 15 ? "high" : p.s >= 45 ? "medium" : "low";
    const firstLine = g.items[0].text.split("\n").filter((l) => l.length > 8 && !/^\d+\s*\/\s*\d+$/.test(l))[0] ?? "Carrousel";
    if (dryRun) {
      report.push({ images: g.items.map((x) => basename(x.rel)), caption: c?.label ?? (ai?.title ? `✍️ légende écrite par l'IA : ${ai.title}` : null), confidence, score: p?.s ?? 0, margin, reasons: p?.reasons ?? [] });
      continue;
    }
    const post = createPost({
      type: "photo",
      title: (c?.title ?? ai?.title ?? firstLine).slice(0, 90),
      description: c?.description ?? ai?.description ?? "",
      source: c?.source ?? (ai?.title ? "légende écrite par l'IA" : "import intelligent"),
    });
    post.order = n;
    post.match = { confidence, reasons: p?.reasons ?? [], caption: c?.label ?? null, images: g.items.map((x) => x.rel) };
    const names = [];
    for (const [i, it] of g.items.entries()) names.push(await prepareImage(post.id, it.path, i));
    addImages(post.id, names);
    report.push({ id: post.id, images: g.items.length, caption: c?.label ?? (ai?.title ? `✍️ ${ai.title} (légende écrite par l'IA)` : null), confidence, reasons: p?.reasons ?? [], lang: g.lang, key: g.key });
  }
  const unusedCaptions = cands.filter((_, ci) => !cTaken.has(ci)).map((c) => c.label);
  // Légendes sans images (ex. posts texte) → brouillons sans images, à compléter
  for (const c of cands.filter((_, ci) => !cTaken.has(ci)))
    if (!imgs.length && !dryRun) createPost({ type: "photo", title: c.title.slice(0, 90), description: c.description, source: c.source });
  return { groups: groups.length, captions: cands.length, report, unusedCaptions, order };
}
