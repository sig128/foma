// ---------- widget registry ----------
const W = {};
function widgetHTML(name, arg) {
  if (name === 'cards') return cardsHTML(arg.split(',').map(s => s.trim()).filter(Boolean));
  if (name === 'principles') return principlesHTML();
  const w = W[name]; if (!w) return '';
  return `<section class="play reveal" data-w="${name}" aria-label="${esc(w.title)}"><div class="play-h"><span class="tag">${esc(w.tag || 'Try it')}</span><b>${esc(w.title)}</b><span class="grow"></span>${w.reset ? `<button class="btn sm ghost" type="button" data-wreset>${I.refresh}<span>Reset</span></button>` : ''}</div><div class="play-b">${w.html()}</div>${w.foot ? `<div class="play-f">${w.foot}</div>` : ''}</section>`;
}
function mountWidgets(root) {
  $$('.play[data-w]', root).forEach(el => { const w = W[el.dataset.w]; if (!w?.mount) return; try { w.mount(el.querySelector('.play-b'), el); } catch (e) { console.error('widget', el.dataset.w, e); } });
  $$('input[type=range]', root).forEach(rangeFill);
}
function rangeFill(r) { const min = +r.min || 0, max = +r.max || 100; r.style.setProperty('--p', ((+r.value - min) / (max - min) * 100) + '%'); }
const segHTML = (g, opts, cur) => `<div class="seg" role="radiogroup" data-g="${g}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
function segSet(root, g, v) { $$(`.seg[data-g="${g}"] button`, root).forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
const onWReset = (el, fn) => el.querySelector('[data-wreset]')?.addEventListener('click', fn);
const smallUsd = v => v > 0 && v < 0.01 ? '<$0.01' : fmtUsd(v);

function cardsHTML(ids) {
  return `<div class="cards reveal">${ids.map(id => { const p = PAGE[id]; if (!p) return ''; return `<a class="pcard" href="#${id}"><span class="pi">${pic(id)}</span><b>${esc(p.title)}</b><span>${inline(p.lede)}</span><span class="go">${I.arrowR}</span></a>`; }).join('')}</div>`;
}
const PRINCIPLES = [
  ['receipt', 'Every order ends in a receipt', 'The quote, the fill and every cost, printed for confirmed, failed and expired orders alike.'],
  ['link', 'Evidence says how it’s known', 'Verified, inferred and self-reported facts never look the same.'],
  ['sliders', 'Your limits guard every button', 'One execution policy is checked before anything is signed, on every device.'],
  ['shield', 'Pay never touches ranking', 'No payment, subscription or placement buys a rank, a badge or a change to evidence.'],
];
const principlesHTML = () => `<div class="princ reveal">${PRINCIPLES.map(([i, t, d]) => `<div class="pr"><span class="pi">${I[i]}</span><b>${t}</b><span>${d}</span></div>`).join('')}</div>`;

// ---------- 1. execution policy playground ----------
const PP_DEF = { maxSize: 500, impact: 2.0, maxFee: 3.0, slip: 1.0 };
const PP = { ...PP_DEF };
const PP_ORDERS = [
  { sym: 'BONK', usd: 250, depth: 364803, px: 0.00000278, note: 'Deep pool' },
  { sym: 'POPCAT', usd: 300, depth: 64466, px: 0.03630823, note: 'Established pool' },
  { sym: 'MOTH', usd: 250, depth: 10200, px: 0.000296, note: '3-day-old pool' },
  { sym: 'BRINE', usd: 250, depth: 48000, px: 0.00118, tax: 0.02, note: '2% transfer fee' },
  { sym: 'WIF', usd: 650, depth: 381141, px: 0.160173, note: 'Large order' },
  { sym: 'GLINT', usd: 150, depth: 5200, px: 0.0000412, note: 'Bonding curve' },
];
const PP_F = {
  maxSize: { l: 'Maximum order size', min: 50, max: 2000, step: 50, f: v => fmtUsd(v, 0) },
  impact: { l: 'Maximum price impact', min: 0.5, max: 10, step: 0.1, f: v => v.toFixed(1) + '%' },
  maxFee: { l: 'Maximum total fees', min: 0.5, max: 10, step: 0.25, f: v => fmtUsd(v) },
  slip: { l: 'Maximum slippage', min: 0.1, max: 5, step: 0.1, f: v => v.toFixed(1) + '%' },
};
function ppEval(o) {
  const q = quote({ px: o.px, depth: o.depth, usd: o.usd, tax: o.tax || 0, ata: false, slip: PP.slip }); const fails = [];
  if (o.usd > PP.maxSize + 1e-9) fails.push(`Size ${fmtUsd(o.usd, 0)} over ${fmtUsd(PP.maxSize, 0)}`);
  if (q.imp * 100 > PP.impact + 1e-9) fails.push(`Impact ${pct(q.imp * 100)} over ${PP.impact.toFixed(1)}%`);
  if (q.totalFees > PP.maxFee + 1e-9) fails.push(`Fees ${fmtUsd(q.totalFees)} over ${fmtUsd(PP.maxFee)}`);
  return { q, fails };
}
W['policy-play'] = {
  title: 'Your limits against six orders', tag: 'Try it', reset: true,
  html: () => `<div class="fgrid">${Object.entries(PP_F).map(([k, f]) => `<label class="field"><span class="flabel">${f.l} <b data-v="${k}">${f.f(PP[k])}</b></span><input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${PP[k]}" data-k="${k}"></label>`).join('')}</div>
    <div class="pp-sum"><span class="big-out num" data-o="n">0</span><span>of ${PP_ORDERS.length} orders would go through. The rest are blocked before signing, with the limit named.</span></div>
    <div class="pp" data-o="list"></div><p class="pp-note" data-o="slip"></p>`,
  mount(b, el) {
    let prev = [];
    const draw = () => {
      let n = 0; const now = [];
      b.querySelector('[data-o=list]').innerHTML = PP_ORDERS.map((o, i) => {
        const { q, fails } = ppEval(o); const bad = fails.length > 0; now[i] = bad; if (!bad) n++;
        return `<div class="o ${bad ? 'bad' : ''} ${prev.length && prev[i] !== bad ? 'flip' : ''}"><div><b>${fmtUsd(o.usd, 0)} of ${o.sym}</b><small>${o.note} · impact ${pct(q.imp * 100)} · fees ${fmtUsd(q.totalFees)}</small></div><span class="chip ${bad ? 'dn' : 'ok'}">${bad ? I.x + esc(fails[0]) + (fails.length > 1 ? ` · +${fails.length - 1}` : '') : I.check + 'Passes'}</span></div>`;
      }).join('');
      prev = now; tween(b.querySelector('[data-o=n]'), n, v => String(Math.round(v)));
      const s = PP.slip; b.querySelector('[data-o=slip]').innerHTML = `At ${s.toFixed(1)}% slippage, a quote for 1,000,000 tokens accepts no less than <b>${fmtQty(1e6 * (1 - s / 100))}</b>. If the price moves further while the order is in flight, it fails instead of filling.`;
      Object.entries(PP_F).forEach(([k, f]) => { const v = b.querySelector(`[data-v="${k}"]`); if (v) v.textContent = f.f(PP[k]); });
    };
    b.addEventListener('input', e => { const k = e.target.dataset.k; if (!k || !(k in PP)) return; PP[k] = parseFloat(e.target.value); draw(); });
    onWReset(el, () => { Object.assign(PP, PP_DEF); $$('input[data-k]', b).forEach(r => { r.value = PP[r.dataset.k]; rangeFill(r); }); prev = []; draw(); });
    draw();
  },
};

// ---------- 2. ownership message ----------
const DEMO_ADDR = b58(44, mulberry32(hashStr('foma-docs-wallet')));
W.siws = {
  title: 'The message your wallet shows', tag: 'Live preview',
  html: () => `<div class="wal"><div class="wal-h"><span class="wal-ic">${MARK}</span><div><b>Signature request</b><small>foma.cash · Solana</small></div><span class="chip ok">${I.check}Free · can’t move funds</span></div>
    <pre class="msg" data-o="msg"></pre>
    <div class="wal-a"><button class="btn sm" type="button" data-a="nonce">${I.refresh}<span>New nonce</span></button><button class="btn sm" type="button" data-a="copy">${I.copy}<span>Copy text</span></button><span class="grow"></span><button class="btn pri sm" type="button" data-a="sign">Sign (demo)</button></div>
    <div class="sigout" data-o="sig" aria-live="polite"></div></div>`,
  mount(b) {
    let nonce = b58(12); const msgEl = b.querySelector('[data-o=msg]'), sigEl = b.querySelector('[data-o=sig]');
    const text = () => `foma.cash wants you to sign in with your Solana account:\n${DEMO_ADDR}\n\nProve control of this address for your FOMA record. This is a message, not a transaction. It can't move funds.\n\nURI: https://foma.cash\nVersion: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`;
    const draw = () => { msgEl.innerHTML = esc(text()).replace(DEMO_ADDR, `<span class="addr">${DEMO_ADDR}</span>`).replace(/^(URI|Version|Chain ID|Nonce|Issued At):/gm, '<span class="faint">$1:</span>'); };
    draw(); every(draw, 1000);
    b.addEventListener('click', async e => {
      const btn = e.target.closest('[data-a]'); if (!btn) return; const a = btn.dataset.a;
      if (a === 'nonce') { nonce = b58(12); draw(); sigEl.innerHTML = ''; }
      if (a === 'copy') toast(await copyText(text()) ? 'Message copied' : 'Copying isn’t available here');
      if (a === 'sign') {
        btn.disabled = true; sigEl.innerHTML = `<div class="sig-wait"><span class="spin"></span>Waiting for your wallet…</div>`;
        later(() => { const sig = b58(88); sigEl.innerHTML = `<div class="sig-ok">${I.check}<b>Signature checks out for ${short(DEMO_ADDR)}</b></div><code class="sigv">${short(sig, 22, 22)}</code><small>Demo only. This signature was made up on this page. Nothing was sent, and no transaction exists.</small>`; btn.disabled = false; }, 950);
      }
    });
  },
};

