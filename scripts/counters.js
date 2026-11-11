/* Horlogia — compteurs (1.8) : un panneau par groupe, indépendant du combat.
 * Les catégories (nom, icône, couleur) se gèrent dans une fenêtre dédiée (Réglages › Compteurs).
 * Le panneau d'un groupe commence vide : le MJ ajoute ou retire des catégories avec « + » ; elles s'affichent
 * pour lui et les joueurs du groupe (si l'œil est ouvert). Les joueurs ne modifient que si le cadenas est ouvert.
 * Sur un chiffre : clic gauche +1, clic droit −1, avec Maj : ±5 (réglable) ; crayon : saisie ; croix : retirer (MJ). Aucune infobulle. */
import { MOD, esc, state, groupForUser, setTheme, fmtNum, uid, opt } from "./core.js";
const fa = i => `<i class="fa-solid ${i}"></i>`;
export const CNT_ICONS = ["fa-shoe-prints", "fa-ruler", "fa-road", "fa-skull", "fa-dragon", "fa-ghost", "fa-person-walking", "fa-stairs", "fa-dungeon", "fa-flag", "fa-heart", "fa-coins", "fa-gem", "fa-hourglass-half", "fa-crosshairs", "fa-star", "fa-door-open", "fa-map-pin", "fa-users", "fa-bolt", "fa-key", "fa-scroll", "fa-box-open", "fa-campground", "fa-fire", "fa-droplet", "fa-utensils", "fa-shield-halved", "fa-khanda", "fa-paw"];
const DEF_CATS = [{ id: "steps", n: "Étapes", ic: "fa-shoe-prints", c: "#5ee0ff" }, { id: "m", n: "Mètres", ic: "fa-ruler", c: "#3ddc84" }, { id: "km", n: "Kilomètres", ic: "fa-road", c: "#ffd36b" }, { id: "mob", n: "Monstres", ic: "fa-skull", c: "#ff5d6c" }];
const MAX = 1e12;
const get = (k, d) => { try { return foundry.utils.deepClone(game.settings.get(MOD, k) ?? d); } catch (e) { return d; } };
/* catalogue des catégories */
export const cats = () => { const c = get("cntCats", null)?.list; return Array.isArray(c) ? c : foundry.utils.deepClone(DEF_CATS); };
export const allCnt = () => get("counters", {}) || {};
/* compteurs d'un groupe : { show, edit, list: [{ id (catégorie), v }] } — les anciennes listes (1.7) sont reprises */
export const cntOf = gid => { const a = allCnt()[gid]; return { show: !!a?.show, edit: a?.edit === undefined ? !!opt("kDefEdit") : !!a.edit, list: Array.isArray(a?.list) ? a.list.map(x => ({ id: x.id, v: +x.v || 0 })) : [] }; };
let LOCK = Promise.resolve();
export function editCnt(gid, fn) { if (!game.user.isGM) return; const run = async () => { const A = allCnt(); const x = cntOf(gid); if (fn(x) === false) return; A[gid] = x; await game.settings.set(MOD, "counters", A); }; LOCK = LOCK.then(run, run); return LOCK; }
export function editCats(fn) { if (!game.user.isGM) return; const run = async () => { const C = cats(); if (fn(C) === false) return; await game.settings.set(MOD, "cntCats", { list: C }); }; LOCK = LOCK.then(run, run); return LOCK; }
const SH = () => Math.max(1, Math.round(+opt("kShift") || 5));
const clamp = n => Math.max(0, Math.min(MAX, Math.round(+n || 0)));
function change(gid, id, { d = 0, set = null }) {
  if (game.user.isGM) return editCnt(gid, x => { const c = x.list.find(y => y.id === id); if (!c) return false; c.v = clamp(set != null ? set : (+c.v || 0) + d); });
  if (!cntOf(gid).edit) return; game.socket.emit(`module.${MOD}`, { t: "cnt", gid, id, d, set, u: game.user.id });
}
export function onSocket(m) { if (m?.t !== "cnt" || !game.users.activeGM?.isSelf) return; const u = game.users.get(m.u); const gid = m.gid;
  if (!u || !cntOf(gid).edit || groupForUser(state(), u)?.id !== gid) return; change(gid, m.id, { d: +m.d || 0, set: m.set == null ? null : +m.set }); }
