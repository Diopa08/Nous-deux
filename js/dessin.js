import { sb, st, $, esc, norm, toast, floatEmo, nameOf, partner, partnerName, q, onGame, saveGame, onTable, loadTable, listen, send, signedUrls, uploadPhoto, uid } from './core.js?v=19';

/* =========================================================
   Dessin à deux : outils, fond / photo, galerie,
   devinettes (Pictionary) et dessins à reproduire
   ========================================================= */
const W = 1200, H = 900;
const COLS = ['#1b1b1b', '#ffffff', '#e63946', '#ff8fab', '#f4a261', '#ffc93c', '#2a9d8f', '#4fd1c0', '#1d3fa5', '#8fa8ff', '#8e3b5f', '#7b4a2e'];
const WORDS = ['avion', 'plage', 'cœur', 'chat', 'pizza', 'guitare', 'lune', 'valise', 'fleur', 'soleil', 'maison', 'vélo', 'gâteau', 'ballon', 'bague', 'étoile', 'café', 'arbre', 'poisson', 'parapluie', 'glace', 'train', 'papillon', 'montagne', 'bateau', 'téléphone', 'lunettes', 'chaussure', 'banane', 'ananas', 'cadeau', 'bougie', 'piano', 'fusée', 'arc-en-ciel', 'serpent', 'tortue', 'girafe', 'éléphant', 'sirène', 'château', 'roller', 'football', 'appareil photo', 'casque', 'nuage', 'volcan', 'pont', 'escargot', 'baleine', 'cactus', 'lit', 'couronne', 'dragon', 'robot', 'fantôme', 'pingouin', 'hamburger', 'popcorn', 'télévision', 'horloge', 'clé', 'cerf-volant', 'tente', 'phare', 'ordinateur', 'micro', 'baiser', 'mariage', 'bisou', 'câlin', 'passeport'];
const TPL = {
  coeur: ['Cœur', ['M50 66 C20 46 8 30 18 18 C28 6 44 10 50 22 C56 10 72 6 82 18 C92 30 80 46 50 66 Z']],
  maison: ['Maison', ['M20 70 V35 H80 V70 Z', 'M14 38 L50 10 L86 38', 'M42 70 V50 H58 V70', 'M27 44 H37 V54 H27 Z', 'M63 44 H73 V54 H63 Z']],
  soleil: ['Soleil', ['M63 38 A13 13 0 1 1 37 38 A13 13 0 1 1 63 38', 'M50 8 V20 M50 56 V68 M20 38 H32 M68 38 H80 M29 17 L37 25 M63 51 L71 59 M71 17 L63 25 M37 51 L29 59']],
  etoile: ['Étoile', ['M50 8 L58 30 L82 30 L63 44 L70 67 L50 53 L30 67 L37 44 L18 30 L42 30 Z']],
  poisson: ['Poisson', ['M20 38 C30 20 60 20 72 38 C60 56 30 56 20 38 Z', 'M72 38 L88 26 L88 50 Z', 'M36 34 A2 2 0 1 1 35.9 34']],
  fleur: ['Fleur', ['M56 28 A6 6 0 1 1 44 28 A6 6 0 1 1 56 28', 'M57 16 A7 7 0 1 1 43 16 A7 7 0 1 1 57 16', 'M68 24 A7 7 0 1 1 54 24 A7 7 0 1 1 68 24', 'M64 37 A7 7 0 1 1 50 37 A7 7 0 1 1 64 37', 'M50 37 A7 7 0 1 1 36 37 A7 7 0 1 1 50 37', 'M46 24 A7 7 0 1 1 32 24 A7 7 0 1 1 46 24', 'M50 44 V70', 'M50 58 C42 52 36 54 34 60 C40 62 46 60 50 58']],
  arbre: ['Arbre', ['M44 70 V48 H56 V70', 'M30 50 C18 48 18 30 30 30 C30 16 46 10 52 20 C60 10 78 16 74 30 C86 32 84 50 70 50 Z']],
  bateau: ['Bateau', ['M14 50 H86 L74 62 H26 Z', 'M50 50 V10', 'M52 12 L74 44 H52 Z', 'M48 16 L28 44 H48 Z', 'M10 70 C20 64 30 76 40 70 C50 64 60 76 70 70 C80 64 90 76 96 70']],
  chat: ['Chat', ['M70 42 A20 18 0 1 1 30 42 A20 18 0 1 1 70 42', 'M33 32 L34 14 L46 25 M67 32 L66 14 L54 25', 'M43 40 A2 2 0 1 1 42.9 40 M59 40 A2 2 0 1 1 58.9 40', 'M48 47 L52 47 L50 50 Z', 'M40 50 H26 M40 53 L27 57 M60 50 H74 M60 53 L73 57']],
  voiture: ['Voiture', ['M10 52 V40 L24 38 L34 24 H64 L76 38 L90 42 V52 Z', 'M37 28 H50 V38 H30 Z M54 28 H62 L70 38 H54 Z', 'M34 54 A8 8 0 1 1 18 54 A8 8 0 1 1 34 54', 'M82 54 A8 8 0 1 1 66 54 A8 8 0 1 1 82 54']],
  papillon: ['Papillon', ['M50 20 V62', 'M50 30 C36 6 10 14 20 36 C26 46 42 44 50 38', 'M50 30 C64 6 90 14 80 36 C74 46 58 44 50 38', 'M50 42 C38 44 26 58 34 64 C42 68 48 56 50 48', 'M50 42 C62 44 74 58 66 64 C58 68 52 56 50 48', 'M50 20 L42 10 M50 20 L58 10']],
  bonhomme: ['Bonhomme', ['M58 18 A8 8 0 1 1 42 18 A8 8 0 1 1 58 18', 'M50 26 V50 M50 32 L34 42 M50 32 L66 42 M50 50 L38 68 M50 50 L62 68']],
  lune: ['Lune', ['M60 10 A28 28 0 1 0 60 66 A22 22 0 1 1 60 10 Z']],
};

