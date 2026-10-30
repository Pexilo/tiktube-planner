// Génère le planning de publication : Shorts quotidiens + 1 vidéo 16:9 par semaine,
// en alternant les apps et les langues pour ne jamais publier deux fois la même chose d'affilée.
import { getState, save, video } from "./state.mjs";

/** Convertit une date+heure locale d'un fuseau IANA en Date UTC (sans dépendance). */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (ts) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(ts))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ts;
  };
  let ts = guess - offset(guess);
  ts = guess - offset(ts); // 2e passe pour les changements d'heure
  return new Date(ts);
}

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay();

/**
 * Ordre des Shorts : pour chaque app, on alterne Short motion / Short narré (s1, v1, s2, v2, s3…),
 * puis on tourne app par app, FR puis EN, pour varier au maximum.
 */
function orderShorts(apps, videos) {
  const seq = (app, lang) => {
    const shorts = videos.filter((x) => x.slug === app.slug && x.lang === lang && x.kind === "short" && !x.external).sort((a, b) => a.shortIndex - b.shortIndex);
    const stories = videos.filter((x) => x.slug === app.slug && x.lang === lang && x.kind === "story").sort((a, b) => a.shortIndex - b.shortIndex);
    const out = [];
    for (let i = 0; i < Math.max(shorts.length, stories.length); i++) {
      if (shorts[i]) out.push(shorts[i]);
      if (stories[i]) out.push(stories[i]);
    }
    return out;
  };
  // Les vidéos externes forment leur propre "voie" dans la rotation → réparties tôt et entre les autres apps.
  const extLane = (app, lang) => videos.filter((x) => x.slug === app.slug && x.lang === lang && x.external && x.kind === "short").sort((a, b) => a.shortIndex - b.shortIndex);
  const keyLane = (app, lang) => videos.filter((x) => x.slug === app.slug && x.lang === lang && x.kind === "keynote" && x.format === "short").sort((a, b) => a.shortIndex - b.shortIndex);
  const lists = {};
  for (const lang of ["fr", "en"])
    for (const app of apps) {
      lists[`${app.slug}-${lang}`] = seq(app, lang);
      const e = extLane(app, lang);
      if (e.length) lists[`${app.slug}-ext-${lang}`] = e;
      const k = keyLane(app, lang);
      if (k.length) lists[`${app.slug}-key-${lang}`] = k;
    }
  const max = Math.max(...Object.values(lists).map((l) => l.length));
  const out = [];
  for (let i = 0; i < max; i++)
    for (const lang of ["fr", "en"])
      for (const app of apps)
        for (const key of [`${app.slug}-${lang}`, `${app.slug}-key-${lang}`, `${app.slug}-ext-${lang}`]) {
          const v = lists[key]?.[i];
          if (v) out.push(v);
        }
  return out;
}

/** Vidéos 16:9 : 1er tour = vidéos d'origine, 2e tour = série Keynote, 3e tour = vidéos externes. */
function orderLongs(apps, videos) {
  const out = [];
  const round = (x) => (x.external ? 2 : x.kind === "keynote" ? 1 : 0);
  for (const r of [0, 1, 2])
    for (const lang of ["fr", "en"])
      for (const app of apps)
        for (const v of videos.filter((x) => x.slug === app.slug && x.format === "long" && x.lang === lang && round(x) === r)) out.push(v);
  return out;
}

/**
 * (Re)génère le planning. Les vidéos déjà envoyées sur YouTube ou verrouillées manuellement gardent leur date.
 */
