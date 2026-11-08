// ============================================================
// BOOT — shell, router, interactions, live updates
// ============================================================
const VIEWCH = {};
const ROUTES = ['discover', 'following', 'portfolio', 'research', 'profile', 'transparency', 'policy'];
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return { v: 'discover' };
  if (h.startsWith('token-')) return { v: 'token', sym: h.slice(6).toUpperCase() };
  if (h.startsWith('idea-')) return { v: 'idea', id: h.slice(5) };
  if (h.startsWith('trader-')) return { v: 'trader', h: h.slice(7) };
  if (h.startsWith('case-')) return { v: 'case', id: h.slice(5) };
  return ROUTES.includes(h) ? { v: h } : { v: 'discover' };
}
function renderShell() {
  $('#app').innerHTML = `<header class="topbar" id="topbar"></header><div class="desk" id="desk"><aside class="left" id="left" aria-label="Tokens"></aside><main class="stage" id="stage" tabindex="-1"></main><aside class="dock" id="dock" aria-label="Trade"></aside></div>`;
}
function setDesk() { $('#desk').classList.toggle('noleft', !['discover', 'token', 'idea', 'following'].includes(S.route.v)); }
function renderStage() {
  const r = S.route; let html;
  try {
    switch (r.v) {
      case 'discover': html = vDiscover(); break; case 'following': html = vFollowing(); break; case 'portfolio': html = vPortfolio(); break;
      case 'research': html = vResearch(); break; case 'profile': html = vProfile(); break; case 'transparency': html = vTransparency(); break;
      case 'policy': html = vPolicy(); break; case 'token': html = vToken(r.sym); break; case 'idea': html = vIdea(r.id); break;
      case 'trader': html = vTrader(r.h); break; case 'case': html = vCase(); break; default: html = notFound();
    }
  } catch (e) { console.error(e); html = `<div class="stage-in"><div class="empty"><b>This view hit an error</b>${esc(e.message)}</div></div>`; }
  $('#stage').innerHTML = html; mountStage();
}
function render() { renderTop(); renderTabbar(); setDesk(); renderLeft(); renderStage(); renderDock(); }
let rq = 0;
function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; const a = document.activeElement; if (a && a.matches('input,textarea,select')) { renderTop(); return; } render(); }); }

