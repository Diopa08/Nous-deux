import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.1/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=19';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

/* État partagé de l'app */
export const st = {
  me: null,          // id de l'utilisateur
  couple: null,      // { id, code }
  members: [],       // [{ user_id, display_name }]
  settings: {},
  games: {},         // game_state par clé
  rows: {},          // tables chargées
  chan: null,        // canal privé (broadcast + présence)
};

export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const fmt = v => { const t = typeof v === 'number' ? v : Date.parse(v); return t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 3000); }
export function floatEmo(e) { const d = document.createElement('div'); d.className = 'float'; d.textContent = e; d.style.left = (10 + Math.random() * 80) + 'vw'; (document.fullscreenElement || document.body).append(d); setTimeout(() => d.remove(), 2500); }

export function nameOf(id) {
  if (!id) return '';
  if (id === st.me) return 'Moi';
  const m = st.members.find(x => x.user_id === id);
  return (m && m.display_name) || 'Mon cœur';
}
export const partner = () => st.members.find(m => m.user_id !== st.me) || null;
export const partnerName = () => { const p = partner(); return (p && p.display_name) || 'Ton cœur'; };

/* Erreurs lisibles */
export function oops(e, msg = 'Impossible d\'enregistrer.') { console.error(e); toast(msg); }
export async function q(promise, msg) { const { data, error } = await promise; if (error) { oops(error, msg); throw error; } return data; }

/* --- Photos : envoi redimensionné + URL signées en cache --- */
const urlCache = new Map();
export async function signedUrls(paths) {
  const need = [...new Set(paths.filter(p => p && !urlCache.has(p)))];
  if (need.length) {
    const { data } = await sb.storage.from('photos').createSignedUrls(need, 60 * 60 * 6);
    (data || []).forEach(d => { if (d.signedUrl) urlCache.set(d.path, d.signedUrl); });
  }
  return Object.fromEntries(paths.map(p => [p, urlCache.get(p) || '']));
}
export const cachedUrl = p => urlCache.get(p) || '';

async function shrink(file, max = 1800) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (s === 1 && file.size < 1.5e6 && file.type === 'image/jpeg') return file;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.86));
  } catch (e) { return file; }
}
export async function uploadPhoto(fileOrBlob, prefix = 'p') {
  const raw = fileOrBlob instanceof Blob && !(fileOrBlob instanceof File) && /^image\/(jpeg|gif)$/.test(fileOrBlob.type);
  const blob = raw || fileOrBlob.type === 'image/gif' ? fileOrBlob : await shrink(fileOrBlob);
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${st.couple.id}/${prefix}-${uid()}.${ext}`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/* --- Bus temps réel (broadcast sur canal privé) --- */
const handlers = {};
export function listen(ev, fn) { (handlers[ev] ||= []).push(fn); }
export function dispatch(ev, payload) { (handlers[ev] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); }
export function send(ev, payload = {}) {
  if (!st.chan) return;
  st.chan.send({ type: 'broadcast', event: ev, payload: { ...payload, from: st.me } }).catch(() => {});
}

/* --- game_state --- */
const gameHandlers = {};
export function onGame(key, fn) { (gameHandlers[key] ||= []).push(fn); }
export function setGameLocal(key, data) { st.games[key] = data; (gameHandlers[key] || []).forEach(fn => fn(data)); }
export async function saveGame(key, data) {
  setGameLocal(key, data);
  const { error } = await sb.from('game_state').upsert({ couple_id: st.couple.id, key, data, updated_by: st.me, updated_at: new Date().toISOString() });
  if (error) oops(error);
}

/* --- Tables --- */
const tableHandlers = {};
export function onTable(t, fn) { (tableHandlers[t] ||= []).push(fn); }
const ORDER = { notes: ['created_at', false], memories: ['created_at', false], chapters: ['position', true], dates: ['when_at', true], films: ['created_at', false], quiz: ['created_at', false], strokes: ['created_at', true], chat: ['created_at', false] };
export async function loadTable(t) {
  const [col, asc] = ORDER[t];
  const { data, error } = await sb.from(t).select('*').eq('couple_id', st.couple.id).order(col, { ascending: asc, nullsFirst: false }).limit(t === 'strokes' ? 800 : t === 'chat' ? 150 : 500);
  if (error) { console.error(error); return; }
  st.rows[t] = data || [];
  (tableHandlers[t] || []).forEach(fn => fn(st.rows[t]));
}
export const TABLES = Object.keys(ORDER);
