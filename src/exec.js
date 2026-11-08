// ============================================================
// EXECUTION — account, quotes, policy, order states, receipts
// ============================================================
const CAP = { sample: null, dl: null };
const isPhone = () => matchMedia('(max-width: 899px)').matches;
const curSlot = () => SLOT_AT_SNAP + Math.floor((Date.now() - SNAP_TS) / 400);

// ---------- account ----------
function makeAccount(sample) {
  const A = { wallet: addrFrom('foma-wallet-' + BOOT + Math.random()), created: Date.now(), cash: 0, lots: {}, receipts: [], funding: [], rentSol: 0, reconAt: Date.now() };
  if (!sample) return A;
  A.funding.push({ id: 'dep_' + b58(6), kind: 'deposit', method: 'Apple Pay (demo)', usd: 1500, t: Date.now() - 5 * D, status: 'confirmed' }); A.cash = 1500;
  const key = 'idem_' + b58(10);
  sampleOrder(A, 'BONK', 300, TOK.BONK.idxT(40), { ms: 1060, move: -0.0006 });
  sampleOrder(A, 'WIF', 200, TOK.WIF.idxT(58), { fail: 'slippage', move: 0.0142, key, attempt: 1 });
  sampleOrder(A, 'WIF', 200, TOK.WIF.idxT(58) + 52e3, { ms: 920, move: 0.0021, key, attempt: 2 });
  sampleOrder(A, 'FARTCOIN', 50, SNAP_TS - 2 * D - 3 * H, { fail: 'expired' });
  const tIn = BOOT - 47 * H, pxIn = priceAt('MOTH', tIn);
  A.lots.MOTH = [{ qty: 120000, cost: null, t: tIn, pxIn, src: 'Transfer in from 4tVq…Zk2x (your linked wallet)' }];
  A.funding.push({ id: 'tin_' + b58(6), kind: 'transfer', method: 'MOTH from linked wallet 4tVq…Zk2x', usd: 120000 * pxIn, t: tIn, status: 'confirmed' });
  return A;
}
function sampleOrder(A, sym, usd, t, o) {
  const q = quoteFor(sym, 'buy', usd, t, !!A.lots[sym]?.length);
  const r = baseReceipt(q, { id: 'ord_' + b58(8), key: o.key || 'idem_' + b58(10), attempt: o.attempt || 1, from: null, overrides: [], policy: { ...DEFAULT_POLICY }, net: o.fail === 'slippage' ? 'volatile' : o.fail === 'expired' ? 'congested' : 'normal' }, t);
  r.submitAt = t + 640; r.signedAt = t + 420; r.slot = SLOT_AT_SNAP - Math.floor((SNAP_TS - t) / 400);
  if (o.fail === 'slippage') { r.outcome = 'failed'; r.move = o.move; r.err = `Price moved ${(o.move * 100).toFixed(2)}% against you, beyond your ${DEFAULT_POLICY.slip.toFixed(1)}% slippage limit. No tokens were exchanged.`; r.code = 'custom program error 0x1771 (slippage tolerance exceeded)'; r.feeCharged = true; r.outQty = 0; }
  else if (o.fail === 'expired') { r.outcome = 'expired'; r.err = 'Not confirmed in time. FOMA checked the chain: the signature never landed and its blockhash expired, so it never can. No funds moved.'; r.outQty = 0; r.feeCharged = false; }
  else { r.outcome = 'confirmed'; r.move = o.move; r.outQty = q.outQty * (1 - o.move); r.confirmMs = o.ms; r.confirmAt = r.submitAt + o.ms; r.finalized = true; r.finalSlot = r.slot + 32;
    A.cash -= usd; (A.lots[sym] = A.lots[sym] || []).push({ qty: r.outQty, cost: usd - q.ataUsd, t, id: r.id }); A.rentSol += q.ataSol; }
  A.receipts.push(r);
}
function holdingQty(sym) { const L = S.acct?.lots?.[sym]; return L ? L.reduce((s, l) => s + l.qty, 0) : 0; }
function dayChange(sym) { const t = TOK[sym]; if (t.real) return t.ch / 100; const now = pxNow(sym), p = priceAt(sym, Date.now() - 24 * H); return now / p - 1; }
function positionsList() {
  if (!S.acct) return []; const out = [];
  for (const [sym, lots] of Object.entries(S.acct.lots)) {
    const qty = lots.reduce((s, l) => s + l.qty, 0); if (qty <= 1e-9) continue;
    const known = lots.filter(l => l.cost != null), unknownL = lots.filter(l => l.cost == null);
    const kq = known.reduce((s, l) => s + l.qty, 0), kc = known.reduce((s, l) => s + l.cost, 0);
    const px = pxNow(sym), value = qty * px, imp = impactFor(sym, value);
    const sell = quoteFor(sym, 'sell', qty);
    const p = { sym, qty, lots: lots.length, value, imp, liq: Math.max(0, sell.outUsd), px };
    if (unknownL.length && !known.length) { const uq = unknownL.reduce((s, l) => s + l.qty, 0); const pin = unknownL.reduce((s, l) => s + l.qty * l.pxIn, 0) / uq; Object.assign(p, { unknown: true, sinceRet: (px / pin - 1) * 100, pxIn: pin }); }
    else { Object.assign(p, { avg: kc / kq, ret: (kq * px / kc - 1) * 100, pnl: kq * px - kc, cost: kc, unknownQty: qty - kq }); }
    out.push(p);
  }
  return out.sort((a, b) => b.value - a.value);
}
function acctValue() { if (!S.acct) return 0; return S.acct.cash + positionsList().reduce((s, p) => s + p.value, 0); }
function netDeposits() { if (!S.acct) return 0; return (S.acct.funding || []).reduce((s, f) => f.status === 'failed' ? s : f.kind === 'withdraw' ? s - f.usd : (f.status === 'confirmed' || f.kind === 'withdraw') ? s + f.usd : s, 0); }
function dayPnl() { return positionsList().reduce((s, p) => { const c = dayChange(p.sym); return s + p.value * c / (1 + c); }, 0); }

// ---------- quotes & policy ----------
function routeFor(sym, usd) {
  const t = TOK[sym]; if (t.curve) return 'Launch bonding curve (pre-graduation)';
  if (t.demo) return t.depth > 100000 ? 'Raydium CPMM 72% · Meteora DLMM 28%' : 'Raydium CPMM 100%';
  if (sym === 'SOL') return 'Orca Whirlpool 61% · Meteora DLMM 39%';
  return usd > 2000 ? 'Jupiter: Meteora DLMM 54% · Orca 31% · Raydium 15%' : 'Jupiter: Meteora DLMM 100%';
}
function quoteFor(sym, side, amt, at, hasAta) {
  const t = TOK[sym]; const px = at ? priceAt(sym, at) : pxNow(sym); const solPx = at ? priceAt('SOL', at) : pxNow('SOL');
  const usd = side === 'buy' ? amt : amt * px; const imp = impactFor(sym, Math.max(usd, 0.01));
  const cu = 170000 + (hashStr(sym) % 140000); const micro = S.net === 'congested' ? 190000 : S.net === 'volatile' ? 70000 : 24000;
  const prioLam = Math.round(cu * micro / 1e6); const netSol = (BASE_LAMPORTS + prioLam) / 1e9; const netUsd = netSol * solPx;
  const needAta = side === 'buy' && !(hasAta ?? holdingQty(sym) > 0);
  const ataSol = needAta ? ATA_RENT_SOL : 0, ataUsd = ataSol * solPx; const tax = t.tax || 0;
  const q = { ok: true, sym, side, px, imp, cu, micro, prioLam, netSol, netUsd, ataSol, ataUsd, tax, route: routeFor(sym, usd), at: at || Date.now(), usd };
  if (side === 'buy') {
    const feeUsd = usd * FEE_RATE; const swapIn = Math.max(0, usd - feeUsd - netUsd - ataUsd); const execPx = px * (1 + imp); const gross = swapIn / execPx;
    Object.assign(q, { feeUsd, execPx, outQty: gross * (1 - tax), taxUsd: gross * tax * px, minOut: gross * (1 - tax) * (1 - S.policy.slip / 100) });
  } else {
    const execPx = px * (1 - imp); const gross = amt * (1 - tax) * execPx; const feeUsd = gross * FEE_RATE;
    Object.assign(q, { inQty: amt, feeUsd, execPx, taxUsd: amt * tax * px, outUsd: gross - feeUsd - netUsd, minOut: (gross - feeUsd - netUsd) * (1 - S.policy.slip / 100) });
  }
  q.netAndDep = netUsd + ataUsd; q.totalFees = q.feeUsd + netUsd + q.taxUsd; q.netUsd2 = netUsd;
  return q;
}
function liveQuote(tk) {
  const amt = parseFloat(tk.amt) || 0; if (amt <= 0) return null;
  const t = TOK[tk.sym];
  if (S.net === 'outage' && t.demo && rand() < 0.65) return { ok: false, err: 'No route at this size right now. The pool or launch curve is not answering quotes.', at: Date.now() };
  if (tk.side === 'sell') { const held = holdingQty(tk.sym); const qty = Math.min(held, tk.sellPct != null ? held * tk.sellPct : amt / pxNow(tk.sym)); if (qty <= 0) return { ok: false, err: `You don't hold any $${tk.sym}.`, at: Date.now() }; return quoteFor(tk.sym, 'sell', qty); }
  return quoteFor(tk.sym, 'buy', amt);
}
function policyCheck(q, ovr) {
  const p = S.policy; const o = ovr?.keys || [];
  const items = [
    { k: 'size', l: 'Size', v: fmtUsd(q.usd, q.usd < 100 ? 2 : 0), lim: fmtUsd(p.maxSize, 0), ok: q.usd <= p.maxSize + 1e-9 },
    { k: 'slip', l: 'Slippage', v: p.slip.toFixed(1) + '%', lim: p.slip.toFixed(1) + '%', ok: true, note: 'sets your minimum' },
    { k: 'impact', l: 'Price impact', v: (q.imp * 100).toFixed(2) + '%', lim: p.impact.toFixed(1) + '%', ok: q.imp * 100 <= p.impact + 1e-9 },
    { k: 'fee', l: 'Total fees', v: fmtUsd(q.totalFees), lim: fmtUsd(p.maxFee), ok: q.totalFees <= p.maxFee + 1e-9 },
  ];
  items.forEach(i => { i.ovr = !i.ok && o.includes(i.k); });
  const failing = items.filter(i => !i.ok && !i.ovr);
  return { items, failing, blocked: failing.length > 0, needsHold: q.usd > p.confirmAbove };
}