/* 1.7 → 1.8 : les compteurs nommés d'un groupe deviennent des catégories du catalogue */
export async function migrateCnt() {
  if (!game.users.activeGM?.isSelf) return; const A = allCnt(); const C = cats(); let ch = false;
  let chA = false;
  for (const x of Object.values(A)) { for (const it of x?.list || []) if (it?.n && !C.some(c => c.id === it.id)) { C.push({ id: it.id, n: it.n, ic: it.ic || "fa-star", c: it.c || "#5ee0ff" }); ch = true; }
    /* les compteurs de la 1.7 restés à 0 ne s'affichent plus : le MJ ajoute ce qu'il veut */
    if (Array.isArray(x?.list) && x.list.some(it => it?.n)) { x.list = x.list.filter(it => !it?.n || +it.v > 0).map(it => ({ id: it.id, v: +it.v || 0 })); chA = true; } }
  if (ch || !Array.isArray(get("cntCats", null)?.list)) await game.settings.set(MOD, "cntCats", { list: C });
  if (chA) await game.settings.set(MOD, "counters", A);
}

/* ── panneau du groupe ── */
const local = (k, d) => { try { return game.settings.get(MOD, k) ?? d; } catch (e) { return d; } };
export const cntOpen = () => { const S = state(); const g = groupForUser(S); if (!g) return false; const x = cntOf(g.id); const closed = local("cntClosed", {}) || {};
  return game.user.isGM ? !!local("cntGm", false) : x.show && x.list.length > 0 && !closed[g.id]; };
export async function toggleCnt() { const S = state(); const g = groupForUser(S); if (game.user.isGM) await game.settings.set(MOD, "cntGm", !local("cntGm", false));
  else { const cl = { ...(local("cntClosed", {}) || {}) }; cl[g.id] = !cl[g.id]; await game.settings.set(MOD, "cntClosed", cl); } renderCounters(); }