let ops = [], live = {}, cur = null, tool = 'pen', color = '#e63946', size = 6, lastEmit = 0;
let baseC = null, layer = null, photoImg = null, photoPath = '';
const cv = () => $('cv');
const cfg = () => st.games.canvas || {};
const mode = () => cfg().mode || 'libre';

/* ---------- Calques ---------- */
function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
function tplPaths(k) { return (TPL[k]?.[1] || []).map(d => new Path2D(d)); }
function drawTpl(x, k, w, alpha, col) { x.save(); x.globalAlpha = alpha; x.strokeStyle = col; x.lineWidth = w; x.lineCap = x.lineJoin = 'round'; x.scale(W / 100, H / 75); x.lineWidth = w / (W / 100); tplPaths(k).forEach(p => x.stroke(p)); x.restore(); }
async function buildBase() {
  baseC ||= mk(); const x = baseC.getContext('2d'), c = cfg();
  x.fillStyle = /^#[0-9a-f]{6}$/i.test(c.bg || '') ? c.bg : '#ffffff'; x.fillRect(0, 0, W, H);
  if (c.photo && mode() === 'libre') {
    if (photoPath !== c.photo) { photoPath = c.photo; photoImg = null; try { const u = (await signedUrls([c.photo]))[c.photo]; photoImg = await new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = u; }); } catch (e) { photoImg = null; } }
    if (photoImg) { const s = Math.max(W / photoImg.naturalWidth, H / photoImg.naturalHeight), dw = photoImg.naturalWidth * s, dh = photoImg.naturalHeight * s; x.drawImage(photoImg, (W - dw) / 2, (H - dh) / 2, dw, dh); }
  }
  if (mode() === 'repro' && c.tplMode === 'calque' && TPL[c.tpl]) drawTpl(x, c.tpl, 10, .22, '#1d3fa5');
}
function lineOp(x, o) {
  const p = o.p; if (!Array.isArray(p) || p.length < 2) return;
  const sc = W / 1000, w = Math.max(1, (o.w || 5) * sc);
  x.save(); x.lineCap = x.lineJoin = 'round'; x.lineWidth = w;
  if (o.t === 'erase') { x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000'; } else x.strokeStyle = o.c;
  const X = i => p[i] / 1000 * W, Y = i => p[i + 1] / 1000 * H;
  x.beginPath();
  if (o.t === 'line') { x.moveTo(X(0), Y(0)); x.lineTo(X(2), Y(2)); }
  else if (o.t === 'rect') { x.rect(Math.min(X(0), X(2)), Math.min(Y(0), Y(2)), Math.abs(X(2) - X(0)), Math.abs(Y(2) - Y(0))); }
  else if (o.t === 'circle') { x.ellipse((X(0) + X(2)) / 2, (Y(0) + Y(2)) / 2, Math.abs(X(2) - X(0)) / 2, Math.abs(Y(2) - Y(0)) / 2, 0, 0, Math.PI * 2); }
  else { x.moveTo(X(0), Y(0)); for (let i = 2; i < p.length; i += 2) x.lineTo(X(i), Y(i)); if (p.length === 2) x.lineTo(X(0) + .1, Y(0)); }
  x.stroke(); x.restore();
}
function floodFill(o) {
  const lx = layer.getContext('2d'), comp = mk(), cx = comp.getContext('2d'); cx.drawImage(baseC, 0, 0); cx.drawImage(layer, 0, 0);
  const sx = Math.round(o.p[0] / 1000 * W), sy = Math.round(o.p[1] / 1000 * H); if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const src = cx.getImageData(0, 0, W, H).data, out = lx.getImageData(0, 0, W, H), d = out.data;
  const i0 = (sy * W + sx) * 4, r0 = src[i0], g0 = src[i0 + 1], b0 = src[i0 + 2], tol = 48;
  const [fr, fg, fb] = [1, 3, 5].map(k => parseInt(o.c.slice(k, k + 2), 16));
  const seen = new Uint8Array(W * H), stack = [sx + sy * W];
  const match = j => { const k = j * 4; return Math.abs(src[k] - r0) + Math.abs(src[k + 1] - g0) + Math.abs(src[k + 2] - b0) <= tol; };
  let n = 0;
  while (stack.length && n < W * H) {
    const j = stack.pop(); if (seen[j]) continue; seen[j] = 1; if (!match(j)) continue; n++;
    const k = j * 4; d[k] = fr; d[k + 1] = fg; d[k + 2] = fb; d[k + 3] = 255;
    const x = j % W; if (x > 0) stack.push(j - 1); if (x < W - 1) stack.push(j + 1); if (j >= W) stack.push(j - W); if (j < W * (H - 1)) stack.push(j + W);
  }
  // déborde d'un pixel pour couvrir l'anticrénelage des traits
  lx.putImageData(out, 0, 0);
}
function replay() {
  layer ||= mk(); const x = layer.getContext('2d'); x.clearRect(0, 0, W, H);
  for (const o of ops) { if (o.t === 'fill') floodFill(o); else lineOp(x, o); }
  paint();
}
function paint() {
  const c = cv(), x = c.getContext('2d'); if (!c.width || !baseC) return;
  x.drawImage(baseC, 0, 0, c.width, c.height); x.drawImage(layer || mk(), 0, 0, c.width, c.height);
  const s = c.width / W;
  x.save(); x.scale(s, s);
  Object.values(live).forEach(o => lineOp(x, o)); if (cur) { if (cur.t === 'erase') { x.restore(); const t = mk(); t.getContext('2d').drawImage(layer, 0, 0); lineOp(t.getContext('2d'), cur); x.drawImage(baseC, 0, 0, c.width, c.height); x.drawImage(t, 0, 0, c.width, c.height); return; } lineOp(x, cur); }
  x.restore();
}
function size_() { const c = cv(), r = c.getBoundingClientRect(); if (!r.width) return; const d = Math.min(2, devicePixelRatio || 1); c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); paint(); }

