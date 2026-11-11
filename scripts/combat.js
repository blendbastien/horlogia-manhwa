/* Horlogia — mode combat : un chrono par groupe, détaché, grand, au centre (1.7).
 * Il est hors du système de combat de Foundry. Chaque groupe garde le sien : mis en pause, il reste figé
 * (avec l'heure du groupe) même si le MJ passe à un autre groupe ou termine la session.
 * Tous les joueurs du groupe le voient ; la croix le ferme pour tout le monde.
 * Réglage : −1 s / +1 s de chaque côté, saisie au clavier (clic sur les chiffres), +2 … +30 s et −2 … −30 s.
 * Chrono à 00:00 → il compte vers le haut ; réglé sur une durée → compte à rebours. */
import { SWORD } from "./hud.js";
import { MOD, esc, state, edit, groupForUser, combatElapsed, combatLeft, combatRunning, foldCombat, now, fmtDur, setTheme, digits, uid, opt } from "./core.js";
const fa = i => `<i class="fa-solid ${i}"></i>`;
const STEPS = () => { const L = (opt("cSteps") || []).map(Number).filter(n => n > 0); return L.length ? L.slice(0, 12) : [2, 3, 4, 5, 10, 15, 20, 30]; };
const DIAL = `<svg class="hzc-dial" viewBox="-50 -50 100 100"><circle class="hzc-face" r="44"/>${Array.from({ length: 60 }, (_, i) => { const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 38 : 34; return `<line class="hzc-tk${i % 5 ? "" : " b"}" x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * 41).toFixed(2)}" y2="${(-Math.cos(a) * 41).toFixed(2)}"/>`; }).join("")}<line class="hzc-needle" x1="0" y1="8" x2="0" y2="-36"/><circle class="hzc-hub" r="4"/></svg>`;

/* groupe dont on affiche le chrono : MJ = groupe affiché ; joueur = son groupe */
export const combatGroup = (S = state()) => groupForUser(S);
/* valeur affichée : temps restant (compte à rebours) ou temps écoulé */
export function shownOf(S, gid) { const left = combatLeft(S, gid); return left == null ? combatElapsed(S, gid) : left; }

export function renderCombat() {
  const S = state(); const g = combatGroup(S); const c = g && S.combats[g.id]; let el = document.getElementById("horlogia-combat");
  if (!c) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "horlogia-combat"; document.body.appendChild(el); bind(el); placeCombat(el); }
  el.classList.toggle("nogl", !opt("cGlow")); el.classList.toggle("sz-s", opt("cSize") === "s"); el.classList.toggle("sz-l", opt("cSize") === "l");
  { const ed = el.querySelector(".hzc-edit"); if (ed && !ed.dataset.done && ed.contains(document.activeElement)) return; }   /* saisie en cours : on ne redessine pas */
  el.dataset.g = g.id; const gm = game.user.isGM; const run = combatRunning(S, c); const left = combatLeft(S, g.id); const shown = shownOf(S, g.id);
  setTheme(el, g); el.classList.toggle("run", run); el.classList.toggle("gm", gm); el.style.setProperty("--sec", Math.floor(shown));
  const st = left === 0 ? `${fa("fa-bell")} Temps écoulé !` : run ? "" : `${fa("fa-circle-pause")} En pause`;
  const steps = sign => STEPS().map(v => `<a data-c="add" data-v="${sign * v}" class="${sign < 0 ? "minus" : "plus"}">${sign < 0 ? "−" : "+"}${v} s</a>`).join("");
  el.innerHTML = `<div class="hzc-top">${SWORD}<span>COMBAT</span><small>${esc(g.name || "")}</small>${gm ? `<a class="hzc-x" data-c="end" data-tooltip="Quitter le combat (pour tout le monde)">${fa("fa-xmark")}</a>` : ""}</div>
    <div class="hzc-art">${DIAL}<i class="fa-solid fa-hourglass-half hzc-glass"></i></div>
    <div class="hzc-time">${gm ? `<a class="hzc-pm" data-c="add" data-v="-1" data-tooltip="−1 s">${fa("fa-minus")}</a>` : ""}<b data-hz-ct${gm ? ` data-c="type" data-tooltip="Clic : saisir le temps"` : ""}>${digits(fmtDur(shown))}</b>${gm ? `<a class="hzc-pm" data-c="add" data-v="1" data-tooltip="+1 s">${fa("fa-plus")}</a>` : ""}</div>
    ${st ? `<div class="hzc-st">${st}</div>` : ""}
    ${gm ? `<div class="hzc-steps"><span>${steps(1)}</span><span>${steps(-1)}</span></div>
      <div class="hzc-ctl"><a data-c="run" class="big ${run ? "pause" : "play"}" data-tooltip="${run ? "Pause du chrono (la partie continue)" : "Lancer le chrono (indépendant de la partie)"}">${fa(run ? "fa-pause" : "fa-play")} ${run ? "Pause" : "Play"}</a><a data-c="zero" data-tooltip="Remettre à 00:00">${fa("fa-rotate-left")} 00:00</a></div>` : ""}`;
}
/* modifie le chrono du groupe affiché */
const editC = (gid, fn) => edit(S2 => { const c = S2.combats[gid]; if (!c) return false; foldCombat(S2, gid); const r = fn(c, S2); c.st = c.run ? now() : 0; return r; });
/* fixe la valeur affichée à n secondes */
function setShown(c, S2, gid, n) { n = Math.max(0, Math.round(n));
  if (+c.dur > 0) { c.dur = (c.acc || 0) + n; if (n > 0) c.start = uid(); return; }
  const d = n - (c.acc || 0); c.acc = n; }