// ---------- 3. holdings bar ----------
const HB_STEP = [4800, 9000, 15000, 26000, 41000, 64000];
const hbNew = () => ({ inv: 1e6, add: 0, moved: 0, sold: 0, t: 0, n: 0, log: [{ c: 'ok', l: 'Posted', q: '1M MOTH captured', t: 0 }] });
let HB = hbNew();
W['holdings-bar'] = {
  title: 'Posted holding 1M MOTH', tag: 'Try it', reset: true,
  html: () => `<div class="hb"><div class="hb-top"><div class="hb-n"><span class="big-out num" data-o="pct">100%</span><span>of the posted amount still held</span></div><small class="faint" data-o="sub"></small></div>
    <div class="track" data-o="track"><i data-s="held" style="background:var(--fg)"></i><i data-s="moved" class="hatch"></i><i data-s="sold" style="background:var(--loss)"></i><span class="pmark" data-o="mark"><span>posted</span></span></div>
    <div class="legend"><span><i style="background:var(--fg)"></i>Still held</span><span><i class="hatch"></i>Moved, not sold</span><span><i style="background:var(--loss)"></i>Sold</span></div>
    <div class="hb-acts"><button class="btn sm" type="button" data-op="add">${I.plus}<span>Buy 200K more</span></button><button class="btn sm" type="button" data-op="move">${I.transfer}<span>Move 300K</span></button><button class="btn sm" type="button" data-op="sell">${I.down}<span>Sell 250K</span></button></div>
    <ol class="hb-log" data-o="log" aria-live="polite"></ol></div>`,
  mount(b, el) {
    const draw = () => {
      const h = HB, held = h.inv + h.add - h.moved - h.sold, tot = h.inv + h.add;
      tween(b.querySelector('[data-o=pct]'), held / h.inv * 100, v => Math.round(v) + '%');
      b.querySelector('[data-o=sub]').textContent = `${fmtQtyS(held)} held · ${fmtQtyS(h.moved)} moved · ${fmtQtyS(h.sold)} sold${h.add ? ' · ' + fmtQtyS(h.add) + ' bought after posting' : ''}`;
      const seg = { held, moved: h.moved, sold: h.sold }; $$('[data-s]', b).forEach(i => { i.style.flexBasis = (seg[i.dataset.s] / tot * 100) + '%'; });
      const mk = b.querySelector('[data-o=mark]'); mk.style.left = (h.inv / tot * 100) + '%'; mk.hidden = !h.add;
      b.querySelector('[data-o=log]').innerHTML = h.log.slice().reverse().slice(0, 5).map(x => `<li><span class="chip ${x.c}">${x.l}</span><span>${x.q}</span><span class="chip ok sm">Verified</span><span class="faint num">${x.t ? '+' + fmtDur(x.t) : 'at post'}</span></li>`).join('');
      b.querySelector('[data-op=move]').disabled = held < 3e5; b.querySelector('[data-op=sell]').disabled = held < 2.5e5;
    };
    b.addEventListener('click', e => {
      const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return; const h = HB; const held = h.inv + h.add - h.moved - h.sold;
      h.t += HB_STEP[h.n++ % HB_STEP.length];
      if (op === 'add') { h.add += 2e5; h.log.push({ c: 'up', l: 'Added', q: '+200K bought after posting', t: h.t }); }
      if (op === 'move' && held >= 3e5) { h.moved += 3e5; h.log.push({ c: 'wn', l: 'Moved, not sold', q: '300K sent to another wallet', t: h.t }); }
      if (op === 'sell' && held >= 2.5e5) { h.sold += 2.5e5; h.log.push({ c: 'dn', l: 'Sold, exit', q: '250K sold', t: h.t }); }
      draw();
    });
    onWReset(el, () => { HB = hbNew(); draw(); });
    draw();
  },
};

// ---------- 4. evidence graph ----------
const EVK = { verified: { c: '#3CDDA0', l: 'Verified' }, inferred: { c: '#A8ACFF', l: 'Inferred' }, self: { c: '#F4BB4E', l: 'Self-reported' }, none: { c: '#777064', l: 'Pool' } };
const EVN = {
  st: { l: '“Paid $4,000”', s: 'creator statement', k: 'self', d: 'The creator says the MOTH team paid them $4,000. It shows as their own statement, labeled as disclosed 9 hours after posting.' },
  me: { l: 'Creator', s: 'signed wallet', k: 'verified', d: 'The creator proved control of this wallet with a free message signature, so its activity is verified.' },
  a: { l: 'Wallet A', s: 'signed wallet', k: 'verified', d: 'A second wallet the creator signed for. Tokens sent here show as moved, never as sold.' },
  x: { l: 'Wallet X', s: 'unverified', k: 'inferred', d: 'Nobody has proved control of this wallet, so any link to the creator stays inferred.' },
  pool: { l: 'MOTH pool', s: 'DEX', k: 'none', d: 'The token’s trading pool. Every sale into it is visible on chain.' },
};
const EVE = [
  { a: 'st', b: 'me', k: 'self', l: 'statement', d: 'Self-reported. A disclosure in the creator’s own words. FOMA records when it was added and never presents it as verified.' },
  { a: 'me', b: 'a', k: 'verified', l: 'moved 300K', d: 'Verified. Sent between two of the creator’s signed wallets. A move never counts as a sale.', tn: 0.62 },
  { a: 'me', b: 'pool', k: 'verified', l: 'sold 660K', d: 'Verified. The creator’s signed wallet sold 660K MOTH into the pool.', tn: 0.87 },
  { a: 'me', b: 'x', k: 'inferred', l: 'same owner? 62%', d: 'Inferred, 62% confidence. Wallet X was funded from the same exchange withdrawal batch and sold 40 seconds after the creator. Neither fact is proof on its own, so the link shows its basis and can be reversed after review.', tn: 0.38 },
  { a: 'x', b: 'pool', k: 'verified', l: 'sold 120K', d: 'A verified sale by an unverified wallet. The sale is a chain fact. Who controls Wallet X is not.', tn: 0.3 },
];
const EV_L = {
  wide: { h: 300, nw: 152, nh: 48, p: { st: [0.14, 0.15], me: [0.14, 0.64], a: [0.52, 0.17], x: [0.52, 0.85], pool: [0.87, 0.52] } },
  narrow: { h: 450, nw: 128, nh: 46, p: { st: [0.5, 0.07], me: [0.5, 0.31], a: [0.22, 0.57], x: [0.78, 0.57], pool: [0.5, 0.9] } },
};
function clipRect(cx, cy, w, h, ux, uy) { const tx = ux ? (w / 2) / Math.abs(ux) : Infinity, ty = uy ? (h / 2) / Math.abs(uy) : Infinity; const t = Math.min(tx, ty); return [cx + ux * t, cy + uy * t]; }
function evSVG(Wd, sel, filt) {
  const nar = Wd < 560, L = nar ? EV_L.narrow : EV_L.wide, H = L.h, P = k => [L.p[k][0] * Wd, L.p[k][1] * H];
  const dimE = e => filt !== 'all' && filt !== e.k;
  let edges = '', labels = '', nodes = '';
  EVE.forEach((e, i) => {
    const [x1, y1] = P(e.a), [x2, y2] = P(e.b); const len = Math.hypot(x2 - x1, y2 - y1); const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const [sx, sy] = clipRect(x1, y1, L.nw + 8, L.nh + 8, ux, uy), [ex, ey] = clipRect(x2, y2, L.nw + 14, L.nh + 14, -ux, -uy);
    const c = EVK[e.k].c, on = sel === 'e' + i, dash = e.k === 'inferred' ? '7 6' : e.k === 'self' ? '2 5' : '';
    edges += `<g class="ev-e ${dimE(e) ? 'dim' : ''} ${on ? 'on' : ''}" data-sel="e${i}" tabindex="0" role="button" aria-label="${esc(EVK[e.k].l + ': ' + e.l)}"><line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="transparent" stroke-width="20"/><line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="${on ? 3 : 2}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round" ${e.k !== 'inferred' ? `marker-end="url(#evar-${e.k})"` : ''}/></g>`;
    const t = nar ? (e.tn ?? 0.5) : 0.5, mx = sx + (ex - sx) * t, my = sy + (ey - sy) * t, tw = e.l.length * 6.4 + 18;
    labels += `<g class="ev-l ${dimE(e) ? 'dim' : ''} ${on ? 'on' : ''}" data-sel="e${i}" transform="translate(${mx.toFixed(1)},${my.toFixed(1)})"><rect x="${-tw / 2}" y="-11" width="${tw}" height="22" rx="11" fill="#131210" stroke="${c}" stroke-opacity="${on ? 1 : .45}"/><text text-anchor="middle" y="4" fill="${c}" font-size="11.5" font-weight="600">${esc(e.l)}</text></g>`;
  });
  Object.entries(EVN).forEach(([k, n]) => {
    const [cx, cy] = P(k), c = EVK[n.k].c, on = sel === k; const dim = filt !== 'all' && n.k !== filt && !EVE.some(e => e.k === filt && (e.a === k || e.b === k));
    nodes += `<g class="ev-n ${dim ? 'dim' : ''} ${on ? 'on' : ''}" data-sel="${k}" tabindex="0" role="button" aria-label="${esc(n.l + ', ' + n.s)}" transform="translate(${(cx - L.nw / 2).toFixed(1)},${(cy - L.nh / 2).toFixed(1)})"><rect width="${L.nw}" height="${L.nh}" rx="13" fill="${on ? '#2E2A24' : '#1A1815'}" stroke="${n.k === 'none' ? 'rgba(255,240,220,.2)' : c}" stroke-width="${on ? 2 : 1.3}" ${n.k === 'inferred' ? 'stroke-dasharray="5 4"' : ''}/><circle cx="17" cy="${L.nh / 2}" r="4.5" fill="${c}"/><text x="30" y="${L.nh / 2 - 3}" fill="#F5F1EA" font-size="13" font-weight="600">${esc(n.l)}</text><text x="30" y="${L.nh / 2 + 12}" fill="#ABA497" font-size="11">${esc(n.s)}</text></g>`;
  });
  const markers = ['verified', 'self'].map(k => `<marker id="evar-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${EVK[k].c}"/></marker>`).join('');
  return `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="group" aria-label="Wallet evidence graph"><defs>${markers}</defs>${edges}${nodes}${labels}</svg>`;
}
W['evidence-legend'] = {
  title: 'One idea, three kinds of evidence', tag: 'Tap anything',
  html: () => `${segHTML('evf', [['all', 'All'], ['verified', 'Verified'], ['inferred', 'Inferred'], ['self', 'Self-reported']], 'all')}<div class="svgbox ev-box" data-o="g"></div><div class="ev-d" data-o="d" aria-live="polite"></div>`,
  mount(b) {
    let sel = 'e3', filt = 'all', w = 0; const box = b.querySelector('[data-o=g]');
    const detail = () => {
      const isE = sel[0] === 'e' && EVE[+sel.slice(1)], it = isE ? EVE[+sel.slice(1)] : EVN[sel]; if (!it) return;
      const k = it.k, title = isE ? `${EVN[it.a].l.replace(/[“”]/g, '')} → ${EVN[it.b].l}: ${it.l}` : `${it.l} · ${it.s}`;
      b.querySelector('[data-o=d]').innerHTML = `<span class="chip ${k === 'verified' ? 'ok' : k === 'inferred' ? 'if' : k === 'self' ? 'wn' : ''}">${EVK[k].l}</span><div><b>${esc(title)}</b><p>${esc(it.d)}</p></div>`;
    };
    const draw = () => { if (w) box.innerHTML = evSVG(w, sel, filt); detail(); };
    onWidth(box, nw => { w = nw; draw(); });
    const pick = t => { const s = t.closest('[data-sel]')?.dataset.sel; if (s) { sel = s; draw(); } };
    box.addEventListener('click', e => pick(e.target));
    box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e.target); } });
    b.querySelector('.seg').addEventListener('click', e => { const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return; filt = v; segSet(b, 'evf', v); if (v !== 'all') { const i = EVE.findIndex(x => x.k === v); if (i >= 0) sel = 'e' + i; } draw(); });
  },
};