/* ---------- Saisie ---------- */
const pt = e => { const r = cv().getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 1000)]; };
function canDraw() {
  if (mode() !== 'pictio') return true;
  const p = st.games.pictio; if (!p || !p.word) return true;
  if (p.drawer !== st.me) { toast('C\'est ' + nameOf(p.drawer) + ' qui dessine : devine !'); return false; }
  return true;
}
async function commit(o) {
  ops.push({ ...o, author: st.me }); live = {}; replay();
  send('draw', { id: o.id, c: o.c, t: o.t, w: o.w, n: o.p.length, p: o.p.slice(-300), done: 1 });
  const { error } = await sb.from('strokes').insert({ id: o.id, couple_id: st.couple.id, color: o.c, points: { t: o.t, w: o.w, p: o.p } });
  if (error) toast('Trait non enregistré');
}
function initInput() {
  const c = cv();
  c.addEventListener('pointerdown', e => {
    if (!canDraw()) return;
    c.setPointerCapture(e.pointerId); const p = pt(e);
    if (tool === 'fill') { commit({ id: uid(), t: 'fill', c: color, w: 0, p }); return; }
    cur = { id: uid(), t: tool, c: color, w: tool === 'erase' ? size * 3 : size, p: tool === 'pen' || tool === 'erase' ? p : [...p, ...p] };
    paint();
  });
  c.addEventListener('pointermove', e => {
    if (!cur) return; const p = pt(e);
    if (cur.t === 'pen' || cur.t === 'erase') { cur.p.push(...p); if (cur.p.length > 1400) { const end = cur.p.slice(-2), t = cur.t, col = cur.c, w = cur.w; commit(cur); cur = { id: uid(), t, c: col, w, p: end }; } }
    else { cur.p[2] = p[0]; cur.p[3] = p[1]; }
    paint();
    const n = Date.now(); if (n - lastEmit > 60) { lastEmit = n; send('draw', { id: cur.id, c: cur.c, t: cur.t, w: cur.w, n: cur.p.length, p: cur.t === 'pen' || cur.t === 'erase' ? cur.p.slice(-300) : cur.p }); }
  });
  const end = () => { if (!cur) return; const o = cur; cur = null; if (o.p.length >= 2) commit(o); else paint(); };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  listen('draw', d => {
    if (typeof d.id !== 'string') return;
    if (d.done) { delete live[d.id]; return; }
    const p = Array.isArray(d.p) ? d.p.filter(n => typeof n === 'number').slice(0, 600) : [];
    const n = +d.n || p.length, start = n - p.length, prev = live[d.id], t = ['pen', 'erase', 'line', 'rect', 'circle'].includes(d.t) ? d.t : 'pen';
    live[d.id] = { t, w: +d.w || 5, c: String(d.c || '#000'), p: t === 'pen' || t === 'erase' ? (prev && prev.p.length >= start ? prev.p.slice(0, start).concat(p) : p) : p };
    paint();
  });
}

