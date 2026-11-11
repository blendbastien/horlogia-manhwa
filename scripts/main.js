/* Horlogia - Manhwa — point d'entrée : réglages, API (globalThis.HORLOGIA), Play / Pause calé sur la pause de Foundry,
 * détection des nouveaux jours (hook « horlogiaNewDay » toujours ; « manhwaNewDay » seulement pour les groupes
 * qui « font avancer les modules », désactivé par défaut), sauvegarde régulière pendant le Play. */
import { MOD, now, state, edit, defaultState, calOf, toDate, fromDate, timeOf, seasonOf, eventsOn, weatherOf, daysIn, membersOf, groupForUser, groupForActor, secondsPerDay, rollWeather, combatElapsed, fmtDate, fmtTime, gmShared } from "./core.js";
import { renderHud, startTick } from "./hud.js";
import { renderCombat, startCombat, endCombat, toggleCombat } from "./combat.js";
import { HorlogiaApp } from "./app.js";
import { DAY_PROVIDERS } from "./core.js";
import { renderCounters, toggleCnt, onSocket, openCats, renderCats, migrateCnt } from "./counters.js";

const isLeadGM = () => game.user.isGM && (game.users.activeGM ?? game.users.find(u => u.isGM && u.active))?.id === game.user.id;
const setting = (k, d) => { try { return game.settings.get(MOD, k); } catch (e) { return d; } };

Hooks.once("init", () => {
  const W = (k, o) => game.settings.register(MOD, k, { scope: "world", ...o });
  W("state", { config: false, type: Object, default: {}, onChange: () => { renderHud(); renderCombat(); renderCounters(); refreshApps(); checkDays(); Hooks.callAll("horlogiaChange", state()); } });
  W("hudPlayers", { name: "Barre du haut visible des joueurs", hint: "Date, heure, saison, météo et fêtes de leur groupe.", config: true, type: Boolean, default: true, onChange: () => renderHud() });
  W("seasonFx", { name: "Effet de saison sur la barre du haut", hint: "Neige, feuilles, soleil… derrière la date et l'heure.", config: true, type: Boolean, default: true, onChange: () => renderHud() });
  W("round", { name: "Durée d'un tour de combat (secondes)", config: true, type: Number, default: 6 });
  W("themeDefault", { config: false, type: String, default: "spatial", onChange: () => { renderHud(); renderCombat(); refreshApps(); } });
  W("combatAll", { config: false, type: Boolean, default: false });   /* 1.7 : retiré — chaque groupe voit toujours son chrono */
  W("counters", { config: false, type: Object, default: {}, onChange: () => { renderCounters(); renderHud(); } });
  W("opts", { config: false, type: Object, default: {}, onChange: () => { renderHud(); renderCombat(); renderCounters(); refreshApps(); } });
  W("cntCats", { config: false, type: Object, default: {}, onChange: () => { renderCounters(); renderCats(); } });
  const Cl = (k, type, d) => game.settings.register(MOD, k, { scope: "client", config: false, type, default: d });
  Cl("cntGm", Boolean, false); Cl("cntClosed", Object, {}); Cl("cntMin", Boolean, false); Cl("cntPos", Object, null); Cl("combatPos", Object, null);
  game.settings.register(MOD, "playPos", { name: "Bouton Play / Pause de l'heure", hint: "Où placer le bouton dans la barre du haut (MJ). Aussi dans Horlogia › Réglages.", scope: "client", config: true, type: String, choices: { right: "À droite de la barre (par défaut)", next: "Juste à côté de l'heure", on: "Petit bouton discret sur l'heure" }, default: "right", onChange: () => renderHud() });
  W("viewOthers", { name: "Les joueurs peuvent consulter les calendriers des autres groupes MJ", hint: "Lecture seule : date, fêtes et événements visibles des autres groupes.", config: true, type: Boolean, default: true, onChange: () => refreshApps() });
  W("autoWeather", { name: "Météo tirée chaque nouveau jour", hint: "Selon la saison du groupe.", config: true, type: Boolean, default: false });
  game.settings.register(MOD, "hud", { name: "Afficher la barre Horlogia", scope: "client", config: true, type: Boolean, default: true, onChange: () => renderHud() });
  game.keybindings?.register(MOD, "play", { name: "Horlogia : Play / Pause", editable: [], restricted: true, onDown: () => { api.setPlay(!state().play); return true; } });
});