// ---------- 5. three outcomes ----------
const TO_KEYS = [[-6, 0.55], [-4, 0.57], [-2, 0.62], [-1, 0.74], [0, 1], [0.5, 1.22], [2, 1.66], [5, 2.28], [8, 2.6], [12, 2.24], [24, 1.74], [36, 1.94], [48, 1.56], [72, 1.4], [96, 1.5], [120, 1.31], [144, 1.27], [168, 1.23]];
const toP = h => interp(TO_KEYS, h) * wobble(h * 0.9, 0.02);
const TO = (() => {
  const r = mulberry32(17); const parts = [];
  for (let i = 0; i < 38; i++) { const he = 1 + 25 * Math.pow(r(), 1.3); const open = i % 4 === 1 && parts.filter(p => p.open).length < 9; const hx = open ? 168 : he + (168 - he) * (0.15 + 0.85 * r()); parts.push({ he, hx, open, ret: toP(hx) / toP(he) * 0.985 - 1 }); }
  const rs = parts.map(p => p.ret).sort((a, b) => a - b); const med = (rs[18] + rs[19]) / 2;
  const cost = 7e5 * toP(-1) * 1.004, proceeds = 3.3e5 * toP(6) + 3.3e5 * toP(9), held = 4e4 * toP(168);
  const author = (proceeds * 0.996 + held) / cost - 1;
  const q = quote({ px: toP(0.0083), depth: 40000, usd: 250, ata: false }); const val = q.out * toP(168); const is = val / (val + 40000); const paper = (val * (1 - is) * (1 - FEE_RATE) - q.netUsd) / 250 - 1;
  return { parts, med, author, paper, open: parts.filter(p => p.open).length };
})();
function toSVG(Wd, hl) {
  const H = 210, l = 10, r = 12, t = 16, bm = 28, x = h => l + (h + 6) / 174 * (Wd - l - r), y = p => t + (1 - (p - 0.4) / 2.5) * (H - t - bm);
  let path = ''; for (let i = 0; i <= 240; i++) { const h = -6 + 174 * i / 240; path += (i ? 'L' : 'M') + x(h).toFixed(1) + ' ' + y(toP(h)).toFixed(1); }
  const g = (k, s) => `<g class="g-${k} ${hl && hl !== k ? 'dim' : ''}">${s}</g>`;
  const ticks = [[0, 'post'], [24, '1 d'], [72, '3 d'], [168, '7 d']].map(([h, lb], i, a) => `<text x="${x(h)}" y="${H - 8}" text-anchor="${i === a.length - 1 ? 'end' : 'middle'}">${lb}</text>`).join('');
  const parts = TO.parts.map(p => `<circle cx="${x(p.he).toFixed(1)}" cy="${y(toP(p.he)).toFixed(1)}" r="3.4" fill="#F4BB4E" fill-opacity=".8"/>`).join('');
  return `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Illustrative price path with the author's trades, the paper entry and participant entries">
    <line x1="${x(0)}" x2="${x(0)}" y1="${t - 6}" y2="${H - bm}" stroke="rgba(255,240,220,.2)" stroke-dasharray="3 4"/>
    <line x1="${l}" x2="${Wd - r}" y1="${y(1)}" y2="${y(1)}" stroke="rgba(255,240,220,.07)"/>
    <text x="${Wd - r}" y="${y(1) - 6}" text-anchor="end">post price</text>
    <path d="${path}" fill="none" stroke="#ABA497" stroke-width="1.8" stroke-linejoin="round"/>
    ${g('participants', parts)}
    ${g('author', `<circle cx="${x(-1)}" cy="${y(toP(-1))}" r="6" fill="#DCE0E7" stroke="#0B0A09" stroke-width="2"/><path d="M${x(6)} ${y(toP(6)) - 10}l5 8h-10z" fill="#FF6B62"/><path d="M${x(9)} ${y(toP(9)) - 10}l5 8h-10z" fill="#FF6B62"/>`)}
    ${g('paper', `<circle cx="${x(0.0083)}" cy="${y(toP(0.0083))}" r="6.5" fill="none" stroke="#A8ACFF" stroke-width="2.5"/><rect x="${x(168) - 6}" y="${y(toP(168)) - 6}" width="12" height="12" rx="2" fill="#A8ACFF"/>`)}
    ${ticks}</svg>`;
}
W['three-outcomes'] = {
  title: 'Same idea, three answers', tag: 'Illustrative',
  html: () => `<div class="svgbox to-box" data-o="c"></div>
    <div class="outs3">
      <button class="o3" type="button" data-k="author"><span class="row"><i class="dot" style="background:var(--silver)"></i><span class="tag">Author result</span></span><span class="v num ${TO.author >= 0 ? 'up' : 'dn'}">${fmtSigned(TO.author * 100, 0)}</span><p>The creator’s signed wallets: bought before posting, sold into the run. 300K moved tokens are left out.</p></button>
      <button class="o3" type="button" data-k="paper"><span class="row"><i class="dot" style="background:var(--infer)"></i><span class="tag">Paper outcome</span></span><span class="v num ${TO.paper >= 0 ? 'up' : 'dn'}">${fmtSigned(TO.paper * 100, 1)}</span><p>$250 bought 30 s after posting at an executable quote, sold after 7 days.</p></button>
      <button class="o3" type="button" data-k="participants"><span class="row"><i class="dot" style="background:var(--warn)"></i><span class="tag">Observed participants</span></span><span class="v num ${TO.med >= 0 ? 'up' : 'dn'}">${fmtSigned(TO.med * 100, 1)}</span><p>Median of 38 consenting users who traded within 24 h. ${TO.open} still open, 4 with missing data.</p></button>
    </div>`,
  mount(b) {
    let hl = null, w = 0; const box = b.querySelector('[data-o=c]'); const draw = () => { if (w) box.innerHTML = toSVG(w, hl); };
    onWidth(box, nw => { w = nw; draw(); });
    const set = k => { hl = k; $$('.o3', b).forEach(c => c.classList.toggle('on', c.dataset.k === k)); draw(); };
    $$('.o3', b).forEach(c => { c.addEventListener('mouseenter', () => set(c.dataset.k)); c.addEventListener('mouseleave', () => set(null)); c.addEventListener('focus', () => set(c.dataset.k)); c.addEventListener('blur', () => set(null)); c.addEventListener('click', () => set(hl === c.dataset.k ? null : c.dataset.k)); });
  },
};