/* ---------- Galerie ---------- */
function renderGallery() {
  const rows = (st.rows.memories || []).filter(m => m.kind === 'dessin');
  signedUrls(rows.map(r => r.path)).then(u => {
    $('dGallery').innerHTML = rows.length ? rows.map(r => `<figure><img src="${esc(u[r.path])}" alt="${esc(r.caption)}" loading="lazy"><div>${esc(r.caption)}</div><a href="${esc(u[r.path])}" download="dessin.png" target="_blank" rel="noopener">Télécharger</a></figure>`).join('') : '<p class="mute">Vos dessins enregistrés avec 💾 apparaîtront ici (et dans Souvenirs).</p>';
  });
}
async function saveDrawing() {
  const out = mk(), x = out.getContext('2d'); x.drawImage(baseC, 0, 0); x.drawImage(layer, 0, 0);
  const title = mode() === 'pictio' && st.games.pictio?.word ? 'Devinette : ' + st.games.pictio.word : mode() === 'repro' && TPL[cfg().tpl] ? 'Modèle : ' + TPL[cfg().tpl][0] : 'Dessin à deux';
  $('dSave').disabled = true;
  try {
    const blob = await new Promise(r => out.toBlob(r, 'image/png'));
    const path = await uploadPhoto(new Blob([blob], { type: 'image/png' }), 'dessin');
    await q(sb.from('memories').insert({ couple_id: st.couple.id, path, caption: title + ' · ' + new Date().toLocaleDateString('fr-FR'), kind: 'dessin' }));
    toast('Dessin ajouté à la galerie ♥'); loadTable('memories');
  } catch (e) { toast('Enregistrement impossible.'); }
  $('dSave').disabled = false;
}