Hooks.once("ready", async () => {
  if (isLeadGM() && !(game.settings.get(MOD, "state")?.calendars?.length)) await game.settings.set(MOD, "state", defaultState());
  globalThis.HORLOGIA = api; game.modules.get(MOD).api = api;
  renderHud(); renderCombat(); renderCounters(); startTick(); checkDays(true);
  game.socket.on(`module.${MOD}`, onSocket); setTimeout(migrateCnt, 2000); Hooks.on("horlogiaView", () => { renderCombat(); renderCounters(); });
  /* 1.6.1 : après un redémarrage du serveur, Foundry est en pause → on remet Horlogia en pause aussi, sans compter le temps où le serveur était éteint */
  /* 1.12.1 : Play / Pause d'Horlogia n'a plus aucun lien avec la pause de Foundry. Au démarrage, on ne compte pas le temps où le serveur était éteint. */
  if (isLeadGM() && state().play) { const S = state(); S.stamp = now(); await game.settings.set(MOD, "state", S); }
  setTimeout(syncGmGroups, 2500); setTimeout(migrate14, 1800); setTimeout(migrate112, 2600); Hooks.on("manhwaGmGroups", () => { syncGmGroups(); renderHud(); refreshApps(); });
  setInterval(() => { checkDays(); if (isLeadGM() && state().play) SAVE_N++ >= 60 && (SAVE_N = 0, edit(() => {})); }, 1000);
});
let SAVE_N = 0;
/* 1.12 — une fois : plus d'interrupteur « avance avec Lecture » (tous les groupes suivent Play) ; chronos en cours : nouvelle mesure indépendante */
async function migrate112() { if (!isLeadGM()) return; const S0 = state(); if (S0.mig112) return;
  await edit(S => { for (const g of S.groups) delete g.run; for (const c of Object.values(S.combats || {})) if (c?.run && !c.st) c.st = now(); S.mig112 = true; }); }
/* 1.4 — une fois : la semaine commence le lundi (calendriers aux jours français dans le désordre, ex. import Calendaria),
 * en gardant le jour affiché aujourd'hui ; et tous les groupes suivent la Lecture par défaut */
const FR_WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
async function migrate14() {
  if (!isLeadGM()) return; const S0 = state(); if ((S0.mig || 0) >= 14) return;
  await edit(S => { for (const c of S.calendars) { const w = c.weekdays || []; const norm = x => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (w.length !== 7 || !FR_WEEK.every(n => w.some(x => norm(x) === norm(n))) || FR_WEEK.every((n, i) => norm(w[i]) === norm(n))) continue;
      const g = S.groups.find(x => x.cal === c.id) || S.groups[0]; const today = toDate(c, timeOf(S, g)); const name = w[today.wd]; const idx = FR_WEEK.findIndex(n => norm(n) === norm(name));
      c.weekdays = [...FR_WEEK]; c.firstWeekday = (((idx - today.dayIndex) % 7) + 7) % 7; }
    for (const g of S.groups) if (g.run == null) g.run = true; S.mig = 14; });
}
/* 1.3 — un groupe Horlogia par Groupe MJ (même id) ; le groupe par défaut « Monde » reste pour ceux qui ne sont dans aucun */
async function syncGmGroups() {
  if (!gmShared() || !isLeadGM()) return; const L = globalThis.MANHWA.gmGroups.list(); const S = state();
  const need = L.some(g => { const x = S.groups.find(y => y.id === g.id); return !x || x.name !== g.name || x.color !== g.color; }) || S.groups.some(x => !x.def && !L.some(g => g.id === x.id));
  if (!need) return;
  await edit(S2 => { const def = S2.groups.find(x => x.def) || S2.groups[0]; const t0 = timeOf(S2, def);
    for (const g of L) { const x = S2.groups.find(y => y.id === g.id); if (x) { x.name = g.name; x.color = g.color; continue; }
      S2.groups.push({ id: g.id, name: g.name, color: g.color, theme: def.theme || "spatial", cal: def.cal, t: t0, run: true, weather: { ...(def.weather || {}) }, party: "", actors: [], users: [], feeds: false }); }
    S2.groups = S2.groups.filter(x => x.def || L.some(g => g.id === x.id)); if (!S2.groups.some(x => x.id === S2.ref)) S2.ref = def.id; });
}
/* 1.12.1 : la pause de Foundry ne touche plus Horlogia (et inversement) */

/* ── nouveau jour (MJ principal seulement) ── */
const LAST = new Map();
function checkDays(init = false) {
  const S = state();
  for (const g of S.groups) { const c = calOf(S, g); const day = Math.floor(timeOf(S, g) / secondsPerDay(c)); const prev = LAST.get(g.id); LAST.set(g.id, day);
    if (init || prev == null || day === prev || !isLeadGM()) continue;
    const dt = toDate(c, timeOf(S, g)); const info = { group: g.id, name: g.name, from: prev, to: day, days: day - prev, date: dt, actors: membersOf(g), feeds: !!g.feeds };
    Hooks.callAll("horlogiaNewDay", info);
    if (g.feeds && day > prev) Hooks.callAll("manhwaNewDay", info);
    if (day > prev && setting("autoWeather", false)) { const se = seasonOf(c, dt, g); edit(S2 => { const gg = S2.groups.find(x => x.id === g.id); if (gg) gg.weather = { ...rollWeather(se?.type || ""), auto: true }; }); }
  }
}
function refreshApps() { for (const app of foundry.applications.instances.values()) if (app instanceof HorlogiaApp && app.rendered) app.render(); }