// ---------- mounting charts & timeline ----------
function ideaMarkers(x, ph) {
  return x.ev.filter(e => e.t <= Date.now()).map(e => ({ t: e.t, p: e.px, kind: e.k, conf: e.conf, img: ['accumulate', 'add', 'sell', 'exit', 'publish'].includes(e.k) && CR[x.a] ? CR[x.a].av : null, label: `[${e.id}] ${e.title}`, sub: dstamp(e.t), id: e.id, cur: S.ui.curEv === x.id + e.id }));
}
function ideaRange(x) { const ts = [x.pubT, ...x.ev.map(e => e.t)]; const a = Math.min(...ts), b = Date.now(); const pad = Math.max(2 * H, (b - a) * 0.12); return [Math.max(TOK[x.sym].series[0].t, a - pad), b]; }
function mountStage() {
  for (const c of [...CHARTS]) if (!c.c.isConnected) c.destroy();
  const v = S.route.v;
  if (v === 'discover' && $('#storyChart')) { const x = IDX['moth-kestrel']; VIEWCH.story = new Chart($('#storyChart'), { sym: 'MOTH', mini: true, start: x.pubT - 5 * H, markers: ideaMarkers(x), entry: { p: x.inv.basis } }); }
  if (v === 'token' && $('#tokChart')) { const t = TOK[S.route.sym]; const tf = S.ui.tf[t.sym] || (t.demo && t.ageH < 24 ? (t.ageH < 1 ? '15m' : '6h') : '7d'); VIEWCH.tok = new Chart($('#tokChart'), { sym: t.sym, tf, type: S.ui.ctype, markers: tokenMarkers(t.sym), onMarker: id => { location.hash = 'idea-' + id; } }); }
  if (v === 'idea' && $('#ideaChart')) {
    const x = getIdea(S.route.id); const [a, b] = ideaRange(x); const ph = S.ui.ph?.[x.id];
    VIEWCH.idea = new Chart($('#ideaChart'), { sym: x.sym, start: a, end: Math.max(b, TOK[x.sym].series[TOK[x.sym].series.length - 1].t), markers: ideaMarkers(x), playhead: ph ?? null, entry: x.inv.qty ? { p: x.inv.basis ?? priceAt(x.sym, x.pubT), label: 'Author entry ' + fmtPx(x.inv.basis ?? priceAt(x.sym, x.pubT)) } : null, onScrub: t => setPlayhead(x.id, t), onMarker: eid => { const e = x.ev.find(z => z.id === eid); if (e) { S.ui.curEv = x.id + eid; setPlayhead(x.id, e.t); } } });
    bindTimeline(x);
  }
  const cc = $('#cComp'); if (cc) cc.addEventListener('change', () => $('#cExtRow').classList.toggle('hide', cc.value !== 'ext'));
}
function tlBounds(x) { const el = $('#tline'); return el ? [parseFloat(el.dataset.t0), parseFloat(el.dataset.t1)] : [x.pubT, Date.now()]; }
let phRaf = 0, phPending = null;
function setPlayhead(id, t) {
  phPending = { id, t }; if (phRaf) return;
  phRaf = requestAnimationFrame(() => {
    phRaf = 0; const { id, t } = phPending; const x = getIdea(id); if (!x || !$('#ideaView')) return;
    const [t0] = tlBounds(x); const now = Date.now(); const tt = clamp(t, t0, now); const atNow = tt >= now - 1500;
    S.ui.ph = S.ui.ph || {}; S.ui.ph[id] = atNow ? undefined : tt;
    const near = x.ev.reduce((best, e) => Math.abs(e.t - tt) < Math.abs((best?.t ?? Infinity) - tt) ? e : best, null);
    if (near && Math.abs(near.t - tt) < (now - t0) * 0.012) S.ui.curEv = id + near.id; else if (!atNow) S.ui.curEv = null;
    const pt = atNow ? now : tt;
    VIEWCH.idea?.set({ playhead: atNow ? null : tt, markers: ideaMarkers(x) });
    const tl = $('#tline'); if (tl) tl.innerHTML = tlineHTML(x, t0, now, pt);
    const asof = $('#asof'); if (asof && document.activeElement?.id !== 'ideaSize') asof.innerHTML = asofHTML(x, pt);
    const pht = $('#phTime'); if (pht) pht.textContent = atNow ? 'now' : dstamp(tt);
    const evl = $('#evList'); if (evl) evl.innerHTML = evListHTML(x, pt);
  });
}
function bindTimeline(x) {
  const tl = $('#tline'); if (!tl) return;
  const toT = e => { const tr = tl.querySelector('.tl-track').getBoundingClientRect(); const [t0, t1] = tlBounds(x); return t0 + clamp((e.clientX - tr.left) / tr.width, 0, 1) * (t1 - t0); };
  let drag = false;
  tl.addEventListener('pointerdown', e => { if (e.target.closest('.tl-node')) return; drag = true; tl.setPointerCapture(e.pointerId); stopReplay(); setPlayhead(x.id, toT(e)); });
  tl.addEventListener('pointermove', e => { if (drag) setPlayhead(x.id, toT(e)); });
  tl.addEventListener('pointerup', () => { drag = false; });
  tl.addEventListener('keydown', e => {
    if (!e.target.matches('.tl-head')) return; const cur = S.ui.ph?.[x.id] ?? Date.now(); const evs = x.ev.map(z => z.t).sort((a, b) => a - b); let t = null;
    if (e.key === 'ArrowRight') t = evs.find(z => z > cur + 1000) ?? Date.now(); if (e.key === 'ArrowLeft') t = [...evs].reverse().find(z => z < cur - 1000) ?? tlBounds(x)[0]; if (e.key === 'Home') t = tlBounds(x)[0]; if (e.key === 'End') t = Date.now();
    if (t != null) { e.preventDefault(); setPlayhead(x.id, t); setTimeout(() => $('#tline .tl-head')?.focus(), 30); }
  });
}
let REPLAY = null;
function stopReplay() { if (REPLAY) { cancelAnimationFrame(REPLAY.raf); clearTimeout(REPLAY.to); REPLAY = null; const b = $('#replayBtn'); if (b) b.innerHTML = I.play + 'Replay'; } }
function toggleReplay(id) {
  if (REPLAY) return stopReplay(); const x = getIdea(id); const [t0] = tlBounds(x); const t1 = Date.now(); const b = $('#replayBtn'); if (b) b.innerHTML = I.pause + 'Pause';
  if (S.rm) { const evs = x.ev.map(e => e.t).sort((a, b) => a - b); let i = 0; REPLAY = {}; const next = () => { if (i >= evs.length) { setPlayhead(id, Date.now()); return stopReplay(); } S.ui.curEv = null; setPlayhead(id, evs[i++]); REPLAY.to = setTimeout(next, 900); }; next(); return; }
  const dur = 8000, s = performance.now(); REPLAY = {};
  const run = () => { const p = Math.min(1, (performance.now() - s) / dur); const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; setPlayhead(id, t0 + (t1 - t0) * e); if (p < 1 && REPLAY) REPLAY.raf = requestAnimationFrame(run); else { setPlayhead(id, Date.now()); stopReplay(); } };
  REPLAY.raf = requestAnimationFrame(run);
}
function storyReplay() {
  const x = IDX['moth-kestrel']; const ch = VIEWCH.story; const bar = $('#storyBar'); if (!ch || !bar) return;
  const t0 = x.pubT - 3 * H, t1 = Date.now(), dur = S.rm ? 0 : 5200, s = performance.now();
  const run = () => { const p = dur ? Math.min(1, (performance.now() - s) / dur) : 1; const t = t0 + (t1 - t0) * p; ch.set({ playhead: p >= 1 ? null : t }); const nb = $('#storyBar'); if (nb) nb.innerHTML = hbarHTML(x, t); if (p < 1) requestAnimationFrame(run); };
  run();
}

