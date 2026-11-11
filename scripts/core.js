/* Horlogia - Manhwa — moteur du temps : calendriers, groupes (une date par groupe), Play / Pause, nouveau jour, combat.
 * Tout est dans un réglage « monde » écrit par le MJ ; les joueurs calculent l'heure qui défile localement
 * (heure enregistrée + temps écoulé depuis le dernier Play, sur l'horloge du serveur). */
export const MOD = "horlogia-manhwa";
/* 1.13 — fournisseurs d'éléments pour les jours du calendrier (voir HORLOGIA.registerDayItems) */
export const DAY_PROVIDERS = new Set();
/* 1.9 — options de l'onglet Réglages (un seul réglage « monde ») */
export const OPT_DEF = { cSteps: [2, 3, 4, 5, 10, 15, 20, 30], cWarn: 10, cSound: "sounds/notify.wav", cVol: 0.9, cGlow: true, cSize: "m", cPos: "top",
  wRoll: ["standard", "severe", "environmental"], wShow: ["standard", "severe", "environmental", "fantasy", "scifi", "otherworld"], wUnit: "C", wSteps: [1, 2, 5], wTint: true, wTempP: true,
  sLvl: "m", sShow: true, sPop: true, kShift: 5, kAbbr: 100000, kSize: "m", kDefEdit: false };
export const opt = k => { let o = {}; try { o = game.settings.get(MOD, "opts") || {}; } catch (e) {} return o[k] !== undefined && o[k] !== null ? o[k] : OPT_DEF[k]; };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = () => foundry.utils.randomID(10);
export const now = () => (game.time?.serverTime ?? Date.now());

