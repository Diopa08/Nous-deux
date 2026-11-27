import { st, $, esc, toast, floatEmo, nameOf, partner, partnerName, onGame, saveGame, signedUrls, onTable, listen, send } from './core.js?v=18';

/* =========================================================
   Vrai puzzle : pièces à encoches, glisser-déposer, mode
   Ensemble (même puzzle, en direct) ou Course, niveaux et records
   ========================================================= */
const LEVELS = [[4, 3], [6, 4], [8, 6], [10, 8], [12, 9], [15, 10], [18, 12]];
const PAD = .26, SNAP = .32;
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

let game = null;   // { meta, img, cols, rows, TW, TH, ox, oy, edges, pos[], lock[], els[], scale }
let zoom = 1, timer = null, persistT = null, lastMove = 0;

const meta = () => st.games.jig || null;
const myIdx = () => (meta()?.players || []).indexOf(st.me);
const ownKey = () => 'jig' + Math.max(0, myIdx());
const otherKey = () => 'jig' + (1 - Math.max(0, myIdx()));

/* ---------- Géométrie des pièces ---------- */
function makeEdges(cols, rows, seed) {
  const R = rng(seed), h = [], v = [];
  for (let r = 0; r <= rows; r++) { h[r] = []; for (let c = 0; c < cols; c++) h[r][c] = r === 0 || r === rows ? 0 : (R() < .5 ? 1 : -1); }
  for (let r = 0; r < rows; r++) { v[r] = []; for (let c = 0; c <= cols; c++) v[r][c] = c === 0 || c === cols ? 0 : (R() < .5 ? 1 : -1); }
  return { h, v };
}
function edge(x, x0, y0, x1, y1, nx, ny, d) {
  if (!d) { x.lineTo(x1, y1); return; }
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const P = (a, b) => [x0 + ux * a * L + nx * b * L * d, y0 + uy * a * L + ny * b * L * d];
  x.lineTo(...P(.36, 0));
  x.bezierCurveTo(...P(.42, 0), ...P(.27, .22), ...P(.5, .23));
  x.bezierCurveTo(...P(.73, .22), ...P(.58, 0), ...P(.64, 0));
  x.lineTo(x1, y1);
}
function piecePath(x, r, c, S, E) {
  x.beginPath(); x.moveTo(0, 0);
  edge(x, 0, 0, S, 0, 0, -1, -E.h[r][c]);
  edge(x, S, 0, S, S, 1, 0, E.v[r][c + 1]);
  edge(x, S, S, 0, S, 0, 1, E.h[r + 1][c]);
  edge(x, 0, S, 0, 0, -1, 0, -E.v[r][c]);
  x.closePath();
}

