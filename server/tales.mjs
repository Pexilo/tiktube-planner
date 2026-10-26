// Stories crypto (« tales ») : idées (Claude + recherche web), script, validation, puis automatiquement
// voix off (ElevenLabs), musique, composition des visuels par Claude (src/tales/drafts → stories), rendu, planning, TikTok.
// Stockage : content/tales/<slug>.json (contrat src/tales/types.ts) et data/tales/ideas.json.
// Une seule file de travaux : un job Claude / ElevenLabs à la fois, étape et log visibles dans le dashboard.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { loadApps, loadTale, loadTales, ROOT, TALE_STORIES, TALES_DIR } from "../shared/catalog.mjs";
import { execClaude, IS_WIN } from "../shared/platform.mjs";
import { voiceFor } from "../shared/elevenlabs.mjs";
import { TALE_APP, taleId, taleMusic, taleTimeline } from "../shared/tales.mjs";
import { ensureMusic } from "../scripts/gen-all-audio.mjs";
import { dur, elevenSegment, pickVoice, systemSegment, wordTimings } from "../scripts/gen-voice.mjs";
import { DATA, getState, save, video } from "./state.mjs";
import { enqueue, isRendered, onRendered, outFile } from "./render.mjs";
import { scheduleTales } from "./scheduler.mjs";
import { logEvent } from "./events.mjs";
import { buildMetadata, tiktokCaption } from "./youtube.mjs";
import * as tt from "./tiktok.mjs";

const IDEAS_FILE = join(DATA, "tales", "ideas.json");
const DRAFTS = join(ROOT, "src", "tales", "drafts");
const FEATURES = ["pnl", "address", "grade", "whatif", "regrets", "gas", "trophies", "math"];
const ROLES = ["hook", "context", "build", "twist", "product", "payoff", "outro"];
/** Toutes les étapes des stories (idées, script, visuels) : Claude Opus 5.5, effort maximal (xhigh). */
const STORY_MODEL = ["--model", "claude-opus-5-5", "--effort", "xhigh"];
const COMPOSE_TIMEOUT = 45 * 60 * 1000;
mkdirSync(join(DATA, "tales"), { recursive: true });
mkdirSync(TALES_DIR, { recursive: true });

const today = () => new Date().toISOString().slice(0, 10);
const words = (t) => t.split(/\s+/).filter(Boolean).length;
const plain = (t) => String(t ?? "").replace(/\*/g, "");

/* ------------------------------------------------------------------ stockage */

export function saveTale(tale) {
  const f = join(TALES_DIR, `${tale.slug}.json`);
  writeFileSync(`${f}.tmp`, JSON.stringify(tale, null, 2) + "\n");
  renameSync(`${f}.tmp`, f);
  return tale;
}

/** Relit le JSON, applique `fn`, réécrit : les étapes longues ne travaillent jamais sur une copie périmée. */
function patchTale(slug, fn) {
  const t = loadTale(slug);
  if (!t) throw new Error(`Story introuvable : ${slug}`);
  fn(t);
  return saveTale(t);
}

function readIdeas() {
  return existsSync(IDEAS_FILE) ? JSON.parse(readFileSync(IDEAS_FILE, "utf8")) : { searchedAt: null, ideas: [] };
}
function writeIdeas(store) {
  writeFileSync(`${IDEAS_FILE}.tmp`, JSON.stringify(store, null, 2));
  renameSync(`${IDEAS_FILE}.tmp`, IDEAS_FILE);
}

/* ------------------------------------------------------------------ file de travaux */

const jobs = []; // { slug, label, fn, resolve, reject }
let job = null; // { slug, label, stage, log: [], startedAt }

/** Ajoute un travail à la file ; la promesse se résout avec son résultat. `slug` null = recherche d'idées. */
function runJob(slug, label, fn) {
  return new Promise((resolve, reject) => {
    jobs.push({ slug, label, fn, resolve, reject });
    void pump();
  });
}

async function pump() {
  if (job) return;
  while (jobs.length) {
    const j = jobs.shift();
    job = { slug: j.slug, label: j.label, stage: j.label, log: [], startedAt: Date.now() };
    try {
      j.resolve(await j.fn());
    } catch (e) {
      j.reject(e);
    }
  }
  job = null;
}

function stage(name) {
  if (!job) return;
  job.stage = name;
  log(`— ${name}`);
}
function log(line) {
  console.log(`[tales] ${line}`);
  if (!job) return;
  job.log.push(...String(line).split(/\r?\n/).filter(Boolean));
  if (job.log.length > 300) job.log.splice(0, job.log.length - 300);
}

export const jobInfo = () =>
  job ? { slug: job.slug, label: job.label, stage: job.stage, log: job.log.slice(-40), startedAt: job.startedAt, queued: jobs.map((j) => ({ slug: j.slug, label: j.label })) } : null;
const busyWith = (slug) => job?.slug === slug || jobs.some((j) => j.slug === slug);

/* ------------------------------------------------------------------ Claude */

/** Réglages de permissions passés par fichier (--settings) : `Edit(src/…/**)` ne survit pas toujours à cmd.exe. */
function settingsFile(name, allow, deny = []) {
  const f = join(DATA, "tales", `claude-${name}.json`);
  writeFileSync(f, JSON.stringify({ permissions: { allow, deny } }, null, 2));
  return f;
}

/** Tue le process et ses enfants (sur Windows, `claude.cmd` passe par cmd.exe → node). */
function killTree(p) {
  if (IS_WIN && p.pid) execFile("taskkill", ["/pid", String(p.pid), "/T", "/F"], () => {});
  else p.kill("SIGKILL");
}

