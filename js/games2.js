import { sb, st, $, esc, toast, floatEmo, nameOf, partner, partnerName, onGame, saveGame, signedUrls, listen } from './core.js?v=15';

const g = k => st.games[k] || null;
const clone = o => JSON.parse(JSON.stringify(o || {}));
const other = () => partner()?.user_id || null;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* =========================================================
   Menu des jeux
   ========================================================= */
const GAMES = [
  ['puzzle', '🧩', 'Puzzle photo', 'Vos photos à reconstituer'],
  ['dessin', '🎨', 'Dessin à deux', 'Dessinez et devinez'],
  ['p4', '🔴', 'Puissance 4', 'Alignez 4 jetons'],
  ['pendu', '🪢', 'Pendu', 'Trouvez le mot secret'],
  ['navale', '🚢', 'Bataille navale', 'Coulez sa flotte'],
  ['memory', '🃏', 'Memory', 'Les paires de vos photos'],
  ['mime', '🎭', 'Mime', 'Pendant l\'appel vidéo'],
  ['qui', '👫', 'Qui de nous deux ?', 'Votez en secret'],
  ['roue', '🎡', 'Roue des défis', 'Pendant l\'appel vidéo'],
  ['quiz', '❓', 'Tu me connais ?', 'Questions sur toi'],
  ['aov', '🔥', 'Action ou vérité', 'Cartes à tirer'],
  ['morpion', '⭕', 'Morpion', 'Le classique'],
  ['question', '💬', 'Question du jour', 'Répondez tous les deux'],
  ['tuprefs', '⚖️', 'Tu préfères…', 'Choix impossibles'],
];
function openGame(k) {
  const def = GAMES.find(x => x[0] === k);
  $('gameMenu').hidden = !!def; $('gameBar').hidden = !def;
  document.querySelectorAll('.game').forEach(el => el.hidden = el.dataset.g !== k);
  if (def) { $('gameTitle').textContent = def[1] + ' ' + def[2]; scrollTo({ top: 0, behavior: 'smooth' }); }
  try { def ? sessionStorage.setItem('nd-game', k) : sessionStorage.removeItem('nd-game'); } catch (e) { }
}

/* =========================================================
   Puissance 4
   ========================================================= */
function p4Init() {
  const fresh = () => ({ board: Array(42).fill(''), turn: 'r', r: '', y: '', winner: '', line: [], last: -1 });
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function render() {
    const m = g('p4') || fresh(), b = Array.isArray(m.board) && m.board.length === 42 ? m.board : fresh().board;
    $('p4').innerHTML = b.map((v, i) => `<button data-c="${i % 7}" class="${v}${(m.line || []).includes(i) ? ' win' : ''}${i === m.last ? ' drop' : ''}" aria-label="Colonne ${i % 7 + 1}"></button>`).join('');
    const mine = m.r === st.me ? 'r' : m.y === st.me ? 'y' : null, dot = c => `<span class="dot" style="background:${c === 'r' ? '#e63946' : '#ffc93c'}"></span>`;
    const who = c => nameOf(c === 'r' ? m.r : m.y) || '?';
    $('p4Status').innerHTML = m.winner ? (m.winner === 'nul' ? 'Match nul !' : m.winner === mine ? '🎉 Tu as gagné !' : esc(who(m.winner)) + ' a gagné !') :
      (!m.r || !m.y) ? 'Joue un jeton pour rejoindre la partie.' : (m.turn === mine ? 'À toi de jouer ' + dot(mine) : 'Au tour de ' + esc(who(m.turn)) + ' ' + dot(m.turn));
  }
  onGame('p4', render); render(); listen('members', render);
  $('p4').onclick = e => {
    const btn = e.target.closest('[data-c]'); if (!btn) return;
    const m = clone(g('p4') || fresh()); if (!Array.isArray(m.board) || m.board.length !== 42) Object.assign(m, fresh());
    if (m.winner) return toast('Partie terminée : relance une partie.');
    if (!m.r) m.r = st.me; else if (!m.y && m.r !== st.me) m.y = st.me;
    const mine = m.r === st.me ? 'r' : m.y === st.me ? 'y' : null;
    if (!mine) return toast('La partie est complète');
    if (m.turn !== mine) return toast('Pas ton tour');
    const c = +btn.dataset.c; let idx = -1;
    for (let r = 5; r >= 0; r--) if (!m.board[r * 7 + c]) { idx = r * 7 + c; break; }
    if (idx < 0) return toast('Colonne pleine');
    m.board[idx] = mine; m.last = idx;
    const r0 = Math.floor(idx / 7), c0 = idx % 7;
    for (const [dr, dc] of DIRS) {
      const line = [idx];
      for (const s of [1, -1]) { let r = r0 + dr * s, cc = c0 + dc * s; while (r >= 0 && r < 6 && cc >= 0 && cc < 7 && m.board[r * 7 + cc] === mine) { line.push(r * 7 + cc); r += dr * s; cc += dc * s; } }
      if (line.length >= 4) { m.winner = mine; m.line = line; floatEmo('🎉'); break; }
    }
    if (!m.winner && m.board.every(Boolean)) m.winner = 'nul';
    m.turn = mine === 'r' ? 'y' : 'r';
    saveGame('p4', m);
  };
  $('p4Reset').onclick = () => { const m = g('p4'); saveGame('p4', { ...fresh(), r: m?.y || '', y: m?.r || '' }); };
}