// ---------- live updates ----------
let lastMc = {};
function updateLive() {
  for (const el of $$('[data-live]')) {
    const k = el.dataset.live, sym = el.dataset.sym;
    if (sym && TOK[sym] && !TOK[sym].demo && k !== 'holders') continue;
    if (k === 'mc') el.textContent = fmtUsdC(tokStats(sym).mcap);
    else if (k === 'ch') { const v = tokStats(sym).ch; el.textContent = fmtPct(v); el.className = cls(v) + ' num'; }
    else if (k === 'px') el.innerHTML = fmtPxH(pxNow(sym));
    else if (k === 'mcbig') { const m = tokStats(sym).mcap; odoSet(el, fmtUsdC(m), Math.sign(m - (lastMc[sym] ?? m))); lastMc[sym] = m; }
    else if (k === 'holders' && TOK[sym]?.demo) el.textContent = nf0.format(tokStats(sym).holders);
    else if (k === 'ctx') { const x = getIdea(el.dataset.id); if (x) el.innerHTML = ctxLine(x); }
    else if (k === 'bal') el.textContent = fmtUsd(acctValue());
    else if (k === 'day') { const d = dayPnl(); el.textContent = fmtSignedUsd(d) + ' today'; el.className = cls(d) + ' num'; }
  }
  const tk = S.ticket; if (tk && tk.phase === 'idle' && TOK[tk.sym]?.demo) { const est = $('#tkEst'); const q = liveQuote({ ...tk }); if (est && q && q.ok) est.textContent = tk.side === 'buy' ? `≈ ${fmtQty(q.outQty)} ${tk.sym} at the current price` : `≈ ${fmtUsd(q.outUsd)} at the current price`; }
  CHARTS.forEach(c => { if (TOK[c.o.sym]?.demo && (c.o.playhead == null)) { if (c === VIEWCH.idea) c.o.end = Date.now(); c.draw(); } });
}

// ---------- new ideas arrive (queued, the feed never jumps) ----------
function makePoolIdea(p) {
  const now = Date.now(); const px = pxNow(p.sym);
  return { id: p.id, a: p.a, sym: p.sym, kind: 'position', v: [{ n: 1, t: now, text: p.text }], pubT: now, inv: { qty: p.qty, basis: px }, comp: { foma: null, ext: { state: 'attested-none' } },
    ev: [{ id: 'E1', t: now - 11000, k: 'accumulate', title: `Bought ${fmtQty(p.qty)} ${p.sym}`, p: `Signed wallet bought ${fmtQtyFull(p.qty)} ${p.sym} 11 s before posting.`, src: 'chain', conf: 'verified', px }, { id: 'E2', t: now, k: 'publish', title: 'Posted v1', p: `Position captured at publication: ${fmtQtyFull(p.qty)} ${p.sym}.`, src: 'foma', conf: 'verified', px }],
    paper: { delay: 30, notional: 250, days: 7, stop: -0.3 }, obs: null };
}
function addNote(n) { S.notes.unshift(n); if (S.notes.length > 40) S.notes.pop(); renderTop(); renderTabbar(); }
function scheduleNew() {
  let i = 0;
  const fire = () => {
    if (i >= NEW_POOL.length) return; const p = NEW_POOL[i++]; const x = makePoolIdea(p); IDX[x.id] = x; S.newQ.push(x.id);
    if (S.follows.has(x.a)) addNote({ t: Date.now(), ty: 'entry', ideaId: x.id, a: x.a, text: `${CR[x.a].name} bought ${fmtQty(p.qty)} $${p.sym} and posted an idea` });
    if (S.route.v === 'discover' && S.ui.disc === 'feed') { const feed = $('.feed'); let pill = $('.newpill'); if (feed) { if (!pill) { feed.insertAdjacentHTML('beforebegin', `<button class="newpill" data-act="shownew" type="button"></button>`); pill = $('.newpill'); } pill.innerHTML = `${I.up.replace('<svg', '<svg style="width:14px;height:14px"')}${S.newQ.length} new idea${S.newQ.length > 1 ? 's' : ''}`; } }
    setTimeout(fire, 42000 + rand() * 30000);
  };
  setTimeout(fire, 26000);
}
function showNew() { const ids = S.newQ.splice(0); ids.forEach(id => { IDX[id]._fresh = true; S.feed.unshift(id); }); renderStage(); const f = $('.feed'); if (f) f.scrollIntoView({ behavior: S.rm ? 'auto' : 'smooth', block: 'start' }); }

