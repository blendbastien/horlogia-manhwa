/* Horlogia — fenêtre principale : calendrier (mois / année, fêtes et événements), groupes (date, météo, membres),
 * calendriers (mois, jours, heures, saisons, lunes) et réglages (vitesse, import Calendaria). */
import { opt } from "./core.js";
import { DAY_PROVIDERS } from "./core.js";
import { MOD, esc, uid, state, edit, calOf, toDate, fromDate, timeOf, seasonOf, moonOf, WEATHER, WEATHER_CATS, weatherOf, weatherKey, SEASON_TYPES, eventsOn, membersOf, userChars, groupForUser, daysIn, secondsPerDay, rollWeather, defaultCalendar, simpleCalendar, fmtDate, fmtTime, pad, THEMES, themeOf, thCls, thClasses, defaultTheme, digits, gmShared, gmGroupOf } from "./core.js";
import { SWORD } from "./hud.js";
const { ApplicationV2, DialogV2 } = foundry.applications.api;
const fa = i => `<i class="fa-solid ${i}"></i>`;
const ICONS = ["fa-star", "fa-champagne-glasses", "fa-gifts", "fa-heart", "fa-egg", "fa-ghost", "fa-skull", "fa-dragon", "fa-sun", "fa-moon", "fa-snowflake", "fa-leaf", "fa-seedling", "fa-fire", "fa-crown", "fa-masks-theater",
  "fa-music", "fa-utensils", "fa-beer-mug-empty", "fa-church", "fa-place-of-worship", "fa-flag", "fa-shield-halved", "fa-khanda", "fa-scroll", "fa-book", "fa-coins", "fa-gem", "fa-rocket", "fa-meteor", "fa-cake-candles", "fa-umbrella-beach"];
const COLORS = ["#ffd36b", "#ff9a3d", "#ff5d6c", "#ff4fd8", "#a46bff", "#5e8bff", "#5ee0ff", "#3ddc84", "#9be564", "#e6ecff"];
/* 1.5 — pastilles de couleur comme Portrait Manhwa : clic = choisir, clic droit = colonne de nuances (claires → foncées), pipette = couleur libre */
const SWATCHES = ["#ff3b4e", "#ff6b3d", "#ff9b3d", "#ffc63d", "#ffe45e", "#c6f04a", "#5aff9a", "#2fe0a8", "#2fd8d8", "#38e0ff", "#4aa8ff", "#5e7bff", "#8a6bff", "#b980ff", "#e06bff", "#ff6be0", "#ff8af0", "#ff7a9c", "#e2c273", "#c9a27a", "#9fb0d4", "#ffffff"];
const hexMix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const shades = c => [...[.75, .55, .35, .15].map(t => hexMix(c, "#ffffff", t)), c, ...[.2, .4, .55, .7].map(t => hexMix(c, "#000000", t))];
const normHex = c => /^#[0-9a-f]{6}$/i.test(c || "") ? c.toLowerCase() : "#5ee0ff";
const swRow = (cur, inputAttrs) => { cur = normHex(cur); return `<div class="hz-swr" data-tooltip="Clic : choisir · clic droit : nuances plus claires ou plus foncées">${SWATCHES.map(c => `<a class="hz-swc${c === cur ? " on" : ""}" data-c="${c}" style="--c:${c}"></a>`).join("")}${SWATCHES.includes(cur) ? "" : `<a class="hz-swc on cur" data-c="${cur}" style="--c:${cur}" data-tooltip="Couleur actuelle"></a>`}<label class="hz-swf" data-tooltip="Couleur libre">${fa("fa-eye-dropper")}<input type="color" ${inputAttrs} value="${cur}"></label></div>`; };
document.addEventListener("click", ev => { const a = ev.target.closest(".hz-swr .hz-swc"); if (!a) return; ev.preventDefault(); ev.stopPropagation(); const row = a.closest(".hz-swr"); const inp = row.querySelector("input[type=color]");
  row.querySelectorAll(".hz-swc.on").forEach(x => x.classList.remove("on")); a.classList.add("on"); row.querySelector(".hz-shades")?.remove(); inp.value = a.dataset.c; inp.dispatchEvent(new Event("change", { bubbles: true })); }, true);
document.addEventListener("contextmenu", ev => { const a = ev.target.closest(".hz-swr .hz-swc"); if (!a || a.closest(".hz-shades")) return; ev.preventDefault(); const row = a.closest(".hz-swr"); row.querySelector(".hz-shades")?.remove();
  const box = document.createElement("div"); box.className = "hz-shades"; box.innerHTML = shades(a.dataset.c).map(c => `<a class="hz-swc" data-c="${c}" style="--c:${c}" title="${c}"></a>`).join("");
  box.style.left = `${a.offsetLeft + a.offsetWidth / 2 - 15}px`; box.style.top = `${a.offsetTop + a.offsetHeight + 6}px`; row.appendChild(box);
  const off = e => { if (!box.contains(e.target)) { box.remove(); document.removeEventListener("pointerdown", off, true); } }; setTimeout(() => document.addEventListener("pointerdown", off, true)); });
const parties = () => { try { return globalThis.MANHWA?.parties?.() || []; } catch (e) { return []; } };

