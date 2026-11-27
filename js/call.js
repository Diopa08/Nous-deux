import { sb, st, $, toast, floatEmo, partner, partnerName, listen, send, dispatch, uploadPhoto, loadTable, q } from './core.js?v=11';

/* =========================================================
   Appel vidéo (WebRTC pair-à-pair, signalisation par Supabase Realtime)
   Négociation « parfaite » : chaque côté peut renégocier (partage d'écran).
   ========================================================= */
let pc = null, local = null, screen = null, screenSenders = [], inCall = false, ringing = false;
let here = false, makingOffer = false, ignoreOffer = false, remoteCamId = null, remoteScreenId = null;
const remoteStreams = new Map();
const stage = $('stage'), vL = $('vLocal'), vR = $('vRemote'), vS = $('vScreen'), aR = $('aRemote');
const canShare = !!navigator.mediaDevices?.getDisplayMedia;

function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const t = st.settings.turn;
  if (t && t.urls) list.push({ urls: t.urls.split(',').map(s => s.trim()).filter(Boolean), username: t.username || '', credential: t.credential || '' });
  return list;
}
const polite = () => { const p = partner(); return !p || st.me < p.user_id; };

function info(t) { $('callInfo').textContent = t; }
function stageMsg(t) { $('stageMsg').textContent = t; $('stageMsg').hidden = !t; }
function buttons() {
  $('callBtn').textContent = inCall ? '📕 Raccrocher' : (ringing ? '📞 Décrocher' : '📞 Appeler');
  $('callBtn').classList.toggle('danger', inCall);
  $('micBtn').disabled = $('camBtn').disabled = !local;
  $('shareBtn').disabled = !pc || !canShare;
  $('shareBtn').textContent = screen ? '⏹️ Arrêter le partage' : '🖥️ Partager l\'écran';
  if (!canShare) $('shareBtn').title = 'Le partage d\'écran marche depuis un ordinateur (Chrome, Edge, Firefox).';
  const a = local?.getAudioTracks()[0], v = local?.getVideoTracks()[0];
  $('micBtn').textContent = a && !a.enabled ? '🔇 Micro coupé' : '🎙️ Micro';
  $('camBtn').textContent = v && !v.enabled ? '🚫 Caméra coupée' : '📷 Caméra';
}

async function getCam(audio = true) {
  if (local) return local;
  try {
    local = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(micId() ? { deviceId: { exact: micId() } } : {}) } : false });
  } catch (e) {
    toast('Autorise la caméra et le micro dans ton navigateur.'); throw e;
  }
  vL.srcObject = local; vL.hidden = false; buttons(); meter(local, vL, true); silentSince = 0; silentWarned = false; listDevices();
  return local;
}