// ---------- palette, notes, sources ----------
function openPalette() {
  closeAll(); const back = document.createElement('div'); back.className = 'layer-back'; const p = document.createElement('div'); p.className = 'pal'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Search');
  p.innerHTML = `<input id="palQ" placeholder="Search tokens, traders, ideas, actions" autocomplete="off" aria-label="Search"><div class="res" id="palRes"></div>`; back.onclick = () => closeLayer(); layer().append(back, p); pushLayer([back, p]);
  const items = [
    ...TOKS.filter(isMeme).map(t => ({ g: 'Tokens', l: `$${t.sym}`, s: t.name + (t.demo ? ' · demo' : ''), img: t.logo, go: () => { location.hash = 'token-' + t.sym.toLowerCase(); } })),
    ...CREATORS.map(c => ({ g: 'Traders', l: c.name, s: STYLE[c.style], img: c.av, go: () => openTrader(c.h) })),
    ...allIdeas().map(x => ({ g: 'Ideas', l: (CR[x.a]?.name || 'You') + ' on $' + x.sym, s: x.v[0].text.slice(0, 60) + '…', img: TOK[x.sym].logo, go: () => { location.hash = 'idea-' + x.id; } })),
    ...[['Discover', 'discover'], ['Following', 'following'], ['Portfolio', 'portfolio'], ['Research', 'research'], ['Profile', 'profile'], ['Transparency', 'transparency'], ['Execution policy', 'policy']].map(([l, h]) => ({ g: 'Pages', l, s: '', go: () => { location.hash = h; } })),
    { g: 'Actions', l: 'Deposit', s: 'Add demo funds', go: () => openDeposit() }, { g: 'Actions', l: 'Ask FOMA', s: 'Grounded assistant', go: () => openAsk() },
    { g: 'Actions', l: 'Simulate a congested network', s: 'See reconciliation', go: () => setNet('congested') }, { g: 'Actions', l: 'Simulate a volatile market', s: 'See slippage protection', go: () => setNet('volatile') }, { g: 'Actions', l: 'Back to a normal network', s: '', go: () => setNet('normal') },
  ];
  let sel = 0, shown = [];
  const draw = () => { const q = $('#palQ').value.trim().toLowerCase(); shown = (q ? items.filter(i => (i.l + ' ' + i.s).toLowerCase().includes(q)).sort((a, b) => (b.l.toLowerCase().startsWith(q) || b.l.toLowerCase().startsWith('$' + q)) - (a.l.toLowerCase().startsWith(q) || a.l.toLowerCase().startsWith('$' + q))) : items.filter(i => ['Tokens', 'Pages'].includes(i.g)).slice(0, 14)).slice(0, 30); sel = clamp(sel, 0, Math.max(0, shown.length - 1)); let g = ''; $('#palRes').innerHTML = shown.map((it, i) => `${it.g !== g ? `<div class="grp">${(g = it.g)}</div>` : ''}<button type="button" class="it ${i === sel ? 'on' : ''}" data-pi="${i}">${it.img ? `<img src="${it.img}" alt="" style="width:26px;height:26px;border-radius:50%">` : `<span style="width:26px;height:26px;display:grid;place-items:center;color:var(--fg3)">${I.chev}</span>`}<span class="col" style="min-width:0"><b style="font-weight:600">${esc(it.l)}</b>${it.s ? `<span class="dim ell" style="font-size:12px">${esc(it.s)}</span>` : ''}</span><span class="k">${it.g}</span></button>`).join('') || '<div class="grp">No matches</div>'; };
  const pick = i => { const it = shown[i]; if (!it) return; closeLayer(); it.go(); };
  $('#palQ').addEventListener('input', () => { sel = 0; draw(); });
  $('#palQ').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { sel++; draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel--; draw(); e.preventDefault(); } else if (e.key === 'Enter') { pick(sel); e.preventDefault(); } });
  $('#palRes').addEventListener('click', e => { const b = e.target.closest('[data-pi]'); if (b) pick(+b.dataset.pi); });
  draw(); setTimeout(() => $('#palQ').focus(), 20);
}
function openNotes() {
  S.seenNotes = S.notes.length; renderTop(); renderTabbar();
  openSide(`<div class="row between"><b style="font-size:18px">Notifications</b><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><p class="note">Real-time moves from people you follow. Entries, exits, transfers and thesis changes are labeled separately.</p>
    <div class="fl">${S.notes.map(n => { const [lab, icn] = ET[n.ty] || ET.entry; return `<a class="fe" href="#idea-${n.ideaId}">${avRing(n.a, 38)}<div class="col" style="gap:4px"><span class="etype et-${n.ty}">${I[icn]}${lab}</span><span class="t">${esc(n.text)}</span><span class="dim" style="font-size:12px">${ago(n.t)}</span></div><span></span></a>`; }).join('') || '<div class="empty"><b>No notifications</b></div>'}</div><button class="btn sm" data-act="alerts" type="button">${I.bell}Alert settings</button>`);
}
function openSources() {
  openModal(`<div class="mc-h"><h3>Where this data comes from</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <div class="col" style="gap:10px"><div class="panel"><b>Real memecoins and SOL</b><p class="note" style="margin:4px 0 0">CoinGecko snapshot taken ${dstamp(SNAP_TS)} (${ago(SNAP_TS)}): price, 24h change, market cap, volume and 7-day history. These prices do not move in this prototype. Logos from public token lists.</p></div>
    <div class="panel"><b>Demo launches</b><p class="note" style="margin:4px 0 0">MOTH, KILN, BRINE, RELIC, GLINT, TADPOLE, OKRA and CHEDDAR are fictional. Their quotes are simulated every 2.5 s.</p></div>
    <div class="panel"><b>Creators, wallets, ideas, fills</b><p class="note" style="margin:4px 0 0">All simulated. Creator handles are fictional and are not real people. Orders run on a simulated chain; no real funds move.</p></div>
    <div class="panel"><b>Not covered by the snapshot</b><p class="note" style="margin:4px 0 0">Market-wide trades, holder lists and pool liquidity for real tokens. Where something isn't known, the page says so instead of estimating.</p></div></div>`);
}
function setNet(k) { S.net = k; savePrefs(); if (S.ticket) refreshQuote(false); if (S.route.v === 'policy') renderStage(); toast({ normal: 'Simulated network back to normal', congested: 'Congested network: confirmations get slow, and FOMA reconciles before any retry', volatile: 'Volatile market: price can move past your slippage limit in flight', outage: 'Route outage: demo-token quotes often fail, and failures are logged' }[k]); }