/* ---------- Image ---------- */
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
async function imageFor(m) {
  const src = m.img.t === 'p' ? (await signedUrls([m.img.v]))[m.img.v] : `https://picsum.photos/seed/${encodeURIComponent(m.img.v)}/1600/1200`;
  const im = await loadImage(src);
  // recadre à la proportion du puzzle
  const ar = m.cols / m.rows, c = document.createElement('canvas');
  const iw = im.naturalWidth, ih = im.naturalHeight; let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
  c.width = Math.min(2400, Math.round(sw)); c.height = Math.round(c.width / ar);
  c.getContext('2d').drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/* ---------- Positions ---------- */
function scatter(m, TW, TH, ox, oy) {
  const R = rng(m.seed * 7 + 3), out = [];
  for (let i = 0; i < m.cols * m.rows; i++) {
    let x, y, k = 0;
    do { x = R() * (TW - 1); y = R() * (TH - 1); k++; } while (k < 60 && x > ox - 1.1 && x < ox + m.cols + .1 && y > oy - 1.1 && y < oy + m.rows + .1);
    out.push([x, y]);
  }
  return out;
}
function movesOf(key) { const s = st.games[key]; return s && s.id === meta()?.id && s.m ? s.m : {}; }
function mergedPositions() {
  const m = meta(), base = scatter(m, game.TW, game.TH, game.ox, game.oy).map(p => [p[0], p[1], 0, 0]);
  const keys = m.mode === 'coop' ? ['jig0', 'jig1'] : [ownKey()];
  for (const k of keys) for (const [i, v] of Object.entries(movesOf(k))) { const b = base[+i]; if (b && Array.isArray(v) && (v[3] || 0) >= b[3]) base[+i] = [+v[0], +v[1], v[2] ? 1 : 0, +v[3] || 0]; }
  return base;
}

/* ---------- Rendu ---------- */
function layout() {
  if (!game) return;
  const wrap = $('jigWrap'), base = Math.max(6, Math.min((wrap.clientWidth - 4) / game.TW, (innerHeight * .74) / game.TH));
  game.scale = base * zoom;
  const S = game.scale, T = $('jigTable');
  T.style.width = game.TW * S + 'px'; T.style.height = game.TH * S + 'px';
  const F = $('jigFrame'); Object.assign(F.style, { left: game.ox * S + 'px', top: game.oy * S + 'px', width: game.cols * S + 'px', height: game.rows * S + 'px' });
  renderPieces(); place();
}
function renderPieces() {
  const { cols, rows, img, edges } = game, dpr = Math.min(2, devicePixelRatio || 1), S = game.scale * dpr, p = PAD * S;
  game.els.forEach(el => el.remove()); game.els = [];
  const T = $('jigTable');
  for (let i = 0; i < cols * rows; i++) {
    const r = Math.floor(i / cols), c = i % cols, cv = document.createElement('canvas');
    cv.width = Math.ceil(S + 2 * p); cv.height = cv.width;
    cv.style.width = cv.style.height = (game.scale * (1 + 2 * PAD)) + 'px';
    const x = cv.getContext('2d'); x.translate(p, p);
    piecePath(x, r, c, S, edges); x.save(); x.clip();
    x.drawImage(img, -c * S, -r * S, cols * S, rows * S);
    x.restore(); x.lineWidth = Math.max(1, S / 60); x.strokeStyle = '#ffffff66'; x.stroke();
    cv.dataset.i = i; T.append(cv); game.els.push(cv);
  }
}
function place(only) {
  const S = game.scale;
  const list = only != null ? [only] : game.els.map((_, i) => i);
  for (const i of list) {
    const el = game.els[i], [x, y, l] = game.pos[i];
    el.style.left = (x - PAD) * S + 'px'; el.style.top = (y - PAD) * S + 'px';
    el.classList.toggle('lock', !!l); if (l) el.style.zIndex = 1; else if (!el.style.zIndex || el.style.zIndex === '1') el.style.zIndex = 2;
  }
}
function progress() {
  const n = game.pos.filter(p => p[2]).length, total = game.pos.length;
  $('jProg').textContent = `🧩 ${n} / ${total}`;
  const m = meta();
  if (m.mode === 'race') {
    const o = st.games[otherKey()]; const on = o && o.id === m.id ? Object.values(o.m || {}).filter(v => v[2]).length : 0;
    $('jOpp').textContent = partner() ? `${partnerName()} : ${on} / ${total}` : '';
  } else $('jOpp').textContent = 'Ensemble ♥';
  return n === total;
}
function tick() {
  const m = meta(); if (!m || !game) return;
  const mine = st.games[ownKey()], doneMine = mine && mine.id === m.id && mine.done;
  const other = st.games[otherKey()], doneOther = other && other.id === m.id && other.done;
  const finished = m.mode === 'coop' ? (doneMine || doneOther) : doneMine;
  $('jTime').textContent = fmt(finished ? (m.mode === 'coop' ? (doneMine || doneOther) : doneMine) : Date.now() - m.start);
  let msg = '';
  if (m.mode === 'race') {
    if (doneMine && doneOther) msg = doneMine <= doneOther ? `🏆 Tu as gagné la course en ${fmt(doneMine)} ! (${partnerName()} : ${fmt(doneOther)})` : `${partnerName()} a gagné en ${fmt(doneOther)}. Ton temps : ${fmt(doneMine)}.`;
    else if (doneMine) msg = `Terminé en ${fmt(doneMine)} ! On attend ${partnerName()}…`;
    else if (doneOther) msg = `⚡ ${partnerName()} a fini en ${fmt(doneOther)} ! Termine le tien.`;
  } else if (finished) msg = `🎉 Puzzle terminé ensemble en ${fmt(finished)} !`;
  $('jMsg').textContent = msg;
}

/* ---------- Démarrage d'une partie ---------- */
async function start() {
  const m = meta();
  if (!m || !m.id) { show(false); return; }
  if (game && game.id === m.id) { game.pos = mergedPositions(); place(); progress(); return; }
  show(true); $('jMsg').textContent = 'Préparation du puzzle…';
  let img;
  try { img = await imageFor(m); } catch (e) { $('jMsg').textContent = 'Impossible de charger l\'image. Choisissez-en une autre.'; return; }
  if (meta()?.id !== m.id) return;
  const TW = Math.ceil(m.cols * 1.9), TH = Math.ceil(m.rows * 1.75 + 1), ox = (TW - m.cols) / 2, oy = (TH - m.rows) / 2;
  game = { id: m.id, cols: m.cols, rows: m.rows, img, TW, TH, ox, oy, edges: makeEdges(m.cols, m.rows, m.seed), els: [], pos: [], scale: 1 };
  game.pos = mergedPositions();
  $('jigFrame').style.backgroundImage = 'none'; $('jigFrame').classList.remove('peek'); peek = false;
  layout(); progress(); $('jMsg').textContent = '';
  clearInterval(timer); timer = setInterval(tick, 500); tick();
}
function show(on) { $('jigSetup').hidden = on; $('jigGame').hidden = !on; if (!on) { clearInterval(timer); game?.els.forEach(el => el.remove()); game = null; renderSetup(); } }

/* ---------- Glisser-déposer ---------- */
let drag = null, zTop = 10, peek = false;
function persist() {
  clearTimeout(persistT);
  persistT = setTimeout(() => {
    const m = meta(); if (!m || !game) return;
    const key = ownKey(), prev = st.games[key]?.id === m.id ? st.games[key] : { id: m.id, m: {}, done: 0 };
    const mm = { ...prev.m }; game.dirty?.forEach(i => { const p = game.pos[i]; mm[i] = [+p[0].toFixed(3), +p[1].toFixed(3), p[2], p[3]]; }); game.dirty = new Set();
    const complete = progress();
    let done = prev.done || 0;
    if (complete && !done) { done = Date.now() - m.start; floatEmo('🎉'); saveRecord(m, done); }
    saveGame(key, { id: m.id, m: mm, done });
  }, 400);
}
function saveRecord(m, ms) {
  const rec = { ...(st.games.jigrec || {}) }, k = m.cols + 'x' + m.rows + '-' + m.mode, cur = rec[k];
  if (!cur || ms < cur.ms) { rec[k] = { ms, by: m.mode === 'coop' ? 'nous' : st.me, at: Date.now() }; saveGame('jigrec', rec); toast('🏅 Nouveau record pour ce niveau !'); }
}
function initDrag() {
  const T = $('jigTable');
  T.addEventListener('pointerdown', e => {
    const el = e.target.closest('canvas'); if (!el || !game) return;
    const i = +el.dataset.i; if (game.pos[i][2]) return;
    // ignore les clics dans les zones transparentes autour de l'encoche
    const r = el.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * el.width, cy = (e.clientY - r.top) / r.height * el.height;
    try { if (el.getContext('2d').getImageData(cx, cy, 1, 1).data[3] < 20) return; } catch (err) { }
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('drag'); el.style.zIndex = ++zTop;
    drag = { i, el, sx: e.clientX, sy: e.clientY, x0: game.pos[i][0], y0: game.pos[i][1] };
  });
  T.addEventListener('pointermove', e => {
    if (!drag) return; const S = game.scale;
    const x = Math.min(game.TW - 1, Math.max(0, drag.x0 + (e.clientX - drag.sx) / S)), y = Math.min(game.TH - 1, Math.max(0, drag.y0 + (e.clientY - drag.sy) / S));
    game.pos[drag.i] = [x, y, 0, Date.now()]; place(drag.i);
    if (meta()?.mode === 'coop' && Date.now() - lastMove > 70) { lastMove = Date.now(); send('jig-mv', { id: game.id, i: drag.i, x: +x.toFixed(3), y: +y.toFixed(3) }); }
  });
  const end = () => {
    if (!drag) return; const { i, el } = drag; drag = null; el.classList.remove('drag');
    const r = Math.floor(i / game.cols), c = i % game.cols, tx = game.ox + c, ty = game.oy + r, p = game.pos[i];
    if (Math.hypot(p[0] - tx, p[1] - ty) < SNAP) { game.pos[i] = [tx, ty, 1, Date.now()]; navigator.vibrate?.(15); }
    place(i); (game.dirty ||= new Set()).add(i);
    if (meta()?.mode === 'coop') send('jig-mv', { id: game.id, i, x: game.pos[i][0], y: game.pos[i][1], l: game.pos[i][2] });
    progress(); persist();
  };
  T.addEventListener('pointerup', end); T.addEventListener('pointercancel', end);
}

/* ---------- Accueil : réglages et records ---------- */
function renderSetup() {
  const photos = (st.rows.memories || []).filter(m => m.kind !== 'strip');
  const cur = $('jImg').value;
  $('jImg').innerHTML = '<option value="web:">🌄 Belle image du web (au hasard)</option>' + photos.map((m, i) => `<option value="p:${esc(m.path)}">📷 ${esc(m.caption || 'Photo ' + (photos.length - i))}</option>`).join('');
  if (cur && [...$('jImg').options].some(o => o.value === cur)) $('jImg').value = cur;
  const rec = st.games.jigrec || {};
  $('jRecords').innerHTML = '<b style="grid-column:1/-1;font-family:var(--disp);font-size:calc(22px*var(--dsz));color:var(--b)">🏅 Records</b>' + LEVELS.map(([c, r]) => {
    const a = rec[c + 'x' + r + '-coop'], b = rec[c + 'x' + r + '-race'];
    return `<div><b>${c * r} pièces</b>Ensemble : ${a ? fmt(a.ms) : '—'}<br>Course : ${b ? fmt(b.ms) + ' (' + esc(nameOf(b.by)) + ')' : '—'}</div>`;
  }).join('');
}

export function initJigsaw() {
  $('jLevel').innerHTML = LEVELS.map(([c, r], k) => `<option value="${k}" ${k === 1 ? 'selected' : ''}>${c * r} pièces${['', '', '', ' · difficile', ' · très difficile', ' · expert', ' · légende'][k] || ''}</option>`).join('');
  $('jHint').textContent = 'Glissez les pièces dans le cadre : elles s\'aimantent à la bonne place.';
  renderSetup();
  onTable('memories', renderSetup);
  onGame('jigrec', () => { if (!game) renderSetup(); });
  listen('members', () => { if (!game) renderSetup(); });
  initDrag();
  $('jNew').onclick = () => {
    const [cols, rows] = LEVELS[+$('jLevel').value], [t, v] = $('jImg').value.split(/:(.*)/s);
    const o = partner()?.user_id;
    const id = Date.now().toString(36);
    saveGame('jig', { id, mode: $('jMode').value, cols, rows, seed: Math.floor(Math.random() * 1e9), img: t === 'p' ? { t: 'p', v } : { t: 'w', v: id }, start: Date.now() + 1500, players: o ? [st.me, o] : [st.me], by: st.me });
  };
  $('jQuit').onclick = () => { show(false); };
  $('jZoomIn').onclick = () => { zoom = Math.min(4, zoom * 1.25); layout(); };
  $('jZoomOut').onclick = () => { zoom = Math.max(.5, zoom / 1.25); layout(); };
  $('jPeek').onclick = () => {
    if (!game) return; peek = !peek; $('jPeek').classList.toggle('sel', peek);
    if (peek && !game.ghost) { const c = document.createElement('canvas'); c.width = 600; c.height = Math.round(600 * game.rows / game.cols); const x = c.getContext('2d'); x.globalAlpha = .4; x.drawImage(game.img, 0, 0, c.width, c.height); game.ghost = c.toDataURL('image/png'); }
    $('jigFrame').style.backgroundImage = peek ? `url(${game.ghost})` : 'none';
  };
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(layout, 150); }).observe($('jigWrap'));
  onGame('jig', () => { const m = meta(); if (!m) return; if (!game || game.id !== m.id) { if (m.by !== st.me && Date.now() - m.start < 60000) toast('🧩 ' + nameOf(m.by) + ' a lancé un puzzle (' + (m.cols * m.rows) + ' pièces, ' + (m.mode === 'race' ? 'course' : 'ensemble') + ')'); start(); } });
  ['jig0', 'jig1'].forEach(k => onGame(k, () => { if (!game || meta()?.mode !== 'coop' || k === ownKey()) { if (game) { progress(); tick(); } return; } game.pos = mergedPositions(); place(); progress(); tick(); }));
  listen('jig-mv', d => {
    if (!game || d.id !== game.id || meta()?.mode !== 'coop') return; const i = +d.i; if (!game.els[i] || drag?.i === i) return;
    game.pos[i] = [+d.x, +d.y, d.l ? 1 : 0, Date.now()]; place(i); const el = game.els[i];
    if (!d.l) { el.classList.add('other'); el.style.zIndex = ++zTop; clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('other'), 400); } else el.classList.remove('other');
    progress();
  });
  listen('view', v => { if (v === 'jeux' && meta() && !$('jigGame').hidden) setTimeout(layout, 50); });
}
export const resumeJigsaw = () => { if (meta()) start(); };