function makePC() {
  if (pc) return pc;
  pc = new RTCPeerConnection({ iceServers: iceServers() });
  makingOffer = false; ignoreOffer = false;
  pc.onnegotiationneeded = async () => {
    try { makingOffer = true; await pc.setLocalDescription(); send('sig', { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
    catch (e) { console.error(e); } finally { makingOffer = false; }
  };
  pc.onicecandidate = ({ candidate }) => { if (candidate) send('sig', { candidate: candidate.toJSON() }); };
  pc.ontrack = ({ track, streams }) => {
    const s = streams[0] || new MediaStream([track]);
    remoteStreams.set(s.id, s);
    routeStreams();
  };
  pc.onconnectionstatechange = () => {
    const s = pc?.connectionState;
    if (s === 'connected') { info('Connecté ♥'); stageMsg(''); }
    else if (s === 'connecting') info('Connexion…');
    else if (s === 'disconnected') info('Connexion instable…');
    else if (s === 'failed') { info('La connexion a échoué. Nouvel essai… (si ça persiste, ajoute un relais TURN dans Réglages)'); try { pc.restartIce(); } catch (e) { } }
  };
  local?.getTracks().forEach(t => pc.addTrack(t, local));
  buttons();
  return pc;
}

function routeStreams() {
  if (!remoteCamId || !remoteStreams.has(remoteCamId)) { remoteCamId = null; for (const id of remoteStreams.keys()) if (id !== remoteScreenId) { remoteCamId = id; break; } }
  const cam = remoteStreams.get(remoteCamId);
  if (cam && vR.srcObject !== cam) { vR.srcObject = cam; voiceBoost(cam); resume(); meter(cam, vR, false); }
  let scr = null;
  if (screen) { if (vS.srcObject !== screen) { vS.srcObject = screen; vS.muted = true; } vS.hidden = false; stage.classList.add('sharing'); stageMsg(''); return; }
  if (remoteScreenId) {
    scr = remoteStreams.get(remoteScreenId) || null;
    if (!scr) for (const [id, s] of remoteStreams) if (id !== remoteCamId) { scr = s; break; }
  }
  vS.hidden = !scr;
  if (scr && vS.srcObject !== scr) { vS.srcObject = scr; vS.muted = false; resume(); }
  if (!scr) vS.srcObject = null;
  stage.classList.toggle('sharing', !!scr);
  if (scr) stageMsg('');
}

async function onSig({ description, candidate }) {
  if (!inCall) return;
  if (!pc) makePC();
  try {
    if (description) {
      const collision = description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
      ignoreOffer = !polite() && collision;
      if (ignoreOffer) return;
      await pc.setRemoteDescription(description);
      if (description.type === 'offer') { await pc.setLocalDescription(); send('sig', { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
    } else if (candidate) {
      try { await pc.addIceCandidate(candidate); } catch (e) { if (!ignoreOffer) console.warn(e); }
    }
  } catch (e) { console.error(e); }
}

/* --- Niveaux sonores : anneau qui bouge quand on parle + alerte micro muet --- */
let meterCtx = null, meters = [], silentSince = 0, silentWarned = false;
function meter(stream, el, mine) {
  try {
    if (!stream || !stream.getAudioTracks().length) return;
    meterCtx ||= new AudioContext(); meterCtx.resume?.();
    const src = meterCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const an = meterCtx.createAnalyser(); an.fftSize = 512; src.connect(an);
    meters = meters.filter(m => m.el !== el); meters.push({ an, el, mine, buf: new Float32Array(an.fftSize) });
  } catch (e) { }
}
function meterLoop() {
  for (const m of meters) {
    m.an.getFloatTimeDomainData(m.buf); let sum = 0; for (const v of m.buf) sum += v * v;
    const rms = Math.sqrt(sum / m.buf.length), lvl = Math.min(1, rms * 12);
    m.el.style.setProperty('--lvl', lvl.toFixed(2));
    if (m.mine && inCall && local?.getAudioTracks()[0]?.enabled) {
      if (rms > 0.002) { silentSince = 0; if (silentWarned) { silentWarned = false; info(''); send('mic', { silent: false }); } }
      else if (!silentSince) silentSince = Date.now();
      else if (!silentWarned && Date.now() - silentSince > 12000) { silentWarned = true; info('⚠️ Ton micro n\'envoie aucun son. Vérifie qu\'il est autorisé pour ton navigateur (Mac : Réglages Système → Confidentialité et sécurité → Microphone), puis recharge la page.'); send('mic', { silent: true }); }
    }
  }
  requestAnimationFrame(meterLoop);
}
requestAnimationFrame(meterLoop);

/* --- Voix de l'autre : passe par un amplificateur (volume jusqu'à 400 %) --- */
let voiceGain = null, voiceSrc = null, voiceDest = null;
const micId = () => { try { return localStorage.getItem('nd-mic') || ''; } catch (e) { return ''; } };
function voiceBoost(stream) {
  try {
    meterCtx ||= new AudioContext();
    voiceSrc?.disconnect();
    voiceSrc = meterCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    voiceGain ||= meterCtx.createGain();
    voiceDest ||= meterCtx.createMediaStreamDestination();
    voiceGain.gain.value = +$('volIn').value / 100;
    voiceSrc.connect(voiceGain); try { voiceGain.disconnect(); } catch (e) { }
    voiceGain.connect(voiceDest);
    // l'élément audio joue le flux amplifié (garde le choix de sortie et marche même si le navigateur bride Web Audio)
    aR.srcObject = voiceDest.stream; aR.muted = false; meterCtx.resume?.();
  } catch (e) { aR.srcObject = stream; }
}
async function listDevices() {
  try {
    const ds = await navigator.mediaDevices.enumerateDevices();
    const fill = (sel, kind, def) => { const cur = sel.value; sel.innerHTML = `<option value="">${def}</option>` + ds.filter(d => d.kind === kind && d.deviceId && d.deviceId !== 'default').map(d => `<option value="${d.deviceId.replace(/"/g, '')}">${(d.label || kind).replace(/[<>&"]/g, '')}</option>`).join(''); sel.value = cur; };
    fill($('micSel'), 'audioinput', 'Micro par défaut'); $('micSel').value = micId();
    fill($('outSel'), 'audiooutput', 'Haut-parleur par défaut');
    $('outSel').closest('label').hidden = !('setSinkId' in HTMLMediaElement.prototype);
  } catch (e) { }
}
async function switchMic(id) {
  try { localStorage.setItem('nd-mic', id); } catch (e) { }
  if (!local) return;
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(id ? { deviceId: { exact: id } } : {}) } });
    const nt = ns.getAudioTracks()[0], old = local.getAudioTracks()[0];
    const snd = pc?.getSenders().find(x => x.track && x.track === old);
    if (snd) await snd.replaceTrack(nt);
    if (old) { local.removeTrack(old); old.stop(); }
    local.addTrack(nt); meter(local, vL, true); silentSince = 0; buttons(); toast('Micro changé');
  } catch (e) { toast('Impossible d\'utiliser ce micro.'); }
}

/* --- Son : relance les lecteurs mis en pause par le navigateur --- */
function resume() {
  let blocked = false;
  if (meterCtx && meterCtx.state !== 'running') meterCtx.resume().catch(() => { }).then(() => { if (meterCtx.state !== 'running') $('unmuteBtn').hidden = false; });
  const tries = [[aR, true], [vR, false], [vS, !screen]];
  return Promise.all(tries.map(([el]) => el.srcObject && el.paused ? el.play().catch(() => { blocked = true; }) : null)).then(() => { $('unmuteBtn').hidden = !blocked; });
}
setInterval(() => { if (inCall) resume(); }, 2000);

/* --- Sonnerie --- */
let ringTimer = null, audioCtx = null;
function ringSound(on) {
  clearInterval(ringTimer);
  if (!on) return;
  const beep = () => { try { audioCtx ||= new AudioContext(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(.08, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .6); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + .6); } catch (e) { } navigator.vibrate?.([200, 100, 200]); };
  beep(); ringTimer = setInterval(beep, 1800);
}
function showRing(on) { ringing = on; $('ring').hidden = !on; $('ringText').textContent = '📞 ' + partnerName() + ' t\'appelle'; ringSound(on); buttons(); }

async function startCall() {
  try { await getCam(); } catch (e) { return; }
  if (!st.live) { toast('Connexion temps réel pas encore prête, réessaie dans quelques secondes.'); local?.getTracks().forEach(t => t.stop()); local = null; vL.srcObject = null; buttons(); return; }
  inCall = true; info('');
  stageMsg(here ? 'Ça sonne chez ' + partnerName() + '…' : partnerName() + ' n\'a pas l\'app ouverte : la sonnerie arrivera dès qu\'il l\'ouvre.');
  send('call-ring', {}); buttons();
  clearTimeout(startCall.t); startCall.t = setTimeout(() => { if (inCall && !pc) { stageMsg(partnerName() + ' ne répond pas. Réessaie plus tard ♥'); } }, 45000);
}
async function answer() {
  showRing(false);
  try { await getCam(); } catch (e) { return; }
  inCall = true; location.hash = 'appel'; stageMsg('Connexion…');
  makePC(); send('call-join', {}); buttons();
}
function hangup(notify = true) {
  if (notify && inCall) send('call-end', {});
  stopShare(false);
  try { pc?.close(); } catch (e) { }
  pc = null; inCall = false; remoteStreams.clear(); remoteCamId = null; remoteScreenId = null;
  vR.srcObject = null; aR.srcObject = null; vS.srcObject = null; $('unmuteBtn').hidden = true; vS.hidden = true; stage.classList.remove('sharing');
  if (!boothBusy) { local?.getTracks().forEach(t => t.stop()); local = null; vL.srcObject = null; }
  stageMsg('Lance un appel : ' + partnerName() + ' reçoit une sonnerie dans l\'app.'); info(''); buttons();
}

/* --- Partage d'écran --- */
async function startShare() {
  if (!pc) return toast('Lance d\'abord l\'appel.');
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include',
    });
  } catch (e) { return; }
  const hasAudio = screen.getAudioTracks().length > 0;
  send('screen', { on: true, id: screen.id, audio: hasAudio });
  screenSenders = screen.getTracks().map(t => pc.addTrack(t, screen));
  routeStreams(); dispatch('cine-auto', true);
  screen.getVideoTracks()[0].addEventListener('ended', () => stopShare());
  const safari = /^((?!chrome|android|crios|edg).)*safari/i.test(navigator.userAgent);
  info(hasAudio ? 'Tu partages ton écran avec le son.' : safari ? 'Safari ne partage pas le son : utilise Chrome ou Edge pour partager un film avec le son.' : 'Partage SANS le son : arrête, relance, choisis l\'onglet « Onglet Chrome » et coche « Partager aussi l\'audio de l\'onglet ».');
  if (!hasAudio) toast('Le son n\'est pas partagé');
  buttons();
}
function stopShare(notify = true) {
  if (!screen) return;
  screenSenders.forEach(s => { try { pc?.removeTrack(s); } catch (e) { } });
  screenSenders = []; screen.getTracks().forEach(t => t.stop()); screen = null;
  if (notify) send('screen', { on: false }); info(''); buttons(); vS.muted = false; routeStreams();
}