let PICK = false;
export function renderCounters() {
  const S = state(); const g = groupForUser(S); let el = document.getElementById("horlogia-cnt");
  if (!g || !cntOpen()) { el?.remove(); return; }
  if (el?.contains(document.activeElement) && document.activeElement.matches("input")) return;   /* saisie en cours */
  if (!el) { el = document.createElement("div"); el.id = "horlogia-cnt"; document.body.appendChild(el); bind(el); const p = local("cntPos", null); if (p) { el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; el.style.right = "auto"; } }
  const gm = game.user.isGM; const x = cntOf(g.id); const C = cats(); const can = gm || x.edit; el.dataset.g = g.id; setTheme(el, g); el.classList.toggle("can", can); el.classList.toggle("min", !!local("cntMin", false)); el.classList.toggle("sz-s", opt("kSize") === "s");
  const rows = x.list.map(it => { const c = C.find(y => y.id === it.id); if (!c) return ""; return `<div class="hzk-r" data-id="${esc(it.id)}" style="--kc:${esc(c.c || "#5ee0ff")}"><i class="fa-solid ${esc(c.ic)} ic"></i><span class="n">${esc(c.n)}</span><b class="v" data-k="v">${fmtNum(it.v)}</b>${can ? `<a class="rb" data-k="set">${fa("fa-pen")}</a>` : ""}${gm ? `<a class="rb x" data-k="rm">${fa("fa-xmark")}</a>` : ""}</div>`; }).join("");
  const pick = gm && PICK ? `<div class="hzk-pick">${C.map(c => { const on = x.list.some(y => y.id === c.id); return `<a data-k="tog" data-id="${esc(c.id)}" class="${on ? "on" : ""}" style="--kc:${esc(c.c || "#5ee0ff")}"><i class="fa-solid ${esc(c.ic)} ic"></i><span>${esc(c.n)}</span>${fa(on ? "fa-square-check" : "fa-square")}</a>`; }).join("") || `<p class="hzk-0">Aucune catégorie : crée-les dans Horlogia › Réglages › Compteurs.</p>`}<a data-k="cats" class="mg">${fa("fa-sliders")} Gérer les catégories</a></div>` : "";
  el.innerHTML = `<header class="hzk-h"><i class="fa-solid fa-list-ol"></i><span>Compteurs</span><small>${esc(g.name)}</small>
    ${gm ? `<a data-k="show" class="${x.show ? "on" : ""}">${fa(x.show ? "fa-eye" : "fa-eye-slash")}</a><a data-k="pedit" class="${x.edit ? "on" : ""}">${fa(x.edit ? "fa-lock-open" : "fa-lock")}</a>` : ""}
    <a data-k="min">${fa(local("cntMin", false) ? "fa-chevron-down" : "fa-chevron-up")}</a><a data-k="close">${fa("fa-xmark")}</a></header>
    <div class="hzk-b">${rows}${gm ? `<a data-k="add" class="hzk-add${PICK ? " on" : ""}">${fa(PICK ? "fa-check" : "fa-plus")} ${PICK ? "Terminé" : "Ajouter"}</a>${pick}` : ""}</div>`;
}
function bind(el) {
  const gid = () => el.dataset.g;
  el.addEventListener("click", async ev => { const a = ev.target.closest("[data-k]"); if (!a || a.matches("input")) return; ev.preventDefault(); const k = a.dataset.k; const id = a.closest("[data-id]")?.dataset.id;
    if (k === "close") return toggleCnt();
    if (k === "min") { await game.settings.set(MOD, "cntMin", !local("cntMin", false)); return renderCounters(); }
    if (k === "v") return change(gid(), id, { d: ev.shiftKey ? SH() : 1 });
    if (k === "set") { if (!el.classList.contains("can")) return; return typeVal(el, gid(), id); }
    if (!game.user.isGM) return;
    if (k === "show") return editCnt(gid(), x => { x.show = !x.show; });
    if (k === "pedit") return editCnt(gid(), x => { x.edit = !x.edit; });
    if (k === "add") { PICK = !PICK; return renderCounters(); }
    if (k === "cats") { PICK = false; renderCounters(); return openCats(); }
    if (k === "rm") return editCnt(gid(), x => { x.list = x.list.filter(y => y.id !== id); });
    if (k === "tog") { const cid = a.dataset.id; return editCnt(gid(), x => { const i = x.list.findIndex(y => y.id === cid); if (i >= 0) x.list.splice(i, 1); else x.list.push({ id: cid, v: 0 }); }); }
  });
  el.addEventListener("contextmenu", ev => { const a = ev.target.closest('[data-k="v"]'); if (!a) return; ev.preventDefault(); ev.stopPropagation(); change(gid(), a.closest("[data-id]").dataset.id, { d: ev.shiftKey ? -SH() : -1 }); });
  el.addEventListener("pointerdown", ev => { if (!ev.target.closest(".hzk-h") || ev.target.closest("[data-k]")) return; ev.preventDefault(); const r = el.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const mv = e => { el.style.left = `${Math.max(0, Math.min(innerWidth - r.width, e.clientX - dx))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - 40, e.clientY - dy))}px`; el.style.right = "auto"; };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); const q = el.getBoundingClientRect(); game.settings.set(MOD, "cntPos", { x: Math.round(q.left), y: Math.round(q.top) }); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); });
}
/* saisie au crayon */
async function typeVal(el, gid, id) {
  await LOCK; const r = el.querySelector(`[data-id="${CSS.escape(id)}"]`); const b = r?.querySelector(".v"); if (!b) return; const it = cntOf(gid).list.find(y => y.id === id);
  const inp = document.createElement("input"); inp.type = "number"; inp.min = "0"; inp.className = "hzk-in"; inp.value = Math.max(0, +it?.v || 0); b.replaceWith(inp); inp.focus(); inp.select();
  let done = false; const fin = ok => { if (done) return; done = true; if (ok) change(gid, id, { set: inp.value }); setTimeout(renderCounters, 60); };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); fin(true); inp.blur(); } if (e.key === "Escape") { e.preventDefault(); fin(false); inp.blur(); } });
  inp.addEventListener("blur", () => fin(true));
}