/* =========================================================
   Pendu
   ========================================================= */
function penduInit() {
  const WORDS = ['AMOUR', 'DISTANCE', 'RETROUVAILLES', 'AVION', 'BISOU', 'CALIN', 'COTONOU', 'VALISE', 'PASSEPORT', 'TELEPHONE', 'CHOCOLAT', 'PLAGE', 'SOLEIL', 'ETOILE', 'MARIAGE', 'VOYAGE', 'COEUR', 'SOURIRE', 'PROMESSE', 'AVENIR', 'TENDRESSE', 'CINEMA', 'RESTAURANT', 'DANSE', 'MUSIQUE', 'PIZZA', 'CROISSANT', 'ANANAS', 'FOOTBALL', 'ROLLER', 'PHOTOGRAPHIE', 'AEROPORT'];
  const MAX = 7, ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const clean = w => String(w || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z \-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const PARTS = ['<line x1="10" y1="125" x2="80" y2="125"/>', '<line x1="30" y1="125" x2="30" y2="10"/><line x1="30" y1="10" x2="85" y2="10"/><line x1="85" y1="10" x2="85" y2="25"/>', '<circle cx="85" cy="36" r="11"/>', '<line x1="85" y1="47" x2="85" y2="85"/>', '<line x1="85" y1="58" x2="70" y2="72"/>', '<line x1="85" y1="58" x2="100" y2="72"/>', '<line x1="85" y1="85" x2="72" y2="105"/><line x1="85" y1="85" x2="98" y2="105"/>'];
  function state() { const p = g('pendu'); if (!p || !p.word) return null; const word = clean(p.word), guessed = Array.isArray(p.guessed) ? p.guessed : []; const errors = guessed.filter(l => !word.includes(l)).length; const won = [...word].every(ch => !/[A-Z]/.test(ch) || guessed.includes(ch)); return { p, word, guessed, errors, won, lost: errors >= MAX }; }
  function render() {
    const s = state();
    const errors = s ? s.errors : 0;
    $('penduSvg').innerHTML = `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" style="color:var(--ink)">${PARTS.slice(0, errors).join('')}</g>`;
    if (!s) { $('penduWord').textContent = '_ _ _'; $('penduInfo').textContent = 'Écris un mot secret pour l\'autre, ou tire un mot au hasard pour chercher à deux.'; $('penduKeys').innerHTML = ''; return; }
    const setterMe = s.p.setter === st.me, over = s.won || s.lost;
    $('penduWord').textContent = [...s.word].map(ch => !/[A-Z]/.test(ch) ? ch : (over || setterMe || s.guessed.includes(ch)) ? ch : '_').join(' ');
    $('penduWord').style.opacity = setterMe && !over ? .45 : 1;
    $('penduInfo').textContent = s.won ? '🎉 Trouvé !' : s.lost ? '💀 Perdu… le mot était « ' + s.word + ' »' :
      setterMe ? 'C\'est ton mot : ' + partnerName() + ' doit le deviner (' + (MAX - errors) + ' essais restants).' :
        (s.p.setter ? 'Mot choisi par ' + nameOf(s.p.setter) + '. ' : 'Mot au hasard, cherchez ensemble. ') + (MAX - errors) + ' erreur' + (MAX - errors > 1 ? 's' : '') + ' possible' + (MAX - errors > 1 ? 's' : '') + '.';
    $('penduKeys').innerHTML = ALPHA.map(l => { const used = s.guessed.includes(l); return `<button data-l="${l}" class="${used ? (s.word.includes(l) ? 'ok' : 'ko') : ''}" ${used || over || setterMe ? 'disabled' : ''}>${l}</button>`; }).join('');
  }
  onGame('pendu', p => { render(); const s = state(); if (s?.won) floatEmo('🎉'); });
  render();
  $('penduKeys').onclick = e => { const b = e.target.closest('[data-l]'); const s = state(); if (!b || !s || s.won || s.lost) return; const p = clone(s.p); p.guessed = [...new Set([...(p.guessed || []), b.dataset.l])]; saveGame('pendu', p); };
  $('penduSet').onclick = () => { const w = clean($('penduSecret').value); if (w.replace(/[^A-Z]/g, '').length < 2) return toast('Écris un mot d\'au moins 2 lettres.'); saveGame('pendu', { word: w, setter: st.me, guessed: [], at: Date.now() }); $('penduSecret').value = ''; toast('Mot envoyé ! À ' + partnerName() + ' de deviner.'); };
  $('penduRand').onclick = () => saveGame('pendu', { word: WORDS[Math.floor(Math.random() * WORDS.length)], setter: '', guessed: [], at: Date.now() });
}

/* =========================================================
   Bataille navale (bateaux secrets, gardés dans une table privée)
   ========================================================= */
function navaleInit() {
  const N = 8, SHIPS = [4, 3, 3, 2, 2], TOTAL = SHIPS.reduce((a, b) => a + b, 0);
  let fleet = null;
  const nv = () => g('nv');
  const idxOf = id => (nv()?.players || []).indexOf(id);
  const list = k => { const s = g(k), r = nv()?.round; return s && s.round === r && Array.isArray(s.list) ? s.list : []; };
  const resOf = k => { const s = g(k), r = nv()?.round; return s && s.round === r && s.res ? s.res : {}; };
  const ready = k => g('nvk' + k)?.round === nv()?.round;
  function randomFleet(round) {
    for (let tries = 0; tries < 500; tries++) {
      const taken = new Set(), ships = [];
      let ok = true;
      for (const len of SHIPS) {
        let placed = false;
        for (let t = 0; t < 200 && !placed; t++) {
          const h = Math.random() < .5, r = Math.floor(Math.random() * (h ? N : N - len + 1)), c = Math.floor(Math.random() * (h ? N - len + 1 : N));
          const cells = Array.from({ length: len }, (_, k) => h ? r * N + c + k : (r + k) * N + c);
          const near = cells.some(i => { const rr = Math.floor(i / N), cc = i % N; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r2 = rr + dr, c2 = cc + dc; if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N && taken.has(r2 * N + c2)) return true; } return false; });
          if (!near) { cells.forEach(i => taken.add(i)); ships.push(cells); placed = true; }
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return { round, ships };
    }
    return { round, ships: [] };
  }
  async function loadFleet() {
    const { data } = await sb.from('private_state').select('data').eq('user_id', st.me).eq('key', 'nv-fleet').maybeSingle();
    fleet = data?.data || null;
  }
  async function saveFleet() {
    const { error } = await sb.from('private_state').upsert({ user_id: st.me, couple_id: st.couple.id, key: 'nv-fleet', data: fleet, updated_at: new Date().toISOString() });
    if (error) { toast('Impossible d\'enregistrer ta flotte.'); return false; } return true;
  }
  // Le défenseur répond aux tirs reçus (touché / à l'eau)
  function resolve() {
    const s = nv(), me = idxOf(st.me); if (!s || me < 0 || !fleet || fleet.round !== s.round || !ready(me)) return;
    const shots = list('nvs' + (1 - me)), res = { ...resOf('nvr' + me) };
    let changed = false;
    const shipCells = new Set(fleet.ships.flat());
    for (const i of shots) if (!(i in res)) { res[i] = shipCells.has(i) ? 'x' : 'o'; changed = true; }
    if (!changed) return;
    const sunk = fleet.ships.filter(sh => sh.every(i => res[i] === 'x')).length;
    const last = shots[shots.length - 1];
    if (res[last] === 'x') { const ship = fleet.ships.find(sh => sh.includes(last)); if (ship && ship.every(i => res[i] === 'x')) toast('💥 ' + partnerName() + ' a coulé un de tes bateaux'); }
    saveGame('nvr' + me, { round: s.round, res, sunk });
  }
  function render() {
    const s = nv(), me = s ? idxOf(st.me) : -1, op = 1 - me;
    if (s && me >= 0 && (!fleet || fleet.round !== s.round)) fleet = randomFleet(s.round);
    const myShots = me >= 0 ? list('nvs' + me) : [], theirShots = me >= 0 ? list('nvs' + op) : [];
    const myRes = me >= 0 ? resOf('nvr' + op) : {}, theirRes = me >= 0 ? resOf('nvr' + me) : {};
    const myHits = Object.values(myRes).filter(v => v === 'x').length, theirHits = Object.values(theirRes).filter(v => v === 'x').length;
    const bothReady = me >= 0 && ready(0) && ready(1);
    const winner = myHits >= TOTAL ? 'me' : theirHits >= TOTAL ? 'them' : '';
    const turnIdx = list('nvs0').length === list('nvs1').length ? 0 : 1;
    const myTurn = bothReady && !winner && turnIdx === me;
    const shipSet = new Set(fleet?.ships.flat() || []);
    $('nvMine').innerHTML = Array.from({ length: N * N }, (_, i) => { const hit = theirShots.includes(i); const cls = hit ? (shipSet.has(i) ? 'x' : 'o') : shipSet.has(i) ? 'ship' : ''; return `<i class="${cls}">${hit ? (shipSet.has(i) ? '✕' : '•') : ''}</i>`; }).join('');
    $('nvTheirs').innerHTML = Array.from({ length: N * N }, (_, i) => { const shot = myShots.includes(i), r = myRes[i]; const cls = shot ? (r || 'p') : ''; return `<button data-i="${i}" class="${cls}" ${shot || !myTurn ? 'disabled' : ''} aria-label="Case ${String.fromCharCode(65 + Math.floor(i / N))}${i % N + 1}">${shot ? (r === 'x' ? '✕' : r === 'o' ? '•' : '…') : ''}</button>`; }).join('');
    const imReady = me >= 0 && ready(me);
    $('nvShuffle').hidden = !(me >= 0 && !imReady); $('nvReady').hidden = !(me >= 0 && !imReady);
    $('nvStatus').textContent = !s ? 'Lance une nouvelle partie.' : me < 0 ? 'Partie entre deux autres joueurs.' :
      winner === 'me' ? '🎉 Tu as coulé toute sa flotte !' : winner === 'them' ? '💥 ' + partnerName() + ' a coulé ta flotte…' :
        !imReady ? 'Place tes bateaux (🔀 pour les déplacer), puis clique sur Prêt.' : !bothReady ? 'En attente que ' + partnerName() + ' place ses bateaux…' :
          myTurn ? `À toi de tirer ! (${myHits}/${TOTAL} touchés, ${resOf('nvr' + op).sunk || 0} coulé${(resOf('nvr' + op).sunk || 0) > 1 ? 's' : ''})` : 'Au tour de ' + partnerName() + '…' + (myShots.some(i => !(i in myRes)) ? ' (' + partnerName() + ' doit avoir l\'app ouverte pour répondre)' : '');
    if (winner && !render.done) { render.done = true; floatEmo(winner === 'me' ? '🎉' : '💥'); } if (!winner) render.done = false;
  }
  ['nv', 'nvs0', 'nvs1', 'nvr0', 'nvr1', 'nvk0', 'nvk1'].forEach(k => onGame(k, () => { resolve(); render(); }));
  $('nvNew').onclick = () => { const o = other(); if (!o) return toast('Il faut être deux pour jouer.'); const round = Date.now(); fleet = randomFleet(round); saveGame('nv', { round, players: [st.me, o] }); };
  $('nvShuffle').onclick = () => { const s = nv(); if (!s) return; fleet = randomFleet(s.round); render(); };
  $('nvReady').onclick = async () => { const s = nv(), me = idxOf(st.me); if (!s || me < 0) return; if (!fleet || fleet.round !== s.round) fleet = randomFleet(s.round); if (await saveFleet()) saveGame('nvk' + me, { round: s.round }); };
  $('nvTheirs').onclick = e => {
    const b = e.target.closest('[data-i]'); const s = nv(), me = idxOf(st.me); if (!b || !s || me < 0) return;
    const l = list('nvs' + me); const i = +b.dataset.i; if (l.includes(i)) return;
    saveGame('nvs' + me, { round: s.round, list: [...l, i] });
  };
  return async () => { await loadFleet(); resolve(); render(); };
}

/* =========================================================
   Memory (paires de vos photos)
   ========================================================= */
function memoryInit() {
  const EMO = ['❤️', '🌹', '✈️', '🍕', '🎬', '🌙', '🎁', '💍', '🍫', '🌴', '🎵', '⭐'];
  let busy = false;
  async function render() {
    const m = g('mem');
    if (!m || !Array.isArray(m.cards)) { $('memory').innerHTML = ''; $('memStatus').textContent = 'Lance une partie : les cartes sont faites avec vos photos.'; return; }
    const urls = await signedUrls(m.cards.filter(c => c.t === 'p').map(c => c.v));
    const done = m.done || {}, open = m.open || [];
    $('memory').innerHTML = m.cards.map((c, i) => { const up = open.includes(i) || done[i]; return `<button data-i="${i}" class="${done[i] ? 'done' : up ? 'up' : ''}" aria-label="Carte ${i + 1}">${up ? (c.t === 'p' ? `<img src="${esc(urls[c.v])}" alt="">` : esc(c.v)) : ''}</button>`; }).join('');
    const sc = m.scores || {}, total = Object.keys(done).length === m.cards.length;
    const scoreTxt = Object.keys(sc).map(id => nameOf(id) + ' ' + sc[id]).join(' · ');
    $('memStatus').textContent = total ? '🎉 Partie finie ! ' + scoreTxt : (m.turn === st.me ? 'À toi de retourner deux cartes.' : 'Au tour de ' + nameOf(m.turn) + '.') + (scoreTxt ? ' — ' + scoreTxt : '');
  }
  onGame('mem', render);
  $('memNew').onclick = () => {
    const photos = shuffle([...(st.rows.memories || []).filter(x => x.kind !== 'strip').map(x => x.path)]).slice(0, 8);
    const faces = [...photos.map(v => ({ t: 'p', v })), ...shuffle([...EMO]).slice(0, 8 - photos.length).map(v => ({ t: 'e', v }))];
    saveGame('mem', { round: Date.now(), cards: shuffle([...faces, ...faces.map(f => ({ ...f }))]), open: [], done: {}, turn: st.me, scores: {} });
  };
  $('memory').onclick = e => {
    const b = e.target.closest('[data-i]'); const m = g('mem'); if (!b || !m || busy) return;
    const i = +b.dataset.i, n = clone(m); n.open ||= []; n.done ||= {}; n.scores ||= {};
    if (other() && n.turn !== st.me) return toast('Pas ton tour');
    if (n.done[i] || n.open.includes(i) || n.open.length >= 2) return;
    n.open.push(i);
    if (n.open.length === 2) {
      const [a, c] = n.open;
      if (n.cards[a].v === n.cards[c].v) { n.done[a] = n.done[c] = st.me; n.scores[st.me] = (n.scores[st.me] || 0) + 1; n.open = []; floatEmo('💞'); saveGame('mem', n); }
      else { busy = true; saveGame('mem', n); setTimeout(() => { const cur = clone(g('mem')); if (cur.round === n.round) { cur.open = []; cur.turn = other() || st.me; saveGame('mem', cur); } busy = false; }, 1300); }
    } else saveGame('mem', n);
  };
  render();
}

/* =========================================================
   Mime (pendant l'appel)
   ========================================================= */
function mimeInit() {
  const WORDS = ['Cuisiner des pâtes', 'Faire du roller', 'Prendre l\'avion', 'Un chat qui a peur', 'Danser la salsa', 'Se brosser les dents', 'Marquer un but', 'Faire un selfie', 'Conduire une moto', 'Un singe', 'Pêcher un poisson', 'Jouer de la guitare', 'Se maquiller', 'Un super-héros', 'Nager', 'Faire du yoga', 'Un zombie', 'Ouvrir un cadeau', 'Faire la vaisselle', 'Un serveur au restaurant', 'Se réveiller en retard', 'Faire du vélo', 'Un éléphant', 'Peindre un tableau', 'Faire une demande en mariage', 'Prendre une douche', 'Regarder un film d\'horreur', 'Jouer au tennis'];
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  function render() {
    const m = g('mime');
    if (!m || !m.word) { $('mimeWord').textContent = '—'; $('mimeTime').textContent = ''; $('mimeInfo').textContent = 'Lancez l\'appel vidéo, puis l\'un de vous clique sur « Je mime ».'; $('mimeFound').hidden = $('mimeSkip').hidden = true; return; }
    const mine = m.by === st.me, left = Math.ceil((m.at + (m.dur || 60) * 1000 - Date.now()) / 1000), pre = Math.ceil((m.at - Date.now()) / 1000);
    const over = m.found || left <= 0;
    $('mimeWord').textContent = over ? m.word : mine ? m.word : '❓';
    $('mimeTime').textContent = m.found ? '✓' : pre > 0 ? 'Prêt… ' + pre : left > 0 ? left + ' s' : 'Temps écoulé';
    $('mimeInfo').textContent = (m.found ? '🎉 Trouvé ! ' : left <= 0 ? '⏰ Raté ! ' : mine ? 'Mime ce mot à ' + partnerName() + ', sans parler ! ' : nameOf(m.by) + ' mime… devine à voix haute ! ') + (m.count ? `(${m.count} mot${m.count > 1 ? 's' : ''} trouvé${m.count > 1 ? 's' : ''} ensemble)` : '');
    $('mimeFound').hidden = $('mimeSkip').hidden = !(mine && !over && pre <= 0);
  }
  onGame('mime', m => { render(); if (m?.found) floatEmo('🎉'); });
  setInterval(() => { if (!document.querySelector('.game[data-g="mime"]').hidden) render(); }, 250);
  $('mimeGo').onclick = () => saveGame('mime', { word: pick(), by: st.me, at: Date.now() + 3000, dur: 60, found: false, count: g('mime')?.count || 0 });
  $('mimeFound').onclick = () => { const m = g('mime'); if (m) saveGame('mime', { ...m, found: true, count: (m.count || 0) + 1 }); };
  $('mimeSkip').onclick = () => { const m = g('mime'); if (m) saveGame('mime', { ...m, word: pick() }); };
  render();
}

/* =========================================================
   Qui de nous deux ?
   ========================================================= */
function quiInit() {
  const QS = ['Qui est le plus jaloux ?', 'Qui a dit « je t\'aime » en premier ?', 'Qui est le plus romantique ?', 'Qui s\'endort le premier pendant un film ?', 'Qui est le plus têtu ?', 'Qui cuisine le mieux ?', 'Qui est le plus drôle ?', 'Qui s\'excuse en premier après une dispute ?', 'Qui passe le plus de temps sur son téléphone ?', 'Qui est le plus dépensier ?', 'Qui est le plus câlin ?', 'Qui oublie toujours les dates importantes ?', 'Qui serait le meilleur parent ?', 'Qui est le plus gourmand ?', 'Qui est toujours en retard ?', 'Qui chante le plus faux ?', 'Qui a le plus de patience ?', 'Qui pleure devant les films ?', 'Qui a fait le premier pas ?', 'Qui est le plus fêtard ?'];
  function render() {
    const q = g('qui') || { i: 0, votes: {}, agree: 0, total: 0 }, votes = q.votes || {};
    $('quiQ').textContent = QS[(q.i || 0) % QS.length];
    const ids = [st.me, other()].filter(Boolean), mineV = votes[st.me];
    $('quiBtns').innerHTML = ids.map(id => `<button class="${mineV === id ? '' : 'ghost'}" data-v="${esc(id)}">${esc(id === st.me ? 'Moi' : nameOf(id))}</button>`).join('');
    const both = ids.every(id => votes[id]);
    const real = id => (st.members.find(m => m.user_id === id)?.display_name) || (id === st.me ? 'Moi' : partnerName());
    $('quiRes').innerHTML = both ? ids.map(id => `${esc(id === st.me ? 'Tu as' : real(id) + ' a')} voté <b>${esc(real(votes[id]))}</b>`).join(' · ') + (votes[ids[0]] === votes[ids[1]] ? ' — <b>Vous êtes d\'accord ♥</b>' : ' — Pas d\'accord !') :
      mineV ? 'Vote enregistré… en attente de ' + esc(partnerName()) + ' 🔒' : '';
    $('quiRes').insertAdjacentHTML('beforeend', `<br><span class="mute">Score d'accord : ${q.agree || 0} / ${q.total || 0}</span>`);
  }
  onGame('qui', render); render(); listen('members', render);
  $('quiBtns').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; const q = clone(g('qui') || { i: 0, votes: {}, agree: 0, total: 0 }); q.votes ||= {}; q.votes[st.me] = b.dataset.v; saveGame('qui', q); };
  $('quiNext').onclick = () => {
    const q = g('qui') || { i: 0, votes: {}, agree: 0, total: 0 }, ids = [st.me, other()].filter(Boolean), v = q.votes || {};
    const both = ids.length === 2 && ids.every(id => v[id]);
    saveGame('qui', { i: ((q.i || 0) + 1) % QS.length, votes: {}, agree: (q.agree || 0) + (both && v[ids[0]] === v[ids[1]] ? 1 : 0), total: (q.total || 0) + (both ? 1 : 0) });
  };
}