/* =========================================================
   Photobooth : 4 photos, décompte commun, bande souvenir
   ========================================================= */
let boothBusy = false, stripBlob = null;
function grab(video, mirror) {
  const W = 480, H = 360, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) { x.fillStyle = '#222'; x.fillRect(0, 0, W, H); return c; }
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
  if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
  x.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return c;
}
const cssColor = v => { const e = document.createElement('i'); e.style.color = `var(${v})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
function composeStrip(shots, text, filter) {
  const two = shots.some(s => s.r), W = 640, pad = 28, gap = 10, cw = two ? (W - pad * 2 - gap) / 2 : W - pad * 2, ch = cw * .75;
  const head = 88, foot = 64, H = head + shots.length * (ch + gap) - gap + foot + pad;
  const c = $('strip'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#fffdf8'; x.fillRect(0, 0, W, H);
  const A = cssColor('--a'), B = cssColor('--b');
  for (let i = 0; i < W; i += 40) { x.fillStyle = (i / 40) % 2 ? B : A; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, 0); x.lineTo(i + 12, 10); x.lineTo(i - 8, 10); x.fill(); }
  x.fillStyle = B; x.textAlign = 'center'; x.font = '700 44px Caveat, cursive'; x.fillText(text || 'Nous deux ♥', W / 2, 66);
  shots.forEach((s, i) => {
    const y = head + i * (ch + gap);
    x.save(); x.filter = filter || 'none';
    x.drawImage(s.l, pad, y, cw, ch);
    if (two && s.r) x.drawImage(s.r, pad + cw + gap, y, cw, ch);
    x.restore();
  });
  x.fillStyle = '#7a7a8a'; x.font = '500 22px "DM Sans", sans-serif';
  x.fillText(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, H - pad - 8);
  $('boothDl').href = c.toDataURL('image/jpeg', .9);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .9));
}
async function runBooth({ at, filter, text }) {
  if (boothBusy) return; boothBusy = true;
  location.hash = 'appel'; $('boothPanel').hidden = false; $('boothResult').hidden = true;
  try { await getCam(!inCall ? false : true); } catch (e) { boothBusy = false; return; }
  const shots = [], cnt = $('boothCount'), fl = $('flash');
  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
  for (let k = 0; k < 4; k++) {
    const shotAt = at + k * 3500;
    cnt.hidden = false;
    for (let n = 3; n > 0; n--) { await wait(shotAt - (n * 900) - Date.now()); cnt.textContent = n; }
    await wait(shotAt - Date.now());
    cnt.textContent = ''; fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 60);
    const remoteOk = vR.srcObject && vR.videoWidth;
    shots.push({ l: grab(vL, true), r: remoteOk ? grab(vR, false) : null });
  }
  cnt.hidden = true;
  stripBlob = await composeStrip(shots, text, filter);
  $('boothResult').hidden = false; boothBusy = false;
  if (!inCall) { local?.getTracks().forEach(t => t.stop()); local = null; vL.srcObject = null; buttons(); }
  $('boothResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function initCall() {
  buttons(); stageMsg('Lance un appel : ton chéri reçoit une sonnerie dans l\'app.');
  $('callBtn').onclick = () => inCall ? hangup() : ringing ? answer() : startCall();
  $('ringJoin').onclick = answer;
  $('ringNo').onclick = () => { showRing(false); send('call-end', { declined: true }); };
  $('micBtn').onclick = () => { const a = local?.getAudioTracks()[0]; if (a) { a.enabled = !a.enabled; buttons(); } };
  $('camBtn').onclick = () => { const v = local?.getVideoTracks()[0]; if (v) { v.enabled = !v.enabled; buttons(); } };
  $('shareBtn').onclick = () => screen ? stopShare() : startShare();
  $('unmuteBtn').onclick = () => { aR.muted = false; if (!screen) vS.muted = false; meterCtx?.resume(); resume(); };
  document.addEventListener('click', () => { if (meterCtx && meterCtx.state !== 'running') meterCtx.resume().catch(() => { }); });
  $('volIn').oninput = () => { const v = +$('volIn').value; $('volVal').textContent = v + ' %'; if (voiceGain) voiceGain.gain.value = v / 100; try { localStorage.setItem('nd-vol', v); } catch (e) { } };
  try { const v = localStorage.getItem('nd-vol'); if (v) { $('volIn').value = v; $('volVal').textContent = v + ' %'; } } catch (e) { }
  $('micSel').onchange = () => switchMic($('micSel').value);
  $('outSel').onchange = () => { const id = $('outSel').value; [aR, vS].forEach(el => el.setSinkId?.(id).catch(() => toast('Sortie audio indisponible'))); };
  navigator.mediaDevices?.addEventListener?.('devicechange', listDevices);
  listDevices();
  vS.addEventListener('click', () => { if (!screen) vS.muted = false; vS.play?.().catch(() => { }); info(''); });
  $('fullBtn').onclick = () => { const c = $('cinema'); if (document.fullscreenElement) document.exitFullscreen(); else (c.requestFullscreen || c.webkitRequestFullscreen)?.call(c)?.catch?.(() => { }); };
  $('boothBtn').onclick = () => { $('boothPanel').hidden = !$('boothPanel').hidden; };
  $('boothGo').onclick = () => {
    const cfg = { at: Date.now() + 3200, filter: $('boothFilter').value, text: $('boothText').value.trim().slice(0, 40) };
    if (inCall) send('booth', cfg);
    runBooth(cfg);
  };
  $('boothSave').onclick = async () => {
    if (!stripBlob) return;
    $('boothSave').disabled = true;
    try {
      const path = await uploadPhoto(stripBlob, 'booth');
      await q(sb.from('memories').insert({ couple_id: st.couple.id, path, caption: $('boothText').value.trim().slice(0, 200) || 'Photobooth ♥', kind: 'strip' }));
      toast('Ajouté aux souvenirs ♥'); loadTable('memories');
    } catch (e) { toast('Envoi impossible.'); }
    $('boothSave').disabled = false;
  };

  listen('call-ring', () => { if (inCall) { if (!pc) { makePC(); send('call-join', {}); } } else showRing(true); });
  listen('call-join', () => { if (inCall && !pc) { stageMsg('Connexion…'); makePC(); } });
  listen('call-end', p => { if (ringing) showRing(false); if (inCall) { hangup(false); toast(p.declined ? partnerName() + ' ne peut pas maintenant' : partnerName() + ' a raccroché'); } });
  listen('sig', onSig);
  listen('mic', p => info(p.silent ? '⚠️ Le micro de ' + partnerName() + ' n\'envoie aucun son (son navigateur n\'a pas accès au micro).' : ''));
  listen('screen', p => { remoteScreenId = p.on ? String(p.id || '') : null; if (!p.on) { for (const id of [...remoteStreams.keys()]) if (id !== remoteCamId) remoteStreams.delete(id); } routeStreams(); if (p.on) { location.hash = 'appel'; dispatch('cine-auto', true); toast(partnerName() + (p.audio === false ? ' partage son écran, mais sans le son' : ' partage son écran')); vS.muted = false; resume(); } });
  listen('booth', p => { if (typeof p.at === 'number' && Math.abs(p.at - Date.now()) < 15000) runBooth({ at: p.at, filter: String(p.filter || 'none'), text: String(p.text || '').slice(0, 40) }); });
  listen('presence', h => { const was = here; here = h; if (h && !was && inCall && !pc) send('call-ring', {}); });
  listen('presence', here => { if (!here && inCall && pc) info(partnerName() + ' a quitté l\'app.'); });
  addEventListener('beforeunload', () => { if (inCall) send('call-end', {}); });
}
