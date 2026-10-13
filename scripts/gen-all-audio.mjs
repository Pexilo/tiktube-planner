// Génère les SFX + toutes les musiques nécessaires au catalogue (seulement celles qui manquent).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadCatalog, ROOT } from "../shared/catalog.mjs";

export const PY = existsSync(join(ROOT, ".venv/bin/python")) ? join(ROOT, ".venv/bin/python") : "python3";
const GEN = join(ROOT, "scripts/gen-audio.py");

export function ensureMusic(m, force = false) {
  const out = join(ROOT, "public", m.file);
  if (existsSync(out) && !force) return false;
  execFileSync(PY, [GEN, "music", "--style", m.style, "--bars", String(m.bars), "--drop", String(m.drop),
    "--cta", String(m.cta), "--seed", String(m.seed), "--out", out], { stdio: "inherit" });
  return true;
}

export function ensureSfx(force = false) {
  if (existsSync(join(ROOT, "public/audio/sfx/impact.wav")) && !force) return;
  execFileSync(PY, [GEN, "sfx", "--out", join(ROOT, "public/audio/sfx")], { stdio: "inherit" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes("--force");
  ensureSfx(force);
  const seen = new Set();
  for (const v of loadCatalog().videos) {
    if (!v.music || seen.has(v.music.file)) continue;
    seen.add(v.music.file);
    ensureMusic(v.music, force);
  }
  console.log(`✓ ${seen.size} musiques prêtes`);
}
