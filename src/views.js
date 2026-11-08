// ============================================================
// VIEWS
// ============================================================
const TRENDING = ['MOTH','BONK','CHEDDAR','WIF','PENGU','FARTCOIN','KILN','OKRA','PUMP','POPCAT','BRINE','RELIC','MEW','BOME','GLINT','TADPOLE'];
const NAVS = [['discover','Discover','discover'],['following','Following','following'],['portfolio','Portfolio','portfolio'],['research','Research','research'],['profile','Profile','profile']];
function navKey() { const v = S.route.v; if (['token','idea','trader','transparency','case'].includes(v)) return v === 'transparency' ? 'profile' : 'discover'; if (v === 'policy') return 'portfolio'; return v; }
const unread = () => Math.max(0, S.notes.length - S.seenNotes);
const myHandle = () => S.profile.handle || 'you';
const myAv = (size) => `<img class="av" src="${avatarSVG('me:' + myHandle())}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px">`;

function renderTop() {
  const nk = navKey(), u = unread();
  $('#topbar').innerHTML = `
    <a class="brand" href="#discover" aria-label="foma home">${FOMA_MARK}<span>foma</span></a>
    <nav class="tnav" aria-label="Main">${NAVS.map(([k, l]) => `<a href="#${k}" class="${nk === k ? 'on' : ''}">${l}${k === 'following' && u ? `<span class="badge">${u}</span>` : ''}</a>`).join('')}<a href="${DOCS_URL}" target="_blank" rel="noopener">Docs</a></nav>
    <button class="search" data-act="palette" type="button" aria-label="Search">${I.search}<span class="txt">Search tokens, traders, ideas</span><kbd>⌘K</kbd></button>
    <div class="tb-right">
      <button class="fresh" data-act="sources" type="button" aria-label="Data sources"><i></i><span class="lbl">Snapshot ${dstamp(SNAP_TS)}</span></button>
      ${S.guest ? `<button class="btn pri sm" data-act="signup" type="button">Sign up</button>` : `<div class="bal"><b class="num" data-live="bal">${fmtUsd(acctValue())}</b><span class="${cls(dayPnl())} num" data-live="day">${fmtSignedUsd(dayPnl())} today</span></div><button class="btn pri sm" data-act="deposit" type="button">Deposit</button>`}
      <button class="iconbtn" data-act="ask" type="button" aria-label="Ask FOMA">${I.spark}</button>
      <button class="iconbtn" data-act="notes" type="button" aria-label="Notifications">${I.bell}${u ? `<span class="dot">${u}</span>` : ''}</button>
      <a class="iconbtn" href="#profile" aria-label="Your profile">${S.guest ? I.profile : myAv(26)}</a>
    </div>`;
}
function renderTabbar() {
  const nk = navKey(), u = unread();
  $('#tabbar').innerHTML = NAVS.map(([k, l, i]) => `<a href="#${k}" class="${nk === k ? 'on' : ''}">${I[i]}<span>${l}</span>${k === 'following' && u ? `<span class="badge">${u}</span>` : ''}</a>`).join('');
}

