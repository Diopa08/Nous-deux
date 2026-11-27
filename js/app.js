import { sb, st, $, esc, fmt, uid, toast, floatEmo, nameOf, partnerName, q, oops, signedUrls, cachedUrl, uploadPhoto,
  listen, dispatch, send, onGame, setGameLocal, saveGame, onTable, loadTable, TABLES } from './core.js?v=13';
import { initGames } from './games.js?v=13';
import { initCall } from './call.js?v=13';
import { initCinema } from './cinema.js?v=13';

/* =========================================================
   Connexion
   ========================================================= */
let signup = false;
function setMode(up) {
  signup = up;
  $('tabIn').setAttribute('aria-selected', String(!up)); $('tabUp').setAttribute('aria-selected', String(up));
  $('aBtn').textContent = up ? 'Créer mon compte' : 'Se connecter';
  $('aPass2Wrap').hidden = !up; $('aPass').autocomplete = up ? 'new-password' : 'current-password';
  $('aMsg').textContent = ''; $('aMsg').className = 'formmsg'; checkMatch();
}
function checkMatch() {
  const m = $('aMatch'), a = $('aPass').value, b = $('aPass2').value;
  if (!signup || !b) { m.textContent = signup && a && a.length < 6 ? '6 caractères minimum' : ''; m.className = 'match ko'; return; }
  const ok = a === b; m.textContent = ok ? '✓ Les mots de passe sont identiques' : '✗ Les mots de passe ne sont pas identiques'; m.className = 'match ' + (ok ? 'ok' : 'ko');
}
$('tabIn').onclick = () => setMode(false); $('tabUp').onclick = () => setMode(true);
['aPass', 'aPass2'].forEach(id => $(id).addEventListener('input', checkMatch));
document.addEventListener('click', e => { const b = e.target.closest('[data-eye]'); if (!b) return; const i = $(b.dataset.eye), show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'); });
try { setMode(!localStorage.getItem('nd-known')); } catch (e) { setMode(false); }
const msg = (t, info) => { $('aMsg').textContent = t; $('aMsg').className = 'formmsg' + (info ? ' info' : ''); };
$('authForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('aEmail').value.trim(), password = $('aPass').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Entre une adresse email valide.');
  if (password.length < 6) return msg('Le mot de passe doit faire au moins 6 caractères.');
  if (signup && password !== $('aPass2').value) return msg('Les deux mots de passe ne sont pas identiques.');
  $('aBtn').disabled = true; msg('Un instant…', true);
  try {
    if (signup) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      try { localStorage.setItem('nd-known', '1'); } catch (e) { }
      if (!data.session) { setMode(false); $('aPass').value = ''; msg('Compte créé ! Ouvre l\'email reçu pour le confirmer, puis connecte-toi ici.', true); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      try { localStorage.setItem('nd-known', '1'); } catch (e) { }
    }
  } catch (err) {
    const m = String(err.message || '');
    msg(/confirm/i.test(m) ? 'Email pas encore confirmé : clique sur le lien reçu par mail.' : /invalid/i.test(m) ? 'Email ou mot de passe incorrect.' : /already|registered/i.test(m) ? 'Ce compte existe déjà : connecte-toi.' : /rate|limit/i.test(m) ? 'Trop d\'essais, réessaie dans quelques minutes.' : m);
  } finally { $('aBtn').disabled = false; }
};
const logout = async () => { await sb.auth.signOut(); location.hash = ''; location.reload(); };
$('logout').onclick = logout; $('oLogout').onclick = logout;

function show(which) { ['auth', 'onboard', 'app'].forEach(id => $(id).hidden = id !== which); }

/* =========================================================
   Espace du couple
   ========================================================= */
$('oCreate').onclick = async () => {
  const name = $('oName').value.trim(); if (!name) return $('oMsg').textContent = 'Écris ton prénom.';
  const { error } = await sb.rpc('create_couple', { p_name: name });
  if (error) return $('oMsg').textContent = error.message;
  boot();
};
$('oJoin').onclick = async () => {
  const name = $('oName').value.trim(), code = $('oCode').value.trim();
  if (!name || !code) return $('oMsg').textContent = 'Prénom et code nécessaires.';
  const { error } = await sb.rpc('join_couple', { p_code: code, p_name: name });
  if (error) return $('oMsg').textContent = /inconnu/.test(error.message) ? 'Code inconnu.' : /complet/.test(error.message) ? 'Cet espace a déjà deux personnes.' : error.message;
  boot();
};

let booted = false;
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return show('auth');
  st.me = session.user.id;
  const { data: mem } = await sb.from('members').select('couple_id').eq('user_id', st.me).maybeSingle();
  if (!mem) return show('onboard');
  const { data: c } = await sb.from('couples').select('id,code').eq('id', mem.couple_id).single();
  st.couple = c;
  show('app');
  if (booted) return; booted = true;
  await loadMembers();
  await Promise.all([loadSettings(), loadGames(), ...TABLES.map(loadTable)]);
  subscribe();
  route();
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' && !booted) boot(); if (ev === 'SIGNED_OUT') show('auth'); });

async function loadMembers() {
  const { data } = await sb.from('members').select('user_id,display_name').eq('couple_id', st.couple.id);
  st.members = data || [];
  $('coupleCode').textContent = st.couple.code;
  $('coupleMembers').textContent = st.members.length < 2 ? '— donne ce code à ton chéri pour qu\'il te rejoigne' : '— ' + st.members.map(m => m.display_name || '?').join(' & ');
  const me = st.members.find(m => m.user_id === st.me); $('tName').value = me?.display_name || '';
  dispatch('members');
}
async function loadSettings() {
  const { data } = await sb.from('settings').select('data').eq('couple_id', st.couple.id).maybeSingle();
  st.settings = data?.data || {}; applyTheme(); fillSettings();
}
async function loadGames() {
  const { data } = await sb.from('game_state').select('key,data').eq('couple_id', st.couple.id);
  (data || []).forEach(r => setGameLocal(r.key, r.data));
}

/* Temps réel : changements de tables + canal privé (présence, signaux, dessin) */
function subscribe() {
  const cid = st.couple.id, f = `couple_id=eq.${cid}`;
  const dbc = sb.channel('db-' + cid);
  const timers = {};
  const later = (k, fn) => { clearTimeout(timers[k]); timers[k] = setTimeout(fn, 150); };
  TABLES.forEach(t => dbc.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: f }, () => later(t, () => loadTable(t))));
  dbc.on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: f }, p => { const r = p.new; if (r && r.key) setGameLocal(r.key, r.data); });
  dbc.on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: f }, p => { if (p.new?.data) { st.settings = p.new.data; applyTheme(); fillSettings(); } });
  dbc.on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: f }, () => later('members', loadMembers));
  dbc.subscribe();

  subscribeLive();
}

