// ============================================================
// CORE — utilities, formatting, markets, records, chart, store
// ============================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rand = mulberry32((BOOT ^ 0x9e3779b9) >>> 0);
function gauss(r = rand) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(n, r = rand) { let s = ''; for (let i = 0; i < n; i++) s += B58[Math.floor(r() * 58)]; return s; }
const addrFrom = seed => b58(44, mulberry32(hashStr(seed)));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = { get(k) { try { const v = localStorage.getItem('foma.' + k); return v ? JSON.parse(v) : null; } catch { return null; } }, set(k, v) { try { localStorage.setItem('foma.' + k, JSON.stringify(v)); return true; } catch { return false; } }, del(k) { try { localStorage.removeItem('foma.' + k); } catch {} } };

// ---------- formatting ----------
const NF = d => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const nf0 = NF(0), nf2 = NF(2), nf1 = NF(1);
const MINUS = '−';
function fmtUsd(v, d) {
  if (v == null || !isFinite(v)) return '—';
  const neg = v < 0; v = Math.abs(v);
  let s;
  if (d != null) s = NF(d).format(v);
  else if (v > 0 && v < 0.01) s = v.toPrecision(2);
  else s = nf2.format(v);
  return (neg ? MINUS : '') + '$' + s;
}
function fmtUsdC(v) {
  if (v == null || !isFinite(v)) return '—';
  const neg = v < 0; v = Math.abs(v); let s;
  if (v >= 1e9) s = (v / 1e9).toFixed(v >= 1e10 ? 1 : 2) + 'B';
  else if (v >= 1e6) s = (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M';
  else if (v >= 1e3) s = (v / 1e3).toFixed(v >= 1e4 ? 1 : 2) + 'K';
  else s = v >= 100 ? nf0.format(v) : nf2.format(v);
  return (neg ? MINUS : '') + '$' + s;
}
const fmtSignedUsd = (v, c) => (v > 0 ? '+' : '') + (c ? fmtUsdC(v) : fmtUsd(v));
function fmtPct(p, d = 1, sign = true) { if (p == null || !isFinite(p)) return '—'; const s = Math.abs(p).toFixed(d); return (p > 0 && sign ? '+' : p < 0 ? MINUS : '') + s + '%'; }
function fmtQty(q) {
  if (q == null || !isFinite(q)) return '—';
  const a = Math.abs(q);
  if (a >= 1e9) return (q / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (q / 1e6).toFixed(a >= 1e8 ? 1 : 2) + 'M';
  if (a >= 1e4) return (q / 1e3).toFixed(1) + 'K';
  if (a >= 100) return nf0.format(q);
  if (a >= 1) return nf2.format(q);
  return q.toPrecision(3);
}
const fmtQtyFull = q => q >= 1000 ? nf2.format(q) : q >= 1 ? q.toFixed(4) : q.toPrecision(6);
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
function pxParts(p) {
  if (p == null || !isFinite(p)) return null;
  if (p >= 1000) return { s: nf2.format(p) };
  if (p >= 1) return { s: p.toFixed(p < 10 ? 3 : 2) };
  if (p >= 0.0001) return { s: p.toPrecision(4) };
  const [m, e] = p.toExponential(3).split('e');
  const zeros = -parseInt(e, 10) - 1;
  return { z: zeros, d: m.replace('.', '').replace(/0+$/, '').padEnd(3, '0').slice(0, 4) };
}
function fmtPx(p, dollar = true) { const x = pxParts(p); if (!x) return '—'; const d = dollar ? '$' : ''; return x.s != null ? d + x.s : d + '0.0' + [...String(x.z)].map(c => SUBD[c]).join('') + x.d; }
function fmtPxH(p, dollar = true) { const x = pxParts(p); if (!x) return '—'; const d = dollar ? '$' : ''; return x.s != null ? d + x.s : `${d}0.0<sub>${x.z}</sub>${x.d}`; }
function ago(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 48) return h + 'h' + (h < 10 && m % 60 ? ' ' + (m % 60) + 'm' : '') + ' ago';
  const d = Math.floor(h / 24); return d + 'd ' + (h % 24) + 'h ago';
}
function dur(ms) { const s = ms / 1000; if (s < 60) return s.toFixed(s < 10 ? 2 : 1) + ' s'; const m = Math.floor(s / 60); if (m < 60) return m + 'm ' + Math.round(s % 60) + 's'; const h = Math.floor(m / 60); return h + 'h ' + (m % 60) + 'm'; }
const pad2 = n => String(n).padStart(2, '0');
function clock(ts, ms) { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + (ms ? '.' + String(d.getMilliseconds()).padStart(3, '0') : ''); }
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dstamp(ts, withTime = true) { const d = new Date(ts); return d.getDate() + ' ' + MON[d.getMonth()] + (withTime ? ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : ''); }
const cls = (v, zeroNeutral = true) => v > 0 ? 'up' : v < 0 ? 'dn' : (zeroNeutral ? 'muted' : 'up');

// ---------- icons ----------
const ic = (p, f) => `<svg viewBox="0 0 24 24" fill="${f ? 'currentColor' : 'none'}" stroke="${f ? 'none' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  discover: ic('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  following: ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/>'),
  portfolio: ic('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2M3 10h18M7 6V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V6"/>'),
  research: ic('<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/>'),
  profile: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>'),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  bell: ic('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>'),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  up: ic('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: ic('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  shield: ic('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  receipt: ic('<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  link: ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  ext: ic('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  copy: ic('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
  flag: ic('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  sliders: ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  info: ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  warn: ic('<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>'),
  lock: ic('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  swap: ic('<path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>'),
  eye: ic('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  spark: ic('<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15c.3 1.8 1 2.6 2.5 3-1.6.4-2.2 1.1-2.5 3-.3-1.9-1-2.6-2.5-3 1.6-.4 2.2-1.2 2.5-3z"/>'),
  play: ic('<path d="M8 5.5v13l10.5-6.5z"/>', true),
  pause: ic('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  transfer: ic('<path d="M4 12h13M13 7l5 5-5 5"/><path d="M4 7v10" opacity=".5"/>'),
  pen: ic('<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3.5 3.5"/>'),
  coin: ic('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
  trophy: ic('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4v3h-4z"/>'),
  group: ic('<circle cx="12" cy="8" r="3"/><circle cx="5.5" cy="10" r="2.3"/><circle cx="18.5" cy="10" r="2.3"/><path d="M7 19c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6M1.8 18c.4-2 1.6-3.2 3.4-3.4M22.2 18c-.4-2-1.6-3.2-3.4-3.4"/>'),
  chev: ic('<path d="m9 6 6 6-6 6"/>'),
  back: ic('<path d="m15 6-6 6 6 6"/>'),
  refresh: ic('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  download: ic('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'),
  doc: ic('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  bolt: ic('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
  globe: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"/>'),
  apple: ic('<path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.6zM14.1 5.4c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/>', true),
  google: ic('<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 2.8-4.1 2.8-7z"/><path d="M12 21.5c2.6 0 4.8-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21.5z"/><path d="M6.7 13.8a5.7 5.7 0 0 1 0-3.6V7.7H3.5a9.5 9.5 0 0 0 0 8.6z"/><path d="M12 6.3c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.5 9.5 0 0 0 3.5 7.7l3.2 2.5c.7-2.2 2.8-3.9 5.3-3.9z"/>'),
  keyboard: ic('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  share: ic('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7"/>'),
  bookmark: ic('<path d="M6 3.5h12V21l-6-4-6 4z"/>'),
  dot: ic('<circle cx="12" cy="12" r="4"/>', true),
};
const KIND_IC = { publish:'receipt', accumulate:'up', add:'plus', sell:'down', exit:'down', transfer:'transfer', inferred:'link', thesis:'pen', disclosure:'coin', flag:'flag', decision:'shield', correction:'refresh' };
const KIND_COL = { publish:'var(--silver)', accumulate:'var(--gain)', add:'var(--gain)', sell:'var(--loss)', exit:'var(--loss)', transfer:'var(--warn)', inferred:'var(--infer)', thesis:'var(--fg)', disclosure:'var(--warn)', flag:'var(--infer)', decision:'var(--infer)', correction:'var(--infer)' };
const KIND_HEX = { publish:'#DCE0E7', accumulate:'#3CDDA0', add:'#3CDDA0', sell:'#FF6B62', exit:'#FF6B62', transfer:'#F4BB4E', inferred:'#A8ACFF', thesis:'#F5F1EA', disclosure:'#F4BB4E', flag:'#A8ACFF', decision:'#A8ACFF', correction:'#A8ACFF' };

// ---------- art: avatars and demo-token emblems (generated, no real people) ----------
const svgUri = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
const AV_PAL = [['#2B2347','#A8ACFF'],['#3B2416','#F4BB4E'],['#123C3A','#7FE0C8'],['#3A1416','#FF7A82'],['#3A1F2B','#FF9DB0'],['#1E2A3F','#8FC3FF'],['#33261A','#E9C59A'],['#262420','#F5F1EA']];
function avatarSVG(seed) {
  const r = mulberry32(hashStr(seed + '#av')); const [bg, fg] = AV_PAL[Math.floor(r() * AV_PAL.length)]; const k = Math.floor(r() * 5); let g = '';
  if (k === 0) g = `<circle cx="32" cy="32" r="21" fill="none" stroke="${fg}" stroke-width="6"/><circle cx="32" cy="32" r="8" fill="${fg}"/>`;
  else if (k === 1) g = `<path d="M0 64 64 0v64z" fill="${fg}" opacity=".9"/><circle cx="21" cy="21" r="8" fill="${fg}"/>`;
  else if (k === 2) { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g += `<circle cx="${14 + x * 18}" cy="${14 + y * 18}" r="${3 + r() * 5}" fill="${fg}"/>`; }
  else if (k === 3) g = `<path d="M13 27l19-12 19 12M13 41l19-12 19 12M13 55l19-12 19 12" fill="none" stroke="${fg}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  else g = `<circle cx="29" cy="33" r="19" fill="${fg}"/><circle cx="39" cy="25" r="16" fill="${bg}"/>`;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>${g}</svg>`);
}
const EMBLEM = {
  moth: '<rect width="64" height="64" fill="#C9944F"/><path d="M31 23c-6-9-18-11-21-5s6 14 19 13zM33 23c6-9 18-11 21-5s-6 14-19 13zM30 35c-5 1-12 6-10 11s8 2 11-6zM34 35c5 1 12 6 10 11s-8 2-11-6z" fill="#2A1A0E"/><rect x="30" y="19" width="4" height="29" rx="2" fill="#2A1A0E"/><path d="M31 19c-2-4-5-6-8-6M33 19c2-4 5-6 8-6" stroke="#2A1A0E" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  kiln: '<rect width="64" height="64" fill="#3B2416"/><path d="M14 52V34a18 18 0 0 1 36 0v18z" fill="#C8643B"/><path d="M22 52V35a10 10 0 0 1 20 0v17z" fill="#1E120A"/><path d="M32 36c4 4 5.5 7 5.5 10A5.5 5.5 0 0 1 32 51.5 5.5 5.5 0 0 1 26.5 46c0-3.2 2.2-5.4 3.6-7.3.3 2.2 1.4 3.3 2.5 3.6-.6-2.2-.8-4.1 1.4-6.3z" fill="#F4BB4E"/>',
  brine: '<rect width="64" height="64" fill="#123C3A"/><g fill="none" stroke="#7FE0C8" stroke-width="3.4" stroke-linecap="round"><path d="M12 28c4-4 8-4 12 0s8 4 12 0 8-4 12 0"/><path d="M12 38c4-4 8-4 12 0s8 4 12 0 8-4 12 0" opacity=".75"/><path d="M12 48c4-4 8-4 12 0s8 4 12 0 8-4 12 0" opacity=".5"/></g><circle cx="44" cy="17" r="4" fill="#F5F1EA"/>',
  relic: '<rect width="64" height="64" fill="#2B2347"/><path d="M32 11l15 21-15 21-15-21z" fill="none" stroke="#B9B2FF" stroke-width="3.2" stroke-linejoin="round"/><path d="M32 20v24M24 32h16" stroke="#F5F1EA" stroke-width="3.2" stroke-linecap="round"/>',
  glint: '<rect width="64" height="64" fill="#1B2340"/><path d="M32 9l5 18 18 5-18 5-5 18-5-18-18-5 18-5z" fill="#FFF3B0"/><circle cx="48" cy="16" r="3" fill="#FFF3B0"/>',
  tadpole: '<rect width="64" height="64" fill="#17331F"/><circle cx="38" cy="27" r="12" fill="#9BE37E"/><path d="M30 34c-8 8 0 14-12 21" stroke="#9BE37E" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="42" cy="24" r="2.8" fill="#17331F"/>',
  okra: '<rect width="64" height="64" fill="#22301A"/><path d="M18 52c-2-20 14-36 28-40 2 14-8 34-28 40z" fill="#8DBA5A"/><path d="M20 50c6-12 14-24 25-36" stroke="#22301A" stroke-width="2.2" fill="none"/><path d="M44 12l6-4" stroke="#8DBA5A" stroke-width="4" stroke-linecap="round"/>',
  cheddar: '<rect width="64" height="64" fill="#3A2A10"/><path d="M11 41 51 22l2 21-40 8z" fill="#F4BB4E"/><path d="M11 41 51 22l-11-5z" fill="#FFD777"/><circle cx="29" cy="43" r="3.2" fill="#3A2A10"/><circle cx="42" cy="39" r="2.4" fill="#3A2A10"/><circle cx="21" cy="46" r="1.8" fill="#3A2A10"/>',
};
const emblemUri = k => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${EMBLEM[k]}</svg>`);
const FOMA_MARK = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(50 50) scale(.95) translate(-57.01 -46.39) rotate(45 50 55)" ><path fill="var(--lime)" d="M8 36V56A42 42 0 0 0 92 56V30L62 36V56A12 12 0 0 1 38 56V30Z"/><path fill="var(--silver)" d="M8 30L38 24V17Q38 12 33 12H13Q8 12 8 17Z"/><path fill="var(--silver)" d="M62 30L92 24V17Q92 12 87 12H67Q62 12 62 17Z"/></g></svg>`;

