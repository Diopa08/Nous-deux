import { sb, st, $, esc, norm, uid, toast, floatEmo, nameOf, partnerName, q, signedUrls, cachedUrl, listen, send, onGame, saveGame, onTable, loadTable } from './core.js?v=18';

const QUESTIONS = ["Quel moment avec moi revivrais-tu encore et encore ?", "Qu'est-ce qui te manque le plus chez moi cette semaine ?", "Où est-ce qu'on vivra dans 5 ans ?", "Quelle petite habitude à moi te fait sourire ?", "Quel serait notre voyage de rêve ?", "Quelle chanson te fait penser à nous ?", "Que veux-tu qu'on fasse en premier quand on se revoit ?", "Ton souvenir préféré de notre premier rendez-vous ?", "Qu'est-ce que je fais qui te fait te sentir aimé·e ?", "Un rêve que tu n'as jamais dit à personne ?", "Une journée entière sans contrainte : on fait quoi ?", "Qu'as-tu appris sur toi depuis qu'on est ensemble ?"];
const TP = [["Un appel vidéo de 3 h", "10 vocaux surprises dans la journée"], ["Un week-end à la plage", "Un week-end à la montagne"], ["Cuisiner ensemble", "Aller au resto"], ["Une lettre écrite à la main", "Une playlist faite pour toi"], ["Un film d'horreur", "Une comédie romantique"], ["Le lever du soleil", "Les étoiles tard le soir"], ["Un voyage surprise", "Un voyage planifié ensemble"], ["Danser toute la nuit", "Une soirée canapé"]];
const ACTIONS = ["Chante-moi le refrain d'une chanson qui te fait penser à moi", "Fais ta tête la plus drôle devant la caméra", "Fais-moi une déclaration en 3 langues", "Imite-moi pendant 30 secondes", "Écris un petit poème sur nous en 4 lignes", "Montre-moi l'objet le plus proche de toi et invente son histoire", "Danse 20 secondes sur la musique de mon choix", "Dis-moi en vocal ce que tu aimes chez moi", "Dessine mon portrait en 1 minute sur la feuille partagée", "Prépare-moi une playlist de 5 chansons maintenant"];
const VERITES = ["Qu'as-tu pensé de moi la toute première fois ?", "Quel est ton plus grand rêve pour nous ?", "Quand t'es-tu senti·e le plus proche de moi ?", "Qu'est-ce qui te fait le plus peur dans la distance ?", "Un petit secret que tu ne m'as jamais dit ?", "Quel est mon défaut le plus mignon ?", "Quel moment de nous te fait encore rire ?", "Qu'est-ce que tu ferais si j'étais là ce soir ?", "Ton surnom secret pour moi dans ta tête ?", "Ce que tu admires le plus chez moi ?"];
const WORDS = ["avion", "plage", "cœur", "chat", "pizza", "guitare", "lune", "valise", "fleur", "soleil", "maison", "vélo", "gâteau", "ballon", "bague", "étoile", "café", "arbre", "poisson", "parapluie", "glace", "train", "papillon", "montagne", "bateau"];
const g = k => st.games[k] || null;
const clone = o => JSON.parse(JSON.stringify(o || {}));