// ---------- ticket ----------
function newTicket(sym, from) {
  const held = holdingQty(sym);
  S.ticket = { sym, side: 'buy', amt: String(S.policy.defSize), from: from || null, fromHash: location.hash, q: null, phase: 'idle', order: null, ovr: null, sellPct: null, key: null, attempt: 1, err: null, receipt: null, held };
  S.ticket.q = liveQuote(S.ticket);
}
function ensureTicket() {
  const r = S.route; const want = r.v === 'token' ? r.sym : r.v === 'idea' ? getIdea(r.id)?.sym : null;
  if (!S.ticket) newTicket(want || 'MOTH', r.v === 'idea' ? r.id : null);
  else if (want && S.ticket.sym !== want && S.ticket.phase !== 'flight') newTicket(want, r.v === 'idea' ? r.id : null);
  else if (r.v === 'idea' && S.ticket.phase !== 'flight') S.ticket.from = r.id;
  else if (S.ticket.from && S.ticket.phase === 'idle' && S.ticket.fromHash !== location.hash) S.ticket.from = null;
}
const amtW = s => `width:${Math.max(1, String(s || '').length) + 0.35}ch`;
function ringHTML(q) {
  const ttl = S.policy.ttl * 1000; const left = Math.max(0, ttl - (Date.now() - q.at)); const C = 2 * Math.PI * 11;
  return `<span class="ring ${left < 3000 ? 'stale' : ''}" id="tkRing"><svg viewBox="0 0 26 26"><circle class="bgc" cx="13" cy="13" r="11"/><circle class="fgc" cx="13" cy="13" r="11" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - left / ttl)}"/></svg><b>${Math.ceil(left / 1000)}</b></span>`;
}
function quoteBoxHTML(tk) {
  const q = tk.q; if (!q) return `<div class="qbox"><div class="qrow"><span>Enter an amount to get a quote</span></div></div>`;
  if (!q.ok) return `<div class="qbox"><div class="qhead">${I.warn.replace('<svg', '<svg style="width:18px;height:18px;color:var(--warn)"')}<b style="font-size:13px">No quote</b><span class="grow"></span><button class="btn xs" data-act="refreshq" type="button">${I.refresh}Retry</button></div><div class="qrow"><span style="color:var(--fg2)">${esc(q.err)}</span></div></div>`;
  const t = TOK[tk.sym]; const buy = q.side === 'buy';
  return `<div class="qbox" id="tkQ"><div class="qhead">${ringHTML(q)}<div class="col" style="line-height:1.25"><b style="font-size:13px">Quote · ${t.real ? 'snapshot price' : 'live demo price'}</b><span class="dim" style="font-size:11.5px" title="Quotes refresh every ${S.policy.ttl} s and are never signed once stale">estimated ${clock(q.at)}</span></div><span class="grow"></span><button class="btn xs ghost" data-act="refreshq" type="button" aria-label="Refresh quote">${I.refresh}</button></div>
    <div class="qrow"><span>You receive about</span><b>${buy ? fmtQtyFull(q.outQty) + ' ' + tk.sym : fmtUsd(q.outUsd)}</b></div>
    <div class="qrow"><span>Minimum (slippage ${S.policy.slip.toFixed(1)}%)</span><b>${buy ? fmtQtyFull(q.minOut) + ' ' + tk.sym : fmtUsd(q.minOut)}</b></div>
    <div class="qrow"><span>Price impact (estimate)</span><b>${(q.imp * 100).toFixed(2)}%</b></div>
    <div class="qrow"><span>Route${t.real ? ' (simulated)' : ''}</span><b style="font-weight:500;text-align:right;font-size:12px">${esc(q.route)}</b></div>
    <div class="qrow"><span>Platform fee 0.40%</span><b>${fmtUsd(q.feeUsd)}</b></div>
    <div class="qrow"><span>Network fee</span><b title="Base ${BASE_LAMPORTS.toLocaleString()} + priority ${q.prioLam.toLocaleString()} lamports">${q.netSol.toFixed(6)} SOL · ${fmtUsd(q.netUsd)}</b></div>
    ${q.ataSol ? `<div class="qrow"><span>Token account deposit</span><b>${q.ataSol.toFixed(5)} SOL · refundable</b></div>` : ''}
    ${q.tax ? `<div class="qrow"><span>Token transfer fee ${(q.tax * 100).toFixed(2)}%</span><b class="wn">${fmtUsd(q.taxUsd)}</b></div>` : ''}
    <div class="qrow"><span class="dim" style="font-size:11.5px">Pool fees are inside the quoted amount and aren't charged twice.</span></div></div>`;
}
function polHTML(q) {
  if (!q || !q.ok) return '';
  const pc = policyCheck(q, S.ticket.ovr);
  return `<div class="pol" id="tkPol">${pc.items.map(i => `<div class="pc ${!i.ok ? (i.ovr ? 'ovr' : 'bad') : ''}"><span>${i.l} · limit ${i.lim}</span><b>${i.ok ? I.check.replace('<svg', '<svg style="width:12px;height:12px;color:var(--gain)"') : I.warn.replace('<svg', '<svg style="width:12px;height:12px"')}${i.v}${i.ovr ? ' · overridden' : ''}</b></div>`).join('')}</div>
    ${pc.blocked ? `<div class="blockmsg"><b>Blocked by your policy:</b> ${pc.failing.map(i => `${i.l.toLowerCase()} ${i.v} is above ${i.lim}`).join('; ')}. Lower the size${S.policy.allowOverride ? ', or hold to override this one order' : ''}.</div>${S.policy.allowOverride ? `<button class="btn block hold" data-hold="override" type="button"><span class="fill"></span>Hold to override for this order</button>` : ''}` : ''}`;
}
function ticketHTML() {
  ensureTicket(); const tk = S.ticket; const t = TOK[tk.sym]; const st = tokStats(tk.sym); const held = holdingQty(tk.sym);
  const x = tk.from ? getIdea(tk.from) : null;
  if (tk.phase === 'flight' || tk.phase === 'done') return flightHTML(tk);
  const q = tk.q; const pc = q && q.ok ? policyCheck(q, tk.ovr) : null; const buy = tk.side === 'buy';
  const est = q && q.ok ? (buy ? `≈ ${fmtQty(q.outQty)} ${tk.sym}` : `≈ ${fmtUsd(q.outUsd)} for ${fmtQty(q.inQty)} ${tk.sym}`) : (q && !q.ok ? 'No quote' : '');
  const cta = S.guest ? 'Create account to trade' : !q ? 'Enter an amount' : !q.ok ? 'No route' : pc.blocked ? 'Blocked by your policy' : (buy && q.usd > (S.acct?.cash || 0) + 1e-9) ? 'Not enough cash' : `${buy ? 'Buy' : 'Sell'} $${tk.sym}${pc.needsHold ? ' · hold to confirm' : ''}`;
  const disabled = !S.guest && (!q || !q.ok || pc.blocked);
  const short = !S.guest && q && q.ok && buy && q.usd > (S.acct?.cash || 0) + 1e-9;
  return `<div class="tp" id="tp">
    <div class="tp-tok">${logo(tk.sym, 38)}<div class="col" style="line-height:1.25;min-width:0"><b>$${tk.sym} <span class="dim" style="font-weight:500">${esc(t.name)}</span></b><span class="dim num" style="font-size:12px"><span data-live="mc" data-sym="${tk.sym}">${fmtUsdC(st.mcap)}</span> MC · <span data-live="px" data-sym="${tk.sym}">${fmtPxH(st.px)}</span></span></div><span class="grow"></span><a class="btn xs ghost" href="#token-${tk.sym.toLowerCase()}">Chart</a></div>
    <div class="tp-tabs" role="tablist"><button type="button" class="${buy ? 'on' : ''}" data-act="side" data-k="buy">Buy</button><button type="button" class="${!buy ? 'on' : ''}" data-act="side" data-k="sell">Sell${held ? '' : ''}</button></div>
    ${x ? `<div class="ctxbox">${avRing(x.a || 'you', 26)}<span>Trading after <b>${esc(CR[x.a]?.name || 'your')}</b>'s idea. Their signed wallets hold <b>${x.inv.qty ? Math.round(holdingsAt(x, Date.now()).rem / x.inv.qty * 100) + '%' : 'none'}</b> of what they had when posting${x.comp?.ext?.state === 'late' ? ', and paid promotion was disclosed late' : ''}. <a href="#idea-${x.id}" style="text-decoration:underline">Receipts</a></span></div>` : ''}
    <div class="tp-amt"><div class="amtin">${buy ? '<span>$</span>' : ''}<input id="tkAmt" type="text" inputmode="decimal" autocomplete="off" value="${esc(buy ? tk.amt : (tk.sellPct != null ? Math.round(tk.sellPct * 100) + '%' : tk.amt))}" style="${amtW(buy ? tk.amt : (tk.sellPct != null ? Math.round(tk.sellPct * 100) + '%' : tk.amt))}" data-input="amt" aria-label="${buy ? 'Amount in dollars' : 'Amount to sell'}" ${!buy && tk.sellPct != null ? 'readonly' : ''}></div><div class="est num" id="tkEst">${est}</div>${!buy ? `<div class="dim" style="font-size:11.5px">You hold ${fmtQty(held)} ${tk.sym}</div>` : `<div class="dim" style="font-size:11.5px">${S.guest ? 'Demo cash appears after sign-up' : 'Cash ' + fmtUsd(S.acct.cash)}</div>`}</div>
    <div class="tp-quick">${buy ? [10, 50, 200, 1000].map(v => `<button type="button" class="${parseFloat(tk.amt) === v ? 'on' : ''}" data-act="quick" data-v="${v}">$${v >= 1000 ? v / 1000 + 'K' : v}</button>`).join('') : [0.25, 0.5, 0.75, 1].map(v => `<button type="button" class="${tk.sellPct === v ? 'on' : ''}" data-act="sellpct" data-v="${v}">${v * 100}%</button>`).join('')}</div>
    ${buy ? `<div class="keypad" aria-label="Keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => `<button type="button" data-act="key" data-k="${k}">${k}</button>`).join('')}</div>` : ''}
    <div id="tkQuoteWrap">${quoteBoxHTML(tk)}</div>
    <div id="tkPolWrap">${polHTML(q)}</div>
    ${tk.err ? `<div class="blockmsg">${esc(tk.err)}</div>` : ''}
    ${short ? `<button class="btn pri lg block" data-act="deposit" type="button">Deposit to buy</button>` : `<button class="btn ${S.guest ? 'pri' : buy ? 'pri' : 'paper'} lg block ${pc?.needsHold && !disabled ? 'hold' : ''}" id="tkGo" ${S.guest ? 'data-act="signup"' : pc?.needsHold ? 'data-hold="confirm"' : 'data-act="go"'} type="button" ${disabled ? 'disabled' : ''}><span class="fill"></span>${esc(cta)}</button>`}
    <p class="note" style="margin:0">${S.guest ? 'Browsing doesn’t need an account. ' : `Trading from your FOMA wallet ${short2(S.acct.wallet)}, signed. `}Your limits apply on every buy button · ${S.sync === 'account' ? 'synced to your account' : 'saved on this device'} · <a href="#policy" style="text-decoration:underline">Edit limits</a></p>
  </div>`;
}
const short2 = a => short(a);
function flightHTML(tk) {
  const o = tk.order; const r = tk.receipt;
  const steps = o.steps.map(s => `<div class="rstep ${s.st}"><span class="ic">${s.st === 'done' ? I.check : s.st === 'fail' ? I.x : s.st === 'warn' ? I.warn : s.st === 'now' ? I.clock : I.dot}</span><span><b>${esc(s.l)}</b>${s.sub ? `<small>${s.sub}</small>` : ''}</span><span class="t" ${s.st === 'now' ? `data-since="${s.t0}"` : ''}>${s.ms != null && s.ms >= 5 ? dur(s.ms) : s.st === 'now' ? '…' : ''}</span></div>`).join('');
  return `<div class="tp" id="tp"><div class="tp-tok">${logo(tk.sym, 38)}<div class="col" style="line-height:1.25"><b>${o.side === 'buy' ? 'Buying' : 'Selling'} $${tk.sym}</b><span class="dim mono" style="font-size:11px">${o.id} · attempt ${o.attempt}</span></div><span class="grow"></span>${tk.phase === 'done' ? `<button class="btn xs" data-act="newticket" type="button">New order</button>` : ''}</div>
    <div class="rail" id="tkRail" aria-live="polite">${steps}</div>
    ${o.reconciling ? `<div class="ctxbox"><span class="radar"></span><span><b>Checking the chain before any retry.</b> A slow confirmation isn't a failure. FOMA looks up the signature first, so a retry can never buy twice.</span></div>` : ''}
    ${r ? `<div id="tkReceipt">${receiptHTML(r, !r._p)}</div>` : ''}${r ? (r._p = 1, '') : ''}
    ${tk.phase === 'done' && r && r.outcome === 'expired' ? `<button class="btn pri block" data-act="retry" type="button">${I.refresh}Retry safely, same order ID</button>` : ''}
    ${tk.phase === 'done' && r && r.outcome === 'failed' ? `<button class="btn block" data-act="newticket" type="button">Get a new quote</button>` : ''}
  </div>`;
}
function dockExtras() {
  const pp = S.paper.slice(0, 3).map(p => [p, paperState(p)]);
  return `<div class="col" style="gap:12px;margin-top:18px">
    <div class="card tight col" style="gap:8px"><div class="row between"><b style="font-size:13px">Paper portfolio</b><a class="btn xs ghost" href="#research">Open</a></div>${pp.length ? pp.map(([p, r]) => `<div class="row between" style="font-size:12.5px"><span class="row" style="gap:7px">${logo(p.sym, 20, false)}$${p.sym}</span><b class="${cls(r.ret)} num">${r.entry ? fmtPct(r.ret) : 'waiting'}</b></div>`).join('') : '<span class="dim" style="font-size:12.5px">Track any idea forward to test it before you fund it.</span>'}</div>
    <div class="card tight col" style="gap:6px"><b style="font-size:13px">Data on this page</b><span class="dim" style="font-size:12px;line-height:1.5">Real tokens: CoinGecko snapshot from ${dstamp(SNAP_TS)}. Demo launches update every 2.5 s on simulated quotes. Creators, wallets and fills are simulated.</span></div></div>`;
}
function renderDock() {
  const el = $('#dock'); if (!el) return; ensureTicket(); const tk = S.ticket; const q = tk.q;
  const peek = `<button class="sheet-peek" data-act="dock-toggle" type="button" aria-label="Open trade panel">${logo(tk.sym, 30, false)}<span class="col" style="line-height:1.2;text-align:left"><b>${tk.phase === 'flight' ? 'Order in flight' : (tk.side === 'buy' ? 'Buy' : 'Sell') + ' $' + tk.sym}</b><span class="dim" style="font-size:11.5px">${q && q.ok ? (q.imp * 100).toFixed(2) + '% impact · ' + fmtUsd(q.usd, 0) : 'Tap to trade'}</span></span><span class="grow"></span><span class="btn sm pri">${S.ui.dockOpen ? 'Close' : 'Trade'}</span></button>`;
  el.innerHTML = peek + ticketHTML() + (S.route.v === 'discover' || S.route.v === 'following' ? dockExtras() : '');
  syncDockClass();
}
function syncDockClass() {
  const el = $('#dock'); if (!el) return; const ph = isPhone(); const v = S.route.v;
  const ctx = ['token', 'idea'].includes(v);
  el.classList.toggle('open', ph && S.ui.dockOpen);
  el.classList.toggle('gone', ph && !ctx && !S.ui.dockOpen);
  document.body.classList.toggle('sheet-open', ph && S.ui.dockOpen);
}
function refreshQuote(soft) {
  const tk = S.ticket; if (!tk || tk.phase === 'flight' || tk.phase === 'done') return;
  tk.q = liveQuote(tk); tk.err = null;
  const qw = $('#tkQuoteWrap'), pw = $('#tkPolWrap');
  if (qw && pw && soft) { qw.innerHTML = quoteBoxHTML(tk); pw.innerHTML = polHTML(tk.q); updateCta(); const est = $('#tkEst'); if (est) est.textContent = tk.q && tk.q.ok ? (tk.side === 'buy' ? `≈ ${fmtQty(tk.q.outQty)} ${tk.sym}` : `≈ ${fmtUsd(tk.q.outUsd)} for ${fmtQty(tk.q.inQty)} ${tk.sym}`) : (tk.q ? 'No quote' : ''); }
  else renderDock();
}
function updateCta() {
  const b = $('#tkGo'); const tk = S.ticket; if (!b || !tk) return; const q = tk.q; if (S.guest) return;
  const pc = q && q.ok ? policyCheck(q, tk.ovr) : null; const short = q && q.ok && tk.side === 'buy' && q.usd > (S.acct?.cash || 0) + 1e-9;
  if (short) return renderDock();
  const dis = !q || !q.ok || pc.blocked; b.disabled = dis;
  b.lastChild.textContent = !q ? 'Enter an amount' : !q.ok ? 'No route' : pc.blocked ? 'Blocked by your policy' : `${tk.side === 'buy' ? 'Buy' : 'Sell'} $${tk.sym}${pc.needsHold ? ' · hold to confirm' : ''}`;
  b.classList.toggle('hold', !!pc?.needsHold && !dis);
  if (pc?.needsHold) { b.removeAttribute('data-act'); b.setAttribute('data-hold', 'confirm'); } else { b.removeAttribute('data-hold'); b.setAttribute('data-act', 'go'); }
}
function tickTicket() {
  const tk = S.ticket; if (!tk || tk.phase !== 'idle' || !tk.q || !tk.q.ok) return;
  const ttl = S.policy.ttl * 1000; const age = Date.now() - tk.q.at; const ring = $('#tkRing');
  if (age >= ttl) { refreshQuote(true); const qb = $('#tkQ'); if (qb && !S.rm) { qb.animate([{ boxShadow: '0 0 0 1px var(--lime-b)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 700 }); } return; }
  if (ring) { const C = 2 * Math.PI * 11; const left = ttl - age; ring.querySelector('.fgc').style.strokeDashoffset = C * (1 - left / ttl); ring.querySelector('b').textContent = Math.ceil(left / 1000); ring.classList.toggle('stale', left < 3000); }
  $$('[data-since]').forEach(el => { el.textContent = dur(performance.now() - parseFloat(el.dataset.since)); });
}
setInterval(() => { tickTicket(); $$('#tkRail [data-since]').forEach(el => { el.textContent = dur(performance.now() - parseFloat(el.dataset.since)); }); }, 200);

// ---------- order flow (simulated chain, honest states) ----------
function step(o, key, l, st, sub) { let s = o.steps.find(x => x.key === key); const now = performance.now(); if (!s) { s = { key, l, st, sub, t0: now }; o.steps.push(s); } else { Object.assign(s, { l, st, sub: sub ?? s.sub }); } if (st !== 'now' && s.ms == null && st !== 'pending') s.ms = now - s.t0; if (st === 'now') s.t0 = now; renderDockFlight(); return s; }
function renderDockFlight() { const el = $('#dock'); if (!el) return; const tp = $('#tp'); if (tp) tp.outerHTML = flightHTML(S.ticket); else renderDock(); }
async function placeOrder() {
  const tk = S.ticket; if (!tk || tk.phase === 'flight') return;
  if (S.guest) return openSignup({ then: 'trade' });
  let q = tk.q;
  if (!q || !q.ok) return;
  if (Date.now() - q.at > S.policy.ttl * 1000) { refreshQuote(true); q = tk.q; toast('Quote was older than your freshness limit, so it refreshed before signing.'); if (!q.ok) return; }
  const pc = policyCheck(q, tk.ovr); if (pc.blocked) return;
  if (q.side === 'buy' && q.usd > S.acct.cash + 1e-9) { tk.err = `Not enough cash: you have ${fmtUsd(S.acct.cash)}.`; return renderDock(); }
  const o = { id: tk.key && tk.prevId ? tk.prevId : 'ord_' + b58(8), key: tk.key || 'idem_' + b58(10), attempt: tk.attempt || 1, side: q.side, sym: tk.sym, q, steps: [], policy: { ...S.policy }, overrides: tk.ovr ? pc.items.filter(i => i.ovr).map(i => ({ k: i.k, l: i.l, v: i.v, lim: i.lim, at: tk.ovr.at })) : [], from: tk.from, net: S.net, wall: Date.now() };
  tk.order = o; tk.phase = 'flight'; tk.receipt = null; tk.prevId = o.id; tk.key = o.key; S.ui.dockOpen = isPhone() ? true : S.ui.dockOpen; renderDock();
  const sig = b58(88);
  step(o, 'lock', 'Quote locked', 'done', `Age ${((Date.now() - q.at) / 1000).toFixed(1)} s, limit ${S.policy.ttl} s`);
  const checks = ['Assets match the ticket', 'Amount and fees match', 'Recipient is your wallet', 'Minimum output is enforced', 'Within your policy'];
  const chk = step(o, 'checks', 'Checks before signing', 'now', checks.map((c, i) => `<span data-c="${i}">○ ${c}</span>`).join('<br>'));
  for (let i = 0; i < checks.length; i++) { await sleep(95 + rand() * 60); chk.sub = checks.map((c, j) => j <= i ? `✓ ${c}` : `○ ${c}`).join('<br>'); renderDockFlight(); }
  step(o, 'checks', 'Checks passed', 'done', checks.map(c => '✓ ' + c).join('<br>'));
  step(o, 'sign', 'Signing with your FOMA wallet', 'now'); await sleep(280 + rand() * 160);
  const signedAt = Date.now(); step(o, 'sign', 'Signed', 'done', 'Signature stays in the wallet boundary; FOMA never sees keys.');
  const slot = curSlot(); const submitAt = Date.now(); const t0 = performance.now();
  step(o, 'submit', 'Submitted', 'done', `<span class="mono">${sig.slice(0, 20)}…</span> · slot ${slot.toLocaleString()}`);
  const net = S.net; const sigma = (net === 'volatile' ? 0.014 : net === 'congested' ? 0.005 : TOK[tk.sym].demo ? 0.0035 : 0.0012);
  let delay = net === 'congested' ? 2200 + rand() * 9000 : net === 'volatile' ? 600 + rand() * 1500 : 420 + rand() * 1100;
  const move = gauss() * sigma;
  const conf = step(o, 'confirm', 'Waiting for confirmation', 'now', 'A pending transaction is not a completed trade.');
  const timeout = 8000; let landed = true, late = false;
  if (delay > timeout) {
    await sleep(timeout); step(o, 'confirm', 'Not confirmed after 8 s', 'warn', 'Still uncertain, so no retry yet.');
    o.reconciling = true; step(o, 'recon', 'Reconciling with the chain', 'now', 'Looking up the signature and its blockhash window'); await sleep(1500 + rand() * 1200); o.reconciling = false;
    landed = rand() < 0.62; late = true;
    step(o, 'recon', landed ? 'Found on chain: it landed' : 'Not on chain, blockhash expired', landed ? 'done' : 'warn', landed ? 'Confirmed late. Nothing to retry.' : 'It can never land now. No funds moved.');
  } else await sleep(delay);
  const confirmMs = performance.now() - t0;
  const r = baseReceipt(q, o, Date.now()); Object.assign(r, { sig, slot, signedAt, submitAt, move, net });
  if (!landed) { Object.assign(r, { outcome: 'expired', err: 'Not confirmed in time. FOMA checked the chain: the signature never landed and its blockhash expired, so it never can. No funds moved.', outQty: 0, outUsd: 0, feeCharged: false }); step(o, 'confirm', 'Expired, no funds moved', 'warn', 'Retry uses the same order ID, so it cannot execute twice.'); }
  else {
    const buy = q.side === 'buy'; const actual = buy ? q.outQty * (1 - move) : q.outUsd * (1 - move);
    if (actual < q.minOut) { Object.assign(r, { outcome: 'failed', err: `Price moved ${(move * 100).toFixed(2)}% against you while in flight, beyond your ${S.policy.slip.toFixed(1)}% slippage limit. No tokens were exchanged.`, code: 'custom program error 0x1771 (slippage tolerance exceeded)', feeCharged: true, outQty: 0, outUsd: 0, confirmMs }); step(o, 'confirm', 'Failed: slippage limit', 'fail', 'Minimum output protected you. Network fee was still charged.'); }
    else {
      Object.assign(r, { outcome: 'confirmed', confirmMs, confirmAt: Date.now(), late });
      if (buy) { r.outQty = actual; S.acct.cash -= q.usd; (S.acct.lots[tk.sym] = S.acct.lots[tk.sym] || []).push({ qty: actual, cost: q.usd - q.ataUsd, t: Date.now(), id: r.id }); S.acct.rentSol = (S.acct.rentSol || 0) + q.ataSol; }
      else { r.outUsd = actual; r.inQty = q.inQty; sellLots(tk.sym, q.inQty); S.acct.cash += actual; }
      step(o, 'confirm', `Confirmed in ${dur(confirmMs)}`, 'done', `Slot ${(slot + Math.max(1, Math.round(confirmMs / 400))).toLocaleString()} · commitment: confirmed`);
      setTimeout(() => { r.finalized = true; r.finalSlot = slot + 32; Persist.save('account'); const el = $('#tkReceipt .stamp'); if (el && S.ticket?.receipt === r) el.textContent = 'FINAL'; }, 12800);
    }
  }
  if (r.feeCharged === undefined) r.feeCharged = r.outcome !== 'expired';
  S.acct.receipts.push(r); S.session.orders.push({ outcome: r.outcome, confirmMs: r.outcome === 'confirmed' ? r.confirmMs : null }); S.acct.reconAt = Date.now();
  Persist.save('account');
  tk.receipt = r; tk.phase = 'done'; tk.ovr = null; if (r.outcome !== 'expired') { tk.key = null; tk.attempt = 1; tk.prevId = null; } else tk.attempt = (tk.attempt || 1) + 1;
  renderDock(); renderTop(); updateLive();
  const ok = r.outcome === 'confirmed';
  toast(ok ? `${r.side === 'buy' ? 'Bought' : 'Sold'} ${r.side === 'buy' ? fmtQty(r.outQty) + ' ' + r.sym : fmtQty(r.inQty) + ' ' + r.sym + ' for ' + fmtUsd(r.outUsd)}` : r.outcome === 'failed' ? 'Order failed safely: price moved past your slippage limit' : 'Order expired. No funds moved.', { label: 'Receipt', fn: () => openReceipt(r.id) });
  if (['portfolio', 'token'].includes(S.route.v)) renderStage();
}
function sellLots(sym, qty) { const L = S.acct.lots[sym] || []; let left = qty; for (const l of L) { if (left <= 0) break; const take = Math.min(l.qty, left); if (l.cost != null) l.cost *= (l.qty - take) / l.qty; l.qty -= take; left -= take; } S.acct.lots[sym] = L.filter(l => l.qty > 1e-9); }
function baseReceipt(q, o, t) {
  return { id: o.id, key: o.key, attempt: o.attempt, t, sym: q.sym, side: q.side, usd: q.usd, inQty: q.inQty, quotedOut: q.side === 'buy' ? q.outQty : q.outUsd, minOut: q.minOut, px: q.px, imp: q.imp, quoteAt: q.at, feeUsd: q.feeUsd, netSol: q.netSol, netUsd: q.netUsd, prioLam: q.prioLam, ataSol: q.ataSol, ataUsd: q.ataUsd, tax: q.tax, taxUsd: q.taxUsd, route: q.route, policy: { slip: o.policy.slip, impact: o.policy.impact, maxSize: o.policy.maxSize, maxFee: o.policy.maxFee, ttl: o.policy.ttl }, overrides: o.overrides || [], from: o.from, net: o.net, totalFees: q.totalFees, real: TOK[q.sym].real };
}

// ---------- receipts ----------
function receiptHTML(r, printing) {
  const buy = r.side === 'buy'; const ok = r.outcome === 'confirmed';
  const st = ok ? (r.finalized ? 'FINAL' : 'CONFIRMED') : r.outcome === 'failed' ? 'FAILED' : 'EXPIRED';
  const diff = ok ? ((buy ? r.outQty : r.outUsd) / r.quotedOut - 1) * 100 : 0;
  const x = r.from ? getIdea(r.from) : null;
  const pol = [['Size', fmtUsd(r.usd), fmtUsd(r.policy.maxSize, 0), r.usd <= r.policy.maxSize, 'size'], ['Slippage', r.policy.slip.toFixed(1) + '%', 'policy', true, 'slip'], ['Impact', (r.imp * 100).toFixed(2) + '%', r.policy.impact.toFixed(1) + '%', r.imp * 100 <= r.policy.impact, 'impact'], ['Fees', fmtUsd(r.totalFees), fmtUsd(r.policy.maxFee), r.totalFees <= r.policy.maxFee, 'fee']];
  return `<div class="rwrap"><div class="receipt ${printing && !S.rm ? 'print' : ''}" role="document" aria-label="Receipt ${r.id}">
    <div class="rh"><div><b>FOMA</b><div class="sub">RECEIPT · ${r.id}</div><div class="sub">attempt ${r.attempt} · ${dstamp(r.t)}</div></div><span class="stamp ${ok ? 'ok' : r.outcome === 'failed' ? 'bad' : 'pend'}">${st}</span></div>
    <div class="big">${ok ? (buy ? `Bought ${fmtQtyFull(r.outQty)} ${r.sym}` : `Sold ${fmtQtyFull(r.inQty)} ${r.sym}`) : 'No tokens exchanged'}</div>
    <div class="sub">${buy ? `for ${fmtUsd(r.usd)} USDC` : ok ? `for ${fmtUsd(r.outUsd)} USDC` : ''}${x ? ` · opened from ${esc(CR[x.a]?.name || 'your')}'s idea (v${x.v.length})` : ''}</div>
    ${r.err ? `<div class="hr"></div><div class="${r.outcome === 'failed' ? 'bad' : 'wrn'}">${esc(r.err)}</div>${r.code ? `<div class="sub">${esc(r.code)}</div>` : ''}` : ''}
    <div class="hr"></div><h4>Quote and fill</h4>
    <div class="rr"><span>Quoted output</span><span>${buy ? fmtQtyFull(r.quotedOut) + ' ' + r.sym : fmtUsd(r.quotedOut)}</span></div>
    <div class="rr"><span>Minimum accepted</span><span>${buy ? fmtQtyFull(r.minOut) : fmtUsd(r.minOut)}</span></div>
    <div class="rr"><span>Actually received</span><span>${ok ? (buy ? fmtQtyFull(r.outQty) : fmtUsd(r.outUsd)) + ` <span class="${diff >= 0 ? 'ok' : 'bad'}">(${fmtPct(diff, 2)})</span>` : '0'}</span></div>
    <div class="rr"><span>Reference quote</span><span>${clock(r.quoteAt, true)} · ${fmtPx(r.px)}</span></div>
    ${r.submitAt ? `<div class="rr"><span>Submitted</span><span>${clock(r.submitAt, true)} · slot ${(r.slot || 0).toLocaleString()}</span></div>` : ''}
    ${ok ? `<div class="rr"><span>Confirmed</span><span>${clock(r.confirmAt || r.t, true)} · ${dur(r.confirmMs)}${r.late ? ' (late)' : ''}</span></div><div class="rr"><span>Finalized</span><span>${r.finalized ? 'slot ' + (r.finalSlot || 0).toLocaleString() : 'pending (~13 s)'}</span></div>` : ''}
    <div class="hr"></div><h4>Costs</h4>
    <div class="rr"><span>Platform fee 0.40%</span><span>${ok ? fmtUsd(r.feeUsd) : '$0.00 (not charged)'}</span></div>
    <div class="rr"><span>Network fee</span><span>${r.feeCharged || ok ? r.netSol.toFixed(6) + ' SOL · ' + fmtUsd(r.netUsd) : 'not charged'}</span></div>
    <div class="sub" style="text-align:right">base ${BASE_LAMPORTS.toLocaleString()} + priority ${(r.prioLam || 0).toLocaleString()} lamports</div>
    ${r.ataSol ? `<div class="rr"><span>Token account deposit</span><span>${ok ? r.ataSol.toFixed(8) + ' SOL · refundable' : 'not charged'}</span></div>` : ''}
    <div class="rr"><span>Token transfer fee</span><span>${r.tax ? (r.tax * 100).toFixed(2) + '% · ' + fmtUsd(ok ? r.taxUsd : 0) : 'none'}</span></div>
    <div class="rr"><span>Pool fees</span><span>inside quoted output</span></div>
    <div class="hr"></div><h4>Why the price was what it was</h4>
    <div class="rr"><span>Estimated impact at quote</span><span>${(r.imp * 100).toFixed(2)}%</span></div>
    <div class="rr"><span>Quote-to-fill movement</span><span>${r.move != null && r.outcome !== 'expired' ? `${fmtPct(-r.move * 100, 2)} ${r.move > 0 ? 'against you' : 'in your favor'}` : 'n/a'}</span></div>
    <div class="rr"><span>Priority-fee competition, MEV</span><span>not observable: unknown</span></div>
    <div class="hr"></div><h4>Your policy</h4>
    ${pol.map(([l, v, lim, okk, k]) => { const ov = (r.overrides || []).find(o => o.k === k); return `<div class="rr"><span>${l} ${v} · limit ${lim}</span><span class="${okk ? 'ok' : ov ? 'wrn' : 'bad'}">${okk ? 'within' : ov ? 'overridden by you ' + clock(ov.at) : 'over'}</span></div>`; }).join('')}
    <div class="hr"></div>
    <div class="rr"><span>Route${r.real ? ' (simulated)' : ''}</span><span>${esc(r.route)}</span></div>
    ${r.sig ? `<div class="sub" style="margin-top:6px">Signature</div><div class="sig">${r.sig}</div>` : ''}
    <div class="sub" style="margin-top:6px">Idempotency key ${r.key} · network: ${r.net}</div>
    <div class="sub" style="margin-top:8px">Prototype receipt on a simulated chain. No real funds moved.</div>
    <div class="ract"><button type="button" data-act="support" data-id="${r.id}">Get help with this order</button><button type="button" data-act="saveimg" data-id="${r.id}">Save image</button><button type="button" data-act="copysum" data-id="${r.id}">Copy summary</button></div>
  </div></div>`;
}
const findReceipt = id => (S.acct?.receipts || []).find(r => r.id === id) || (S.ticket?.receipt?.id === id ? S.ticket.receipt : null);
function openReceipt(id) { const r = findReceipt(id); if (!r) return; openModal(`<div class="mc-h"><h3>Receipt</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>${receiptHTML(r, true)}`); }
function receiptSummary(r) { return `FOMA receipt ${r.id} (attempt ${r.attempt}) · ${r.outcome.toUpperCase()}\n${r.side === 'buy' ? `Buy ${r.sym} for ${fmtUsd(r.usd)}` : `Sell ${fmtQtyFull(r.inQty)} ${r.sym}`}\nQuoted ${r.side === 'buy' ? fmtQtyFull(r.quotedOut) + ' ' + r.sym : fmtUsd(r.quotedOut)} · min ${r.side === 'buy' ? fmtQtyFull(r.minOut) : fmtUsd(r.minOut)} · received ${r.outcome === 'confirmed' ? (r.side === 'buy' ? fmtQtyFull(r.outQty) : fmtUsd(r.outUsd)) : '0'}\nQuote ${clock(r.quoteAt, true)} · submitted ${r.submitAt ? clock(r.submitAt, true) : '—'} · ${r.confirmMs ? 'confirmed in ' + dur(r.confirmMs) : r.outcome}\nFees: platform ${fmtUsd(r.feeUsd)}, network ${r.netSol.toFixed(6)} SOL${r.tax ? ', token fee ' + (r.tax * 100).toFixed(2) + '%' : ''}\nImpact ${(r.imp * 100).toFixed(2)}% · route ${r.route}\nSignature ${r.sig || '—'}\nPrototype: simulated chain, no real funds.`; }
function drawReceiptCanvas(r) {
  const lines = receiptSummary(r).split('\n'); const W = 760, Hh = 140 + lines.length * 34; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
  c.fillStyle = '#EFE8D8'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#1E1A14'; c.font = '600 34px Geist, system-ui, sans-serif'; c.fillText('FOMA', 40, 64);
  c.font = '600 18px "Geist Mono", ui-monospace, monospace'; c.fillStyle = r.outcome === 'confirmed' ? '#2E6B12' : r.outcome === 'failed' ? '#B3261E' : '#8A5A00'; c.fillText(r.outcome.toUpperCase(), W - 190, 62);
  c.fillStyle = '#1E1A14'; c.font = '16px "Geist Mono", ui-monospace, monospace'; lines.forEach((l, i) => { let s = l; while (c.measureText(s).width > W - 80 && s.length > 4) s = s.slice(0, -2); c.fillText(s === l ? s : s + '…', 40, 116 + i * 34); });
  c.fillStyle = '#0B0A09'; for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, Hh); c.lineTo(x + 8, Hh - 8); c.lineTo(x + 16, Hh); c.fill(); }
  return cv;
}
async function saveCanvas(cv, filename) {
  if (!CAP.dl) { toast('Saving files isn’t available in this view. Use "Copy summary" instead.'); return; }
  cv.toBlob(async b => { try { await CAP.dl.save({ filename, data: b }); toast('Saved'); } catch (e) { if (e?.code === 'declined') return; toast(e?.code === 'rate_limited' ? 'A save prompt is already open.' : 'Saving isn’t available here right now.'); } }, 'image/png');
}

// ---------- funding & onboarding ----------
function openSignup(o = {}) {
  openModal(`<div class="mc-h"><div class="col" style="gap:4px"><span class="tag">Demo account</span><h3>Start trading in seconds</h3></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <p class="note" style="margin:0">Prototype: nothing is created on a real server and no personal data leaves this page.</p>
    <button class="opt" data-act="create" data-m="apple" type="button"><span class="oi" style="background:#F5F1EA;color:#0B0A09">${I.apple}</span><span><b>Continue with Apple</b><span>Creates a FOMA wallet you control</span></span></button>
    <button class="opt" data-act="create" data-m="google" type="button"><span class="oi" style="background:#F5F1EA;color:#0B0A09">${I.google}</span><span><b>Continue with Google</b><span>Same, with Google sign-in</span></span></button>
    <div class="row" style="gap:10px"><span class="divider grow"></span><span class="dim" style="font-size:12px">or</span><span class="divider grow"></span></div>
    <button class="opt" data-act="linkwallet" type="button"><span class="oi">${I.link}</span><span><b>Link a wallet you already use</b><span>Read-only. See your history and record without moving funds.</span></span></button>
    <label class="row panel between"><span><b style="font-size:13px">Start with sample history</b><br><span class="dim" style="font-size:12px">Example deposits, receipts (incl. a failed and an expired order) and a transfer with unknown cost.</span></span><span class="switch"><input type="checkbox" id="sampleHist" checked><i></i></span></label>
    <p class="note" style="margin:0">FOMA never asks for a seed phrase. Anyone who does is trying to take your funds.</p>`);
  S.ui.afterSignup = o.then || null;
}
function createAccount(method) {
  const sample = $('#sampleHist') ? $('#sampleHist').checked : true;
  S.acct = makeAccount(sample); S.guest = false; S.profile.method = method; Persist.save('account'); Persist.save('social');
  if (!S.paper.length && sample) seedPaper();
  closeAll(); renderTop(); renderStage(); renderLeft(); if (S.ticket) { S.ticket.q = liveQuote(S.ticket); } renderDock();
  toast(sample ? 'Demo account ready with sample history and ' + fmtUsd(S.acct.cash) + ' demo cash' : 'Account created. Add demo funds to trade.', sample ? null : { label: 'Deposit', fn: openDeposit });
  if (!sample) setTimeout(openDeposit, 400);
}
function openDeposit() {
  if (S.guest) return openSignup({ then: 'deposit' });
  const m = openModal(`<div class="mc-h"><div class="col" style="gap:4px"><span class="tag">Add funds · demo</span><h3>Deposit</h3></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <form class="col" style="gap:12px" data-submit="deposit" id="depForm"><div class="tp-amt"><div class="amtin"><span>$</span><input id="depAmt" name="amt" type="text" inputmode="decimal" value="500" aria-label="Deposit amount" autocomplete="off"></div><div class="est">Arrives as USDC in your FOMA wallet</div></div>
    <div class="tp-quick">${[100, 250, 500, 1000].map(v => `<button type="button" data-act="depq" data-v="${v}">$${v >= 1000 ? '1K' : v}</button>`).join('')}</div>
    <div class="col" style="gap:8px"><button type="button" class="opt on" data-act="depm" data-m="Apple Pay (demo)"><span class="oi" style="background:#F5F1EA;color:#0B0A09">${I.apple}</span><span><b>Apple Pay</b><span>Simulated in this prototype</span></span></button><button type="button" class="opt" data-act="depm" data-m="Card (demo)"><span class="oi">${I.portfolio}</span><span><b>Debit card</b><span>Simulated</span></span></button><button type="button" class="opt" data-act="depm" data-m="Wallet transfer"><span class="oi">${I.transfer}</span><span><b>Send USDC or SOL from a wallet</b><span>To ${short(S.acct.wallet)}</span></span></button></div>
    <div id="depProg"></div><button class="btn pri lg block" type="submit">Add funds</button>
    <p class="note" style="margin:0">Pending deposits show as pending until confirmed. They never count as profit.</p></form>`);
  m.dataset.method = 'Apple Pay (demo)';
}
async function runDeposit(form) {
  const usd = Math.round(parseFloat(form.amt.value) * 100) / 100; if (!(usd > 0) || usd > 50000) { toast('Enter an amount between $1 and $50,000.'); return; }
  const mc = form.closest('.mc'); const method = mc.dataset.method || 'Apple Pay (demo)';
  const f = { id: 'dep_' + b58(6), kind: 'deposit', method, usd, t: Date.now(), status: 'pending', stage: 'Authorizing payment', p: .1 };
  S.acct.funding.push(f); Persist.save('account'); const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
  const stages = method === 'Wallet transfer' ? [['Waiting for your transfer', .3, 900], ['Seen on chain · confirming', .7, 1300], ['Confirmed', 1, 700]] : [['Authorizing payment', .25, 800], ['Buying USDC', .55, 1100], ['Sending to your wallet · slot ' + curSlot().toLocaleString(), .85, 1200], ['Confirmed', 1, 500]];
  for (const [st, p, ms] of stages) { f.stage = st; f.p = p; const pr = $('#depProg'); if (pr) pr.innerHTML = `<div class="pend">${I.clock.replace('<svg', '<svg style="width:16px;height:16px;color:var(--warn)"')}<span class="grow"><b>${esc(st)}</b><div class="prog" style="margin-top:6px"><i style="width:${p * 100}%"></i></div></span></div>`; if (S.route.v === 'portfolio') renderStage(); await sleep(ms); }
  f.status = 'confirmed'; f.stage = 'Confirmed'; S.acct.cash += usd; S.acct.reconAt = Date.now(); Persist.save('account');
  closeAll(); renderTop(); if (S.ticket) { S.ticket.q = liveQuote(S.ticket); S.ticket.err = null; } renderDock(); if (['portfolio', 'discover'].includes(S.route.v)) renderStage();
  toast(`Deposit confirmed. ${fmtUsd(usd)} is ready to trade.`);
}
function openWithdraw() {
  if (S.guest) return openSignup();
  openModal(`<div class="mc-h"><h3>Withdraw · demo</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <form class="col" style="gap:12px" data-submit="withdraw"><div class="field"><label for="wdAmt">Amount (USDC)</label><input class="input" id="wdAmt" name="amt" inputmode="decimal" value="${Math.min(100, Math.floor(S.acct.cash))}"></div><div class="field"><label for="wdTo">Destination Solana address</label><input class="input mono" id="wdTo" name="to" placeholder="Paste a wallet address" autocomplete="off"></div>
    <p class="note" style="margin:0">Available: ${fmtUsd(S.acct.cash)}. The amount is held from your balance while the withdrawal is pending, and you can see each stage in Portfolio.</p><button class="btn pri block" type="submit">Withdraw</button></form>`);
}
async function runWithdraw(form) {
  const usd = Math.round(parseFloat(form.amt.value) * 100) / 100; const to = form.to.value.trim();
  if (!(usd > 0) || usd > S.acct.cash) { toast(`Enter an amount up to ${fmtUsd(S.acct.cash)}.`); return; }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to)) { toast('That doesn’t look like a Solana address. Check for missing characters.'); return; }
  S.acct.cash -= usd; const f = { id: 'wd_' + b58(6), kind: 'withdraw', method: 'To ' + short(to), usd, t: Date.now(), status: 'pending', stage: 'Queued', p: .2 }; S.acct.funding.push(f); Persist.save('account'); closeAll(); location.hash = 'portfolio'; S.ui.port = 'funding'; renderTop();
  for (const [st, p, ms] of [['Queued', .2, 900], ['Broadcast · slot ' + curSlot().toLocaleString(), .6, 1400], ['Confirming', .85, 1200]]) { f.stage = st; f.p = p; if (S.route.v === 'portfolio') renderStage(); await sleep(ms); }
  f.status = 'confirmed'; f.stage = 'Confirmed'; Persist.save('account'); if (S.route.v === 'portfolio') renderStage(); toast(`Withdrawal of ${fmtUsd(usd)} confirmed`);
}
function openLinkWallet() {
  const W = LOGOS.wallets || {};
  openModal(`<div class="mc-h"><div class="col" style="gap:4px"><span class="tag">Read-only</span><h3>Link a wallet</h3></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <p class="note" style="margin:0">Linking lets FOMA show public activity for an address. It can't move funds. FOMA never asks for a seed phrase.</p>
    ${[['phantom', 'Phantom'], ['solflare', 'Solflare'], ['backpack', 'Backpack']].map(([k, l]) => `<button class="opt" data-act="wlink" data-w="${l}" type="button">${W[k] ? `<img src="${W[k]}" alt="">` : `<span class="oi">${I.link}</span>`}<span><b>${l}</b><span>Connect (simulated in this prototype)</span></span></button>`).join('')}
    <form class="col" style="gap:8px" data-submit="paste"><label class="flabel" for="pasteAddr">Or paste any public address</label><div class="row"><input class="input mono" id="pasteAddr" name="addr" placeholder="e.g. 4tVq…" autocomplete="off"><button class="btn" type="submit">Link</button></div></form>`);
}
function linkWallet(addr, via) {
  if (S.guest) { S.acct = makeAccount(false); S.guest = false; Persist.save('account'); }
  S.profile.wallets = S.profile.wallets || [];
  if (S.profile.wallets.some(w => w.addr === addr)) { toast('That wallet is already linked'); return; }
  S.profile.wallets.push({ addr, via, linked: Date.now(), signed: null, pub: false, rec: false }); Persist.save('social');
  const i = S.profile.wallets.length - 1; closeAll(); renderTop();
  openModal(`<div class="mc-h"><h3>Linked read-only</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><div class="code">${addr}</div><p class="lede" style="font-size:13.5px">FOMA can now show this address's public activity. Nothing is public on your profile until you choose. To count this wallet toward your record, prove you control it with a free signature.</p><div class="row wrap"><button class="btn pri" data-act="prove" data-i="${i}" type="button">Prove ownership</button><button class="btn" data-act="close" type="button">Not now</button></div>`);
  if (S.route.v === 'profile') renderStage();
}
function openProve(i) {
  const w = S.profile.wallets[i]; if (!w) return; const now = new Date(); const exp = new Date(Date.now() + 10 * MIN);
  const msg = `foma.cash wants you to prove you control this Solana account:\n${w.addr}\n\nPurpose: link this address to your FOMA profile.\nThis signature does not authorize any transaction or spending.\n\nURI: https://foma.cash\nVersion: 1\nChain ID: mainnet\nNonce: ${b58(12)}\nIssued At: ${now.toISOString()}\nExpiration Time: ${exp.toISOString()}`;
  closeAll(); openModal(`<div class="mc-h"><div class="col" style="gap:4px"><span class="tag">Ownership challenge</span><h3>Sign this message</h3></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><p class="note" style="margin:0">Your wallet will show exactly this text. Signing a message costs nothing and can't move funds. If a wallet ever asks you to approve a transaction here, reject it.</p><div class="code">${esc(msg)}</div><button class="btn pri block" data-act="dosign" data-i="${i}" type="button">Sign message (simulated)</button><p class="note" style="margin:0">Signed control proves control at the time of signing. It can't prove you have no other wallets.</p>`);
}