// ---------- markets ----------
const TOK = {};
const TOKS = [];
function buildMarkets() {
  for (const d of REAL_DEF) {
    const arr = d.s ? d.s.split(',').map(Number) : null;
    const t0 = d.t0 ?? SNAP_TS - 7 * D, t1 = d.t1 ?? SNAP_TS;
    const series = [];
    if (arr) { const n = arr.length; for (let i = 0; i < n; i++) series.push({ t: t0 + (t1 - t0) * i / (n - 1), p: arr[i] / d.k }); }
    if (series.length) { const last = series[series.length - 1]; if (SNAP_TS - last.t > 60e3) series.push({ t: SNAP_TS, p: d.px }); else last.p = d.px; }
    else { series.push({ t: SNAP_TS - 7 * D, p: d.px }, { t: SNAP_TS, p: d.px }); }
    const n = arr ? arr.length : 2;
    const t = { ...d, real: true, demo: false, logo: LOGOS.tokens[d.sym] || emblemUri('relic'), series, idxT: i => t0 + (t1 - t0) * i / (n - 1), depth: d.base ? 2.2e7 : Math.max(60000, d.vol * 0.025), res: (t1 - t0) / (n - 1) };
    TOK[d.sym] = t; TOKS.push(t);
  }
  for (const d of DEMO_DEF) {
    const r = mulberry32(hashStr(d.sym + '#px'));
    const stepMs = d.ageH < 1.5 ? 10e3 : d.ageH < 12 ? 60e3 : 5 * 60e3;
    const sig = d.vol * Math.sqrt(stepMs / 60e3);
    const series = [];
    for (let k = 0; k < d.keys.length - 1; k++) {
      const [h0, p0] = d.keys[k], [h1, p1] = d.keys[k + 1];
      const ta = BOOT + h0 * H, tb = BOOT + h1 * H; const n = Math.max(2, Math.round((tb - ta) / stepMs));
      const la = Math.log(p0), lb = Math.log(p1); let w = 0; const W = [0];
      for (let j = 1; j <= n; j++) { w += gauss(r) * sig; W.push(w); }
      for (let j = (k === 0 ? 0 : 1); j <= n; j++) { const f = j / n; const bridge = W[j] - f * W[n]; series.push({ t: ta + (tb - ta) * f, p: Math.exp(la + (lb - la) * f + bridge) }); }
    }
    const t = { ...d, real: false, demo: true, logo: emblemUri(d.hue), series, px: series[series.length - 1].p, launched: BOOT - d.ageH * H, res: stepMs, sigTick: d.vol * Math.sqrt(2.5), tax: d.tax || 0 };
    TOK[d.sym] = t; TOKS.push(t);
  }
}
function pxNow(sym) { const s = TOK[sym].series; return s[s.length - 1].p; }
function priceAt(sym, t) {
  const s = TOK[sym].series; if (t <= s[0].t) return s[0].p; const L = s.length; if (t >= s[L - 1].t) return s[L - 1].p;
  let lo = 0, hi = L - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m].t <= t) lo = m; else hi = m; }
  const a = s[lo], b = s[hi]; return a.p + (b.p - a.p) * (t - a.t) / (b.t - a.t || 1);
}
function tokStats(sym) {
  const t = TOK[sym], p = pxNow(sym);
  if (t.real) return { px: p, mcap: t.mcap * p / t.px, ch: t.ch, vol: t.vol, holders: null, liq: null };
  const p24 = priceAt(sym, Date.now() - 24 * H); const mcap = p * t.supply;
  return { px: p, mcap, ch: (p / p24 - 1) * 100, vol: mcap * (t.ageH < 24 ? 1.4 : 0.32), holders: t.holders + Math.floor((Date.now() - BOOT) / 9000), liq: t.depth * 5 };
}
function tokAge(t) { if (t.real) return 'Since ' + t.since; const h = (Date.now() - t.launched) / H; return h < 1 ? Math.round(h * 60) + 'm old' : h < 48 ? Math.round(h) + 'h old' : Math.round(h / 24) + 'd old'; }
const isMeme = t => !t.base && !t.cash;
let tickListeners = new Set();
function tickDemo() {
  const now = Date.now();
  for (const t of TOKS) {
    if (!t.demo) continue;
    const s = t.series, last = s[s.length - 1];
    const drift = (Math.log(t.keys[t.keys.length - 1][1]) - Math.log(last.p)) * 0.002;
    const np = last.p * Math.exp(gauss() * t.sigTick * 0.5 + drift);
    s.push({ t: now, p: np }); if (s.length > 6000) s.splice(0, s.length - 6000);
  }
  for (const fn of tickListeners) { try { fn(); } catch (e) { console.error(e); } }
}