// ---------- 6. price impact ----------
const IC_P = [
  { k: 'sol', l: 'SOL', d: 22e6, note: 'Deep pool · $22M depth' },
  { k: 'pengu', l: 'PENGU', d: 1323791, note: 'Established memecoin · $1.3M depth' },
  { k: 'moth', l: 'MOTH', d: 10200, note: '3-day-old pool · $10.2K depth' },
  { k: 'glint', l: 'GLINT', d: 5200, note: 'Bonding curve · $5.2K depth' },
];
const IC = { k: 'moth', size: 250, lim: 2.0 };
const icSize = v => 10 * Math.pow(10, v / 1000 * 4), icVal = s => Math.log10(s / 10) / 4 * 1000;
const impOf = (s, d) => s / (s + d) * 100;
function icSVG(Wd) {
  const H = 250, l = 40, r = 14, t = 14, bm = 28, YM = 25;
  const x = s => l + (Math.log10(s) - 1) / 4 * (Wd - l - r), y = p => t + (1 - p / YM) * (H - t - bm);
  const sel = IC_P.find(p => p.k === IC.k); const cur = impOf(IC.size, sel.d); const ok = cur <= IC.lim + 1e-9; const maxS = IC.lim / 100 * sel.d / (1 - IC.lim / 100);
  const curve = d => { let s = ''; for (let i = 0; i <= 140; i++) { const sz = Math.pow(10, 1 + 4 * i / 140); s += (i ? 'L' : 'M') + x(sz).toFixed(1) + ' ' + y(impOf(sz, d)).toFixed(1); } return s; };
  const gx = [10, 100, 1e3, 1e4, 1e5].map(s => `<line x1="${x(s)}" x2="${x(s)}" y1="${t}" y2="${H - bm}" stroke="rgba(255,240,220,.05)"/><text x="${x(s)}" y="${H - 9}" text-anchor="${s === 1e5 ? 'end' : s === 10 ? 'start' : 'middle'}">${fmtK(s)}</text>`).join('');
  const gy = [0, 5, 10, 15, 20, 25].map(p => `<line x1="${l}" x2="${Wd - r}" y1="${y(p)}" y2="${y(p)}" stroke="rgba(255,240,220,${p ? .05 : .12})"/><text x="${l - 8}" y="${y(p) + 4}" text-anchor="end">${p}%</text>`).join('');
  const others = IC_P.filter(p => p.k !== IC.k).map(p => `<path d="${curve(p.d)}" fill="none" stroke="#4E4940" stroke-width="1.5"/>`).join('');
  const cx = x(IC.size), cy = y(Math.min(cur, YM)), lx = x(clamp(maxS, 10, 1e5));
  const tip = `${pct(cur)} at ${fmtK(IC.size)}`, tw = tip.length * 6.6 + 18, tx = clamp(cx + 10, l, Wd - r - tw), ty = clamp(cy - 34, t, H - bm - 26);
  return `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Price impact by order size for ${sel.l}">
    <defs><clipPath id="icclip"><rect x="${l}" y="${t - 2}" width="${Wd - l - r}" height="${H - t - bm + 2}"/></clipPath></defs><rect x="${l}" y="${t}" width="${Wd - l - r}" height="${Math.max(0, y(IC.lim) - t)}" fill="rgba(255,107,98,.06)"/>${gx}${gy}<g clip-path="url(#icclip)">${others}
    <path d="${curve(sel.d)}" fill="none" stroke="#F5F1EA" stroke-width="2.6" stroke-linejoin="round"/></g>
    <line x1="${l}" x2="${Wd - r}" y1="${y(IC.lim)}" y2="${y(IC.lim)}" stroke="#FF6B62" stroke-width="1.5" stroke-dasharray="6 5"/>
    <text x="${l + 8}" y="${y(IC.lim) - 7}" fill="#FF6B62" font-weight="600">blocked above your ${IC.lim.toFixed(1)}% limit</text>
    ${maxS >= 10 && maxS <= 1e5 ? `<line x1="${lx}" x2="${lx}" y1="${y(IC.lim)}" y2="${H - bm}" stroke="rgba(255,107,98,.45)" stroke-dasharray="2 4"/>` : ''}
    <line x1="${cx}" x2="${cx}" y1="${t}" y2="${H - bm}" stroke="rgba(245,241,234,.35)" stroke-dasharray="3 4"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="${ok ? '#3CDDA0' : '#FF6B62'}" stroke="#0B0A09" stroke-width="2.5"/>
    <g transform="translate(${tx},${ty})"><rect width="${tw}" height="24" rx="8" fill="#23201C" stroke="rgba(255,240,220,.15)"/><text x="${tw / 2}" y="16" text-anchor="middle" fill="#F5F1EA" font-weight="600">${esc(tip)}</text></g></svg>`;
}
W['impact-curve'] = {
  title: 'How far your own order moves the price', tag: 'Drag the chart',
  foot: 'The prototype’s model: impact = order size ÷ (order size + pool depth). Real routes vary by pool and moment.',
  html: () => `${segHTML('icp', IC_P.map(p => [p.k, p.l]), IC.k)}<p class="ic-note faint" data-o="note"></p><div class="svgbox ic-box" data-o="c"></div>
    <div class="fgrid"><label class="field"><span class="flabel">Order size <b data-o="sz"></b></span><input type="range" min="0" max="1000" step="1" value="${icVal(IC.size)}" data-k="size"></label><label class="field"><span class="flabel">Your impact limit <b data-o="lm"></b></span><input type="range" min="0.5" max="10" step="0.1" value="${IC.lim}" data-k="lim"></label></div>
    <div class="out-tbl" data-o="out"></div>`,
  mount(b) {
    let w = 0; const box = b.querySelector('[data-o=c]');
    const draw = () => {
      const sel = IC_P.find(p => p.k === IC.k), cur = impOf(IC.size, sel.d), ok = cur <= IC.lim + 1e-9, maxS = IC.lim / 100 * sel.d / (1 - IC.lim / 100);
      if (w) box.innerHTML = icSVG(w);
      b.querySelector('[data-o=note]').textContent = sel.note; b.querySelector('[data-o=sz]').textContent = fmtUsd(IC.size, IC.size < 100 ? 2 : 0); b.querySelector('[data-o=lm]').textContent = IC.lim.toFixed(1) + '%';
      b.querySelector('[data-o=out]').innerHTML = `<div class="r"><span>Impact at ${fmtUsd(IC.size, 0)}</span><b>${pct(cur)} <span class="chip ${ok ? 'ok' : 'dn'}">${ok ? 'within limit' : 'blocked'}</span></b></div>
        <div class="r"><span>What that impact costs you</span><b>≈ ${smallUsd(IC.size * cur / 100)}</b></div>
        <div class="r"><span>Largest order inside ${IC.lim.toFixed(1)}%</span><b>${maxS >= 1e6 ? fmtK(maxS) : fmtUsd(maxS, 0)}</b></div>
        <div class="r"><span>Same ${fmtUsd(IC.size, 0)} elsewhere</span><b class="ic-cmp">${IC_P.filter(p => p.k !== IC.k).map(p => `${p.l} ${pct(impOf(IC.size, p.d), impOf(IC.size, p.d) < 0.01 ? 3 : 2)}`).join(' · ')}</b></div>`;
    };
    onWidth(box, nw => { w = nw; draw(); });
    b.querySelector('.seg').addEventListener('click', e => { const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return; IC.k = v; segSet(b, 'icp', v); draw(); });
    b.addEventListener('input', e => { const k = e.target.dataset.k; if (k === 'size') IC.size = Math.round(icSize(+e.target.value)); else if (k === 'lim') IC.lim = +e.target.value; else return; draw(); });
    let drag = false; const fromX = ev => { const rc = box.getBoundingClientRect(); const fx = clamp((ev.clientX - rc.left - 40) / (rc.width - 54), 0, 1); IC.size = Math.round(Math.pow(10, 1 + 4 * fx)); const r = b.querySelector('[data-k=size]'); r.value = icVal(IC.size); rangeFill(r); draw(); };
    box.addEventListener('pointerdown', ev => { drag = true; box.setPointerCapture?.(ev.pointerId); fromX(ev); });
    box.addEventListener('pointermove', ev => { if (drag) fromX(ev); });
    ['pointerup', 'pointercancel'].forEach(t => box.addEventListener(t, () => { drag = false; }));
  },
};

