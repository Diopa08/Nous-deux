import { sb, st, $, esc, toast, floatEmo, listen, send, uploadPhoto, loadTable, q } from './core.js?v=17';
import { boothCam, boothRelease, callActive } from './call.js?v=17';

/* =========================================================
   Photobooth : prises synchronisées, mises en page, cadres,
   filtres, stickers et texte, GIF animé
   ========================================================= */
const FILTERS = {
  none: ['Naturel', 'none', []],
  doux: ['Lumière douce', 'brightness(1.08) saturate(1.1) contrast(.95)', ['glow']],
  rose: ['Rose', 'sepia(.3) saturate(1.35) hue-rotate(-18deg) brightness(1.06)', ['pink']],
  vif: ['Vif', 'contrast(1.15) saturate(1.5)', []],
  retro: ['Rétro', 'sepia(.5) saturate(1.4) hue-rotate(-12deg) contrast(1.1)', ['grain', 'vignette']],
  sepia: ['Sépia', 'sepia(.8) contrast(1.05)', ['vignette']],
  nb: ['Noir & blanc', 'grayscale(1) contrast(1.1)', []],
  cine: ['Ciné noir & blanc', 'grayscale(1) contrast(1.4) brightness(.95)', ['grain', 'vignette']],
  grain: ['Grain argentique', 'contrast(1.05) saturate(.9)', ['grain']],
  coeurs: ['Cœurs qui tombent', 'brightness(1.04) saturate(1.15)', ['hearts']],
};
const STICKERS = ['❤️', '💕', '😘', '🥰', '💋', '🌹', '✨', '⭐', '🌙', '✈️', '💍', '👑', '🎉', '😂', '🔥', '🍿'];
const FRAMES = {
  avion: { bg: '#fffdf8', ink: '#1d3fa5', sub: '#7a7a8a' },
  coeurs: { bg: '#fff0f4', ink: '#c2185b', sub: '#a0607a' },
  film: { bg: '#141414', ink: '#f4efe1', sub: '#9a9a9a' },
  nuit: { bg: '#14163a', ink: '#f2c46d', sub: '#b3b2d6' },
  simple: { bg: '#ffffff', ink: '#222222', sub: '#888888' },
};

let shots = [], busy = false, items = [], sel = -1, cfg = null, gifBlob = null;
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

function grab(video, mirror) {
  const W = 640, H = 480, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) { x.fillStyle = '#222'; x.fillRect(0, 0, W, H); return c; }
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
  if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
  x.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return c;
}

/* Une prise = sa photo et la mienne côte à côte, avec le filtre et ses effets */
function shotImage(s, fkey, seed) {
  const [, css, fx] = FILTERS[fkey] || FILTERS.none;
  const parts = s.r ? [s.l, s.r] : [s.l];
  const W = 640 * parts.length, H = 480, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.filter = css; parts.forEach((p, i) => x.drawImage(p, i * 640, 0)); x.filter = 'none';
  if (parts.length === 2) { x.fillStyle = '#fff'; x.fillRect(638, 0, 4, H); }
  const R = rng(seed);
  if (fx.includes('glow')) { x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = .35; x.filter = 'blur(14px) brightness(1.1)'; x.drawImage(c, 0, 0); x.restore(); }
  if (fx.includes('pink')) { x.save(); x.globalCompositeOperation = 'soft-light'; x.fillStyle = '#ff7aa8'; x.globalAlpha = .45; x.fillRect(0, 0, W, H); x.restore(); }
  if (fx.includes('grain')) {
    const d = x.getImageData(0, 0, W, H), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const n = (R() - .5) * 38; a[i] += n; a[i + 1] += n; a[i + 2] += n; }
    x.putImageData(d, 0, 0);
  }
  if (fx.includes('vignette')) { const g = x.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, '#0000'); g.addColorStop(1, '#000a'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  if (fx.includes('hearts')) { x.save(); x.textAlign = 'center'; for (let i = 0; i < 14; i++) { x.globalAlpha = .55 + R() * .4; x.font = `${18 + R() * 34}px serif`; x.fillText(['❤️', '💕', '💗'][Math.floor(R() * 3)], R() * W, R() * H); } x.restore(); }
  return c;
}