/* ── calendriers ── */
export const SEASON_TYPES = { spring: ["Printemps", "fa-seedling", "#90ee90"], summer: ["Été", "fa-sun", "#ffd23a"], autumn: ["Automne", "fa-leaf", "#ff9a3d"], winter: ["Hiver", "fa-snowflake", "#9fdcff"], "": ["Autre", "fa-circle", "#c0c8e0"] };
const MONTHS_FR = [["Janvier", 31], ["Février", 28], ["Mars", 31], ["Avril", 30], ["Mai", 31], ["Juin", 30], ["Juillet", 31], ["Août", 31], ["Septembre", 30], ["Octobre", 31], ["Novembre", 30], ["Décembre", 31]];
export function defaultCalendar() {
  return { id: "gregorien", name: "Calendrier grégorien", era: "", months: MONTHS_FR.map(([name, days]) => ({ name, days })), weekdays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
    firstWeekday: 5, hpd: 24, mph: 60, spm: 60, leapEvery: 4, leapMonth: 1,
    seasons: [{ name: "Printemps", type: "spring", month: 2, day: 20, color: "#90ee90", icon: "fa-seedling" }, { name: "Été", type: "summer", month: 5, day: 21, color: "#ffd23a", icon: "fa-sun" },
      { name: "Automne", type: "autumn", month: 8, day: 23, color: "#ff9a3d", icon: "fa-leaf" }, { name: "Hiver", type: "winter", month: 11, day: 21, color: "#9fdcff", icon: "fa-snowflake" }],
    moons: [{ name: "Lune", cycle: 29.53, offset: 0, color: "#dfe6ff" }] };
}
export const simpleCalendar = () => ({ ...defaultCalendar(), id: uid(), name: "Calendrier simple", months: Array.from({ length: 12 }, (_, i) => ({ name: `Mois ${i + 1}`, days: 30 })), leapEvery: 0, weekdays: ["Premier jour", "Deuxième jour", "Troisième jour", "Quatrième jour", "Cinquième jour", "Sixième jour", "Septième jour"] });
const secDay = c => (c.hpd || 24) * (c.mph || 60) * (c.spm || 60);
const isLeap = (c, y) => c.leapEvery > 0 && ((y % c.leapEvery) + c.leapEvery) % c.leapEvery === 0;
const monthDays = (c, y, m) => (c.months[m]?.days || 1) + (isLeap(c, y) && m === (c.leapMonth || 0) ? 1 : 0);
const yearDays = (c, y) => c.months.reduce((t, x) => t + (x.days || 1), 0) + (isLeap(c, y) ? 1 : 0);
/* jour absolu (depuis l'an 0) du 1er jour de l'année y */
function yearStart(c, y) { const base = c.months.reduce((t, x) => t + (x.days || 1), 0); if (!(c.leapEvery > 0)) return y * base; const L = c.leapEvery; const leaps = Math.floor((y - 1) / L) + 1; return y > 0 ? y * base + leaps : y * base - Math.floor(-y / L); }
/** secondes → date { y, m (0-based), d (1-based), h, mi, s, doy, dayIndex, wd } */
export function toDate(c, t) {
  const D = secDay(c); const dayIndex = Math.floor(t / D); let rem = t - dayIndex * D;
  const base = c.months.reduce((s, x) => s + (x.days || 1), 0) + (c.leapEvery > 0 ? 1 / c.leapEvery : 0);
  let y = Math.floor(dayIndex / base); while (yearStart(c, y) > dayIndex) y--; while (yearStart(c, y + 1) <= dayIndex) y++;
  let doy = dayIndex - yearStart(c, y); let m = 0; while (m < c.months.length - 1 && doy >= monthDays(c, y, m)) { doy -= monthDays(c, y, m); m++; }
  const h = Math.floor(rem / ((c.mph || 60) * (c.spm || 60))); rem -= h * (c.mph || 60) * (c.spm || 60); const mi = Math.floor(rem / (c.spm || 60)); const s = Math.floor(rem - mi * (c.spm || 60));
  const W = c.weekdays.length || 7; const wd = (((dayIndex + (c.firstWeekday || 0)) % W) + W) % W;
  return { y, m, d: doy + 1, h, mi, s, doy: dayIndex - yearStart(c, y), dayIndex, wd };
}
/** date → secondes */
export function fromDate(c, { y, m = 0, d = 1, h = 0, mi = 0, s = 0 }) {
  let day = yearStart(c, y); for (let i = 0; i < m; i++) day += monthDays(c, y, i); day += Math.max(1, Math.min(monthDays(c, y, m), d)) - 1;
  return day * secDay(c) + h * (c.mph || 60) * (c.spm || 60) + mi * (c.spm || 60) + s;
}
export const daysIn = monthDays, daysInYear = yearDays, secondsPerDay = secDay;
export function seasonOf(c, dt, g = null) { if (g && g.seasonOv != null && g.seasonOv !== "" && c.seasons?.[+g.seasonOv]) return c.seasons[+g.seasonOv];   /* saison choisie par le MJ pour ce groupe */
  const L = (c.seasons || []).filter(s => Number.isFinite(+s.month)).map(s => ({ s, k: (+s.month) * 100 + (+s.day || 1) })).sort((a, b) => a.k - b.k); if (!L.length) return null; const k = dt.m * 100 + dt.d; return (L.filter(x => x.k <= k).pop() || L[L.length - 1]).s; }
const PHASES = [["Nouvelle lune", 0], ["Premier croissant", 1], ["Premier quartier", 2], ["Gibbeuse croissante", 3], ["Pleine lune", 4], ["Gibbeuse décroissante", 5], ["Dernier quartier", 6], ["Dernier croissant", 7]];
export function moonOf(moon, dt) { const cyc = +moon.cycle || 29.53; const f = ((((dt.dayIndex + (+moon.offset || 0)) / cyc) % 1) + 1) % 1; const i = Math.round(f * 8) % 8; return { f, i, name: PHASES[i][0] }; }
export const pad = n => String(n).padStart(2, "0");

