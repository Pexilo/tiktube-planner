// Ce qui diffère entre macOS et Windows : ouvrir un fichier, presse-papiers, notifications,
// OCR, voix de synthèse, Python, Claude Code. Sur Windows, tools/win.ps1 joue le rôle des outils macOS.
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { ROOT } from "./catalog.mjs";

export const IS_WIN = process.platform === "win32";
const run = promisify(execFile);
const WIN_PS = join(ROOT, "tools/win.ps1");
const ps = (args, opts = {}) => run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", WIN_PS, ...args], { maxBuffer: 64 * 1024 * 1024, windowsHide: true, ...opts });

/** `if (isMain(import.meta.url))` : vrai quand le script est lancé directement (`node scripts/x.mjs`). */
export const isMain = (metaUrl) => !!process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;

/** Une commande est-elle disponible dans le PATH ? */
export function has(cmd) {
  try {
    if (IS_WIN) execFileSync("where.exe", [cmd], { stdio: "ignore", windowsHide: true });
    else execFileSync("/bin/sh", ["-c", `command -v ${cmd}`], { stdio: "ignore", env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin` } });
    return true;
  } catch {
    return false;
  }
}

/** Ouvre une URL, un fichier ou un dossier avec l'application par défaut. */
export function openPath(target) {
  if (IS_WIN) spawn("cmd.exe", ["/c", "start", "", target], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  else execFile("open", [target]);
}

/** Montre le fichier dans le Finder / l'Explorateur. */
export function revealPath(file) {
  if (IS_WIN) execFile("explorer.exe", [`/select,${file}`]);
  else execFile("open", ["-R", file]);
}

export function copyToClipboard(text) {
  try {
    const p = IS_WIN ? spawn("powershell.exe", ["-NoProfile", "-Command", "$input | Set-Clipboard"], { windowsHide: true }) : spawn("pbcopy");
    p.stdin.end(text);
  } catch {}
}

export function notify(title, message) {
  if (IS_WIN) ps(["notify", title, message]).catch(() => {});
  else run("osascript", ["-e", `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} sound name "Glass"`]).catch(() => {});
}

/** Lance `npx …` (npx.cmd sur Windows, qui ne s'exécute qu'à travers cmd.exe). */
export const spawnNpx = (args, opts) => (IS_WIN ? spawn("cmd.exe", ["/d", "/c", "npx", ...args], { windowsHide: true, ...opts }) : spawn("npx", args, opts));

/* ------------------------------------------------------------------ Python */

export const PY = IS_WIN
  ? existsSync(join(ROOT, ".venv/Scripts/python.exe")) ? join(ROOT, ".venv/Scripts/python.exe") : "python"
  : existsSync(join(ROOT, ".venv/bin/python")) ? join(ROOT, ".venv/bin/python") : "python3";
export const hasVenv = () => existsSync(join(ROOT, IS_WIN ? ".venv/Scripts/python.exe" : ".venv/bin/python"));

/* ------------------------------------------------------------------ Claude Code */

const CLAUDE = IS_WIN
  ? [join(homedir(), ".local/bin/claude.exe"), join(process.env.APPDATA ?? "", "npm/claude.cmd")].find(existsSync) ?? "claude"
  : [join(homedir(), ".local/bin/claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"].find(existsSync) ?? "claude";

/** `claude -p …` avec le prompt sur stdin. Sur Windows, un .cmd ne se lance qu'à travers cmd.exe. */
export function execClaude(args, opts, cb) {
  if (IS_WIN && !CLAUDE.endsWith(".exe")) return execFile("cmd.exe", ["/d", "/c", CLAUDE, ...args], { ...opts, windowsHide: true }, cb);
  return execFile(CLAUDE, args, { ...opts, windowsHide: true }, cb);
}

/* ------------------------------------------------------------------ OCR */

const OCR_BIN = join(ROOT, "tools/ocr");

/** Devine fr/en sur le texte reconnu (Windows ne détecte pas la langue comme NaturalLanguage). */
function guessLang(text) {
  const w = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z']+/);
  const fr = new Set("le la les des une un du et est pour pas que qui sur avec dans ton ta tes mon ma mes ce cette ces mais ou au aux par tu je il elle nous vous c'est".split(" "));
  const en = new Set("the and for you your with this that are from have just not but all can its our what how is it to of in on my me we they".split(" "));
  let f = 0;
  let e = 0;
  for (const x of w) {
    if (fr.has(x)) f++;
    if (en.has(x)) e++;
  }
  return f === e ? "" : f > e ? "fr" : "en";
}

/** Texte de chaque image : [{ path, text, lang }]. Vision (macOS) ou Windows.Media.Ocr. */
export async function ocrImages(paths) {
  const out = [];
  if (!IS_WIN && !existsSync(OCR_BIN)) await run("swiftc", ["-O", "-o", OCR_BIN, join(ROOT, "tools/ocr.swift")]);
  for (let i = 0; i < paths.length; i += 40) {
    const batch = paths.slice(i, i + 40);
    const { stdout } = IS_WIN ? await ps(["ocr", ...batch]) : await run(OCR_BIN, batch, { maxBuffer: 64 * 1024 * 1024 });
    out.push(...JSON.parse(stdout).map((r) => (r.lang ? r : { ...r, lang: guessLang(r.text) })));
  }
  return out;
}
export const hasOcr = () => (IS_WIN ? true : existsSync(OCR_BIN) || has("swiftc"));

/* ------------------------------------------------------------------ Voix */

/** Voix installées : [{ name, locale: "fr_FR" }]. */
export function installedVoices() {
  if (IS_WIN) {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", WIN_PS, "voices"], { encoding: "utf8", windowsHide: true });
    return JSON.parse(out).map((v) => ({ name: v.name, locale: v.lang.replace("-", "_") }));
  }
  return execFileSync("say", ["-v", "?"], { encoding: "utf8" })
    .split("\n")
    .map((l) => l.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/))
    .filter(Boolean)
    .map((m) => ({ name: m[1].trim(), locale: m[2] }));
}
export const hasVoices = () => (IS_WIN ? true : has("say"));

/** Lit `text` avec `voice` dans un fichier audio (aiff sur macOS, wav sur Windows) ; `rate` en mots/min façon `say`. */
export function speakToFile(voice, rate, text, out) {
  if (!IS_WIN) return execFileSync("say", ["-v", voice, "-r", String(rate), "-o", out, text]);
  const dir = mkdtempSync(join(tmpdir(), "studio-voice-"));
  try {
    const txt = join(dir, "text.txt");
    writeFileSync(txt, text, "utf8");
    // `say` parle à ~175 mots/min par défaut ; WinRT prend un multiplicateur (1 = normal).
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", WIN_PS, "speak", voice, (rate / 175).toFixed(2), out, txt], { windowsHide: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
