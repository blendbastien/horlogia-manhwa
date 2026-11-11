/* Horlogia — barre du haut (une ligne) : groupe, jour + date, heure qui défile, saison (bannière), météo, lune, fêtes ;
 * le MJ clique sur la date, l'heure ou la météo pour les changer dans une petite bulle. */
import { MOD, foldCombat, esc, state, calOf, toDate, fromDate, timeOf, seasonOf, seasonKey, moonOf, WEATHER, WEATHER_CATS, weatherKey, weatherOf, rollWeather, THEMES, themeOf, eventsOn, fmtTime, groupForUser, edit, combatElapsed, combatLeft, fmtDur, secondsPerDay, daysIn, setTheme, thCls, thClasses, digits } from "./core.js";
import { opt, tShow, tUnit, tFromShown } from "./core.js";

const fa = i => `<i class="fa-solid ${i}"></i>`;
const TSTEPS = () => { const L = (opt("wSteps") || []).map(Number).filter(n => n > 0); return L.length ? L.slice(0, 5) : [1, 2, 5]; };
const SHOWC = cur => { const L = [...(opt("wShow") || [])]; const c = WEATHER[cur]?.[3] || "standard"; if (!L.includes(c)) L.push(c); return L; };
const cntShown = gid => { try { const x = (game.settings.get(MOD, "counters") || {})[gid]; return !!(x?.show && x.list?.length); } catch (e) { return false; } };
/* épée rouge du mode combat (dessin maison : lame lumineuse, garde, pommeau) */
export const SWORD = `<svg class="hz-sword" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="hzBl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffb3bc"/><stop offset="1" stop-color="#ff1f3d"/></linearGradient><linearGradient id="hzGd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd36b"/><stop offset="1" stop-color="#8a3a10"/></linearGradient></defs>
  <path class="bl" d="M52 6 L58 6 L58 12 L26 44 L20 38 Z" fill="url(#hzBl)"/><path d="M55 7 L57 9 L27 39" stroke="#fff" stroke-opacity=".8" stroke-width="1.2" fill="none"/>
  <path d="M14 32 L32 50 L28 54 L10 36 Z" fill="url(#hzGd)" stroke="#3a1206" stroke-width="1"/><path d="M21 43 L12 52" stroke="#5a1a0a" stroke-width="5" stroke-linecap="round"/><circle cx="9.5" cy="54.5" r="4" fill="url(#hzGd)" stroke="#3a1206"/></svg>`;
let EL = null, TICK = null, ADV_ALL = false, POP = null, DONE_KEY = "";
const SEASONS = ["spring", "summer", "autumn", "winter"];
const moonSvg = (f, color) => { const r = 8, lit = Math.cos(f * 2 * Math.PI); const sweep = f < .5 ? 1 : 0; const rx = Math.abs(lit) * r;
  return `<svg class="hz-moon" viewBox="-10 -10 20 20"><circle r="${r}" style="fill:var(--hz-moonbg,#0a0e22)" stroke="${color}" stroke-opacity=".5" stroke-width="1"/><path d="M0 -${r} A ${r} ${r} 0 0 ${sweep} 0 ${r} A ${rx} ${r} 0 0 ${lit > 0 ? 1 - sweep : sweep} 0 -${r}" fill="${color}"/></svg>`; };