/* ---------- Modes ---------- */
async function clearAll() { ops = []; live = {}; replay(); await q(sb.from('strokes').delete().eq('couple_id', st.couple.id)).catch(() => { }); loadTable('strokes'); }
function setMode(m) { saveGame('canvas', { ...cfg(), mode: m }); }
function renderMode() {
  const m = mode();
  document.querySelectorAll('#dTabs [data-dm]').forEach(b => b.classList.toggle('sel', b.dataset.dm === m));
  document.querySelectorAll('.dpanel').forEach(p => p.hidden = p.dataset.p !== m);
  $('dBg').value = /^#[0-9a-f]{6}$/i.test(cfg().bg || '') ? cfg().bg : '#ffffff';
  if (m === 'repro') renderRepro(); if (m === 'pictio') renderPictio();
  buildBase().then(replay);
}

/* Devinettes */
const pic = () => st.games.pictio || null;
function hint(p) {
  const w = p.word, letters = [...w].map((ch, i) => /[a-zà-ÿ]/i.test(ch) ? i : -1).filter(i => i >= 0);
  const el = (Date.now() - p.start) / 1000, f = el / p.dur, k = f > .85 ? 3 : f > .65 ? 2 : f > .4 ? 1 : 0;
  let s = p.round * 977 + 13; const order = [...letters].sort((a, b) => ((a * 31 + s) % 97) - ((b * 31 + s) % 97)); const shown = new Set(order.slice(0, Math.min(k, letters.length - 1)));
  return [...w].map((ch, i) => !/[a-zà-ÿ]/i.test(ch) ? (ch === ' ' ? '  ' : ch) : shown.has(i) ? ch.toUpperCase() : '_').join(' ');
}
function renderPictio() {
  const p = pic(), sc = p?.scores || {};
  $('pScores').textContent = Object.keys(sc).length ? Object.entries(sc).map(([id, n]) => nameOf(id) + ' ' + n).join(' · ') : '';
  if (!p || !p.word) { $('pWord').textContent = '—'; $('pInfo').textContent = 'Lancez une partie : chacun dessine à son tour, l\'autre devine avant la fin du chrono. Des lettres se dévoilent avec le temps.'; $('pTime').textContent = ''; $('pGuessRow').hidden = true; $('pNext').hidden = true; return; }
  const left = Math.ceil((p.start + p.dur * 1000 - Date.now()) / 1000), pre = Math.ceil((p.start - Date.now()) / 1000), over = p.found || left <= 0, mine = p.drawer === st.me;
  $('pTime').textContent = p.found ? '✓' : pre > 0 ? pre : left > 0 ? left + ' s' : '0 s';
  $('pWord').textContent = over || mine ? p.word.toUpperCase() : hint(p);
  $('pInfo').textContent = `Manche ${p.round} · ` + (p.found ? `🎉 ${nameOf(p.foundBy)} a trouvé !` : left <= 0 ? '⏰ Temps écoulé !' : mine ? 'À toi de dessiner ce mot (sans écrire de lettres !)' : nameOf(p.drawer) + ' dessine… devine !');
  $('pGuessRow').hidden = over || mine || pre > 0;
  $('pNext').hidden = !over;
  $('pGuesses').innerHTML = (p.guesses || []).slice(-10).map(g => `<span>${esc(g)}</span>`).join('');
}
function newRound(next) {
  const p = pic(), o = partner()?.user_id;
  const drawer = next && p ? (p.drawer === st.me ? (o || st.me) : st.me) : st.me;
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  saveGame('pictio', { round: next && p ? (p.round || 0) + 1 : 1, drawer, word, start: Date.now() + 3000, dur: 90, found: false, foundBy: '', guesses: [], scores: next && p ? (p.scores || {}) : {} });
  clearAll();
}
function guess() {
  const p = pic(), g = $('pGuess').value.trim(); if (!p || !g || p.found) return; $('pGuess').value = '';
  if (norm(g) === norm(p.word)) {
    const left = Math.max(0, Math.ceil((p.start + p.dur * 1000 - Date.now()) / 1000)), sc = { ...(p.scores || {}) };
    sc[st.me] = (sc[st.me] || 0) + Math.max(1, Math.ceil(left / 10)); sc[p.drawer] = (sc[p.drawer] || 0) + 2;
    saveGame('pictio', { ...p, found: true, foundBy: st.me, scores: sc }); floatEmo('🎉');
  } else { saveGame('pictio', { ...p, guesses: [...(p.guesses || []), g.slice(0, 30)].slice(-20) }); toast('Non… essaie encore !'); }
}