// ---------- paper tracking ----------
function seedPaper() {
  const mk = (ideaId, hoursAgo, every) => { const x = IDX[ideaId]; const added = Math.max(x.pubT + 60e3, Date.now() - hoursAgo * H); const p = { id: 'pp_' + b58(6), ideaId, sym: x.sym, added, rules: { ...x.paper }, q: [] }; for (let t = added + 30e3; t < Date.now(); t += every) { const r = rand(); if (r < 0.03) p.q.push({ t, ok: false, err: 'Quote timed out' }); else if (r < 0.05 && TOK[x.sym].demo) p.q.push({ t, ok: false, err: 'No route at this size' }); else p.q.push({ t, ok: true, px: priceAt(x.sym, t), imp: impactFor(x.sym, p.rules.notional) }); } return p; };
  S.paper = [mk('moth-kestrel', 50, 30 * MIN), mk('fart-tidewatcher', 60, 45 * MIN), mk('wif-marginalia', 90, 60 * MIN)]; Persist.save('research');
}
function trackForward(id) {
  const x = getIdea(id); if (!x || !x.paper) return;
  if (S.paper.some(p => p.ideaId === id)) { toast('Already tracking this idea', { label: 'Open', fn: () => { location.hash = 'research'; } }); return; }
  S.paper.unshift({ id: 'pp_' + b58(6), ideaId: id, sym: x.sym, added: Date.now(), rules: { ...x.paper }, q: [] }); Persist.save('research');
  toast(`Tracking $${x.sym} forward: entry in ${x.paper.delay} s at ${fmtUsd(x.paper.notional, 0)}, rules frozen now`, { label: 'Open', fn: () => { location.hash = 'research'; } });
  renderStage(); renderDock();
}
function paperTick() {
  let changed = false;
  for (const p of S.paper) {
    const st = paperState(p); if (st.closed) continue;
    const t = TOK[p.sym]; const r = rand();
    if (S.net === 'outage' && t.demo && r < 0.6) p.q.push({ t: Date.now(), ok: false, err: 'No route at this size' });
    else if (r < 0.025) p.q.push({ t: Date.now(), ok: false, err: 'Quote timed out' });
    else p.q.push({ t: Date.now(), ok: true, px: pxNow(p.sym), imp: impactFor(p.sym, p.rules.notional) });
    if (p.q.length > 240) p.q.splice(0, p.q.length - 240); changed = true;
  }
  if (changed) { Persist.save('research'); if (S.route.v === 'research') renderStage(); }
}
function paperState(p) {
  const entryQ = p.q.find(q => q.ok && q.t >= p.added + p.rules.delay * 1000);
  if (!entryQ) return { entry: null, ret: 0, liq: 0, closed: false };
  const entry = entryQ.px * (1 + entryQ.imp); const stop = entry * (1 + (p.rules.stop ?? -0.3)); const limit = p.added + (p.rules.days || 7) * D;
  let exit = null, why = '';
  for (const q of p.q) { if (!q.ok || q.t <= entryQ.t) continue; if (q.t > limit) { exit = q; why = `Closed at ${p.rules.days}-day rule`; break; } if (q.px * (1 - q.imp) <= stop) { exit = q; why = `Stopped at ${fmtPct((p.rules.stop ?? -0.3) * 100, 0)} rule`; break; } }
  const last = [...p.q].reverse().find(q => q.ok) || entryQ; const mk = exit || last; const ex = mk.px * (1 - mk.imp);
  const ret = ((ex / entry) * (1 - FEE_RATE) ** 2 - 1) * 100;
  return { entry, ret, liq: ret, closed: !!exit, why, exitT: exit?.t };
}

