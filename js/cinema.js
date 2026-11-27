import { sb, st, $, esc, fmt, toast, floatEmo, nameOf, partnerName, q, listen, send, onTable, loadTable } from './core.js?v=13';

/* =========================================================
   Mode ciné : film en grand, visages en bulles, chat et réactions
   ========================================================= */
const EMO = ['❤️', '😂', '😮', '😭', '🔥', '😘', '🍿'];
let seen = new Set(), first = true;

function setCine(on) {
  const vR = $('vRemote'), vL = $('vLocal'), vS = $('vScreen');
  if (on) $('faces').append(vR, vL); else vS.after(vR, vL);
  [vR, vL].forEach(v => v.srcObject && v.play().catch(() => { }));
  $('cinema').classList.toggle('on', on);
  $('cineBtn').classList.toggle('sel', on);
  $('cineBtn').textContent = on ? '🍿 Quitter le mode ciné' : '🍿 Mode ciné';
  if (on) scrollChat();
}
const scrollChat = () => { const l = $('chatList'); l.scrollTop = l.scrollHeight; };

function pop(author, body) {
  const box = $('pops'), d = document.createElement('div');
  d.className = 'pop'; d.innerHTML = `<b>${esc(nameOf(author))}</b>${esc(body)}`;
  box.append(d); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), 6000);
}

export function initCinema() {
  $('emobar').innerHTML = EMO.map(e => `<button type="button" data-e="${e}" aria-label="Réaction ${e}">${e}</button>`).join('');
  $('emobar').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; floatEmo(b.dataset.e); send('react', { e: b.dataset.e }); };

  $('cineBtn').onclick = () => setCine(!$('cinema').classList.contains('on'));
  listen('cine-auto', () => setCine(true));

  onTable('chat', rows => {
    const list = [...rows].reverse();
    $('chatCount').textContent = list.length ? list.length + ' message' + (list.length > 1 ? 's' : '') : '';
    $('chatList').innerHTML = list.length ? list.map(m => `<li class="${m.author === st.me ? 'me' : ''}"><small>${esc(nameOf(m.author))} · ${esc(fmt(m.created_at).split(' ').slice(-1)[0] || '')}</small>${esc(m.body)}</li>`).join('')
      : '<li class="empty">Commentez le film ici. Vos messages s\'affichent aussi sur l\'écran.</li>';
    const fresh = list.filter(m => !seen.has(m.id));
    fresh.forEach(m => seen.add(m.id));
    if (!first) fresh.filter(m => m.author !== st.me).forEach(m => {
      if ($('cinema').classList.contains('on')) pop(m.author, m.body);
      else toast(nameOf(m.author) + ' : ' + m.body.slice(0, 60));
    });
    first = false;
    scrollChat();
  });

  $('chatForm').onsubmit = async e => {
    e.preventDefault();
    const body = $('chatIn').value.trim(); if (!body) return;
    $('chatIn').value = '';
    pop(st.me, body);
    try { await q(sb.from('chat').insert({ couple_id: st.couple.id, body: body.slice(0, 500) }), 'Message non envoyé.'); }
    catch (err) { $('chatIn').value = body; return; }
    send('chat-new', {});
    loadTable('chat');
  };
  listen('chat-new', () => loadTable('chat'));
}