export function hudShown() { try { return game.settings.get(MOD, "hud") !== false && (game.user.isGM || game.settings.get(MOD, "hudPlayers") !== false); } catch (e) { return true; } }
export function renderHud() {
  if (!hudShown()) { EL?.remove(); EL = null; closePop(); return; }
  if (!EL) { EL = document.createElement("div"); EL.id = "horlogia-hud"; document.body.appendChild(EL); bind(EL); const pos = game.user.getFlag(MOD, "hudPos"); if (pos) { EL.style.left = `${pos.x}px`; EL.style.top = `${pos.y}px`; EL.style.transform = "none"; } }
  const S = state(); const g = groupForUser(S); const gm = game.user.isGM; let PP = "right"; try { PP = game.settings.get(MOD, "playPos") || "right"; } catch (e) {}
  setTheme(EL, g); EL.classList.toggle("gm", gm); EL.classList.toggle("play", !!S.play); { let fx = true; try { fx = game.settings.get(MOD, "seasonFx") !== false; } catch (e) {} EL.classList.toggle("hz-nofx", !fx); } EL.classList.toggle("fx-l", opt("sLvl") === "l"); EL.classList.toggle("fx-h", opt("sLvl") === "h"); EL.classList.toggle("notint", !opt("wTint")); EL.classList.toggle("nosea", !opt("sShow")); EL.style.setProperty("--gc", g.color || "#5ee0ff");
  const W = weatherOf(g.weather?.kind);
  EL.innerHTML = `<span class="hz-banner" aria-hidden="true"><i class="b1"></i><i class="b2"></i></span><span class="hz-grip" title="Glisser pour déplacer (double-clic : remettre au centre)">${fa("fa-grip-vertical")}</span>
    ${gm ? `<a class="hz-grp" data-hz="group">${fa("fa-users")}<span>${esc(g.name)}</span></a>` : (S.groups.length > 1 ? `<span class="hz-grp ro">${fa("fa-users")}<span>${esc(g.name)}</span></span>` : "")}
    <a class="hz-date" data-hz="date"><b class="hz-wday" data-hz-wday></b><b class="hz-dtxt" data-hz-date></b></a>
    <a class="hz-time${gm && PP === "on" ? " pp-time" : ""}" data-hz="${gm && PP === "on" ? "play" : "time"}">${gm && PP === "on" ? `<i class="hz-ppi">${fa(S.play ? "fa-pause" : "fa-play")}</i>` : `<i class="hz-dot"></i>`}<b data-hz-time></b></a>${gm && PP === "next" ? `<span class="hz-ctl hz-ppn"><a data-hz="play" class="pp">${fa(S.play ? "fa-pause" : "fa-play")}</a></span>` : ""}
    <a class="hz-season" data-hz="season" data-hz-season></a>
    <a class="hz-wx" data-hz="wx" style="--wc:${esc(W[4] || "#ffd36b")}">${fa(W[1])}<span class="hz-wxn">${esc(W[0])}</span><b>${Number.isFinite(+g.weather?.temp) && (gm || opt("wTempP")) ? `${tShow(g.weather.temp)}°` : ""}</b></a>
    <span class="hz-moon-w" data-hz-moon></span><span class="hz-evs" data-hz-evs></span>
    ${!gm && cntShown(g.id) ? `<span class="hz-ctl"><a data-hz="cnt" class="cn">${fa("fa-list-ol")}</a></span>` : ""}
    ${gm ? `<span class="hz-ctl">${PP === "right" ? `<a data-hz="play" class="pp">${fa(S.play ? "fa-pause" : "fa-play")}</a>` : ""}
<a data-hz="combat" class="cb${S.combat ? " on" : ""}">${SWORD}</a><a data-hz="cnt" class="cn">${fa("fa-list-ol")}</a><a data-hz="app">${fa("fa-gear")}</a></span>` : ""}
`;
  EL.dataset.se = ""; tick();
  if (POP) { setTheme(POP, g); }
}
/* met à jour la date et l'heure chaque seconde, sans tout redessiner */
function tick() {
  const S = state();
  if (EL) { const g = groupForUser(S); const c = calOf(S, g); const dt = toDate(c, timeOf(S, g)); const q = s => EL.querySelector(s); const se = seasonOf(c, dt, g);
    q("[data-hz-wday]").textContent = c.weekdays[dt.wd] || ""; q("[data-hz-date]").textContent = `${dt.d} ${c.months[dt.m]?.name || ""} ${dt.y}${c.era ? ` ${c.era}` : ""}`;
    { const tm = fmtTime(dt); const tEl = q("[data-hz-time]"); if (tEl.dataset.k !== tm) { tEl.dataset.k = tm; tEl.innerHTML = digits(tm); } }
    const sk = se ? `${se.name}|${se.color}` : ""; const sEl = q("[data-hz-season]"); if (sEl.dataset.k !== sk) { sEl.dataset.k = sk; sEl.innerHTML = se ? `<i class="fa-solid ${esc(se.icon || "fa-circle")}"></i>${esc(se.name)}` : ""; sEl.style.setProperty("--sc", se?.color || "#c0c8e0"); sEl.hidden = !se; }
    const key = seasonKey(se); if (EL.dataset.se !== key) { EL.dataset.se = key; for (const k of SEASONS) EL.classList.toggle(`hz-se-${k}`, k === key); }
    const mo = (c.moons || [])[0]; const mEl = q("[data-hz-moon]"); if (mo) { const p = moonOf(mo, dt); const mk = `${p.i}`; if (mEl.dataset.k !== mk) { mEl.dataset.k = mk; mEl.innerHTML = moonSvg(p.f, mo.color || "#dfe6ff");  } } else mEl.innerHTML = "";
    const evs = eventsOn(S, g, dt.y, dt.m, dt.d); const ek = evs.map(e => e.id).join(","); const eEl = q("[data-hz-evs]"); if (eEl.dataset.k !== ek) { eEl.dataset.k = ek; eEl.innerHTML = evs.slice(0, 2).map(e => `<span class="hz-ev" style="--ec:${esc(e.color || "#ffd36b")}"><i class="fa-solid ${esc(e.icon || "fa-star")}"></i>${esc(e.name)}</span>`).join("") + (evs.length > 2 ? `<span class="hz-ev more">+${evs.length - 2}</span>` : ""); }
  }
  /* chrono de combat du groupe affiché */
  const cb = document.getElementById("horlogia-combat"); const gid = cb?.dataset.g; const C = gid && S.combats?.[gid];
  if (cb && C) { const left = combatLeft(S, gid); const shown = left == null ? combatElapsed(S, gid) : left; const t = cb.querySelector("[data-hz-ct]"); const k = fmtDur(shown); if (t && t.dataset.k !== k) { t.dataset.k = k; t.innerHTML = digits(k); } cb.style.setProperty("--sec", Math.floor(shown));
    { const wn = +opt("cWarn") || 0; cb.classList.toggle("low", wn > 0 && left != null && left > 0 && left <= wn); } cb.classList.toggle("done", left === 0);
    if (left === 0 && +C.dur > 0) { const dk = `${gid}|${C.start || ""}|${C.dur}`; if (DONE_KEY !== dk) { DONE_KEY = dk; timeUp(gid); } } }
}
/* fin du compte à rebours : son et alerte ; le MJ principal met ce chrono en pause */
function timeUp(gid) {
  const src = opt("cSound"); if (src && src !== "none") try { foundry.audio.AudioHelper.play({ src, volume: Math.max(0, Math.min(1, +opt("cVol"))), autoplay: true, loop: false }, false); } catch (e) {}
  if (game.users.activeGM?.isSelf) edit(S2 => { const c = S2.combats?.[gid]; if (!c) return false; foldCombat(S2, gid); c.run = false; c.st = 0; });
}
export function startTick() { clearInterval(TICK); TICK = setInterval(tick, 1000); }