/* ── météo ── */
/* 42 météos, reprises de Calendaria : [nom, icône, icône de nuit, catégorie, couleur, t° min, t° max, chance] */
export const WEATHER_CATS = { standard: ["Standard", "fa-cloud-sun"], severe: ["Sévère", "fa-triangle-exclamation"], environmental: ["Environnement", "fa-mountain-sun"], fantasy: ["Fantasy", "fa-wand-sparkles"], scifi: ["Sci-fi", "fa-satellite"], otherworld: ["Autre monde", "fa-dungeon"] };
export const WEATHER = {
  clear: ["Dégagé", "fa-sun", "fa-moon", "standard", "#FFEE88", 18, 32, 15], "partly-cloudy": ["Partiellement nuageux", "fa-cloud-sun", "fa-cloud-moon", "standard", "#D0E8FF", 15, 28, 18],
  cloudy: ["Nuageux", "fa-cloud", "fa-cloud", "standard", "#B0C4DE", 12, 24, 14], overcast: ["Couvert", "fa-smog", "fa-smog", "standard", "#CCCCCC", 10, 20, 10],
  drizzle: ["Bruine", "fa-cloud-rain", "fa-cloud-rain", "standard", "#CDEFFF", 8, 18, 8], rain: ["Pluie", "fa-cloud-showers-heavy", "fa-cloud-showers-heavy", "standard", "#A0D8EF", 10, 22, 10],
  fog: ["Brouillard", "fa-smog", "fa-smog", "standard", "#E6E6E6", 5, 15, 5], mist: ["Brume", "fa-water", "fa-water", "standard", "#F0F8FF", 8, 18, 4],
  windy: ["Venteux", "fa-wind", "fa-wind", "standard", "#E0F7FA", 10, 25, 4], sunshower: ["Pluie ensoleillée", "fa-cloud-sun-rain", "fa-cloud-moon-rain", "standard", "#FCEABB", 15, 26, 2],
  snow: ["Neige", "fa-snowflake", "fa-snowflake", "standard", "#FFFFFF", -10, 2, 1], sleet: ["Neige fondue", "fa-cloud-rain", "fa-cloud-rain", "standard", "#C0D8E8", -2, 4, 1],
  "heat-wave": ["Canicule", "fa-temperature-arrow-up", "fa-temperature-arrow-up", "standard", "#FF9944", 35, 48, 1],
  thunderstorm: ["Orage", "fa-cloud-bolt", "fa-cloud-bolt", "severe", "#7a6ad0", 15, 28, 2], blizzard: ["Blizzard", "fa-snowflake", "fa-snowflake", "severe", "#C8DCE8", -20, -5, .5],
  hail: ["Grêle", "fa-cloud-meatball", "fa-cloud-meatball", "severe", "#D1EFFF", 5, 18, .5], tornado: ["Tornade", "fa-tornado", "fa-tornado", "severe", "#8aa070", 18, 35, .5],
  hurricane: ["Ouragan", "fa-hurricane", "fa-hurricane", "severe", "#8899aa", 22, 35, .5], "ice-storm": ["Tempête de verglas", "fa-icicles", "fa-icicles", "severe", "#A0C8E0", -10, 0, .5],
  monsoon: ["Mousson", "fa-cloud-showers-water", "fa-cloud-showers-water", "severe", "#6a9ac0", 22, 35, .5],
  ashfall: ["Pluie de cendres", "fa-volcano", "fa-volcano", "environmental", "#b07a50", 15, 40, 1.5], sandstorm: ["Tempête de sable", "fa-wind", "fa-wind", "environmental", "#C49A44", 25, 45, 1.5],
  "luminous-sky": ["Ciel lumineux (aurores)", "fa-star", "fa-star", "environmental", "#4ecb8a", -5, 10, 1.5], "sakura-bloom": ["Floraison des cerisiers", "fa-spa", "fa-spa", "environmental", "#ffb7c5", 18, 32, 1.5],
  "autumn-leaves": ["Feuilles d'automne", "fa-leaf", "fa-leaf", "environmental", "#CC7733", 5, 18, 1.5], "rolling-fog": ["Brouillard roulant", "fa-smog", "fa-smog", "environmental", "#D0D0D0", 2, 12, 1.5],
  "wildfire-smoke": ["Fumée d'incendie", "fa-fire", "fa-fire", "environmental", "#a8784e", 20, 40, 1], "dust-devil": ["Tourbillon de poussière", "fa-wind", "fa-wind", "environmental", "#C8A060", 28, 45, 1],
  "black-sun": ["Soleil noir", "fa-circle", "fa-circle", "fantasy", "#6a4a8a", 5, 20, .5], "ley-surge": ["Déferlante tellurique", "fa-wand-sparkles", "fa-wand-sparkles", "fantasy", "#3A9BDC", 10, 25, 0],
  "aether-haze": ["Brume d'éther", "fa-smog", "fa-smog", "fantasy", "#a46bc6", 12, 22, 0], nullfront: ["Front du néant", "fa-ban", "fa-ban", "fantasy", "#8a7a9a", 0, 15, 0],
  "permafrost-surge": ["Vague de permafrost", "fa-icicles", "fa-icicles", "fantasy", "#A8D8EA", -30, -10, 0], gravewind: ["Vent des tombes", "fa-ghost", "fa-ghost", "fantasy", "#6a9a7a", 5, 18, 0],
  veilfall: ["Chute du voile", "fa-droplet", "fa-droplet", "fantasy", "#8a7abe", 8, 20, 0], "arcane-winds": ["Vents arcaniques", "fa-hat-wizard", "fa-hat-wizard", "fantasy", "#b070d8", 15, 28, 0],
  "acid-rain": ["Pluie acide", "fa-flask", "fa-flask", "fantasy", "#55BB33", 10, 25, 0], "blood-rain": ["Pluie de sang", "fa-droplet", "fa-droplet", "fantasy", "#c02040", 12, 28, 0],
  "meteor-shower": ["Pluie de météores", "fa-meteor", "fa-meteor", "fantasy", "#FF6622", 10, 30, 0], "spore-cloud": ["Nuage de spores", "fa-disease", "fa-disease", "fantasy", "#88AA44", 15, 28, 0],
  "divine-light": ["Lumière divine", "fa-sun", "fa-sun", "fantasy", "#FFD700", 18, 30, 0], "plague-miasma": ["Miasme de peste", "fa-biohazard", "fa-biohazard", "fantasy", "#7a9a4a", 10, 22, 0],
  /* 1.8 : sci-fi et autre monde (jamais tirées au hasard) */
  "ion-storm": ["Tempête ionique", "fa-bolt-lightning", "fa-bolt-lightning", "scifi", "#5ee0ff", 5, 25, 0], "rad-rain": ["Pluie radioactive", "fa-radiation", "fa-radiation", "scifi", "#b6ff3d", 10, 30, 0],
  "nanite-fog": ["Brouillard de nanites", "fa-microchip", "fa-microchip", "scifi", "#9fb0d4", 5, 20, 0], "solar-flare": ["Éruption solaire", "fa-sun", "fa-sun", "scifi", "#ff8a3d", 30, 55, 0],
  "mag-storm": ["Tempête magnétique", "fa-magnet", "fa-magnet", "scifi", "#c46bff", 0, 20, 0], smog: ["Smog industriel", "fa-industry", "fa-industry", "scifi", "#a8946a", 12, 30, 0],
  "solar-wind": ["Vent solaire", "fa-wind", "fa-wind", "scifi", "#ffd36b", 20, 40, 0], "synth-aurora": ["Aurore synthétique", "fa-wave-square", "fa-wave-square", "scifi", "#3dffb0", -5, 15, 0],
  "debris-rain": ["Pluie de débris orbitaux", "fa-satellite", "fa-satellite", "scifi", "#ff6a5a", 5, 30, 0], "dome-failure": ["Panne de dôme", "fa-power-off", "fa-power-off", "scifi", "#ff3d5a", -20, 10, 0],
  "blood-moon": ["Lune de sang", "fa-moon", "fa-moon", "otherworld", "#e0304a", 5, 18, 0], "black-snow": ["Neige noire", "fa-snowflake", "fa-snowflake", "otherworld", "#8a8aa8", -15, 0, 0],
  "crystal-rain": ["Pluie de cristaux", "fa-gem", "fa-gem", "otherworld", "#9fe8ff", 0, 15, 0], "shattered-sky": ["Ciel fracturé", "fa-burst", "fa-burst", "otherworld", "#d08aff", 5, 25, 0],
  "spirit-mist": ["Brume des esprits", "fa-ghost", "fa-ghost", "otherworld", "#bfe0e8", 2, 14, 0], "star-rain": ["Pluie d'étoiles", "fa-star", "fa-star", "otherworld", "#fff2a0", 8, 20, 0],
  "void-wind": ["Vent du vide", "fa-circle-half-stroke", "fa-circle-half-stroke", "otherworld", "#7a6aa8", -10, 5, 0], "inverted-sky": ["Ciel inversé", "fa-arrows-up-down", "fa-arrows-up-down", "otherworld", "#6ab0ff", 10, 22, 0],
  "dream-fog": ["Brouillard onirique", "fa-cloud", "fa-cloud", "otherworld", "#e0a8ff", 8, 18, 0], "otherworld-aurora": ["Aurore d'outre-monde", "fa-wand-magic-sparkles", "fa-wand-magic-sparkles", "otherworld", "#4ae0c0", -5, 12, 0]
};
/* anciens identifiants (1.0) → nouveaux */
const W_ALIAS = { storm: "thunderstorm", wind: "windy", heat: "heat-wave", sand: "sandstorm", aurora: "luminous-sky", "partly_cloudy": "partly-cloudy" };
export const weatherKey = k => WEATHER[k] ? k : (W_ALIAS[k] && WEATHER[W_ALIAS[k]] ? W_ALIAS[k] : "clear");
export const weatherOf = k => WEATHER[weatherKey(k)];
/* tirage selon la saison : poids des météos dont la plage de t° recoupe celle de la saison (comme Calendaria) */
const CLIMATE = { spring: [8, 20, { "sakura-bloom": 3, drizzle: 6, sunshower: 4 }], summer: [18, 34, { "heat-wave": 3, thunderstorm: 4 }], autumn: [5, 17, { "autumn-leaves": 5, fog: 6, "rolling-fog": 3, windy: 6 }], winter: [-8, 6, { snow: 14, sleet: 5, blizzard: 2, "ice-storm": 1 }], "": [5, 22, {}] };
export function rollWeather(type = "") { const [lo, hi, bonus] = CLIMATE[seasonKey({ type })] || CLIMATE[""]; const cats = new Set(opt("wRoll") || []); let pool = Object.entries(WEATHER).filter(([k, w]) => cats.has(w[3]) && w[6] >= lo && w[5] <= hi).map(([k, w]) => [k, Math.max((w[7] || 0) + (bonus[k] || 0), ["fantasy", "scifi", "otherworld"].includes(w[3]) ? .6 : 0)]).filter(x => x[1] > 0);
  if (!pool.length) pool = [["clear", 1]];
  const tot = pool.reduce((a, x) => a + x[1], 0); let r = Math.random() * tot, kind = "clear"; for (const [k, w] of pool) { if ((r -= w) <= 0) { kind = k; break; } }
  const W = WEATHER[kind]; const a = Math.max(lo, W[5]), b = Math.min(hi, W[6]); return { kind, temp: Math.round(a + Math.random() * Math.max(0, b - a)) }; }
