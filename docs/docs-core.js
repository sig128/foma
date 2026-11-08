// ---------- utilities ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const store = {
  get(k, d) { try { const v = localStorage.getItem('foma.docs.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('foma.docs.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (n, r = Math.random) => { let s = ''; for (let i = 0; i < n; i++) s += B58[Math.floor(r() * 58)]; return s; };
const short = (s, a = 4, b = 4) => s.length > a + b + 1 ? s.slice(0, a) + '…' + s.slice(-b) : s;
const MINUS = '\u2212';
const fmtUsd = (v, d = 2) => (v < 0 ? MINUS + '$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtK = v => { const a = Math.abs(v); const s = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(a)); return (v < 0 ? MINUS : '') + '$' + s; };
const fmtSigned = (v, d = 2) => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(d) + '%';
const pct = (v, d = 2) => v.toFixed(d) + '%';
const fmtQty = v => Math.round(v).toLocaleString('en-US');
const fmtQtyS = v => v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v));
function fmtDur(sec) {
  if (sec < 60) return Math.round(sec) + ' s';
  if (sec < 3600) return Math.round(sec / 60) + ' min';
  if (sec < 86400) { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h + ' h' + (m ? ' ' + m + ' min' : ''); }
  const d = Math.floor(sec / 86400), h = Math.round((sec % 86400) / 3600); return d + ' d' + (h ? ' ' + h + ' h' : '');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fall through */ }
  try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
}
let toastT = 0;
function toast(msg) {
  $('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2200);
}
// page-scoped timers and observers, cleared on every navigation
const SCOPE = { timers: [], ros: [], ios: [] };
const later = (fn, ms) => { const id = setTimeout(fn, ms); SCOPE.timers.push(id); return id; };
const every = (fn, ms) => { const id = setInterval(fn, ms); SCOPE.timers.push(id); return id; };
function clearScope() { SCOPE.timers.forEach(id => { clearTimeout(id); clearInterval(id); }); SCOPE.timers = []; SCOPE.ros.forEach(r => r.disconnect()); SCOPE.ros = []; SCOPE.ios.forEach(o => o.disconnect()); SCOPE.ios = []; }
function onWidth(el, fn) {
  let w = 0; const run = () => { const cs = getComputedStyle(el); const nw = Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); if (nw > 0 && nw !== w) { w = nw; fn(nw); } };
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => requestAnimationFrame(run)); ro.observe(el); SCOPE.ros.push(ro); }
  requestAnimationFrame(run);
}
function onVisible(el, fn) {
  if (typeof IntersectionObserver !== 'function') { fn(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: 0.35 }); io.observe(el); SCOPE.ios.push(io);
}
function tween(el, to, fmt, ms = 650) {
  if (!el) return; const from = el._v ?? to; el._v = to; const tok = (el._tok = (el._tok || 0) + 1);
  if (RM || from === to || !isFinite(from)) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => { if (el._tok !== tok) return; const t = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - t, 3); el.textContent = fmt(from + (to - from) * e); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ---------- icons ----------
const ic = (p, f) => `<svg viewBox="0 0 24 24" fill="${f ? 'currentColor' : 'none'}" stroke="${f ? 'none' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chev: ic('<path d="m9 6 6 6-6 6"/>'),
  chevd: ic('<path d="m6 9 6 6 6-6"/>'),
  ext: ic('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  copy: ic('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
  check: ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  hash: ic('<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>'),
  info: ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  warn: ic('<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>'),
  shield: ic('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  receipt: ic('<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  sliders: ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  refresh: ic('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  lock: ic('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  coin: ic('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
  pen: ic('<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3.5 3.5"/>'),
  trophy: ic('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4v3h-4z"/>'),
  profile: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>'),
  portfolio: ic('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2M3 10h18M7 6V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V6"/>'),
  research: ic('<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/>'),
  eye: ic('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  globe: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"/>'),
  spark: ic('<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15c.3 1.8 1 2.6 2.5 3-1.6.4-2.2 1.1-2.5 3-.3-1.9-1-2.6-2.5-3 1.6-.4 2.2-1.2 2.5-3z"/>'),
  bolt: ic('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
  flag: ic('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  doc: ic('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  book: ic('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>'),
  swap: ic('<path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>'),
  link: ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  play: ic('<path d="M8 5.5v13l10.5-6.5z"/>', true),
  pause: ic('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  wallet: ic('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h.01"/>'),
  bars: ic('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
  gauge: ic('<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>'),
  home: ic('<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  msg: ic('<path d="M4 5h16v11H9l-5 4z"/>'),
  cal: ic('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
  db: ic('<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>'),
  send: ic('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>'),
  star: ic('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>'),
  arrowR: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  arrowL: ic('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  down: ic('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  transfer: ic('<path d="M4 12h13M13 7l5 5-5 5"/><path d="M4 7v10" opacity=".5"/>'),
  md: ic('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6 15V9l2.5 3L11 9v6M15.5 9v6M13.5 13l2 2 2-2"/>'),
};
const MARK = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(50 50) scale(.95) translate(-57.01 -46.39) rotate(45 50 55)" ><path fill="var(--lime)" d="M8 36V56A42 42 0 0 0 92 56V30L62 36V56A12 12 0 0 1 38 56V30Z"/><path fill="var(--silver)" d="M8 30L38 24V17Q38 12 33 12H13Q8 12 8 17Z"/><path fill="var(--silver)" d="M62 30L92 24V17Q92 12 87 12H67Q62 12 62 17Z"/></g></svg>`;
const PAGE_ICON = { welcome: 'home', quickstart: 'bolt', accounts: 'wallet', ideas: 'pen', evidence: 'link', disclosures: 'eye', outcomes: 'bars', 'execution-policy': 'sliders', quotes: 'gauge', 'order-states': 'refresh', 'read-receipts': 'receipt', fees: 'coin', portfolio: 'portfolio', 'trader-records': 'profile', leaderboards: 'trophy', 'paper-tracking': 'research', methodology: 'doc', posting: 'send', earning: 'star', rules: 'flag', security: 'shield', 'ai-assistants': 'spark', transparency: 'globe', 'data-sources': 'db', glossary: 'book', faq: 'msg', changelog: 'cal' };
const SECTION_ICON = { 'Getting started': 'bolt', 'Ideas and receipts': 'receipt', Trading: 'swap', Portfolio: 'portfolio', 'Records and rankings': 'trophy', Creators: 'pen', 'Trust and safety': 'shield', Transparency: 'eye', Reference: 'book' };
const pic = id => I[PAGE_ICON[id]] || I.doc;

// ---------- the prototype's quote model (same formulas as the app) ----------
const SOL_PX = 88.92, FEE_RATE = 0.004, BASE_LAM = 5000, ATA_SOL = 0.00203928;
function quote({ px = 1, depth, usd, tax = 0, ata = true, micro = 24000, cu = 200000, slip = 1 }) {
  const prioLam = Math.round(cu * micro / 1e6); const netSol = (BASE_LAM + prioLam) / 1e9; const netUsd = netSol * SOL_PX;
  const ataSol = ata ? ATA_SOL : 0; const ataUsd = ataSol * SOL_PX;
  const imp = usd / (usd + depth); const feeUsd = usd * FEE_RATE; const swapIn = Math.max(0, usd - feeUsd - netUsd - ataUsd);
  const execPx = px * (1 + imp); const gross = swapIn / execPx; const out = gross * (1 - tax); const taxUsd = gross * tax * px;
  return { px, imp, cu, micro, prioLam, netSol, netUsd, ataSol, ataUsd, feeUsd, swapIn, execPx, gross, out, taxUsd, minOut: out * (1 - slip / 100), totalFees: feeUsd + netUsd + taxUsd, impUsd: swapIn - swapIn / (1 + imp) };
}
// smooth keyframe interpolation and gentle deterministic wobble for illustrative price paths
function interp(keys, x) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [x0, y0] = keys[i - 1], [x1, y1] = keys[i]; const t = (x - x0) / (x1 - x0); const s = t * t * (3 - 2 * t); return y0 + (y1 - y0) * s; }
  return keys[keys.length - 1][1];
}
const wobble = (x, a) => 1 + a * (0.55 * Math.sin(x * 7.3 + 1.2) + 0.3 * Math.sin(x * 17.1 + 0.4) + 0.15 * Math.sin(x * 41.7 + 2.2));