/* ── API ── */
/* 1.13 — éléments ajoutés aux jours du calendrier par d'autres modules (ex. Chroniques d'Interface - Manhwa) :
 * HORLOGIA.registerDayItems(fn) ; fn({ group, cal, y, m, d }) → [{ id, name, icon, color, open() }] */
const api = {
  registerDayItems(fn) { if (typeof fn === "function") DAY_PROVIDERS.add(fn); for (const a of foundry.applications.instances.values()) if (a.id === "horlogia") a.render(); },
  state, open: (tab = "cal") => HorlogiaApp.open(tab),
  async setPlay(on) { if (!game.user.isGM) return; await edit(S => { S.play = !!on; }); },
  /** avance un groupe (ou « * » : tous) de n secondes */
  async advance(gid, sec) { if (!game.user.isGM || !Number.isFinite(sec)) return; await edit(S => { for (const g of S.groups) if (gid === "*" || g.id === gid) g.t = Math.max(0, g.t + sec); }); },
  async setDate(gid, parts) { if (!game.user.isGM) return; await edit(S => { const g = S.groups.find(x => x.id === gid); if (!g) return false; g.t = fromDate(calOf(S, g), parts); }); },
  /** heure actuelle d'un groupe (par défaut : celui de l'utilisateur) */
  now(gid) { const S = state(); const g = S.groups.find(x => x.id === gid) || groupForUser(S); const c = calOf(S, g); const t = timeOf(S, g); const date = toDate(c, t); return { group: g, cal: c, t, date, label: `${fmtDate(c, date)} · ${fmtTime(date, false)}` }; },
  groupOf: actor => groupForActor(state(), actor),
  /** saison du groupe de référence (ou d'un groupe donné) : { name, type, color, icon } */
  season(gid) { const S = state(); const g = S.groups.find(x => x.id === (gid || S.ref)) || S.groups[0]; const c = calOf(S, g); return seasonOf(c, toDate(c, timeOf(S, g)), g); },
  eventsToday(gid) { const S = state(); const g = S.groups.find(x => x.id === (gid || S.ref)) || S.groups[0]; const c = calOf(S, g); const d = toDate(c, timeOf(S, g)); return eventsOn(S, g, d.y, d.m, d.d); },
  combat: { toggle: toggleCombat, start: startCombat, end: endCombat, elapsed: gid => combatElapsed(state(), gid) },
  counters: { toggle: toggleCnt, render: renderCounters, categories: openCats },
  /** 1.6.3 — pour le téléphone (applis Météo et Calendrier) : groupe d'un personnage (ou de l'utilisateur) */
  weather(actor) { const S = state(); const g = (actor && groupForActor(S, actor)) || groupForUser(S); const c = calOf(S, g); const d = toDate(c, timeOf(S, g)); const W = weatherOf(g.weather?.kind) || []; const se = seasonOf(c, d, g);
    return { group: g.name, name: W[0] || "", icon: W[1] || "fa-cloud", color: W[4] || "#cfe6ff", temp: Number.isFinite(+g.weather?.temp) ? +g.weather.temp : null, season: se ? { name: se.name, color: se.color, icon: se.icon } : null, date: fmtDate(c, d), time: fmtTime(d, false) }; },
  month(actor, offset = 0) { const S = state(); const g = (actor && groupForActor(S, actor)) || groupForUser(S); const c = calOf(S, g); const today = toDate(c, timeOf(S, g));
    let y = today.y, m = today.m + offset; const n = c.months.length; while (m < 0) { m += n; y--; } while (m >= n) { m -= n; y++; }
    const days = daysIn(c, y, m); const start = toDate(c, fromDate(c, { y, m, d: 1 })).wd; const ev = {};
    for (let d = 1; d <= days; d++) { const l = eventsOn(S, g, y, m, d).filter(e => game.user.isGM || !e.hidden); if (l.length) ev[d] = l.map(e => ({ name: e.name, color: e.color || "#ffd36b", icon: e.icon || "fa-star" })); }
    return { group: g.name, y, m, name: c.months[m]?.name || "", era: c.era || "", days, start, weekdays: c.weekdays, today: today.y === y && today.m === m ? today.d : 0, events: ev }; }
};
/* outil « Horlogia » (rangé par la Fiche dans le groupe Univers) */
Hooks.on("getSceneControlButtons", controls => {
  const tool = { name: "hzTool", title: "Horlogia — calendrier et temps du monde", icon: "fa-solid fa-clock", button: true, visible: true, order: 96, onChange: () => api.open(game.user.isGM ? "groups" : "cal"), onClick: () => api.open(game.user.isGM ? "groups" : "cal") };
  if (Array.isArray(controls)) controls.find(c => c.name === "token")?.tools?.push(tool); else { const t = controls.tokens || controls.token; if (t?.tools) t.tools.hzTool = tool; }
});