let liveRetries = 0;
function subscribeLive() {
  const cid = st.couple.id;
  // Canal public au nom impossible à deviner (identifiant secret du couple, visible seulement par vous deux)
  const ch = sb.channel('nd-' + cid, { config: { broadcast: { self: false }, presence: { key: st.me, enabled: true } } });
  st.chan = ch;
  ['sig', 'call-ring', 'call-join', 'call-end', 'screen', 'draw', 'react', 'ping', 'booth', 'pz-pick', 'chat-new', 'mic'].forEach(ev => ch.on('broadcast', { event: ev }, ({ payload }) => dispatch(ev, payload)));
  ch.on('presence', { event: 'sync' }, () => {
    const ids = Object.keys(ch.presenceState());
    const here = ids.some(id => id !== st.me);
    const o = $('online'); o.textContent = here ? '● ' + partnerName() + ' est là' : 'Seul·e ici'; o.classList.toggle('on', here);
    dispatch('presence', here);
  });
  const join = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await sb.realtime.setAuth(session.access_token);
    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') { liveRetries = 0; st.live = true; dispatch('live', true); await ch.track({ at: Date.now() }); }
      else if ((s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') && liveRetries < 6) { st.live = false; dispatch('live', false); liveRetries++; await sb.removeChannel(ch).catch(() => { }); setTimeout(subscribeLive, 1500 * liveRetries); }
    });
  };
  join();
}
sb.auth.onAuthStateChange((ev, sess) => { if (ev === 'TOKEN_REFRESHED' && sess) sb.realtime.setAuth(sess.access_token); });

/* =========================================================
   Navigation
   ========================================================= */
const views = ['nous', 'appel', 'livre', 'mots', 'souvenirs', 'jeux', 'cine', 'dates', 'style'];
function route() {
  const v = views.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'nous';
  document.querySelectorAll('section[data-v]').forEach(s => s.classList.toggle('on', s.dataset.v === v));
  document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + v));
  dispatch('view', v);
  if (v === 'nous') drawArc();
}
addEventListener('hashchange', route);