/* ── fenêtre dédiée : catalogue des catégories (même style que le chrono de combat) ── */
export function openCats() {
  if (!game.user.isGM) return; let el = document.getElementById("horlogia-cntcat"); if (el) { el.remove(); }
  el = document.createElement("div"); el.id = "horlogia-cntcat"; document.body.appendChild(el); bindCats(el); renderCats();
}
export function renderCats() {
  const el = document.getElementById("horlogia-cntcat"); if (!el) return; if (el.contains(document.activeElement) && document.activeElement.matches("input:not([type=color])")) return;
  const S = state(); setTheme(el, groupForUser(S)); const C = cats();
  el.innerHTML = `<div class="hzq-top"><i class="fa-solid fa-list-ol"></i><span>Catégories de compteurs</span><a class="hzq-x" data-q="close">${fa("fa-xmark")}</a></div>
    <p class="hzq-hint">Le MJ les ajoute ensuite au panneau de chaque groupe avec « + Ajouter ».</p>
    <div class="hzq-list">${C.map(c => `<div class="hzq-r" data-id="${esc(c.id)}" style="--kc:${esc(c.c || "#5ee0ff")}"><label class="ic">${fa(c.ic)}<select data-f="ic">${CNT_ICONS.map(i => `<option value="${i}"${i === c.ic ? " selected" : ""}>${i.replace("fa-", "")}</option>`).join("")}</select></label><input data-f="n" value="${esc(c.n)}" maxlength="24"><input type="color" data-f="c" value="${esc(c.c || "#5ee0ff")}"><a data-q="up">${fa("fa-arrow-up")}</a><a data-q="del" class="del">${fa("fa-trash")}</a></div>`).join("") || `<p class="hzq-hint">Aucune catégorie.</p>`}</div>
    <div class="hzq-f"><a data-q="add">${fa("fa-plus")} Nouvelle catégorie</a><a data-q="close" class="ok">${fa("fa-check")} Terminé</a></div>`;
}
function bindCats(el) {
  el.addEventListener("click", ev => { const a = ev.target.closest("[data-q]"); if (!a) return; ev.preventDefault(); const k = a.dataset.q; const id = a.closest("[data-id]")?.dataset.id;
    if (k === "close") return el.remove();
    if (k === "add") return editCats(C => { C.push({ id: uid(), n: "Nouveau compteur", ic: CNT_ICONS[C.length % CNT_ICONS.length], c: "#a46bff" }); });
    if (k === "del") return editCats(C => { const i = C.findIndex(c => c.id === id); if (i < 0) return false; C.splice(i, 1); }).then(() => editAll(x => { x.list = x.list.filter(y => y.id !== id); }));
    if (k === "up") return editCats(C => { const i = C.findIndex(c => c.id === id); if (i <= 0) return false; [C[i - 1], C[i]] = [C[i], C[i - 1]]; });
  });
  el.addEventListener("change", ev => { const f = ev.target.dataset.f; const id = ev.target.closest("[data-id]")?.dataset.id; if (!f || !id) return; const v = ev.target.value;
    editCats(C => { const c = C.find(y => y.id === id); if (!c) return false; c[f] = f === "n" ? (v.trim() || "Compteur") : v; }); });
  el.addEventListener("pointerdown", ev => { if (!ev.target.closest(".hzq-top") || ev.target.closest("[data-q]")) return; ev.preventDefault(); const r = el.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const mv = e => { el.style.left = `${e.clientX - dx}px`; el.style.top = `${e.clientY - dy}px`; el.style.transform = "none"; }; const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); });
}
/* retire une catégorie supprimée de tous les groupes */
async function editAll(fn) { const A = allCnt(); for (const k of Object.keys(A)) { const x = cntOf(k); fn(x); A[k] = x; } await game.settings.set(MOD, "counters", A); }