/* clé de saison normalisée : spring / summer / autumn / winter / "" */
export function seasonKey(se) { const t = String(se?.type || "").toLowerCase(); if (["spring", "summer", "autumn", "winter"].includes(t)) return t; if (t === "fall") return "autumn";
  const n = String(se?.name || "").toLowerCase(); if (/print|spring|vern/.test(n)) return "spring"; if (/été|ete|summer|estiv/.test(n)) return "summer"; if (/autom|fall|autumn/.test(n)) return "autumn"; if (/hiver|winter|hivern/.test(n)) return "winter"; return ""; }

/* ── état (réglage monde) ── */
export function defaultState() { const c = defaultCalendar(); return { v: 1, calendars: [c], groups: [{ id: "monde", name: "Monde", color: "#5ee0ff", cal: c.id, t: fromDate(c, { y: 1866, m: 0, d: 1, h: 8 }), run: true, weather: { kind: "clear", temp: 12 }, party: "", actors: [], feeds: false, def: true }],
  events: [], play: false, stamp: 0, rate: 1, ref: "monde", combats: {} }; }
/* 1.7 : un chrono de combat par groupe (S.combats[id du groupe]) ; S.combat = celui du groupe affiché (lecture seule, non enregistré) */
export const state = () => { const s = foundry.utils.deepClone(game.settings.get(MOD, "state") || {}); if (!s.calendars?.length) return defaultState(); s.events ||= []; s.groups ||= []; s.rate ||= 1;
  if (!s.combats || typeof s.combats !== "object") s.combats = {}; if (s.combat?.g) s.combats[s.combat.g] ||= s.combat; delete s.combat;
  for (const k of Object.keys(s.combats)) if (!s.combats[k] || !s.groups.some(g => g.id === k)) delete s.combats[k];
  Object.defineProperty(s, "combat", { enumerable: false, configurable: true, get() { const g = groupForUser(s); return g ? (s.combats[g.id] ? { ...s.combats[g.id], g: g.id } : null) : null; } });
  return s; };