function bind(el) {
  el.addEventListener("click", async ev => { const a = ev.target.closest("[data-c]"); if (!a || !game.user.isGM) return; const k = a.dataset.c; const gid = el.dataset.g;
    if (k === "end") return endCombat(gid);
    if (k === "type") return typeTime(el, gid);
    if (k === "run") { const S = state(); const c = S.combats[gid]; if (!c) return;
      return editC(gid, c2 => { c2.run = !c2.run; }); }
    if (k === "zero") return editC(gid, c => { c.dur = 0; c.acc = 0; c.run = false; c.start = uid(); });
    if (k === "add") { const v = +a.dataset.v;
      return editC(gid, (c, S2) => { const cur = shownOf(S2, gid); const wasDone = combatLeft(S2, gid) === 0;
        /* chrono à 00:00 et arrêté : on règle une durée (compte à rebours) */
        if (!(+c.dur > 0) && !(c.acc > 0) && v > 0) { c.dur = v; c.acc = 0; c.start = uid(); return; }
        setShown(c, S2, gid, cur + v); if (+c.dur > 0 && wasDone && v > 0) c.run = true; }); }
  });
  el.addEventListener("pointerdown", ev => { if (!ev.target.closest(".hzc-top") || ev.target.closest("[data-c]")) return; ev.preventDefault(); const r = el.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const mv = e => { el.style.left = `${e.clientX - dx}px`; el.style.top = `${e.clientY - dy}px`; el.style.transform = "none"; }; const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); const q = el.getBoundingClientRect(); game.settings.set(MOD, "combatPos", { x: Math.round(q.left), y: Math.round(q.top) }); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); });
}
/* saisie au clavier : « 90 », « 1:30 » ou « 1:02:30 » */
function typeTime(el, gid) {
  const b = el.querySelector("[data-hz-ct]"); if (!b) return; const S = state(); const cur = fmtDur(shownOf(S, gid));
  /* 1.8 : la saisie garde l'apparence des chiffres du thème (police, couleur, lueur, fond des chiffres) */
  const em = b.querySelector("em") || b; const cb = getComputedStyle(b), ce = getComputedStyle(em);
  const look = { fontFamily: ce.fontFamily, fontWeight: ce.fontWeight, fontSize: ce.fontSize !== "0px" ? ce.fontSize : cb.fontSize, letterSpacing: cb.letterSpacing, color: ce.color, textShadow: ce.textShadow !== "none" ? ce.textShadow : cb.textShadow, bg: ce.backgroundImage !== "none" ? ce.backgroundImage : ce.backgroundColor, w: b.offsetWidth, h: b.offsetHeight };
  const box = document.createElement("span"); box.className = "hzc-edit"; box.innerHTML = `<input type="text" value="${cur}" spellcheck="false"><a>${fa("fa-check")}</a>`; b.replaceWith(box);
  const inp = box.querySelector("input");
  Object.assign(inp.style, { fontFamily: look.fontFamily, fontWeight: look.fontWeight, fontSize: look.fontSize, letterSpacing: look.letterSpacing, textShadow: look.textShadow, width: `${Math.max(150, look.w + 12)}px`, height: `${Math.max(56, look.h + 6)}px` });
  inp.style.setProperty("color", look.color, "important"); if (em !== b && look.bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(look.bg)) inp.style.setProperty("background", look.bg, "important"); else inp.style.setProperty("background", "transparent", "important");
  inp.focus(); inp.select();
  const done = async ok => { if (box.dataset.done) return; box.dataset.done = "1"; if (ok) { const p = inp.value.trim().split(/[:h ]+/).map(x => +x || 0); const sec = p.reduce((t, x) => t * 60 + x, 0);
      if (Number.isFinite(sec)) { await editC(gid, (c, S2) => { if (!(+c.dur > 0) && !(c.acc > 0) && !c.run) { c.dur = Math.max(0, sec); c.acc = 0; c.start = uid(); return; } setShown(c, S2, gid, sec); }); } }
    renderCombat(); };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") { e.preventDefault(); done(false); } });
  box.querySelector("a").addEventListener("click", () => done(true)); inp.addEventListener("blur", () => setTimeout(() => done(true), 120));
}
export async function startCombat(gid) { if (!game.user.isGM) return; const S = state(); const g = S.groups.find(x => x.id === gid) || groupForUser(S);
  if (S.combats[g.id]) return; await edit(S2 => { S2.combats[g.id] = { acc: 0, run: false, dur: 0, start: uid() }; }); }
export async function endCombat(gid) { if (!game.user.isGM) return; const S = state(); const id = gid || groupForUser(S).id; if (!S.combats[id]) return; await edit(S2 => { if (S2.combats[id]) { S2.combats[id].run = false; foldCombat(S2, id); } delete S2.combats[id]; }); }
export const toggleCombat = () => { const S = state(); const g = groupForUser(S); return S.combats[g.id] ? endCombat(g.id) : startCombat(g.id); };

/* position à l'ouverture : en haut au centre, au centre de l'écran, ou là où le MJ l'a laissé */
export function placeCombat(el) { const p = opt("cPos"); el.style.left = ""; el.style.top = ""; el.style.transform = "";
  if (p === "center") { el.style.top = "50%"; el.style.transform = "translate(-50%, -50%)"; }
  else if (p === "last") { let q = null; try { q = game.settings.get(MOD, "combatPos"); } catch (e) {} if (q) { el.style.left = `${Math.max(0, Math.min(innerWidth - 120, q.x))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - 80, q.y))}px`; el.style.transform = "none"; } } }