/* Reproduire */
function renderRepro() {
  const c = cfg(), k = TPL[c.tpl] ? c.tpl : 'coeur';
  $('rTpl').value = k; $('rMode').value = c.tplMode || 'defi';
  const m = $('rModel'), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, m.width, m.height);
  x.save(); x.scale(m.width / W, m.height / H); drawTpl(x, k, 12, 1, '#1b1b1b'); x.restore();
  const res = (st.games.repro?.tpl === k && st.games.repro.results) || [];
  $('rRes').innerHTML = res.length ? res.map(r => `${esc(nameOf(r.by))} : <b>${r.score} %</b>`).join(' · ') + (res.length > 1 ? ` — ${esc(nameOf([...res].sort((a, b) => b.score - a.score)[0].by))} gagne 🏆` : '') : 'Dessinez le modèle sur la feuille, puis « Valider » pour voir votre score de ressemblance. Chacun son tour !';
}
function similarity() {
  const G = 10, gw = W / G, gh = H / G;
  const grid = (cnv, test) => { const d = cnv.getContext('2d').getImageData(0, 0, W, H).data, out = new Uint8Array(gw * gh); for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const k = (y * W + x) * 4; if (test(d, k)) out[Math.floor(y / G) * gw + Math.floor(x / G)] = 1; } return out; };
  const t = mk(); drawTpl(t.getContext('2d'), cfg().tpl in TPL ? cfg().tpl : 'coeur', 12, 1, '#000');
  const T = grid(t, (d, k) => d[k + 3] > 100), D = grid(layer, (d, k) => d[k + 3] > 100);
  const dil = a => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) if (a[i]) { const x = i % gw, y = Math.floor(i / gw); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh) o[Y * gw + X] = 1; } } return o; };
  const Td = dil(T), Dd = dil(D); let t1 = 0, tc = 0, d1 = 0, dc = 0;
  for (let i = 0; i < T.length; i++) { if (T[i]) { t1++; if (Dd[i]) tc++; } if (D[i]) { d1++; if (Td[i]) dc++; } }
  if (!d1) return 0; const R = tc / t1, P = dc / d1; return Math.round(100 * (2 * P * R) / (P + R || 1));
}