/* =========================================================
   Thème et réglages
   ========================================================= */
const PAL = {
  avion: { n: 'Par avion', bg: ['#fbf8f3', '#0e1430'], card: ['#ffffff', '#161e42'], ink: ['#13204d', '#f3eee4'], mute: ['#5d6688', '#a9b0cf'], a: ['#d32f45', '#ff6b7f'], b: ['#1d3fa5', '#8fa8ff'], line: ['#e6e0d4', '#27305a'] },
  rose: { n: 'Rose poudré', bg: ['#fff4f5', '#24111a'], card: ['#ffffff', '#321823'], ink: ['#4a1f2e', '#fbe9ee'], mute: ['#8a5a6a', '#c99aab'], a: ['#e0527a', '#ff8fab'], b: ['#8e3b5f', '#f2b6c8'], line: ['#f3d9df', '#4a2534'] },
  nuit: { n: 'Nuit étoilée', bg: ['#14163a', '#0b0c24'], card: ['#1d2050', '#15173a'], ink: ['#f4efe1', '#f4efe1'], mute: ['#b3b2d6', '#9d9cc4'], a: ['#f2c46d', '#f2c46d'], b: ['#b9a8ff', '#b9a8ff'], line: ['#2d3170', '#252859'] },
  soleil: { n: 'Coucher de soleil', bg: ['#fff3ea', '#2a130d'], card: ['#ffffff', '#3a1c13'], ink: ['#3d1a10', '#fde9de'], mute: ['#8b5a47', '#d2a08c'], a: ['#f0623a', '#ff8a5c'], b: ['#b8326a', '#ff9ec4'], line: ['#f6dccd', '#55281b'] },
  lagon: { n: 'Lagon', bg: ['#effaf8', '#071f1e'], card: ['#ffffff', '#0d2e2c'], ink: ['#0c3533', '#e3f7f4'], mute: ['#4f7a76', '#8dbfb9'], a: ['#ff7a59', '#ff9a7e'], b: ['#0d8f80', '#4fd1c0'], line: ['#d3ece8', '#16423f'] },
};
const FONTS = { caveat: ['Caveat, cursive', 1, 'Manuscrite'], dancing: ['"Dancing Script", cursive', .95, 'Romantique'], playfair: ['"Playfair Display", serif', .82, 'Élégante'], fredoka: ['Fredoka, sans-serif', .8, 'Ronde'] };
export const pal = () => PAL[st.settings.pal] || PAL.avion;
function applyTheme() {
  const S = st.settings, p = pal(), r = document.documentElement.style;
  for (const k of ['bg', 'card', 'ink', 'mute', 'a', 'b', 'line']) r.setProperty('--' + k, `light-dark(${p[k][0]},${p[k][1]})`);
  const f = FONTS[S.font] || FONTS.caveat; r.setProperty('--disp', f[0]); r.setProperty('--dsz', f[1]);
  $('appTitle').textContent = S.title || 'Nous deux'; document.title = S.title || 'Nous deux';
  $('bookTitle').textContent = S.bookTitle || 'Le livre de notre histoire';
  $('cover').hidden = !S.cover;
  if (S.cover) signedUrls([S.cover]).then(u => { $('coverImg').src = u[S.cover]; renderBook(); });
  $('coverText').textContent = S.coverText || '';
  $('pals').innerHTML = Object.entries(PAL).map(([k, v]) => `<button class="pal${(S.pal || 'avion') === k ? ' sel' : ''}" data-pal="${k}"><span class="dots">${['bg', 'a', 'b', 'ink'].map(x => `<i style="background:${v[x][0]}"></i>`).join('')}</span>${esc(v.n)}</button>`).join('');
  $('fonts').innerHTML = Object.entries(FONTS).map(([k, v]) => `<button data-font="${k}" class="${(S.font || 'caveat') === k ? 'sel' : ''}" style="font-family:${v[0].replace(/"/g, "'")}">${esc(v[2])}</button>`).join('');
  drawArc(); tick();
}
function fillSettings() {
  const S = st.settings;
  $('sReunion').value = S.reunion || ''; $('sSince').value = S.since || ''; $('sA').value = S.cityA || ''; $('sB').value = S.cityB || '';
  $('tTitle').value = S.title || ''; $('tBook').value = S.bookTitle || ''; $('tCover').value = S.coverText || '';
  $('turnUrl').value = S.turn?.urls || ''; $('turnUser').value = S.turn?.username || ''; $('turnPass').value = S.turn?.credential || '';
}
async function saveSettings(patch) {
  st.settings = { ...st.settings, ...patch }; applyTheme();
  const { error } = await sb.from('settings').upsert({ couple_id: st.couple.id, data: st.settings, updated_at: new Date().toISOString() });
  if (error) { oops(error); return false; } return true;
}
$('pals').onclick = e => { const b = e.target.closest('[data-pal]'); if (b) saveSettings({ pal: b.dataset.pal }); };
$('fonts').onclick = e => { const b = e.target.closest('[data-font]'); if (b) saveSettings({ font: b.dataset.font }); };
$('saveSettings').onclick = async () => {
  const patch = { reunion: $('sReunion').value, since: $('sSince').value, cityA: $('sA').value.trim(), cityB: $('sB').value.trim(), title: $('tTitle').value.trim(), bookTitle: $('tBook').value.trim(), coverText: $('tCover').value.trim() };
  const f = $('tPhoto').files[0];
  if (f) { $('sMsg').textContent = 'Envoi de la photo…'; try { patch.cover = await uploadPhoto(f, 'cover'); $('tPhoto').value = ''; } catch (e) { $('sMsg').textContent = 'Photo non envoyée.'; } }
  const name = $('tName').value.trim().slice(0, 40);
  if (name) await sb.from('members').update({ display_name: name }).eq('user_id', st.me);
  if (await saveSettings(patch)) { $('sMsg').textContent = ''; toast('Enregistré ♥'); loadMembers(); }
};
$('rmCover').onclick = () => saveSettings({ cover: '' });
$('saveTurn').onclick = () => saveSettings({ turn: { urls: $('turnUrl').value.trim(), username: $('turnUser').value.trim(), credential: $('turnPass').value } }).then(ok => ok && toast('Relais enregistré'));