/** `claude -p` (prompt sur stdin), sortie JSON : renvoie l'enveloppe { result, num_turns, total_cost_usd, … }. */
function claude(args, prompt, { timeout = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const p = execClaude(["-p", "--output-format", "json", ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      clearTimeout(timer);
      clearInterval(tick);
      let w = null;
      try {
        w = JSON.parse(String(stdout).trim().split(/\r?\n/).at(-1));
      } catch {}
      const text = `${w?.result ?? ""} ${stdout} ${stderr}`;
      if (/invalid api key|please run \/login|not logged in/i.test(text))
        return reject(new Error("Claude Code n'est pas connecté : mets-le à jour (npm i -g @anthropic-ai/claude-code@latest) puis lance `claude` → /login."));
      if (timedOut) return reject(new Error(`Claude : délai dépassé (${Math.round(timeout / 60000)} min)`));
      if (!w) return reject(new Error(`Claude : réponse illisible${err ? ` (${err.message.slice(0, 300)})` : ""} ${String(stderr).slice(0, 300)}`));
      if (w.is_error) return reject(new Error(`Claude : ${String(w.result ?? w.subtype ?? "erreur").slice(0, 400)}`));
      log(`Claude : ${w.num_turns ?? "?"} tours, ${Math.round((w.duration_ms ?? 0) / 1000)} s${w.total_cost_usd ? `, ≈ $${w.total_cost_usd.toFixed(2)}` : ""}`);
      resolve(w);
    });
    const started = Date.now();
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(p);
    }, timeout);
    const tick = setInterval(() => log(`Claude travaille… ${Math.round((Date.now() - started) / 60000)} min`), 60000);
    p.stdin.end(prompt);
  });
}

/** Extrait l'objet JSON d'une réponse texte (Claude peut l'entourer de prose ou de ```). */
function jsonFrom(text) {
  const t = String(text);
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Pas de JSON dans la réponse de Claude");
  return JSON.parse(t.slice(a, b + 1));
}

const wgg = () => loadApps().find((a) => a.slug === TALE_APP);
const featureList = () =>
  wgg()
    .features.filter((f) => FEATURES.includes(f.id))
    .map((f) => `- ${f.id}: ${plain(f.title.en)} ${f.text.en}`)
    .join("\n");

/**
 * Skills Claude Code à charger (outil Skill) pour une étape. Ils sont écrits pour le marketing de marque :
 * on n'en garde que la méthode, et les règles du prompt priment.
 */
const skillsBlock = (names) => `SKILLS: before you start, load each of these skills with the Skill tool and apply their methods:
${names.map((n) => `- ${n}`).join("\n")}
They are written for brand social media. There is no brand profile, voice file or content pillars file here: the brief in this prompt is the brand context. Ignore anything about scheduling, publishing tools (WoopSocial…), analytics or asking the user questions. If a skill disagrees with the RULES of this prompt, the RULES win. If a skill cannot be loaded, continue without it.
`;

/* ------------------------------------------------------------------ 1. idées */

function ideasPrompt(avoid) {
  return `You are the researcher of "Crypto stories", a channel of 1-2 minute vertical videos telling intriguing, semi-niche crypto / blockchain stories in English.
Today's date is ${today()}.

${skillsBlock(["social-media-skills:content-research-and-sourcing (find and verify primary, dated sources)", "social-media-skills:trend-jacking (what is timely right now, and whether a story is still fresh)", "social-media-skills:idea-generation-and-ideation (sharp, specific angles instead of generic news)", "storytelling-hooks (write each idea's hook with its six levers: a curiosity gap plus a concrete number or stake)"])}
Use WebSearch and WebFetch to find 8 story ideas:
- 5 of type "recent": the event happened less than 60 days before today (after ${new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)}). Every source MUST have a publication date. Verify dates on the pages themselves.
- 3 of type "offbeat": older (any year) but genuinely strange, surprising or absurd, and well documented.
Good stories: a person, a mistake, a twist, a number that sounds impossible (lost keys, fat-finger trades, absurd hacks, odd court cases, forgotten wallets waking up, weird on-chain messages, bizarre NFT or memecoin episodes). Avoid generic market news and price predictions, and pick stories the average crypto viewer has not already heard ten times.
Report facts as the sources report them. Never present an accusation as fact: write "alleged", "according to …" when the sources do.

Each idea also gets a discreet angle for the app Where'd Gains Go? (a wallet audit web app: real P&L, regrets, what-ifs, gas). Choose the feature the story naturally leads to:
${featureList()}

Do not propose these stories again (already used or proposed):
${avoid.map((t) => `- ${t}`).join("\n") || "- (none)"}

Answer ONLY with this JSON, no prose:
{"ideas":[{"type":"recent"|"offbeat","eventDate":"YYYY-MM-DD","title":"short title","hook":"on-screen hook, max 8 words, wrap the key word in *asterisks*","summary":"3-4 factual sentences: who, what, when, the twist","sources":[{"title":"publication: headline","url":"https://…","date":"YYYY-MM-DD"}],"wggAngle":{"featureId":"one of ${FEATURES.join(", ")}","why":"one sentence"}}]}`;
}