// ---------- markdown dialect ----------
function parseDocs(src) {
  const pages = []; let cur = null;
  for (const line of src.replace(/\r/g, '').split('\n')) {
    const m = line.match(/^@page\s+([\w-]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$/);
    if (m) { cur = { id: m[1], title: m[2], section: m[3], time: m[4], lede: '', lines: [] }; pages.push(cur); continue; }
    if (!cur) continue;
    if (!cur.lede && !cur.lines.some(l => l.trim()) && /^>\s?/.test(line)) { cur.lede = line.replace(/^>\s?/, '').trim(); continue; }
    cur.lines.push(line);
  }
  pages.forEach(p => { while (p.lines.length && !p.lines[p.lines.length - 1].trim()) p.lines.pop(); });
  return pages;
}
const GLOSS_RE = /^[^|\s@:?>#`-][^|]*?\s::\s/;
const START_RE = /^(#{2,3}\s|[-*]\s|\d+\.\s|\||```|:::|@@|\?\?\?\s|>\s?)/;
function parseBlocks(lines) {
  const out = []; let i = 0;
  const isStart = l => START_RE.test(l) || GLOSS_RE.test(l);
  while (i < lines.length) {
    const l = lines[i]; let m;
    if (!l.trim()) { i++; continue; }
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { out.push({ t: 'h', lvl: m[1].length, text: m[2].trim() }); i++; continue; }
    if (l.startsWith('```')) { const lang = l.slice(3).trim(); const buf = []; i++; while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]); i++; out.push({ t: 'code', lang, text: buf.join('\n') }); continue; }
    if ((m = l.match(/^:::(\w+)\s*(.*)$/))) {
      const kind = m[1], title = m[2].trim(); const buf = []; i++;
      while (i < lines.length && lines[i].trim() !== ':::') buf.push(lines[i++]); i++;
      if (kind === 'steps') { const items = []; buf.forEach(b => { if (/^\d+\.\s/.test(b)) items.push(b.replace(/^\d+\.\s+/, '')); else if (b.trim() && items.length) items[items.length - 1] += ' ' + b.trim(); }); out.push({ t: 'steps', items }); }
      else out.push({ t: 'callout', kind, title, text: buf.filter(x => x.trim()).join(' ') });
      continue;
    }
    if ((m = l.match(/^@@([\w-]+)(?::(.*))?\s*$/))) { out.push({ t: 'w', name: m[1], arg: (m[2] || '').trim() }); i++; continue; }
    if (l.startsWith('|')) { const buf = []; while (i < lines.length && lines[i].startsWith('|')) buf.push(lines[i++]); out.push({ t: 'table', rows: buf }); continue; }
    if (/^[-*]\s/.test(l)) { const buf = []; while (i < lines.length && /^[-*]\s/.test(lines[i])) buf.push(lines[i++].replace(/^[-*]\s+/, '')); out.push({ t: 'ul', items: buf }); continue; }
    if (/^\d+\.\s/.test(l)) { const buf = []; while (i < lines.length && /^\d+\.\s/.test(lines[i])) buf.push(lines[i++].replace(/^\d+\.\s+/, '')); out.push({ t: 'ol', items: buf }); continue; }
    if (/^\?\?\?\s/.test(l)) { const q = l.replace(/^\?\?\?\s+/, '').trim(); const buf = []; i++; while (i < lines.length && lines[i].trim() && !isStart(lines[i])) buf.push(lines[i++]); out.push({ t: 'faq', q, a: buf.join(' ') }); continue; }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push({ t: 'quote', text: buf.join(' ') }); continue; }
    if (GLOSS_RE.test(l)) { const items = []; while (i < lines.length && GLOSS_RE.test(lines[i])) { const s = lines[i++]; const k = s.indexOf(' :: '); items.push({ term: s.slice(0, k).trim(), def: s.slice(k + 4).trim() }); } out.push({ t: 'gloss', items }); continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !isStart(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(l); i++; }
    out.push({ t: 'p', text: buf.join(' ') });
  }
  return out;
}
const smart = s => s.replace(/(^|[\s([{])"/g, '$1\u201C').replace(/"/g, '\u201D').replace(/(^|[\s([{])'/g, '$1\u2018').replace(/'/g, '\u2019');
function inline(s) {
  return String(s).split(/(`[^`]+`)/g).map(p => {
    if (p.length > 1 && p.startsWith('`') && p.endsWith('`')) return `<code>${esc(p.slice(1, -1))}</code>`;
    let h = esc(smart(p));
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, href) => href.startsWith('#') ? `<a class="ilink" href="${href}">${t}</a>` : /^https:\/\//.test(href) ? `<a class="xlink" href="${href}" target="_blank" rel="noopener noreferrer">${t}${I.ext}</a>` : t);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
    return h;
  }).join('');
}
const plain = s => String(s).replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
const slug = s => plain(s).toLowerCase().replace(/['’‘"“”]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'section';
function tableHTML(rows) {
  const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const sep = rows[1] && /^\|?[\s:|-]+\|?$/.test(rows[1].trim());
  const head = cells(rows[0]); const body = rows.slice(sep ? 2 : 1).map(cells);
  return `<div class="twrap"><table><thead><tr>${head.map(h => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function hlJSON(src) {
  let out = '', last = 0, m; const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|([{}[\],:])/g;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += m[2] ? `<span class="k">${esc(m[1])}</span>${esc(m[2])}` : `<span class="s">${esc(m[1])}</span>`;
    else if (m[3]) out += `<span class="n">${m[3]}</span>`; else out += `<span class="p">${esc(m[4])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}
const CALL_IC = { note: I.info, safety: I.warn, principle: I.shield, proto: I.spark };
const CALL_LABEL = { note: 'Note', safety: 'Safety', principle: 'Principle', proto: 'Prototype' };

// renders one page body; widgets come from the W registry defined later
function renderBody(page) {
  const used = new Set(); const heads = [];
  const uid = s => { const b = page.id + '--' + slug(s); let k = b, n = 2; while (used.has(k)) k = b + '-' + n++; used.add(k); return k; };
  const html = parseBlocks(page.lines).map(b => {
    switch (b.t) {
      case 'h': { const id = uid(b.text); heads.push({ id, lvl: b.lvl, text: plain(b.text) }); return `<h${b.lvl} id="${id}"><a class="anc" href="#${id}" aria-label="Link to ${esc(plain(b.text))}">${I.hash}</a>${inline(b.text)}</h${b.lvl}>`; }
      case 'p': return `<p>${inline(b.text)}</p>`;
      case 'quote': return `<blockquote>${inline(b.text)}</blockquote>`;
      case 'ul': return `<ul>${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
      case 'steps': return `<ol class="steps reveal">${b.items.map(x => `<li><span>${inline(x)}</span></li>`).join('')}</ol>`;
      case 'table': return tableHTML(b.rows);
      case 'code': return `<pre class="code" data-lang="${esc(b.lang)}">${b.lang ? `<span class="lang">${esc(b.lang)}</span>` : ''}<button class="cp" type="button" data-act="copycode" aria-label="Copy code">${I.copy}<span>Copy</span></button><code>${b.lang === 'json' ? hlJSON(b.text) : esc(b.text)}</code></pre>`;
      case 'callout': return `<div class="callout ${esc(b.kind)}" role="note"><span class="ci">${CALL_IC[b.kind] || I.info}</span><div><b class="ct">${b.title ? inline(b.title) : CALL_LABEL[b.kind] || 'Note'}</b><p>${inline(b.text)}</p></div></div>`;
      case 'w': return widgetHTML(b.name, b.arg);
      case 'faq': { const id = uid(b.q); heads.push({ id, lvl: 2, text: plain(b.q) }); return `<details class="faq" id="${id}"><summary>${inline(b.q)}<i aria-hidden="true"></i></summary><div class="fa">${inline(b.a)}</div></details>`; }
      case 'gloss': return `<div class="gfilter"><span>${I.search}</span><input class="input" type="search" placeholder="Filter ${b.items.length} terms" aria-label="Filter terms" data-act="gfilter"></div><dl class="gloss">${b.items.map(g => `<div id="${uid(g.term)}" data-term="${esc(g.term.toLowerCase())}"><dt>${inline(g.term)}</dt><dd>${inline(g.def)}</dd></div>`).join('')}</dl><p class="gnone" hidden>No terms match.</p>`;
      default: return '';
    }
  }).join('');
  return { html, heads };
}