// ---------- forms, holds, misc ----------
async function sha(s) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch { return hashStr(s).toString(16).padStart(8, '0').repeat(4); } }
async function publishIdea(f) {
  if (S.guest) return openSignup();
  const sym = f.sym.value, text = f.thesis.value.trim(); if (text.length < 12) { toast('Write at least a sentence: what you think and what would make you wrong.'); return; }
  const qty = holdingQty(sym); const lots = (S.acct.lots[sym] || []).filter(l => l.cost != null); const kq = lots.reduce((s, l) => s + l.qty, 0); const basis = kq ? lots.reduce((s, l) => s + l.cost, 0) / kq : null;
  const now = Date.now(); const id = 'me-' + b58(6).toLowerCase(); const hash = (await sha(text + '|' + now + '|' + qty)).slice(0, 16); const px = pxNow(sym);
  const ext = f.comp.value === 'ext' ? { state: 'self', text: (f.ext.value || 'Outside payment, details not given').slice(0, 120) } : { state: 'none' };
  const m = { id, a: '__me', mine: true, sym, kind: qty > 0 ? 'position' : 'research', v: [{ n: 1, t: now, text: text.slice(0, 600) }], pubT: now, inv: { qty, basis }, comp: { foma: null, ext }, hash,
    ev: [{ id: 'E1', t: now, k: 'publish', title: 'Posted v1', p: qty ? `Position captured at publication: ${fmtQtyFull(qty)} ${sym} in your FOMA wallet${basis ? ', known cost' : ''}.` : 'No position at publication.', src: 'foma', conf: 'verified', px }].concat(ext.state === 'self' ? [{ id: 'E2', t: now + 1, k: 'disclosure', title: 'Disclosed at publication', p: ext.text + ' (self-reported).', src: 'creator', conf: 'self', px }] : []),
    paper: { delay: 30, notional: 250, days: 7, stop: -0.3 }, obs: null };
  S.myIdeas.unshift(m); Persist.save('social'); toast('Posted with receipts · hash ' + hash.slice(0, 10)); location.hash = 'idea-' + id;
}
function openEdit(id) { const m = S.myIdeas.find(x => x.id === id); if (!m) return; openModal(`<div class="mc-h"><h3>Edit as a new version</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><form class="col" style="gap:10px" data-submit="edit" data-id="${id}"><textarea class="input" name="text" required>${esc(m.v[m.v.length - 1].text)}</textarea><p class="note" style="margin:0">v${m.v.length} stays visible. The change is shown as a diff.</p><button class="btn pri" type="submit">Save v${m.v.length + 1}</button></form>`); }
let HOLD = null;
function startHold(b) { if (HOLD || b.disabled) return; const t0 = performance.now(), dur = 1100; HOLD = { b, raf: 0 }; const run = () => { if (!HOLD) return; const p = Math.min(1, (performance.now() - t0) / dur); b.style.setProperty('--p', p); if (p >= 1) { const k = b.dataset.hold; HOLD = null; b.style.setProperty('--p', 0); holdDone(k); return; } HOLD.raf = requestAnimationFrame(run); }; HOLD.raf = requestAnimationFrame(run); }
function cancelHold() { if (!HOLD) return; cancelAnimationFrame(HOLD.raf); HOLD.b.style.setProperty('--p', 0); HOLD = null; }
function holdDone(k) { if (k === 'override') { const q = S.ticket.q; const pc = policyCheck(q); S.ticket.ovr = { at: Date.now(), keys: pc.failing.map(i => i.k) }; toast('Override applies to this one order and is written on the receipt'); refreshQuote(false); } else if (k === 'confirm') placeOrder(); }
function flashDock() { const d = $('#dock'); if (!d || S.rm) return; d.animate([{ boxShadow: 'inset 0 0 0 2px rgba(255,59,71,.6)' }, { boxShadow: 'inset 0 0 0 0 rgba(255,59,71,0)' }], { duration: 900 }); d.scrollTo({ top: 0, behavior: 'smooth' }); }
function toggleIn(set, v) { set.has(v) ? set.delete(v) : set.add(v); return set.has(v); }
let qDeb = 0;