export function generateSchedule({ apps, videos }) {
  const { settings } = getState();
  const { startDate, timezone, shortTime, longTime, longWeekday } = settings;
  const perDay = Math.max(1, Number(settings.shortsPerDay) || 1);
  const fixed = (v) => getState().videos[v.id]?.youtubeId || getState().videos[v.id]?.locked;
  const minTs = Date.now() + 3 * 3600 * 1000; // au moins 3 h dans le futur
  const localDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  // Créneaux déjà pris par les vidéos envoyées / verrouillées : on ne les double pas.
  const shortsPerDayTaken = {};
  const longDaysTaken = new Set();
  for (const v of videos) {
    const at = getState().videos[v.id]?.publishAt;
    if (!fixed(v) || !at || v.kind === "tale") continue;
    if (v.format === "long") longDaysTaken.add(localDay(at));
    else shortsPerDayTaken[localDay(at)] = (shortsPerDayTaken[localDay(at)] ?? 0) + 1;
  }

  // Shorts (motion + narrés + externes) — on évite la même app deux créneaux de suite.
  const pending = orderShorts(apps, videos).filter((v) => !fixed(v));
  const ordered = [];
  let lastSlug = null;
  while (pending.length) {
    const k = pending.slice(0, 8).findIndex((v) => v.slug !== lastSlug);
    const [v] = pending.splice(k < 0 ? 0 : k, 1);
    ordered.push(v);
    lastSlug = v.slug;
  }
  let day = startDate;
  let slot = shortsPerDayTaken[day] ?? 0;
  for (const v of ordered) {
    let when;
    do {
      while (slot >= perDay) {
        slot = 0;
        day = addDays(day, 1);
        slot = shortsPerDayTaken[day] ?? 0;
      }
      // Créneau 1 = shortTime (18:00), créneau 2 = shortTime2 (12:30), au-delà : +3 h.
      const base = slot === 1 && settings.shortTime2 ? settings.shortTime2 : shortTime;
      const [h, m] = base.split(":").map(Number);
      const hour = String(Math.min(23, h + (slot >= 2 ? (slot - 1) * 3 : 0))).padStart(2, "0");
      when = zonedToUtc(day, `${hour}:${String(m).padStart(2, "0")}`, timezone);
      slot++;
    } while (when.getTime() < minTs);
    video(v.id).publishAt = when.toISOString();
  }

  // Vidéos 16:9 : une par semaine, le jour choisi
  let d = startDate;
  while (weekday(d) !== Number(longWeekday)) d = addDays(d, 1);
  for (const v of orderLongs(apps, videos)) {
    if (fixed(v)) continue;
    while (longDaysTaken.has(d)) d = addDays(d, 7);
    let when = zonedToUtc(d, longTime, timezone);
    while (when.getTime() < minTs || longDaysTaken.has(d)) {
      d = addDays(d, 7);
      when = zonedToUtc(d, longTime, timezone);
    }
    video(v.id).publishAt = when.toISOString();
    d = addDays(d, 7);
  }
  scheduleTales({ videos });
}

/**
 * Voie des stories crypto, indépendante des pubs : `talesPerDay` par jour à partir de `taleTime`
 * (créneaux suivants 4 h plus tôt), les « récentes » d'abord (événement le plus récent en tête), puis les insolites.
 * Une story a un créneau, partagé par toutes ses langues : la version anglaise (la base) et ses traductions sortent
 * à la même heure, chacune sur les comptes de sa langue.
 */
export function scheduleTales({ videos }) {
  const { settings } = getState();
  const { startDate, timezone } = settings;
  const taleTime = settings.taleTime || "20:00";
  const perDay = Math.max(1, Number(settings.talesPerDay) || 1);
  const fixed = (v) => getState().videos[v.id]?.youtubeId || getState().videos[v.id]?.locked;
  const minTs = Date.now() + 3 * 3600 * 1000;
  const localDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const st = (v) => getState().videos[v.id];
  // Une story = toutes ses langues (taleSlug) ; la vidéo de base (anglais) mène le groupe.
  const groups = new Map();
  for (const v of videos.filter((x) => x.kind === "tale")) groups.set(v.taleSlug ?? v.id, [...(groups.get(v.taleSlug ?? v.id) ?? []), v]);
  const taken = {};
  // `lead` reçoit un créneau, `rest` en prend la même heure.
  const pending = [];
  for (const g of groups.values()) {
    const loose = g.filter((v) => !fixed(v));
    // Heure déjà figée par l'une des langues (envoyée sur YouTube, ou verrouillée) : toute la story la garde.
    const at = g.map((v) => (fixed(v) ? st(v)?.publishAt : null)).find(Boolean) ?? null;
    if (at) taken[localDay(at)] = (taken[localDay(at)] ?? 0) + 1;
    if (!loose.length) continue;
    if (at && new Date(at).getTime() >= minTs) for (const v of loose) video(v.id).publishAt = at;
    // Pas d'heure, ou heure déjà passée (traduction ajoutée après la sortie) : un nouveau créneau pour les langues restantes.
    else {
      const lead = loose.find((v) => v.lang === "en") ?? loose[0];
      pending.push({ lead, rest: loose.filter((v) => v !== lead) });
    }
  }
  const rank = (v) => (v.taleType === "recent" ? 0 : 1);
  pending.sort((a, b) => rank(a.lead) - rank(b.lead) || (b.lead.eventDate ?? "").localeCompare(a.lead.eventDate ?? ""));
  const today = localDay(new Date().toISOString());
  let day = startDate > today ? startDate : today;
  let slot = taken[day] ?? 0;
  const [h, m] = taleTime.split(":").map(Number);
  for (const { lead, rest } of pending) {
    let when;
    do {
      while (slot >= perDay) {
        day = addDays(day, 1);
        slot = taken[day] ?? 0;
      }
      const hour = String(Math.max(6, h - slot * 4)).padStart(2, "0");
      when = zonedToUtc(day, `${hour}:${String(m).padStart(2, "0")}`, timezone);
      slot++;
    } while (when.getTime() < minTs);
    for (const v of [lead, ...rest]) video(v.id).publishAt = when.toISOString();
  }
  save();
}