/* =========================================================
   Roue des défis
   ========================================================= */
function roueInit() {
  const DEFIS = ['Fais-moi ton plus beau compliment', 'Chante 10 secondes', 'Imite-moi', 'Raconte ton meilleur souvenir de nous', 'Fais ta plus belle grimace', 'Danse 15 secondes', 'Dis « je t\'aime » dans une autre langue', 'Montre-moi un objet qui te fait penser à moi'];
  const SEG = 360 / DEFIS.length, COLS = ['#e63946', '#1d3fa5', '#f4a261', '#2a9d8f', '#8e3b5f', '#ffc93c', '#457b9d', '#ff8fab'];
  let shownAt = 0;
  const arc = (i) => { const a0 = (i * SEG - 90) * Math.PI / 180, a1 = ((i + 1) * SEG - 90) * Math.PI / 180, r = 100; return `M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)}Z`; };
  $('roue').innerHTML = `<g id="roueG">${DEFIS.map((d, i) => { const mid = (i + .5) * SEG; return `<path d="${arc(i)}" fill="${COLS[i]}" stroke="#fff" stroke-width="1.5"/><text transform="rotate(${mid}) translate(0 -60) rotate(90)" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff">${i + 1}</text>`; }).join('')}</g><circle r="14" fill="#fff" stroke="#0002"/><text text-anchor="middle" dominant-baseline="middle" font-size="12">♥</text>`;
  function render(animate) {
    const r = g('roue'), G = $('roueG');
    if (!r) { $('roueRes').textContent = 'Tournez la roue : le défi tombe sur celui qui l\'a lancée !'; return; }
    G.style.transition = animate ? '' : 'none';
    G.style.transform = `rotate(${r.rot}deg)`;
    if (!animate) G.getBoundingClientRect();
    const wait = Math.max(0, r.at + 4300 - Date.now());
    $('roueRes').textContent = wait > 0 ? '…' : `${r.idx + 1}. ${DEFIS[r.idx]} (pour ${r.by === st.me ? 'toi' : nameOf(r.by)})`;
    clearTimeout(render.t); if (wait > 0) render.t = setTimeout(() => { $('roueRes').textContent = `${r.idx + 1}. ${DEFIS[r.idx]} (pour ${r.by === st.me ? 'toi' : nameOf(r.by)})`; floatEmo('🎉'); }, wait);
  }
  onGame('roue', r => { const fresh = r && r.at !== shownAt && Date.now() - r.at < 4000; shownAt = r?.at; render(fresh); });
  render(false);
  $('roueGo').onclick = () => {
    const prev = g('roue')?.rot || 0, idx = Math.floor(Math.random() * DEFIS.length);
    const target = (360 - (idx + .5) * SEG) % 360, base = prev - (((prev % 360) + 360) % 360);
    saveGame('roue', { idx, rot: base + 360 * 5 + target, at: Date.now(), by: st.me });
  };
}

/* ========================================================= */
export function initGames2() {
  $('gameMenu').innerHTML = GAMES.map(([k, i, t, d]) => `<button class="gtile" data-open="${k}"><span class="gi">${i}</span><b>${esc(t)}</b><span>${esc(d)}</span></button>`).join('');
  $('gameMenu').onclick = e => { const b = e.target.closest('[data-open]'); if (b) openGame(b.dataset.open); };
  $('gameBack').onclick = () => openGame(null);
  try { const k = sessionStorage.getItem('nd-game'); if (k) openGame(k); } catch (e) { }
  p4Init(); penduInit(); memoryInit(); mimeInit(); quiInit(); roueInit();
  const navaleReady = navaleInit();
  listen('booted', navaleReady);
}