// ---------- people & records ----------
const CR = {}; for (const c of CREATORS) { c.av = avatarSVG(c.h); CR[c.h] = c; }
function rankStatus(c) { if (c.team) return { ok: false, why: 'Team account: own-token calls are not ranked' }; const ok = c.rec.calls >= MIN_SAMPLE.calls && c.rec.days >= MIN_SAMPLE.days; return ok ? { ok: true } : { ok: false, why: `Building record: ${c.rec.calls} of ${MIN_SAMPLE.calls} calls, ${c.rec.days} of ${MIN_SAMPLE.days} days` }; }
const STYLE = { research:'Researcher', swing:'Swing trader', scalper:'Scalper', long:'Long-term holder' };
function followability(c) { const g = c.rec.paper30; if (c.rec.calls < 10) return ['', 'Too early to tell']; if (g >= 2) return ['ok', 'Followable']; if (g > -3) return ['', 'Mixed for followers']; return ['dn', 'Edge fades within 30 s']; }

// resolve idea times / prices / holdings / outcomes
function T(spec, sym) { if (spec == null) return null; if (spec.h != null) return BOOT + spec.h * H; if (spec.i != null) return TOK[sym].idxT(spec.i) + (spec.dm || 0) * MIN; return spec; }
const IDX = {};
function prepIdea(x) {
  x.pubT = T(x.pub, x.sym);
  for (const v of x.v) v.t = T(v.at, x.sym);
  for (const e of x.ev) { if (typeof e.t === 'string') e.title = e.t; e.t = T(e.at, x.sym); e.px = priceAt(x.sym, e.t); }
  x.ev.sort((a, b) => a.t - b.t);
  if (x.comp?.ext?.at) x.comp.ext.t = T(x.comp.ext.at, x.sym);
  IDX[x.id] = x; return x;
}
function holdingsAt(x, t) {
  const inv = x.inv.qty; let add = 0, moved = 0, sold = 0;
  for (const e of x.ev) { if (e.t > t || !e.d) continue; add += e.d.add || 0; moved += e.d.moved || 0; sold += e.d.sold || 0; }
  const base = inv + add; const rem = Math.max(0, base - moved - sold);
  return { inv, add, moved, sold, rem, base, remPct: inv ? rem / inv : 0 };
}
function thesisAt(x, t) { let v = x.v[0]; for (const vv of x.v) if (vv.t <= t) v = vv; return v; }
function compAt(x, t) { const e = x.comp?.ext; if (!e) return { foma: x.comp?.foma, ext: null }; if (e.state === 'late') return { foma: x.comp.foma, ext: t >= e.t ? e : { state: 'none-yet' } }; return { foma: x.comp.foma, ext: e }; }
function impactFor(sym, usd) { const d = TOK[sym].depth; return usd / (usd + d); }
function authorResult(x) {
  if (x.kind === 'research' || !x.inv.qty) return null;
  if (x.inv.basis == null) return { unknown: true, note: 'No purchase basis (team allocation). Return is not computed.' };
  let costQty = x.inv.qty, cost = x.inv.qty * x.inv.basis, proceeds = 0, sold = 0, moved = 0;
  for (const e of x.ev) { if (!e.d) continue; if (e.d.add) { cost += e.d.add * e.px; costQty += e.d.add; } if (e.d.sold) { proceeds += e.d.sold * e.px; sold += e.d.sold; } if (e.d.moved) moved += e.d.moved; }
  const avg = cost / costQty; const keptCost = cost - moved * avg; const rem = costQty - moved - sold; const value = rem * pxNow(x.sym);
  const ret = keptCost > 0 ? ((proceeds + value) * (1 - 0.008) / keptCost - 1) * 100 : null;
  return { ret, proceeds, value, cost: keptCost, rem, sold, moved, avg, realized: sold ? (proceeds - sold * avg) : 0 };
}
function paperResult(x) {
  const r = x.paper; if (!r) return null;
  const tEntry = x.pubT + r.delay * 1000; const now = Date.now();
  const imp = impactFor(x.sym, r.notional);
  const entry = priceAt(x.sym, tEntry) * (1 + imp);
  let exitT = null, exitPx = null, why = 'open';
  if (r.exitWithAuthor) { const ex = x.ev.find(e => e.k === 'exit'); if (ex) { exitT = ex.t + r.delay * 1000; exitPx = priceAt(x.sym, exitT) * (1 - imp); why = 'Exited 30 s after the author'; } }
  else {
    const limit = tEntry + (r.days || 7) * D; const s = TOK[x.sym].series; const stopPx = entry * (1 + r.stop);
    for (const pt of s) { if (pt.t <= tEntry) continue; if (pt.t > Math.min(limit, now)) break; if (pt.p * (1 - imp) <= stopPx) { exitT = pt.t; exitPx = pt.p * (1 - imp); why = `Stopped at ${fmtPct(r.stop * 100, 0)} rule`; break; } }
    if (!exitT && now >= limit) { exitT = limit; exitPx = priceAt(x.sym, limit) * (1 - imp); why = `Closed at ${r.days}-day rule`; }
  }
  const closed = !!exitT; const markPx = closed ? exitPx : pxNow(x.sym);
  const gross = markPx / entry - 1; const net = ((1 + gross) * (1 - FEE_RATE) * (1 - FEE_RATE) - 1) * 100;
  const liq = closed ? net : (((pxNow(x.sym) * (1 - imp)) / entry) * (1 - FEE_RATE) ** 2 - 1) * 100;
  return { entry, tEntry, closed, exitT, exitPx, why, ret: net, liq, imp, rules: r };
}
function coverage(x) { const c = CR[x.a]; return `${c.rec.calls} ${c.rec.unit || 'calls'} · ${c.rec.days} days · ${c.wallets} signed wallet${c.wallets > 1 ? 's' : ''}`; }