// ---------- 7. order state machine ----------
const OS_N = { lock: ['Quote locked', 'age checked'], checks: ['Checks', 'before signing'], signed: ['Signed', 'in your wallet'], submitted: ['Submitted', 'sent out'], confirmed: ['Confirmed', 'network voted'], finalized: ['Finalized', '~13 s later'], failed: ['Failed', 'below minimum'], reconcile: ['Reconcile', 'lookup at 8 s'], expired: ['Expired', 'can’t land'] };
const OS_TYPE = { failed: 'fail', reconcile: 'warn', expired: 'warn' };
const OS_E = [['lock', 'checks'], ['checks', 'signed'], ['signed', 'submitted'], ['submitted', 'confirmed'], ['confirmed', 'finalized'], ['submitted', 'failed'], ['submitted', 'reconcile'], ['reconcile', 'confirmed'], ['reconcile', 'expired']];
const OS_POS = { wide: { lock: [0, 1], checks: [1, 1], signed: [2, 1], submitted: [3, 1], confirmed: [4, 1], finalized: [5, 1], failed: [4, 0], reconcile: [3, 2], expired: [4, 2] }, narrow: { lock: [0, 0], checks: [0, 1], signed: [0, 2], submitted: [0, 3], failed: [1, 3], reconcile: [1, 4], confirmed: [0, 5], expired: [1, 5], finalized: [0, 6] } };
const OS_BASE = [
  { n: 'lock', at: 0, dur: 0, log: 'Quote locked · 1.2 s old, limit 15 s' },
  { n: 'checks', at: 0.18, dur: 520, log: 'Checks passed · assets, amounts, fees, recipient, minimum output, policy' },
  { n: 'signed', at: 0.42, dur: 520, log: 'Signed in your FOMA wallet' },
  { n: 'submitted', at: 0.56, dur: 520, log: 'Submitted · slot 458,216,141' },
];
const OS_SC = {
  normal: { l: 'Normal', end: ['ok', 'CONFIRMED', 'Receipt prints with the quote, the fill and every cost.'], steps: [...OS_BASE, { n: 'confirmed', at: 1.62, dur: 1000, log: 'Confirmed in 1.06 s' }, { n: 'finalized', at: 14.6, dur: 1300, log: 'Finalized · the stamp changes to FINAL' }] },
  slow: { l: 'Slow', end: ['ok', 'CONFIRMED · LATE', 'It landed late, so there was nothing to retry.'], steps: [...OS_BASE, { n: 'reconcile', at: 8.56, dur: 2300, log: 'No confirmation after 8 s · looking up the signature and blockhash window' }, { n: 'confirmed', at: 9.1, dur: 1000, log: 'Found on chain · landed late in slot 458,216,159' }, { n: 'finalized', at: 22.1, dur: 1300, log: 'Finalized' }] },
  moved: { l: 'Price moved', end: ['bad', 'FAILED', 'No tokens changed hands. The network fee was charged; the platform fee wasn’t.'], steps: [...OS_BASE, { n: 'failed', at: 1.48, dur: 1000, log: 'Failed · 0x1771 slippage tolerance exceeded · price moved 1.4% in flight' }] },
  dropped: { l: 'Dropped', end: ['wn', 'EXPIRED', 'No funds moved. A safe retry reuses the same order ID and idempotency key.'], steps: [...OS_BASE, { n: 'reconcile', at: 8.56, dur: 2300, log: 'No confirmation after 8 s · looking up the signature and blockhash window' }, { n: 'expired', at: 9.4, dur: 1000, log: 'Not found and the blockhash expired · it can never land' }] },
};
function osSVG(Wd, st) {
  const nar = Wd < 640, pos = nar ? OS_POS.narrow : OS_POS.wide, nh = 46, gap = nar ? 22 : 24;
  const nw = nar ? (Wd - gap) / 2 : (Wd - gap * 5) / 6, rowH = nar ? 64 : 80, H = nar ? rowH * 6 + nh + 4 : rowH * 2 + nh + 4;
  const hints = nar ? { 'submitted-reconcile': 'h' } : { 'submitted-failed': 'v', 'reconcile-confirmed': 'h' };
  const box = k => { const [c, rw] = pos[k]; return { x: c * (nw + gap), y: 2 + rw * rowH, w: nw, h: nh }; };
  const edges = OS_E.map(([a, b2]) => {
    const A = box(a), B = box(b2), ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2, dx = bx - ax, dy = by - ay; let d;
    const hint = hints[a + '-' + b2];
    if (hint === 'v') { const y1 = dy < 0 ? A.y : A.y + A.h, x2 = dx > 0 ? B.x - 6 : B.x + B.w + 6; d = `M${ax} ${y1}C${ax} ${by} ${ax} ${by} ${x2} ${by}`; }
    else if (hint === 'h') { const x1 = dx > 0 ? A.x + A.w : A.x, y2 = dy > 0 ? B.y - 6 : B.y + B.h + 6; d = `M${x1} ${ay}C${bx} ${ay} ${bx} ${ay} ${bx} ${y2}`; }
    else if (Math.abs(dx) > Math.abs(dy)) { const x1 = dx > 0 ? A.x + A.w : A.x, x2 = dx > 0 ? B.x - 6 : B.x + B.w + 6, mx = (x1 + x2) / 2; d = `M${x1} ${ay}C${mx} ${ay} ${mx} ${by} ${x2} ${by}`; }
    else { const y1 = dy > 0 ? A.y + A.h : A.y, y2 = dy > 0 ? B.y - 6 : B.y + B.h + 6, my = (y1 + y2) / 2; d = `M${ax} ${y1}C${ax} ${my} ${bx} ${my} ${bx} ${y2}`; }
    return `<path class="os-edge ${st.e[a + '-' + b2] || ''}" d="${d}" marker-end="url(#osar)"/>`;
  }).join('');
  const nodes = Object.keys(OS_N).map(k => { const B = box(k); return `<g class="os-node ${OS_TYPE[k] || ''} ${st.n[k] || ''}" transform="translate(${B.x.toFixed(1)},${B.y})"><rect width="${B.w.toFixed(1)}" height="${nh}" rx="12"/><text x="11" y="20">${OS_N[k][0]}</text><text class="sm" x="11" y="35">${OS_N[k][1]}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Order state machine"><defs><marker id="osar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#4E4940"/></marker></defs>${edges}${nodes}</svg>`;
}
W['order-states'] = {
  title: 'Watch an order run', tag: 'Simulation',
  html: () => `<div class="os-top">${segHTML('osc', Object.entries(OS_SC).map(([k, s]) => [k, s.l]), 'normal')}<span class="grow"></span><span class="osclock num" data-o="clk">0.00 s</span><button class="btn sm" type="button" data-a="run">${I.play}<span>Run</span></button></div>
    <div class="svgbox os-box" data-o="g"></div><div class="os-end" data-o="end"></div><div class="oslog" data-o="log" aria-live="polite"></div>`,
  mount(b) {
    let sc = 'normal', w = 0, tok = 0, st = { n: {}, e: {} }, clockRaf = 0; const box = b.querySelector('[data-o=g]'), clk = b.querySelector('[data-o=clk]'), log = b.querySelector('[data-o=log]'), end = b.querySelector('[data-o=end]');
    const draw = () => { if (w) box.innerHTML = osSVG(w, st); };
    onWidth(box, nw => { w = nw; draw(); });
    const runClock = (from, to, ms) => { cancelAnimationFrame(clockRaf); const t0 = performance.now(); const f = now => { const k = ms ? Math.min(1, (now - t0) / ms) : 1; clk.textContent = (from + (to - from) * k).toFixed(2) + ' s'; if (k < 1) clockRaf = requestAnimationFrame(f); }; clockRaf = requestAnimationFrame(f); };
    const run = () => {
      const my = ++tok; const S2 = OS_SC[sc]; st = { n: {}, e: {} }; log.innerHTML = ''; end.innerHTML = ''; draw(); let acc = 0, prev = null;
      S2.steps.forEach(s => {
        acc += s.dur; const from = prev; const startAt = acc - s.dur;
        later(() => { if (my !== tok) return; if (from) { st.e[from.n + '-' + s.n] = 'on'; st.n[from.n] = 'done'; } draw(); runClock(from ? from.at : 0, s.at, s.dur); }, startAt);
        later(() => { if (my !== tok) return; if (from) st.e[from.n + '-' + s.n] = 'done'; st.n[s.n] = 'on'; draw(); log.insertAdjacentHTML('beforeend', `<div><span class="t">+${s.at.toFixed(2)} s</span>${esc(s.log)}</div>`); log.scrollTop = log.scrollHeight; }, acc);
        prev = s;
      });
      later(() => { if (my !== tok) return; const [c, stamp, note] = S2.end; end.innerHTML = `<span class="chip ${c}">Receipt: ${stamp}</span><span>${esc(note)}</span>`; }, acc + 250);
    };
    b.querySelector('.seg').addEventListener('click', e => { const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return; sc = v; segSet(b, 'osc', v); run(); });
    b.querySelector('[data-a=run]').addEventListener('click', run);
    draw(); onVisible(b, () => later(run, 250));
  },
};

// ---------- 8. receipt anatomy ----------
const anatQ = () => { const q = quote({ px: 0.00000278, depth: 364803, usd: 300, ata: true, micro: 24000, cu: 212400 }); return { q, got: q.out * 1.0004 }; };
function anatRows() {
  const { q, got } = anatQ();
  return [
    { sec: 'Quote and fill', l: 'Quoted output', v: fmtQty(q.out) + ' BONK', t: 'Quoted output', d: 'What the quote said you’d receive after every cost, at the moment it was quoted.' },
    { l: 'Minimum accepted', v: fmtQty(q.minOut), t: 'Minimum accepted', d: 'The quoted output minus your 1.0% slippage limit. If the fill would come in below this, the transaction fails instead of filling at a worse price.' },
    { l: 'Actually received', v: `${fmtQty(got)} <span class="ok">(+0.04%)</span>`, t: 'Actually received', d: 'What landed in your wallet, compared with the quote. Green means you got slightly more than quoted.' },
    { l: 'Reference quote', v: '22:14:03.120 · $0.00000278', t: 'Reference quote', d: 'When the quote was made and the price it used. A quote older than your freshness limit, 15 seconds by default, is refreshed before anything is signed.' },
    { l: 'Submitted', v: '22:14:04.410 · slot 458,216,141', t: 'Submitted', d: 'When your signed transaction went out, and the Solana slot it landed in. A slot is about 400 milliseconds.' },
    { l: 'Confirmed', v: '22:14:05.470 · 1.06 s', t: 'Confirmed', d: 'How long it took from submitting to confirmation, when a supermajority of the network had voted on the block.' },
    { sec: 'Costs', l: 'Platform fee 0.40%', v: fmtUsd(q.feeUsd), t: 'Platform fee', d: 'FOMA’s fee. It isn’t charged when an order fails or expires.' },
    { l: 'Network fee', v: `${q.netSol.toFixed(7)} SOL · ${smallUsd(q.netUsd)}`, t: 'Network fee', d: `The base fee of 5,000 lamports plus a priority fee of ${q.prioLam.toLocaleString('en-US')} lamports: 212,400 compute units at 24,000 micro-lamports each.` },
    { l: 'Token account deposit', v: `${ATA_SOL} SOL · refundable`, t: 'Token account deposit', d: 'Only charged the first time you hold a token. The SOL stays in your token account and comes back when the account closes, so it doesn’t count toward your fee limit.' },
    { l: 'Token transfer fee', v: 'none', t: 'Token transfer fee', d: 'Some Token-2022 tokens charge a fee on every transfer. BONK doesn’t. When a token does, it shows here and on the quote.' },
    { sec: 'Why the price was what it was', l: 'Estimated impact', v: pct(q.imp * 100), t: 'Estimated impact', d: 'How much your own order moved the price, estimated from the pool’s depth when quoted.' },
    { l: 'Quote-to-fill movement', v: '+0.04% in your favor', t: 'Quote-to-fill movement', d: 'How far the price moved between the quote and the fill, separate from your own impact.' },
    { l: 'Priority-fee competition, MEV', v: 'unknown', t: 'What FOMA can’t see', d: 'FOMA can’t observe these from its side, so the receipt says unknown instead of guessing.' },
    { sec: 'Your policy', l: 'Size $300 · limit $500', v: '<span class="ok">within</span>', t: 'Your policy', d: 'Each limit from your execution policy, checked again on the receipt. An override would appear here with the time you made it.' },
    { l: 'Idempotency key', v: 'k_7f3a9c21', t: 'Idempotency key', d: 'Attached to the order so a retry can never run it twice.' },
  ];
}
W['receipt-anatomy'] = {
  title: 'A $300 BONK buy, line by line', tag: 'Tap a line',
  html: () => {
    const rows = anatRows();
    const head = { t: 'Order and outcome', d: 'Every order gets an ID and an attempt number, and the stamp names the outcome. CONFIRMED turns to FINAL about 13 seconds later. Failed and expired orders get receipts too. A retry keeps the ID and counts up the attempt.' };
    const big = { t: 'What happened', d: 'The headline in plain words: what you got and what you paid. A failed or expired order says “No tokens exchanged.”' };
    W['receipt-anatomy']._items = [head, big, ...rows];
    let i = 2, h = '';
    rows.forEach(r => { if (r.sec) h += `<div class="rhr"></div><h5>${r.sec}</h5>`; h += `<div class="rr" data-i="${i++}" tabindex="0" role="button"><span>${r.l}</span><span>${r.v}</span></div>`; });
    return `<div class="anat"><div class="rwrap"><div class="receipt" role="document" aria-label="Example receipt">
        <div class="rh rr" data-i="0" tabindex="0" role="button"><div><b>FOMA</b><div class="sub">RECEIPT · R-7Q2KD</div><div class="sub">attempt 1 · 7 Nov 2026</div></div><span class="stamp">CONFIRMED</span></div>
        <div class="rr rbig" data-i="1" tabindex="0" role="button"><span><span class="big">Bought ${fmtQty(anatQ().got)} BONK</span><span class="sub">for $300.00 USDC</span></span></div>${h}
        <div class="sub" style="margin-top:8px">Example receipt. Prototype numbers, no real funds.</div></div></div>
      <div class="exp"><div class="dots" data-o="dots">${W['receipt-anatomy']._items.map((_, k) => `<button type="button" data-j="${k}" aria-label="Line ${k + 1}">${k + 1}</button>`).join('')}</div><div data-o="card"></div><button class="btn sm" type="button" data-a="tour">${I.play}<span>Walk me through it</span></button></div></div>`;
  },
  mount(b) {
    const items = W['receipt-anatomy']._items; let cur = 0, tourT = 0;
    const show = k => {
      cur = (k + items.length) % items.length; const it = items[cur];
      $$('.rr', b).forEach(r => r.classList.toggle('on', +r.dataset.i === cur)); $$('[data-j]', b).forEach(d => d.classList.toggle('on', +d.dataset.j === cur));
      b.querySelector('[data-o=card]').innerHTML = `<div class="card"><span class="anum">${cur + 1}/${items.length}</span><b>${esc(it.t)}</b><p>${esc(it.d)}</p><div class="row"><button class="btn sm" type="button" data-a="prev" aria-label="Previous line">${I.arrowL}</button><button class="btn sm" type="button" data-a="next">Next ${I.arrowR}</button></div></div>`;
    };
    const stopTour = () => { if (tourT) { clearInterval(tourT); tourT = 0; const t = b.querySelector('[data-a=tour]'); t.innerHTML = `${I.play}<span>Walk me through it</span>`; } };
    b.addEventListener('click', e => {
      const r = e.target.closest('[data-i]'); if (r) { stopTour(); show(+r.dataset.i); return; }
      const d = e.target.closest('[data-j]'); if (d) { stopTour(); show(+d.dataset.j); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'next') { stopTour(); show(cur + 1); } if (a === 'prev') { stopTour(); show(cur - 1); }
      if (a === 'tour') { if (tourT) { stopTour(); return; } show(0); tourT = every(() => { if (cur >= items.length - 1) { stopTour(); return; } show(cur + 1); }, 3200); b.querySelector('[data-a=tour]').innerHTML = `${I.pause}<span>Pause</span>`; }
    });
    b.addEventListener('keydown', e => { const r = e.target.closest('[data-i]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); stopTour(); show(+r.dataset.i); } });
    show(0);
  },
};

// ---------- 9. fee calculator ----------
const FC = { usd: 250, prof: 'deep', net: 'quiet', first: true };
const FC_PROF = { deep: { l: 'Deep pool', depth: 364803, tax: 0 }, thin: { l: 'Thin launch', depth: 10200, tax: 0 }, curve: { l: 'Curve', depth: 5200, tax: 0 }, taxed: { l: 'Taxed 2%', depth: 48000, tax: 0.02 } };
const FC_NET = { quiet: { l: 'Quiet', micro: 24000 }, busy: { l: 'Busy', micro: 70000 }, congested: { l: 'Congested', micro: 190000 } };
W['fee-calc'] = {
  title: 'Every cost, before you buy', tag: 'Calculator',
  foot: `Network fees use 200,000 compute units and the SOL snapshot of ${fmtUsd(SOL_PX)}. Prototype estimates.`,
  html: () => `<div class="fc"><div class="fgrid fc-in">
      <label class="field"><span class="flabel">Order size</span><span class="amt"><span>$</span><input class="input num" type="number" inputmode="decimal" min="1" max="100000" step="1" value="${FC.usd}" data-k="usd" aria-label="Order size in dollars"></span></label>
      <div class="field"><span class="flabel">Quick sizes</span><div class="qs">${[50, 250, 1000, 5000].map(v => `<button class="chip" type="button" data-q="${v}">${fmtK(v)}</button>`).join('')}</div></div></div>
      <div class="fgrid"><div class="field"><span class="flabel">Token</span>${segHTML('prof', Object.entries(FC_PROF).map(([k, p]) => [k, p.l]), FC.prof)}</div><div class="field"><span class="flabel">Network</span>${segHTML('net', Object.entries(FC_NET).map(([k, p]) => [k, p.l]), FC.net)}</div></div>
      <label class="tog"><input type="checkbox" data-k="first" ${FC.first ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span>First time holding this token</span></label>
      <div class="fc-bar"><div class="stack" data-o="bar"></div><div class="legend"><span><i style="background:var(--lime)"></i>Platform</span><span><i style="background:var(--fg2)"></i>Network</span><span><i style="background:var(--warn)"></i>Transfer fee</span><span><i style="background:var(--infer)"></i>Price impact</span></div></div>
      <div class="out-tbl" data-o="tbl"></div></div>`,
  mount(b) {
    const draw = () => {
      const p = FC_PROF[FC.prof], n = FC_NET[FC.net]; const q = quote({ px: 1, depth: p.depth, usd: FC.usd, tax: p.tax, ata: FC.first, micro: n.micro });
      const recv = q.out * q.px; const parts = [['var(--lime)', q.feeUsd], ['var(--fg2)', q.netUsd], ['var(--warn)', q.taxUsd], ['var(--infer)', q.impUsd]]; const tot = parts.reduce((s, x) => s + x[1], 0) || 1;
      b.querySelector('[data-o=bar]').innerHTML = parts.map(([c, v]) => `<i style="background:${c};flex-basis:${v / tot * 100}%"></i>`).join('');
      const lim = PP.maxFee, ok = q.totalFees <= lim + 1e-9;
      b.querySelector('[data-o=tbl]').innerHTML = `<div class="r"><span>Platform fee · 0.40%</span><b>${fmtUsd(q.feeUsd)}</b></div>
        <div class="r"><span>Network fee · ${(BASE_LAM + q.prioLam).toLocaleString('en-US')} lamports</span><b>${q.netSol.toFixed(7)} SOL · ${smallUsd(q.netUsd)}</b></div>
        <div class="r"><span>Token transfer fee</span><b>${p.tax ? `${pct(p.tax * 100)} · ${fmtUsd(q.taxUsd)}` : 'none'}</b></div>
        <div class="r"><span>Price impact · ${pct(q.imp * 100)} <span class="faint">inside the quote</span></span><b>${smallUsd(q.impUsd)}</b></div>
        <div class="r"><span>Pool fees</span><b class="faint">inside the quoted output</b></div>
        <div class="r"><span>Token account deposit</span><b>${FC.first ? `${ATA_SOL} SOL · ${fmtUsd(q.ataUsd)} <span class="chip sm">refundable</span>` : 'not needed'}</b></div>
        <div class="r tot"><span>Counts toward your fee limit</span><b>${fmtUsd(q.totalFees)} <span class="chip ${ok ? 'ok' : 'dn'}">${ok ? 'within' : 'over'} ${fmtUsd(lim)}</span></b></div>
        <div class="r tot"><span>You receive, at the pre-trade price</span><b>${fmtUsd(recv)}</b></div>`;
    };
    b.addEventListener('input', e => { if (e.target.dataset.k === 'usd') { const v = parseFloat(e.target.value); if (isFinite(v) && v > 0) { FC.usd = clamp(v, 1, 100000); draw(); } } });
    b.addEventListener('change', e => { if (e.target.dataset.k === 'first') { FC.first = e.target.checked; draw(); } if (e.target.dataset.k === 'usd') e.target.value = FC.usd; });
    b.addEventListener('click', e => {
      const q = e.target.closest('[data-q]'); if (q) { FC.usd = +q.dataset.q; b.querySelector('[data-k=usd]').value = FC.usd; draw(); return; }
      const sb = e.target.closest('.seg button'); if (!sb) return; const g = sb.closest('.seg').dataset.g; FC[g] = sb.dataset.v; segSet(b, g, sb.dataset.v); draw();
    });
    draw();
  },
};

// ---------- 10. why a higher market cap can still lose ----------
const PW = { mc: 425, depth: 10200 }; const PW_ENTRY = 412;
const PW_D = [[10200, 'Thin · $10K'], [60000, 'Medium · $60K'], [1e6, 'Deep · $1M']];
function pnlCalc(r, D) {
  const usd = 250, fee1 = usd * FEE_RATE, net = BASE_LAM * 1.96 / 1e9 * SOL_PX, swapIn = usd - fee1 - net, ib = usd / (usd + D);
  const v0 = swapIn / (1 + ib), marked = v0 * r, is = marked / (marked + D), gross = marked * (1 - is), fee2 = gross * FEE_RATE, out = gross - fee2 - net;
  return { usd, fee1, net, ib, is, buyImp: swapIn - v0, mkt: marked - v0, marked, sellImp: marked - gross, fee2, out, res: out / usd - 1 };
}
W['pnl-why'] = {
  title: '$250 in a thin pool', tag: 'Try it',
  html: () => `<div class="pw"><div class="outs3 two">
      <div class="o3"><span class="tag">Market cap</span><span class="v num" data-o="mc"></span><p>$412K when you bought, <b data-o="mcnow"></b> now</p></div>
      <div class="o3"><span class="tag">If you sold now</span><span class="v num" data-o="res"></span><p data-o="resd"></p></div></div>
    <div class="fgrid"><label class="field"><span class="flabel">Market cap now <b data-o="mcl"></b></span><input type="range" min="360" max="520" step="1" value="${PW.mc}" data-k="mc"></label><div class="field"><span class="flabel">Pool depth</span>${segHTML('pwd', PW_D.map(([d, l]) => [String(d), l]), String(PW.depth))}</div></div>
    <div class="wf" data-o="wf"></div><p class="faint pw-be" data-o="be"></p></div>`,
  mount(b) {
    const draw = () => {
      const r = PW.mc / PW_ENTRY, c = pnlCalc(r, PW.depth); const mcp = (r - 1) * 100;
      tween(b.querySelector('[data-o=mc]'), mcp, v => fmtSigned(v, 1)); b.querySelector('[data-o=mc]').className = 'v num ' + (mcp >= 0 ? 'up' : 'dn');
      tween(b.querySelector('[data-o=res]'), c.res * 100, v => fmtSigned(v, 1)); b.querySelector('[data-o=res]').className = 'v num ' + (c.res >= 0 ? 'up' : 'dn');
      b.querySelector('[data-o=mcnow]').textContent = '$' + PW.mc + 'K'; b.querySelector('[data-o=mcl]').textContent = '$' + PW.mc + 'K';
      b.querySelector('[data-o=resd]').textContent = `${fmtUsd(c.out)} back from ${fmtUsd(c.usd)}`;
      const steps = [['You paid', null, c.usd, 'sub'], ['Platform fee 0.40%', -c.fee1], ['Network fee', -c.net], [`Buy impact ${pct(c.ib * 100)}`, -c.buyImp], [`Market cap ${fmtSigned(mcp, 1)}`, c.mkt], ['Marked value', null, c.marked, 'sub'], [`Sell impact ${pct(c.is * 100)}`, -c.sellImp], ['Platform fee 0.40%', -c.fee2], ['Network fee', -c.net], ['If sold now', null, c.out, 'end']];
      let run = c.usd; const pts = [];
      steps.forEach(s => { if (s[1] == null) { run = s[2]; pts.push([run, run]); } else { const a = run; run += s[1]; pts.push([a, run]); } });
      const vals = pts.flat(), mn = Math.min(...vals), mx = Math.max(...vals), pad = (mx - mn) * 0.12 + 0.4, lo = mn - pad, hi = mx + pad, X = v => (v - lo) / (hi - lo) * 100;
      b.querySelector('[data-o=wf]').innerHTML = steps.map((s, i) => {
        const [a, z] = pts[i]; const sub = s[1] == null; const col = sub ? (s[3] === 'end' ? (c.out >= c.usd ? 'var(--gain)' : 'var(--loss)') : 'var(--fg)') : s[1] >= 0 ? 'var(--gain)' : 'var(--loss)';
        const bar = sub ? `<i class="dot" style="left:${X(z)}%;background:${col}"></i>` : `<i style="left:${X(Math.min(a, z))}%;width:${Math.max(0.6, Math.abs(X(z) - X(a)))}%;background:${col}"></i>`;
        const val = sub ? fmtUsd(z) : (s[1] >= 0 ? '+' : MINUS) + '$' + Math.abs(s[1]).toFixed(Math.abs(s[1]) < 0.01 ? 3 : 2);
        return `<div class="wf-r ${sub ? 'sub' : ''} ${s[3] === 'end' ? 'end' : ''}"><span class="wf-l">${s[0]}</span><span class="wf-t">${bar}</span><span class="wf-v num">${val}</span></div>`;
      }).join('') + `<div class="wf-ax faint"><span>${fmtUsd(lo, 0)}</span><span>axis doesn’t start at zero</span><span>${fmtUsd(hi, 0)}</span></div>`;
      let a = 0.5, z = 3; for (let k = 0; k < 50; k++) { const m = (a + z) / 2; if (pnlCalc(m, PW.depth).out < c.usd) a = m; else z = m; }
      b.querySelector('[data-o=be]').innerHTML = `Break-even market cap: <b>≈ $${Math.round(PW_ENTRY * z)}K</b> (${fmtSigned((z - 1) * 100, 1)}). The refundable token account deposit is left out.`;
    };
    b.addEventListener('input', e => { if (e.target.dataset.k === 'mc') { PW.mc = +e.target.value; draw(); } });
    b.querySelector('.seg').addEventListener('click', e => { const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return; PW.depth = +v; segSet(b, 'pwd', v); draw(); });
    draw();
  },
};

// ---------- 11. ranking eligibility ----------
const EL = { calls: 14, days: 22, team: false };
W.eligibility = {
  title: 'Who gets ranked', tag: 'Try it',
  html: () => `<div class="fgrid"><label class="field"><span class="flabel">Eligible calls <b data-o="cl"></b></span><input type="range" min="0" max="60" step="1" value="${EL.calls}" data-k="calls"></label><label class="field"><span class="flabel">Days observed <b data-o="dl"></b></span><input type="range" min="0" max="90" step="1" value="${EL.days}" data-k="days"></label></div>
    <label class="tog"><input type="checkbox" data-k="team" ${EL.team ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span>Team account, 6 of these calls on its own token</span></label>
    <div class="elig"><div class="em"><span class="faint">Calls</span><div class="meter"><i data-o="mc"></i></div><b class="num" data-o="mcn"></b></div><div class="em"><span class="faint">Days</span><div class="meter"><i data-o="md"></i></div><b class="num" data-o="mdn"></b></div></div>
    <div class="elig-out" data-o="out" aria-live="polite"></div>`,
  mount(b) {
    const draw = () => {
      const calls = Math.max(0, EL.calls - (EL.team ? 6 : 0)), ok = calls >= 20 && EL.days >= 30;
      b.querySelector('[data-o=cl]').textContent = EL.calls; b.querySelector('[data-o=dl]').textContent = EL.days;
      b.querySelector('[data-o=mc]').style.width = Math.min(100, calls / 20 * 100) + '%'; b.querySelector('[data-o=md]').style.width = Math.min(100, EL.days / 30 * 100) + '%'; b.querySelector('[data-o=mc]').parentElement.classList.toggle('full', calls >= 20); b.querySelector('[data-o=md]').parentElement.classList.toggle('full', EL.days >= 30);
      b.querySelector('[data-o=mcn]').textContent = `${calls}/20`; b.querySelector('[data-o=mdn]').textContent = `${EL.days}/30`;
      const need = [calls < 20 ? `${20 - calls} more eligible call${20 - calls === 1 ? '' : 's'}` : '', EL.days < 30 ? `${30 - EL.days} more day${30 - EL.days === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
      const o = b.querySelector('[data-o=out]'); o.classList.toggle('ok', ok);
      o.innerHTML = `<span class="chip ${ok ? 'ok' : 'wn'}">${ok ? I.check + 'Ranked' : 'Building a record'}</span><span>${ok ? `${calls} eligible calls over ${EL.days} days. Ranked in its style view, with the full denominator shown.` : `Needs ${need}. Every call still shows on the profile with all three outcomes, but it isn’t ranked.`}${EL.team ? ' The 6 calls on the account’s own token never count.' : ''}</span>`;
    };
    b.addEventListener('input', e => { const k = e.target.dataset.k; if (k === 'calls' || k === 'days') { EL[k] = +e.target.value; draw(); } });
    b.addEventListener('change', e => { if (e.target.dataset.k === 'team') { EL.team = e.target.checked; draw(); } });
    draw();
  },
};

// ---------- 12. paper tracking ----------
const PS_KEYS = [[0, 1], [0.7, 1.03], [1.0, 1.06], [1.48, 1.12], [1.78, 1.2], [2.08, 1.31], [2.48, 1.44], [2.78, 1.55], [3.26, 1.72], [3.56, 1.85], [3.95, 2.02], [4.33, 2.1], [4.48, 1.92], [4.64, 1.55], [4.8, 1.24], [4.94, 1.02], [5.1, 0.93], [5.24, 0.86], [5.33, 0.95], [5.41, 1.05], [5.54, 1.12], [5.6, 1.0], [5.67, 0.84], [5.72, 0.78], [5.782, 0.72]];
const PS_U = 5.782, PS_DEPTH = 25000;
const psRaw = u => interp(PS_KEYS, u) * wobble(u * 3.1, 0.004 + 0.016 * clamp(u / PS_U, 0, 1)); const PS0 = psRaw(0); const psP = u => psRaw(u) / PS0;
const PSS = { delay: 30, size: 250, stop: 0.2, days: 7 };
function psRun() {
  const ue = Math.log10(PSS.delay), pe = psP(ue), uEnd = Math.log10(PSS.days * 86400);
  const q = quote({ px: pe, depth: PS_DEPTH, usd: PSS.size, ata: false }); const tokens = q.out; let ux = uEnd, px = psP(uEnd), stopHit = false, hi = pe;
  for (let i = 1; i <= 1400; i++) { const u = ue + (uEnd - ue) * i / 1400, p = psP(u); hi = Math.max(hi, p); if (PSS.stop && p <= pe * (1 - PSS.stop)) { ux = u; px = pe * (1 - PSS.stop) * 0.997; stopHit = true; break; } }
  const val = tokens * px, is = val / (val + PS_DEPTH), gross = val * (1 - is), fee = gross * FEE_RATE, out = gross - fee - q.netUsd;
  return { ue, pe, ux, px, stopHit, hi, q, is, out, fee, res: out / PSS.size - 1 };
}
function psSVG(Wd, R) {
  const H = 240, l = 38, r = 12, t = 14, bm = 28, x = u => l + u / PS_U * (Wd - l - r), y = p => t + (1 - (p - 0.6) / 1.65) * (H - t - bm);
  let path = '', area = ''; for (let i = 0; i <= 300; i++) { const u = PS_U * i / 300; path += (i ? 'L' : 'M') + x(u).toFixed(1) + ' ' + y(psP(u)).toFixed(1); }
  for (let i = 0; i <= 120; i++) { const u = R.ue + (R.ux - R.ue) * i / 120; area += (i ? 'L' : 'M') + x(u).toFixed(1) + ' ' + y(psP(u)).toFixed(1); }
  area += `L${x(R.ux).toFixed(1)} ${H - bm}L${x(R.ue).toFixed(1)} ${H - bm}Z`;
  const nar = Wd < 520; const ticks = (nar ? [[0, 'post'], [1.778, '1 min'], [3.556, '1 h'], [4.936, '1 d'], [PS_U, '7 d']] : [[0, 'post'], [1.477, '30 s'], [2.079, '2 min'], [3.556, '1 h'], [4.334, '6 h'], [4.936, '1 d'], [5.413, '3 d'], [PS_U, '7 d']]);
  const tk = ticks.map(([u, lb], i) => `<line x1="${x(u)}" x2="${x(u)}" y1="${t}" y2="${H - bm}" stroke="rgba(255,240,220,.05)"/><text x="${x(u)}" y="${H - 9}" text-anchor="${i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}">${lb}</text>`).join('');
  const gy = [0.75, 1, 1.5, 2].map(p => `<line x1="${l}" x2="${Wd - r}" y1="${y(p)}" y2="${y(p)}" stroke="rgba(255,240,220,${p === 1 ? .14 : .05})"/><text x="${l - 7}" y="${y(p) + 4}" text-anchor="end">${p}×</text>`).join('');
  const win = R.out >= PSS.size;
  return `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Paper tracking simulation on a log time axis"><defs><linearGradient id="psg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F5F1EA" stop-opacity=".16"/><stop offset="1" stop-color="#F5F1EA" stop-opacity="0"/></linearGradient></defs>
    ${tk}${gy}<path d="${area}" fill="url(#psg)"/><path d="${path}" fill="none" stroke="#ABA497" stroke-width="1.8" stroke-linejoin="round"/>
    ${PSS.stop ? `<line x1="${x(R.ue)}" x2="${x(R.ux)}" y1="${y(R.pe * (1 - PSS.stop))}" y2="${y(R.pe * (1 - PSS.stop))}" stroke="#FF6B62" stroke-width="1.4" stroke-dasharray="5 4"/>` : ''}
    <line x1="${x(R.ue)}" x2="${x(R.ue)}" y1="${y(R.pe)}" y2="${H - bm}" stroke="#F5F1EA" stroke-opacity=".45" stroke-dasharray="2 3"/>
    <circle cx="${x(R.ue)}" cy="${y(R.pe)}" r="6.5" fill="#F5F1EA" stroke="#0B0A09" stroke-width="2.5"/>
    <circle cx="${x(R.ux)}" cy="${y(Math.max(0.6, R.px))}" r="6.5" fill="${win ? '#3CDDA0' : '#FF6B62'}" stroke="#0B0A09" stroke-width="2.5"/></svg>`;
}
W['paper-sim'] = {
  title: 'Track a call forward', tag: 'Simulation',
  foot: 'Illustrative price path on a log time axis, so the first seconds and the last days both fit. Pool depth $25K.',
  html: () => `<div class="ps-ctl"><div class="field"><span class="flabel">Entry delay</span>${segHTML('delay', [['5', '5 s'], ['30', '30 s'], ['120', '2 min']], String(PSS.delay))}</div><div class="field"><span class="flabel">Size</span>${segHTML('size', [['250', '$250'], ['1000', '$1,000']], String(PSS.size))}</div><div class="field"><span class="flabel">Stop</span>${segHTML('stop', [['0.2', '−20%'], ['0.3', '−30%'], ['0', 'None']], String(PSS.stop))}</div><div class="field"><span class="flabel">Exit after</span>${segHTML('days', [['3', '3 days'], ['7', '7 days']], String(PSS.days))}</div></div>
    <div class="svgbox ps-box" data-o="c"></div><div class="outs3" data-o="stats"></div><div class="oslog" data-o="log"></div>`,
  mount(b) {
    let w = 0; const box = b.querySelector('[data-o=c]');
    const draw = () => {
      const R = psRun(); if (w) box.innerHTML = psSVG(w, R);
      const entryVs = (R.pe - 1) * 100, hiPct = (R.hi / R.pe - 1) * 100, exitT = Math.pow(10, R.ux);
      b.querySelector('[data-o=stats]').innerHTML = `<div class="o3"><span class="tag">Entry vs post</span><span class="v num ${entryVs > 0 ? 'dn' : 'up'}">${fmtSigned(entryVs, 1)}</span><p>Price ${PSS.delay < 60 ? PSS.delay + ' s' : PSS.delay / 60 + ' min'} after posting, plus ${pct(R.q.imp * 100)} impact for ${fmtUsd(PSS.size, 0)}.</p></div>
        <div class="o3"><span class="tag">Paper result</span><span class="v num ${R.res >= 0 ? 'up' : 'dn'}">${fmtSigned(R.res * 100, 1)}</span><p>${fmtUsd(R.out)} back from ${fmtUsd(PSS.size, 0)}, after impact and fees both ways.</p></div>
        <div class="o3"><span class="tag">Chart high after entry</span><span class="v num">${fmtSigned(hiPct, 0)}</span><p>A high you could only see afterwards. The rule exited ${R.stopHit ? 'on its stop' : 'on schedule'}.</p></div>`;
      b.querySelector('[data-o=log]').innerHTML = [['+0 s', 'Idea posted · tracking starts, rules frozen'], ['+' + fmtDur(PSS.delay), `Entry quote ok · ${fmtUsd(PSS.size, 0)} · impact ${pct(R.q.imp * 100)} · ${fmtSigned(entryVs, 1)} vs post`], ['+' + fmtDur(exitT), R.stopHit ? `Stop ${fmtSigned(-PSS.stop * 100, 0)} hit · exit fill impact ${pct(R.is * 100)}` : `Exit after ${PSS.days} days · impact ${pct(R.is * 100)}`], ['result', `${fmtSigned(R.res * 100, 1)} · fees ${fmtUsd(R.q.feeUsd + R.fee)} · counted with every other paper entry`]].map(([tt, s]) => `<div><span class="t">${tt}</span>${esc(s)}</div>`).join('');
    };
    onWidth(box, nw => { w = nw; draw(); });
    b.addEventListener('click', e => { const sb = e.target.closest('.seg button'); if (!sb) return; const g = sb.closest('.seg').dataset.g; PSS[g] = parseFloat(sb.dataset.v); segSet(b, g, sb.dataset.v); draw(); });
  },
};