// ---------- token list ----------
function tokenList(tab) {
  let list = TOKS.filter(isMeme);
  if (tab === 'trending') list.sort((a, b) => TRENDING.indexOf(a.sym) - TRENDING.indexOf(b.sym));
  if (tab === 'new') list = list.filter(t => t.demo).sort((a, b) => b.launched - a.launched);
  if (tab === 'watch') list = list.filter(t => S.watch.has(t.sym));
  if (tab === 'held') list = list.filter(t => holdingQty(t.sym) > 0);
  return list;
}
function tokenRow(t, big) {
  const st = tokStats(t.sym), on = S.route.v === 'token' && S.route.sym === t.sym;
  return `<button class="trow ${on ? 'on' : ''}" data-act="token" data-sym="${t.sym}" type="button" ${big ? 'style="grid-template-columns:38px minmax(0,1fr) auto auto"' : ''}>
    ${logo(t.sym, big ? 38 : 34)}
    <span class="col" style="min-width:0"><span class="nm">${t.sym}</span><span class="sub ell">${esc(t.name)} · ${tokAge(t)}</span></span>
    ${big ? `<span class="hide-s">${sparkSVG(t.sym, 64, 22, t.demo && t.ageH < 24 ? t.ageH : 168)}</span>` : ''}
    <span class="rt"><b class="num" data-live="mc" data-sym="${t.sym}">${fmtUsdC(st.mcap)}</b><span class="${cls(st.ch)} num" data-live="ch" data-sym="${t.sym}">${fmtPct(st.ch)}</span></span></button>`;
}
function tokenRows(tab, big) {
  const list = tokenList(tab);
  if (!list.length) return `<div class="empty" style="margin:10px"><b>${tab === 'held' ? 'No holdings yet' : 'Nothing here yet'}</b>${tab === 'held' ? 'Tokens you buy show up here.' : 'Tap the star on a token page to watch it.'}</div>`;
  return list.map(t => tokenRow(t, big)).join('');
}
function renderLeft() {
  const el = $('#left'); if (!el) return; const tab = S.ui.tl;
  el.innerHTML = `<div class="lst-head"><div class="row between"><h2>Tokens</h2><span class="dim" style="font-size:11.5px">MC · 24h</span></div>
    <div class="seg" role="tablist" aria-label="Token lists">${[['trending','Trending'],['new','New'],['watch','Watchlist'],['held','Holdings']].map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="tl" data-k="${k}">${l}</button>`).join('')}</div></div>
    <div class="tl-rows">${tokenRows(tab)}</div>
    <div class="tl-foot">${tab === 'new' ? 'New launches are demo tokens on simulated quotes.' : `Real tokens: CoinGecko snapshot, ${dstamp(SNAP_TS)}. Demo tokens: simulated.`}</div>`;
}

// ---------- shared idea bits ----------
function hbarHTML(x, t = Date.now(), id) {
  if (x.kind === 'research' || !x.inv.qty) return `<div class="note">${I.info.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} No position. Signed wallets held 0 $${x.sym} when this was posted.</div>`;
  const h = holdingsAt(x, t); const tot = Math.max(h.inv, h.base);
  const w = v => (v / tot * 100).toFixed(2) + '%';
  const remInv = Math.min(h.rem, h.inv), extra = Math.max(0, h.rem - h.inv);
  return `<div class="hbar" ${id ? `id="${id}"` : ''}><div class="row between" style="font-size:12.5px"><span class="muted">Signed-wallet holdings vs. publication</span><b class="num">${Math.round(h.rem / h.inv * 100)}%</b></div>
    <div class="track" role="img" aria-label="${Math.round(h.rem / h.inv * 100)} percent of publication inventory still held"><i class="seg-rem" style="flex:0 0 ${w(remInv)}"></i><i class="seg-add" style="flex:0 0 ${w(extra)}"></i><i class="seg-mov" style="flex:0 0 ${w(h.moved)}"></i><i class="seg-sold" style="flex:0 0 ${w(h.sold)}"></i></div>
    <div class="legend"><span><i style="background:var(--fg)"></i>Held ${fmtQty(h.rem)}</span>${h.add ? `<span><i style="background:var(--fg3)"></i>Added ${fmtQty(h.add)}</span>` : ''}${h.moved ? `<span><i style="background:var(--warn)"></i>Moved, not sold ${fmtQty(h.moved)}</span>` : ''}${h.sold ? `<span><i style="background:var(--s4)"></i>Sold ${fmtQty(h.sold)}</span>` : ''}</div></div>`;
}
function compChips(x, t = Date.now()) {
  const c = compAt(x, t), out = [];
  if (x.team) out.push(`<span class="chip if">${I.shield}Team account · own holdings excluded</span>`);
  if (c.foma) out.push(c.foma.amt ? `<span class="chip ok" title="Logged independently in FOMA's payment ledger">${I.check}FOMA paid ${fmtUsd(c.foma.amt, 0)}${c.foma.related === false ? ' (unrelated)' : ''} · logged</span>` : `<span class="chip">FOMA payment declined · logged</span>`);
  const e = c.ext;
  if (e) {
    if (e.state === 'late') out.push(`<span class="chip wn">${I.coin}Paid by ${esc(e.payer)} ${fmtUsd(e.amt, 0)} · disclosed ${Math.round((e.t - x.pubT) / H)} h late</span>`);
    else if (e.state === 'none-yet') out.push(`<span class="chip">No pay declared</span>`);
    else if (e.state === 'attested-none') out.push(`<span class="chip">No outside pay · attested</span>`);
    else if (e.state === 'self') out.push(`<span class="chip wn">Outside pay · self-reported</span>`);
  }
  if (x.cases?.length) out.push(`<span class="chip if">${I.shield}Decision D-207 on record</span>`);
  return out.join('');
}
function ctxLine(x) {
  const sz = S.policy.defSize, imp = impactFor(x.sym, sz) * 100, now = pxNow(x.sym);
  if (x.kind === 'research' || !x.inv.qty) return `${I.info.replace('<svg', '<svg style="width:14px;height:14px"')}<span>Research note · price now <b>${fmtPxH(now)}</b> · est. impact <b>${imp.toFixed(2)}%</b> at ${fmtUsd(sz, 0)}</span>`;
  const entry = x.inv.basis ?? priceAt(x.sym, x.pubT); const d = (now / entry - 1) * 100;
  const fresh = TOK[x.sym].demo ? `demo quote ${clock(Date.now())}` : `snapshot ${dstamp(SNAP_TS)}`;
  return `${I.bolt.replace('<svg', '<svg style="width:14px;height:14px;color:var(--lime)"')}<span>Quote <b class="${cls(d)}">${Math.abs(d).toFixed(0)}% ${d >= 0 ? 'above' : 'below'}</b> author entry · est. impact <b>${imp.toFixed(2)}%</b> at ${fmtUsd(sz, 0)} · <span class="dim">${fresh}</span></span>`;
}
function actionLine(x) {
  const c = CR[x.a] || { name: myHandle() };
  if (x.kind === 'research') return `<b>${esc(c.name)}</b> posted research on ${tokchip(x.sym)}`;
  const acc = x.ev.find(e => e.k === 'accumulate');
  const qty = x.inv.qty, v = qty * (x.inv.basis ?? priceAt(x.sym, x.pubT));
  const h = holdingsAt(x, Date.now());
  const tail = h.rem === 0 ? ' · <b>closed</b>' : ` · now holds <b>${Math.round(h.rem / h.inv * 100)}%</b> of it`;
  return `<b>${esc(c.name)}</b> ${acc ? 'bought' : 'posted holding'} <b>${fmtQty(qty)}</b> ${tokchip(x.sym)} <span class="dim">(${fmtUsdC(v)})</span>${acc && acc.t < x.pubT ? ` <span class="dim">${durShort(x.pubT - acc.t)} before posting</span>` : ''}${tail}`;
}
function avRing(h, size = 40) { const c = CR[h]; return c && c.wallets ? `<span class="av-ring">${av(h, size - 4)}</span>` : av(h, size); }
function ideaCard(x, fresh) {
  const c = CR[x.a] || { name: myHandle(), style: 'swing', wallets: 1 }; const mine = x.mine;
  const latest = x.v[x.v.length - 1];
  return `<article class="idea ${fresh ? 'fresh-in' : ''}" data-idea="${x.id}">
    <div class="idea-h">${mine ? myAv(40) : `<button data-act="trader" data-h="${x.a}" type="button" aria-label="Open ${esc(c.name)}">${avRing(x.a)}</button>`}
      <div class="who"><b>${mine ? 'You' : `<button data-act="trader" data-h="${x.a}" type="button">${esc(c.name)}</button>`} ${vchk}</b><span>${STYLE[c.style] || 'Trader'} · ${ago(x.pubT)}${x.v.length > 1 ? ` · edited, v${x.v.length}` : ''}</span></div>
      <span class="grow"></span>${mine ? '<span class="chip">Your idea · unranked</span>' : followBtn(x.a, true)}</div>
    <div class="idea-act">${actionLine(x)}</div>
    <p class="thesis">${esc(latest.text)}</p>
    ${hbarHTML(x)}
    <div class="row wrap" style="gap:6px">${compChips(x)}</div>
    <div class="ctxline" ${TOK[x.sym].demo ? `data-live="ctx" data-id="${x.id}"` : ''}>${ctxLine(x)}</div>
    <div class="idea-f"><a class="btn sm pri" href="#idea-${x.id}">${I.receipt}Receipts</a>
      <button class="btn sm" data-act="trade" data-sym="${x.sym}" data-from="${x.id}" type="button">${I.bolt}Buy ${fmtUsd(S.policy.defSize, 0)}</button>
      ${x.paper ? `<button class="btn sm ghost" data-act="track" data-id="${x.id}" type="button">${I.eye}${S.paper.some(p => p.ideaId === x.id) ? 'Tracking' : 'Track forward'}</button>` : ''}
      <span class="sp"></span><button class="btn xs ghost" data-act="save" data-id="${x.id}" type="button" aria-label="Save idea">${I.bookmark}${S.saved.has(x.id) ? 'Saved' : ''}</button></div>
  </article>`;
}
function followBtn(h, sm) { const on = S.follows.has(h); return `<button class="btn ${sm ? 'xs' : 'sm'} ${on ? '' : 'paper'}" data-act="follow" data-h="${h}" type="button">${on ? 'Following' : 'Follow'}</button>`; }
function sponsorCard() {
  const s = SPONSORED[0];
  return `<article class="idea sponsor"><div class="row between wrap"><span class="chip wn">Sponsored</span><span class="dim" style="font-size:12px">${esc(s.payer)} paid FOMA ${fmtUsd(s.amt, 0)} for this slot. It never changes rankings, evidence or search order.</span></div>
    <div class="idea-act">${tokchip(s.sym)} <b>${esc(s.payer)}</b></div><p class="thesis">${esc(s.text)}</p>
    <div class="idea-f"><button class="btn sm" data-act="token" data-sym="${s.sym}" type="button">View $${s.sym}</button><a class="btn sm ghost" href="#transparency">Paid placements</a></div></article>`;
}
function allIdeas() { return [...S.myIdeas.map(prepMine), ...S.feed.map(id => IDX[id])].filter(Boolean); }
function feedIdeas() {
  const f = S.ui.filters;
  let list = allIdeas();
  if (f.verified) list = list.filter(x => x.inv.qty > 0);
  if (f.disclosed) list = list.filter(x => x.comp?.foma || (x.comp?.ext && x.comp.ext.state !== 'none'));
  if (f.paper) list = list.filter(x => x.paper);
  if (f.ranked) list = list.filter(x => CR[x.a] && rankStatus(CR[x.a]).ok);
  if (f.following) list = list.filter(x => S.follows.has(x.a) || x.mine);
  return list.sort((a, b) => lastAct(b) - lastAct(a));
}
const lastAct = x => Math.max(x.pubT, ...x.ev.map(e => e.t).filter(t => t <= Date.now()));

// ---------- discover ----------
function balanceHero() {
  if (S.guest) return `<section class="card m-only" style="display:flex;flex-direction:column;gap:12px"><div class="h2">Browse first. Sign up when you want to trade.</div><p class="lede">Ideas, records and receipts are readable without an account.</p><div class="row"><button class="btn pri" data-act="signup" type="button">Create account</button><button class="btn" data-act="linkwallet" type="button">Link a wallet read-only</button></div></section>`;
  const v = acctValue(), d = dayPnl(); const [whole, cents] = fmtUsd(v).split('.');
  return `<section class="bal-hero m-only"><div><div class="dim" style="font-size:12.5px">Portfolio</div><div class="big num">${whole}<small>.${cents}</small></div><div class="${cls(d)} num" style="font-weight:600">${fmtSignedUsd(d)} today</div></div><div class="row"><button class="btn pri lg" data-act="deposit" type="button">Deposit</button><a class="btn lg" href="#portfolio">Portfolio</a></div></section>`;
}
function topTrades() {
  return `<section class="col" style="gap:10px"><div class="sec-h"><h2 class="h3">Top closed trades this week</h2><button class="btn xs ghost" data-act="disc" data-k="wins" type="button">All wins</button></div>
    <div class="toptr">${WINS.map(w => `<button class="tt" data-act="trader" data-h="${w.a}" data-tab="wins" type="button">${avRing(w.a, 36)}<span class="who"><b>${esc(CR[w.a].name)}</b><span>${w.sym} · ${w.held}</span></span><span class="col" style="align-items:flex-end;line-height:1.2"><span class="pnl up num">${fmtPct(w.ret)}</span><span class="dim num" style="font-size:11px">${fmtSignedUsd(w.usd, true)}</span></span></button>`).join('')}</div></section>`;
}
function storyCard() {
  const x = IDX['moth-kestrel']; const a = authorResult(x), p = paperResult(x);
  return `<section class="story" aria-label="Featured receipts">
    <div class="s-l"><div class="col" style="gap:12px"><span class="tag">Receipts, not vibes</span><h1>every call comes with receipts.</h1>
      <p>See what a trader held when they posted, what they did next, who paid them, and what following them actually returned.</p></div>
      <div class="row wrap"><a class="btn pri" href="#idea-moth-kestrel">${I.receipt}Open the MOTH receipts</a><button class="btn" data-act="replay-story" type="button">${I.play}Replay</button></div></div>
    <div class="s-r"><div class="row wrap" style="gap:8px">${avRing('kestrel', 30)}<b>kestrel.sol</b>${tokchip('MOTH')}<span class="dim" style="font-size:12px">posted ${ago(x.pubT)}</span></div>
      <div class="s-chart"><canvas id="storyChart" aria-label="MOTH price since the post, with the author's moves marked"></canvas></div>
      <div id="storyBar">${hbarHTML(x)}</div>
      <div class="s-facts"><div><span>Author, signed wallets</span><b class="${cls(a.ret)} num">${fmtPct(a.ret)}</b></div><div><span>Following 30 s late</span><b class="${cls(p.ret)} num">${fmtPct(p.ret)}</b></div><div><span>Moved off the record</span><b class="wn num">${fmtQty(holdingsAt(x, Date.now()).moved)}</b></div></div></div>
  </section>`;
}
function vDiscover() {
  const seg = S.ui.disc; const f = S.ui.filters;
  const segs = [['feed','Feed'],['tokens','Tokens'],['leaders','Leaderboard'],['wins','Wins'],['clans','Communities']];
  let body = '';
  if (seg === 'feed') {
    const list = feedIdeas(); const items = [];
    list.forEach((x, i) => { items.push(ideaCard(x, x._fresh)); x._fresh = false; if (i === 1 && !f.nosponsor) items.push(sponsorCard()); });
    body = `<div class="pills" role="group" aria-label="Evidence filters">${[['verified','Has position'],['disclosed','Pay disclosed'],['paper','Paper-tracked'],['ranked','Ranked creators'],['following','Following'],['nosponsor','Hide sponsored']].map(([k, l]) => `<button type="button" class="pill flt ${f[k] ? 'on' : ''}" data-act="filter" data-k="${k}">${f[k] ? I.check.replace('<svg', '<svg style="width:13px;height:13px"') : ''}${l}</button>`).join('')}</div>
      ${S.newQ.length ? `<button class="newpill" data-act="shownew" type="button">${I.up.replace('<svg', '<svg style="width:14px;height:14px"')}${S.newQ.length} new idea${S.newQ.length > 1 ? 's' : ''}</button>` : ''}
      <div class="feed">${items.join('') || '<div class="empty"><b>No ideas match these filters</b>Turn a filter off to see more.</div>'}</div>`;
  } else if (seg === 'tokens') {
    body = `<div class="seg">${[['trending','Trending'],['new','New launches'],['watch','Watchlist'],['held','Holdings']].map(([k, l]) => `<button type="button" class="${S.ui.tl === k ? 'on' : ''}" data-act="tl" data-k="${k}">${l}</button>`).join('')}</div><div class="card tight" style="padding:6px">${tokenRows(S.ui.tl, true)}</div><p class="note">Market cap first, like everyone else, but every price says where it came from: real tokens use a CoinGecko snapshot from ${dstamp(SNAP_TS)}; demo launches move on simulated quotes.</p>`;
  } else if (seg === 'leaders') body = leadersView();
  else if (seg === 'wins') body = winsView();
  else body = clansView();
  return `<div class="stage-in">${balanceHero()}${seg === 'feed' ? storyCard() : ''}${topTrades()}
    <div class="seg disc-seg" role="tablist" aria-label="Discover sections">${segs.map(([k, l]) => `<button type="button" class="${seg === k ? 'on' : ''} ${k === 'tokens' ? 'tok-seg' : ''}" data-act="disc" data-k="${k}">${l}</button>`).join('')}</div>
    ${body}${footNote()}</div>`;
}
function footNote() { return `<div class="foot">FOMA prototype. Creators, ideas, wallets, fills and balances are simulated; real-token prices are a CoinGecko snapshot from ${dstamp(SNAP_TS)}. Nothing here is investment advice. <a href="#transparency" style="text-decoration:underline">How FOMA makes money</a></div>`; }

// ---------- leaderboard / wins / clans ----------
const METRICS = { paper30: ['Median paper return, 30 s late, $250', c => c.rec.paper30, true], author: ['Author return', c => c.rec.author, true], dd: ['Max drawdown', c => c.rec.dd, true], cons: ['Share of positive months', c => c.rec.cons[1] ? c.rec.cons[0] / c.rec.cons[1] * 100 : 0, true] };
function denomBar(r) { const t = r.w + r.l + r.o; return `<span class="denom" title="${r.w} wins, ${r.l} losses, ${r.o} open"><i style="width:${r.w / t * 100}%;background:var(--gain)"></i><i style="width:${r.l / t * 100}%;background:var(--loss)"></i><i style="width:${r.o / t * 100}%;background:var(--fg3)"></i></span>`; }
function discState(c) { const e = c.disc.ext.state; return e === 'late' ? '<span class="chip wn">Late disclosure</span>' : c.disc.alloc ? '<span class="chip if">Allocation disclosed</span>' : '<span class="chip">Attested</span>'; }
function conductState(c) { const d = c.conduct.filter(x => x.kind === 'decision').length, k = c.conduct.filter(x => x.kind === 'correction').length; return d ? `<span class="chip if">${d} decision</span>` : k ? `<span class="chip">${k} correction</span>` : '<span class="dim">None</span>'; }
function leadersView() {
  const st = S.ui.lbStyle, mk = S.ui.lbMetric, [mlab, mf] = METRICS[mk];
  const pool = CREATORS.filter(c => c.style === st);
  const ranked = pool.filter(c => rankStatus(c).ok).sort((a, b) => mf(b) - mf(a));
  const building = pool.filter(c => !rankStatus(c).ok);
  const row = (c, i) => `<tr class="click lb-row" data-act="trader" data-h="${c.h}"><td>${i == null ? '–' : i + 1}</td><td><div class="who-cell">${avRing(c.h, 34)}<div class="col"><b>${esc(c.name)}</b><span>${fmtQty(c.followers)} followers${c.sub ? ` · $${c.sub}/mo research` : ''}</span></div></div></td>
    <td class="r"><b class="${cls(mf(c))}">${mk === 'cons' ? Math.round(mf(c)) + '%' : fmtPct(mf(c))}</b></td><td class="r ${cls(c.rec.author)}">${fmtPct(c.rec.author)}</td><td class="r ${cls(c.rec.paper30)}">${fmtPct(c.rec.paper30)}</td><td class="r dn">${fmtPct(c.rec.dd)}</td>
    <td><div class="col" style="gap:4px">${denomBar(c.rec)}<span class="dim" style="font-size:11px">${c.rec.w}W ${c.rec.l}L ${c.rec.o} open · ${c.rec.calls} ${c.rec.unit || 'calls'}, ${c.rec.days} d</span></div></td>
    <td>${discState(c)}</td><td>${conductState(c)}</td><td class="r dim">${fmtSignedUsd(c.rec.pnl, true)}</td></tr>`;
  return `<section class="col" style="gap:12px">
    <div class="row between wrap" style="gap:10px"><div class="seg" role="tablist" aria-label="Trading style">${[['swing','Swing'],['research','Researchers'],['scalper','Scalpers'],['long','Long-term']].map(([k, l]) => `<button type="button" class="${st === k ? 'on' : ''}" data-act="lbstyle" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="row" style="gap:8px"><span class="dim" style="font-size:12px">Rank by</span><select class="input" style="height:34px;width:auto" id="lbMetric" data-change="lbmetric">${Object.entries(METRICS).map(([k, [l]]) => `<option value="${k}" ${k === mk ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <p class="note">Ranked only after ${MIN_SAMPLE.calls} eligible calls and ${MIN_SAMPLE.days} observed days. Losses, open and unresolved calls all count. Dollar PnL is shown but never ranks anyone, so size and one lucky winner don't dominate. <a href="#transparency" style="text-decoration:underline">Methodology v1.3</a></p>
    <div class="tscroll"><table class="t"><thead><tr><th>#</th><th>Trader</th><th class="r">${esc(mlab)}</th><th class="r">Author</th><th class="r">Paper</th><th class="r">Max DD</th><th>Full record</th><th>Disclosure</th><th>Conduct</th><th class="r">$ PnL (not ranked)</th></tr></thead>
    <tbody>${ranked.map(row).join('') || '<tr><td colspan="10" class="dim">No one in this style meets the minimum yet.</td></tr>'}</tbody></table></div>
    ${building.length ? `<div class="h3" style="margin-top:6px">Building a record</div><div class="tscroll"><table class="t"><tbody>${building.map(c => `<tr class="click" data-act="trader" data-h="${c.h}"><td><div class="who-cell">${avRing(c.h, 30)}<div class="col"><b>${esc(c.name)}</b><span>${esc(rankStatus(c).why)}</span></div></div></td><td class="r"><span class="chip">Unranked</span></td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="panel row between wrap">${S.guest ? '<span class="muted">Your rank appears here once you trade and post ideas.</span>' : `<div class="row">${myAv(30)}<b>You</b><span class="dim">Building a record: ${S.myIdeas.length} of ${MIN_SAMPLE.calls} calls</span></div><span class="chip">Unranked</span>`}</div>
  </section>`;
}
function winsView() {
  return `<section class="col" style="gap:12px"><p class="note">Fully closed winners only, for celebrating. Every card links to that trader's full record, losses included.</p>
    <div class="wins">${WINS.map(w => { const c = CR[w.a]; return `<div class="win"><div class="row between">${tokchip(w.sym)}<span class="dim" style="font-size:12px">closed ${w.closed}</span></div><div><div class="v up num">${fmtPct(w.ret)}</div><div class="dim num" style="font-size:12.5px;margin-top:4px">${fmtSignedUsd(w.usd, true)} · held ${w.held}</div></div>
      <div class="row">${avRing(w.a, 30)}<div class="col" style="line-height:1.2"><b style="font-size:13px">${esc(c.name)}</b><span class="dim" style="font-size:11.5px">Full record: ${c.rec.w}W · ${c.rec.l}L · ${c.rec.o} open</span></div></div>
      <button class="btn sm block" data-act="trader" data-h="${w.a}" data-tab="record" type="button">See full record</button></div>`; }).join('')}</div></section>`;
}
function clansView() {
  return `<section class="col" style="gap:12px"><p class="note">Communities share watchlists and research. Their record uses the same evidence rules as everyone: members' eligible calls, signed wallets, full denominators. There is no separate group score.</p>
    <div class="clans">${CLANS.map(k => `<button class="clan" data-act="clan" data-id="${k.id}" type="button" style="text-align:left"><span class="row"><span class="em" style="background:${k.col}">${k.em}</span><span class="col" style="line-height:1.25"><b>${esc(k.name)}</b><span class="dim" style="font-size:12px">${fmtQty(k.members)} members · ${k.watch} on watchlist</span></span></span>
      <span class="note" style="display:block">${esc(k.note)}</span><span class="row between"><span class="dim" style="font-size:12px">${fmtQty(k.calls)} calls · ${k.days} d</span><b class="${cls(k.paper)} num">${fmtPct(k.paper)} paper</b></span></button>`).join('')}</div></section>`;
}
function openClan(id) {
  const k = CLANS.find(c => c.id === id); const members = CREATORS.filter(c => [k.top, 'marginalia', 'tidewatcher', 'ledgerline', 'flintlock'].includes(c.h)).slice(0, 4);
  openSide(`<div class="row between"><div class="row"><span class="em" style="width:48px;height:48px;border-radius:15px;display:grid;place-items:center;font-size:22px;background:${k.col}">${k.em}</span><div class="col"><b style="font-size:18px">${esc(k.name)}</b><span class="dim">${fmtQty(k.members)} members</span></div></div><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div>
    <p class="lede">${esc(k.note)}</p>
    <div class="stats"><div class="stat"><span>Eligible calls</span><b>${fmtQty(k.calls)}</b></div><div class="stat"><span>Window</span><b>${k.days} days</b></div><div class="stat"><span>Median paper</span><b class="${cls(k.paper)}">${fmtPct(k.paper)}</b></div></div>
    <div class="h3">Shared watchlist</div><div class="row wrap">${TRENDING.slice(0, Math.min(10, k.watch)).map(s => tokchip(s)).join('')}</div>
    <div class="h3">Active members</div><div class="col" style="gap:6px">${members.map(c => `<button class="trow" data-act="trader" data-h="${c.h}" type="button">${avRing(c.h, 34)}<span class="col"><span class="nm">${esc(c.name)}</span><span class="sub">${STYLE[c.style]}</span></span><span class="rt"><b class="${cls(c.rec.paper30)}">${fmtPct(c.rec.paper30)}</b><span class="dim">paper</span></span></button>`).join('')}</div>
    <p class="note">Joining is a demo action in this prototype. Group records only count members' signed-wallet calls.</p><button class="btn pri" data-act="joinclan" data-id="${k.id}" type="button">Join ${esc(k.name)}</button>`);
}

// ---------- token page ----------
function tokenMarkers(sym) {
  const out = [];
  for (const x of allIdeas()) {
    if (x.sym !== sym) continue;
    for (const e of x.ev) {
      if (!['accumulate', 'add', 'sell', 'exit', 'publish', 'transfer', 'inferred'].includes(e.k)) continue;
      if (e.k === 'publish' && x.ev.some(z => z.k === 'accumulate')) continue;
      if (e.t > Date.now()) continue;
      const who = CR[x.a] ? CR[x.a].name : 'You';
      out.push({ t: e.t, p: e.px, kind: e.k, conf: e.conf, img: CR[x.a] ? CR[x.a].av : avatarSVG('me:' + myHandle()), label: who + ': ' + e.title, sub: 'Open the receipts', id: x.id });
    }
  }
  return out;
}
function vToken(sym) {
  const t = TOK[sym]; if (!t) return notFound();
  const st = tokStats(sym); const ideas = allIdeas().filter(x => x.sym === sym); const tab = S.ui.tokTab;
  const tf = S.ui.tf[sym] || (t.demo && t.ageH < 24 ? (t.ageH < 1 ? '15m' : '6h') : '7d');
  const tfs = t.real ? ['3d', '7d'] : t.ageH < 1 ? ['15m'] : t.ageH < 7 ? ['1h', '6h'] : ['1h', '6h', '24h', '3d', '7d'].filter(k => TF[k] <= t.ageH * H * 1.01 || k === '1h');
  const mint = t.real ? t.mint : addrFrom(sym + '#mint');
  const warns = t.warns || [];
  let tabBody = '';
  if (tab === 'ideas') tabBody = ideas.length ? `<div class="feed">${ideas.map(x => ideaCard(x)).join('')}</div>` : `<div class="empty"><b>No ideas on $${sym} yet</b>When a creator posts one, it shows here with their receipts.</div>`;
  else if (tab === 'trades') tabBody = tradesTape(sym);
  else if (tab === 'holders') tabBody = holdersTable(sym);
  else tabBody = myReceiptsFor(sym);
  return `<div class="stage-in tokpage">
    <div class="tok-h">${logo(sym, 52)}<div class="nm"><h1>${esc(t.name)} <span class="dim" style="font-weight:500;font-size:18px">$${sym}</span></h1>
      <div class="row wrap" style="gap:6px"><span class="dim" style="font-size:12.5px">${tokAge(t)}</span>${t.demo ? '<span class="chip">Demo token · simulated quotes</span>' : `<span class="chip">${I.clock}CoinGecko snapshot · ${dstamp(SNAP_TS)}</span>`}<button class="chip" data-act="copy" data-v="${mint}" type="button" title="${t.demo ? 'Demo mint address' : 'Mint address'}">${short(mint)} ${I.copy}</button><button class="chip ${S.watch.has(sym) ? 'ok' : ''}" data-act="watch" data-sym="${sym}" type="button">${S.watch.has(sym) ? I.check + 'Watching' : I.plus + 'Watch'}</button></div></div>
      <div class="mc"><div class="dim" style="font-size:12px">Market cap</div><div class="v" data-live="mcbig" data-sym="${sym}">${odoHTML(fmtUsdC(st.mcap))}</div><div style="font-size:13px"><span data-live="px" data-sym="${sym}" class="num">${fmtPxH(st.px)}</span> <span class="${cls(st.ch)} num" data-live="ch" data-sym="${sym}">${fmtPct(st.ch)}</span></div></div></div>
    <div class="stats"><div class="stat"><span>24h volume${t.demo ? ' (sim.)' : ''}</span><b>${fmtUsdC(st.vol)}</b></div><div class="stat"><span>${t.demo ? (t.curve ? 'Curve reserve' : 'Liquidity') : 'Depth model'}</span><b>${t.demo ? fmtUsdC(st.liq) : fmtUsdC(t.depth)}</b></div><div class="stat"><span>Impact at $1K</span><b>${(impactFor(sym, 1000) * 100).toFixed(2)}%</b></div><div class="stat"><span>Holders</span><b data-live="holders" data-sym="${sym}">${st.holders ? nf0.format(st.holders) : 'Not in snapshot'}</b></div><div class="stat"><span>Supply</span><b>${fmtQty(t.supply)}</b></div>${t.tax ? `<div class="stat"><span>Transfer fee</span><b class="wn">${(t.tax * 100).toFixed(2)}%</b></div>` : ''}</div>
    ${warns.length || t.curve ? `<div class="warns">${t.curve ? `<span class="chip wn">${I.warn}Bonding curve ${Math.round(t.curve * 100)}% · graduates to an AMM at 100%</span>` : ''}${warns.map(([k, l]) => `<span class="chip ${k === 'ok' ? 'ok' : 'wn'}">${k === 'ok' ? I.check : I.warn}${esc(l)}</span>`).join('')}</div>` : ''}
    <div class="chart-card"><div class="chart-top"><div class="seg">${tfs.map(k => `<button type="button" class="${tf === k ? 'on' : ''}" data-act="tf" data-sym="${sym}" data-k="${k}">${k.toUpperCase()}</button>`).join('')}</div>
      <div class="seg">${[['line','Line'],['candles','Candles']].map(([k, l]) => `<button type="button" class="${S.ui.ctype === k ? 'on' : ''}" data-act="ctype" data-k="${k}">${l}</button>`).join('')}</div><span class="grow"></span>
      <span class="dim" style="font-size:11.5px">${t.real ? `Snapshot resolution ~${Math.round(t.res / MIN)} min · bubbles are creators' signed trades` : 'Simulated · bubbles are creators’ signed trades'}</span></div>
      <div class="chart-box"><canvas id="tokChart" aria-label="$${sym} price chart"></canvas><div class="chart-tip"></div></div></div>
    <div class="utabs" role="tablist">${[['ideas', `Ideas<span class="ct">${ideas.length}</span>`], ['trades', 'Trades'], ['holders', 'Holders'], ['mine', 'Your receipts']].map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="toktab" data-k="${k}">${l}</button>`).join('')}</div>
    ${tabBody}
    <section class="card col" style="gap:10px"><div class="h3">About $${sym}</div><p class="lede" style="font-size:13.5px">${esc(t.desc)}</p>
      ${t.meta ? `<div class="col" style="gap:6px"><span class="flabel">Token metadata (untrusted input, shown as text)</span><div class="code">${esc(t.meta)}</div><span class="chip wn" style="align-self:flex-start">${I.shield}Contains instructions aimed at AI assistants. FOMA's assistants treat metadata as data and never follow it.</span></div>` : ''}</section>
    ${footNote()}</div>`;
}
function tradesTape(sym) {
  const t = TOK[sym]; const rows = [];
  for (const x of allIdeas()) if (x.sym === sym) for (const e of x.ev) if (['accumulate', 'add', 'sell', 'exit', 'transfer'].includes(e.k) && e.t <= Date.now()) rows.push({ t: e.t, who: x.a, side: ['sell', 'exit'].includes(e.k) ? 'Sell' : e.k === 'transfer' ? 'Transfer' : 'Buy', qty: e.d ? (e.d.add || e.d.sold || e.d.moved) : x.inv.qty, px: e.px, signed: true });
  if (t.demo) { const r = mulberry32(hashStr(sym + '#tape' + Math.floor(Date.now() / 20000))); for (let i = 0; i < 9; i++) { const tt = Date.now() - i * 37000 - r() * 30000; const usd = Math.exp(Math.log(20) + r() * 3.4); const px = priceAt(sym, tt); rows.push({ t: tt, who: null, wallet: b58(4, r) + '…' + b58(4, r), side: r() > 0.47 ? 'Buy' : 'Sell', qty: usd / px, px }); } }
  rows.sort((a, b) => b.t - a.t);
  return `<div class="tscroll"><table class="t"><thead><tr><th>Time</th><th>Trader</th><th>Side</th><th class="r">Amount</th><th class="r">Value</th><th class="r">Price</th></tr></thead><tbody>${rows.slice(0, 16).map(r => `<tr><td class="dim">${ago(r.t)}</td><td>${r.who ? `<button class="row" data-act="trader" data-h="${r.who}" type="button" style="gap:8px">${av(r.who, 22)}<b>${esc(CR[r.who] ? CR[r.who].name : 'You')}</b>${vchk}</button>` : `<span class="mono dim">${r.wallet}</span>`}</td><td class="${r.side === 'Buy' ? 'up' : r.side === 'Sell' ? 'dn' : 'wn'}">${r.side}</td><td class="r">${fmtQty(r.qty)}</td><td class="r">${fmtUsdC(r.qty * r.px)}</td><td class="r">${fmtPxH(r.px)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${t.real ? 'Market-wide trades are not part of the snapshot; this list shows creators’ signed-wallet trades only.' : 'Unnamed rows are simulated market trades. Named rows are creators’ signed-wallet trades.'}</p>`;
}
function holdersTable(sym) {
  const t = TOK[sym]; if (t.real) return `<div class="empty"><b>Holder data isn't in the snapshot</b>The production indexer will show top holders with tagged wallets. Signed creator wallets are always labeled.</div>`;
  const r = mulberry32(hashStr(sym + '#holders')); const rows = [{ l: 'Liquidity pool', pct: 8 + r() * 6, tag: 'Pool' }];
  if (sym === 'KILN') rows.push({ l: 'KILN team treasury', pct: 12, tag: 'Team (tagged)' });
  if (sym === 'MOTH') rows.push({ l: 'kestrel.sol · wallet 1', pct: 0.084, tag: 'Signed creator wallet', h: 'kestrel' }, { l: '7xQr…pR4w', pct: 0, tag: 'Unverified · linked by inference', inf: true });
  for (let i = 0; i < 7; i++) rows.push({ l: b58(4, r) + '…' + b58(4, r), pct: (t.sym === 'TADPOLE' ? 9 : 5) * Math.pow(0.72, i) * (0.7 + r() * 0.5), tag: i === 0 && t.curve ? 'Dev wallet' : '' });
  return `<div class="tscroll"><table class="t"><thead><tr><th>Holder</th><th>Label</th><th class="r">Share</th></tr></thead><tbody>${rows.map(x => `<tr><td>${x.h ? `<button class="row" data-act="trader" data-h="${x.h}" type="button" style="gap:8px">${av(x.h, 22)}<b>${esc(x.l)}</b>${vchk}</button>` : `<span class="mono">${esc(x.l)}</span>`}</td><td>${x.tag ? `<span class="chip ${x.inf ? 'if' : ''}">${esc(x.tag)}</span>` : ''}</td><td class="r">${x.pct.toFixed(x.pct < 1 ? 3 : 2)}%</td></tr>`).join('')}</tbody></table></div><p class="note">Demo holder data. Labels say how each tag is known: signed control, team disclosure, or inference.</p>`;
}
function myReceiptsFor(sym) { const rs = (S.acct?.receipts || []).filter(r => r.sym === sym); if (!rs.length) return `<div class="empty"><b>No receipts for $${sym}</b>Every order you place gets a receipt, including failed and expired ones.</div>`; return receiptList(rs); }

// ---------- idea page (the signature view) ----------
function prepMine(m) { if (!m) return null; if (!m._prep) { m.ev.forEach(e => { e.px = e.px ?? priceAt(m.sym, e.t); }); m._prep = true; IDX[m.id] = m; } return m; }
function getIdea(id) { return IDX[id] || prepMine(S.myIdeas.find(x => x.id === id)); }
function asofHTML(x, t) {
  const now = Date.now(); const px = priceAt(x.sym, t); const th = thesisAt(x, t); const comp = compAt(x, t);
  const entry = x.inv.basis ?? priceAt(x.sym, x.pubT); const dEntry = (px / entry - 1) * 100;
  const known = x.ev.filter(e => e.t <= t);
  const lastE = known[known.length - 1];
  const sz = S.ui.ideaSize || S.policy.defSize; const imp = impactFor(x.sym, sz) * 100;
  const c = CR[x.a];
  const extTxt = comp.ext ? (comp.ext.state === 'late' ? `Paid by ${esc(comp.ext.payer)} · ${fmtUsd(comp.ext.amt, 0)} · self-reported ${Math.round((comp.ext.t - x.pubT) / H)} h after posting` : comp.ext.state === 'none-yet' ? 'None declared at this moment' : 'No outside pay (attested)') : 'None declared';
  return `
    <div class="af"><span>${x.inv.qty ? 'Author entry vs. quote at this moment' : 'Price at this moment'}</span><b>${fmtPxH(px)} ${x.inv.qty ? `<span class="${cls(dEntry)}" style="font-size:13px">${Math.abs(dEntry).toFixed(1)}% ${dEntry >= 0 ? 'above' : 'below'} entry</span>` : ''}</b><p>${x.inv.qty ? `Author entry ${fmtPxH(entry)}${x.inv.basis ? ' (known cost)' : ' (publication price)'}. A historical gap, not an instruction to buy.` : 'Research note with no position.'}</p></div>
    <div class="af"><span>Signed-wallet holdings at this moment</span>${hbarHTML(x, t)}</div>
    <div class="af"><span>Your order size, priced now</span><div class="row" style="gap:8px"><input class="input" id="ideaSize" type="number" inputmode="decimal" min="1" step="10" value="${sz}" style="height:34px;width:110px" data-input="ideasize" aria-label="Order size in dollars"><b class="num" id="ideaImp">${imp.toFixed(2)}% est. impact</b></div><p>Estimated at ${clock(now)} for $${sym2(x)}. An estimate with a timestamp, not a guaranteed fill.</p></div>
    <div class="af"><span>Compensation known at this moment</span><b style="font-size:14px">${comp.foma ? (comp.foma.amt ? `FOMA paid ${fmtUsd(comp.foma.amt, 0)}${comp.foma.related === false ? ' (unrelated work)' : ''} · logged by FOMA` : 'FOMA payment declined · logged') : 'No FOMA payment'}</b><p class="${comp.ext?.state === 'late' ? 'wn' : ''}">External: ${extTxt}</p>${x.comp?.alloc ? `<p>${esc(x.comp.alloc)}</p>` : ''}</div>
    <div class="af"><span>Thesis at this moment · v${th.n}</span><p style="color:var(--fg)">${esc(th.text)}</p></div>
    <div class="af"><span>Measurement coverage</span><b style="font-size:14px">${c ? coverage(x) : 'Your record · building'}</b><p>${c ? (rankStatus(c).ok ? 'Meets the ranking minimum.' : esc(rankStatus(c).why) + '.') : ''} Last event: ${lastE ? esc(lastE.title) : '—'}.</p></div>`;
}
const sym2 = x => x.sym;
function outcomesHTML(x) {
  const a = authorResult(x), p = paperResult(x), o = x.obs;
  const aBox = !a ? `<div class="out"><span class="tag">Author result</span><div class="v dim">n/a</div><ul><li>No position to measure.</li></ul></div>` : a.unknown ? `<div class="out"><span class="tag">Author result</span><div class="v dim">Not computed</div><ul><li>${esc(a.note)}</li></ul></div>` :
    `<div class="out"><span class="tag">Author result · signed wallets</span><div class="v ${cls(a.ret)} num">${fmtPct(a.ret)}</div><ul><li>Proceeds ${fmtUsd(a.proceeds)} + still held ${fmtUsd(a.value)} vs. cost ${fmtUsd(a.cost)}, net of known costs.</li>${a.moved ? `<li class="wn">Excludes ${fmtQty(a.moved)} $${x.sym} moved to an unverified wallet. Shown separately, never counted as a sale.</li>` : ''}<li>Original basis known.</li></ul></div>`;
  const pBox = !p ? `<div class="out"><span class="tag">Paper outcome</span><div class="v dim">n/a</div><ul><li>Research notes are not paper-tracked.</li></ul></div>` :
    `<div class="out"><span class="tag">Paper outcome · forward rule</span><div class="v ${cls(p.ret)} num">${fmtPct(p.ret)}</div><ul><li>Entry ${p.rules.delay} s after posting at ${fmtPxH(p.entry)}, including ${(p.imp * 100).toFixed(2)}% impact.</li><li>Fixed ${fmtUsd(p.rules.notional, 0)}. Exit: ${p.rules.exitWithAuthor ? '30 s after the author exits' : `${p.rules.days} days or ${fmtPct(p.rules.stop * 100, 0)} stop`}.</li><li>${p.closed ? esc(p.why) + ' · ' + ago(p.exitT) : `Open · if sold now: ${fmtPct(p.liq)}`}</li></ul><button class="btn sm" data-act="track" data-id="${x.id}" type="button">${I.eye}Track this rule yourself</button></div>`;
  const oBox = !o ? `<div class="out"><span class="tag">Observed participants</span><div class="v dim">n/a</div><ul><li>Not enough consenting participants yet.</li></ul></div>` :
    `<div class="out"><span class="tag">Observed participants · opt-in</span><div class="v ${cls(o.med)} num">${fmtPct(o.med)}</div><ul><li>Median of ${o.n} consenting FOMA users who viewed this idea and traded $${x.sym} within 24 h.</li><li>${o.open}% still open · ${o.missing}% missing data (positions moved off FOMA).</li><li>Observation does not establish causation.</li></ul></div>`;
  return `<div class="outs">${aBox}${pBox}${oBox}</div>`;
}
const SRC = { chain: ['Chain', 'tx'], foma: ['FOMA ledger', 'rec'], creator: ['Creator statement', 'stmt'], community: ['Community reports', 'rep'], review: ['Human review', 'dec'] };
const CONF = { verified: ['ok', 'Verified'], inferred: ['if', 'Inferred'], self: ['wn', 'Self-reported'] };
function evListHTML(x, t) {
  return `<div class="evl">${x.ev.map(e => { const [sl] = SRC[e.src] || ['Source']; const [cc, cl] = CONF[e.conf] || ['', '']; const sig = addrFrom(x.id + e.id).slice(0, 8) + '…' + addrFrom(x.id + e.id + 'b').slice(0, 6); const fut = e.t > t;
    return `<button class="ev ${fut ? 'future' : ''} ${S.ui.curEv === x.id + e.id ? 'cur' : ''}" data-act="seek" data-id="${x.id}" data-t="${e.t}" data-ev="${e.id}" type="button" style="text-align:left;width:100%"><span class="ic" style="color:${KIND_COL[e.k]}">${I[KIND_IC[e.k]] || I.dot}</span><span><b>${esc(e.title)}</b><span class="evp">${esc(e.p)}</span><span class="meta"><span class="chip ${cc}">${cl}</span><span class="chip">${sl}</span>${e.src === 'chain' ? `<span class="chip mono">${sig}</span>` : ''}<span class="chip num">${fmtPx(e.px)}</span><span class="cite">[${e.id}]</span></span></span><time>${dstamp(e.t)}<br><span class="dim">${ago(e.t)}</span></time></button>`; }).join('')}</div>
    <p class="note">Each event keeps its source time and the time FOMA observed it. Corrections are added as new events; nothing is edited away.</p>`;
}
function diffWords(a, b) { const A = a.split(/(\s+)/), B = b.split(/(\s+)/); const n = A.length, m = B.length; const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]); let i = 0, j = 0, out = ''; while (i < n && j < m) { if (A[i] === B[j]) { out += esc(A[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out += `<del>${esc(A[i])}</del>`; i++; } else { out += `<ins>${esc(B[j])}</ins>`; j++; } } while (i < n) out += `<del>${esc(A[i++])}</del>`; while (j < m) out += `<ins>${esc(B[j++])}</ins>`; return out; }
function versionsHTML(x) {
  return x.v.map((v, i) => `<div class="panel col" style="gap:6px"><div class="row between"><b>v${v.n}${i === 0 ? ' · as published' : ''}</b><span class="dim num" style="font-size:12px">${dstamp(v.t)} · hash ${addrFrom(x.id + 'v' + v.n).slice(0, 10).toLowerCase()}</span></div><p class="diff" style="margin:0;font-size:13.5px;line-height:1.55">${i === 0 ? esc(v.text) : diffWords(x.v[i - 1].text, v.text)}</p></div>`).join('') + `<p class="note">The hash helps detect edits after the fact. It doesn't make a claim true.</p>`;
}
function graphHTML(x) {
  const c = CR[x.a]; const W = 640, Hh = 300; let nodes = [], edges = [], conf = '';
  if (x.id === 'moth-kestrel') {
    nodes = [{ id: 'w1', x: 120, y: 80, l: 'Wallet 1', s: 'signed · 8Hk2…3sQx', k: 'signed' }, { id: 'w2', x: 60, y: 190, l: 'Wallet 2', s: 'signed', k: 'signed' }, { id: 'w3', x: 180, y: 230, l: 'Wallet 3', s: 'signed', k: 'signed' }, { id: 'u1', x: 360, y: 70, l: '7xQr…pR4w', s: 'unverified', k: 'unv' }, { id: 'pool', x: 560, y: 140, l: 'MOTH/SOL pool', s: 'AMM', k: 'pool' }, { id: 'cex', x: 360, y: 235, l: 'Exchange withdrawals', s: 'batch #44817', k: 'cex' }];
    edges = [['w1', 'w2', 'signed', 'same signer'], ['w2', 'w3', 'signed', ''], ['w1', 'w3', 'signed', ''], ['w1', 'u1', 'transfer', '600K MOTH'], ['u1', 'pool', 'sale', 'sold 600K'], ['w1', 'pool', 'sale', 'sold 660K'], ['cex', 'w1', 'funding', '4 min apart'], ['cex', 'u1', 'funding', '']];
    conf = `<b>7xQr…pR4w and kestrel.sol:</b> inferred, medium-low confidence. Evidence: a direct transfer from a signed wallet, plus funding from one exchange batch 4 minutes apart. A shared funding source or similar timing alone is never treated as proof. This link was <b>not used</b> in decision D-207.`;
  } else if (x.id === 'relic-wren') {
    nodes = [{ id: 'w1', x: 120, y: 90, l: 'Wallet 1', s: 'signed', k: 'signed' }, { id: 'w2', x: 120, y: 220, l: 'Wallet 2', s: 'signed', k: 'signed' }, { id: 'u1', x: 420, y: 90, l: '9fQd…7kLm', s: 'unrelated (reversed)', k: 'unv' }, { id: 'cex', x: 420, y: 225, l: 'Exchange withdrawals', s: 'shared batch', k: 'cex' }];
    edges = [['w1', 'w2', 'signed', 'same signer'], ['cex', 'w1', 'funding', ''], ['cex', 'u1', 'funding', 'shared batch only']];
    conf = `<b>9fQd…7kLm:</b> the automated link was reversed after review (correction X-0988). Being funded by the same exchange withdrawal batch is not evidence of common ownership.`;
  } else {
    const n = c ? Math.min(c.wallets, 4) : 1; for (let i = 0; i < n; i++) nodes.push({ id: 'w' + i, x: 110 + (i % 2) * 90, y: 70 + i * 60, l: 'Wallet ' + (i + 1), s: 'signed', k: 'signed' });
    nodes.push({ id: 'pool', x: 520, y: 150, l: `${x.sym} pools`, s: 'AMM', k: 'pool' });
    for (let i = 1; i < n; i++) edges.push(['w0', 'w' + i, 'signed', i === 1 ? 'same signer' : '']);
    if (x.inv.qty) edges.push(['w0', 'pool', x.ev.some(e => e.k === 'sell' || e.k === 'exit') ? 'sale' : 'buy', x.ev.some(e => e.k === 'sell' || e.k === 'exit') ? 'bought, then sold' : 'bought']);
    conf = `No inferred links on this idea. Signed control proves control of these ${n} wallet${n > 1 ? 's' : ''} at signing time; it can't prove there are no other wallets.`;
  }
  const N = Object.fromEntries(nodes.map(n => [n.id, n]));
  const sty = { signed: ['#DCE0E7', '', 2.4], transfer: ['#F4BB4E', '', 2.4], sale: ['#FF6B62', '', 2], buy: ['#3CDDA0', '', 2], funding: ['#A8ACFF', '6 5', 1.8], timing: ['#A8ACFF', '2 5', 1.8] };
  const eSvg = edges.map(([a, b, k, l]) => { const A = N[a], B = N[b]; const [col, dash, w] = sty[k]; const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - (k === 'signed' ? 0 : 14); const flow = (k === 'transfer' || k === 'sale') ? 'class="flow"' : ''; return `<path d="M${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}" stroke="${col}" stroke-width="${w}" fill="none" ${dash ? `stroke-dasharray="${dash}"` : flow} marker-end="${k === 'signed' ? '' : `url(#ar-${k})`}" opacity=".9"/>${l ? `<text x="${mx}" y="${my - 6}" text-anchor="middle">${esc(l)}</text>` : ''}`; }).join('');
  const nSvg = nodes.map(n => { const col = n.k === 'signed' ? '#DCE0E7' : n.k === 'unv' ? '#F4BB4E' : n.k === 'cex' ? '#A8ACFF' : '#ABA497'; return `<g><circle cx="${n.x}" cy="${n.y}" r="${n.k === 'pool' ? 26 : 20}" fill="#1A1815" stroke="${col}" stroke-width="2.2" ${n.k === 'unv' ? 'stroke-dasharray="4 3"' : ''}/>${n.k === 'signed' ? `<path d="M${n.x - 6} ${n.y} l4 4 8-8" stroke="#DCE0E7" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : n.k === 'pool' ? `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" class="nl">AMM</text>` : `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" class="nl">${n.k === 'cex' ? 'CEX' : '?'}</text>`}<text x="${n.x}" y="${n.y + 38}" text-anchor="middle" class="nl">${esc(n.l)}</text><text x="${n.x}" y="${n.y + 52}" text-anchor="middle">${esc(n.s)}</text></g>`; }).join('');
  const defs = ['transfer', 'sale', 'buy', 'funding'].map(k => `<marker id="ar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${sty[k][0]}"/></marker>`).join('');
  return `<div style="overflow-x:auto"><svg class="egraph" viewBox="0 0 ${W} ${Hh + 20}" role="img" aria-label="Wallet evidence graph" style="min-width:520px"><defs>${defs}</defs>${eSvg}${nSvg}</svg></div>
    <div class="legend-row"><span><i style="border-color:#DCE0E7"></i>Signed control</span><span><i style="border-color:#F4BB4E"></i>Observed transfer</span><span><i style="border-color:#FF6B62"></i>Sale</span><span><i style="border-color:#A8ACFF;border-top-style:dashed"></i>Shared funding (not proof)</span></div>
    <div class="ctxbox">${I.info.replace('<svg', '<svg style="width:16px;height:16px;flex:none;margin-top:1px"')}<span>${conf}</span></div>`;
}
function caseHTML(x) {
  if (!x.cases?.length) return '';
  const steps = [['Flag', 'Case C-1042 opened from 23 reports. Automated and community flags are leads.', -43], ['Review', 'Human reviewer assigned. Creator invited to respond with any contrary evidence.', -40], ['Provisional restriction', 'None applied. Self-custodied funds are never frozen.', null], ['Decision', 'D-207: late disclosure upheld. 7-day pause on paid-promotion rewards. Inferred link not used.', -12], ['Appeal', 'Appeal window open until 14 Nov. Any correction will be added here.', null]];
  return `<section class="col" style="gap:12px"><div class="sec-h"><h2 class="h2">Enforcement record</h2><a class="btn xs" href="#case-c1042">Open case</a></div>
    <div class="card col" style="gap:0">${steps.map(([t, p, h], i) => `<div class="rstep ${h != null ? 'done' : i === 2 ? '' : 'now'}"><span class="ic">${h != null ? I.check : i === 2 ? I.dot : I.clock}</span><span><b>${t}</b><small>${p}</small></span><span class="t">${h != null ? dstamp(BOOT + h * H, false) : ''}</span></div>`).join('')}</div>
    <div class="ctxbox">${I.pen.replace('<svg', '<svg style="width:16px;height:16px;flex:none"')}<span><b>Creator's response (self-reported):</b> "I forgot to add the disclosure when posting and added it when I noticed. The 7xQr wallet isn't mine." The decision records both the response and what the evidence can't establish.</span></div></section>`;
}
function vIdea(id) {
  const x = getIdea(id); if (!x) return notFound();
  const c = CR[x.a]; const ph = S.ui.ph?.[id] ?? Date.now(); const t0 = Math.min(x.pubT, ...x.ev.map(e => e.t)); const mine = x.mine;
  return `<div class="stage-in" id="ideaView" data-id="${id}">
    <div class="idea-top"><button class="btn sm ghost" data-act="back" type="button">${I.back}Back</button>${mine ? myAv(42) : `<button data-act="trader" data-h="${x.a}" type="button">${avRing(x.a, 44)}</button>`}<div class="col" style="line-height:1.3;min-width:0"><b style="font-size:16px">${mine ? 'Your idea' : esc(c.name)} ${vchk}</b><span class="dim" style="font-size:12.5px">${c ? STYLE[c.style] + ' · ' + coverage(x) : 'Unranked · building a record'}</span></div>
      <div class="acts">${mine ? `<button class="btn sm" data-act="edit" data-id="${id}" type="button">${I.pen}Edit as v${x.v.length + 1}</button>` : followBtn(x.a)}<button class="btn sm" data-act="ask" data-role="evidence" data-id="${id}" type="button">${I.spark}Explain</button>${mine ? '' : `<button class="btn sm ghost" data-act="report" data-id="${id}" type="button">${I.flag}Report</button>`}</div></div>
    <div class="row wrap" style="gap:6px">${tokchip(x.sym)}<span class="dim" style="font-size:12.5px">posted ${dstamp(x.pubT)} · ${x.v.length} version${x.v.length > 1 ? 's' : ''}</span>${compChips(x)}</div>
    <h1 class="h1" style="font-size:clamp(22px,2.6vw,30px);max-width:34ch">${esc(x.v[0].text.split('.')[0])}.</h1>
    <div class="chart-card"><div class="chart-top"><button class="btn sm pri" data-act="replay" data-id="${id}" type="button" id="replayBtn">${I.play}Replay</button><button class="btn sm" data-act="seek" data-id="${id}" data-t="now" type="button">Now</button><span class="grow"></span><span class="dim" style="font-size:11.5px">Drag the chart or the timeline. Everything after the playhead is hidden.</span></div>
      <div class="chart-box" style="height:clamp(230px,34vw,340px)"><canvas id="ideaChart" aria-label="Price with the idea's events"></canvas><div class="chart-tip"></div></div>
      <div class="tline" id="tline" data-t0="${t0}" data-t1="${Date.now()}">${tlineHTML(x, t0, Date.now(), ph)}</div></div>
    <div class="row between wrap"><div class="h3">What was known at <span id="phTime" class="lm">${ph >= Date.now() - 2000 ? 'now' : dstamp(ph)}</span></div><span class="note">Facts recorded later stay hidden. Nothing later rewrites what was captured at publication.</span></div>
    <div class="asof" id="asof">${asofHTML(x, ph)}</div>
    <section class="col" style="gap:12px"><div class="sec-h"><h2 class="h2">Three outcomes, kept separate</h2></div>${outcomesHTML(x)}</section>
    <section class="col" style="gap:12px"><div class="sec-h"><h2 class="h2">Evidence</h2><span class="dim" style="font-size:12px">${x.ev.length} events</span></div><div class="card" style="padding:6px 10px" id="evList">${evListHTML(x, ph)}</div></section>
    <section class="col" style="gap:12px"><div class="sec-h"><h2 class="h2">Thesis versions</h2></div>${versionsHTML(x)}</section>
    <section class="col" style="gap:12px"><div class="sec-h"><h2 class="h2">Wallet evidence</h2></div><div class="card col" style="gap:12px">${graphHTML(x)}</div></section>
    ${caseHTML(x)}
    <section class="card col" style="gap:10px" id="explainBox"><div class="row between wrap"><div class="row">${I.spark.replace('<svg', '<svg style="width:18px;height:18px;color:var(--lime)"')}<b>Evidence explainer</b></div><div class="bounds"><span class="chip">Read-only</span><span class="chip">Sources shown</span><span class="chip">No wallet access</span></div></div>
      <p class="note" style="margin:0">Summarizes the exact events and disclosures behind this record, with citations you can click. It separates verified facts from inferences and creator statements, and never tells you to buy or sell.</p>
      <div class="row wrap"><button class="btn sm pri" data-act="explain" data-id="${id}" type="button">Explain this record</button><button class="btn sm" data-act="contrary" data-id="${id}" type="button">Find missing facts</button></div><div class="ai-out" id="explainOut"></div></section>
    ${footNote()}</div>`;
}
function tlineHTML(x, t0, t1, ph) {
  const pos = t => clamp((t - t0) / (t1 - t0 || 1) * 100, 0, 100);
  return `<div class="tl-track"><div class="base"></div><div class="done" style="width:${pos(ph)}%"></div>${x.ev.map(e => `<button type="button" class="tl-node k-${e.k} ${e.t > ph ? 'future' : ''} ${S.ui.curEv === x.id + e.id ? 'cur' : ''}" style="left:${pos(e.t)}%" data-act="seek" data-id="${x.id}" data-t="${e.t}" data-ev="${e.id}" title="${esc(e.title)}" aria-label="${esc(e.title)}">${I[KIND_IC[e.k]] || ''}</button>`).join('')}<div class="tl-head" style="left:${pos(ph)}%" role="slider" tabindex="0" aria-label="Timeline playhead" aria-valuemin="${t0}" aria-valuemax="${t1}" aria-valuenow="${Math.round(ph)}" aria-valuetext="${dstamp(ph)}" data-key="tl"></div></div>
    <div class="tl-labels"><span>${dstamp(t0)}</span><span>now</span></div>`;
}

// ---------- trader profile ----------
function recordRows(c) {
  const r = mulberry32(hashStr(c.h + '#rec')); const n = Math.min(c.rec.calls, 24); const syms = ['BONK', 'WIF', 'PENGU', 'FARTCOIN', 'POPCAT', 'MEW', 'BOME', 'PUMP', 'MOTH', 'KILN', 'RELIC', 'BRINE'];
  const out = []; const tot = c.rec.w + c.rec.l + c.rec.o;
  for (let i = 0; i < n; i++) {
    const u = r(); const kind = u < c.rec.w / tot ? 'W' : u < (c.rec.w + c.rec.l) / tot ? 'L' : 'O';
    const ar = kind === 'W' ? 2 + r() * 38 : kind === 'L' ? -(2 + r() * 34) : (r() - 0.5) * 30;
    const pr = ar + (c.rec.paper30 - c.rec.author) / 3 + (r() - 0.5) * 8;
    out.push({ t: Date.now() - (i + 0.5) * c.rec.days * D / n, sym: syms[Math.floor(r() * syms.length)], kind, ar, pr, unavail: r() < c.rec.unavail / Math.max(1, c.rec.calls) });
  }
  return out;
}
function dimsHTML(c) {
  const f = followability(c); const rs = rankStatus(c);
  const fomaTot = c.disc.foma.reduce((s, x) => s + x.amt, 0);
  return `<div class="dims">
    <div class="dimc"><h4>${I.shield.replace('<svg', '<svg style="width:14px;height:14px"')}Wallet control</h4><div class="v">${c.wallets} signed wallet${c.wallets > 1 ? 's' : ''}</div><p>Last verified ${esc(c.signed)}. Proves control at signing time. It can't prove there are no other wallets.</p></div>
    <div class="dimc"><h4>${I.coin.replace('<svg', '<svg style="width:14px;height:14px"')}Disclosure</h4><div class="v">${c.disc.ext.state === 'late' ? '<span class="wn">Late disclosure</span>' : 'Complete'}</div><p>FOMA payments: ${fomaTot ? fmtUsd(fomaTot, 0) + ' logged' : c.disc.foma.length ? 'declined, logged' : 'none'}. External: ${esc(c.disc.ext.text)}.${c.disc.alloc ? ' ' + esc(c.disc.alloc) + '.' : ''}</p></div>
    <div class="dimc"><h4>${I.trophy.replace('<svg', '<svg style="width:14px;height:14px"')}Performance</h4><div class="v ${cls(c.rec.author)}">${fmtPct(c.rec.author)} author</div><p>${c.rec.calls} eligible ${c.rec.unit || 'calls'} over ${c.rec.days} days: ${c.rec.w} wins, ${c.rec.l} losses, ${c.rec.o} open. Max drawdown ${fmtPct(c.rec.dd)}. ${rs.ok ? 'Ranked.' : esc(rs.why) + '.'}</p></div>
    <div class="dimc"><h4>${I.eye.replace('<svg', '<svg style="width:14px;height:14px"')}Practical followability</h4><div class="v ${f[0] === 'dn' ? 'dn' : f[0] === 'ok' ? 'up' : ''}">${f[1]}</div><p>Paper, 30 s late at $250: ${fmtPct(c.rec.paper30)}. Two minutes late at $1K: ${fmtPct(c.rec.paper2m)}. Unavailable quotes: ${c.rec.unavail} of ${c.rec.calls}, counted as failed entries.</p></div>
    <div class="dimc"><h4>${I.flag.replace('<svg', '<svg style="width:14px;height:14px"')}Conduct</h4><div class="v">${c.conduct.length ? c.conduct.length + ' on record' : 'Nothing on record'}</div><p>${c.conduct.length ? c.conduct.map(d => esc(d.title)).join('; ') + '.' : 'No decisions, no pending reviews.'} A losing call is never misconduct.</p></div></div>`;
}
function traderHTML(h, tab, full) {
  const c = CR[h]; if (!c) return notFound(); tab = tab || 'record';
  const ideas = allIdeas().filter(x => x.a === h); const rows = recordRows(c);
  let body = '';
  if (tab === 'record') body = `<div class="row between wrap"><div class="row">${denomBar(c.rec)}<span class="dim" style="font-size:12px">${c.rec.w} wins · ${c.rec.l} losses · ${c.rec.o} open, of ${c.rec.calls}</span></div><span class="dim" style="font-size:12px">Showing latest ${rows.length}</span></div>
    <div class="tscroll"><table class="t"><thead><tr><th>Date</th><th>Token</th><th>Result</th><th class="r">Author</th><th class="r">Paper 30 s</th></tr></thead><tbody>${rows.map(r => `<tr><td class="dim">${dstamp(r.t, false)}</td><td>${tokchip(r.sym)}</td><td>${r.kind === 'W' ? '<span class="chip up">Win</span>' : r.kind === 'L' ? '<span class="chip dn">Loss</span>' : '<span class="chip">Open</span>'}</td><td class="r ${cls(r.ar)}">${fmtPct(r.ar)}</td><td class="r ${r.unavail ? 'wn' : cls(r.pr)}">${r.unavail ? 'No quote' : fmtPct(r.pr)}</td></tr>`).join('')}</tbody></table></div><p class="note">Demo record. Every eligible call is listed, including losses, open and unresolved ones. "No quote" means FOMA couldn't get an executable price at the rule's entry time; it counts as a failed entry.</p>`;
  else if (tab === 'ideas') body = ideas.length ? `<div class="feed">${ideas.map(x => ideaCard(x)).join('')}</div>` : '<div class="empty"><b>No open ideas</b>Past calls are in the record tab.</div>';
  else if (tab === 'wins') { const ws = WINS.filter(w => w.a === h); body = (ws.length ? `<div class="wins">${ws.map(w => `<div class="win"><div class="row between">${tokchip(w.sym)}<span class="dim" style="font-size:12px">closed ${w.closed}</span></div><div class="v up">${fmtPct(w.ret)}</div><span class="dim" style="font-size:12px">${fmtSignedUsd(w.usd, true)} · held ${w.held}</span></div>`).join('')}</div>` : '<div class="empty"><b>No closed winners this week</b></div>') + `<div class="panel row between"><span class="muted">The full record has ${c.rec.l} losses too.</span><button class="btn xs" data-act="trader" data-h="${h}" data-tab="record" type="button">Show full record</button></div>`; }
  else if (tab === 'disc') body = `<div class="tscroll"><table class="t"><thead><tr><th>Source</th><th>Detail</th><th>Evidence</th></tr></thead><tbody>${c.disc.foma.map(f => `<tr><td>FOMA payment</td><td>${f.amt ? fmtUsd(f.amt, 0) : 'Declined'} · ${esc(f.label)} · ${esc(f.at)}</td><td><span class="chip ok">Logged by FOMA</span></td></tr>`).join('')}<tr><td>External payments</td><td style="white-space:normal">${esc(c.disc.ext.text)}</td><td><span class="chip ${c.disc.ext.state === 'late' ? 'wn' : ''}">${c.disc.ext.state === 'late' ? 'Self-reported, late' : 'Attested by creator'}</span></td></tr>${c.disc.alloc ? `<tr><td>Token allocation</td><td style="white-space:normal">${esc(c.disc.alloc)}</td><td><span class="chip if">Tagged wallets</span></td></tr>` : ''}</tbody></table></div><p class="note">FOMA payments are logged independently. External payments are the creator's statement unless evidence is attached.</p>`;
  else body = c.conduct.length ? c.conduct.map(d => `<div class="card col" style="gap:8px"><div class="row between wrap"><b>${esc(d.id)} · ${esc(d.title)}</b><span class="chip ${d.kind === 'decision' ? 'if' : ''}">${d.kind === 'decision' ? 'Decision' : 'Correction'}</span></div><p class="lede" style="font-size:13px">${esc(d.outcome)}</p><span class="dim" style="font-size:12px">${esc(d.at)}${d.appeal ? ' · ' + esc(d.appeal) : ''}</span>${d.id === 'D-207' ? '<a class="btn xs" href="#case-c1042" style="align-self:flex-start">Open case</a>' : ''}</div>`).join('') : '<div class="empty"><b>Nothing on record</b>Decisions, pending reviews and corrections would appear here with their evidence.</div>';
  return `<div class="col" style="gap:16px">
    <div class="row between">${full ? '<span></span>' : `<a class="btn xs ghost" href="#trader-${h}">Open full page</a>`}${full ? '' : `<button class="xbtn" data-act="close" aria-label="Close">${I.x}</button>`}</div>
    <div class="row" style="gap:14px">${avRing(h, 66)}<div class="col" style="gap:3px;min-width:0"><b style="font-size:21px;letter-spacing:-.03em">${esc(c.name)} ${vchk}</b><span class="dim">${STYLE[c.style]} · joined ${esc(c.joined)} · ${fmtQty(c.followers)} followers</span><span class="muted" style="font-size:13px">${esc(c.bio)}</span></div></div>
    <div class="row wrap">${followBtn(h)}${c.sub ? `<button class="btn sm" data-act="subscribe" data-h="${h}" type="button">Subscribe · $${c.sub}/mo research</button>` : ''}<button class="btn sm ghost" data-act="tip" data-h="${h}" type="button">Tip</button><button class="btn sm ghost" data-act="card" data-h="${h}" type="button">${I.share}Record card</button></div>
    ${c.sub ? `<p class="note" style="margin:-6px 0 0">Subscriptions pay for research access. They never change rankings or evidence.</p>` : ''}
    ${dimsHTML(c)}
    <div class="utabs" role="tablist">${[['record', 'Full record'], ['ideas', `Ideas<span class="ct">${ideas.length}</span>`], ['wins', 'Wins'], ['disc', 'Disclosures'], ['conduct', 'Conduct']].map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="trtab" data-h="${h}" data-k="${k}" data-full="${full ? 1 : ''}">${l}</button>`).join('')}</div>
    ${body}</div>`;
}
function openTrader(h, tab) { closeAll(); openSide(traderHTML(h, tab, false)); }
function vTrader(h) { return `<div class="stage-in"><button class="btn sm ghost" data-act="back" type="button" style="align-self:flex-start">${I.back}Back</button>${traderHTML(h, S.ui.trTab, true)}${footNote()}</div>`; }

// ---------- following ----------
function followEvents() {
  const out = [];
  for (const x of allIdeas()) { if (!S.follows.has(x.a)) continue; for (const e of x.ev) { if (e.t > Date.now()) continue; const map = { publish: 'entry', accumulate: 'entry', add: 'add', sell: 'partial', exit: 'exit', transfer: 'transfer', thesis: 'thesis', disclosure: 'disclosure', decision: 'decision', correction: 'decision', inferred: null, flag: null }; const ty = map[e.k]; if (!ty) continue; if (e.k === 'publish' && x.ev.some(z => z.k === 'accumulate')) continue; out.push({ ty, x, e }); } }
  return out.sort((a, b) => b.e.t - a.e.t);
}
const ET = { entry: ['New entry', 'up'], add: ['Added', 'plus'], partial: ['Partial exit', 'down'], exit: ['Exit', 'down'], transfer: ['Transfer, not a sale', 'transfer'], thesis: ['Thesis change', 'pen'], disclosure: ['Disclosure update', 'coin'], decision: ['Conduct decision', 'shield'] };
function vFollowing() {
  const tab = S.ui.fol; const evs = followEvents(); const types = { all: null, moves: ['entry', 'add', 'partial', 'exit'], transfers: ['transfer'], thesis: ['thesis', 'disclosure', 'decision'] };
  const list = types[tab] ? evs.filter(z => types[tab].includes(z.ty)) : evs;
  if (S.seenNotes !== S.notes.length) { S.seenNotes = S.notes.length; setTimeout(() => { renderTop(); renderTabbar(); }, 0); }
  return `<div class="stage-in"><div class="sec-h"><div class="col" style="gap:4px"><h1 class="h1">following</h1><span class="dim">${S.follows.size} traders · entries, adds, exits and thesis changes kept distinct</span></div><button class="btn sm" data-act="alerts" type="button">${I.bell}Alerts</button></div>
    <div class="toptr">${[...S.follows].filter(h => CR[h]).map(h => `<button class="tt" data-act="trader" data-h="${h}" type="button">${avRing(h, 36)}<span class="who"><b>${esc(CR[h].name)}</b><span>${STYLE[CR[h].style]}</span></span></button>`).join('')}<button class="tt" data-act="disc" data-k="leaders" type="button" style="color:var(--fg2)">${I.plus.replace('<svg', '<svg style="width:18px;height:18px"')}Find traders</button></div>
    <div class="seg">${[['all', 'All'], ['moves', 'Entries & exits'], ['transfers', 'Transfers'], ['thesis', 'Thesis & disclosures']].map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="fol" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="fl">${list.map(({ ty, x, e }) => { const [lab, icn] = ET[ty]; return `<a class="fe" href="#idea-${x.id}">${avRing(x.a, 40)}<div class="col" style="gap:4px;min-width:0"><div class="row wrap" style="gap:6px"><span class="etype et-${ty}">${I[icn]}${lab}</span><span class="dim" style="font-size:12px">${ago(e.t)}</span></div><div class="t"><b>${esc(CR[x.a].name)}</b> · ${esc(e.title)} · <b>$${x.sym}</b></div><div class="dim" style="font-size:12.5px">${esc(e.p)}</div></div>${logo(x.sym, 30, false)}</a>`; }).join('') || '<div class="empty"><b>Nothing yet</b>Follow traders to see their moves here.</div>'}</div>${footNote()}</div>`;
}
function openAlerts() {
  const al = S.profile.alerts || { entry: true, partial: true, exit: true, transfer: true, thesis: true, disclosure: true, decision: true };
  openModal(`<div class="mc-h"><h3>Alerts</h3><button class="xbtn" data-act="close" aria-label="Close">${I.x}</button></div><p class="note">Real-time alerts for what the people you follow do. Each type stays separate, so an exit never looks like an entry.</p>
    ${Object.entries(ET).map(([k, [l]]) => `<label class="row between panel"><span>${l}</span><span class="switch"><input type="checkbox" data-change="alert" data-k="${k}" ${al[k] !== false ? 'checked' : ''}><i></i></span></label>`).join('')}`);
}

// ---------- portfolio ----------
function vPortfolio() {
  if (S.guest) return `<div class="stage-in"><h1 class="h1">portfolio</h1><div class="empty" style="padding:40px 20px"><b>No account yet</b>Create one in a second, or link a wallet you already use, read-only.<div class="row" style="justify-content:center;margin-top:14px"><button class="btn pri" data-act="signup" type="button">Create account</button><button class="btn" data-act="linkwallet" type="button">Link a wallet</button></div></div>${footNote()}</div>`;
  const A = S.acct; const v = acctValue(), d = dayPnl(), nd = netDeposits(), perf = v - nd; const pos = positionsList(); const tab = S.ui.port; const [whole, cents] = fmtUsd(v).split('.');
  const pend = (A.funding || []).filter(f => f.status !== 'confirmed' && f.status !== 'failed');
  let body = '';
  if (tab === 'positions') body = pos.length ? `<div class="tscroll"><table class="t"><thead><tr><th>Token</th><th class="r">Amount</th><th class="r">Avg cost</th><th class="r">Marked value</th><th class="r">If sold now</th><th class="r">Return</th><th></th></tr></thead><tbody>${pos.map(p => `<tr class="click pos-row" data-act="token" data-sym="${p.sym}"><td><div class="row">${logo(p.sym, 30, false)}<div class="col"><b>${p.sym}</b><span class="why">${p.lots} lot${p.lots > 1 ? 's' : ''}${p.unknown ? ' · basis unknown' : ''}</span></div></div></td><td class="r">${fmtQty(p.qty)}</td><td class="r">${p.unknown ? `<span class="wn" title="Received from another wallet; original cost can't be established">Unknown</span>` : fmtPxH(p.avg)}</td><td class="r">${fmtUsd(p.value)}</td><td class="r"><span title="Estimated proceeds after impact and fees for this size">${fmtUsd(p.liq)}</span><div class="why">${(p.imp * 100).toFixed(2)}% impact</div></td><td class="r">${p.unknown ? `<span class="${cls(p.sinceRet)}">${fmtPct(p.sinceRet)}</span><div class="why">since receipt</div>` : `<span class="${cls(p.ret)}">${fmtPct(p.ret)}</span><div class="why">${fmtSignedUsd(p.pnl)}</div>`}</td><td class="r"><button class="btn xs" data-act="why" data-sym="${p.sym}" type="button">Why?</button></td></tr>`).join('')}</tbody></table></div>
    <p class="note">Marked value uses the last price. "If sold now" estimates proceeds for your full size after impact and fees. Tokens received from another wallet keep an unknown basis instead of an invented zero cost, and are left out of return rankings.</p>` : `<div class="empty"><b>No positions</b>Buy something and it shows up here with lots and costs.</div>`;
  else if (tab === 'receipts') body = A.receipts.length ? receiptList(A.receipts) : '<div class="empty"><b>No receipts yet</b></div>';
  else body = `<div class="tscroll"><table class="t"><thead><tr><th>When</th><th>Type</th><th>Method</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>${(A.funding || []).slice().reverse().map(f => `<tr><td class="dim">${dstamp(f.t)}</td><td>${f.kind === 'deposit' ? 'Deposit' : f.kind === 'withdraw' ? 'Withdrawal' : 'Transfer in'}</td><td>${esc(f.method)}</td><td class="r">${fmtUsd(f.usd)}</td><td>${f.status === 'confirmed' ? '<span class="chip ok">Confirmed</span>' : f.status === 'failed' ? '<span class="chip dn">Failed</span>' : `<span class="chip wn">${esc(f.stage || 'Pending')}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  return `<div class="stage-in">
    <section class="bal-hero"><div><div class="dim" style="font-size:12.5px">Account value · demo funds</div><div class="big num">${whole}<small>.${cents}</small></div><div class="row wrap" style="gap:10px;margin-top:4px"><span class="${cls(d)} num" style="font-weight:600">${fmtSignedUsd(d)} today</span><span class="dim">·</span><span class="${cls(perf)} num">${fmtSignedUsd(perf)} all time</span></div></div>
      <div class="row"><button class="btn pri lg" data-act="deposit" type="button">Deposit</button><button class="btn lg" data-act="withdraw" type="button">Withdraw</button></div></section>
    <div class="stats"><div class="stat"><span>Cash (USDC)</span><b>${fmtUsd(A.cash)}</b></div><div class="stat"><span>Positions</span><b>${fmtUsd(v - A.cash)}</b></div><div class="stat"><span>Net deposits</span><b>${fmtUsd(nd)}</b></div><div class="stat"><span>Performance</span><b class="${cls(perf)}">${fmtSignedUsd(perf)}</b></div><div class="stat"><span>Refundable deposits</span><b>${(A.rentSol || 0).toFixed(5)} SOL</b></div></div>
    <p class="note" style="margin-top:-12px">Performance is account value minus net deposits. Deposits and tokens transferred in are never counted as profit; transfers in are valued at the price when they arrived.</p>
    <div class="recon" id="recon"><span class="okdot"></span><span><b>Ledger matches chain.</b> <span class="dim">Checked ${ago(A.reconAt || Date.now())} · ${A.receipts.length} receipts · 0 discrepancies</span></span><span class="grow"></span><button class="btn xs" data-act="recon" type="button">${I.refresh}Check now</button></div>
    ${pend.map(f => `<div class="pend">${I.clock.replace('<svg', '<svg style="width:16px;height:16px;color:var(--warn)"')}<span class="grow"><b>${f.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} ${fmtUsd(f.usd)}</b> · ${esc(f.stage)}<div class="prog" style="margin-top:6px"><i style="width:${Math.round((f.p || 0) * 100)}%"></i></div></span><span class="dim">Not spendable yet</span></div>`).join('')}
    <div class="seg">${[['positions', 'Positions'], ['receipts', `Receipts (${A.receipts.length})`], ['funding', 'Funding']].map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="port" data-k="${k}">${l}</button>`).join('')}</div>
    ${body}
    <section class="card col" style="gap:10px"><div class="row between wrap"><b>${I.spark.replace('<svg', '<svg style="width:16px;height:16px;color:var(--lime);vertical-align:-3px"')} Portfolio assistant</b><div class="bounds"><span class="chip">Read-only</span><span class="chip">Can't place orders</span></div></div><p class="note" style="margin:0">Explains your exposures, costs and limits from your own ledger.</p><div class="row wrap"><button class="btn sm" data-act="ask" data-role="portfolio" type="button">Explain my portfolio</button><a class="btn sm ghost" href="#policy">Execution policy</a></div></section>
    ${footNote()}</div>`;
}
function receiptList(rs) {
  return `<div class="tscroll"><table class="t"><thead><tr><th>When</th><th>Order</th><th class="r">Paid / received</th><th class="r">Confirm time</th><th>Outcome</th></tr></thead><tbody>${rs.slice().sort((a, b) => b.t - a.t).map(r => `<tr class="click" data-act="receipt" data-id="${r.id}"><td class="dim">${dstamp(r.t)}</td><td><div class="row">${logo(r.sym, 24, false)}<b>${r.side === 'buy' ? 'Buy' : 'Sell'} ${r.sym}</b><span class="mono dim">${r.id}</span></div></td><td class="r">${r.side === 'buy' ? fmtUsd(r.usd) + ' → ' + (r.outQty ? fmtQty(r.outQty) : '—') : fmtQty(r.inQty) + ' → ' + (r.outUsd ? fmtUsd(r.outUsd) : '—')}</td><td class="r">${r.confirmMs ? dur(r.confirmMs) : '—'}</td><td>${outcomeChip(r)}</td></tr>`).join('')}</tbody></table></div>`;
}
function outcomeChip(r) { return r.outcome === 'confirmed' ? `<span class="chip ok">Confirmed${r.finalized ? ' · final' : ''}</span>` : r.outcome === 'failed' ? '<span class="chip dn">Failed</span>' : r.outcome === 'expired' ? '<span class="chip wn">Expired · no funds moved</span>' : '<span class="chip wn">Pending reconciliation</span>'; }

// ---------- research ----------
function vResearch() {
  const tab = S.ui.research; let body = '';
  if (tab === 'paper') {
    const list = S.paper; const rs = list.map(p => paperState(p));
    const med = rs.length ? rs.map(r => r.ret).sort((a, b) => a - b)[Math.floor(rs.length / 2)] : null;
    body = `<div class="stats"><div class="stat"><span>Tracked ideas</span><b>${list.length}</b></div><div class="stat"><span>Closed by rule</span><b>${rs.filter(r => r.closed).length}</b></div><div class="stat"><span>Median result</span><b class="${cls(med)}">${med == null ? '—' : fmtPct(med)}</b></div><div class="stat"><span>Failed quotes kept</span><b>${list.reduce((s, p) => s + p.q.filter(q => !q.ok).length, 0)}</b></div></div>
      <p class="note">Each tracked idea keeps the time you added it and rules frozen at that moment. Quotes are collected for the fixed size, and failed or unavailable quotes stay in the log instead of being skipped. This prototype collects a quote every 15 s while the page is open; production does it every 15 min, around the clock. Three example ideas start out tracked so you can see how it works.</p>
      ${list.length ? list.map((p, i) => paperCard(p, rs[i])).join('') : '<div class="empty"><b>Nothing tracked yet</b>Tap "Track forward" on any idea.</div>'}`;
  } else if (tab === 'saved') {
    const ideas = [...S.saved].map(getIdea).filter(Boolean);
    body = ideas.length ? `<div class="feed">${ideas.map(x => ideaCard(x)).join('')}</div>` : '<div class="empty"><b>No saved theses</b>Use the bookmark on an idea to keep it here.</div>';
  } else body = compareHTML();
  return `<div class="stage-in"><div class="sec-h"><div class="col" style="gap:4px"><h1 class="h1">research</h1><span class="dim">Forward paper tracking, saved theses and side-by-side records</span></div><button class="btn sm" data-act="ask" data-role="research" type="button">${I.spark}Research assistant</button></div>
    <div class="seg">${[['paper', 'Paper portfolio'], ['saved', 'Saved theses'], ['compare', 'Compare traders']].map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="research" data-k="${k}">${l}</button>`).join('')}</div>${body}${footNote()}</div>`;
}
function paperCard(p, r) {
  const x = getIdea(p.ideaId); const c = x && CR[x.a];
  return `<div class="card col" style="gap:10px"><div class="row between wrap"><div class="row">${logo(p.sym, 32, false)}<div class="col" style="line-height:1.25"><b>$${p.sym} · ${c ? esc(c.name) : 'idea'}</b><span class="dim" style="font-size:12px">Added ${dstamp(p.added)} · rules frozen</span></div></div><div class="col" style="align-items:flex-end"><b class="${cls(r.ret)} num" style="font-size:20px">${r.entry ? fmtPct(r.ret) : 'Waiting'}</b><span class="dim" style="font-size:11.5px">${r.closed ? esc(r.why) : r.entry ? 'open · if sold now ' + fmtPct(r.liq) : 'entry pending'}</span></div></div>
    <div class="row wrap" style="gap:6px"><span class="chip">Entry ${p.rules.delay} s after adding</span><span class="chip">${fmtUsd(p.rules.notional, 0)} fixed</span><span class="chip">Exit ${p.rules.days} d or ${fmtPct(p.rules.stop * 100, 0)}</span>${r.entry ? `<span class="chip">Entry ${fmtPxH(r.entry)}</span>` : ''}</div>
    <details><summary class="dim" style="cursor:pointer;font-size:12.5px">Quote log (${p.q.length})</summary><div class="tscroll" style="margin-top:8px;max-height:220px;overflow-y:auto"><table class="t"><tbody>${p.q.slice().reverse().slice(0, 40).map(q => `<tr><td class="dim mono">${clock(q.t)}</td><td>${q.ok ? fmtPxH(q.px) : `<span class="wn">${esc(q.err)}</span>`}</td><td class="r">${q.ok ? (q.imp * 100).toFixed(2) + '% impact' : 'kept in log'}</td></tr>`).join('')}</tbody></table></div></details>
    <div class="row"><a class="btn xs" href="#idea-${p.ideaId}">Open idea</a><button class="btn xs ghost" data-act="untrack" data-id="${p.id}" type="button">Stop tracking</button></div></div>`;
}
function compareHTML() {
  const sel = S.ui.compare.filter(h => CR[h]); const cs = sel.map(h => CR[h]);
  const rows = [['Style', c => STYLE[c.style]], ['Eligible sample', c => `${c.rec.calls} ${c.rec.unit || 'calls'} · ${c.rec.days} d`], ['Record', c => `${c.rec.w}W ${c.rec.l}L ${c.rec.o} open`], ['Author return', c => `<span class="${cls(c.rec.author)}">${fmtPct(c.rec.author)}</span>`], ['Paper, 30 s / $250', c => `<span class="${cls(c.rec.paper30)}">${fmtPct(c.rec.paper30)}</span>`], ['Paper, 2 min / $1K', c => `<span class="${cls(c.rec.paper2m)}">${fmtPct(c.rec.paper2m)}</span>`], ['Unavailable quotes', c => `${c.rec.unavail} of ${c.rec.calls}`], ['Max drawdown', c => `<span class="dn">${fmtPct(c.rec.dd)}</span>`], ['Signed wallets', c => c.wallets], ['FOMA payments', c => c.disc.foma.reduce((s, f) => s + f.amt, 0) ? fmtUsd(c.disc.foma.reduce((s, f) => s + f.amt, 0), 0) : 'None'], ['External pay', c => c.disc.ext.state === 'late' ? '<span class="wn">Late disclosure</span>' : 'Attested none'], ['Conduct', c => c.conduct.length ? c.conduct.map(d => d.id).join(', ') : 'None'], ['Ranking', c => rankStatus(c).ok ? 'Ranked' : 'Unranked']];
  return `<div class="row wrap" style="gap:6px">${CREATORS.map(c => `<button type="button" class="pill flt ${sel.includes(c.h) ? 'on' : ''}" data-act="cmp" data-h="${c.h}">${esc(c.name)}</button>`).join('')}</div><p class="note">Pick up to three. Same window, same rules, no overall score.</p>
    <div class="tscroll"><table class="t"><thead><tr><th></th>${cs.map(c => `<th><div class="row">${av(c.h, 22)}${esc(c.name)}</div></th>`).join('')}</tr></thead><tbody>${rows.map(([l, f]) => `<tr><td class="dim">${l}</td>${cs.map(c => `<td>${f(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ---------- profile ----------
function vProfile() {
  if (S.guest) return `<div class="stage-in"><h1 class="h1">profile</h1>
    <section class="card col" style="gap:14px"><div class="h2">You're browsing</div><p class="lede">Everything public on FOMA is readable without an account. Create one when you want to trade or post, or link a wallet you already use without moving any funds.</p>
      <div class="row wrap"><button class="btn pri" data-act="signup" type="button">Create account</button><button class="btn" data-act="linkwallet" type="button">${I.link}Link a wallet read-only</button></div>
      <p class="note">FOMA never asks for a seed phrase. Anyone who does is trying to steal your funds.</p></section>
    ${moreLinks()}${footNote()}</div>`;
  const ws = S.profile.wallets || [];
  return `<div class="stage-in">
    <div class="row" style="gap:14px">${myAv(64)}<div class="col" style="gap:4px"><div class="row"><b style="font-size:22px;letter-spacing:-.03em">${esc(myHandle())}</b><button class="btn xs ghost" data-act="rename" type="button">${I.pen}Edit</button></div><span class="dim">Demo account · ${S.sync === 'account' ? 'synced to your account' : 'saved on this device'}</span></div></div>
    <div class="dims"><div class="dimc"><h4>Wallet control</h4><div class="v">${1 + ws.filter(w => w.signed).length} signed</div><p>Your FOMA wallet ${short(S.acct.wallet)} is signed by design.${ws.length ? ` ${ws.length} linked read-only.` : ''}</p></div><div class="dimc"><h4>Performance</h4><div class="v">Building</div><p>${S.myIdeas.length} of ${MIN_SAMPLE.calls} calls posted. Unranked until the minimum.</p></div><div class="dimc"><h4>Disclosure</h4><div class="v">${S.profile.attested ? 'Attested' : 'Not attested'}</div><p>${S.profile.attested ? 'No outside payments, attested ' + dstamp(S.profile.attested, false) : 'Add an attestation before posting paid content.'}</p></div><div class="dimc"><h4>Conduct</h4><div class="v">Nothing on record</div><p>Decisions would appear here with evidence and an appeal route.</p></div></div>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Wallets</h2><button class="btn sm" data-act="linkwallet" type="button">${I.link}Link a wallet</button></div>
      <div class="tscroll"><table class="t"><thead><tr><th>Address</th><th>Link</th><th>Public on profile</th><th>Counts toward record</th></tr></thead><tbody><tr><td class="mono">${short(S.acct.wallet)}</td><td><span class="chip ok">FOMA wallet · signed</span></td><td><span class="switch"><input type="checkbox" checked disabled aria-label="FOMA wallet public"><i></i></span></td><td><span class="switch"><input type="checkbox" checked disabled aria-label="FOMA wallet counts"><i></i></span></td></tr>
      ${ws.map((w, i) => `<tr><td class="mono">${short(w.addr)}</td><td>${w.signed ? `<span class="chip ok">Signed ${dstamp(w.signed, false)}</span>` : `<span class="chip">Read-only</span> <button class="btn xs" data-act="prove" data-i="${i}" type="button">Prove ownership</button>`}</td><td><span class="switch"><input type="checkbox" data-change="wpub" data-i="${i}" ${w.pub ? 'checked' : ''} aria-label="Show on public profile"><i></i></span></td><td><span class="switch"><input type="checkbox" data-change="wrec" data-i="${i}" ${w.rec ? 'checked' : ''} ${w.signed ? '' : 'disabled'} aria-label="Count toward record"><i></i></span></td></tr>`).join('')}</tbody></table></div>
      <p class="note">You choose which addresses are publicly associated with you. Only signed wallets can count toward your record.</p></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Post an idea</h2></div>${composerHTML()}</section>
    ${S.myIdeas.length ? `<section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Your ideas</h2></div><div class="feed">${S.myIdeas.map(m => ideaCard(prepMine(m))).join('')}</div></section>` : ''}
    <section class="card col" style="gap:10px"><div class="h3">Creator tools</div><p class="note" style="margin:0">Earn from research subscriptions, tips and labeled fixed-fee partnerships. Payments never touch your ranking. FOMA doesn't pay creators a cut of follower volume.</p><div class="row wrap"><button class="btn sm" data-act="card" data-h="me" type="button">${I.share}My record card</button><button class="btn sm ghost" data-act="attest" type="button">${S.profile.attested ? 'Update attestation' : 'Attest: no outside payments'}</button></div></section>
    ${moreLinks()}${footNote()}</div>`;
}
const DOCS_URL = 'https://claude.ai/artifact/1vCpDxYFkBoiWMJbiGAfBc';
function moreLinks() { return `<section class="grid2"><a class="card col" href="#policy" style="gap:6px">${I.sliders.replace('<svg', '<svg style="width:20px;height:20px;color:var(--lime)"')}<b>Execution policy</b><span class="dim" style="font-size:12.5px">Your limits on size, slippage, impact and fees, applied on every buy button.</span></a><a class="card col" href="#transparency" style="gap:6px">${I.eye.replace('<svg', '<svg style="width:20px;height:20px;color:var(--lime)"')}<b>Transparency</b><span class="dim" style="font-size:12.5px">How FOMA makes money, who it pays, how enforcement works.</span></a><button class="card col" data-act="sources" type="button" style="gap:6px;text-align:left">${I.clock.replace('<svg', '<svg style="width:20px;height:20px;color:var(--lime)"')}<b>Data sources</b><span class="dim" style="font-size:12.5px">What's real, what's simulated, and how fresh it is.</span></button><a class="card col" href="${DOCS_URL}" target="_blank" rel="noopener" style="gap:6px">${I.doc.replace('<svg', '<svg style="width:20px;height:20px;color:var(--lime)"')}<b>Docs ${I.ext.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-1px"')}</b><span class="dim" style="font-size:12.5px">How everything works, with live explainers for orders, receipts and fees.</span></a></section>`; }
function composerHTML() {
  const opts = TOKS.filter(isMeme).map(t => `<option value="${t.sym}">${t.sym} · ${esc(t.name)}</option>`).join('');
  return `<form class="card col" style="gap:12px" id="composer" data-submit="publish"><div class="grid2"><div class="field"><label for="cSym">Token</label><select class="input" id="cSym" name="sym">${opts}</select></div><div class="field"><label for="cComp">Compensation for this post</label><select class="input" id="cComp" name="comp"><option value="none">None</option><option value="ext">Paid by a project (I'll state it)</option></select></div></div>
    <div class="field hide" id="cExtRow"><label for="cExt">Who paid, and how much</label><input class="input" id="cExt" name="ext" placeholder="e.g. Kiln Club, $500 USDC"></div>
    <div class="field"><label for="cThesis">Thesis</label><textarea class="input" id="cThesis" name="thesis" required minlength="12" placeholder="What you think, why, and what would make you wrong."></textarea></div>
    <p class="note" style="margin:0">When you post, FOMA captures your signed-wallet holdings of this token and your disclosures at that moment, with a timestamp hash. Edits create a new version; the original stays visible.</p>
    <div class="row"><button class="btn pri" type="submit">Post with receipts</button></div></form>`;
}

// ---------- transparency ----------
function vTransparency() {
  const sess = S.session.orders; const sc = sess.filter(o => o.confirmMs).map(o => o.confirmMs).sort((a, b) => a - b); const q = p => sc.length ? sc[Math.min(sc.length - 1, Math.floor(p * sc.length))] : null;
  const fees = [10, 50, 200, 1000].map(u => { const qs = quoteFor('BONK', 'buy', u); const qm = quoteFor('MOTH', 'buy', u); return `<tr><td>${fmtUsd(u, 0)}</td><td class="r">${fmtUsd(qs.feeUsd)}</td><td class="r">${fmtUsd(qs.netAndDep)}</td><td class="r">${fmtUsd(qs.outQty * qs.px)}</td><td class="r">${fmtUsd(qm.outQty * qm.px)}</td></tr>`; }).join('');
  return `<div class="stage-in"><div class="col" style="gap:6px"><h1 class="h1">transparency</h1><p class="lede">FOMA has incentives too. This page shows who we pay, who pays us, how rankings work, how rules are enforced, and how well orders execute. Network figures here are illustrative prototype values; "your session" figures are measured from this prototype's simulated orders.</p></div>
    <section class="card col" style="gap:10px"><div class="h2">How FOMA makes money</div><p class="lede" style="font-size:13.5px">A clear execution fee on each trade (shown on every ticket and receipt), premium research tools, and later, licensed access to evidence data. Because we earn per trade, we have a volume incentive. What we do about it: rankings ignore volume, creators are never paid a cut of follower trading, and execution quality is published below.</p>
      <div class="tscroll"><table class="t"><thead><tr><th>Order size</th><th class="r">Platform fee (0.40%)</th><th class="r">Network + deposit</th><th class="r">Net received, BONK</th><th class="r">Net received, MOTH</th></tr></thead><tbody>${fees}</tbody></table></div>
      <p class="note">Net received is the market value of what you get after every cost, at current quotes. The 0.40% is a placeholder; the final fee is set after benchmarking real route costs. Comparisons with other apps need a controlled, permissioned test, so we don't publish any yet.</p></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Payments FOMA made to creators</h2></div><div class="tscroll"><table class="t"><thead><tr><th>Date</th><th>Creator</th><th>Purpose</th><th class="r">Amount</th><th>Terms</th></tr></thead><tbody>${CAMPAIGNS.map(c => `<tr><td class="dim">${c.at}</td><td><button class="row" data-act="trader" data-h="${c.who}" type="button" style="gap:8px">${av(c.who, 22)}<b>${esc(CR[c.who].name)}</b></button></td><td>${esc(c.label)}</td><td class="r">${c.amt ? fmtUsd(c.amt, 0) : 'Declined'}</td><td style="white-space:normal;min-width:220px" class="dim">${esc(c.terms)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Paid placements</h2></div><div class="tscroll"><table class="t"><thead><tr><th>Dates</th><th>Paid by</th><th>Where</th><th class="r">Amount</th></tr></thead><tbody>${SPONSORED.map(s => `<tr><td>${s.dates}</td><td>${esc(s.payer)} (${tokchip(s.sym)})</td><td>${esc(s.where)}</td><td class="r">${fmtUsd(s.amt, 0)}</td></tr>`).join('')}</tbody></table></div><p class="note">Sponsors buy labeled space. They can't buy rankings, badges, search order or evidence changes. FOMA never sells a "safe" badge.</p></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Ranking methodology</h2><span class="chip">v${METHOD[0].v}</span></div><div class="card col" style="gap:0">${METHOD.map((m, i) => `<div class="rstep ${i === 0 ? 'now' : 'done'}"><span class="ic">${i === 0 ? I.dot : I.check}</span><span><b>v${m.v}</b><small>${esc(m.ch)}</small></span><span class="t">${m.at}</span></div>`).join('')}</div></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Enforcement, last 30 days</h2></div>
      <div class="stats"><div class="stat"><span>Reports received</span><b>${ENFORCE.flags}</b></div><div class="stat"><span>Reviewed by a human</span><b>${ENFORCE.reviewed}</b></div><div class="stat"><span>Actions taken</span><b>${ENFORCE.actions}</b></div><div class="stat"><span>Appeals</span><b>${ENFORCE.appeals} · ${ENFORCE.reversed} reversed</b></div><div class="stat"><span>Wallet links reversed</span><b>${ENFORCE.linkReversals}</b></div><div class="stat"><span>Time to review</span><b>${ENFORCE.medianH} h median</b></div></div>
      <div class="card col" style="gap:0">${[['Flag', 'Evidence, the alleged rule, affected content and source times are attached. Automated detection is a lead, never a verdict.'], ['Review', 'A human reviews anything consequential and invites the creator to explain or add contrary evidence.'], ['Provisional restriction', 'When justified: a time-limited distribution limit or a pause on promotional rewards. Self-custodied funds are never frozen.'], ['Decision', 'States the rule, the findings, what remains uncertain, the action and the appeal deadline, without exposing unrelated private information.'], ['Correction', 'Privileges are restored when warranted and the correction stays visible.']].map(([t, p], i) => `<div class="rstep done"><span class="ic">${i + 1}</span><span><b>${t}</b><small>${p}</small></span><span></span></div>`).join('')}</div>
      <p class="note">Actions: ${ENFORCE.warnings} warnings, ${ENFORCE.pauses} reward pauses, ${ENFORCE.limits} distribution limits, ${ENFORCE.removals} removal. Business partners follow the same rules as everyone else.</p></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Execution quality</h2></div>
      <div class="stats"><div class="stat"><span>Quote success</span><b>${EXECQ.quoteOk}%</b></div><div class="stat"><span>Submit to confirm p50</span><b>${EXECQ.p50} s</b></div><div class="stat"><span>Submit to confirm p95</span><b>${EXECQ.p95} s</b></div><div class="stat"><span>Price display p50 / p95</span><b>${EXECQ.disp50} / ${EXECQ.disp95} ms</b></div><div class="stat"><span>Stale-data rate</span><b>${EXECQ.stale}%</b></div><div class="stat"><span>Duplicate orders prevented</span><b>${EXECQ.dupPrevented}</b></div></div>
      <div class="card col" style="gap:10px"><b style="font-size:13px">Why orders failed</b><div class="bars">${EXECQ.reasons.map(([l, v]) => `<div class="b"><span class="muted">${l}</span><span class="tr"><i style="width:${v / 46 * 100}%"></i></span><span class="num r">${v}%</span></div>`).join('')}</div></div>
      <div class="panel row wrap between"><span><b>Your session</b> <span class="dim">· measured in this prototype</span></span><span class="num">${sess.length} orders · ${sess.filter(o => o.outcome === 'confirmed').length} confirmed · p50 ${q(.5) ? dur(q(.5)) : '—'} · p95 ${q(.95) ? dur(q(.95)) : '—'}</span></div>
      <p class="note">Faster screen updates and faster chain confirmation are different measurements, so they're reported separately.</p></section>
    <section class="col" style="gap:10px"><div class="sec-h"><h2 class="h2">Incidents</h2></div>${INCIDENTS.map(x => `<div class="card col" style="gap:4px"><div class="row between wrap"><b>${esc(x.t)}</b><span class="dim" style="font-size:12px">${x.at}</span></div><p class="lede" style="font-size:13px">${esc(x.p)}</p></div>`).join('')}</section>
    ${footNote()}</div>`;
}

// ---------- policy ----------
function vPolicy() {
  const p = S.policy; const f = (k, l, unit, step, min, max, hint) => `<div class="field"><label for="pol-${k}">${l}</label><div class="row"><input class="input num" id="pol-${k}" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${p[k]}" data-change="policy" data-k="${k}" style="max-width:140px"><span class="dim">${unit}</span></div><span class="note">${hint}</span></div>`;
  return `<div class="stage-in"><div class="col" style="gap:6px"><h1 class="h1">execution policy</h1><p class="lede">One set of limits for every place you can buy: token pages, feed buttons, idea pages, phone and desktop. Each ticket shows these limits and blocks orders that break them, unless you deliberately override that one order.</p></div>
    <div class="panel row between wrap"><span>${S.sync === 'account' ? `<b class="up">Synced to your account.</b> Change it here and every open device updates.` : `<b>Saved on this device.</b> Open FOMA signed in to sync it across devices.`}</span><span class="chip">${I.clock}v${p.v}</span></div>
    <section class="card grid2">${f('defSize', 'Default order size', 'USD', 10, 1, 100000, 'Pre-filled on every buy button.')}${f('maxSize', 'Maximum order size', 'USD', 50, 1, 1000000, 'Orders above this are blocked.')}${f('slip', 'Maximum slippage', '%', 0.1, 0.1, 50, 'Sets the minimum you will accept. Above it, the transaction fails instead of filling.')}${f('impact', 'Maximum price impact', '%', 0.1, 0.1, 50, 'Your own order moving the price. Thin pools hit this first.')}${f('maxFee', 'Maximum total fees', 'USD', 0.5, 0.1, 1000, 'Platform + network + token tax. Refundable deposits excluded.')}${f('ttl', 'Quote freshness', 'seconds', 1, 5, 60, 'Quotes older than this are never signed; they refresh first.')}${f('confirmAbove', 'Hold to confirm above', 'USD', 50, 0, 1000000, 'Larger orders need a deliberate press-and-hold.')}
      <div class="field"><label>Per-order override</label><label class="row panel" style="justify-content:space-between"><span>Allow hold-to-override on a single order</span><span class="switch"><input type="checkbox" data-change="policy" data-k="allowOverride" ${p.allowOverride ? 'checked' : ''}><i></i></span></label><span class="note">Overrides are written on the receipt.</span></div></section>
    <section class="card col" style="gap:12px"><div class="h3">Prototype controls</div><p class="note" style="margin:0">Try the honest failure paths. These change the simulated network, not your policy.</p>
      <div class="seg">${[['normal', 'Normal'], ['congested', 'Congested'], ['volatile', 'Volatile'], ['outage', 'Route outage']].map(([k, l]) => `<button type="button" class="${S.net === k ? 'on' : ''}" data-act="net" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="row panel between"><span>Reduce motion</span><span class="switch"><input type="checkbox" data-change="rm" ${S.rm ? 'checked' : ''}><i></i></span></label>
      <div class="row"><button class="btn sm ghost" data-act="reset" type="button">Reset demo data</button></div></section>${footNote()}</div>`;
}
function vCase() {
  const x = IDX['moth-kestrel'];
  return `<div class="stage-in"><button class="btn sm ghost" data-act="back" type="button" style="align-self:flex-start">${I.back}Back</button><div class="col" style="gap:6px"><span class="tag">Case C-1042</span><h1 class="h1">undisclosed pay at publication</h1><p class="lede">About <a href="#idea-moth-kestrel" style="text-decoration:underline">kestrel.sol's MOTH idea</a>. Opened from 23 community reports.</p></div>
    ${caseHTML(x)}<section class="card col" style="gap:8px"><div class="h3">Evidence considered</div>${x.ev.filter(e => ['E2', 'E5', 'E6', 'E3', 'E4'].includes(e.id)).map(e => `<div class="row" style="gap:8px;align-items:flex-start"><span class="cite">[${e.id}]</span><span style="font-size:13px"><b>${esc(e.title)}</b> <span class="chip ${CONF[e.conf][0]}">${CONF[e.conf][1]}</span><br><span class="dim">${esc(e.p)}</span></span></div>`).join('')}</section>
    <section class="card col" style="gap:8px"><div class="h3">What the evidence can't establish</div><ul class="lede" style="margin:0;padding-left:18px;font-size:13px"><li>Who controls 7xQr…pR4w. The link stays "inferred" and was not used.</li><li>Whether other wallets exist. Signed control can't prove a negative.</li><li>Any off-chain agreements beyond what was disclosed.</li></ul></section>${footNote()}</div>`;
}
function notFound() { return `<div class="stage-in"><div class="empty" style="padding:40px"><b>That page doesn't exist</b><a class="btn sm" href="#discover" style="margin-top:12px">Go to Discover</a></div></div>`; }