export function initGames() {
  /* ---------------- Dessin à deux ---------------- */
  const COLS = ['#1b1b1b', '#d32f45', '#1d3fa5', '#0d8f80', '#f0a020', '#8e3b5f', '#ffffff'];
  let col = COLS[1], strokes = [], live = {}, cur = null, lastEmit = 0;
  $('swatches').innerHTML = COLS.map((c, i) => `<button class="sw${c === col ? ' sel' : ''}" data-col="${c}" style="background:${c};${c === '#ffffff' ? 'box-shadow:inset 0 0 0 1px #0003' : ''}" aria-label="${i === 6 ? 'Gomme' : 'Couleur ' + (i + 1)}"></button>`).join('');
  $('swatches').onclick = e => { const b = e.target.closest('[data-col]'); if (!b) return; col = b.dataset.col; document.querySelectorAll('.sw').forEach(s => s.classList.toggle('sel', s === b)); };
  const cv = $('cv'), ctx = cv.getContext('2d');
  function size() { const r = cv.getBoundingClientRect(); if (!r.width) return; const d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; redraw(); }
  new ResizeObserver(size).observe(cv);
  function line(s) {
    const p = s.p; if (!Array.isArray(p) || p.length < 2) return; const W = cv.width, H = cv.height;
    ctx.strokeStyle = /^#[0-9a-f]{6}$/i.test(s.c) ? s.c : '#000'; ctx.lineWidth = (s.c === '#ffffff' ? 22 : 5) * (W / 700); ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(p[0] / 1000 * W, p[1] / 1000 * H); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] / 1000 * W, p[i + 1] / 1000 * H);
    if (p.length === 2) ctx.lineTo(p[0] / 1000 * W + .1, p[1] / 1000 * H); ctx.stroke();
  }
  function redraw() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); strokes.forEach(line); Object.values(live).forEach(line); if (cur) line(cur); }
  const pt = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 1000)]; };
  async function commit() {
    if (!cur || cur.p.length < 2) { cur = null; return; }
    const s = cur; cur = null; strokes.push(s);
    send('draw', { id: s.id, c: s.c, n: s.p.length, p: s.p.slice(-300) });
    const { error } = await sb.from('strokes').insert({ id: s.id, couple_id: st.couple.id, color: s.c, points: s.p });
    if (error) toast('Trait non enregistré');
  }
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); cur = { id: uid(), c: col, p: pt(e) }; redraw(); });
  cv.addEventListener('pointermove', e => {
    if (!cur) return; cur.p.push(...pt(e));
    if (cur.p.length > 1200) { const end = cur.p.slice(-2); commit(); cur = { id: uid(), c: col, p: end }; }
    redraw(); const n = Date.now(); if (n - lastEmit > 70) { lastEmit = n; send('draw', { id: cur.id, c: cur.c, n: cur.p.length, p: cur.p.slice(-300) }); }
  });
  ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, commit));
  listen('draw', d => {
    if (typeof d.id !== 'string') return;
    const p = Array.isArray(d.p) ? d.p.filter(n => typeof n === 'number').slice(0, 600) : [];
    const n = +d.n || p.length, start = n - p.length, prev = live[d.id];
    live[d.id] = { c: String(d.c || ''), p: prev && prev.p.length >= start ? prev.p.slice(0, start).concat(p) : p };
    redraw();
  });
  onTable('strokes', rows => { strokes = rows.map(r => ({ id: r.id, c: r.color, p: r.points })); rows.forEach(r => delete live[r.id]); redraw(); });
  $('cvClear').onclick = async () => { strokes = []; live = {}; redraw(); await q(sb.from('strokes').delete().eq('couple_id', st.couple.id)); loadTable('strokes'); };

  /* Devine mon dessin */
  function renderDv() {
    const dv = g('devine'), w = $('dvWord'), info = $('dvInfo'), gr = $('dvGuessRow');
    if (!dv || !dv.word) { w.textContent = ''; info.textContent = ''; gr.hidden = true; return; }
    if (dv.solved) { w.textContent = '🎉 « ' + dv.word + ' »'; info.textContent = nameOf(dv.solvedBy) + ' a trouvé !'; gr.hidden = true; return; }
    if (dv.drawer === st.me) { w.textContent = 'Dessine : ' + dv.word; info.textContent = 'Ne le dis pas !'; gr.hidden = true; }
    else { w.textContent = '?'; info.textContent = nameOf(dv.drawer) + ' dessine… devine !'; gr.hidden = false; }
  }
  let wasSolved = false;
  onGame('devine', dv => { renderDv(); if (dv?.solved && !wasSolved) floatEmo('🎉'); wasSolved = !!dv?.solved; });
  $('dvDraw').onclick = async () => { await saveGame('devine', { drawer: st.me, word: WORDS[Math.floor(Math.random() * WORDS.length)], solved: false, at: Date.now() }); $('cvClear').click(); };
  $('dvGuessBtn').onclick = () => {
    const dv = g('devine'); if (!dv) return;
    if (norm($('dvGuess').value) === norm(dv.word)) { saveGame('devine', { ...dv, solved: true, solvedBy: st.me }); $('dvGuess').value = ''; }
    else toast('Non… essaie encore !');
  };

  /* ---------------- Tu me connais ? ---------------- */
  onTable('quiz', rows => {
    $('quiz').innerHTML = rows.length ? rows.map(x => {
      const gs = x.guesses || {}, mine = x.author === st.me, guessed = gs[st.me] != null;
      let inner = `<b>${esc(x.question)}</b><br><span class="mute">de ${esc(nameOf(x.author))}</span>`;
      if (mine) inner += `<br>Ta réponse : <b>${esc(x.answer)}</b>` + Object.keys(gs).map(id => `<br>${esc(nameOf(id))} a dit : « ${esc(gs[id])} » ${norm(gs[id]) === norm(x.answer) ? '✅' : ''}`).join('');
      else if (guessed) inner += `<br>Tu as dit : « ${esc(gs[st.me])} »<br>La réponse : <b>${esc(x.answer)}</b> ${norm(gs[st.me]) === norm(x.answer) ? '✅ Bravo !' : ''}`;
      else inner += `<div class="row"><input data-gin="${esc(x.id)}" maxlength="200" placeholder="Ta réponse…"><button data-gq="${esc(x.id)}">Deviner</button></div>`;
      return `<li><div>${inner}</div>${mine ? `<button class="x" data-del="quiz:${esc(x.id)}" aria-label="Supprimer">✕</button>` : ''}</li>`;
    }).join('') : '<li class="mute">Aucune question. Lance-toi !</li>';
  });
  $('qzBtn').onclick = async () => {
    const question = $('qzQ').value.trim(), answer = $('qzA').value.trim(); if (!question || !answer) return toast('Question et réponse nécessaires');
    await q(sb.from('quiz').insert({ couple_id: st.couple.id, question, answer })); $('qzQ').value = ''; $('qzA').value = ''; loadTable('quiz');
  };
  $('quiz').addEventListener('click', async e => {
    const b = e.target.closest('[data-gq]'); if (!b) return;
    const v = $('quiz').querySelector(`[data-gin="${CSS.escape(b.dataset.gq)}"]`)?.value.trim(); if (!v) return;
    const row = (st.rows.quiz || []).find(r => r.id === b.dataset.gq); if (!row) return;
    await q(sb.from('quiz').update({ guesses: { ...(row.guesses || {}), [st.me]: v.slice(0, 200) } }).eq('id', row.id)); loadTable('quiz');
  });

  /* ---------------- Action ou vérité ---------------- */
  onGame('aov', a => { const list = a.t === 'a' ? ACTIONS : VERITES; $('aov').innerHTML = `<span class="tag">${a.t === 'a' ? 'ACTION' : 'VÉRITÉ'} · tirée par ${esc(nameOf(a.by))}</span><span class="hand">${esc(list[(a.i || 0) % list.length])}</span>`; });
  const draw = t => { const list = t === 'a' ? ACTIONS : VERITES, a = g('aov'); let i; do { i = Math.floor(Math.random() * list.length); } while (a && a.t === t && a.i === i); saveGame('aov', { t, i, by: st.me, at: Date.now() }); };
  $('aovA').onclick = () => draw('a'); $('aovV').onclick = () => draw('v');

  /* ---------------- Morpion : classique, géant (5 alignés) ou Super morpion ---------------- */
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const SIZE = { c3: 9, g10: 100, u: 81 };
  const mfresh = (mode, x = '', o = '') => ({ mode, board: Array(SIZE[mode]).fill(''), small: Array(9).fill(''), next: -1, turn: 'X', x, o, winner: '', line: [], last: -1 });
  const mcur = () => { const m = g('morpion'); if (!m) return mfresh('c3'); const mode = SIZE[m.mode] ? m.mode : 'c3'; return Array.isArray(m.board) && m.board.length === SIZE[mode] ? { ...m, mode } : mfresh(mode, m.x, m.o); };
  const small3 = (cells) => { for (const l of LINES) { const v = cells[l[0]]; if (v && v !== 'nul' && l.every(k => cells[k] === v)) return v; } return cells.every(Boolean) ? 'nul' : ''; };
  function gomoku(b, i, mine) {
    const N = 10, r0 = Math.floor(i / N), c0 = i % N;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const line = [i];
      for (const sg of [1, -1]) { let r = r0 + dr * sg, c = c0 + dc * sg; while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === mine) { line.push(r * N + c); r += dr * sg; c += dc * sg; } }
      if (line.length >= 5) return line;
    }
    return null;
  }
  const sym = v => v === 'X' ? '✕' : v === 'O' ? '○' : '';
  function renderMorp() {
    const m = mcur(), mine = m.x === st.me ? 'X' : m.o === st.me ? 'O' : null, b = m.board, line = m.line || [];
    $('mMode').value = m.mode;
    const el = $('board'); el.className = 'board mode-' + m.mode;
    if (m.mode === 'u') {
      el.innerHTML = Array.from({ length: 9 }, (_, sb) => {
        const won = m.small[sb], active = !m.winner && !won && (m.next < 0 || m.next === sb);
        return `<div class="sub${active ? ' active' : ''}${won ? ' won' : ''}">${Array.from({ length: 9 }, (_, c) => { const i = sb * 9 + c, v = b[i]; return `<button data-c="${i}" class="${v === 'O' ? 'o' : ''}${i === m.last ? ' last' : ''}" aria-label="Grille ${sb + 1}, case ${c + 1}">${sym(v)}</button>`; }).join('')}${won ? `<span class="big ${won === 'O' ? 'o' : ''}">${won === 'nul' ? '=' : sym(won)}</span>` : ''}</div>`;
      }).join('');
    } else {
      el.innerHTML = b.map((v, i) => `<button data-c="${i}" class="${v === 'O' ? 'o' : ''}${line.includes(i) ? ' win' : ''}${i === m.last ? ' last' : ''}" aria-label="Case ${i + 1}">${sym(v)}</button>`).join('');
    }
    const rule = m.mode === 'g10' ? 'Aligne 5 symboles. ' : m.mode === 'u' ? 'Gagne 3 petites grilles alignées. La case que tu joues envoie l\'autre dans la grille correspondante. ' : '';
    $('mStatus').textContent = rule + (m.winner ? (m.winner === 'nul' ? 'Match nul !' : (m.winner === mine ? '🎉 Tu as gagné !' : 'Gagné par ' + nameOf(m.winner === 'X' ? m.x : m.o))) :
      (!m.x || !m.o) ? 'Joue une case pour rejoindre la partie.' : (m.turn === mine ? 'À toi de jouer (' + sym(mine) + ')' : 'Au tour de ' + nameOf(m.turn === 'X' ? m.x : m.o)));
  }
  renderMorp(); onGame('morpion', renderMorp);
  $('board').onclick = e => {
    const c = e.target.closest('[data-c]'); if (!c) return;
    const m = clone(mcur()); if (m.winner) return toast('Partie terminée : relance une partie.');
    if (!m.x) m.x = st.me; else if (!m.o && m.x !== st.me) m.o = st.me;
    const mine = m.x === st.me ? 'X' : m.o === st.me ? 'O' : null, i = +c.dataset.c;
    if (!mine) return toast('La partie est complète');
    if (m.turn !== mine) return toast('Pas ton tour');
    if (m.board[i]) return;
    if (m.mode === 'u') {
      const sb = Math.floor(i / 9);
      if (m.small[sb]) return toast('Cette grille est déjà terminée');
      if (m.next >= 0 && m.next !== sb) return toast('Tu dois jouer dans la grille en surbrillance');
      m.board[i] = mine;
      m.small[sb] = small3(m.board.slice(sb * 9, sb * 9 + 9));
      const target = i % 9; m.next = m.small[target] ? -1 : target;
      const big = LINES.find(l => l.every(k => m.small[k] === mine));
      m.winner = big ? mine : (m.small.every(Boolean) ? 'nul' : '');
    } else if (m.mode === 'g10') {
      m.board[i] = mine; const l = gomoku(m.board, i, mine);
      if (l) { m.winner = mine; m.line = l; } else if (m.board.every(Boolean)) m.winner = 'nul';
    } else {
      m.board[i] = mine; const l = LINES.find(l => l.every(k => m.board[k] === mine));
      if (l) { m.winner = mine; m.line = l; } else if (m.board.every(Boolean)) m.winner = 'nul';
    }
    m.last = i; m.turn = mine === 'X' ? 'O' : 'X';
    if (m.winner && m.winner !== 'nul') floatEmo('🎉');
    saveGame('morpion', m);
  };
  const newGame = mode => { const m = g('morpion'); saveGame('morpion', mfresh(mode, m?.o || '', m?.x || '')); };
  $('mReset').onclick = () => newGame($('mMode').value);
  $('mMode').onchange = () => newGame($('mMode').value);

  /* ---------------- Question du jour ---------------- */
  function renderQ() {
    const qd = g('question') || { i: 0, answers: {} }; $('qText').textContent = QUESTIONS[(qd.i || 0) % QUESTIONS.length];
    const a = qd.answers || {}, answered = a[st.me] != null;
    $('qAnswers').innerHTML = Object.keys(a).map(id => `<li><div><b>${esc(nameOf(id))}</b><br>${answered || id === st.me ? esc(a[id]) : '<span class="mute">Réponds pour voir sa réponse 🔒</span>'}</div></li>`).join('');
  }
  renderQ(); onGame('question', renderQ);
  $('qBtn').onclick = () => { const t = $('qAns').value.trim(); if (!t) return; const qd = clone(g('question') || { i: 0, answers: {} }); qd.answers ||= {}; qd.answers[st.me] = t.slice(0, 400); saveGame('question', qd); $('qAns').value = ''; };
  $('qNext').onclick = () => saveGame('question', { i: ((g('question')?.i || 0) + 1) % QUESTIONS.length, answers: {} });

  /* ---------------- Tu préfères ---------------- */
  function renderTP() {
    const t = g('tuprefs') || { i: 0, votes: {} }, p = TP[(t.i || 0) % TP.length]; $('tpA').textContent = p[0]; $('tpB').textContent = p[1];
    const v = t.votes || {}, ids = Object.keys(v), voted = v[st.me] != null;
    $('tpA').classList.toggle('sel', voted && v[st.me] === 0); $('tpB').classList.toggle('sel', voted && v[st.me] === 1);
    $('tpRes').textContent = !ids.length ? '' : (voted ? ids.map(id => nameOf(id) + ' : ' + p[v[id] === 1 ? 1 : 0]).join(' · ') + (ids.length > 1 && new Set(ids.map(id => v[id])).size === 1 ? ' — Même choix ♥' : '') : partnerName() + ' a déjà choisi… vote pour voir.');
  }
  renderTP(); onGame('tuprefs', renderTP);
  const vote = k => { const t = clone(g('tuprefs') || { i: 0, votes: {} }); t.votes ||= {}; t.votes[st.me] = k; saveGame('tuprefs', t); };
  $('tpA').onclick = () => vote(0); $('tpB').onclick = () => vote(1);
  $('tpNext').onclick = () => saveGame('tuprefs', { i: ((g('tuprefs')?.i || 0) + 1) % TP.length, votes: {} });
}