/* ── bulle d'édition (date, heure, météo) ── */
function closePop() { POP?.remove(); POP = null; removeEventListener("pointerdown", outside, true); removeEventListener("keydown", esc_); }
function outside(ev) { if (POP && !POP.contains(ev.target) && !ev.target.closest?.("#horlogia-hud [data-hz]")) closePop(); }
function esc_(ev) { if (ev.key === "Escape") closePop(); }
function openPop(kind, anchor) {
  const same = POP?.dataset.k === kind; closePop(); if (same) return;
  const S = state(); const g = groupForUser(S); const c = calOf(S, g); const dt = toDate(c, timeOf(S, g));
  POP = document.createElement("div"); POP.id = "horlogia-pop"; POP.dataset.k = kind; POP.dataset.g = g.id; setTheme(POP, g); POP.style.setProperty("--gc", g.color || "#5ee0ff");
  const rowsOf = (L, kind) => `<div class="hzp-steps">${L.map(([lab, unit, vals]) => `<div class="hzp-st"><b>${lab}</b><span class="m">${[...vals].reverse().map(v => `<a data-p="${kind}" data-u="${unit}" data-v="${-v}">−${v}</a>`).join("")}</span><span class="p">${vals.map(v => `<a data-p="${kind}" data-u="${unit}" data-v="${v}">+${v}</a>`).join("")}</span></div>`).join("")}</div>`;
  if (kind === "date") POP.innerHTML = `<h4>${fa("fa-calendar-day")} Date de ${esc(g.name)}</h4>
    <div class="hzp-row"><label>Jour<input type="number" name="d" min="1" max="${daysIn(c, dt.y, dt.m)}" value="${dt.d}"></label><label class="w">Mois<select name="m">${c.months.map((mo, i) => `<option value="${i}"${i === dt.m ? " selected" : ""}>${esc(mo.name)}</option>`).join("")}</select></label><label>Année<input type="number" name="y" value="${dt.y}"></label></div>
    ${rowsOf([["Jours", "d", [1, 2, 7]], ["Mois", "mo", [1, 2, 3]], ["Années", "y", [1, 5, 10]]], "dstep")}
    <div class="hzp-foot"><a data-p="cal">${fa("fa-calendar-days")} Calendrier</a><a class="ok" data-p="okd">${fa("fa-check")} Valider la saisie</a></div>`;
  else if (kind === "time") POP.innerHTML = `<h4>${fa("fa-clock")} Heure de ${esc(g.name)}</h4>
    <div class="hzp-row big"><input type="number" name="h" min="0" max="${(c.hpd || 24) - 1}" value="${dt.h}" title="Heures"><span>:</span><input type="number" name="mi" min="0" max="${(c.mph || 60) - 1}" value="${dt.mi}" title="Minutes"><span>:</span><input type="number" name="s" min="0" max="${(c.spm || 60) - 1}" value="${dt.s}" title="Secondes"></div>
    ${rowsOf([["Secondes", "s", [1, 5, 10, 15, 30]], ["Minutes", "mi", [1, 5, 10, 15, 30]], ["Heures", "h", [1, 2, 3, 5, 10]]], "tstep")}
    <div class="hzp-foot"><span class="hzp-hint">Les boutons changent l'heure tout de suite.</span><a class="ok" data-p="okt">${fa("fa-check")} Valider la saisie</a></div>`;
  else if (kind === "group") POP.innerHTML = `<h4>${fa("fa-users")} Groupe affiché</h4><div class="hzp-list">${S.groups.map(x => `<a data-p="grp" data-id="${x.id}" class="${x.id === g.id ? "on" : ""}" style="--xc:${esc(x.color || "#5ee0ff")}"><i class="dot"></i><b>${esc(x.name)}</b><small>${esc(THEMES[themeOf(x)]?.name || "")}</small></a>`).join("")}</div><p class="hzp-hint">La barre et la fenêtre prennent le thème du groupe choisi.</p>`;
  else if (kind === "season") { const se = seasonOf(c, dt, g); const auto = g.seasonOv == null || g.seasonOv === "";
    POP.innerHTML = `<h4>${fa("fa-leaf")} Saison de ${esc(g.name)}</h4><div class="hzp-list">${`<a data-p="sea" data-v="" class="${auto ? "on" : ""}" style="--xc:#9fb0d4"><i class="fa-solid fa-calendar-days"></i><b>Automatique</b><small>selon la date (${esc(seasonOf(c, dt)?.name || "—")})</small></a>`}${(c.seasons || []).map((x, i) => `<a data-p="sea" data-v="${i}" class="${!auto && +g.seasonOv === i ? "on" : ""}" style="--xc:${esc(x.color || "#c0c8e0")}"><i class="fa-solid ${esc(x.icon || "fa-circle")}"></i><b>${esc(x.name)}</b></a>`).join("")}</div><p class="hzp-hint">Choisie : elle reste jusqu'à ce que tu remettes « Automatique ».</p>`; }
  else { const cur = weatherKey(g.weather?.kind); const tp = Number.isFinite(+g.weather?.temp) ? +g.weather.temp : 12;
    POP.innerHTML = `<h4>${fa("fa-cloud-sun")} Météo de ${esc(g.name)}</h4>
    <div class="hzp-top"><div class="hzp-temp"><span class="m">${[...TSTEPS()].reverse().map(v => `<a data-p="tp" data-v="${-v}">−${v}</a>`).join("")}</span><label class="tv"><input type="number" name="tp" value="${tShow(tp)}"><b>${tUnit()}</b></label><span class="p">${TSTEPS().map(v => `<a data-p="tp" data-v="${v}">+${v}</a>`).join("")}</span><a data-p="roll" class="roll">${fa("fa-dice")}</a></div>
    ${!opt("sPop") ? "" : (() => { const se = seasonOf(c, dt, g); const auto = g.seasonOv == null || g.seasonOv === ""; return `<div class="hzp-sea"><b>${fa("fa-leaf")} Saison</b><span>${`<a data-p="sea2" data-v="" class="${auto ? "on" : ""}" style="--xc:#9fb0d4">${fa("fa-calendar-days")}Auto</a>`}${(c.seasons || []).map((x, i) => `<a data-p="sea2" data-v="${i}" class="${!auto && +g.seasonOv === i ? "on" : ""}" style="--xc:${esc(x.color || "#c0c8e0")}">${fa(x.icon || "fa-circle")}${esc(x.name)}</a>`).join("")}</span>${se ? `<em style="--xc:${esc(se.color || "#c0c8e0")}">${auto ? "selon la date : " : ""}${esc(se.name)}</em>` : ""}</div>`; })()}</div>
    <div class="hzp-cats">${Object.entries(WEATHER_CATS).filter(([k]) => SHOWC(cur).includes(k)).map(([k, v], i) => `<a data-p="wcat" data-c="${k}" class="${(WEATHER[cur]?.[3] || "standard") === k ? "on" : ""}">${fa(v[1])} ${v[0]}</a>`).join("")}</div>
    ${Object.keys(WEATHER_CATS).filter(k => SHOWC(cur).includes(k)).map(cat => `<div class="hzp-wx" data-cat="${cat}"${(WEATHER[cur]?.[3] || "standard") === cat ? "" : " hidden"}>${Object.entries(WEATHER).filter(([, w]) => w[3] === cat).map(([k, w]) => `<a data-p="wk" data-k="${k}" class="${k === cur ? "on" : ""}" style="--wc:${w[4]}">${fa(w[1])}<span>${esc(w[0])}</span></a>`).join("")}</div>`).join("")}
    <p class="hzp-hint">Choisir une météo ramène les degrés dans sa plage si besoin.</p>`; }
  document.body.appendChild(POP);
  const r = anchor.getBoundingClientRect(); const w = POP.offsetWidth; POP.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`; POP.style.top = `${r.bottom + 10}px`;
  POP.querySelector("input")?.select?.();
  POP.addEventListener("click", popClick); POP.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); POP.querySelector(".ok")?.click(); } });
  POP.querySelector('[name="tp"]')?.addEventListener("change", ev => setWx({ temp: tFromShown(+ev.target.value || 0) }));
  setTimeout(() => { addEventListener("pointerdown", outside, true); addEventListener("keydown", esc_); });
}
const gOf = () => { const S = state(); return S.groups.find(x => x.id === POP?.dataset.g) || groupForUser(S); };
const setWx = patch => edit(S2 => { const g = S2.groups.find(x => x.id === POP?.dataset.g); if (!g) return false; g.weather = { ...(g.weather || {}), ...patch }; });
async function popClick(ev) {
  const a = ev.target.closest("[data-p]"); if (!a) return; ev.preventDefault(); const k = a.dataset.p; const api = globalThis.HORLOGIA; const v = n => POP.querySelector(`[name="${n}"]`);
  const S = state(); const g = gOf(); const c = calOf(S, g); const dt = toDate(c, timeOf(S, g));
  if (k === "cal") { closePop(); return api.open("cal"); }
  const refill = () => { const S3 = state(); const g3 = S3.groups.find(x => x.id === g.id) || g; const c3 = calOf(S3, g3); const d3 = toDate(c3, timeOf(S3, g3)); for (const n of ["h", "mi", "s", "d", "y"]) if (v(n)) v(n).value = d3[n]; if (v("m")) v("m").value = d3.m; };
  if (k === "tstep") { const n = +a.dataset.v; const u = a.dataset.u; const sec = n * (u === "s" ? 1 : u === "mi" ? (c.spm || 60) : (c.spm || 60) * (c.mph || 60)); await api.advance(g.id, sec); return refill(); }
  if (k === "dstep") { const n = +a.dataset.v; const u = a.dataset.u;
    if (u === "d") await api.advance(g.id, n * secondsPerDay(c));
    else { let y = dt.y, m = dt.m; if (u === "y") y += n; else { m += n; const L = c.months.length; while (m < 0) { m += L; y--; } while (m >= L) { m -= L; y++; } }
      await api.setDate(g.id, { y, m, d: Math.min(dt.d, daysIn(c, y, m)), h: dt.h, mi: dt.mi, s: dt.s }); }
    return refill(); }
  if (k === "okd") { const y = +v("y").value || dt.y, m = +v("m").value || 0; const d = Math.max(1, Math.min(daysIn(c, y, m), +v("d").value || 1)); closePop(); return api.setDate(g.id, { y, m, d, h: dt.h, mi: dt.mi, s: dt.s }); }
  if (k === "grp") { closePop(); await game.user.setFlag(MOD, "view", a.dataset.id); renderHud(); Hooks.callAll("horlogiaView"); for (const app of foundry.applications.instances.values()) if (app.constructor?.name === "HorlogiaApp") app.render(); return; }
  if (k === "sea2") { const v2 = a.dataset.v; POP.querySelectorAll('[data-p="sea2"]').forEach(x => x.classList.toggle("on", x === a)); return edit(S2 => { const x = S2.groups.find(y => y.id === g.id); if (!x) return false; x.seasonOv = v2 === "" ? null : +v2; }); }
  if (k === "sea") { const v2 = a.dataset.v; closePop(); return edit(S2 => { const x = S2.groups.find(y => y.id === g.id); if (!x) return false; x.seasonOv = v2 === "" ? null : +v2; }); }
  if (k === "okt") { const h = Math.max(0, Math.min((c.hpd || 24) - 1, +v("h").value || 0)), mi = Math.max(0, Math.min((c.mph || 60) - 1, +v("mi").value || 0)), sc = Math.max(0, Math.min((c.spm || 60) - 1, +v("s").value || 0)); closePop(); return api.setDate(g.id, { y: dt.y, m: dt.m, d: dt.d, h, mi, s: sc }); }
  if (k === "tp") { const n = Math.round((+v("tp").value || 0) + +a.dataset.v); v("tp").value = n; return setWx({ temp: tFromShown(n) }); }
  if (k === "roll") { const w = rollWeather(seasonKey(seasonOf(c, dt, g))); v("tp").value = tShow(w.temp); markWx(w.kind); return setWx(w); }
  if (k === "wcat") { POP.querySelectorAll(".hzp-cats a").forEach(x => x.classList.toggle("on", x === a)); POP.querySelectorAll(".hzp-wx").forEach(x => x.hidden = x.dataset.cat !== a.dataset.c); return; }
  if (k === "wk") { markWx(a.dataset.k); return setWx({ kind: a.dataset.k }); }   /* 1.6.2 : changer de météo ne touche plus aux degrés */
}
function markWx(k) { POP?.querySelectorAll(".hzp-wx a").forEach(x => x.classList.toggle("on", x.dataset.k === k)); }

function bind(el) {
  el.addEventListener("click", async ev => { const a = ev.target.closest("[data-hz]"); if (!a) return; ev.preventDefault(); const k = a.dataset.hz; const api = globalThis.HORLOGIA;
    if (k === "date" && !game.user.isGM) return api.open("cal");
    if (k === "cnt") return api.counters.toggle();
    if (!game.user.isGM) return;
    if (k === "date" || k === "time" || k === "wx" || k === "group" || k === "season") return openPop(k, a);
    if (k === "app") return api.open("groups");
    if (k === "play") return api.setPlay(!state().play);
    if (k === "combat") return api.combat.toggle();
  });
  /* bouton Play « sur l'heure » : clic gauche = Play / Pause, clic droit = changer l'heure */
  el.addEventListener("contextmenu", ev => { const t = ev.target.closest(".hz-time.pp-time"); if (!t || !game.user.isGM) return; ev.preventDefault(); ev.stopPropagation(); openPop("time", t); });
  /* déplacer la barre */
  el.addEventListener("pointerdown", ev => { if (!ev.target.closest(".hz-grip")) return; ev.preventDefault(); closePop(); const r = el.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const mv = e => { el.style.left = `${Math.max(0, Math.min(innerWidth - r.width, e.clientX - dx))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - r.height, e.clientY - dy))}px`; el.style.transform = "none"; };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); const q = el.getBoundingClientRect(); game.user.setFlag(MOD, "hudPos", { x: Math.round(q.left), y: Math.round(q.top) }); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); });
  el.addEventListener("dblclick", ev => { if (!ev.target.closest(".hz-grip")) return; game.user.unsetFlag(MOD, "hudPos"); el.style.left = ""; el.style.top = ""; el.style.transform = ""; });
}