// ---------- odometer ----------
const DIG = '0123456789'.split('').map(n => `<i>${n}</i>`).join('');
function odoHTML(text) { return `<span class="odo num">${[...text].map(ch => /\d/.test(ch) ? `<span class="d"><span style="transform:translateY(-${ch}0%)">${DIG}</span></span>` : `<span>${esc(ch)}</span>`).join('')}</span>`; }
function odoSet(el, text, dir) {
  if (!el) return; const odo = el.querySelector('.odo');
  const prev = el.dataset.v || '';
  if (prev === text) return;
  const shape = s => s.replace(/\d/g, '0');
  if (!odo || shape(prev) !== shape(text) || S.rm) el.innerHTML = odoHTML(text);
  else { const ds = odo.querySelectorAll('.d>span'); let k = 0; for (const ch of text) if (/\d/.test(ch)) { ds[k].style.transform = `translateY(-${ch}0%)`; k++; } }
  el.dataset.v = text;
  if (dir) { el.classList.remove('flash-up', 'flash-dn'); void el.offsetWidth; el.classList.add(dir > 0 ? 'flash-up' : 'flash-dn'); }
}

// ---------- chart ----------
const CHARTS = new Set();
const IMGC = {};
function imgOf(src) { if (!IMGC[src]) { const im = new Image(); im.onload = () => CHARTS.forEach(c => c.draw()); im.src = src; IMGC[src] = im; } return IMGC[src]; }
const TF = { '15m': 15 * MIN, '1h': H, '6h': 6 * H, '24h': 24 * H, '3d': 3 * D, '7d': 7 * D };
class Chart {
  constructor(canvas, o) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.o = Object.assign({ type: 'line', tf: '7d', markers: [], mini: false }, o);
    this.box = canvas.parentElement; this.tip = this.box.querySelector('.chart-tip'); this.hover = null; this.t0 = performance.now(); this.drag = false;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.box);
    const pm = e => this.move(e), pl = () => { this.hover = null; this.hideTip(); this.draw(); };
    canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerleave', pl);
    canvas.addEventListener('pointerdown', e => { if (this.o.onScrub) { this.drag = true; canvas.setPointerCapture(e.pointerId); this.move(e); } });
    canvas.addEventListener('pointerup', e => { const was = this.drag; this.drag = false; const m = this.hit(e); if (m && this.o.onMarker) this.o.onMarker(m.id); else if (was && this.o.onScrub && this.hover) this.o.onScrub(this.hover.t, true); });
    CHARTS.add(this); this.resize(); this.loop();
  }
  loop() { const run = () => { if (!this.c.isConnected) return this.destroy(); this.draw(); if (performance.now() - this.t0 < 900 && !S.rm) requestAnimationFrame(run); }; requestAnimationFrame(run); }
  destroy() { this.ro.disconnect(); CHARTS.delete(this); }
  resize() { const r = this.box.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); this.w = Math.max(50, r.width); this.h = Math.max(50, r.height); this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr); this.x.setTransform(dpr, 0, 0, dpr, 0, 0); this.draw(); }
  set(o) { Object.assign(this.o, o); this.draw(); }
  range() { const tok = TOK[this.o.sym]; const s = tok.series; const end = this.o.end ?? s[s.length - 1].t; let start = this.o.start ?? end - TF[this.o.tf]; if (start < s[0].t) start = s[0].t; return [start, Math.max(end, start + 60e3)]; }
  pad() { return this.o.mini ? { l: 6, r: 6, t: 10, b: 8 } : { l: 8, r: 70, t: 16, b: 26 }; }
  geo() {
    const [t0, t1] = this.range(); const s = TOK[this.o.sym].series; const pts = [];
    for (let i = 0; i < s.length; i++) { const p = s[i]; if (p.t < t0) { if (s[i + 1] && s[i + 1].t >= t0) pts.push(p); continue; } if (p.t > t1) { pts.push(p); break; } pts.push(p); }
    let lo = Infinity, hi = -Infinity; for (const p of pts) { if (p.t < t0 || p.t > t1) continue; lo = Math.min(lo, p.p); hi = Math.max(hi, p.p); }
    for (const m of this.o.markers) if (m.t >= t0 && m.t <= t1) { lo = Math.min(lo, m.p); hi = Math.max(hi, m.p); }
    if (this.o.entry && this.o.entry.p > lo * 0.5 && this.o.entry.p < hi * 1.8) { lo = Math.min(lo, this.o.entry.p); hi = Math.max(hi, this.o.entry.p); }
    if (!isFinite(lo)) { lo = 0; hi = 1; } const span = (hi - lo) || hi * 0.02 || 1; lo -= span * 0.09; hi += span * 0.12;
    const P = this.pad(); const W = this.w - P.l - P.r, Hh = this.h - P.t - P.b;
    return { t0, t1, lo, hi, pts, P, W, Hh, X: t => P.l + (t - t0) / (t1 - t0) * W, Y: p => P.t + (1 - (p - lo) / (hi - lo)) * Hh, Tof: x => t0 + (x - P.l) / W * (t1 - t0), Pof: y => lo + (1 - (y - P.t) / Hh) * (hi - lo) };
  }
  move(e) { const r = this.c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const g = this.geo(); const t = clamp(g.Tof(x), g.t0, g.t1); this.hover = { x, y, t, p: priceAt(this.o.sym, t) }; if (this.drag && this.o.onScrub) this.o.onScrub(t, false); this.draw(); this.showTip(this.hit(e)); }
  hit(e) { const r = this.c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const g = this.geo(); for (const m of this.o.markers) { if (m.t < g.t0 || m.t > g.t1) continue; if (Math.hypot(g.X(m.t) - x, g.Y(m.p) - y) < 13) return m; } return null; }
  showTip(m) {
    if (!this.tip || this.o.mini) return; const g = this.geo(); const h = this.hover; if (!h) return this.hideTip();
    let html, x, y;
    if (m) { html = `<b>${esc(m.label)}</b><br><span class="dim">${dstamp(m.t)} · ${fmtPx(m.p)}</span>${m.sub ? '<br><span class="muted">' + esc(m.sub) + '</span>' : ''}`; x = g.X(m.t); y = g.Y(m.p) - 8; }
    else { const mc = TOK[this.o.sym].supply ? h.p * (TOK[this.o.sym].real ? TOK[this.o.sym].mcap / TOK[this.o.sym].px : TOK[this.o.sym].supply) : null; html = `<b>${fmtPx(h.p)}</b>${mc ? ' <span class="dim">· MC ' + fmtUsdC(mc) + '</span>' : ''}<br><span class="dim">${dstamp(h.t)}</span>`; x = g.X(h.t); y = g.Y(h.p) - 8; }
    this.tip.innerHTML = html; this.tip.style.left = clamp(x, 90, this.w - 90) + 'px'; this.tip.style.top = Math.max(40, y) + 'px'; this.tip.classList.add('on');
  }
  hideTip() { this.tip && this.tip.classList.remove('on'); }
  draw() {
    const c = this.x; if (!c || !TOK[this.o.sym]) return; const g = this.geo(); const { P, W, Hh, X, Y } = g; const mini = this.o.mini;
    c.clearRect(0, 0, this.w, this.h);
    const prog = S.rm ? 1 : clamp((performance.now() - this.t0) / 750, 0, 1); const ease = 1 - Math.pow(1 - prog, 3);
    const pts = g.pts; if (pts.length < 2) return;
    const first = priceAt(this.o.sym, g.t0), last = pts[pts.length - 1].p; const upc = last >= first;
    const col = upc ? '#3CDDA0' : '#FF6B62', cola = upc ? 'rgba(60,221,160,' : 'rgba(255,107,98,';
    c.font = '11px "Geist Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    if (!mini) {
      c.strokeStyle = 'rgba(255,240,220,.06)'; c.lineWidth = 1; c.fillStyle = 'rgba(171,164,151,.85)'; c.textAlign = 'left';
      for (let i = 0; i <= 4; i++) { const y = P.t + Hh * i / 4; c.beginPath(); c.moveTo(P.l, Math.round(y) + .5); c.lineTo(P.l + W, Math.round(y) + .5); c.stroke(); c.fillText(fmtPx(g.Pof(y), false), P.l + W + 10, y); }
      c.textAlign = 'center'; c.textBaseline = 'alphabetic'; const span = g.t1 - g.t0;
      for (let i = 0; i <= 4; i++) { const t = g.t0 + span * (i + 0.5) / 5; const d = new Date(t); const day = d.getDate() + ' ' + MON[d.getMonth()]; const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); const lab = span > 5 * D ? day : span > 20 * H ? day + ' ' + pad2(d.getHours()) + ':00' : hm; c.fillText(lab, X(t), this.h - 8); }
    }
    c.save(); c.beginPath(); c.rect(0, 0, P.l + W * ease + 1, this.h); c.clip();
    const ph = this.o.playhead;
    if (this.o.type === 'candles' && !mini) {
      const nC = clamp(Math.floor(W / 9), 20, 120); const bw = (g.t1 - g.t0) / nC; const cw = Math.max(2, W / nC * 0.62);
      for (let k = 0; k < nC; k++) {
        const a = g.t0 + k * bw, b = a + bw; let o = priceAt(this.o.sym, a), cl = priceAt(this.o.sym, b), hi = Math.max(o, cl), lo = Math.min(o, cl);
        for (const p of pts) if (p.t >= a && p.t < b) { hi = Math.max(hi, p.p); lo = Math.min(lo, p.p); }
        if (b > pts[pts.length - 1].t + bw) break;
        const x = X(a + bw / 2), up = cl >= o; const fut = ph != null && a > ph;
        c.globalAlpha = fut ? .25 : 1; c.strokeStyle = c.fillStyle = up ? '#3CDDA0' : '#FF6B62';
        c.beginPath(); c.moveTo(x, Y(hi)); c.lineTo(x, Y(lo)); c.lineWidth = 1; c.stroke();
        const y1 = Y(Math.max(o, cl)), y2 = Y(Math.min(o, cl)); c.fillRect(x - cw / 2, y1, cw, Math.max(1.2, y2 - y1));
      }
      c.globalAlpha = 1;
    } else {
      const step = Math.max(1, Math.floor(pts.length / (W * 1.2)));
      const path = new Path2D(); let started = false, lx = 0;
      for (let i = 0; i < pts.length; i += step) { const p = pts[i]; const x = X(p.t), y = Y(p.p); if (!started) { path.moveTo(x, y); started = true; } else path.lineTo(x, y); lx = x; }
      const lp = pts[pts.length - 1]; path.lineTo(X(lp.t), Y(lp.p)); lx = X(lp.t);
      const area = new Path2D(path); area.lineTo(lx, P.t + Hh); area.lineTo(X(pts[0].t), P.t + Hh); area.closePath();
      const gr = c.createLinearGradient(0, P.t, 0, P.t + Hh); gr.addColorStop(0, cola + (mini ? '.30)' : '.22)')); gr.addColorStop(1, cola + '0)');
      c.fillStyle = gr; c.fill(area);
      c.strokeStyle = col; c.lineWidth = mini ? 1.8 : 2; c.shadowColor = cola + '.55)'; c.shadowBlur = mini ? 6 : 10; c.stroke(path); c.shadowBlur = 0;
    }
    if (ph != null) { const x = X(ph); c.fillStyle = 'rgba(11,10,9,.62)'; c.fillRect(x, 0, P.l + W - x + (mini ? 6 : 0), this.h); }
    c.restore();
    if (this.o.entry) {
      const y = Y(this.o.entry.p); if (y > P.t - 4 && y < P.t + Hh + 4) {
        c.setLineDash([4, 4]); c.strokeStyle = 'rgba(245,241,234,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(P.l, y); c.lineTo(P.l + W, y); c.stroke(); c.setLineDash([]);
        if (!mini) { const lab = this.o.entry.label || 'Entry'; c.font = '600 10.5px Geist, system-ui, sans-serif'; const tw = c.measureText(lab).width + 12; c.fillStyle = 'rgba(245,241,234,.9)'; this.rr(P.l + 6, y - 9, tw, 18, 6); c.fill(); c.fillStyle = '#0B0A09'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(lab, P.l + 12, y + .5); }
      }
    }
    for (const m of this.o.markers) {
      if (m.t < g.t0 || m.t > g.t1) continue; const x = X(m.t), y = Y(m.p); if (x > P.l + W * ease + 2) continue;
      const fut = ph != null && m.t > ph; c.globalAlpha = fut ? .3 : 1; const r = mini ? 6 : 9.5; const rc = KIND_HEX[m.kind] || '#F5F1EA';
      if (m.img) { const im = imgOf(m.img); c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip(); if (im.complete && im.naturalWidth) c.drawImage(im, x - r, y - r, r * 2, r * 2); else { c.fillStyle = '#23201C'; c.fill(); } c.restore(); }
      else { c.beginPath(); c.arc(x, y, r * .55, 0, Math.PI * 2); c.fillStyle = rc; c.fill(); }
      c.lineWidth = 2.2; c.strokeStyle = rc; if (m.conf === 'inferred' || m.kind === 'transfer') c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, r + 1.5, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      if (m.cur) { c.strokeStyle = 'rgba(255,59,71,.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r + 6, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = 1;
    }
    if (ph != null) { const x = X(ph); c.strokeStyle = '#FF3B47'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, P.t - 6); c.lineTo(x, P.t + Hh + 2); c.stroke(); c.fillStyle = '#FF3B47'; c.beginPath(); c.arc(x, P.t - 6, 4, 0, Math.PI * 2); c.fill(); }
    if (!mini) {
      const lp = pts[pts.length - 1]; const lxp = X(Math.min(lp.t, g.t1)), lyp = Y(lp.p);
      if (ph == null && ease >= 1) { c.fillStyle = col; c.beginPath(); c.arc(lxp, lyp, 3.5, 0, Math.PI * 2); c.fill(); const pr = (performance.now() % 1600) / 1600; if (!S.rm) { c.strokeStyle = cola + (0.6 * (1 - pr)) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(lxp, lyp, 3.5 + pr * 9, 0, Math.PI * 2); c.stroke(); } }
      c.font = '600 11px "Geist Mono", ui-monospace, monospace'; const lab = fmtPx(lp.p, false); const tw = c.measureText(lab).width + 12; c.fillStyle = col; this.rr(P.l + W + 4, lyp - 10, tw, 20, 6); c.fill(); c.fillStyle = '#0B0A09'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(lab, P.l + W + 10, lyp + .5);
      const h = this.hover; if (h && !this.drag) {
        const hx = X(h.t), hy = Y(h.p); c.setLineDash([3, 4]); c.strokeStyle = 'rgba(245,241,234,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, P.t); c.lineTo(hx, P.t + Hh); c.moveTo(P.l, hy); c.lineTo(P.l + W, hy); c.stroke(); c.setLineDash([]);
        const hl = fmtPx(h.p, false); const hw = c.measureText(hl).width + 12; c.fillStyle = '#F5F1EA'; this.rr(P.l + W + 4, hy - 10, hw, 20, 6); c.fill(); c.fillStyle = '#0B0A09'; c.fillText(hl, P.l + W + 10, hy + .5);
      }
    }
  }
  rr(x, y, w, h, r) { const c = this.x; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
}
// keep pulse alive on visible charts
setInterval(() => { if (!S.rm && !document.hidden) CHARTS.forEach(c => { if (!c.o.mini && c.o.playhead == null) c.draw(); }); }, 120);