export const combatOf = (S, gid) => S.combats?.[gid] || null;
export const calOf = (S, g) => S.calendars.find(c => c.id === g?.cal) || S.calendars[0];
let LOCK = Promise.resolve();
/** modifie l'état (MJ seulement), en enchaînant les écritures */
export async function edit(fn) { if (!game.user.isGM) return; const run = async () => { const S = state(); commit(S); if (fn(S) === false) return; S.stamp = now(); await game.settings.set(MOD, "state", S); }; LOCK = LOCK.then(run, run); return LOCK; }
/* reporte le temps écoulé depuis le dernier Play dans t (avant toute écriture) */
/* 1.5 : le groupe en combat avance en même temps que le chrono de combat (temps réel), et s'arrête quand le chrono est en pause */
/* 1.12 : tous les groupes avancent avec ▶ Lecture (plus d'interrupteur par groupe).
 * Le chrono de combat est toujours indépendant de Play / Pause et de la pause de la partie : il a sa propre mesure (c.st = début de la course).
 * 1.12.2 : le chrono de combat n'a plus aucun effet sur l'heure du groupe (horloge de base) : elle suit seulement ▶ Lecture. */
const advOf = (S, g, real) => real * (S.rate || 1);
function commit(S) { if (!S.play || !S.stamp) return; const real = Math.max(0, (now() - S.stamp) / 1000); for (const g of S.groups) g.t += advOf(S, g, real); S.stamp = now(); }
const runPart = c => (c && c.run && c.st ? Math.max(0, (now() - c.st) / 1000) : 0);
/** secondes actuelles d'un groupe (avec le temps qui défile) */
export function timeOf(S, g) { let t = g.t; if (S.play && S.stamp) t += advOf(S, g, Math.max(0, (now() - S.stamp) / 1000)); return t; }
const cOf = (S, gid) => gid ? S.combats?.[gid] : S.combat;
export function combatLeft(S, gid) { const c = cOf(S, gid); if (!c || !(+c.dur > 0)) return null; return Math.max(0, +c.dur - combatElapsed(S, gid)); }
export function combatElapsed(S, gid) { const c = cOf(S, gid); if (!c) return 0; return (c.acc || 0) + runPart(c); }
export const combatRunning = (S, c) => !!(c && c.run);
/** reporte la course en cours du chrono dans c.acc (et dans l'heure du groupe si elle suit le chrono), puis relance la mesure */
export function foldCombat(S, gid) { const c = S.combats?.[gid]; if (!c) return; if (c.run && c.st) { const d = Math.max(0, (now() - c.st) / 1000); c.acc = (c.acc || 0) + d; } c.st = c.run ? now() : 0; }
/* membres d'un groupe : groupe du Menu lié + personnages ajoutés */
export const userChars = u => game.actors.filter(a => a.type === "character" && a.testUserPermission(u, "OWNER")).map(a => a.uuid);
/* 1.3 — les groupes sont les Groupes MJ de la Fiche Manhwa (une seule liste) ; Horlogia garde le temps, le calendrier, la météo et le thème de chacun */
export const gmShared = () => { try { return !!globalThis.MANHWA?.gmGroups && !!game.settings.get("manhwa-sheet", "gmGroupsMig"); } catch (e) { return false; } };
export const gmGroupOf = g => gmShared() && g && !g.def ? globalThis.MANHWA.gmGroups.get(g.id) : null;
export function membersOf(g) { const gg = gmGroupOf(g); if (gg) return globalThis.MANHWA.gmGroups.members(gg); return membersOf0(g); }
function membersOf0(g) { const out = new Set(g.actors || []); for (const id of g.users || []) { const u = game.users.get(id); if (u && !u.isGM) for (const x of userChars(u)) out.add(x); } if (g.party) { try { const p = (globalThis.MANHWA?.parties?.() || []).find(x => x.id === g.party); for (const m of p?.members || []) out.add(m.uuid); } catch (e) {} } return [...out]; }
/** groupe d'un utilisateur (son personnage) ; MJ : groupe affiché choisi */
export function groupForUser(S, user = game.user) { if (user.isGM) { const k = game.user.getFlag(MOD, "view"); return S.groups.find(g => g.id === k) || S.groups.find(g => g.id === S.ref) || S.groups[0]; }
  const chars = [user.character, ...game.actors.filter(a => a.type === "character" && a.testUserPermission(user, "OWNER"))].filter(Boolean).map(a => a.uuid);
  if (gmShared()) { const mine = globalThis.MANHWA.gmGroups.ofUser(user).map(x => x.id); return S.groups.find(g => !g.def && mine.includes(g.id)) || S.groups.find(g => g.def) || S.groups[0]; }
  return S.groups.find(g => !g.def && (g.users || []).includes(user.id)) || S.groups.find(g => !g.def && membersOf(g).some(u => chars.includes(u))) || S.groups.find(g => g.def) || S.groups[0]; }