export function initDessin() {
  $('dCols').innerHTML = COLS.map(c => `<button data-c="${c}" class="${c === color ? 'sel' : ''}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('') + '<input type="color" id="dCustom" value="#e63946" aria-label="Autre couleur">';
  $('dCols').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; document.querySelectorAll('#dCols [data-c]').forEach(x => x.classList.toggle('sel', x === b)); if (tool === 'erase') selTool('pen'); };
  $('dCustom').oninput = e => { color = e.target.value; document.querySelectorAll('#dCols [data-c]').forEach(x => x.classList.remove('sel')); };
  $('dSize').oninput = e => { size = +e.target.value; };
  const selTool = t => { tool = t; document.querySelectorAll('#dTools [data-t]').forEach(b => b.classList.toggle('sel', b.dataset.t === t)); };
  $('dTools').onclick = e => { const b = e.target.closest('[data-t]'); if (b) selTool(b.dataset.t); };
  $('dUndo').onclick = async () => { const mine = [...ops].reverse().find(o => o.author === st.me); if (!mine) return toast('Rien à annuler'); ops = ops.filter(o => o !== mine); replay(); await sb.from('strokes').delete().eq('id', mine.id); send('draw', { id: mine.id, done: 1 }); loadTable('strokes'); };
  $('dClear').onclick = () => { if ($('dClear').dataset.sure !== '1') { $('dClear').dataset.sure = '1'; $('dClear').textContent = '❓'; setTimeout(() => { $('dClear').dataset.sure = ''; $('dClear').textContent = '🗑️'; }, 2500); return; } $('dClear').dataset.sure = ''; $('dClear').textContent = '🗑️'; clearAll(); };
  $('dSave').onclick = saveDrawing;
  $('dTabs').onclick = e => { const b = e.target.closest('[data-dm]'); if (b) setMode(b.dataset.dm); };
  $('dBg').onchange = () => saveGame('canvas', { ...cfg(), bg: $('dBg').value });
  $('dPhoto').onchange = () => saveGame('canvas', { ...cfg(), photo: $('dPhoto').value });
  $('dNoPhoto').onclick = () => { $('dPhoto').value = ''; saveGame('canvas', { ...cfg(), photo: '' }); };
  $('rTpl').innerHTML = Object.entries(TPL).map(([k, v]) => `<option value="${k}">${esc(v[1] ? v[0] : k)}</option>`).join('');
  $('rTpl').onchange = () => saveGame('canvas', { ...cfg(), tpl: $('rTpl').value });
  $('rMode').onchange = () => saveGame('canvas', { ...cfg(), tplMode: $('rMode').value });
  $('rRand').onclick = () => { const ks = Object.keys(TPL); saveGame('canvas', { ...cfg(), tpl: ks[Math.floor(Math.random() * ks.length)] }); clearAll(); };
  $('rCheck').onclick = () => {
    if (!ops.some(o => o.author === st.me) && !ops.length) return toast('Dessine d\'abord le modèle !');
    const score = similarity(), k = cfg().tpl in TPL ? cfg().tpl : 'coeur', r = st.games.repro?.tpl === k ? st.games.repro : { tpl: k, results: [] };
    const results = [...r.results.filter(x => x.by !== st.me), { by: st.me, score }];
    saveGame('repro', { tpl: k, results }); toast(`Ressemblance : ${score} %`); if (score >= 70) floatEmo('🏆');
    clearAll();
  };
  $('pNew').onclick = () => newRound(false);
  $('pNext').onclick = () => newRound(true);
  $('pGuessBtn').onclick = guess; $('pGuess').addEventListener('keydown', e => { if (e.key === 'Enter') guess(); });
  setInterval(() => { if (mode() === 'pictio' && !document.querySelector('.game[data-g="dessin"]').hidden) renderPictio(); }, 300);

  onGame('canvas', renderMode);
  onGame('pictio', p => { if (mode() === 'pictio') renderPictio(); if (p?.found) floatEmo('🎉'); });
  onGame('repro', () => { if (mode() === 'repro') renderRepro(); });
  onTable('strokes', rows => {
    ops = rows.map(r => { const pt_ = r.points; return Array.isArray(pt_) ? { id: r.id, t: 'pen', w: 5, c: r.color, p: pt_, author: r.author } : { id: r.id, t: pt_?.t || 'pen', w: pt_?.w || 5, c: r.color, p: pt_?.p || [], author: r.author }; });
    rows.forEach(r => delete live[r.id]);
    if (baseC) replay();
  });
  onTable('memories', rows => {
    const photos = rows.filter(m => m.kind === 'photo' || !m.kind);
    const cur_ = cfg().photo || '';
    $('dPhoto').innerHTML = '<option value="">📷 Dessiner sur une de nos photos…</option>' + photos.map((m, i) => `<option value="${esc(m.path)}">${esc(m.caption || 'Photo ' + (photos.length - i))}</option>`).join('');
    $('dPhoto').value = cur_;
    renderGallery();
  });
  new ResizeObserver(size_).observe(cv());
  initInput();
  buildBase().then(replay); renderMode();
}