document.addEventListener('click', e => {
  if (e.target === document.body && document.body.classList.contains('sheet-open')) { S.ui.dockOpen = false; renderDock(); return; }
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return; const d = a.dataset; const act = d.act;
  switch (act) {
    case 'close': closeLayer(); break;
    case 'palette': openPalette(); break;
    case 'sources': openSources(); break;
    case 'signup': openSignup(); break;
    case 'create': createAccount(d.m); break;
    case 'deposit': openDeposit(); break;
    case 'withdraw': openWithdraw(); break;
    case 'depq': { const i = $('#depAmt'); if (i) i.value = d.v; break; }
    case 'depm': { const mc = a.closest('.mc'); mc.dataset.method = d.m; $$('[data-act="depm"]', mc).forEach(b => b.classList.toggle('on', b === a)); break; }
    case 'notes': openNotes(); break;
    case 'ask': openAsk(d.role, d.id); break;
    case 'askrole': { const s = a.closest('.side'); if (s) s.innerHTML = askPanelHTML(d.k, d.id || undefined); break; }
    case 'asksugg': askQuestion(d.q); break;
    case 'askstop': AIS.ctl?.abort(); break;
    case 'explain': runInline('evidence', d.id); break;
    case 'contrary': runInline('research', d.id); break;
    case 'tl': S.ui.tl = d.k; renderLeft(); if (S.route.v === 'discover' && S.ui.disc === 'tokens') renderStage(); break;
    case 'token': closeAll(); location.hash = 'token-' + d.sym.toLowerCase(); break;
    case 'trader': openTrader(d.h, d.tab); break;
    case 'trtab': if (d.full) { S.ui.trTab = d.k; renderStage(); } else { const s = a.closest('.side'); if (s) s.innerHTML = traderHTML(d.h, d.k, false); } break;
    case 'follow': { const on = toggleIn(S.follows, d.h); Persist.save('research'); toast(on ? `Following ${CR[d.h].name}. You'll get entries, exits and thesis changes.` : `Unfollowed ${CR[d.h].name}`); $$(`[data-act="follow"][data-h="${d.h}"]`).forEach(b => { b.textContent = on ? 'Following' : 'Follow'; b.classList.toggle('paper', !on); }); if (S.route.v === 'following') renderStage(); break; }
    case 'trade': if (S.ticket?.phase === 'flight') { toast('An order is already in flight'); break; } newTicket(d.sym, d.from); if (isPhone()) S.ui.dockOpen = true; renderDock(); flashDock(); break;
    case 'track': trackForward(d.id); break;
    case 'untrack': S.paper = S.paper.filter(p => p.id !== d.id); Persist.save('research'); renderStage(); break;
    case 'save': { const on = toggleIn(S.saved, d.id); Persist.save('research'); a.innerHTML = I.bookmark + (on ? 'Saved' : ''); toast(on ? 'Saved to Research' : 'Removed from saved'); break; }
    case 'filter': S.ui.filters[d.k] = !S.ui.filters[d.k]; renderStage(); break;
    case 'shownew': showNew(); break;
    case 'disc': S.ui.disc = d.k; closeAll(); if (S.route.v !== 'discover') location.hash = 'discover'; else renderStage(); break;
    case 'lbstyle': S.ui.lbStyle = d.k; renderStage(); break;
    case 'clan': openClan(d.id); break;
    case 'joinclan': closeLayer(); toast('Joined (demo). Its shared watchlist is now in your tokens.'); break;
    case 'replay-story': storyReplay(); break;
    case 'replay': toggleReplay(d.id); break;
    case 'seek': { if (S.route.v !== 'idea' || S.route.id !== d.id) { closeAll(); S.ui.ph = S.ui.ph || {}; S.ui.ph[d.id] = d.t === 'now' ? undefined : +d.t; location.hash = 'idea-' + d.id; break; } stopReplay(); if (d.ev) S.ui.curEv = d.id + d.ev; else S.ui.curEv = null; setPlayhead(d.id, d.t === 'now' ? Date.now() : +d.t); if (d.ev && layerStack.length) closeAll(); break; }
    case 'back': if (history.length > 1) history.back(); else location.hash = 'discover'; break;
    case 'report': openReport(d.id); break;
    case 'tf': S.ui.tf[d.sym] = d.k; renderStage(); break;
    case 'ctype': S.ui.ctype = d.k; savePrefs(); renderStage(); break;
    case 'toktab': S.ui.tokTab = d.k; renderStage(); break;
    case 'watch': { const on = toggleIn(S.watch, d.sym); Persist.save('research'); toast(on ? `Watching $${d.sym}` : `Removed $${d.sym} from your watchlist`); renderStage(); renderLeft(); break; }
    case 'copy': copyText(d.v); break;
    case 'receipt': openReceipt(d.id); break;
    case 'support': openSupport(d.id); break;
    case 'saveimg': { const r = findReceipt(d.id); if (r) saveCanvas(drawReceiptCanvas(r), `foma-receipt-${r.id}.png`); break; }
    case 'copysum': { const r = findReceipt(d.id); if (r) copyText(receiptSummary(r)); break; }
    case 'port': S.ui.port = d.k; renderStage(); break;
    case 'recon': { const box = $('#recon'); if (box) box.innerHTML = `<span class="radar" style="width:22px;height:22px"></span><span>Checking ${S.acct.receipts.length} receipts and ${Object.keys(S.acct.lots).length} token accounts against the chain…</span>`; setTimeout(() => { S.acct.reconAt = Date.now(); Persist.save('account'); renderStage(); toast('Ledger matches chain. 0 discrepancies.'); }, 1300); break; }
    case 'why': openWhy(d.sym); break;
    case 'research': S.ui.research = d.k; renderStage(); break;
    case 'cmp': { const c = S.ui.compare; const i = c.indexOf(d.h); if (i >= 0) c.splice(i, 1); else { c.push(d.h); if (c.length > 3) c.shift(); } renderStage(); break; }
    case 'fol': S.ui.fol = d.k; renderStage(); break;
    case 'alerts': closeAll(); openAlerts(); break;
    case 'card': openCard(d.h); break;
    case 'savecard': saveCanvas(recordCard(d.h), `foma-record-${d.h === 'me' ? 'you' : d.h}.png`); break;
    case 'subscribe': { const c = CR[d.h]; openModal(`<div class="mc-h"><h3>Subscribe to ${esc(c.name)}</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><p class="lede" style="font-size:13.5px">$${c.sub} a month for research access: long-form notes and early theses. The payment goes to the creator and never changes rankings, evidence or badges.</p><button class="btn pri" data-act="subdone" data-h="${d.h}" type="button">Subscribe (demo)</button>`); break; }
    case 'subdone': closeLayer(); toast(`Subscribed to ${CR[d.h].name} (demo)`); break;
    case 'tip': openModal(`<div class="mc-h"><h3>Tip ${esc(CR[d.h].name)}</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><div class="tp-quick">${[2, 5, 10, 25].map(v => `<button type="button" data-act="tipdone" data-v="${v}" data-h="${d.h}">$${v}</button>`).join('')}</div><p class="note" style="margin:0">Tips are optional and labeled on the creator's earnings. They don't affect rankings.</p>`); break;
    case 'tipdone': closeLayer(); toast(`Sent a $${d.v} tip to ${CR[d.h].name} (demo)`); break;
    case 'rename': openModal(`<div class="mc-h"><h3>Your handle</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><form class="col" style="gap:10px" data-submit="rename"><input class="input" name="h" value="${esc(myHandle())}" maxlength="20" pattern="[a-z0-9._]{2,20}" required aria-label="Handle"><p class="note" style="margin:0">2 to 20 characters: lowercase letters, numbers, dots and underscores.</p><button class="btn pri" type="submit">Save</button></form>`); break;
    case 'attest': S.profile.attested = Date.now(); Persist.save('social'); renderStage(); toast('Attested: no outside payments. You can update it any time.'); break;
    case 'linkwallet': closeAll(); openLinkWallet(); break;
    case 'wlink': linkWallet(b58(44), d.w); break;
    case 'prove': openProve(+d.i); break;
    case 'dosign': { const w = S.profile.wallets[+d.i]; if (w) { w.signed = Date.now(); w.rec = true; Persist.save('social'); } closeAll(); toast('Ownership verified. Signed control recorded with today’s date.'); if (S.route.v === 'profile') renderStage(); break; }
    case 'net': setNet(d.k); break;
    case 'reset': openModal(`<div class="mc-h"><h3>Reset demo data?</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><p class="lede" style="font-size:13.5px">This clears your demo account, receipts, paper portfolio, follows and posted ideas.</p><div class="row"><button class="btn pri" data-act="resetgo" type="button">Reset</button><button class="btn" data-act="close" type="button">Cancel</button></div>`); break;
    case 'resetgo': S.acct = null; S.guest = true; S.policy = { ...DEFAULT_POLICY }; S.follows = new Set(DEFAULT_FOLLOWS); S.saved = new Set(); S.watch = new Set(['MOTH', 'BONK', 'WIF']); S.myIdeas = []; S.cases = []; S.profile = { handle: 'you', wallets: [] }; seedPaper(); ACCT_KEYS.forEach(k => Persist.save(k)); S.ticket = null; closeAll(); render(); toast('Demo data reset'); break;
    case 'dock-toggle': { S.ui.dockOpen = !S.ui.dockOpen; renderDock(); const cc = $('.chart-card'); if (S.ui.dockOpen && cc && isPhone()) window.scrollTo({ top: cc.getBoundingClientRect().top + scrollY - 66, behavior: S.rm ? 'auto' : 'smooth' }); break; }
    case 'side': S.ticket.side = d.k; S.ticket.sellPct = d.k === 'sell' ? 1 : null; S.ticket.ovr = null; refreshQuote(false); break;
    case 'quick': S.ticket.amt = d.v; S.ticket.ovr = null; refreshQuote(false); break;
    case 'sellpct': S.ticket.sellPct = +d.v; S.ticket.ovr = null; refreshQuote(false); break;
    case 'key': { const tk = S.ticket; let s = tk.amt || ''; if (d.k === '⌫') s = s.slice(0, -1); else if (d.k === '.') { if (!s.includes('.')) s = (s || '0') + '.'; } else if (s.replace('.', '').length < 7) s = (s === '0' ? '' : s) + d.k; tk.amt = s; tk.ovr = null; const inp = $('#tkAmt'); if (inp) { inp.value = s; inp.style.width = amtW(s).slice(6); } refreshQuote(true); break; }
    case 'refreshq': refreshQuote(true); break;
    case 'go': placeOrder(); break;
    case 'retry': { const tk = S.ticket; tk.phase = 'idle'; tk.receipt = null; tk.order = null; refreshQuote(false); toast(`Attempt ${tk.attempt} will reuse order ${tk.prevId}, so it can't execute twice`); break; }
    case 'newticket': newTicket(S.ticket.sym, S.ticket.from); renderDock(); break;
    case 'edit': openEdit(d.id); break;
  }
});
document.addEventListener('pointerdown', e => { const b = e.target.closest('[data-hold]'); if (!b || b.disabled) return; e.preventDefault(); startHold(b); });
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, cancelHold));
document.addEventListener('pointerout', e => { if (HOLD && e.target.closest('[data-hold]') === HOLD.b && !HOLD.b.contains(e.relatedTarget)) cancelHold(); });
document.addEventListener('keydown', e => {
  const typing = e.target.matches('input,textarea,select,[contenteditable]');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); return; }
  if (e.key === 'Escape') { if (layerStack.length) closeLayer(); else if (S.ui.dockOpen) { S.ui.dockOpen = false; renderDock(); } return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-hold]') && !e.repeat) { e.preventDefault(); startHold(e.target); }
});
document.addEventListener('keyup', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-hold]')) cancelHold(); });
document.addEventListener('input', e => {
  const t = e.target; const k = t.dataset.input;
  if (k === 'amt' && S.ticket) { S.ticket.amt = t.value.replace(/[^0-9.]/g, ''); if (t.value !== S.ticket.amt) t.value = S.ticket.amt; t.style.width = amtW(S.ticket.amt).slice(6); S.ticket.sellPct = null; S.ticket.ovr = null; clearTimeout(qDeb); qDeb = setTimeout(() => refreshQuote(true), 140); }
  if (k === 'ideasize') { const v = Math.max(0, parseFloat(t.value) || 0); S.ui.ideaSize = v; const x = getIdea(S.route.id); const el = $('#ideaImp'); if (x && el) el.textContent = (impactFor(x.sym, Math.max(v, 0.01)) * 100).toFixed(2) + '% est. impact'; }
});
document.addEventListener('change', e => {
  const t = e.target; const k = t.dataset.change; if (!k) return;
  if (k === 'lbmetric') { S.ui.lbMetric = t.value; renderStage(); }
  if (k === 'policy') { const pk = t.dataset.k; if (pk === 'allowOverride') S.policy.allowOverride = t.checked; else { const v = parseFloat(t.value); if (!isFinite(v)) return; S.policy[pk] = clamp(v, parseFloat(t.min), parseFloat(t.max)); t.value = S.policy[pk]; } S.policy.v = (S.policy.v || 1) + 1; Persist.save('policy'); if (S.ticket && S.ticket.phase === 'idle') { if (pk === 'defSize') S.ticket.amt = String(S.policy.defSize); refreshQuote(false); } toast('Policy saved. Every buy button uses it now.'); }
  if (k === 'rm') { S.rm = t.checked; document.body.classList.toggle('rm', S.rm); savePrefs(); }
  if (k === 'alert') { S.profile.alerts = S.profile.alerts || {}; S.profile.alerts[t.dataset.k] = t.checked; Persist.save('social'); }
  if (k === 'wpub' || k === 'wrec') { const w = S.profile.wallets[+t.dataset.i]; if (w) { w[k === 'wpub' ? 'pub' : 'rec'] = t.checked; Persist.save('social'); } }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-submit]'); if (!f) return; e.preventDefault();
  const k = f.dataset.submit;
  if (k === 'publish') publishIdea(f);
  else if (k === 'deposit') runDeposit(f);
  else if (k === 'withdraw') runWithdraw(f);
  else if (k === 'paste') { const v = f.addr.value.trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) { toast('That doesn’t look like a Solana address. It should be 32 to 44 letters and numbers.'); return; } linkWallet(v, 'Pasted address'); }
  else if (k === 'report') fileReport(f);
  else if (k === 'support') { closeAll(); toast('Case S-' + (2000 + Math.floor(rand() * 900)) + ' opened (demo). A person checks transaction-backed cases.'); }
  else if (k === 'ask') { const q = f.q.value.trim(); if (q) { f.q.value = ''; askQuestion(q); } }
  else if (k === 'rename') { const h = f.h.value.trim().toLowerCase(); if (!/^[a-z0-9._]{2,20}$/.test(h)) { toast('Use 2 to 20 lowercase letters, numbers, dots or underscores.'); return; } S.profile.handle = h; Persist.save('social'); closeAll(); render(); }
  else if (k === 'edit') { const m = S.myIdeas.find(x => x.id === f.dataset.id); const text = f.text.value.trim(); if (!m || text.length < 12) return; const n = m.v.length + 1; const now = Date.now(); m.v.push({ n, t: now, text: text.slice(0, 600) }); m.ev.push({ id: 'E' + (m.ev.length + 1), t: now, k: 'thesis', title: 'Edited to v' + n, p: 'New version saved. Earlier versions stay visible.', src: 'foma', conf: 'verified', px: pxNow(m.sym) }); m._prep = false; Persist.save('social'); closeAll(); renderStage(); }
});
window.addEventListener('hashchange', () => { closeAll(); stopReplay(); S.route = parseHash(); S.ui.dockOpen = false; if (S.route.v === 'token') S.ui.tokTab = 'ideas'; render(); window.scrollTo(0, 0); $('#stage')?.focus({ preventScroll: true }); });
matchMedia('(max-width: 899px)').addEventListener?.('change', () => syncDockClass());

