// Voix off ElevenLabs (facultatif) : remplace la voix du système pour les Shorts narrés.
// Config locale : data/elevenlabs.json (clé d'API, voix FR / EN, modèle, style) — jamais versionnée.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./catalog.mjs";

// ELEVENLABS_API : autre serveur (ex. https://api.eu.residency.elevenlabs.io pour la résidence des données en UE).
const API = process.env.ELEVENLABS_API ?? "https://api.elevenlabs.io";
const FILE = join(ROOT, "data", "elevenlabs.json");
export const DEFAULT_MODEL = "eleven_multilingual_v2";

/** Réglages de voix : plus la stabilité est basse et le style haut, plus la lecture est expressive. */
export const PRESETS = {
  natural: { stability: 0.55, similarity_boost: 0.8, style: 0.15, speed: 1.0 },
  punchy: { stability: 0.38, similarity_boost: 0.8, style: 0.45, speed: 1.07 },
  hype: { stability: 0.25, similarity_boost: 0.75, style: 0.7, speed: 1.12 },
};

export const readConfig = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {});
export function writeConfig(patch) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  const c = { ...readConfig(), ...patch };
  writeFileSync(FILE, JSON.stringify(c, null, 2), { mode: 0o600 });
  return c;
}

/** Voix ElevenLabs choisie pour `lang`, ou null (→ voix du système). */
export function voiceFor(lang) {
  const c = readConfig();
  const v = c.voices?.[lang];
  if (!c.apiKey || !v?.id) return null;
  const model = c.model ?? DEFAULT_MODEL;
  const settings = PRESETS[c.preset] ?? PRESETS.punchy;
  return { id: v.id, name: v.name, model, settings, sig: `elevenlabs:${v.id}:${model}:${c.preset ?? "punchy"}` };
}

export function status() {
  const c = readConfig();
  return { hasKey: !!c.apiKey, keyHint: c.apiKey ? `${c.apiKey.slice(0, 5)}…${c.apiKey.slice(-3)}` : null, model: c.model ?? DEFAULT_MODEL, preset: c.preset ?? "punchy", voices: c.voices ?? {} };
}