export const groupForActor = (S, a) => S.groups.find(g => !g.def && membersOf(g).includes(a?.uuid)) || S.groups.find(g => g.def) || S.groups[0];
/* fêtes / événements d'un groupe sur un jour (y, m, d) */
export function eventsOn(S, g, y, m, d) { const c = calOf(S, g); const day = fromDate(c, { y, m, d }) / secondsPerDay(c);
  return S.events.filter(e => (e.cal || c.id) === c.id && (!e.groups?.length || e.groups.includes(g.id)) && (game.user.isGM || !e.hidden) && (() => { const ey = e.y == null || e.y === "" ? y : +e.y; let st = fromDate(c, { y: ey, m: +e.m, d: +e.d }) / secondsPerDay(c); const dur = Math.max(1, +e.dur || 1);
    if (day >= st && day < st + dur) return true; if (e.y == null || e.y === "") { st = fromDate(c, { y: ey - 1, m: +e.m, d: +e.d }) / secondsPerDay(c); return day >= st && day < st + dur; } return false; })()); }
export const fmtDate = (c, dt, long = true) => `${long ? `${c.weekdays[dt.wd] || ""} ` : ""}${dt.d} ${c.months[dt.m]?.name || ""} ${dt.y}${long && c.era ? ` ${c.era}` : ""}`.trim();
export const fmtTime = (dt, sec = true) => `${pad(dt.h)}:${pad(dt.mi)}${sec ? `:${pad(dt.s)}` : ""}`;
export function fmtDur(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; }