// ---------- reports, support, record cards ----------
function openReport(id) {
  const x = getIdea(id); if (!x) return;
  openModal(`<div class="mc-h"><div class="col" style="gap:4px"><span class="tag">Report</span><h3>Report this idea</h3></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <form class="col" style="gap:12px" data-submit="report" data-id="${id}"><div class="field"><label for="rRule">Which rule?</label><select class="input" id="rRule" name="rule"><option>Undisclosed compensation</option><option>Misleading performance claim</option><option>Wash trading or fake volume</option><option>Deceptive metric manipulation</option><option>Impersonation</option></select></div>
    <div class="field"><span class="flabel">Evidence from the record</span>${x.ev.map(e => `<label class="row panel" style="gap:10px"><input type="checkbox" name="ev" value="${e.id}"><span style="font-size:12.5px"><b>[${e.id}]</b> ${esc(e.title)}</span></label>`).join('')}</div>
    <div class="field"><label for="rNote">What should a reviewer know?</label><textarea class="input" id="rNote" name="note" placeholder="Links, timestamps, context"></textarea></div>
    <p class="note" style="margin:0">Reports are leads, not verdicts. A person reviews anything consequential, the creator can respond, and a shared funding source or similar timing alone is never treated as proof of common ownership.</p>
    <button class="btn pri block" type="submit">File report</button></form>`);
}
function fileReport(form) {
  const ev = [...form.querySelectorAll('input[name=ev]:checked')].map(i => i.value); const id = 'C-' + (1100 + S.cases.length + 1);
  S.cases.push({ id, ideaId: form.dataset.id, rule: form.rule.value, ev, note: form.note.value.slice(0, 600), t: Date.now(), stage: 'Flag' }); Persist.save('social'); closeAll();
  openModal(`<div class="mc-h"><h3>Report filed · ${id}</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><div class="card col" style="gap:0">${[['Flag', 'Received with ' + ev.length + ' evidence item' + (ev.length === 1 ? '' : 's') + '.', true], ['Review', 'A person reviews it. Median wait right now: ' + ENFORCE.medianH + ' h.', false], ['Decision', 'You get the rule, findings, uncertainty and any action.', false], ['Appeal or correction', 'Both stay visible on the record.', false]].map(([t, p, d]) => `<div class="rstep ${d ? 'done' : ''}"><span class="ic">${d ? I.check : I.dot}</span><span><b>${t}</b><small>${p}</small></span><span></span></div>`).join('')}</div><p class="note">Prototype: no report leaves this page.</p>`);
}
function openSupport(rid) {
  const r = findReceipt(rid); if (!r) return; closeAll();
  openModal(`<div class="mc-h"><div class="col" style="gap:4px"><span class="tag">Support</span><h3>Help with ${r.id}</h3></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <p class="note" style="margin:0">Your case starts with the order's own records, so you don't have to explain what happened from scratch.</p><div class="code">${esc(receiptSummary(r))}</div>
    <form class="col" style="gap:10px" data-submit="support" data-id="${r.id}"><div class="field"><label for="sProb">What went wrong?</label><select class="input" id="sProb" name="prob"><option>I received less than I expected</option><option>The order failed or expired</option><option>My balance looks wrong</option><option>Something else</option></select></div><textarea class="input" name="note" placeholder="Anything else (optional)"></textarea>
    <div class="row wrap"><button class="btn" type="button" data-act="ask" data-role="support" data-id="${r.id}">${I.spark}Draft with the support assistant</button><button class="btn pri" type="submit">Open case</button></div>
    <p class="note" style="margin:0">The assistant explains what the records show. It can't change balances or promise refunds; a person checks any discrepancy.</p></form>`);
}
function recordCard(h) {
  const me = h === 'me'; const c = me ? null : CR[h]; const W = 840, Hh = 440; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d');
  x.fillStyle = '#0B0A09'; x.fillRect(0, 0, W, Hh); const g = x.createRadialGradient(0, 0, 10, 0, 0, 600); g.addColorStop(0, 'rgba(255,59,71,.18)'); g.addColorStop(1, 'rgba(255,59,71,0)'); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  x.strokeStyle = 'rgba(255,240,220,.12)'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, Hh - 2);
  x.fillStyle = '#FF3B47'; x.font = '600 20px "Geist Mono", monospace'; x.fillText('FOMA RECORD', 40, 56);
  x.fillStyle = '#F5F1EA'; x.font = '650 50px Geist, system-ui, sans-serif'; x.fillText(me ? myHandle() : c.name, 40, 122);
  x.fillStyle = '#ABA497'; x.font = '22px Geist, system-ui, sans-serif'; x.fillText(me ? 'Building a record · unranked' : `${STYLE[c.style]} · ${c.wallets} signed wallets · ${c.rec.calls} ${c.rec.unit || 'calls'} / ${c.rec.days} days`, 40, 162);
  const cells = me ? [['Calls', String(S.myIdeas.length)], ['Ranked', 'Not yet'], ['Conduct', 'Nothing on record']] : [['Author', fmtPct(c.rec.author)], ['Paper 30 s / $250', fmtPct(c.rec.paper30)], ['Max drawdown', fmtPct(c.rec.dd)], ['Record', `${c.rec.w}W ${c.rec.l}L ${c.rec.o} open`]];
  cells.forEach(([l, v], i) => { const cx = 40 + i * 195; x.fillStyle = '#131210'; x.fillRect(cx, 200, 180, 120); x.fillStyle = '#777064'; x.font = '17px Geist, system-ui, sans-serif'; x.fillText(l, cx + 16, 236); x.fillStyle = v.startsWith('+') ? '#3CDDA0' : v.startsWith('−') ? '#FF6B62' : '#F5F1EA'; x.font = '650 30px Geist, system-ui, sans-serif'; x.fillText(v, cx + 16, 288); });
  x.fillStyle = '#777064'; x.font = '17px Geist, system-ui, sans-serif'; x.fillText(`Disclosure: ${me ? (S.profile.attested ? 'attested' : 'not attested') : c.disc.ext.state === 'late' ? 'late disclosure on record' : 'complete'} · Conduct: ${me ? 'none' : c.conduct.length ? c.conduct.length + ' on record' : 'none'} · Methodology v${METHOD[0].v}`, 40, 370);
  x.fillText(`As of ${dstamp(Date.now())} · prototype data`, 40, 400);
  return cv;
}
function openCard(h) {
  const cv = recordCard(h); const url = cv.toDataURL('image/png'); const slug = h === 'me' ? 'you' : h;
  openModal(`<div class="mc-h"><h3>Record card</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><img src="${url}" alt="Record card" style="width:100%;border-radius:14px;border:1px solid var(--line)"><p class="note" style="margin:0">A portable card with the full denominator and methodology version, so it reads the same wherever it's shared. It never claims a token or a trader is "safe".</p><div class="code">&lt;iframe src="https://foma.cash/embed/${slug}" width="420" height="220"&gt;&lt;/iframe&gt;</div><div class="row wrap"><button class="btn pri" data-act="savecard" data-h="${h}" type="button">${I.download}Save PNG</button><button class="btn" data-act="copy" data-v='<iframe src="https://foma.cash/embed/${slug}" width="420" height="220"></iframe>' type="button">${I.copy}Copy embed code</button></div><p class="note" style="margin:0">Embeds and the evidence API are a later stage; the code shows the format.</p>`, { wide: true });
}
function openWhy(sym) {
  const p = positionsList().find(z => z.sym === sym); if (!p) return; const t = TOK[sym];
  const mcNow = tokStats(sym).mcap; let body;
  if (p.unknown) body = `<p class="lede" style="font-size:13.5px">These ${fmtQty(p.qty)} $${sym} arrived from another wallet, so FOMA can't know what you originally paid. Instead of inventing a zero cost, it shows the return since they arrived (${fmtPct(p.sinceRet)}) and leaves them out of any return ranking.</p>`;
  else { const lots = S.acct.lots[sym].filter(l => l.cost != null); const t0 = lots[0].t; const mcEntry = (t.real ? t.mcap / t.px : t.supply) * priceAt(sym, t0); const mkt = (pxNow(sym) / priceAt(sym, t0) - 1) * 100; const costs = p.value - p.liq;
    body = `<div class="stats"><div class="stat"><span>MC at your entry</span><b>${fmtUsdC(mcEntry)}</b></div><div class="stat"><span>MC now</span><b>${fmtUsdC(mcNow)}</b></div><div class="stat"><span>Market move</span><b class="${cls(mkt)}">${fmtPct(mkt)}</b></div></div>
    <div class="bars">${[['You paid (incl. fees)', p.cost], ['Marked value now', p.value], ['Exit impact + fees', -costs], ['If sold now', p.liq]].map(([l, v]) => `<div class="b"><span class="muted">${l}</span><span class="tr"><i style="width:${Math.min(100, Math.abs(v) / Math.max(p.cost, p.value) * 100)}%;background:${v < 0 ? 'var(--loss)' : 'var(--fg2)'}"></i></span><span class="num">${fmtUsd(v)}</span></div>`).join('')}</div>
    <p class="lede" style="font-size:13.5px">A higher market cap than your entry doesn't guarantee a profit. Your buy paid a 0.40% fee, network costs and ${'its own price impact'}; selling pays impact again (${(p.imp * 100).toFixed(2)}% at this size), the fee again${t.tax ? ', and a ' + (t.tax * 100).toFixed(0) + '% transfer fee each way' : ''}. That's why "if sold now" is ${fmtUsd(p.liq)} against ${fmtUsd(p.cost)} paid.</p>`; }
  openModal(`<div class="mc-h"><h3>Why your $${sym} shows ${p.unknown ? fmtPct(p.sinceRet) : fmtPct(p.ret)}</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>${body}`);
}