function sparkSVG(sym, w = 72, h = 24, hours = 168) {
  const now = TOK[sym].series[TOK[sym].series.length - 1].t; const t0 = Math.max(TOK[sym].series[0].t, now - hours * H); const n = 36; const vals = [];
  for (let i = 0; i <= n; i++) vals.push(priceAt(sym, t0 + (now - t0) * i / n));
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = (hi - lo) || 1; const up = vals[n] >= vals[0];
  const d = vals.map((v, i) => (i ? 'L' : 'M') + (i / n * w).toFixed(1) + ' ' + (2 + (1 - (v - lo) / sp) * (h - 4)).toFixed(1)).join('');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${up ? '#3CDDA0' : '#FF6B62'}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ---------- state ----------
const S = {
  route: { v: 'discover' }, rm: false, net: 'normal',
  guest: true, acct: null,
  policy: { ...DEFAULT_POLICY },
  follows: new Set(DEFAULT_FOLLOWS), saved: new Set(), watch: new Set(['MOTH', 'BONK', 'WIF']), paper: [], cases: [], myIdeas: [],
  profile: { handle: 'you', wallets: [] },
  feed: [], newQ: [], notes: [], seenNotes: 0,
  ui: { disc: 'feed', tl: 'trending', filters: {}, lbStyle: 'swing', lbMetric: 'paper30', research: 'paper', port: 'positions', fol: 'all', tokTab: 'ideas', compare: ['marginalia', 'kestrel', 'tidewatcher'], dockOpen: false, tf: {}, ctype: 'line' },
  ticket: null, session: { orders: [] },
  sync: 'device',
};
const ACCT_KEYS = ['policy', 'account', 'research', 'social'];
function snapshotDoc(name) {
  if (name === 'policy') return { ...S.policy };
  if (name === 'account') return { guest: S.guest, acct: S.acct };
  if (name === 'research') return { follows: [...S.follows], saved: [...S.saved], watch: [...S.watch], paper: S.paper };
  if (name === 'social') return { profile: S.profile, myIdeas: S.myIdeas, cases: S.cases };
}
function applyDoc(name, d) {
  if (!d) return;
  if (name === 'policy') S.policy = { ...DEFAULT_POLICY, ...d };
  if (name === 'account') { S.guest = d.guest !== false && !d.acct; S.acct = d.acct || null; }
  if (name === 'research') { if (d.follows) S.follows = new Set(d.follows); if (d.saved) S.saved = new Set(d.saved); if (d.watch) S.watch = new Set(d.watch); if (d.paper) S.paper = d.paper; }
  if (name === 'social') { if (d.profile) S.profile = d.profile; if (d.myIdeas) S.myIdeas = d.myIdeas; if (d.cases) S.cases = d.cases; }
}
const Persist = {
  db: null, uid: null, q: {}, busy: {}, last: {},
  async init() {
    for (const k of ACCT_KEYS) applyDoc(k, store.get(k));
    const prefs = store.get('prefs'); if (prefs) { S.rm = !!prefs.rm; S.net = prefs.net || 'normal'; S.ui.ctype = prefs.ctype || 'line'; }
    try {
      if (!window.claude?.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return; const id = await user.id(); if (!id) return;
      this.db = db; this.uid = id;
      let got = false;
      const timer = setTimeout(() => { if (!got) toast('Your account data is taking a while to load. Changes are saved on this device for now.'); }, 10000);
      for (const k of ACCT_KEYS) {
        this.ref(k).onSnapshot(snap => {
          got = true; clearTimeout(timer); S.sync = 'account';
          if (snap.metadata?.hasPendingWrites) return;
          const d = snap.exists ? snap.data() : null; if (!d) { if (!snap.metadata?.fromCache) this.save(k); return; }
          const j = JSON.stringify(d); if (this.last[k] === j) return; const firstLoad = this.last[k] === undefined; this.last[k] = j;
          const before = k === 'policy' ? JSON.stringify(S.policy) : null;
          applyDoc(k, JSON.parse(j)); store.set(k, JSON.parse(j));
          if (k === 'policy' && !firstLoad && before !== JSON.stringify(S.policy)) toast('Execution policy updated from another device');
          scheduleRender();
        }, () => { S.sync = 'device'; scheduleRender(); });
      }
    } catch (e) { console.warn('db unavailable', e); }
  },
  ref(k) { return this.db.doc(`data/users/${this.uid}/${k}`); },
  save(k) {
    const d = snapshotDoc(k); store.set(k, d);
    if (!this.db) return; clearTimeout(this.q[k]);
    this.q[k] = setTimeout(async () => {
      if (this.busy[k]) { this.q[k] = setTimeout(() => this.save(k), 400); return; }
      this.busy[k] = true; const body = JSON.parse(JSON.stringify(snapshotDoc(k))); this.last[k] = JSON.stringify(body);
      try { await this.ref(k).set(body); S.sync = 'account'; }
      catch (e) { if (e?.code === 'invalid_argument' || e?.code === 'not_granted') { S.sync = 'device'; } console.warn('save failed', k, e); }
      finally { this.busy[k] = false; }
    }, 450);
  },
};
function savePrefs() { store.set('prefs', { ...(store.get('prefs') || {}), rm: S.rm, net: S.net, ctype: S.ui.ctype }); }
function durShort(ms) { const s = ms / 1000; if (s < 60) return Math.round(s) + ' s'; const m = s / 60; if (m < 60) return Math.round(m) + ' min'; const h = m / 60; if (h < 48) return (h < 10 ? +h.toFixed(1) : Math.round(h)) + ' h'; return Math.round(h / 24) + ' days'; }

// ---------- toasts, layers ----------
function toast(msg, action) {
  const box = $('#toasts'); if (!box) return; const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span>${msg}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, action ? 6500 : 4200);
}
const layer = () => $('#layer');
let layerStack = [];
function closeLayer() { const top = layerStack.pop(); if (top) { top.forEach(n => n.remove()); top.onClose && top.onClose(); } if (!layerStack.length) document.body.style.overflow = ''; }
function closeAll() { while (layerStack.length) closeLayer(); }
function pushLayer(nodes) { layerStack.push(nodes); document.body.style.overflow = 'hidden'; }
function openModal(html, { wide = false, onMount } = {}) {
  const back = document.createElement('div'); back.className = 'layer-back'; const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="mc ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  back.onclick = () => closeLayer(); layer().append(back, m); const nodes = [back, m]; pushLayer(nodes);
  m.addEventListener('click', e => { if (e.target === m) closeLayer(); });
  onMount && onMount(m.firstElementChild); const f = m.querySelector('input,button:not(.xbtn)'); f && setTimeout(() => f.focus({ preventScroll: true }), 30);
  return m.firstElementChild;
}
function openSide(html, onMount) {
  const back = document.createElement('div'); back.className = 'layer-back'; const s = document.createElement('aside'); s.className = 'side'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
  s.innerHTML = html; back.onclick = () => closeLayer(); layer().append(back, s); pushLayer([back, s]); onMount && onMount(s); return s;
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch { toast('Select the text and copy it manually'); } ta.remove(); } }

// ---------- small render helpers ----------
const logo = (sym, size = 34, badge = true) => { const t = TOK[sym]; return `<span class="lg-wrap" style="width:${size}px;height:${size}px"><img class="lg" style="width:${size}px;height:${size}px" src="${t.logo}" alt="" loading="lazy">${t.demo && badge && size >= 30 ? '<span class="demo">demo</span>' : ''}</span>`; };
const av = (h, size = 36) => `<img class="av" src="${CR[h] ? CR[h].av : avatarSVG(h)}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px">`;
const vchk = `<span class="vchk" title="Signed wallet control">${I.check}</span>`;
const tokchip = sym => `<button class="tokchip" data-act="token" data-sym="${sym}" type="button"><img src="${TOK[sym].logo}" alt="">$${sym}</button>`;
const pct = (v, d = 1) => `<span class="${cls(v)} num">${fmtPct(v, d)}</span>`;
function dataNote() { return S.live ? 'Live prices' : `Real tokens: CoinGecko snapshot, ${dstamp(SNAP_TS)}`; }