export class HorlogiaApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "horlogia", classes: ["horlogia-app"], window: { title: "Horlogia", icon: "fa-solid fa-clock", resizable: true }, position: { width: 1100, height: 760 } };
  static open(tab = "cal") { const a = foundry.applications.instances.get("horlogia") || new HorlogiaApp(); if (!game.user.isGM && tab !== "cal") tab = "cal"; a.tab = tab; a.render({ force: true }); return a; }
  tab = "cal"; view = null; mode = "month"; calSel = null;
  get title() { return "Horlogia — temps du monde"; }

  async _renderHTML() {
    const S = state(); const gm = game.user.isGM;
    const tabs = [["cal", "fa-calendar-days", "Calendrier", "#5ee0ff"], ...(gm ? [["groups", "fa-users", "Groupes", "#3ddc84"], ["cals", "fa-calendar-plus", "Calendriers", "#a46bff"], ["ocombat", "fa-khanda", "Combat", "#ff5d6c"], ["owx", "fa-cloud-sun", "Météo", "#ffd36b"], ["osea", "fa-leaf", "Saison", "#7fdc8a"], ["ocnt", "fa-list-ol", "Compteurs", "#c49aff"], ["opts", "fa-sliders", "Réglages", "#ffb23d"]] : [])];
    const OT = { ocombat: "combat", owx: "wx", osea: "sea", ocnt: "cnt" };
    const body = this.tab === "groups" && gm ? this.#groups(S) : this.tab === "cals" && gm ? this.#cals(S) : this.tab === "opts" && gm ? this.#opts(S) : OT[this.tab] && gm ? `<div class="hz-opts one">${this.#optCards()[OT[this.tab]]}</div>` : this.#cal(S);
    const thG = (this.tab === "cal" && this.view?.g && S.groups.find(x => x.id === this.view.g)) || groupForUser(S); this._thcs = thClasses(thG); this._neutral = this.tab !== "cal";   /* 1.4 : seuls le calendrier et les bulles prennent le thème ; les paramètres restent lisibles */
    return `<div class="hz-wrap"><nav class="hz-tabs">${tabs.map(([k, i, n, c]) => `<a data-a="tab" data-k="${k}" class="${this.tab === k ? "on" : ""}" style="--tc:${c}">${fa(i)}<span>${n}</span></a>`).join("")}
</nav>
      <section class="hz-body">${body}</section></div>`;
  }
  /* ── calendrier ── */
  #cal(S) {
    const gm = game.user.isGM; const mine = groupForUser(S); const others = !gm && game.settings.get(MOD, "viewOthers") !== false; const gid = this.view?.g && (gm || others || this.view.g === mine.id) ? this.view.g : mine.id; const g = S.groups.find(x => x.id === gid) || mine; const c = calOf(S, g); const today = toDate(c, timeOf(S, g));
    if (!this.view || this.view.g !== g.id) this.view = { g: g.id, y: today.y, m: today.m };
    const { y, m } = this.view;
    const head = `<div class="hz-calh">${gm || (others && S.groups.length > 1) ? `<select data-a="vg">${S.groups.map(x => `<option value="${x.id}"${x.id === g.id ? " selected" : ""}>${esc(x.name)}${!gm && x.id === mine.id ? " (mon groupe)" : ""}</option>`).join("")}</select>${!gm && g.id !== mine.id ? `<em class="hz-tag">${fa("fa-eye")} consultation</em>` : ""}` : `<b class="hz-gname" style="--gc:${esc(g.color)}">${fa("fa-users")} ${esc(g.name)}</b>`}
      <a class="hz-nav" data-a="prev">${fa("fa-chevron-left")}</a><h2>${this.mode === "year" ? `${y}${c.era ? ` <small>${esc(c.era)}</small>` : ""}` : `${esc(c.months[m]?.name || "")} ${y}`}</h2><a class="hz-nav" data-a="next">${fa("fa-chevron-right")}</a>
      <a class="hz-btn" style="--bc:#5ee0ff" data-a="today">${fa("fa-crosshairs")} Aujourd'hui</a><span class="hz-seg"><a data-a="mode" data-k="month" class="${this.mode === "month" ? "on" : ""}">Mois</a><a data-a="mode" data-k="year" class="${this.mode === "year" ? "on" : ""}">Année</a></span>
      <span class="hz-now">${fa("fa-clock")} ${esc(fmtDate(c, today))} · ${fmtTime(today, false)}</span></div>`;
    if (this.mode === "year") return head + `<div class="hz-year">${c.months.map((mo, i) => `<div class="hz-mini" data-a="gom" data-m="${i}"><h4>${esc(mo.name)}</h4>${this.#grid(S, g, c, y, i, today, true)}</div>`).join("")}</div>`;
    const list = []; for (let d = 1; d <= daysIn(c, y, m); d++) for (const e of eventsOn(S, g, y, m, d)) if (!list.some(x => x.e.id === e.id)) list.push({ e, d });
    return head + `<div class="hz-month">${this.#grid(S, g, c, y, m, today, false)}<aside class="hz-side"><h3>${fa("fa-champagne-glasses")} Fêtes et événements</h3>${gm ? (() => { const sl = this.sel && this.sel.y === y && this.sel.m === m ? this.sel : null; const n = sl ? sl.b - sl.a + 1 : 0;
        return sl ? `<div class="hz-selbar"><b>${fa("fa-calendar-week")} ${n} jour${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}</b><small>${n > 1 ? `du ${sl.a} au ${sl.b}` : `le ${sl.a}`} ${esc(c.months[m]?.name || "")}</small><span>${n === 1 ? `<a class="hz-btn" style="--bc:#3ddc84" data-a="goDay" data-tooltip="La barre du haut passe à ce jour (l'heure ne change pas)">${fa("fa-calendar-check")} Aller à ce jour</a>` : ""}<a class="hz-btn" style="--bc:#ffd36b" data-a="evNew">${fa("fa-champagne-glasses")} Créer un événement${n > 1 ? ` sur ${n} jours` : ""}</a><a class="hz-btn sm" style="--bc:#9fb0d4" data-a="selx" data-tooltip="Annuler la sélection">${fa("fa-xmark")}</a></span></div>`
          : `<a class="hz-btn" style="--bc:#ffd36b" data-a="evNew">${fa("fa-plus")} Nouvel événement</a><small class="hz-hint">Clique un jour puis Maj + clic sur un autre, ou glisse sur plusieurs jours, pour une fête qui dure. Double-clic : événement d'un jour.</small>`; })() : ""}
      ${(() => { const J = []; for (let d = 1; d <= daysIn(c, y, m); d++) for (const it of this.#items(g, c, y, m, d)) J.push({ it, d }); return J.length ? `<h3 class="hz-jh">${fa("fa-newspaper")} Journaux du mois</h3>${J.map(({ it, d }) => `<a class="hz-evl hz-jl" data-a="dayItem" data-id="${esc(it.id)}" style="--ec:${esc(it.color || "#e8dcc0")}">${fa(it.icon || "fa-newspaper")}<span><b>${esc(it.name)}</b><small>${d} ${esc(c.months[m]?.name || "")}${it.sub ? ` · ${esc(it.sub)}` : ""}</small></span></a>`).join("")}<h3>${fa("fa-champagne-glasses")} Événements</h3>` : ""; })()}
      ${list.map(({ e, d }) => `<a class="hz-evl" data-a="ev" data-id="${e.id}" style="--ec:${esc(e.color || "#ffd36b")}">${fa(e.icon || "fa-star")}<span><b>${esc(e.name)}</b><small>${d} ${esc(c.months[m]?.name || "")}${(+e.dur || 1) > 1 ? ` · ${e.dur} jours` : ""}${e.y == null || e.y === "" ? " · chaque année" : ""}${e.groups?.length ? ` · ${e.groups.map(id => S.groups.find(x => x.id === id)?.name).filter(Boolean).join(", ")}` : ""}${e.hidden ? " · caché" : ""}</small>${e.desc ? `<em>${esc(e.desc)}</em>` : ""}</span></a>`).join("") || `<p class="hz-none">Rien ce mois-ci.</p>`}</aside></div>`;
  }
  /* 1.13 — éléments des autres modules pour un jour (journaux du jour…) */
  #items(g, c, y, m, d) { const out = []; for (const fn of DAY_PROVIDERS) { try { for (const it of fn({ group: g, cal: c, y, m, d }) || []) { (this._dayIt ||= new Map()).set(it.id, it); out.push(it); } } catch (e) { console.warn(MOD, e); } } return out; }
  #grid(S, g, c, y, m, today, mini) {
    const W = c.weekdays.length || 7; const first = toDate(c, fromDate(c, { y, m, d: 1 })); const n = daysIn(c, y, m); const cells = [];
    for (let i = 0; i < first.wd; i++) cells.push(`<i class="hz-pad"></i>`);
    const seasons = (c.seasons || []).filter(s => +s.month === m);
    const EV = []; for (let d = 1; d <= n; d++) EV[d] = mini ? eventsOn(S, g, y, m, d) : eventsOn(S, g, y, m, d).sort((p, q) => (+q.dur || 1) - (+p.dur || 1) || String(p.id).localeCompare(String(q.id)));
    const sl = !mini && this.sel && this.sel.y === y && this.sel.m === m ? this.sel : null;
    for (let d = 1; d <= n; d++) { const isT = today.y === y && today.m === m && today.d === d; const evs = EV[d]; const se = seasons.find(s => (+s.day || 1) === d);
      const its = this.#items(g, c, y, m, d);
      if (mini) { cells.push(`<i class="hz-md${isT ? " today" : ""}${evs.length ? " ev" : ""}${its.length ? " jr" : ""}" style="${evs[0] ? `--ec:${esc(evs[0].color || "#ffd36b")}` : ""}">${d}</i>`); continue; }
      const mo = (c.moons || [])[0]; const ph = mo ? moonOf(mo, toDate(c, fromDate(c, { y, m, d }))) : null;
      const wd = (first.wd + d - 1) % W; const tint = evs.find(e => (+e.dur || 1) > 1) || evs[0];
      cells.push(`<div class="hz-day${isT ? " today" : ""}${tint ? " tint" : ""}${sl && d >= sl.a && d <= sl.b ? " sel" : ""}" data-d="${d}"${tint ? ` style="--dc:${esc(tint.color || "#ffd36b")}"` : ""}>${se ? `<span class="hz-sstart" style="--sc:${esc(se.color)}" data-tooltip="Début : ${esc(se.name)}">${fa(se.icon || "fa-circle")}</span>` : ""}<b>${d}</b>${ph && (ph.i === 0 || ph.i === 4) ? `<i class="hz-ph ${ph.i ? "full" : "new"}" data-tooltip="${esc(ph.name)}"></i>` : ""}
        <div class="hz-evs">${evs.slice(0, 3).map(e => { const multi = (+e.dur || 1) > 1; const st = d === 1 || !EV[d - 1]?.some(x => x.id === e.id); const en = d === n || !EV[d + 1]?.some(x => x.id === e.id); const rs = st || wd === 0, re = en || wd === W - 1;
          return `<a class="hz-evc${multi ? ` band${rs ? " s" : ""}${re ? " e" : ""}${rs ? "" : " nl"}` : ""}" data-a="ev" data-id="${e.id}" style="--ec:${esc(e.color || "#ffd36b")}" data-tooltip="${esc(e.name)}">${rs ? fa(e.icon || "fa-star") : ""}<span>${esc(e.name)}</span></a>`; }).join("")}${evs.length > 3 ? `<small>+${evs.length - 3}</small>` : ""}${its.slice(0, 2).map(it => `<a class="hz-jc" data-a="dayItem" data-id="${esc(it.id)}" style="--ec:${esc(it.color || "#e8dcc0")}" data-tooltip="${esc(it.name)}">${fa(it.icon || "fa-newspaper")}<span>${esc(it.name)}</span></a>`).join("")}${its.length > 2 ? `<small>+${its.length - 2} ${fa("fa-newspaper")}</small>` : ""}</div></div>`); }
    return `<div class="hz-grid${mini ? " mini" : ""}" style="--w:${W}">${c.weekdays.map(w => `<span class="hz-wd">${esc(mini ? w.slice(0, 2) : w)}</span>`).join("")}${cells.join("")}</div>`;
  }
  /* ── groupes ── */
  /* ── groupes : un onglet par groupe, le groupe choisi prend toute la fenêtre ── */
  #groups(S) {
    const chars = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner); const P = parties(); const SH = gmShared();
    if (!S.groups.some(x => x.id === this.gsel)) this.gsel = (groupForUser(S) || S.groups[0]).id;
    const g0 = S.groups.find(x => x.id === this.gsel); const gg = gmGroupOf(g0); const g = gg ? { ...g0, users: gg.users || [], actors: gg.actors || [] } : g0;
    const c = calOf(S, g); const dt = toDate(c, timeOf(S, g)); const wk = weatherKey(g.weather?.kind); const mem = new Set(g.actors || []); const se = seasonOf(c, dt, g);
    const tabs = `<div class="hz-gtabs">${S.groups.map(x => `<a data-a="gsel" data-id="${x.id}" class="${x.id === g.id ? "on" : ""}" style="--gc:${esc(x.color || "#5ee0ff")}"><i class="dot"></i>${x.def ? fa("fa-earth-europe") : gmGroupOf(x) ? fa("fa-crown") : ""}<span>${esc(x.name)}</span></a>`).join("")}
      <span class="hz-sp"></span><select data-a="gselx" title="Aller au groupe">${S.groups.map(x => `<option value="${x.id}"${x.id === g.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><a class="hz-btn" style="--bc:#3ddc84" data-a="gnew">${fa("fa-plus")} ${SH ? "Groupe MJ" : "Groupe"}</a></div>`;
    const sec = (icon, title, color, inner, cls = "") => `<section class="hz-gsec ${cls}" style="--sc:${color}"><h4>${fa(icon)} ${title}</h4>${inner}</section>`;
    const themeCard = (k, t, on, label) => `<label class="hz-tht ${k ? thClasses({ theme: k }).join(" ") : thClasses(null).join(" ")}${on ? " on" : ""}"><input type="radio" name="th-${g.id}" data-gf="theme" value="${k}"${on ? " checked" : ""}><span class="hz-thp">${fa(t.icon)}<b>${digits("08:00")}</b></span><small>${esc(label)}</small></label>`;
    const body = `<div class="hz-gpanel" data-g="${g.id}" style="--gc:${esc(g.color || "#5ee0ff")}">
      <header class="hz-gph"><i class="hz-gdot"></i><input class="hz-gn" data-gf="name" value="${esc(g.name)}">${g.def ? `<span class="hz-tag">Groupe par défaut (Monde)</span>` : gg ? `<span class="hz-tag gm">${fa("fa-crown")} Groupe MJ</span>` : ""}
        <span class="hz-gnow"><b>${esc(fmtDate(c, dt))}</b><span>${fmtTime(dt)}</span>${S.combats?.[g.id] ? `<em class="hz-tag red">${SWORD} en combat</em>` : ""}</span>${g.def ? "" : `<a class="hz-x" data-a="gdel" data-tooltip="Supprimer le groupe">${fa("fa-trash")}</a>`}</header>
      <div class="hz-gcol"><span>${fa("fa-palette")} Couleur du groupe</span>${swRow(g.color, `data-gf="color"`)}</div>
      <div class="hz-ggrid">
      ${sec("fa-calendar-check", "Date et heure", "#5ee0ff", `<div class="hz-row hz-set"><input type="number" data-sd="d" value="${dt.d}" min="1" class="w3" title="Jour"><select data-sd="m">${c.months.map((mo, i) => `<option value="${i}"${i === dt.m ? " selected" : ""}>${esc(mo.name)}</option>`).join("")}</select><input type="number" data-sd="y" value="${dt.y}" class="w5" title="Année"><input type="number" data-sd="h" value="${dt.h}" min="0" class="w3" title="Heure">:<input type="number" data-sd="mi" value="${dt.mi}" min="0" class="w3" title="Minutes">:<input type="number" data-sd="s" value="${dt.s}" min="0" class="w3" title="Secondes"><a class="hz-btn sm" style="--bc:#5ee0ff" data-a="gset">${fa("fa-check")} Régler</a></div>
        <div class="hz-steps">${[["Secondes", "s", [1, 5, 10, 15, 30]], ["Minutes", "mi", [1, 5, 10, 15, 30]], ["Heures", "h", [1, 2, 3, 5, 10]], ["Jours", "d", [1, 2, 7]], ["Mois", "mo", [1, 2, 3]], ["Années", "y", [1, 5, 10]]].map(([lab, u, vals]) => `<div class="hz-st"><b>${lab}</b><span class="m">${[...vals].reverse().map(v => `<a data-a="gadv" data-v="${-v}" data-u="${u}">−${v}</a>`).join("")}</span><span class="p">${vals.map(v => `<a data-a="gadv" data-v="${v}" data-u="${u}">+${v}</a>`).join("")}</span></div>`).join("")}</div>`, "wide")}
      ${sec("fa-clock-rotate-left", "Calendrier et temps", "#a46bff", `<div class="hz-row"><label>Calendrier<select data-gf="cal">${S.calendars.map(x => `<option value="${x.id}"${x.id === g.cal ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label></div>

        <label class="hz-sw" data-tooltip="La saison de toute la suite (Boutique, gacha…) suit ce groupe"><input type="radio" name="ref" data-gf="ref"${S.ref === g.id ? " checked" : ""}><span>Groupe de référence (saison de la suite)</span></label>
        <label class="hz-sw feeds"><input type="checkbox" data-gf="feeds"${g.feeds ? " checked" : ""}><span>${fa("fa-link")} Ses nouveaux jours font avancer les modules (Signal Quotidien, boutiques…)</span></label>`)}
      ${sec("fa-cloud-sun", "Météo et saison", "#ffd36b", `<div class="hz-row"><select data-gf="wx">${Object.entries(WEATHER_CATS).map(([ck, cv]) => `<optgroup label="${cv[0]}">${Object.entries(WEATHER).filter(([, v]) => v[3] === ck).map(([k, v]) => `<option value="${k}"${k === wk ? " selected" : ""}>${v[0]}</option>`).join("")}</optgroup>`).join("")}</select><input type="number" data-gf="temp" value="${esc(g.weather?.temp ?? "")}" class="w3"><span>°C</span><a class="hz-btn sm" style="--bc:#a46bff" data-a="groll" data-tooltip="Tirer selon la saison">${fa("fa-dice")}</a></div>
        <div class="hz-row"><label>Saison<select data-gf="seasonOv"><option value="">Automatique (selon la date : ${esc(seasonOf(c, dt)?.name || "—")})</option>${(c.seasons || []).map((x, i) => `<option value="${i}"${g.seasonOv != null && g.seasonOv !== "" && +g.seasonOv === i ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>${se ? `<span class="hz-chipse" style="--sc:${esc(se.color || "#c0c8e0")}">${fa(se.icon || "fa-circle")} ${esc(se.name)}</span>` : ""}</div>`)}
      ${sec("fa-palette", "Thème", "#ff8af0", `<p class="hz-hint">Le thème de la barre du haut et du calendrier pour ce groupe (chez toi quand tu l'affiches, et chez ses joueurs).</p><div class="hz-thr">${themeCard("", THEMES[defaultTheme()], !THEMES[g.theme], `Par défaut (${THEMES[defaultTheme()].name})`)}${Object.entries(THEMES).map(([k, t]) => themeCard(k, t, g.theme === k, t.name)).join("")}</div>`, "wide")}
      ${g.def ? sec("fa-users", "Membres", "#3ddc84", `<p class="hz-hint">Les personnages qui ne sont dans aucun autre groupe suivent ce groupe.</p>`, "wide") : sec("fa-users", "Membres", "#3ddc84", `${SH ? "" : `<div class="hz-row"><label>Groupe du Menu<select data-gf="party"><option value="">— aucun —</option>${P.map(p => `<option value="${p.id}"${p.id === g.party ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>`}
        <div class="hz-row"><b>${fa("fa-user-group")} Joueurs</b><small class="hz-hint">tous leurs personnages entrent dans le groupe</small></div>
        <div class="hz-mem">${game.users.filter(u => !u.isGM).map(u => { const on = (g.users || []).includes(u.id); const n = userChars(u).length; return `<label class="hz-chip pl${on ? " on" : ""}"><input type="checkbox" data-gu="${u.id}"${on ? " checked" : ""}><img src="${esc(u.avatar || "icons/svg/mystery-man.svg")}"><span>${esc(u.name)}</span><em>${n} perso${n > 1 ? "s" : ""}</em></label>`; }).join("") || `<span class="hz-hint">Aucun joueur.</span>`}</div>
        <div class="hz-row"><b>${fa("fa-user")} Personnages</b></div>
        <div class="hz-mem">${chars.map(a => `<label class="hz-chip${mem.has(a.uuid) ? " on" : ""}${membersOf(g).includes(a.uuid) && !mem.has(a.uuid) ? " via" : ""}"><input type="checkbox" data-gm="${a.uuid}"${mem.has(a.uuid) ? " checked" : ""}><img src="${esc(a.img)}"><span>${esc(a.name)}</span></label>`).join("")}</div>`, "wide")}
      </div></div>`;
    return tabs + body;
  }
  /* ── calendriers ── */
  #cals(S) {
    const c = S.calendars.find(x => x.id === this.calSel) || S.calendars[0]; this.calSel = c.id; const used = S.groups.filter(g => g.cal === c.id).length;
    const row = (k, i, inner) => `<div class="hz-crow" data-l="${k}" data-i="${i}">${inner}<a class="hz-mv" data-a="cmv" data-d="-1">${fa("fa-chevron-up")}</a><a class="hz-mv" data-a="cmv" data-d="1">${fa("fa-chevron-down")}</a><a class="hz-x" data-a="cdel">${fa("fa-xmark")}</a></div>`;
    return `<div class="hz-cals"><aside>${S.calendars.map(x => `<a data-a="csel" data-id="${x.id}" class="${x.id === c.id ? "on" : ""}">${fa("fa-calendar")} ${esc(x.name)}</a>`).join("")}
      <a class="hz-btn" style="--bc:#a46bff" data-a="cnew" data-k="greg">${fa("fa-plus")} Grégorien</a><a class="hz-btn" style="--bc:#a46bff" data-a="cnew" data-k="simple">${fa("fa-plus")} Simple</a><a class="hz-btn" style="--bc:#5ee0ff" data-a="cdup">${fa("fa-copy")} Dupliquer</a>${used ? "" : `<a class="hz-btn" style="--bc:#ff5d6c" data-a="crm">${fa("fa-trash")} Supprimer</a>`}</aside>
      <div class="hz-ced" data-cal="${c.id}">
        <div class="hz-row"><label>Nom du calendrier<input data-cf="name" value="${esc(c.name)}"></label><label>Nom de l'année / ère<input data-cf="era" value="${esc(c.era || "")}" placeholder="ex. de l'Ère Stellaire"></label></div>
        <div class="hz-row"><label>Heures / jour<input type="number" data-cf="hpd" value="${c.hpd}" class="w3"></label><label>Minutes / heure<input type="number" data-cf="mph" value="${c.mph}" class="w3"></label><label>Secondes / minute<input type="number" data-cf="spm" value="${c.spm}" class="w3"></label>
          <label>Année bissextile tous les<input type="number" data-cf="leapEvery" value="${c.leapEvery || 0}" class="w3"></label><label>Jour ajouté au mois<select data-cf="leapMonth">${c.months.map((m, i) => `<option value="${i}"${i === +c.leapMonth ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
          <label>Décalage de la semaine<input type="number" data-cf="firstWeekday" value="${c.firstWeekday || 0}" class="w3"></label></div>
        <h4>${fa("fa-calendar-week")} Mois <small>${c.months.reduce((t, m) => t + (+m.days || 0), 0)} jours</small></h4><div class="hz-list">${c.months.map((m, i) => row("months", i, `<input data-lf="name" value="${esc(m.name)}"><input type="number" data-lf="days" value="${m.days}" class="w3"><span>jours</span>`)).join("")}<a class="hz-add" data-a="cadd" data-l="months">${fa("fa-plus")} Mois</a></div>
        <h4>${fa("fa-calendar-day")} Jours de la semaine</h4><div class="hz-list">${c.weekdays.map((w, i) => row("weekdays", i, `<input data-lf="_" value="${esc(w)}">`)).join("")}<a class="hz-add" data-a="cadd" data-l="weekdays">${fa("fa-plus")} Jour</a></div>
        <h4>${fa("fa-cloud-sun")} Saisons</h4><div class="hz-list">${(c.seasons || []).map((s, i) => row("seasons", i, `<input type="color" data-lf="color" value="${esc(s.color || "#ffffff")}"><input data-lf="name" value="${esc(s.name)}"><select data-lf="type">${Object.entries(SEASON_TYPES).map(([k, v]) => `<option value="${k}"${k === (s.type || "") ? " selected" : ""}>${v[0]}</option>`).join("")}</select><span>début</span><input type="number" data-lf="day" value="${s.day}" class="w3"><select data-lf="month">${c.months.map((m, j) => `<option value="${j}"${j === +s.month ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select><input data-lf="icon" value="${esc(s.icon || "")}" class="w8" placeholder="fa-sun"><i class="fa-solid ${esc(s.icon || "fa-circle")}" style="color:${esc(s.color)}"></i>`)).join("")}<a class="hz-add" data-a="cadd" data-l="seasons">${fa("fa-plus")} Saison</a></div>
        <h4>${fa("fa-moon")} Lunes</h4><div class="hz-list">${(c.moons || []).map((mo, i) => row("moons", i, `<input type="color" data-lf="color" value="${esc(mo.color || "#dfe6ff")}"><input data-lf="name" value="${esc(mo.name)}"><span>cycle</span><input type="number" step="0.01" data-lf="cycle" value="${mo.cycle}" class="w5"><span>jours, décalage</span><input type="number" data-lf="offset" value="${mo.offset || 0}" class="w3">`)).join("")}<a class="hz-add" data-a="cadd" data-l="moons">${fa("fa-plus")} Lune</a></div>
      </div></div>`;
  }
  /* ── réglages ── */
  #opts(S) {
    const cal = !!globalThis.CALENDARIA?.api;
    const dT = defaultTheme();
    return `<div class="hz-opts"><div class="hz-card2"><h3>${fa("fa-palette")} Thème par défaut</h3><p class="hz-hint">Celui de la barre et du calendrier quand un groupe n'a pas de thème à lui (onglet Groupes › Thème). Quand tu choisis un groupe dans la barre, c'est son thème qui s'affiche.</p>
        <div class="hz-thr">${Object.entries(THEMES).map(([k, t]) => `<a class="hz-tht ${thClasses({ theme: k }).join(" ")}${k === dT ? " on" : ""}" data-a="thdef" data-k="${k}"><span class="hz-thp">${fa(t.icon)}<b>${digits("08:00")}</b></span><small>${esc(t.name)}</small></a>`).join("")}</div></div>
      ${this.#optCards().bar}
      <div class="hz-card2"><h3>${fa("fa-gauge-high")} Vitesse du temps</h3><div class="hz-row"><label>1 seconde réelle =<input type="number" step="0.1" min="0.1" data-of="rate" value="${S.rate || 1}" class="w5"></label><span>seconde(s) de jeu</span>
        ${[1, 10, 60, 600].map(r => `<a class="hz-btn sm" style="--bc:#5ee0ff" data-a="rate" data-v="${r}">×${r}</a>`).join("")}</div><p class="hz-hint">×60 : une minute de jeu par seconde réelle. Le temps défile seulement quand le MJ est en Lecture (et, si le réglage est actif, quand Foundry n'est pas en pause).</p></div>
      <div class="hz-card2"><h3>${fa("fa-file-import")} Reprendre depuis Calendaria</h3>${cal ? `<p>Calendaria est actif. L'import reprend le calendrier (mois, jours, heures, saisons, lunes), la date et l'heure actuelles, la météo et les fêtes, pour le groupe par défaut.</p><a class="hz-btn" style="--bc:#ffb23d" data-a="import">${fa("fa-file-import")} Importer maintenant</a><p class="hz-hint">Ensuite, tu peux désactiver Calendaria (et Hourglass) dans la gestion des modules.</p>` : `<p class="hz-hint">Calendaria n'est pas actif dans ce monde.</p>`}</div>
      <div class="hz-card2"><h3>${fa("fa-plug")} Pour les autres modules</h3><p class="hz-hint">Chaque changement de jour envoie « horlogiaNewDay ». Seuls les groupes cochés « font avancer les modules » envoient aussi « manhwaNewDay » (Signal Quotidien, boutiques…). La saison de la suite suit le groupe de référence.</p><a class="hz-btn" style="--bc:#9fb0d4" data-a="fsettings">${fa("fa-gear")} Autres réglages (Foundry)</a></div></div>`;
  }

  /* 1.9 — sections Barre du haut, Horloge de combat, Météo, Saison, Compteurs */
  #optCards() {
    const O = k => opt(k); const set = (k, v) => v; let pp = "right"; try { pp = game.settings.get(MOD, "playPos") || "right"; } catch (e) {}
    const sel = (k, cur, L) => `<select data-o="${k}">${L.map(([v, n]) => `<option value="${v}"${String(cur) === String(v) ? " selected" : ""}>${n}</option>`).join("")}</select>`;
    const sw = (k, on, txt, extra = "") => `<label class="hz-sw"><input type="checkbox" data-o="${k}"${on ? " checked" : ""}${extra}><span>${txt}</span></label>`;
    const row = (lab, ctl, hint = "") => `<div class="hz-orow"><span>${lab}</span><div>${ctl}</div>${hint ? `<small>${hint}</small>` : ""}</div>`;
    const list = (k, v) => `<input type="text" data-o="${k}" data-list="1" value="${esc((v || []).join(", "))}" class="w12">`;
    const card = (ic, c, t, body) => `<div class="hz-card2 hz-oc" style="--oc:${c}"><h3>${fa(ic)} ${t}</h3>${body}</div>`;
    const cats = (k, cur) => `<div class="hz-ochk">${Object.entries(WEATHER_CATS).map(([ck, [n, ic]]) => `<label><input type="checkbox" data-o="${k}" data-arr="${ck}"${(cur || []).includes(ck) ? " checked" : ""}>${fa(ic)}<span>${n}</span></label>`).join("")}</div>`;
    const out = { bar: card("fa-window-maximize", "#5ee0ff", "Barre du haut",
        row("Bouton Play / Pause", `<select data-pp="1">${[["right", "À droite de la barre"], ["next", "Juste à côté de l'heure"], ["on", "Petit bouton posé sur l'heure"]].map(([v, n]) => `<option value="${v}"${pp === v ? " selected" : ""}>${n}</option>`).join("")}</select>`, "Réglage propre à ton écran de MJ.")
        + `<label class="hz-sw"><input type="checkbox" data-hudp="1"${game.settings.get(MOD, "hudPlayers") !== false ? " checked" : ""}><span>Barre visible des joueurs</span></label>`
        + `<a class="hz-btn sm" style="--bc:#5ee0ff" data-a="hudreset">${fa("fa-arrows-to-dot")} Remettre la barre au centre</a>`)
      , combat: card("fa-khanda", "#ff5d6c", "Horloge de combat",
        row("Boutons de temps (secondes)", list("cSteps", O("cSteps")), "Séparés par des virgules, jusqu'à 12. Chacun existe en + et en −.")
        + row("Alerte « presque fini »", sel("cWarn", O("cWarn"), [[0, "Désactivée"], [5, "5 dernières secondes"], [10, "10 dernières secondes"], [15, "15 dernières secondes"], [30, "30 dernières secondes"], [60, "Dernière minute"]]))
        + row("Son de fin", sel("cSound", O("cSound"), [["sounds/notify.wav", "Notification"], ["sounds/drums.wav", "Tambours"], ["sounds/lock.wav", "Déclic"], ["sounds/dice.wav", "Dés"], ["none", "Aucun"]]) + `<input type="range" min="0" max="1" step="0.05" data-o="cVol" value="${+O("cVol")}" class="hz-vol">`)
        + row("Taille du chrono", sel("cSize", O("cSize"), [["s", "Compact"], ["m", "Normal"], ["l", "Grand"]]))
        + row("Position à l'ouverture", sel("cPos", O("cPos"), [["top", "En haut au centre"], ["center", "Au centre de l'écran"], ["last", "Là où je l'ai laissé"]]))
        + sw("cGlow", O("cGlow"), "Lueur néon à la fin du compte à rebours"))
      , wx: card("fa-cloud-sun", "#ffd36b", "Météo",
        `<label class="hz-sw"><input type="checkbox" data-aw="1"${game.settings.get(MOD, "autoWeather") ? " checked" : ""}><span>Tirer une météo à chaque nouveau jour (selon la saison)</span></label>`
        + row("Catégories du tirage au hasard", cats("wRoll", O("wRoll")))
        + row("Catégories affichées dans la bulle", cats("wShow", O("wShow")), "Décoche celles que tu n'utilises pas.")
        + row("Unité", sel("wUnit", O("wUnit"), [["C", "Degrés Celsius (°C)"], ["F", "Degrés Fahrenheit (°F)"]]))
        + row("Boutons des degrés", list("wSteps", O("wSteps")), "Jusqu'à 5, chacun en + (vert) et en − (rouge).")
        + sw("wTint", O("wTint"), "Teinter la case météo de la barre à la couleur de la météo")
        + sw("wTempP", O("wTempP"), "Température visible des joueurs"))
      , sea: card("fa-leaf", "#7fdc8a", "Saison",
        `<label class="hz-sw"><input type="checkbox" data-sefx="1"${game.settings.get(MOD, "seasonFx") !== false ? " checked" : ""}><span>Effet de saison sur la barre (neige, feuilles, soleil…)</span></label>`
        + row("Intensité de l'effet", sel("sLvl", O("sLvl"), [["l", "Légère"], ["m", "Normale"], ["h", "Forte"]]))
        + sw("sShow", O("sShow"), "Saison affichée dans la barre du haut")
        + sw("sPop", O("sPop"), "Saison modifiable depuis la bulle météo")
        + `<a class="hz-btn sm" style="--bc:#7fdc8a" data-a="goseasons">${fa("fa-calendar-plus")} Dates, couleurs et icônes des saisons</a>`)
      , cnt: card("fa-list-ol", "#a46bff", "Compteurs",
        `<a class="hz-btn" style="--bc:#a46bff" data-a="cntcats">${fa("fa-sliders")} Gérer les catégories</a>`
        + row("Pas avec la touche Maj", `<input type="number" min="1" max="1000" data-o="kShift" value="${+O("kShift")}" class="w5">`)
        + row("Abréger à partir de", `<input type="number" min="1000" step="1000" data-o="kAbbr" value="${+O("kAbbr")}" class="w8">`, "Au-delà : 150K, 1,2M…")
        + row("Taille du panneau", sel("kSize", O("kSize"), [["s", "Compact"], ["m", "Normal"]]))
        + sw("kDefEdit", O("kDefEdit"), "Nouveaux groupes : les joueurs peuvent modifier les compteurs")
        + `<a class="hz-btn sm" style="--bc:#a46bff" data-a="cntpos">${fa("fa-arrows-to-dot")} Remettre le panneau à sa place</a>`) }; return out;
  }

  _replaceHTML(html, content) {
    const prevBody = content.querySelector(".hz-body"); const keep = prevBody && this._lastTab === this.tab ? prevBody.scrollTop : 0; this._lastTab = this.tab;
    content.innerHTML = html; { const nb = content.querySelector(".hz-body"); if (nb && keep) nb.scrollTop = keep; } { const on = new Set(this._neutral ? [] : this._thcs || []); for (const k of Object.keys(THEMES)) this.element?.classList.toggle(`hz-th-${k}`, on.has(`hz-th-${k}`)); this.element?.classList.toggle("hz-neutral", !!this._neutral); } if (content.dataset.hzBound) return; content.dataset.hzBound = "1";
    content.addEventListener("click", ev => { const a = ev.target.closest("[data-a]"); if (a) { ev.preventDefault(); this.#act(a, ev); } });
    content.addEventListener("change", ev => this.#change(ev.target));
    /* sélection de jours : clic, glisser ou Maj + clic ; puis « Créer un événement » */
    content.addEventListener("pointerdown", ev => { const day = ev.target.closest(".hz-day"); if (!day || !game.user.isGM || ev.target.closest("[data-a]") || ev.button !== 0) return; ev.preventDefault(); const grid = day.parentElement;
      const d = +day.dataset.d; const v = this.view; const keepA = ev.shiftKey && this.sel && this.sel.y === v.y && this.sel.m === v.m ? this.sel.a0 : d; let d1 = d;
      const mark = () => { const lo = Math.min(keepA, d1), hi = Math.max(keepA, d1); grid.querySelectorAll(".hz-day").forEach(x => x.classList.toggle("sel", +x.dataset.d >= lo && +x.dataset.d <= hi)); }; mark();
      const mv = e => { const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".hz-day"); if (t && t.parentElement === grid && +t.dataset.d !== d1) { d1 = +t.dataset.d; mark(); } };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); this.sel = { y: v.y, m: v.m, a0: keepA, a: Math.min(keepA, d1), b: Math.max(keepA, d1) }; this.render(); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); });
    content.addEventListener("dblclick", ev => { const day = ev.target.closest(".hz-day"); if (!day || !game.user.isGM || ev.target.closest("[data-a]")) return; const d = +day.dataset.d; this.sel = null; this.#evDialog(null, { d, dur: 1 }); });
  }
  async #act(a, ev) {
    const k = a.dataset.a; const S = state(); const api = globalThis.HORLOGIA;
    const G = () => S.groups.find(x => x.id === a.closest("[data-g]")?.dataset.g);
    switch (k) {
      case "tab": this.tab = a.dataset.k; return this.render();
      case "play": return api.setPlay(!S.play);
      case "combat": return api.combat.toggle();
      case "cntcats": return api.counters.categories();
      case "hudreset": { await game.user.unsetFlag(MOD, "hudPos"); const h = document.getElementById("horlogia-hud"); if (h) { h.style.left = ""; h.style.top = ""; h.style.transform = ""; } return; }
      case "cntpos": { await game.settings.set(MOD, "cntPos", null); document.getElementById("horlogia-cnt")?.remove(); return api.counters.render(); }
      case "goseasons": this.tab = "cals"; return this.render();
      case "prev": case "next": { const d = k === "next" ? 1 : -1; const g = S.groups.find(x => x.id === this.view.g); const c = calOf(S, g); if (this.mode === "year") this.view.y += d; else { this.view.m += d; if (this.view.m < 0) { this.view.m = c.months.length - 1; this.view.y--; } if (this.view.m >= c.months.length) { this.view.m = 0; this.view.y++; } } return this.render(); }
      case "today": this.view = null; return this.render();
      case "mode": this.mode = a.dataset.k; return this.render();
      case "gom": this.view.m = +a.dataset.m; this.mode = "month"; return this.render();
      case "dayItem": { ev?.stopPropagation?.(); const it = this._dayIt?.get(a.dataset.id); return it?.open?.(); }
      case "ev": return this.#evDialog(S.events.find(e => e.id === a.dataset.id));
      case "evNew": { const sl = this.sel && this.sel.y === this.view?.y && this.sel.m === this.view?.m ? this.sel : null; this.sel = null; return this.#evDialog(null, sl ? { d: sl.a, dur: sl.b - sl.a + 1 } : { d: today1(S, this.view), dur: 1 }); }
      case "selx": this.sel = null; return this.render();
      case "goDay": { const sl = this.sel; if (!sl) return; const g = S.groups.find(x => x.id === this.view?.g) || groupForUser(S); const c = calOf(S, g); const dt = toDate(c, timeOf(S, g)); this.sel = null;
        await globalThis.HORLOGIA.setDate(g.id, { y: sl.y, m: sl.m, d: sl.a, h: dt.h, mi: dt.mi, s: dt.s }); return this.render(); }
      case "gnew": if (gmShared()) { await globalThis.MANHWA.gmGroups.create({}); return; } { const def = S.groups.find(x => x.def) || S.groups[0]; return edit(S2 => { S2.groups.push({ id: uid(), name: "Nouveau groupe", color: COLORS[S2.groups.length % COLORS.length], theme: def.theme || "spatial", cal: def.cal, t: def.t, run: true, weather: { ...def.weather }, party: "", actors: [], users: [], feeds: false }); }); }
      case "gdel": { const g = G(); if (!g || g.def) return; if (!await DialogV2.confirm({ window: { title: "Supprimer le groupe" }, classes: ["hz-dialog", ...(this._thcs || ["hz-th-spatial"])], content: `<p>Supprimer <b>${esc(g.name)}</b> ? Ses membres suivront le groupe par défaut.${gmGroupOf(g) ? " C'est un Groupe MJ : il disparaît aussi de la Boutique, des Portraits et des Scénarios." : ""}</p>` })) return; if (gmGroupOf(g)) return globalThis.MANHWA.gmGroups.remove(g.id); return edit(S2 => { S2.groups = S2.groups.filter(x => x.id !== g.id); if (S2.ref === g.id) S2.ref = S2.groups[0].id; }); }
      case "gset": { const box = a.closest("[data-g]"); const v = n => +box.querySelector(`[data-sd="${n}"]`).value || 0; return api.setDate(box.dataset.g, { y: v("y"), m: v("m"), d: Math.max(1, v("d")), h: v("h"), mi: v("mi"), s: v("s") }); }
      case "gadv": { const g = G(); const c = calOf(S, g); const n = +a.dataset.v; const u = a.dataset.u; const dt = toDate(c, timeOf(S, g));
        if (u === "mo" || u === "y") { let y = dt.y, m = dt.m; if (u === "y") y += n; else { m += n; const L = c.months.length; while (m < 0) { m += L; y--; } while (m >= L) { m -= L; y++; } } return api.setDate(g.id, { y, m, d: Math.min(dt.d, daysIn(c, y, m)), h: dt.h, mi: dt.mi, s: dt.s }); }
        const sec = u === "s" ? n : u === "mi" ? n * (c.spm || 60) : u === "h" ? n * (c.mph || 60) * (c.spm || 60) : n * secondsPerDay(c); return api.advance(g.id, sec); }
      case "groll": { const g = G(); const c = calOf(S, g); const se = seasonOf(c, toDate(c, timeOf(S, g)), g); return edit(S2 => { const x = S2.groups.find(y => y.id === g.id); if (x) x.weather = rollWeather(se?.type || ""); }); }
      case "gsel": this.gsel = a.dataset.id; return this.render();
      case "thdef": await game.settings.set(MOD, "themeDefault", a.dataset.k); return this.render();
      case "csel": this.calSel = a.dataset.id; return this.render();
      case "cnew": { const c = a.dataset.k === "simple" ? simpleCalendar() : { ...defaultCalendar(), id: uid(), name: "Nouveau calendrier" }; this.calSel = c.id; return edit(S2 => { S2.calendars.push(c); }); }
      case "cdup": { const c = foundry.utils.deepClone(S.calendars.find(x => x.id === this.calSel)); c.id = uid(); c.name += " (copie)"; this.calSel = c.id; return edit(S2 => { S2.calendars.push(c); }); }
      case "crm": return edit(S2 => { if (S2.calendars.length < 2 || S2.groups.some(g => g.cal === this.calSel)) return false; S2.calendars = S2.calendars.filter(x => x.id !== this.calSel); this.calSel = null; });
      case "cadd": return edit(S2 => { const c = S2.calendars.find(x => x.id === this.calSel); const l = a.dataset.l; if (l === "months") c.months.push({ name: `Mois ${c.months.length + 1}`, days: 30 }); else if (l === "weekdays") c.weekdays.push(`Jour ${c.weekdays.length + 1}`); else if (l === "seasons") (c.seasons ||= []).push({ name: "Saison", type: "", month: 0, day: 1, color: "#c0c8e0", icon: "fa-circle" }); else (c.moons ||= []).push({ name: "Lune", cycle: 28, offset: 0, color: "#dfe6ff" }); });
      case "cdel": case "cmv": { const r = a.closest("[data-l]"); const l = r.dataset.l, i = +r.dataset.i; return edit(S2 => { const c = S2.calendars.find(x => x.id === this.calSel); const L = c[l]; if (!L) return false; if (k === "cdel") { if ((l === "months" || l === "weekdays") && L.length < 2) return false; L.splice(i, 1); } else { const j = i + +a.dataset.d; if (j < 0 || j >= L.length) return false; [L[i], L[j]] = [L[j], L[i]]; } }); }
      case "rate": return edit(S2 => { S2.rate = +a.dataset.v; });
      case "import": return importCalendaria();
      case "fsettings": { const SC = foundry.applications.settings?.SettingsConfig ?? globalThis.SettingsConfig; return new SC().render({ force: true }); }
    }
  }
  #change(el) {
    const S = state();
    if (el.dataset.sefx) return game.settings.set(MOD, "seasonFx", el.checked);
    if (el.dataset.pp) return game.settings.set(MOD, "playPos", el.value);
    if (el.dataset.hudp) return game.settings.set(MOD, "hudPlayers", el.checked);
    if (el.dataset.aw) return game.settings.set(MOD, "autoWeather", el.checked);
    if (el.dataset.o) { const k = el.dataset.o; const O = foundry.utils.deepClone(game.settings.get(MOD, "opts") || {}); let v;
      if (el.dataset.arr) { const cur = new Set(opt(k) || []); el.checked ? cur.add(el.dataset.arr) : cur.delete(el.dataset.arr); v = [...cur]; }
      else if (el.dataset.list) v = el.value.split(/[,;\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
      else if (el.type === "checkbox") v = el.checked; else if (el.type === "number" || el.type === "range") v = +el.value;
      else v = /^\d+$/.test(el.value) && k === "cWarn" ? +el.value : el.value;
      O[k] = v; return game.settings.set(MOD, "opts", O); }
    if (el.dataset.a === "gselx") { this.gsel = el.value; return this.render(); }
    if (el.dataset.a === "vg") { this.view = { g: el.value }; const g = S.groups.find(x => x.id === el.value); const c = calOf(S, g); const d = toDate(c, timeOf(S, g)); this.view = { g: g.id, y: d.y, m: d.m }; return this.render(); }
    const gbox = el.closest("[data-g]");
    if (el.dataset.gf && gbox) { const f = el.dataset.gf; if ((f === "name" || f === "color") && el.value.trim() && gmGroupOf({ id: gbox.dataset.g })) globalThis.MANHWA.gmGroups.edit(l => { const x = l.find(y => y.id === gbox.dataset.g); if (!x) return false; x[f] = el.value.trim(); }); return edit(S2 => { const g = S2.groups.find(x => x.id === gbox.dataset.g); if (!g) return false;
      if (f === "ref") S2.ref = g.id; else if (f === "run" || f === "feeds") g[f] = el.checked; else if (f === "wx") g.weather = { ...(g.weather || {}), kind: el.value }; else if (f === "temp") g.weather = { ...(g.weather || {}), temp: el.value === "" ? null : +el.value }; else if (f === "seasonOv") g.seasonOv = el.value === "" ? null : +el.value; else if (f === "theme") g.theme = el.value || "";
      else if (f === "cal") { const old = calOf(S2, g); const nc = S2.calendars.find(x => x.id === el.value); const day = Math.floor(g.t / secondsPerDay(old)); g.cal = el.value; g.t = day * secondsPerDay(nc); } else g[f] = el.value; }); }
    if ((el.dataset.gu || el.dataset.gm) && gbox && gmGroupOf({ id: gbox.dataset.g })) return globalThis.MANHWA.gmGroups.setMember(gbox.dataset.g, el.dataset.gu ? "user" : "actor", el.dataset.gu || el.dataset.gm, el.checked, true).then(() => this.render());
    if (el.dataset.gu && gbox) return edit(S2 => { const g = S2.groups.find(x => x.id === gbox.dataset.g); if (!g) return false; const s = new Set(g.users || []); const id = el.dataset.gu;
      if (el.checked) { s.add(id); for (const o of S2.groups) if (o.id !== g.id) o.users = (o.users || []).filter(u => u !== id); } else s.delete(id); g.users = [...s]; });
    if (el.dataset.gm && gbox) return edit(S2 => { const g = S2.groups.find(x => x.id === gbox.dataset.g); if (!g) return false; const s = new Set(g.actors || []); if (el.checked) { s.add(el.dataset.gm); for (const o of S2.groups) if (o.id !== g.id) o.actors = (o.actors || []).filter(u => u !== el.dataset.gm); } else s.delete(el.dataset.gm); g.actors = [...s]; });
    if (el.dataset.cf) return edit(S2 => { const c = S2.calendars.find(x => x.id === this.calSel); const f = el.dataset.cf; c[f] = el.type === "number" || f === "leapMonth" ? +el.value : el.value; });
    if (el.dataset.lf) { const r = el.closest("[data-l]"); const l = r.dataset.l, i = +r.dataset.i, f = el.dataset.lf; return edit(S2 => { const c = S2.calendars.find(x => x.id === this.calSel); const L = c[l]; if (!L?.[i] && L?.[i] !== "") return false;
      if (f === "_") L[i] = el.value; else L[i][f] = el.type === "number" || f === "month" ? +el.value : el.value; }); }
    if (el.dataset.of === "rate") return edit(S2 => { S2.rate = Math.max(.1, +el.value || 1); });
  }
  /* événement : création / modification (MJ) ou lecture (joueur) */
  async #evDialog(e, pre = {}) {
    const S = state(); const g = S.groups.find(x => x.id === this.view?.g) || groupForUser(S); const c = calOf(S, g); const gm = game.user.isGM;
    if (!gm) { if (e) DialogV2.prompt({ window: { title: e.name, icon: `fa-solid ${e.icon || "fa-star"}` }, classes: ["hz-dialog", ...(this._thcs || ["hz-th-spatial"])], content: `<p>${esc(e.desc || "")}</p>`, ok: { label: "Fermer" }, rejectClose: false }); return; }
    const x = e || { id: uid(), name: "", color: "#ffd36b", icon: "fa-star", desc: "", cal: c.id, y: this.view.y, m: this.view.m, d: pre.d || 1, dur: pre.dur || 1, groups: [], hidden: false, custom: true };
    const content = `<div class="hz-form hz-evf"><label>Nom de la fête ou de l'événement<input name="name" value="${esc(x.name)}" autofocus placeholder="ex. Fête des Lanternes"></label>
      <h5>Couleur dans l'agenda</h5>${swRow(x.color, `name="color"`)}
      <div class="hz-row"><label>Du jour<input type="number" name="d" value="${x.d}" min="1" class="w3"></label><label>Mois<select name="m">${c.months.map((mo, i) => `<option value="${i}"${i === +x.m ? " selected" : ""}>${esc(mo.name)}</option>`).join("")}</select></label><label>Année<input type="number" name="y" value="${x.y ?? ""}" placeholder="chaque année" class="w5"></label><label>Durée (jours)<input type="number" name="dur" value="${x.dur || 1}" min="1" class="w3"></label></div>
      <h5>Icône</h5><div class="hz-ig">${ICONS.map(i => `<label><input type="radio" name="icon" value="${i}"${i === x.icon ? " checked" : ""}>${fa(i)}</label>`).join("")}</div>
      <label>Description <small>(facultatif)</small><textarea name="desc">${esc(x.desc || "")}</textarea></label>
      <h5>Groupes concernés <small>(aucun coché = tous, fête partagée)</small></h5><div class="hz-row">${S.groups.map(gg => `<label class="hz-sw"><input type="checkbox" name="g" value="${gg.id}"${x.groups?.includes(gg.id) ? " checked" : ""}><span>${esc(gg.name)}</span></label>`).join("")}<label class="hz-sw"><input type="checkbox" name="hidden"${x.hidden ? " checked" : ""}><span>${fa("fa-eye-slash")} Caché aux joueurs</span></label></div></div>`;
    const btns = [{ action: "ok", label: e ? "Enregistrer" : "Créer", icon: "fa-solid fa-check", default: true, callback: (ev, b) => { const f = b.form.elements; return { name: f.name.value.trim() || "Événement", desc: f.desc.value.trim(), d: +f.d.value || 1, m: +f.m.value, y: f.y.value === "" ? null : +f.y.value, dur: Math.max(1, +f.dur.value || 1),
      color: f.color.value, icon: b.form.querySelector('[name="icon"]:checked')?.value || "fa-star", groups: [...b.form.querySelectorAll('[name="g"]:checked')].map(i => i.value), hidden: f.hidden.checked }; } }];
    if (e) btns.push({ action: "del", label: "Supprimer", icon: "fa-solid fa-trash" });
    const r = await DialogV2.wait({ window: { title: e ? "Événement" : (pre.dur > 1 ? `Nouvel événement sur ${pre.dur} jours` : "Nouvel événement"), icon: "fa-solid fa-champagne-glasses" }, classes: ["hz-dialog", ...(this._thcs || ["hz-th-spatial"])], position: { width: 560 }, content, buttons: btns, rejectClose: false });
    if (!r) return; if (r === "del") return edit(S2 => { S2.events = S2.events.filter(y => y.id !== x.id); });
    return edit(S2 => { const i = S2.events.findIndex(y => y.id === x.id); const n = { ...x, ...r, cal: x.cal || c.id }; if (i >= 0) S2.events[i] = n; else S2.events.push(n); });
  }
}

function today1(S, v) { const g = S.groups.find(x => x.id === v?.g) || groupForUser(S); const c = calOf(S, g); const t = toDate(c, timeOf(S, g)); return t.y === v?.y && t.m === v?.m ? t.d : 1; }
/* ── import depuis Calendaria ── */
const L = s => { try { return game.i18n.localize(String(s ?? "")); } catch (e) { return String(s ?? ""); } };
const vals = o => Array.isArray(o) ? o : Object.values(o?.values ?? o ?? {});
export async function importCalendaria() {
  const A = globalThis.CALENDARIA?.api; if (!A || !game.user.isGM) return;
  try {
    const cal = A.getActiveCalendar(); const months = vals(cal.months).map(m => ({ name: L(m.name), days: +m.days || 30 })); const weekdays = vals(cal.days).map(d => L(d.name));
    const c = { id: "calendaria", name: L(cal.name) || "Calendrier importé", era: "", months, weekdays: weekdays.length ? weekdays : defaultCalendar().weekdays, hpd: +cal.days?.hoursPerDay || 24, mph: +cal.days?.minutesPerHour || 60, spm: +cal.days?.secondsPerMinute || 60,
      leapEvery: +cal.years?.leapYear?.leapInterval || 0, leapMonth: Math.max(0, vals(cal.months).findIndex(m => +m.leapDays > 0)), firstWeekday: 0,
      seasons: vals(cal.seasons).map(s => ({ name: L(s.name), type: s.seasonalType || "", month: +s.monthStart || 0, day: (+s.dayStart || 0) + 1, color: s.color || "#c0c8e0", icon: String(s.icon || "fa-circle").replace(/^fas\s+|^fa-solid\s+/, "") })),
      moons: vals(cal.moons).map(m => ({ name: L(m.name), cycle: +m.cycleLength || 29.53, offset: 0, color: m.color || "#dfe6ff" })) };
    if (c.leapMonth < 0) c.leapMonth = 1;
    const comp = game.time.calendar?.timeToComponents?.(game.time.worldTime) || {}; const yz = +cal.years?.yearZero || 0;
    const date = { y: (+comp.year || 0) + yz, m: +comp.month || 0, d: (+comp.dayOfMonth || 0) + 1, h: +comp.hour || 0, mi: +comp.minute || 0, s: +comp.second || 0 };
    { const W = c.weekdays.length || 7; let anchorWd = null, anchorDi = null;
      if (Number.isInteger(comp.dayOfWeek)) { anchorWd = comp.dayOfWeek; anchorDi = toDate(c, fromDate(c, date)).dayIndex; }
      else if (Number.isFinite(+cal.years?.firstWeekday)) { anchorWd = +cal.years.firstWeekday; anchorDi = toDate(c, fromDate(c, { y: yz, m: 0, d: 1, h: 0, mi: 0, s: 0 })).dayIndex; }
      if (anchorWd != null) c.firstWeekday = (((anchorWd - anchorDi) % W) + W) % W; }
    const evs = vals(cal.festivals).map(f => ({ id: uid(), name: L(f.name), desc: L(f.description || ""), color: f.color || "#ffd36b", icon: String(f.icon || "fa-star").replace(/^fas\s+|^fa-solid\s+/, ""), cal: c.id, y: null, m: +f.month || 0, d: (+f.dayOfMonth || 0) + 1, dur: +f.duration || 1, groups: [], hidden: false }));
    /* notes Calendaria : mois et jour comptés à partir de 1 ; on saute celles qui doublonnent une fête déjà importée */
    const fest = new Set(evs.map(e => `${e.name.toLowerCase()}|${e.m}|${e.d}`));
    let notes = 0; try { for (const n of A.getAllNotes?.() || []) { const f = n.flagData || {}; const sd = f.startDate || n.startDate || n.system?.startDate; if (!sd || !Number.isFinite(+sd.year)) continue;
      const m = Math.max(0, (+sd.month || 1) - 1), d = Math.max(1, +sd.day || 1); const name = n.name || "Note";
      if (fest.has(`${name.toLowerCase()}|${m}|${d}`)) continue;
      let dur = 1; try { const ed = f.endDate; if (ed && Number.isFinite(+ed.year)) { const a = fromDate(c, { y: +sd.year, m, d, h: 0, mi: 0, s: 0 }), b = fromDate(c, { y: +ed.year, m: Math.max(0, (+ed.month || 1) - 1), d: Math.max(1, +ed.day || 1), h: 0, mi: 0, s: 0 }); dur = Math.max(1, Math.round((b - a) / secondsPerDay(c)) + 1); } } catch (e) {}
      notes++; evs.push({ id: uid(), name, desc: "", color: f.color || "#5ee0ff", icon: String(f.icon || "fa-note-sticky").replace(/^fas\s+|^fa-solid\s+/, ""), cal: c.id, y: f.repeat === "yearly" ? null : +sd.year, m, d, dur, groups: [], hidden: !!f.gmOnly }); } } catch (e) {}
    let wx = null; try { const w = A.getCurrentWeather?.(); const s = `${w?.id || ""} ${L(w?.label || w?.name || "")}`.toLowerCase(); const kind = WEATHER[w?.id] ? w.id : /storm|orage|thunder/.test(s) ? "thunderstorm" : /snow|neige|bliz/.test(s) ? "snow" : /rain|pluie|drizzle|shower/.test(s) ? "rain" : /fog|brouill|mist/.test(s) ? "fog" : /overcast|couvert/.test(s) ? "overcast" : /cloud|nuag/.test(s) ? "cloudy" : /wind|vent/.test(s) ? "windy" : "clear"; const tp = A.getTemperature?.(); wx = { kind, temp: Number.isFinite(+tp) ? Math.round(+tp) : (Number.isFinite(+w?.temperature) ? Math.round(+w.temperature) : 12) }; } catch (e) {}
    await edit(S => { S.calendars = S.calendars.filter(x => x.id !== c.id); S.calendars.push(c); const g = S.groups.find(x => x.def) || S.groups[0]; g.cal = c.id; g.t = fromDate(c, date); if (wx) g.weather = wx;
      S.events = S.events.filter(e => e.cal !== c.id || e.custom); S.events.push(...evs); });
    ui.notifications.info(`Calendaria importé : ${months.length} mois, ${c.seasons.length} saisons, ${evs.length - notes} fêtes${notes ? `, ${notes} notes` : ""}, date ${date.d}/${date.m + 1}/${date.y}.`);
  } catch (err) { console.error(MOD, err); ui.notifications.error(`Import impossible : ${err.message}`); }
}