/* ── thèmes (un par groupe) ── */
export const THEMES = {
  spatial: { name: "Spatial", icon: "fa-rocket", base: "spatial" },
  "spatial-deep": { name: "Spatial profond — nébuleuse", icon: "fa-meteor", base: "spatial" },
  verre: { name: "Verre optique", icon: "fa-gem", base: "spatial" },
  cyberpunk: { name: "Cyberpunk — néon", icon: "fa-microchip", base: "spatial" },
  parchemin: { name: "Fantasy — parchemin et encre", icon: "fa-feather-pointed", base: "parchemin" },
  "parchemin-dark": { name: "Fantasy sombre — cuir et encre d'or", icon: "fa-book-skull", base: "parchemin" },
  steampunk: { name: "Steampunk — machine à écrire", icon: "fa-gears", base: "steampunk" },
  "steampunk-dark": { name: "Steampunk sombre — tubes Nixie", icon: "fa-lightbulb", base: "steampunk" }
};
/* thème d'un groupe : le sien, sinon le thème par défaut du MJ (Réglages) */
export const defaultTheme = () => { try { const t = game.settings.get(MOD, "themeDefault"); return THEMES[t] ? t : "spatial"; } catch (e) { return "spatial"; } };
export const themeOf = g => (g && THEMES[g.theme]) ? g.theme : defaultTheme();
/** classes CSS d'un thème : celle de sa famille (spatial / parchemin / steampunk) + la sienne pour les variantes */
export const thClasses = g => { const t = themeOf(g); const b = THEMES[t].base; return b === t ? [`hz-th-${t}`] : [`hz-th-${b}`, `hz-th-${t}`]; };
export const thCls = g => thClasses(g).join(" ");
export function setTheme(el, g) { if (!el) return; const on = new Set(thClasses(g)); for (const k of Object.keys(THEMES)) el.classList.toggle(`hz-th-${k}`, on.has(`hz-th-${k}`)); }
export const digits = s => String(s).split("").map(ch => /\d/.test(ch) ? `<em>${ch}</em>` : `<u>${ch}</u>`).join("");

/* 1.7 — nombres des compteurs : en entier jusqu'à 100 000, puis 150K, 1,2M, 3,4Md */
export function fmtNum(n) { n = Math.round(+n || 0); const a = Math.abs(n), sg = n < 0 ? "−" : ""; const f = (v, u) => `${sg}${(Math.floor(v * 10) / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${u}`;
  if (a <= (+opt("kAbbr") || 100000)) return `${sg}${a.toLocaleString("fr-FR")}`; if (a < 1e6) return f(a / 1e3, "K"); if (a < 1e9) return f(a / 1e6, "M"); return f(a / 1e9, "Md"); }

/* 1.9 — température affichée (stockée en °C) */
export const tShow = c => { if (!Number.isFinite(+c)) return null; return opt("wUnit") === "F" ? Math.round(+c * 9 / 5 + 32) : Math.round(+c); };
export const tUnit = () => opt("wUnit") === "F" ? "°F" : "°C";
export const tFromShown = v => opt("wUnit") === "F" ? Math.round(((+v - 32) * 5 / 9) * 10) / 10 : Math.round(+v);