/* =========================================================
   Accueil : compte à rebours, signe
   ========================================================= */
function drawArc() {
  const s = $('arc'), W = s.clientWidth, H = s.clientHeight; if (!W) return;
  const S = st.settings, r = Date.parse(S.reunion || ''), sn = Date.parse(S.since || ''); let p = 0.5;
  if (r && sn && r > sn) p = Math.min(1, Math.max(0, (Date.now() - sn) / (r - sn)));
  const x1 = W * .12, x2 = W * .88, y = H * .76, cx = W / 2, cy = H * .02;
  const bx = (1 - p) ** 2 * x1 + 2 * (1 - p) * p * cx + p * p * x2, by = (1 - p) ** 2 * y + 2 * (1 - p) * p * cy + p * p * y;
  const ang = Math.atan2(2 * (1 - p) * (cy - y) + 2 * p * (y - cy), 2 * (1 - p) * (cx - x1) + 2 * p * (x2 - cx)) * 180 / Math.PI, fs = W < 520 ? 20 : 24;
  s.innerHTML = `<path d="M${x1} ${y} Q${cx} ${cy} ${x2} ${y}" fill="none" stroke="var(--line)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>
  <path d="M${x1} ${y} Q${cx} ${cy} ${x2} ${y}" fill="none" stroke="var(--a)" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="${p} 1"/>
  <circle cx="${x1}" cy="${y}" r="9" fill="var(--b)"/><circle cx="${x2}" cy="${y}" r="9" fill="var(--a)"/>
  <text x="${x1}" y="${y + 32}" text-anchor="middle" fill="var(--ink)" style="font-family:var(--disp)" font-size="${fs}" font-weight="700">${esc(S.cityA || 'Moi')}</text>
  <text x="${x2}" y="${y + 32}" text-anchor="middle" fill="var(--ink)" style="font-family:var(--disp)" font-size="${fs}" font-weight="700">${esc(S.cityB || 'Toi')}</text>
  <g transform="translate(${bx} ${by}) rotate(${ang})"><path d="M-14 0 L14 0 M2 0 L-6 -11 M2 0 L-6 11 M-12 0 L-16 -6 M-12 0 L-16 6" stroke="var(--b)" stroke-width="3.5" stroke-linecap="round" fill="none"/></g>`;
}
new ResizeObserver(drawArc).observe($('arc'));
function tick() {
  const r = Date.parse(st.settings.reunion || ''), c = $('count');
  if (!r) { c.innerHTML = ''; $('countNote').textContent = 'Choisis la date des retrouvailles dans « Réglages ».'; }
  else {
    let d = Math.max(0, r - Date.now());
    c.innerHTML = [[86400000, 'jours'], [3600000, 'heures'], [60000, 'min'], [1000, 's']].map(([m, l]) => { const v = Math.floor(d / m); d -= v * m; return `<div><b>${v}</b><span>${l}</span></div>`; }).join('');
    $('countNote').textContent = r <= Date.now() ? 'C\'est le jour J ♥' : 'avant de se retrouver, le ' + new Date(r).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  renderCine();
}
setInterval(tick, 500); setInterval(drawArc, 60000);

$('pingBtn').onclick = async () => { await saveGame('ping', { by: st.me, at: Date.now() }); send('ping', {}); toast('♥ envoyé'); };
listen('ping', () => { floatEmo('❤️'); toast(partnerName() + ' pense à toi ♥'); });
onGame('ping', p => { $('pingInfo').textContent = p.by === st.me ? 'Tu as envoyé un ♥ ' + fmt(p.at) : nameOf(p.by) + ' pense à toi ♥ ' + fmt(p.at); });

/* =========================================================
   Mots doux
   ========================================================= */
onTable('notes', rows => {
  $('notes').innerHTML = rows.length ? rows.map(n => `<li><div><p class="hand" style="margin:0">${esc(n.body)}</p><span class="mute">${esc(nameOf(n.author))} · ${esc(fmt(n.created_at))}</span></div>${n.author === st.me ? `<button class="x" data-del="notes:${esc(n.id)}" aria-label="Supprimer">✕</button>` : ''}</li>`).join('') : '<li class="mute">Aucun mot doux pour l\'instant. Écris le premier.</li>';
  const last = rows[0]; $('lastNote').textContent = last ? last.body : 'Pas encore de mot doux.'; $('lastNoteBy').textContent = last ? '— ' + nameOf(last.author) + ', ' + fmt(last.created_at) : '';
});
$('noteBtn').onclick = async () => { const t = $('noteText').value.trim(); if (!t) return; await q(sb.from('notes').insert({ couple_id: st.couple.id, body: t })); $('noteText').value = ''; toast('Mot doux envoyé'); loadTable('notes'); };

/* =========================================================
   Souvenirs
   ========================================================= */
onTable('memories', async rows => {
  const urls = await signedUrls(rows.map(m => m.path));
  $('photos').innerHTML = rows.length ? rows.map((m, i) => `<figure class="${m.kind === 'strip' ? 'strip-k' : ''}" style="--r:${(i % 3 - 1) * 1.5}deg"><img src="${esc(urls[m.path])}" alt="${esc(m.caption || 'Souvenir')}" loading="lazy"><figcaption>${esc(m.caption || '')}</figcaption><span class="mute">${esc(fmt(m.created_at))}</span>${m.author === st.me ? ` <button class="x" data-del="memories:${esc(m.id)}" aria-label="Supprimer">✕</button>` : ''}</figure>`).join('') : '<p class="mute">Ajoutez vos premières photos ensemble.</p>';
  dispatch('memories', rows);
});
$('photoBtn').onclick = async () => {
  const files = [...$('photo').files]; if (!files.length) return;
  const cap = $('caption').value.trim().slice(0, 200); let n = 0;
  for (const f of files) {
    $('photoMsg').textContent = `Envoi ${++n}/${files.length}…`;
    try { const path = await uploadPhoto(f); await q(sb.from('memories').insert({ couple_id: st.couple.id, path, caption: cap })); }
    catch (e) { $('photoMsg').textContent = 'Échec de l\'envoi d\'une photo (15 Mo max).'; }
  }
  $('photo').value = ''; $('caption').value = ''; $('photoMsg').textContent = 'Ajouté ♥'; loadTable('memories');
};

/* Suppression générique */
document.addEventListener('click', async e => {
  const d = e.target.closest('[data-del]'); if (!d) return;
  const [t, id] = d.dataset.del.split(':');
  if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sûr ?'; setTimeout(() => { d.dataset.sure = ''; d.textContent = '✕'; }, 3000); return; }
  const row = (st.rows[t] || []).find(r => r.id === id);
  await q(sb.from(t).delete().eq('id', id));
  if (row?.path) sb.storage.from('photos').remove([row.path]);
  loadTable(t);
});

/* =========================================================
   Livre
   ========================================================= */
let editId = null;
const chapters = () => st.rows.chapters || [];
async function renderBook() {
  const ch = chapters(), S = st.settings;
  await signedUrls([...ch.map(c => c.photo_path), S.cover || '']);
  $('toc').innerHTML = ch.length ? ch.map((c, i) => `<li data-open="${i}"><div><b>${i + 1}. ${esc(c.title || 'Sans titre')}</b><br><span class="mute">${esc(c.when_text || '')}${c.when_text ? ' · ' : ''}${esc(nameOf(c.author))}${c.edited_by && c.edited_by !== c.author ? ' & ' + esc(nameOf(c.edited_by)) : ''}</span></div><button class="ghost" data-edit="${esc(c.id)}">Modifier</button></li>`).join('') : '<li class="mute">Votre livre est encore vierge. Écrivez le premier chapitre : comment tout a commencé.</li>';
  const cov = cachedUrl(S.cover);
  $('book').innerHTML = `<article class="page" style="display:flex;flex-direction:column;justify-content:center;text-align:center"><p class="num">${ch.length} chapitre${ch.length > 1 ? 's' : ''}</p><h3 style="font-size:calc(52px*var(--dsz))">${esc(S.bookTitle || 'Le livre de notre histoire')}</h3>${cov ? `<img src="${esc(cov)}" alt="">` : ''}<p class="mute">Faites défiler pour lire →</p></article>` +
    ch.map((c, i) => {
      const paras = String(c.body || '').split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
      const img = cachedUrl(c.photo_path);
      return `<article class="page"><p class="num">Chapitre ${i + 1}</p><h3>${esc(c.title || 'Sans titre')}</h3>${c.when_text ? `<span class="when">${esc(c.when_text)}</span>` : ''}${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}<div class="body">${paras || '<p class="mute">Page encore blanche…</p>'}</div></article>`;
    }).join('');
  bookPos();
}
onTable('chapters', renderBook);
const pages = () => [...$('book').children];
const curPage = () => Math.round($('book').scrollLeft / ($('book').clientWidth + 16));
function bookPos() { $('bkPos').textContent = (curPage() + 1) + ' / ' + pages().length; }
function goPage(i) { const p = pages(); i = Math.max(0, Math.min(p.length - 1, i)); p[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); setTimeout(bookPos, 400); }
$('book').addEventListener('scroll', () => { clearTimeout(bookPos.t); bookPos.t = setTimeout(bookPos, 80); });
$('bkPrev').onclick = () => goPage(curPage() - 1); $('bkNext').onclick = () => goPage(curPage() + 1);
addEventListener('keydown', e => { if (!$('bkReadView').hidden && location.hash === '#livre' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { if (e.key === 'ArrowRight') goPage(curPage() + 1); if (e.key === 'ArrowLeft') goPage(curPage() - 1); } });
function bookMode(m) { $('bkTocView').hidden = m !== 'toc'; $('bkReadView').hidden = m !== 'read'; $('bkEdit').hidden = m !== 'edit'; $('bkRead').classList.toggle('sel', m === 'read'); $('bkToc').classList.toggle('sel', m === 'toc'); if (m === 'read') setTimeout(bookPos, 50); }
bookMode('toc');
$('bkRead').onclick = () => bookMode('read'); $('bkToc').onclick = () => bookMode('toc');
function openEditor(c) {
  editId = c ? c.id : null; const ch = chapters();
  $('bkEditTitle').textContent = c ? 'Modifier le chapitre' : 'Nouveau chapitre';
  $('cTitle').value = c?.title || ''; $('cWhen').value = c?.when_text || ''; $('cBody').value = c?.body || '';
  $('cOrder').value = c ? ch.indexOf(c) + 1 : ch.length + 1; $('cPhoto').value = ''; $('cDel').hidden = !c; $('cMsg').textContent = '';
  try { if (!c) { const d = JSON.parse(localStorage.getItem('nd-draft') || 'null'); if (d) { $('cTitle').value = d.t || ''; $('cWhen').value = d.w || ''; $('cBody').value = d.b || ''; } } } catch (e) { }
  bookMode('edit'); $('cTitle').focus();
}
$('bkNew').onclick = () => openEditor(null);
['cTitle', 'cWhen', 'cBody'].forEach(id => $(id).addEventListener('input', () => { if (editId) return; try { localStorage.setItem('nd-draft', JSON.stringify({ t: $('cTitle').value, w: $('cWhen').value, b: $('cBody').value })); } catch (e) { } }));
$('toc').onclick = e => {
  const ed = e.target.closest('[data-edit]'); if (ed) return openEditor(chapters().find(c => c.id === ed.dataset.edit));
  const o = e.target.closest('[data-open]'); if (o) { bookMode('read'); setTimeout(() => goPage(+o.dataset.open + 1), 60); }
};
$('cCancel').onclick = () => bookMode('toc');
$('cSave').onclick = async () => {
  const title = $('cTitle').value.trim(), body = $('cBody').value;
  if (!title && !body.trim()) return toast('Écris au moins un titre ou un texte.');
  const ch = chapters(), old = editId ? ch.find(c => c.id === editId) : null;
  const others = ch.filter(c => c !== old);
  const pos = Math.max(1, Math.min(others.length + 1, parseInt($('cOrder').value) || others.length + 1));
  const before = others[pos - 2], after = others[pos - 1];
  const position = before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 1;
  const row = { couple_id: st.couple.id, title: title.slice(0, 200), when_text: $('cWhen').value.trim().slice(0, 80), body: body.slice(0, 50000), position, edited_by: st.me, updated_at: new Date().toISOString() };
  const f = $('cPhoto').files[0];
  if (f) { $('cMsg').textContent = 'Envoi de la photo…'; try { row.photo_path = await uploadPhoto(f, 'chap'); } catch (e) { $('cMsg').textContent = 'Photo non envoyée.'; return; } }
  try {
    if (old) await q(sb.from('chapters').update(row).eq('id', old.id));
    else await q(sb.from('chapters').insert(row));
  } catch (e) { return; }
  if (!old) try { localStorage.removeItem('nd-draft'); } catch (e) { }
  toast('Chapitre enregistré'); bookMode('toc'); loadTable('chapters');
};
$('cDel').onclick = async () => {
  if (!editId) return;
  if ($('cDel').dataset.sure !== '1') { $('cDel').dataset.sure = '1'; $('cDel').textContent = 'Confirmer la suppression'; setTimeout(() => { $('cDel').dataset.sure = ''; $('cDel').textContent = 'Supprimer ce chapitre'; }, 4000); return; }
  await q(sb.from('chapters').delete().eq('id', editId)); toast('Chapitre supprimé'); bookMode('toc'); loadTable('chapters');
};

/* =========================================================
   Dates
   ========================================================= */
const IDEAS = ['Dîner en visio : on cuisine la même recette', 'Soirée film en partage d\'écran', 'Soirée jeux (puzzle, dessin, quiz)', 'Séance photobooth', 'Balade en appel vidéo, chacun dans sa ville', 'Soirée questions profondes', 'Écrire un chapitre de notre livre ensemble', 'Petit-déj ensemble malgré le décalage'];
$('dIdea').innerHTML = '<option value="">— Choisir une idée —</option>' + IDEAS.map(i => `<option>${esc(i)}</option>`).join('');
onTable('dates', rows => {
  $('dates').innerHTML = rows.length ? rows.map(x => `<li><div><b>${esc(x.title)}</b><br><span class="mute">${x.when_at ? esc(fmt(x.when_at)) : 'Date à fixer'} · proposé par ${esc(nameOf(x.author))}</span></div><button class="x" data-del="dates:${esc(x.id)}" aria-label="Supprimer">✕</button></li>`).join('') : '<li class="mute">Aucun date prévu. Choisissez une idée.</li>';
});
$('dBtn').onclick = async () => {
  const t = $('dTitle').value.trim() || $('dIdea').value; if (!t) return;
  const w = $('dWhen').value;
  await q(sb.from('dates').insert({ couple_id: st.couple.id, title: t.slice(0, 200), when_at: w ? new Date(w).toISOString() : null }));
  $('dTitle').value = ''; $('dWhen').value = ''; $('dIdea').value = ''; toast('Date planifié'); loadTable('dates');
};

/* =========================================================
   Ciné (horloge commune + liste)
   ========================================================= */
const EMO = ['❤️', '😂', '😮', '😭', '🔥', '😘', '🍿'];
$('reacts').innerHTML = EMO.map(e => `<button data-emo="${e}" aria-label="Réaction ${e}">${e}</button>`).join('');
$('reacts').onclick = e => { const b = e.target.closest('[data-emo]'); if (!b) return; floatEmo(b.dataset.emo); send('react', { e: b.dataset.emo }); };
listen('react', p => { if (EMO.includes(p.e)) floatEmo(p.e); });
const hms = s => { s = Math.max(0, Math.floor(s)); return [s / 3600, s / 60 % 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':'); };
const parseHms = t => { const p = String(t).trim().split(':').map(Number); if (!p.length || p.some(isNaN)) return null; return p.reduce((a, v) => a * 60 + v, 0); };
const cine = () => st.games.cine || null;
function cinePos() { const c = cine(); if (!c) return 0; return c.state === 'play' ? (+c.pos || 0) + Math.max(0, (Date.now() - c.anchor) / 1000) : (+c.pos || 0); }
function renderCine() {
  const c = cine(), b = $('cineBig'), i = $('cineInfo');
  if (!c) { b.textContent = '—'; $('cineTc').textContent = '00:00:00'; i.textContent = ''; return; }
  $('cineTc').textContent = hms(cinePos()); const film = c.film ? '« ' + c.film + ' »' : '';
  if (c.state !== 'play') { b.textContent = '⏸'; i.textContent = (film ? film + ' · ' : '') + 'en pause (' + nameOf(c.by) + ')'; return; }
  const left = Math.ceil((c.anchor - Date.now()) / 1000);
  if (left > 0) { b.textContent = left; i.textContent = 'Prêts… appuyez sur Play à zéro. ' + film; }
  else if (left > -4) { b.textContent = 'PLAY ▶'; i.textContent = 'Maintenant !'; }
  else { b.textContent = '▶'; i.textContent = (film ? film + ' · ' : '') + 'en cours — votre lecteur doit afficher l\'horloge ci-dessus'; }
}
onGame('cine', c => { if (c?.film && !$('cineFilm').value) $('cineFilm').value = c.film; renderCine(); });
$('cinePlay').onclick = () => saveGame('cine', { state: 'play', pos: cine() ? Math.floor(cinePos()) : 0, anchor: Date.now() + 5000, film: $('cineFilm').value.trim().slice(0, 100) || cine()?.film || '', by: st.me });
$('cinePause').onclick = () => { const c = cine(); if (c) saveGame('cine', { ...c, state: 'pause', pos: Math.floor(cinePos()), anchor: Date.now(), by: st.me }); };
$('cineSeek').onclick = () => { const s = parseHms($('cineAt').value); if (s == null) return toast('Format : 00:42:10'); saveGame('cine', { state: 'pause', pos: s, anchor: Date.now(), film: cine()?.film || $('cineFilm').value.trim().slice(0, 100), by: st.me }); $('cineAt').value = ''; };
onTable('films', rows => {
  $('watch').innerHTML = rows.length ? rows.map(w => `<li><div>${w.seen ? '<s>' : ''}${esc(w.title)}${w.seen ? '</s>' : ''}<br><span class="mute">ajouté par ${esc(nameOf(w.author))}</span></div><button class="ghost" data-pick="${esc(w.title)}">Choisir</button><button class="ghost" data-seen="${esc(w.id)}" data-sv="${w.seen ? 0 : 1}">${w.seen ? 'À revoir' : 'Vu ✓'}</button><button class="x" data-del="films:${esc(w.id)}" aria-label="Supprimer">✕</button></li>`).join('') : '<li class="mute">La liste est vide.</li>';
});
$('wBtn').onclick = async () => { const t = $('wTitle').value.trim(); if (!t) return; await q(sb.from('films').insert({ couple_id: st.couple.id, title: t.slice(0, 200) })); $('wTitle').value = ''; loadTable('films'); };
$('watch').onclick = async e => {
  const s = e.target.closest('[data-seen]'); if (s) { await q(sb.from('films').update({ seen: s.dataset.sv === '1' }).eq('id', s.dataset.seen)); loadTable('films'); return; }
  const p = e.target.closest('[data-pick]'); if (p) { $('cineFilm').value = p.dataset.pick; $('cineFilm').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
};

/* =========================================================
   Démarrage
   ========================================================= */
listen('members', () => { TABLES.forEach(t => st.rows[t] && loadTable(t)); });
initGames();
initCall();
initCinema();
route();
boot();