/* Décor du cadre */
function decorate(x, W, H, frame, seed) {
  const F = FRAMES[frame] || FRAMES.simple, R = rng(seed);
  x.fillStyle = F.bg; x.fillRect(0, 0, W, H);
  if (frame === 'avion') {
    const b = 16; x.save(); x.beginPath(); x.rect(0, 0, W, H); x.rect(b, b, W - 2 * b, H - 2 * b); x.clip('evenodd');
    for (let i = -H, k = 0; i < W + H; i += 56, k++) { x.fillStyle = k % 2 ? '#1d3fa5' : '#d32f45'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 28, 0); x.lineTo(i + 28 - H, H); x.lineTo(i - H, H); x.fill(); }
    x.restore();
  } else if (frame === 'coeurs') {
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 70; i++) { const edge = R() < .5; const px = edge ? (R() < .5 ? R() * 40 : W - R() * 40) : R() * W, py = edge ? R() * H : (R() < .5 ? R() * 40 : H - R() * 40); x.globalAlpha = .35 + R() * .5; x.font = `${14 + R() * 22}px serif`; x.fillText(['❤', '♥', '💕'][Math.floor(R() * 3)], px, py); }
    x.restore();
  } else if (frame === 'film') {
    x.fillStyle = '#f4efe1'; for (let y = 14; y < H - 10; y += 34) { x.beginPath(); x.roundRect(8, y, 16, 20, 4); x.roundRect(W - 24, y, 16, 20, 4); x.fill(); }
  } else if (frame === 'nuit') {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#14163a'); g.addColorStop(1, '#2a1f5c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,244,214,${.3 + R() * .7})`; x.beginPath(); x.arc(R() * W, R() * H, R() * 1.8 + .3, 0, Math.PI * 2); x.fill(); }
  }
  return F;
}