// ---------- boot ----------
function boot() {
  buildMarkets(); IDEAS.forEach(prepIdea); S.feed = IDEAS.map(x => x.id);
  renderShell();
  Persist.init();
  if (S.rm) document.body.classList.add('rm');
  if (S.acct) { for (const m of S.myIdeas) { m._prep = false; } }
  if (!S.paper.length && !store.get('seeded')) { seedPaper(); store.set('seeded', 1); }
  S.route = parseHash();
  const recent = followEvents().filter(z => z.e.t > Date.now() - 30 * H).slice(0, 4);
  S.notes = recent.map(({ ty, x, e }) => ({ t: e.t, ty, ideaId: x.id, a: x.a, text: `${CR[x.a].name}: ${e.title} · $${x.sym}` }));
  render();
  const prefs = store.get('prefs') || {};
  if (!prefs.bannerOff) { const b = $('#proto'); b.hidden = false; b.innerHTML = `<span><b>FOMA prototype.</b> Creators, ideas, wallets and fills are simulated. Real-token prices are a CoinGecko snapshot from ${dstamp(SNAP_TS)}.</span><button class="btn xs" type="button" id="protoOk">Got it</button>`; $('#protoOk').onclick = () => { b.hidden = true; store.set('prefs', { ...(store.get('prefs') || {}), bannerOff: 1, rm: S.rm, net: S.net, ctype: S.ui.ctype }); }; }
  setInterval(tickDemo, 2500); tickListeners.add(updateLive); setInterval(paperTick, 15000); scheduleNew();
  if (window.claude?.use) { window.claude.use('sample').then(s => { CAP.sample = s; }).catch(() => {}); window.claude.use('downloads').then(d => { CAP.dl = d; }).catch(() => {}); }
}
boot();