async function call(path, { key = readConfig().apiKey, method = "GET", body } = {}) {
  if (!key) throw new Error("Clé ElevenLabs manquante");
  const r = await fetch(`${API}${path}`, { method, headers: { "xi-api-key": key, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const d = j.detail;
    const why = typeof d === "string" ? d : d?.message ?? (Array.isArray(d) ? d.map((x) => x.msg).join(", ") : "");
    throw new Error(`ElevenLabs ${r.status}${why ? ` : ${why}` : ""}`);
  }
  return r.json();
}

/** Vérifie une clé ; renvoie le forfait si la clé a le droit de le lire (une clé restreinte peut ne pas l'avoir). */
export async function checkKey(key) {
  await call("/v2/voices?page_size=1&include_total_count=false", { key });
  const sub = await call("/v1/user/subscription", { key }).catch(() => null);
  return sub ? { tier: sub.tier, used: sub.character_count, limit: sub.character_limit, resetAt: sub.next_character_count_reset_unix } : null;
}

/** Voix de « My Voices » (voix par défaut + celles ajoutées depuis la Voice Library). */
export async function listVoices() {
  const out = [];
  let token = null;
  for (let page = 0; page < 10; page++) {
    const j = await call(`/v2/voices?page_size=100&include_total_count=false&sort=name${token ? `&next_page_token=${encodeURIComponent(token)}` : ""}`);
    for (const v of j.voices ?? []) {
      const l = v.labels ?? {};
      out.push({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        desc: [l.gender, l.age, l.accent, l.descriptive ?? l.description, l.use_case].filter(Boolean).join(" · "),
        langs: [...new Set((v.verified_languages ?? []).map((x) => x.language))],
        preview: v.preview_url,
        previews: Object.fromEntries((v.verified_languages ?? []).filter((x) => x.preview_url).map((x) => [x.language, x.preview_url])),
      });
    }
    if (!j.has_more || !j.next_page_token) break;
    token = j.next_page_token;
  }
  return out;
}

/** ID d'une voix à partir de son lien (elevenlabs.io/voices/<id>, …/voice-library?voiceId=<id>) ou de l'ID seul. */
export const voiceIdFrom = (input) => String(input ?? "").trim().match(/([A-Za-z0-9]{20})(?=$|[/?#&])/)?.[1] ?? null;

/**
 * Ajoute une voix de la Voice Library à « My Voices » (il faut l'y ajouter pour l'utiliser via l'API).
 * L'ajout demande le droit Voices en écriture sur la clé. Renvoie la voix telle que listVoices() la décrit.
 */
export async function addLibraryVoice(input) {
  const id = voiceIdFrom(input);
  if (!id) throw new Error("Lien ou ID de voix invalide");
  const already = (await listVoices()).find((v) => v.id === id);
  if (already) return already;
  // L'auteur public de la voix est requis pour l'ajouter : on le lit sur la voix, sinon dans la Voice Library.
  const direct = await call(`/v1/voices/${id}`).catch(() => null);
  let owner = direct?.sharing?.public_owner_id;
  let name = direct?.name;
  if (!owner) {
    const j = await call(`/v1/shared-voices?search=${encodeURIComponent(id)}&page_size=100`).catch(() => null);
    const v = j?.voices?.find((x) => x.voice_id === id);
    owner = v?.public_owner_id;
    name = v?.name;
  }
  if (!owner) throw new Error("Voix introuvable dans la Voice Library : ajoute-la depuis sa page sur elevenlabs.io (« Add to my voices »), puis recharge la liste");
  const added = await call(`/v1/voices/add/${encodeURIComponent(owner)}/${encodeURIComponent(id)}`, { method: "POST", body: { new_name: name ?? id } });
  const newId = added.voice_id ?? id;
  return (await listVoices()).find((v) => v.id === newId) ?? { id: newId, name: name ?? newId, langs: [], previews: {} };
}

export async function listModels() {
  const j = await call("/v1/models");
  return j
    .filter((m) => m.can_do_text_to_speech)
    .map((m) => ({ id: m.model_id, name: m.name, fr: (m.languages ?? []).some((l) => l.language_id === "fr"), maxChars: m.max_characters_request_subscribed_user ?? null }));
}

/**
 * Lit `text` : { audio (mp3), words: [{ w, s, e }] | null }. Les mots viennent de l'alignement caractère par caractère
 * renvoyé par l'API ; si le modèle n'en fournit pas, words = null (le script estime alors les temps).
 */
export async function synthesize(voice, lang, text, { previous, next } = {}) {
  const body = {
    text,
    model_id: voice.model,
    voice_settings: { ...voice.settings, use_speaker_boost: true },
    ...(voice.model === "eleven_multilingual_v2" ? {} : { language_code: lang }),
    ...(previous ? { previous_text: previous } : {}),
    ...(next ? { next_text: next } : {}),
  };
  const j = await call(`/v1/text-to-speech/${encodeURIComponent(voice.id)}/with-timestamps?output_format=mp3_44100_128`, { method: "POST", body });
  return { audio: Buffer.from(j.audio_base64, "base64"), words: wordsFrom(text, j.alignment) };
}

export const DEFAULT_MUSIC_MODEL = "music_v2_5";

/** Musique ElevenLabs : active dès qu'une clé est enregistrée (désactivable avec "music": false dans data/elevenlabs.json). */
export function musicConfig() {
  const c = readConfig();
  if (!c.apiKey || c.music === false) return null;
  return { model: c.musicModel ?? DEFAULT_MUSIC_MODEL };
}

/** Compose un morceau à partir d'un plan de composition (sections aux durées imposées) : renvoie le mp3. */
export async function composeMusic(model, plan, seed) {
  const key = readConfig().apiKey;
  if (!key) throw new Error("Clé ElevenLabs manquante");
  const r = await fetch(`${API}/v1/music?output_format=mp3_48000_192`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ model_id: model, composition_plan: plan, seed }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const d = j.detail;
    const why = typeof d === "string" ? d : d?.message ?? (Array.isArray(d) ? d.map((x) => x.msg).join(", ") : "");
    throw new Error(`ElevenLabs Music ${r.status}${why ? ` : ${why}` : ""}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

/** Regroupe l'alignement par caractère en mots (séparés par les espaces du texte d'origine). */
function wordsFrom(text, a) {
  if (!a?.characters?.length) return null;
  const words = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    const s = a.character_start_times_seconds[i];
    const e = a.character_end_times_seconds[i];
    if (!cur) cur = { w: "", s, e };
    cur.w += ch;
    cur.e = e;
  });
  if (cur) words.push(cur);
  // Garde-fou : l'alignement doit couvrir les mots du texte, sinon on laisse le script estimer.
  return words.length === text.split(/\s+/).filter(Boolean).length ? words : null;
}