function compose() {
  const c = $('strip'), x = c.getContext('2d'), n = shots.length;
  if (!n) return;
  const imgs = shots.map((s, i) => shotImage(s, cfg.filter, 1000 + i * 77));
  const ar = imgs[0].width / imgs[0].height, layout = cfg.layout, frame = cfg.frame, seed = 4242;
  const text = cfg.text || 'Nous deux ♥', date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  let W, H, cells = [];
  const side = frame === 'film' ? 44 : 34;
  if (layout === 'strip') {
    W = ar > 1.5 ? 900 : 640; const cw = W - side * 2, ch = cw / ar, gap = 14, head = 110, foot = 70;
    H = head + n * (ch + gap) - gap + foot;
    cells = imgs.map((im, i) => ({ im, x: side, y: head + i * (ch + gap), w: cw, h: ch }));
  } else if (layout === 'grid') {
    const cols = n === 1 ? 1 : 2, rows = Math.ceil(n / cols); W = 1200; const gap = 16, cw = (W - side * 2 - gap * (cols - 1)) / cols, ch = cw / ar, head = 120, foot = 76;
    H = head + rows * (ch + gap) - gap + foot;
    cells = imgs.map((im, i) => { const r = Math.floor(i / cols), co = i % cols, lastRowOdd = n % 2 && r === rows - 1 && cols === 2; return { im, x: side + co * (cw + gap) + (lastRowOdd ? (cw + gap) / 2 : 0), y: head + r * (ch + gap), w: cw, h: ch }; });
  } else if (layout === 'polaroid') {
    const cols = n === 1 ? 1 : 2, rows = Math.ceil(n / cols); W = 1200; const R = rng(seed), pw = (W - 120) / cols - 40, ph = pw / ar, card = { pad: 18, bottom: 70 };
    const rowH = ph + card.pad + card.bottom + 50; H = 130 + rows * rowH + 40;
    cells = imgs.map((im, i) => { const r = Math.floor(i / cols), co = i % cols, odd = n % 2 && cols === 2 && r === rows - 1; return { im, x: 60 + co * (pw + 80) + 20 + (odd ? (pw + 80) / 2 : 0), y: 130 + r * rowH + 20, w: pw, h: ph, polaroid: card, rot: (R() - .5) * 0.12 }; });
  } else {
    W = 1500; H = 1000; const left = 900, cols = n <= 2 ? 1 : 2, rows = Math.ceil(n / cols), gap = 14;
    let cw = (left - 60 - gap * (cols - 1)) / cols, ch = cw / ar; const maxH = (H - 80 - gap * (rows - 1)) / rows; if (ch > maxH) { ch = maxH; cw = ch * ar; }
    const gx = 40 + (left - 40 - (cols * cw + (cols - 1) * gap)) / 2, gy = 40 + (H - 80 - (rows * ch + (rows - 1) * gap)) / 2;
    cells = imgs.map((im, i) => ({ im, x: gx + (i % cols) * (cw + gap), y: gy + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
  }
  c.width = Math.round(W); c.height = Math.round(H);
  const F = decorate(x, c.width, c.height, frame, seed);
  for (const cell of cells) {
    x.save();
    if (cell.polaroid) {
      const p = cell.polaroid; x.translate(cell.x + cell.w / 2, cell.y + cell.h / 2); x.rotate(cell.rot); x.translate(-cell.w / 2, -cell.h / 2);
      x.shadowColor = '#0005'; x.shadowBlur = 24; x.shadowOffsetY = 8; x.fillStyle = '#fff'; x.fillRect(-p.pad, -p.pad, cell.w + p.pad * 2, cell.h + p.pad + p.bottom); x.shadowColor = 'transparent';
      x.drawImage(cell.im, 0, 0, cell.w, cell.h);
    } else {
      x.shadowColor = frame === 'film' ? 'transparent' : '#0003'; x.shadowBlur = 12; x.shadowOffsetY = 4;
      x.drawImage(cell.im, cell.x, cell.y, cell.w, cell.h);
    }
    x.restore();
  }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  if (layout === 'postcard') {
    x.strokeStyle = F.sub; x.globalAlpha = .5; x.lineWidth = 2; x.beginPath(); x.moveTo(940, 120); x.lineTo(940, H - 120); x.stroke(); x.globalAlpha = 1;
    x.save(); x.translate(1330, 110); x.fillStyle = '#fff'; x.strokeStyle = '#d32f45'; x.lineWidth = 3; x.setLineDash([6, 5]); x.fillRect(-70, -60, 140, 150); x.strokeRect(-70, -60, 140, 150); x.setLineDash([]); x.font = '64px serif'; x.fillText('💌', 0, 40); x.restore();
    x.fillStyle = F.ink; x.font = '700 64px Caveat, cursive'; x.textAlign = 'left'; wrap(x, text, 990, 400, 440, 70);
    x.strokeStyle = F.sub; x.globalAlpha = .45; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(990, 640 + i * 70); x.lineTo(1440, 640 + i * 70); x.stroke(); } x.globalAlpha = 1;
    x.fillStyle = F.sub; x.font = '500 26px "DM Sans", sans-serif'; x.fillText('PAR AVION · ' + date, 990, H - 70);
  } else {
    x.fillStyle = F.ink; x.font = `700 ${layout === 'strip' && W < 700 ? 54 : 68}px Caveat, cursive`; x.fillText(text, c.width / 2, layout === 'polaroid' ? 92 : 78);
    x.fillStyle = F.sub; x.font = '500 24px "DM Sans", sans-serif'; x.fillText(date, c.width / 2, c.height - 30);
  }
  // Stickers et textes
  items.forEach((it, i) => {
    x.save(); x.translate(it.x * c.width, it.y * c.height); x.rotate((it.rot || 0) * Math.PI / 180);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const size = it.size * c.width / 1000;
    if (it.t === 's') { x.font = `${size}px serif`; x.fillText(it.v, 0, 0); }
    else { x.font = `700 ${size}px "${it.f || 'Caveat'}", cursive`; x.lineWidth = size / 8; x.strokeStyle = '#ffffffdd'; x.lineJoin = 'round'; x.strokeText(it.v, 0, 0); x.fillStyle = it.c || '#e63962'; x.fillText(it.v, 0, 0); }
    const m = x.measureText(it.v); it._w = m.width / c.width; it._h = size / c.height;
    if (i === sel) { x.setLineDash([8, 6]); x.strokeStyle = '#1d3fa5'; x.lineWidth = 3; x.strokeRect(-m.width / 2 - 10, -size / 2 - 8, m.width + 20, size + 16); }
    x.restore();
  });
}
function wrap(x, t, X, Y, maxW, lh) { const words = t.split(' '); let line = '', y = Y; for (const w of words) { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { x.fillText(line, X, y); line = w; y += lh; } else line = test; } x.fillText(line, X, y); }

function exportImage() { const s = sel; sel = -1; compose(); const url = $('strip').toDataURL('image/jpeg', .92); sel = s; compose(); return url; }
function refresh() { if (!shots.length) return; compose(); $('boothDl').href = exportImage(); $('bSel').hidden = sel < 0; if (sel >= 0) { $('bSize').value = items[sel].size; $('bRot').value = items[sel].rot || 0; } }
function readCfg() { return { n: +$('bShots').value, count: +$('bCount').value, filter: $('bFilter').value, layout: $('bLayout').value, frame: $('bFrame').value, text: $('boothText').value.trim().slice(0, 40) }; }

function thumbs() {
  $('bThumbs').innerHTML = shots.map((s, i) => { const im = shotImage(s, 'none', 1); const t = document.createElement('canvas'); t.width = 220; t.height = 220 / (im.width / im.height); t.getContext('2d').drawImage(im, 0, 0, t.width, t.height); return `<button data-k="${i}" title="Reprendre la photo ${i + 1}"><img src="${t.toDataURL('image/jpeg', .7)}" alt="Photo ${i + 1}"><span>↺ ${i + 1}</span></button>`; }).join('');
}

async function countdown(at, secs) {
  const cnt = $('boothCount'), fl = $('flash');
  cnt.hidden = false;
  for (let k = secs; k > 0; k--) { await wait(at - k * 1000 - Date.now()); cnt.textContent = k; }
  await wait(at - Date.now()); cnt.textContent = ''; fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 70);
}
function snap(vL, vR) { const remoteOk = vR.srcObject && vR.videoWidth; return { l: grab(vL, true), r: remoteOk ? grab(vR, false) : null }; }

async function run(c) {
  if (busy) return; busy = true; cfg = { ...readCfg(), ...c };
  ['bShots', 'bCount', 'bFilter', 'bLayout', 'bFrame'].forEach(id => { const k = { bShots: 'n', bCount: 'count', bFilter: 'filter', bLayout: 'layout', bFrame: 'frame' }[id]; if (cfg[k] != null) $(id).value = cfg[k]; });
  if (c.text != null) $('boothText').value = c.text;
  location.hash = 'appel'; $('boothPanel').hidden = false; $('boothResult').hidden = true; $('gifBox').hidden = true;
  let vids; try { vids = await boothCam(); } catch (e) { busy = false; boothRelease(); return; }
  shots = []; items = []; sel = -1;
  const gapMs = (cfg.count + 1.2) * 1000;
  for (let k = 0; k < cfg.n; k++) { await countdown(c.at + k * gapMs, cfg.count); shots.push(snap(vids.vL, vids.vR)); }
  $('boothCount').hidden = true; busy = false;
  thumbs(); $('boothResult').hidden = false; refresh();
  boothRelease();
  $('boothResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function retake(k, at, secs) {
  if (busy || !shots[k]) return; busy = true;
  location.hash = 'appel';
  let vids; try { vids = await boothCam(); } catch (e) { busy = false; boothRelease(); return; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await countdown(at, secs); shots[k] = snap(vids.vL, vids.vR);
  $('boothCount').hidden = true; busy = false; boothRelease(); thumbs(); refresh();
  $('boothResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* GIF animé : une image par prise */
async function makeGif() {
  if (!shots.length) return;
  $('bGif').disabled = true; $('bGif').textContent = 'Création du GIF…';
  try {
    const { GIFEncoder, quantize, applyPalette } = await import('./vendor/gifenc.esm.js');
    const imgs = shots.map((s, i) => shotImage(s, cfg.filter, 1000 + i * 77));
    const W = Math.min(720, imgs[0].width), H = Math.round(W / (imgs[0].width / imgs[0].height)) + 70;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const F = FRAMES[cfg.frame] || FRAMES.simple, enc = GIFEncoder();
    const frames = imgs.length > 1 ? [...imgs, ...imgs.slice(1, -1).reverse()] : imgs;
    for (const im of frames) {
      x.fillStyle = F.bg; x.fillRect(0, 0, W, H);
      x.drawImage(im, 0, 0, W, H - 70);
      x.fillStyle = F.ink; x.font = '700 40px Caveat, cursive'; x.textAlign = 'center'; x.fillText(cfg.text || 'Nous deux ♥', W / 2, H - 22);
      const { data } = x.getImageData(0, 0, W, H), pal = quantize(data, 256), idx = applyPalette(data, pal);
      enc.writeFrame(idx, W, H, { palette: pal, delay: 450 });
    }
    enc.finish();
    gifBlob = new Blob([enc.bytes()], { type: 'image/gif' });
    const url = URL.createObjectURL(gifBlob);
    $('gifImg').src = url; $('gifDl').href = url; $('gifBox').hidden = false;
    $('gifBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { console.error(e); toast('Impossible de créer le GIF.'); }
  $('bGif').disabled = false; $('bGif').textContent = '🎞️ Créer un GIF animé';
}

async function saveBlob(blob, caption) {
  const path = await uploadPhoto(blob, 'booth');
  await q(sb.from('memories').insert({ couple_id: st.couple.id, path, caption: caption.slice(0, 200), kind: 'strip' }));
  toast('Ajouté aux souvenirs ♥'); loadTable('memories');
}

export function initBooth() {
  $('bFilter').innerHTML = Object.entries(FILTERS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('');
  $('bStickers').innerHTML = STICKERS.map(s => `<button data-s="${s}" aria-label="Sticker ${s}">${s}</button>`).join('');
  $('boothBtn').onclick = () => { $('boothPanel').hidden = !$('boothPanel').hidden; if (!$('boothPanel').hidden) $('boothPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('boothGo').onclick = () => {
    const c = readCfg(); c.at = Date.now() + 600 + c.count * 1000;
    if (callActive()) send('booth', c);
    run(c);
  };
  ['bFilter', 'bLayout', 'bFrame'].forEach(id => $(id).addEventListener('change', () => { if (cfg) { cfg = { ...cfg, ...readCfg(), n: cfg.n, count: cfg.count }; refresh(); } }));
  $('boothText').addEventListener('input', () => { if (cfg) { cfg.text = $('boothText').value.trim().slice(0, 40); refresh(); } });
  $('bThumbs').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const secs = +$('bCount').value, at = Date.now() + 600 + secs * 1000; if (callActive()) send('booth-re', { k: +b.dataset.k, at, secs }); retake(+b.dataset.k, at, secs); };
  $('bStickers').onclick = e => { const b = e.target.closest('[data-s]'); if (!b || !shots.length) return; items.push({ t: 's', v: b.dataset.s, x: .2 + Math.random() * .6, y: .2 + Math.random() * .6, size: 90, rot: 0 }); sel = items.length - 1; refresh(); };
  $('bAddText').onclick = () => { const v = $('bText').value.trim(); if (!v || !shots.length) return; items.push({ t: 't', v, x: .5, y: .5, size: 80, rot: 0, c: $('bColor').value, f: $('bFont').value }); sel = items.length - 1; $('bText').value = ''; refresh(); };
  $('bSize').oninput = () => { if (sel >= 0) { items[sel].size = +$('bSize').value; refresh(); } };
  $('bRot').oninput = () => { if (sel >= 0) { items[sel].rot = +$('bRot').value; refresh(); } };
  $('bDel').onclick = () => { if (sel >= 0) { items.splice(sel, 1); sel = -1; refresh(); } };

  // Glisser-déposer sur la photo
  const cv = $('strip'); let drag = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.addEventListener('pointerdown', e => {
    const [px, py] = pos(e); let hit = -1;
    for (let i = items.length - 1; i >= 0; i--) { const it = items[i], w = (it._w || .1) / 2 + .02, h = (it._h || .06) / 2 + .02; if (Math.abs(px - it.x) < w && Math.abs(py - it.y) < h) { hit = i; break; } }
    sel = hit; if (hit >= 0) { drag = { dx: px - items[hit].x, dy: py - items[hit].y }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; }
    refresh();
  });
  cv.addEventListener('pointermove', e => { if (!drag || sel < 0) return; const [px, py] = pos(e); items[sel].x = Math.min(1, Math.max(0, px - drag.dx)); items[sel].y = Math.min(1, Math.max(0, py - drag.dy)); compose(); });
  const end = () => { if (drag) { drag = null; cv.style.cursor = ''; refresh(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  $('boothSave').onclick = async () => { if (!shots.length) return; $('boothSave').disabled = true; const s = sel; sel = -1; compose(); try { const blob = await new Promise(r => $('strip').toBlob(r, 'image/jpeg', .92)); await saveBlob(blob, cfg.text || 'Photobooth ♥'); } catch (e) { toast('Envoi impossible.'); } sel = s; refresh(); $('boothSave').disabled = false; };
  $('bGif').onclick = makeGif;
  $('gifSave').onclick = async () => { if (!gifBlob) return; $('gifSave').disabled = true; try { await saveBlob(gifBlob, (cfg.text || 'Photobooth') + ' (GIF)'); } catch (e) { toast('Envoi impossible.'); } $('gifSave').disabled = false; };

  listen('booth', p => { if (typeof p.at !== 'number' || Math.abs(p.at - Date.now()) > 20000) return; run({ at: p.at, n: Math.min(6, Math.max(1, +p.n || 4)), count: [3, 5, 10].includes(+p.count) ? +p.count : 3, filter: FILTERS[p.filter] ? p.filter : 'none', layout: ['strip', 'grid', 'polaroid', 'postcard'].includes(p.layout) ? p.layout : 'strip', frame: FRAMES[p.frame] ? p.frame : 'avion', text: String(p.text || '').slice(0, 40) }); });
  listen('booth-re', p => { if (typeof p.at === 'number' && Math.abs(p.at - Date.now()) < 20000) retake(+p.k, p.at, [3, 5, 10].includes(+p.secs) ? +p.secs : 3); });
}