function cleanIdea(x) {
  const sources = (Array.isArray(x.sources) ? x.sources : []).filter((s) => /^https?:\/\//.test(s?.url ?? "")).map((s) => ({ title: String(s.title ?? s.url), url: s.url, ...(s.date ? { date: String(s.date).slice(0, 10) } : {}) }));
  return {
    id: `i${randomBytes(4).toString("hex")}`,
    type: x.type === "recent" ? "recent" : "offbeat",
    eventDate: String(x.eventDate ?? "").slice(0, 10),
    title: String(x.title ?? "").trim(),
    hook: String(x.hook ?? "").trim(),
    summary: String(x.summary ?? "").trim(),
    sources,
    wggAngle: { featureId: FEATURES.includes(x.wggAngle?.featureId) ? x.wggAngle.featureId : "pnl", why: String(x.wggAngle?.why ?? "") },
    foundAt: new Date().toISOString(),
  };
}

/** Une idée « récente » doit dater de moins de 60 jours et n'avoir que des sources datées. */
function ideaProblem(i) {
  if (!i.title || !i.summary || !i.sources.length) return "incomplète";
  if (i.type !== "recent") return null;
  const age = (Date.now() - new Date(`${i.eventDate}T12:00:00Z`).getTime()) / 86400000;
  if (!(age >= -1 && age <= 60)) return `événement du ${i.eventDate || "?"}, plus de 60 jours`;
  if (i.sources.some((s) => !s.date)) return "source sans date";
  return null;
}

export async function searchIdeas() {
  stage("Recherche d'histoires (Claude + web)");
  const store = readIdeas();
  const avoid = [...loadTales().map((t) => t.yt?.title ?? t.slug), ...store.ideas.map((i) => i.title)].slice(-60);
  const settings = settingsFile("search", ["WebSearch", "WebFetch", "Skill"], ["Bash", "Edit", "Write"]);
  const w = await claude([...STORY_MODEL, "--max-turns", "50", "--settings", settings], ideasPrompt(avoid), { timeout: 30 * 60 * 1000 });
  const found = (jsonFrom(w.result).ideas ?? []).map(cleanIdea);
  const kept = [];
  for (const i of found) {
    const why = ideaProblem(i);
    if (why) log(`Idée écartée (${why}) : ${i.title}`);
    else kept.push(i);
  }
  const seen = new Set(store.ideas.map((i) => i.title.toLowerCase()));
  const fresh = kept.filter((i) => !seen.has(i.title.toLowerCase()));
  const next = { searchedAt: new Date().toISOString(), ideas: [...fresh, ...store.ideas].slice(0, 40) };
  writeIdeas(next);
  log(`${fresh.length} idée(s) ajoutée(s) (${fresh.filter((i) => i.type === "recent").length} récentes)`);
  logEvent("info", `Stories : ${fresh.length} nouvelle(s) idée(s)`);
  return fresh;
}

/* ------------------------------------------------------------------ 2. script */

function scriptPrompt(subject, problems) {
  const ref = readFileSync(join(TALES_DIR, "howells.json"), "utf8");
  return `You write the script of a "Crypto stories" vertical video (1 to 2 minutes, English voice-over, minimalist pixel-art animation) for YouTube Shorts and TikTok.
Today's date is ${today()}.

STORY
${subject}

Check the facts with WebSearch / WebFetch when the sources above are not enough, and keep only what the sources support.

${skillsBlock(["storytelling-hooks (THE method for this script, and read its patterns.md: the six levers, the three hook layers, the bookend; run its generation workflow and pre-publish checklist)", "titles-and-thumbnails (the yt title: win the click without clickbait)", "social-media-skills:youtube-publishing-and-metadata (the yt description and hashtags for Shorts)"])}
INTAKE (for storytelling-hooks, do not ask): niche = crypto / blockchain stories; audience = crypto-curious viewers who hold or follow crypto and want true stories they have not heard (qualify for them, not for everyone); platforms = TikTok and YouTube Shorts, autoplay muted; goal = follows for the next story; tone = investigative, punchy, a little ironic.

RULES
- 180 to 300 spoken words in total (all beats together), about 1 to 2 minutes of voice-over; aim for about 230. Short punchy sentences written to be read aloud. Numbers spelled the way they are said ("eight thousand bitcoin").
- STORYTELLING (storytelling-hooks): the hook beat stacks 2 or 3 levers (curiosity gap + a concrete number or stake + relatability or an emotional mirror) and works in under 2 seconds; keep a crypto qualifier in it. Run the levers through the script: conflict (goal + obstacle) early, at least one pattern break ("but…") in the middle, every loop you open is closed before the outro. The three hook layers: the hook beat's "visual" is a first frame that intrigues with the sound off, and the on-screen "hook" title is the OTHER half of the gap (stakes or emotion), never the spoken line repeated. Before answering, generate 5 hook variants in your head, score them against the skill's pre-publish checklist, keep the best.
- 10 to 18 beats, each one or two short sentences (30 words max per beat, so the picture changes every 5 to 10 seconds). Roles: hook (first beat, a curiosity gap, never "in this video"), context, build, twist, payoff, outro (last beat). Tell it in acts so the length never drags: setup, escalation, twist, consequences, a final reveal or open question. Re-hook the viewer every 20 to 30 seconds with a new question, number or turn.
- Exactly ONE beat with role "product", about 5 seconds (10 to 16 words), placed in the middle or right before the outro, never first. Its line bridges from the story to one feature of Where'd Gains Go? (wallet audit web app) with a light, self-aware tone. No hard sell, no price, no "link in bio". Features:
${featureList()}
- The video LOOPS: TikTok and Shorts replay it automatically, so the last beat (outro) closes the story AND flows straight back into the hook. Its last words lead into the hook's first words as one sentence across the loop, e.g. outro "…and until someone is allowed to dig," → hook "Somewhere under this landfill in Wales, there's a hard drive…", or outro "…and that's exactly why" → hook. Read outro + hook aloud in a row: it must sound natural. No "follow", "subscribe" or "like" anywhere. The outro's visual starts with its own shot; the loop back to the first shot is handled by the kit.
- Facts are attributed to their sources ("according to …", "court filings say …"). No accusation beyond what the sources report: use "allegedly" when they do. Do not invent quotes, figures or headlines.
- Each beat has a "visual" brief: what the minimalist pixel-art shot shows during that sentence (one lit flat background color, one main element: a character only when someone acts, otherwise an object, a screen or a row of icons; 2 to 4 small living details; at most 2 on-screen texts). The product beat's visual is "Product cameo (handled by the wrapper)".
- "hook": on-screen title, max 8 words, the key word wrapped in *asterisks*.
- "slug": short kebab-case id (2 to 4 words, a-z 0-9 -), e.g. "pizza-day".
- "facts": the verified facts the video relies on, one per item, with numbers. "sources": every source used, with dates.
- "music": a style among ambient, piano, lofi, chill (a discreet bed under the narrator, never epic), and 2-3 mood words.
- "yt": title (max 70 chars, intriguing, one emoji max, ends with " #shorts"), description (2 sentences), hashtags (5, without #, lowercase, include "cryptostories").
${problems ? `\nYOUR PREVIOUS ANSWER WAS REJECTED, FIX THIS:\n${problems}\n` : ""}
REFERENCE SCRIPT (format and quality to match; a different and shorter story, yours must follow the length rules above):
${ref}

Answer ONLY with the JSON of the new story, same shape as the reference, without "id", "lang", "status", "voice", "timeline", "musicTrack", "compose":
{"slug":"…","type":"recent"|"offbeat","eventDate":"YYYY-MM-DD","hook":"…","summary":"…","sources":[…],"facts":[…],"beats":[{"id":"b1","role":"hook","text":"…","visual":"…"}],"product":{"featureId":"…","beat":"bN"},"music":{"style":"…","mood":[…]},"yt":{"title":"…","description":"…","hashtags":[…]}}`;
}

const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-")
    .slice(0, 32)
    .replace(/-+$/, "") || "story";

function uniqueSlug(base) {
  let s = base;
  for (let n = 2; existsSync(join(TALES_DIR, `${s}.json`)); n++) s = `${base}-${n}`;
  return s;
}

/** Normalise la réponse de Claude en `Tale` et liste ce qui ne respecte pas les règles. */
function toTale(j, idea) {
  const beats = (Array.isArray(j.beats) ? j.beats : []).map((b, i) => ({
    id: `b${i + 1}`,
    role: ROLES.includes(b.role) ? b.role : "build",
    text: String(b.text ?? "").trim(),
    visual: String(b.visual ?? "").trim(),
  }));
  const productIdx = beats.findIndex((b) => b.role === "product");
  const slug = uniqueSlug(slugify(j.slug ?? j.yt?.title));
  const tale = {
    slug,
    id: taleId(slug),
    lang: "en",
    status: "script",
    type: (j.type ?? idea?.type) === "recent" ? "recent" : "offbeat",
    eventDate: String(j.eventDate ?? idea?.eventDate ?? "").slice(0, 10),
    hook: String(j.hook ?? idea?.hook ?? ""),
    summary: String(j.summary ?? idea?.summary ?? ""),
    sources: (Array.isArray(j.sources) && j.sources.length ? j.sources : idea?.sources ?? []).filter((s) => s?.url).map((s) => ({ title: String(s.title ?? s.url), url: s.url, ...(s.date ? { date: String(s.date).slice(0, 10) } : {}) })),
    facts: (Array.isArray(j.facts) ? j.facts : []).map(String),
    beats,
    product: { featureId: FEATURES.includes(j.product?.featureId) ? j.product.featureId : idea?.wggAngle?.featureId ?? "pnl", beat: productIdx >= 0 ? beats[productIdx].id : "" },
    music: { style: String(j.music?.style ?? "ambient"), mood: (Array.isArray(j.music?.mood) ? j.music.mood : []).map(String).slice(0, 4) },
    yt: { title: String(j.yt?.title ?? j.hook ?? slug).slice(0, 100), description: String(j.yt?.description ?? ""), hashtags: (Array.isArray(j.yt?.hashtags) ? j.yt.hashtags : ["crypto", "cryptostories"]).map((h) => String(h).replace(/^#/, "")) },
    compose: { notes: [] },
    error: null,
    ...(idea ? { ideaId: idea.id } : {}),
    createdAt: new Date().toISOString(),
  };
  return { tale, problems: scriptProblems(tale) };
}

function scriptProblems(t) {
  const out = [];
  const n = t.beats.reduce((a, b) => a + words(b.text), 0);
  if (n < 180 || n > 300) out.push(`${n} spoken words: must be 180-300 (1 to 2 minutes).`);
  if (t.beats.length < 10 || t.beats.length > 18) out.push(`${t.beats.length} beats: must be 10-18.`);
  const long = t.beats.filter((b) => b.role !== "product" && words(b.text) > 32);
  if (long.length) out.push(`Beats ${long.map((b) => b.id).join(", ")} are too long: 30 words max per beat.`);
  const products = t.beats.filter((b) => b.role === "product");
  if (products.length !== 1) out.push(`${products.length} product beats: exactly one is required.`);
  else {
    const i = t.beats.indexOf(products[0]);
    if (i < 2 || i === t.beats.length - 1) out.push("The product beat must be in the middle or right before the outro.");
    const w = words(products[0].text);
    if (w < 8 || w > 20) out.push(`Product beat has ${w} words: about 5 seconds (10-16 words).`);
  }
  if (t.beats[0]?.role !== "hook") out.push("First beat must be the hook.");
  if (t.beats.at(-1)?.role !== "outro") out.push("Last beat must be the outro.");
  else if (/\b(follow|subscribe|like and)\b/i.test(t.beats.at(-1).text)) out.push("The outro must loop into the hook (its last words lead into the hook's first words), not ask to follow or subscribe.");
  else if (/[.!?]["”']?\s*$/.test(t.beats.at(-1).text.trim())) out.push("The outro must end mid-sentence (comma or no punctuation) so it flows into the hook when the video loops.");
  if (t.beats.some((b) => !b.text || !b.visual)) out.push("Every beat needs text and visual.");
  const plain = (x) => String(x ?? "").toLowerCase().replace(/[*]/g, "").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  if (t.hook && t.beats[0] && plain(t.beats[0].text).includes(plain(t.hook))) out.push("The on-screen hook repeats the spoken first line: make it the other half of the curiosity gap (stakes or emotion).");
  if (!t.sources.length) out.push("Sources are required.");
  return out;
}

const ideaSubject = (idea) =>
  `${idea.title} (${idea.type}, event date ${idea.eventDate})\n${idea.summary}\nSuggested hook: ${idea.hook}\nSources:\n${idea.sources.map((s) => `- ${s.title}${s.date ? ` (${s.date})` : ""}: ${s.url}`).join("\n")}\nSuggested Where'd Gains Go? angle: ${idea.wggAngle.featureId} — ${idea.wggAngle.why}`;
const topicSubject = (topic) => `The creator's own topic or link: ${topic}\nResearch it first, decide whether it is "recent" (less than 60 days before today) or "offbeat", and find dated sources.`;

/** Écrit un script (2 essais si le premier sort des règles). Renvoie la story normalisée et ses écarts aux règles. */
async function generateScript(subject, idea) {
  const settings = settingsFile("script", ["WebSearch", "WebFetch", "Skill"], ["Bash", "Edit", "Write"]);
  let problems = null;
  let result = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    stage(attempt === 1 ? "Écriture du script (Claude)" : "Correction du script (Claude)");
    const w = await claude([...STORY_MODEL, "--max-turns", "35", "--settings", settings], scriptPrompt(subject, problems), { timeout: 25 * 60 * 1000 });
    result = toTale(jsonFrom(w.result), idea);
    if (!result.problems.length) break;
    problems = result.problems.map((p) => `- ${p}`).join("\n");
    log(`Script hors règles :\n${problems}`);
  }
  return result;
}

export async function writeScript({ ideaId, topic }) {
  const ideas = readIdeas();
  const idea = ideaId ? ideas.ideas.find((i) => i.id === ideaId) : null;
  if (ideaId && !idea) throw new Error("Idée introuvable");
  const result = await generateScript(idea ? ideaSubject(idea) : topicSubject(topic), idea);
  const { tale } = result;
  if (result.problems.length) tale.warnings = result.problems;
  // Le sujet d'origine reste dans la story : on peut en réécrire le script plus tard, même si l'idée a disparu.
  tale.subject = idea ? ideaSubject(idea) : topicSubject(topic);
  saveTale(tale);
  if (idea) writeIdeas({ ...ideas, ideas: ideas.ideas.filter((i) => i.id !== idea.id) });
  log(`Script prêt : ${tale.slug} (${tale.beats.reduce((a, b) => a + words(b.text), 0)} mots, ${tale.beats.length} beats)`);
  logEvent("info", `Stories : script écrit, ${tale.yt.title}`, tale.id);
  return tale;
}

/** Ce qu'une version de script contient (le reste de la story ne change pas d'une version à l'autre). */
const SCRIPT_KEYS = ["type", "eventDate", "hook", "summary", "sources", "facts", "beats", "product", "music", "yt", "warnings"];
const MAX_VERSIONS = 6;
const scriptOf = (t) => Object.fromEntries(SCRIPT_KEYS.filter((k) => t[k] !== undefined).map((k) => [k, t[k]]));

/** Sujet d'une story existante : celui gardé à l'écriture, sinon l'idée d'origine, sinon la story elle-même (résumé, sources). */
function subjectOf(t) {
  if (t.subject) return t.subject;
  const idea = t.ideaId ? readIdeas().ideas.find((i) => i.id === t.ideaId) : null;
  if (idea) return ideaSubject(idea);
  return `${t.yt?.title ?? t.slug} (${t.type}, event date ${t.eventDate || "unknown"})\n${t.summary}\nFacts:\n${(t.facts ?? []).map((x) => `- ${x}`).join("\n")}\nSources:\n${(t.sources ?? []).map((s) => `- ${s.title}${s.date ? ` (${s.date})` : ""}: ${s.url}`).join("\n")}`;
}

/**
 * Réécrit le script d'une story pour le même sujet (nouvel angle, nouveau hook), en gardant son slug.
 * La version actuelle est gardée dans `versions` (les plus récentes d'abord) et peut être restaurée.
 */
export async function rewriteScript(slug, note = "") {
  const t = loadTale(slug);
  if (!t) throw new Error("Story introuvable");
  const previous = t.beats.map((b) => `- [${b.role}] ${b.text}`).join("\n");
  const subject = `${subjectOf(t)}

THIS IS A REWRITE. The previous script for this story is below: write a clearly different version (another hook and angle, another structure for the reveal), with the same facts and sources, and the same rules.
Previous on-screen hook: ${t.hook}
Previous beats:
${previous}${note ? `\n\nTHE CREATOR'S NOTE FOR THIS VERSION (follow it): ${note}` : ""}`;
  const result = await generateScript(subject, null);
  const next = result.tale;
  const cur = loadTale(slug);
  if (cur.status !== "script") throw new Error("La story a été validée pendant la réécriture : script inchangé.");
  cur.versions = [{ at: new Date().toISOString(), ...scriptOf(cur) }, ...(cur.versions ?? [])].slice(0, MAX_VERSIONS);
  for (const k of SCRIPT_KEYS) delete cur[k];
  Object.assign(cur, scriptOf(next));
  if (result.problems.length) cur.warnings = result.problems;
  cur.rewrites = [...(cur.rewrites ?? []), { at: new Date().toISOString(), ...(note ? { note } : {}) }];
  saveTale(cur);
  log(`Nouvelle version : ${cur.beats.reduce((a, b) => a + words(b.text), 0)} mots, ${cur.beats.length} beats`);
  logEvent("info", `Stories : script réécrit, ${cur.yt.title}`, cur.id);
  return cur;
}

/** Restaure la version `index` de `versions` ; la version actuelle prend sa place dans l'historique. */
export function restoreScript(slug, index) {
  const t = loadTale(slug);
  if (!t) throw new Error("Story introuvable");
  const v = t.versions?.[index];
  if (!v) throw new Error("Version introuvable");
  const { at: _at, ...script } = v;
  const versions = [...t.versions];
  versions.splice(index, 1);
  t.versions = [{ at: new Date().toISOString(), ...scriptOf(t) }, ...versions].slice(0, MAX_VERSIONS);
  for (const k of SCRIPT_KEYS) delete t[k];
  Object.assign(t, script);
  saveTale(t);
  return t;
}

/* ------------------------------------------------------------------ 3. voix */

/** Un segment par beat (ElevenLabs, sinon voix du système) → public/voice/<id>/segN.wav, puis la timeline. */
async function ensureTaleVoice(slug) {
  const tale = loadTale(slug);
  const el = voiceFor("en");
  const system = el ? null : pickVoice("en");
  if (!el && !system) throw new Error("Aucune voix anglaise : configure ElevenLabs (Réglages → Voix off) ou installe une voix système EN.");
  const lines = tale.beats.map((b) => b.text);
  const sig = JSON.stringify([el ? el.sig : system, lines]);
  const dir = join(ROOT, "public", "voice", tale.id);
  const fresh = tale.voice?.sig === sig && tale.voice.segments.every((s) => existsSync(join(ROOT, "public", s.file)));
  if (!fresh) {
    stage(`Voix off (${el ? `ElevenLabs · ${el.name}` : system})`);
    mkdirSync(dir, { recursive: true });
    const segments = [];
    for (const [k, text] of lines.entries()) {
      const raw = join(dir, `seg${k}.raw.${el ? "mp3" : IS_WIN ? "wav" : "aiff"}`);
      const out = join(dir, `seg${k}.wav`);
      const w = el ? await elevenSegment(el, "en", lines, k, raw, out) : systemSegment(system, "en", text, raw, out);
      const d = dur(out);
      segments.push({ file: `voice/${tale.id}/seg${k}.wav`, dur: +d.toFixed(3), words: w ?? wordTimings(text, d) });
      log(`Beat ${tale.beats[k].id} : ${d.toFixed(1)} s`);
    }
    tale.voice = { voice: el ? `ElevenLabs · ${el.name}` : system, sig, segments };
  }
  tale.timeline = taleTimeline(tale.beats, tale.voice.segments);
  tale.status = "voiced";
  saveTale(tale);
  log(`Timeline : ${(tale.timeline.totalFrames / 30).toFixed(1)} s`);
  return tale;
}

/* ------------------------------------------------------------------ 4. musique */

async function ensureTaleMusic(slug) {
  stage("Musique");
  const tale = patchTale(slug, (t) => (t.musicTrack = taleMusic(t, t.timeline)));
  await ensureMusic(tale.musicTrack);
  log(`Musique : ${tale.musicTrack.file}`);
  return tale;
}

/* ------------------------------------------------------------------ 5. composition */

function composePrompt(tale, hasDraft) {
  const tpl = readFileSync(join(ROOT, "src", "tales", "compose-prompt.md"), "utf8");
  let notes = tale.compose?.notes?.length ? `\nNotes du créateur à appliquer en priorité :\n${tale.compose.notes.map((n) => `- ${n}`).join("\n")}\n` : "";
  if (hasDraft) notes += `\n\`src/tales/drafts/${tale.slug}.tsx\` existe déjà (version précédente) : lis-le, garde ce qui marche, améliore le reste.\n`;
  return tpl.replaceAll("{{slug}}", tale.slug).replaceAll("{{productBeat}}", tale.product.beat).replaceAll("{{notes}}", notes);
}

/** `node scripts/tale-check.mjs <slug> --draft` : dernière ligne de stdout = { ok, errors, stills, sheet }. */
function taleCheck(slug) {
  return new Promise((resolve) => {
    execFile(process.execPath, [join(ROOT, "scripts", "tale-check.mjs"), slug, "--draft"], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      const last = String(stdout).trim().split(/\r?\n/).at(-1) ?? "";
      try {
        resolve(JSON.parse(last));
      } catch {
        resolve({ ok: false, errors: [`tale-check illisible : ${(err?.message ?? "").slice(0, 200)} ${String(stderr).slice(-400)}`], stills: [], sheet: null });
      }
    });
  });
}

async function composeTale(slug) {
  const tale = patchTale(slug, (t) => {
    t.status = "composing";
    t.error = null;
  });
  const draft = join(DRAFTS, `${slug}.tsx`);
  const story = join(TALE_STORIES, `${slug}.tsx`);
  mkdirSync(DRAFTS, { recursive: true });
  // Recomposition : Claude repart des visuels actuels.
  if (!existsSync(draft) && existsSync(story)) writeFileSync(draft, readFileSync(story));
  const before = existsSync(draft) ? statSync(draft).mtimeMs : 0;
  stage("Composition des visuels (Claude, jusqu'à 45 min)");
  const rel = "src/tales/drafts/**";
  const abs = `//${DRAFTS.replaceAll("\\", "/").replace(/^\/+/, "")}/**`;
  const settings = settingsFile(
    "compose",
    ["Read", "Glob", "Grep", "Skill", `Write(${rel})`, `Edit(${rel})`, `Write(${abs})`, `Edit(${abs})`, "Bash(node scripts/tale-check.mjs:*)"],
    ["WebSearch", "WebFetch"],
  );
  const w = await claude([...STORY_MODEL, "--settings", settings, "--max-turns", "80"], composePrompt(tale, before > 0), { timeout: COMPOSE_TIMEOUT });
  const summary = String(w.result ?? "").trim();
  log(summary);
  if (!existsSync(draft) || statSync(draft).mtimeMs === before) throw new Error(`Claude n'a pas écrit src/tales/drafts/${slug}.tsx`);
  stage("Vérification (tale-check)");
  const check = await taleCheck(slug);
  const tail = [...summary.split(/\r?\n/), check.ok ? `tale-check : ok (${check.stills?.length ?? 0} images)` : `tale-check : ${check.errors.join(" | ")}`].slice(-60).join("\n");
  if (!check.ok) {
    patchTale(slug, (t) => {
      t.status = "error";
      t.error = `Visuels refusés par tale-check : ${check.errors.slice(0, 6).join(" | ")}`.slice(0, 1500);
      t.compose = { ...t.compose, notes: t.compose?.notes ?? [], log: tail, at: new Date().toISOString() };
    });
    throw new Error(`tale-check : ${check.errors.slice(0, 3).join(" | ")}`);
  }
  mkdirSync(TALE_STORIES, { recursive: true });
  if (existsSync(story)) unlinkSync(story);
  renameSync(draft, story);
  const now = new Date();
  utimesSync(story, now, now); // le bundle de rendu se refait d'après les dates de modification
  log("Visuels promus dans src/tales/stories/");
  return patchTale(slug, (t) => {
    t.status = "composed";
    t.error = null;
    t.compose = { ...t.compose, notes: t.compose?.notes ?? [], log: tail, at: now.toISOString() };
  });
}

/* ------------------------------------------------------------------ 6. rendu, planning, TikTok */

let activeCatalog = null;

/** La story entre dans le catalogue : planning de la voie stories, puis file de rendu. */
function queueRender(slug) {
  const c = activeCatalog();
  const v = c.videos.find((x) => x.taleSlug === slug);
  if (!v) throw new Error("Story absente du catalogue (timeline ou visuels manquants)");
  scheduleTales(c);
  video(v.id).rendered = false;
  save();
  enqueue([v.id], c);
  log("Ajoutée à la file de rendu");
}

/** Brouillon TikTok (EN) d'une story rendue, une seule fois par vidéo. */
export function tiktokDraft(v, c) {
  if (tt.posts().some((p) => p.videoId === v.id)) return null;
  const m = buildMetadata(v, c.apps.find((a) => a.slug === v.slug));
  const p = tt.createPost({ type: "video", ...tiktokCaption(m), videoId: v.id, videoFile: outFile(v.id), publishAt: null, source: "tales" });
  p.lang = "en"; // pas de devinette FR/EN sur la légende : les stories sont en anglais
  tt.updatePost(p.id, {}); // enregistre
  logEvent("info", `TikTok : brouillon créé pour la story ${m.title}`, v.id);
  return p;
}

onRendered.push((v) => {
  if (v.kind !== "tale") return;
  patchTale(v.taleSlug, (t) => {
    t.status = "rendered";
    t.error = null;
  });
  if (getState().settings.taleAutoTikTok !== false) tiktokDraft(v, activeCatalog());
});

/** Validation → voix → musique → composition (si besoin) → rendu. Une erreur arrête la chaîne et s'affiche sur la story. */
async function produce(slug, { recompose = false } = {}) {
  try {
    let tale = await ensureTaleVoice(slug);
    tale = await ensureTaleMusic(slug);
    const hasStory = existsSync(join(TALE_STORIES, `${slug}.tsx`));
    if (recompose || !hasStory) tale = await composeTale(slug);
    else patchTale(slug, (t) => (t.status = "composed"));
    queueRender(slug);
    logEvent("info", `Stories : ${tale.yt.title} prête pour le rendu`, tale.id);
  } catch (e) {
    const msg = String(e?.message ?? e).slice(0, 1500);
    log(`Erreur : ${msg}`);
    patchTale(slug, (t) => {
      const detailed = t.status === "error" && t.error; // ex. erreurs de tale-check déjà posées par composeTale
      t.status = "error";
      t.error = detailed || msg;
    });
    logEvent("error", `Story ${slug} : ${msg.slice(0, 160)}`, taleId(slug));
  }
}

/* ------------------------------------------------------------------ routes */

function taleSummary(t) {
  const st = getState().videos[t.id] ?? {};
  return { ...t, rendered: isRendered(t.id), publishAt: st.publishAt ?? null, youtubeId: st.youtubeId ?? null, busy: busyWith(t.slug) };
}

const sortTales = (a, b) => (b.createdAt ?? b.eventDate ?? "").localeCompare(a.createdAt ?? a.eventDate ?? "");

export function setupTaleRoutes(app, opts) {
  activeCatalog = opts.activeCatalog;
  const fail = (res, e, code = 500) => res.status(code).json({ error: String(e?.message ?? e) });

  app.get("/api/tales", (_req, res) => {
    const ideas = readIdeas();
    res.json({ ideas: ideas.ideas, searchedAt: ideas.searchedAt, tales: loadTales().sort(sortTales).map(taleSummary), job: jobInfo() });
  });

  app.post("/api/tales/ideas/search", async (_req, res) => {
    if (busyWith(null)) return fail(res, "Recherche déjà en cours", 409);
    try {
      res.json({ ideas: await runJob(null, "Recherche d'idées", searchIdeas) });
    } catch (e) {
      logEvent("error", `Stories : recherche d'idées échouée, ${String(e.message).slice(0, 160)}`);
      fail(res, e);
    }
  });

  app.delete("/api/tales/ideas/:id", (req, res) => {
    const store = readIdeas();
    writeIdeas({ ...store, ideas: store.ideas.filter((i) => i.id !== req.params.id) });
    res.json({ ok: true });
  });

  app.post("/api/tales", async (req, res) => {
    const { ideaId, topic } = req.body ?? {};
    if (!ideaId && !String(topic ?? "").trim()) return fail(res, "ideaId ou topic requis", 400);
    try {
      const tale = await runJob(`script:${ideaId ?? "topic"}`, "Script", () => writeScript({ ideaId, topic: String(topic ?? "").trim() }));
      res.json(taleSummary(tale));
    } catch (e) {
      logEvent("error", `Stories : script échoué, ${String(e.message).slice(0, 160)}`);
      fail(res, e);
    }
  });

  app.patch("/api/tales/:slug", (req, res) => {
    const t = loadTale(req.params.slug);
    if (!t) return fail(res, "Story introuvable", 404);
    if (t.status !== "script") return fail(res, "Story déjà validée : seul le script (statut « script ») se modifie.", 400);
    const b = req.body ?? {};
    if (b.beats !== undefined) {
      if (!Array.isArray(b.beats) || !b.beats.length) return fail(res, "beats : liste attendue", 400);
      t.beats = b.beats.map((x, i) => ({ id: String(x.id || `b${i + 1}`), role: ROLES.includes(x.role) ? x.role : "build", text: String(x.text ?? "").trim(), visual: String(x.visual ?? "").trim() }));
      if (new Set(t.beats.map((x) => x.id)).size !== t.beats.length) return fail(res, "beats : ids en double", 400);
    }
    if (b.product !== undefined) t.product = { featureId: String(b.product.featureId ?? t.product.featureId), beat: String(b.product.beat ?? t.product.beat) };
    if (b.yt !== undefined) t.yt = { title: String(b.yt.title ?? t.yt.title).slice(0, 100), description: String(b.yt.description ?? t.yt.description), hashtags: (Array.isArray(b.yt.hashtags) ? b.yt.hashtags : t.yt.hashtags).map((h) => String(h).replace(/^#/, "")) };
    if (b.music !== undefined) t.music = { style: String(b.music.style ?? t.music.style), mood: Array.isArray(b.music.mood) ? b.music.mood.map(String) : t.music.mood };
    if (!FEATURES.includes(t.product.featureId)) return fail(res, `Feature inconnue (${FEATURES.join(", ")})`, 400);
    if (!t.beats.some((x) => x.id === t.product.beat)) return fail(res, "product.beat ne correspond à aucun beat", 400);
    for (const x of t.beats) if (x.role === "product" && x.id !== t.product.beat) x.role = "build";
    t.beats.find((x) => x.id === t.product.beat).role = "product";
    t.warnings = scriptProblems(t);
    if (!t.warnings.length) delete t.warnings;
    saveTale(t);
    res.json(taleSummary(t));
  });

  // Réécrire le script (même sujet, nouvelle version), avec une note facultative. Long (Claude) : la réponse part tout de suite.
  app.post("/api/tales/:slug/rewrite", (req, res) => {
    const t = loadTale(req.params.slug);
    if (!t) return fail(res, "Story introuvable", 404);
    if (t.status !== "script") return fail(res, "Story déjà validée : seul un script pas encore validé se réécrit.", 400);
    if (busyWith(t.slug)) return fail(res, "Déjà dans la file", 409);
    const note = String(req.body?.note ?? "").trim().slice(0, 1000);
    void runJob(t.slug, "Réécriture du script", () => rewriteScript(t.slug, note)).catch((e) => {
      logEvent("error", `Stories : réécriture échouée, ${String(e.message).slice(0, 160)}`, t.id);
      patchTale(t.slug, (x) => (x.rewriteError = String(e.message).slice(0, 300)));
    });
    patchTale(t.slug, (x) => delete x.rewriteError);
    res.json({ ok: true });
  });

  app.post("/api/tales/:slug/restore", (req, res) => {
    const t = loadTale(req.params.slug);
    if (!t) return fail(res, "Story introuvable", 404);
    if (t.status !== "script") return fail(res, "Story déjà validée : on ne change plus de version.", 400);
    if (busyWith(t.slug)) return fail(res, "Réécriture en cours", 409);
    try {
      res.json(taleSummary(restoreScript(t.slug, Number(req.body?.index))));
    } catch (e) {
      fail(res, e, 400);
    }
  });

  app.post("/api/tales/:slug/approve", (req, res) => {
    const t = loadTale(req.params.slug);
    if (!t) return fail(res, "Story introuvable", 404);
    if (!["script", "approved", "error"].includes(t.status)) return fail(res, `Déjà en production (statut ${t.status})`, 400);
    if (busyWith(t.slug)) return fail(res, "Déjà dans la file", 409);
    if (!t.beats.some((b) => b.id === t.product.beat)) return fail(res, "Choisis le beat produit avant de valider", 400);
    patchTale(t.slug, (x) => {
      x.status = "approved";
      x.approvedAt ??= new Date().toISOString();
      x.error = null;
    });
    logEvent("info", `Stories : script validé, ${t.yt.title}`, t.id);
    void runJob(t.slug, "Production", () => produce(t.slug));
    res.json({ ok: true });
  });

  app.post("/api/tales/:slug/compose", (req, res) => {
    const t = loadTale(req.params.slug);
    if (!t) return fail(res, "Story introuvable", 404);
    if (!t.voice || !t.timeline) return fail(res, "Valide d'abord le script (voix off manquante)", 400);
    if (getState().videos[t.id]?.youtubeId) return fail(res, "Déjà envoyée sur YouTube : supprime-la de YouTube et délie-la avant de recomposer.", 400);
    if (busyWith(t.slug)) return fail(res, "Déjà dans la file", 409);
    const note = String(req.body?.note ?? "").trim();
    patchTale(t.slug, (x) => {
      x.compose = { ...x.compose, notes: [...(x.compose?.notes ?? []), ...(note ? [note] : [])] };
      x.error = null;
    });
    void runJob(t.slug, "Recomposition", () => produce(t.slug, { recompose: true }));
    res.json({ ok: true });
  });

  app.delete("/api/tales/:slug", (req, res) => {
    const t = loadTale(req.params.slug);
    if (!t) return fail(res, "Story introuvable", 404);
    if (!["idea", "script"].includes(t.status)) return fail(res, "Seules les stories au stade idée ou script se suppriment.", 400);
    if (busyWith(t.slug)) return fail(res, "Story en cours de traitement", 409);
    rmSync(join(TALES_DIR, `${t.slug}.json`), { force: true });
    rmSync(join(DRAFTS, `${t.slug}.tsx`), { force: true });
    res.json({ ok: true });
  });
}
