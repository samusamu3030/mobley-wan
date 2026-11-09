// Site generator. Run in a browser tab at https://lm-api-reads.fantasy.espn.com/... (signed in to ESPN).
// It pulls the league from ESPN, builds data for every team and the league tables, then opens
// http://localhost:8765/receive.html#<data> so the local preview server saves the files into .\data.
// Usage (in the tab's console or via the browser tool): paste this file, then await window.GEN({updated:'...'}).
window.GEN = async function (opts = {}) {
  const LEAGUE = 1945215376, SEASON = 2027;
  const B = `/apis/v3/games/fba/seasons/${SEASON}/segments/0/leagues/${LEAGUE}`;
  const F = (u, h) => fetch(u, { credentials: 'include', headers: h || {} }).then((r) => { if (r.status !== 200) throw new Error('HTTP ' + r.status + ' ' + u); return r.json(); });
  const WEEK = opts.week || 4;                       // current matchup week shown on the site
  const WEEKS = opts.weeks || { 4: [21, 27], 5: [28, 34], 6: [35, 41], 7: [42, 48], 8: [49, 55] };
  const DATES = opts.dates || { 4: 'Nov 9–15', 5: 'Nov 16–22', 6: 'Nov 23–29', 7: 'Nov 30–Dec 6', 8: 'Dec 7–13' };
  const DAYS = opts.days || ['Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11', 'Thu Nov 12', 'Fri Nov 13', 'Sat Nov 14', 'Sun Nov 15'];
  const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const LOCK = ['Tue ~8 AM', 'Wed ~8 AM', 'Thu ~8 AM', 'Fri ~8 AM', 'Sat ~8 AM', 'Sun, first tip', 'Mon, first tip'];
  const CAT = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'TO', 'FG%', 'FT%'];
  const SID = { PTS: 0, REB: 6, AST: 3, STL: 2, BLK: 1, '3PM': 17, TO: 11 };

  // ---- data
  const sch = await F(`/apis/v3/games/fba/seasons/${SEASON}?view=proTeamSchedules_wl`);
  const g = {}, abbr = {};
  for (const t of sch.settings.proTeams) { abbr[t.id] = t.abbrev; g[t.id] = {}; for (const [sp, arr] of Object.entries(t.proGamesByScoringPeriod || {})) g[t.id][sp] = arr.length; }
  const d = await F(B + `?view=mRoster&view=mTeam&view=mMatchup&view=mMatchupScore&scoringPeriodId=${WEEKS[WEEK][0]}`);
  const fa = (await F(B + '?view=kona_player_info', { 'x-fantasy-filter': JSON.stringify({ players: { filterStatus: { value: ['FREEAGENT', 'WAIVERS'] }, limit: 400, sortPercOwned: { sortPriority: 1, sortAsc: false } } }) })).players;
  const all = await F(`/apis/v3/games/fba/seasons/${SEASON}/players?view=players_wl`, { 'x-fantasy-filter': JSON.stringify({ filterActive: { value: true } }) });
  const pname = Object.fromEntries(all.map((p) => [p.id, p.fullName]));
  const names = Object.fromEntries(d.teams.map((t) => [t.id, t.name.replace(/\s+/g, ' ').trim()]));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const rec = (id) => { const r = d.teams.find((t) => t.id == id).record.overall; return r.wins + '-' + r.losses + '-' + r.ties; };

  // ---- league tables from matchup totals so far
  const tot = {}, catRec = {};
  for (const m of d.schedule.filter((m) => m.matchupPeriodId <= WEEK - 1)) for (const s of [m.home, m.away]) {
    if (!s || !s.cumulativeScore) continue;
    const c = catRec[s.teamId] ??= { w: 0, l: 0, t: 0 }; c.w += s.cumulativeScore.wins || 0; c.l += s.cumulativeScore.losses || 0; c.t += s.cumulativeScore.ties || 0;
    const sb = s.cumulativeScore.scoreByStat; if (!sb) continue;
    const t = tot[s.teamId] ??= {}; for (const k of [0, 6, 3, 2, 1, 17, 11, 13, 14, 15, 16]) t[k] = (t[k] || 0) + (sb[k]?.score || 0);
  }
  const statRows = d.teams.map((t) => { const x = tot[t.id] || {}; return { id: t.id, team: names[t.id], PTS: x[0] || 0, REB: x[6] || 0, AST: x[3] || 0, STL: x[2] || 0, BLK: x[1] || 0, '3PM': x[17] || 0, TO: x[11] || 0, 'FG%': x[14] ? x[13] / x[14] : 0, 'FT%': x[16] ? x[15] / x[16] : 0 }; });
  const RANKS = {};
  for (const r of statRows) RANKS[r.team] = [];
  CAT.forEach((c, i) => { const s = [...statRows].sort((a, b) => c === 'TO' ? a[c] - b[c] : b[c] - a[c]); s.forEach((r, j) => { RANKS[r.team][i] = j + 1; }); });
  const avgRank = (t) => RANKS[t].reduce((a, b) => a + b, 0);
  const byRank = [...statRows].sort((a, b) => avgRank(a.team) - avgRank(b.team));
  const ranks = byRank.map((r, i) => { const o = { team: r.team, order: i + 1 }; CAT.forEach((c, j) => { o[c] = RANKS[r.team][j]; }); return o; });
  const teamstats = byRank.map((r, i) => { const o = { team: r.team, order: i + 1 }; CAT.forEach((c) => { o[c] = c.endsWith('%') ? +r[c].toFixed(3) : r[c]; }); return o; });
  const standings = d.teams.map((t) => { const c = catRec[t.id] || { w: 0, l: 0, t: 0 }; const o = t.record.overall; return { team: names[t.id], W: o.wins, T: o.ties, record: rec(t.id), cats: `${c.w}-${c.l}-${c.t}`, cw: c.w, cl: c.l, cat_pct: Math.round(100 * c.w / ((c.w + c.l) || 1)), adds: Object.values(t.transactionCounter?.matchupAcquisitionTotals || {}).reduce((a, b) => a + b, 0), trades: t.transactionCounter?.trades || 0 }; })
    .sort((a, b) => (b.W + b.T / 2) - (a.W + a.T / 2) || (b.cw - b.cl) - (a.cw - a.cl)).map((r, i) => ({ order: i + 1, team: r.team, record: r.record, cats: r.cats, cat_pct: r.cat_pct, adds: r.adds, trades: r.trades }));
  const txs = []; const seenTx = new Set();
  for (let sp = WEEKS[WEEK][0] - 4; sp <= WEEKS[WEEK][0]; sp++) {
    const t = await F(B + '?view=mTransactions2&scoringPeriodId=' + sp);
    for (const x of t.transactions || []) if (!seenTx.has(x.id) && x.status === 'EXECUTED' && ['FREEAGENT', 'WAIVER', 'TRADE_ACCEPT', 'ROSTER'].includes(x.type) && x.items.some((i) => ['ADD', 'DROP', 'TRADE'].includes(i.type))) { seenTx.add(x.id); txs.push(x); }
  }
  const pn = (i) => pname[i.playerId] || String(i.playerId);
  const txns = txs.sort((a, b) => b.proposedDate - a.proposedDate).slice(0, 25).map((x, i) => ({ order: i + 1, when: new Date(x.proposedDate + 8 * 3600e3).toISOString().slice(5, 16).replace('T', ' ').replace(/^(\d\d)-(\d\d)/, '$2/$1'), team: names[x.teamId], type: x.type === 'WAIVER' ? 'Waiver claim' : x.type === 'FREEAGENT' ? 'Free agent' : x.type === 'ROSTER' ? 'Drop' : 'Trade', added: x.items.filter((i) => i.type === 'ADD' || (i.type === 'TRADE' && i.toTeamId === x.teamId)).map(pn).join(', '), dropped: x.items.filter((i) => i.type === 'DROP' || (i.type === 'TRADE' && i.fromTeamId === x.teamId)).map(pn).join(', ') }));

  // ---- player math
  const W = { PTS: (a) => (a[0] - 12) / 6, REB: (a) => (a[6] - 4.5) / 2.8, AST: (a) => (a[3] - 2.7) / 2, STL: (a) => (a[2] - 0.9) / 0.45, BLK: (a) => ((a[1] || 0) - 0.5) / 0.55, '3PM': (a) => ((a[17] || 0) - 1.5), TO: (a) => -((a[11] || 0) - 1.5) / 1.2, 'FG%': (a) => ((a[13] || 0) - 0.47 * (a[14] || 0)) / 1.3, 'FT%': (a) => ((a[15] || 0) - 0.78 * (a[16] || 0)) / 0.9 };
  const val = (a, punts) => CAT.filter((c) => !punts.includes(c)).reduce((s, c) => s + W[c](a), 0);
  const puntsOf = (team) => CAT.map((c, i) => [c, RANKS[team][i]]).filter((x) => x[1] >= 10).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  const K = [0, 6, 3, 2, 1, 17, 11, 13, 14, 15, 16, 40];
  const split = (p, id) => { const s = (p.stats || []).find((s) => s.id == id); return s ? { a: s.averageStats || {}, gp: s.stats?.[42] || 0 } : null; };
  const line = (p) => { const se = split(p, '00' + SEASON); const pr = (p.stats || []).find((s) => s.statSourceId == 1 && s.seasonId == SEASON && s.statSplitTypeId == 0); const gp = se?.gp || 0; const w = gp / (gp + 8); const o = {}; for (const k of K) { const a = se?.a?.[k] ?? 0, b = pr?.averageStats?.[k] ?? a; o[k] = gp ? w * a + (1 - w) * b : b; } return o; };
  const play = { OUT: 0, DAY_TO_DAY: 0.75, ACTIVE: 1 };
  const f1 = (v) => v == null || isNaN(v) ? null : +(+v).toFixed(1);
  const pct = (m, a) => a ? +(m / a).toFixed(3) : null;
  const pos = (p) => { const e = p.eligibleSlots || []; const m = { 0: 'PG', 1: 'SG', 2: 'SF', 3: 'PF', 4: 'C' }; return Object.keys(m).filter((k) => e.includes(+k)).map((k) => m[k]).join('/'); };
  const wkG = (pt, w) => { if (!WEEKS[w]) return 0; let n = 0; for (let sp = WEEKS[w][0]; sp <= WEEKS[w][1]; sp++) n += g[pt]?.[sp] || 0; return n; };
  const short = (n) => { const p = n.split(' '); return /^(Jr\.|Sr\.|II|III|IV)$/.test(p.at(-1)) ? p.slice(-2).join(' ') : p.at(-1); };
  const SP = (w) => { const [a, b] = WEEKS[w]; return Array.from({ length: b - a + 1 }, (_, i) => a + i); };
  const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const C = [0, 6, 3, 2, 1, 17, 11, 13, 14, 15, 16];
  const sim = (A, Bt, sps, N = 3000) => { let wins = 0; const cw = new Array(9).fill(0);
    for (let i = 0; i < N; i++) { const T = [A, Bt].map((R) => { const t = {}; C.forEach((k) => { t[k] = 0; });
      for (const sp of sps) { const av = R.filter((x) => g[x.pt]?.[sp] && Math.random() < x.p).sort((a, b) => b.v - a.v).slice(0, 10);
        for (const x of av) { const f = Math.max(0, 1 + 0.3 * randn()); for (const k of C) t[k] += Math.max(0, x.s[k] * f * (1 + 0.35 * randn())); } } return t; });
      const [a, b] = T; const res = [a[0] > b[0], a[6] > b[6], a[3] > b[3], a[2] > b[2], a[1] > b[1], a[17] > b[17], a[11] < b[11], a[13] / a[14] > b[13] / b[14], a[15] / a[16] > b[15] / b[16]];
      res.forEach((r, j) => { cw[j] += r; }); if (res.filter(Boolean).length >= 5) wins++; }
    return { win: Math.round(100 * wins / N), cats: cw.map((c) => Math.round(100 * c / N)) }; };
  const proj = (R, sps) => { const t = {}; C.forEach((k) => { t[k] = 0; }); for (const sp of sps) { const av = R.filter((x) => g[x.pt]?.[sp]).sort((a, b) => b.v - a.v).slice(0, 10); for (const x of av) for (const k of C) t[k] += x.s[k] * x.p; }
    return [t[0], t[6], t[3], t[2], t[1], t[17], t[11], t[13] / t[14], t[15] / t[16]].map((v) => v < 2 ? +v.toFixed(3) : Math.round(v)); };
  const plan = (w, punt) => punt ? 'Punt' : w >= 65 ? 'Likely' : w <= 35 ? 'Unlikely' : 'Toss-up';
  const PUN = {}, R = {};
  for (const t of d.teams) { PUN[t.id] = puntsOf(names[t.id]); R[t.id] = t.roster.entries.map((e) => { const p = e.playerPoolEntry.player; const s = line(p); return { n: p.fullName, pt: p.proTeamId, inj: p.injuryStatus, slot: e.lineupSlotId, s, v: val(s, PUN[t.id]), p: e.lineupSlotId === 13 && p.injuryStatus === 'OUT' ? 0 : (play[p.injuryStatus] ?? 0.5), raw: p }; }); }
  const oppOf = (id, w) => { const m = d.schedule.find((m) => m.matchupPeriodId == w && (m.home.teamId == id || m.away?.teamId == id)); return m.home.teamId == id ? m.away.teamId : m.home.teamId; };

  const NEWS = opts.news || [];
  const GEN = opts.generalNews || null;
  const checked = opts.checked || 'this update';

  const team = (id) => {
    const tn = names[id], punts = PUN[id], me = R[id], rk = RANKS[tn];
    const opp = oppOf(id, WEEK), on = names[opp], om = R[opp];
    const s4 = SP(WEEK);
    const w4 = sim(me, om, s4); const pm = proj(me, s4), po = proj(om, s4);
    const matchup = CAT.map((c, i) => ({ category: c, order: i + 1, plan: plan(w4.cats[i], punts.includes(c)), you_now: 0, opp_now: 0, you_proj: pm[i], opp_proj: po[i], win_pct: w4.cats[i] }));
    const cnt = s4.map((sp) => me.filter((x) => g[x.pt]?.[sp] && x.p > 0).length), ocnt = s4.map((sp) => om.filter((x) => g[x.pt]?.[sp] && x.p > 0).length);
    const daygrid = s4.map((sp, i) => ({ order: i + 1, day: DAYS[i], lock_myt: LOCK[i], you_games: cnt[i], you_open: Math.max(0, 10 - cnt[i]), opp_games: ocnt[i], opp_open: Math.max(0, 10 - ocnt[i]), edge: Math.min(10, cnt[i]) - Math.min(10, ocnt[i]) }));
    const lineup = s4.map((sp, i) => { const pl = me.filter((x) => g[x.pt]?.[sp] && x.p > 0).sort((a, b) => b.v - a.v); const st = pl.slice(0, 10), bn = pl.slice(10); return { day: DAYS[i], order: i + 1, lock_myt: LOCK[i], open_slots: Math.max(0, 10 - pl.length), lineup: st.map((x) => short(x.n)).join(', ') || 'Nobody plays', sit: bn.length ? 'Bench ' + bn.map((x) => short(x.n)).join(', ') : (pl.length === 10 ? 'Exactly 10' : '') }; });
    const row = (x, extra) => { const p = x.raw; const s = split(p, '00' + SEASON), l7 = split(p, '01' + SEASON), l15 = split(p, '02' + SEASON); const a = s?.a || {}; const v = s && s.gp ? val(a, punts) : null, v15 = l15 && l15.gp ? val(l15.a, punts) : null;
      return { player: x.n, nba: abbr[x.pt], pos: pos(p), inj: x.inj === 'ACTIVE' ? '' : x.inj.replace(/_/g, ' ').toLowerCase(), gp: s?.gp || 0, min: f1(a[40]), min_l7: l7 && l7.gp ? f1(l7.a[40]) : null, pts: f1(a[0]), reb: f1(a[6]), ast: f1(a[3]), stl: f1(a[2]), blk: f1(a[1]), tpm: f1(a[17]), to: f1(a[11]), fg: pct(a[13], a[14]), ft: pct(a[15], a[16]), value: f1(v), value_l15: f1(v15), trend: v15 == null || v == null ? '' : (v15 - v >= 1 ? 'up' : v15 - v <= -1 ? 'down' : ''), ...extra }; };
    const roster = me.map((x) => row(x, { g_wk4: wkG(x.pt, WEEK), g_wk5: wkG(x.pt, WEEK + 1), g_wk6: wkG(x.pt, WEEK + 2), note: x.slot === 13 ? 'IR' : (x.inj === 'OUT' ? 'Out' : '') })).sort((a, b) => (b.value ?? -99) - (a.value ?? -99)).map((r, i) => ({ ...r, order: i + 1 }));
    // pickups ranked by counted minutes in open slots, weighted by value
    const wv = fa.filter((p) => { const s = split(p.player, '00' + SEASON); const l7 = split(p.player, '01' + SEASON); const m = l7 && l7.gp ? l7.a[40] : s?.a?.[40]; return s && s.gp >= 3 && m >= 21 && ['ACTIVE', 'DAY_TO_DAY'].includes(p.player.injuryStatus); }).map((p) => {
      const x = { n: p.player.fullName, pt: p.player.proTeamId, inj: p.player.injuryStatus, raw: p.player }; const days = []; let open = 0; s4.forEach((sp, i) => { if (g[x.pt]?.[sp]) { days.push(DN[i]); if (cnt[i] < 10) open++; } });
      const r = row(x, { status: p.status === 'FREEAGENT' ? 'Free agent' : 'Waivers', days: days.join(' '), open_games: open }); r.cmin = Math.round(open * (r.min_l7 ?? r.min)); return r; })
      .filter((r) => r.value != null).sort((a, b) => (b.value + 3) * b.open_games - (a.value + 3) * a.open_games).slice(0, 12)
      .map((r, i) => ({ order: i + 1, player: r.player, nba: r.nba, pos: r.pos, min: r.min, min_l7: r.min_l7, pts: r.pts, reb: r.reb, ast: r.ast, stl: r.stl, tpm: r.tpm, fg: r.fg, ft: r.ft, value: r.value, status: r.status, days: r.days, open_games: r.open_games, note: (r.status === 'Waivers' ? 'Needs a claim. ' : '') + `${r.cmin} counted minutes` }));
    const tobj = d.teams.find((t) => t.id === id); const used = tobj.transactionCounter?.matchupAcquisitionTotals?.[String(WEEK)] || 0; const left = Math.max(0, 4 - used);
    const healthy = roster.filter((r) => !r.inj && r.note !== 'IR' && r.value != null); const worst = healthy.slice().sort((a, b) => a.value - b.value)[0];
    const bestFA = wv.find((w) => w.status === 'Free agent');
    const moves = []; let doNow = 'No add needed right now; keep the adds for injuries and light days.';
    if (worst && bestFA && bestFA.value - worst.value >= 0.8 && left > 0) { doNow = `Drop ${worst.player}, add ${bestFA.player} (${bestFA.nba}): plays ${bestFA.days}.`; moves.push({ kind: 'Swap', move: `Now: drop ${worst.player}, add ${bestFA.player}`, why: `${worst.player} is the lowest-value healthy player in this build (${worst.value > 0 ? '+' : ''}${worst.value}). ${bestFA.player} (${bestFA.nba}, ${bestFA.min_l7 ?? bestFA.min} minutes lately, ${bestFA.pts} points, ${bestFA.reb} rebounds, ${bestFA.ast} assists) rates ${bestFA.value > 0 ? '+' : ''}${bestFA.value} and plays ${bestFA.days}, ${bestFA.open_games} of those on days with open slots. Do it before the next first tip.` }); }
    const light = daygrid.slice().sort((a, b) => b.you_open - a.you_open)[0];
    if (light.you_open >= 5 && left > 0) { const dIdx = light.order - 1; const st = wv.filter((w) => w.status === 'Free agent' && w.days.includes(DN[dIdx])).slice(0, 3).map((w) => w.player); moves.push({ kind: 'Swap', move: `${DN[dIdx]}: stream into ${light.you_open} open slots`, why: `Only ${light.you_games} players play on ${light.day}. The day before, drop the weakest bench player and add one who plays that day${st.length ? ': ' + st.join(', ') : ''}. Lock is ${light.lock_myt} MYT.` }); }
    lineup.filter((l) => l.sit.startsWith('Bench')).forEach((l) => moves.push({ kind: 'Lineup', move: `${l.day.slice(0, 3)}: ${l.sit.toLowerCase()}`, why: `More than 10 players play on ${l.day}. Start the 10 with the most value in this build; ${l.sit.replace('Bench ', '')} add the least.` }));
    me.filter((x) => x.inj === 'OUT' && x.slot !== 13).forEach((x) => moves.push({ kind: 'Lineup', move: `Move ${x.n} to IR`, why: `${x.n} is listed out. Moving him to an IR slot frees a roster spot for a pickup (2 IR slots).` }));
    if (punts.length) { const pp = me.filter((x) => x.slot !== 13).map((x) => ({ x, w: punts.reduce((s, c) => s + W[c](x.s), 0) })).sort((a, b) => b.w - a.w)[0];
      if (pp && pp.w >= 1) moves.push({ kind: 'Trade', move: `Sell ${pp.x.n}'s ${punts.join(' and ')}`, why: `About ${pp.w.toFixed(1)} of his value per game comes from ${punts.join(' and ')}, which this build punts. A team that needs ${punts.join('/')} should value him more; ask for help in ${CAT.filter((c) => !punts.includes(c) && rk[CAT.indexOf(c)] >= 7).join(', ') || 'the weakest contested category'}.` }); }
    const st2 = roster.find((r) => r.trend === 'up' && r.value >= 2); if (st2) moves.push({ kind: 'Trade', move: `Watch ${st2.player} as a sell-high piece`, why: `He's at ${st2.value_l15 > 0 ? '+' : ''}${st2.value_l15} over the last 15 days vs ${st2.value > 0 ? '+' : ''}${st2.value} for the season. If the run continues, his ESPN rank will rise and he becomes a strong trade chip.` });
    moves.forEach((m, i) => { m.order = i + 1; m.id = 'm' + (i + 1); });
    const injured = me.filter((x) => x.inj !== 'ACTIVE');
    const injuries = [...injured.map((x, i) => ({ order: i + 1, player: x.n, status: x.inj === 'OUT' ? 'Out' : x.inj === 'DAY_TO_DAY' ? 'Day-to-day' : x.inj.replace(/_/g, ' ').toLowerCase(), note: x.slot === 13 ? 'On IR.' : (x.inj === 'OUT' ? 'Out, not on IR.' : 'Check before the lock.') })), { order: 99, player: 'Everyone else', status: 'Active', note: `No other players on ESPN's injury report (checked ${checked}).` }];
    const likely = matchup.filter((m) => m.plan === 'Likely').map((m) => m.category), toss = matchup.filter((m) => m.plan === 'Toss-up').map((m) => m.category), unl = matchup.filter((m) => m.plan === 'Unlikely').map((m) => m.category);
    const need = Math.max(0, 5 - likely.length);
    const dtd = injured.filter((x) => x.inj === 'DAY_TO_DAY');
    const today = [{ order: 1, label: 'Next lock', text: 'The next day\'s first tip, usually about 8 AM MYT.' + (dtd.length ? ' Check ' + dtd.map((x) => x.n).join(', ') + ' before it.' : '') },
      { order: 2, label: 'This week', text: `Week ${WEEK} vs ${on}: about ${w4.win}%. Likely wins: ${likely.join(', ') || 'none'}.${toss.length ? ' Coin flips: ' + toss.join(', ') + '.' : ''}` },
      { order: 3, label: 'Adds', text: `${used} of 4 used this week. ${left} left.` },
      { order: 4, label: 'Do now', text: doNow },
      { order: 5, label: light.day.slice(0, 3), text: `Lightest day: ${light.you_games} players, ${light.you_open} open slots. Best day for a streamer.` },
      { order: 6, label: 'Every day', text: 'Check injuries and depth charts before the first tip.' }];
    const closest = matchup.filter((m) => m.plan === 'Toss-up').sort((a, b) => Math.abs(50 - a.win_pct) - Math.abs(50 - b.win_pct));
    const matchnotes = [{ order: 1, label: 'Matchup', text: `Week ${WEEK} (${DATES[WEEK]}) vs ${on} (${rec(opp)}).` }, { order: 2, label: 'Win chance', text: `About ${w4.win}% with the current roster.` }, { order: 3, label: 'Games', text: `${tn}: ${cnt.join(', ')} players Mon–Sun. ${on}: ${ocnt.join(', ')}.` }, { order: 4, label: 'Closest', text: closest.length ? closest.map((m) => `${m.category} (${m.win_pct}%)`).join(', ') + `. Need ${need} of these on top of the likely wins.` : 'No coin-flip categories this week.' }];
    const ork = RANKS[on]; const oStrong = CAT.filter((c, i) => ork[i] <= 3), oWeak = CAT.filter((c, i) => ork[i] >= 10);
    const oOpen = daygrid.filter((x) => x.opp_open >= 5).map((x) => x.day.slice(0, 3)); const big = daygrid.filter((x) => x.edge <= -3).map((x) => x.day.slice(0, 3));
    const oInj = om.filter((x) => x.inj !== 'ACTIVE').map((x) => x.n + ' (' + (x.inj === 'OUT' ? 'out' : 'day-to-day') + ')');
    const opponent = [{ kind: 'Expect', label: `${on}'s schedule`, text: oOpen.length ? `They have 5+ open slots on ${oOpen.join(', ')}, so expect streamers there.` : 'They have few open slots, so expect few streamers.' },
      { kind: 'Expect', label: 'Their strengths', text: `Season ranks: strong in ${oStrong.join(', ') || 'nothing in the top 3'}; weak in ${oWeak.join(', ') || 'nothing in the bottom 3'}.${oInj.length ? ' Injured: ' + oInj.join(', ') + '.' : ''}` },
      ...(big.length ? [{ kind: 'Expect', label: 'Their big days', text: `${on} has 3+ more counted games than ${tn} on ${big.join(', ')}.` }] : []),
      { kind: 'Defend', label: 'Swing categories', text: closest.length ? `Focus on ${closest.slice(0, 3).map((m) => m.category).join(', ')}; pick streamers who help those.` : 'The likely wins should hold; protect them with full lineups.' },
      { kind: 'Defend', label: 'Light days', text: `Fill open slots on ${daygrid.filter((x) => x.you_open >= 4).map((x) => x.day.slice(0, 3)).join(', ') || 'any light day'} to match their games.` },
      { kind: 'Defend', label: 'Ignore', text: punts.length ? `Don't chase ${punts.join(' or ')}; this build punts ${punts.length > 1 ? 'them' : 'it'}.` : 'No punted categories; contest all nine.' }].map((x, i) => ({ ...x, order: i + 1 }));
    const top = roster.filter((r) => r.value != null).slice(0, 3).map((r) => short(r.player));
    const strong = CAT.filter((c, i) => rk[i] <= 3 && !punts.includes(c));
    const strategy = [{ order: 1, label: 'Build', text: punts.length ? `Claude's read of the roster: punt ${punts.join(' and ')} (season ranks ${punts.map((c) => rk[CAT.indexOf(c)]).join(' and ')} of 12). Core: ${top.join(', ')}.` : `Balanced: no category ranks 10th or worse. Core: ${top.join(', ')}.` },
      { order: 2, label: 'Strengths', text: `Top-3 categories so far: ${strong.join(', ') || 'none'}.` },
      { order: 3, label: 'Path to 5', text: `This week: ${likely.join(', ') || 'none'} likely${toss.length ? ', plus ' + need + ' of ' + toss.join(', ') : ''}.` },
      { order: 4, label: 'Concede', text: punts.length ? punts.join(' and ') + (unl.filter((c) => !punts.includes(c)).length ? '; also ' + unl.filter((c) => !punts.includes(c)).join(', ') + ' this week' : '') + '.' : (unl.join(', ') || 'Nothing') + '.' },
      { order: 5, label: 'Adds', text: `${left} left this week. Pick up by counted minutes in open slots, and swap mid-week when a player's games run out.` },
      { order: 6, label: 'Lineup', text: lineup.some((l) => l.sit.startsWith('Bench')) ? 'Some days have more than 10 players; see the lineup plan for who sits.' : 'No day has more than 10 players; start everyone who plays.' }];
    const outlook = [WEEK, WEEK + 1, WEEK + 2, WEEK + 3, WEEK + 4].map((w, i) => { const o = oppOf(id, w); const base = { order: i + 1, week: w, dates: DATES[w] || '', opponent: names[o], record: rec(o) };
      const sps = WEEKS[w] ? SP(w) : null; const known = sps && sps.reduce((s, sp) => s + Object.values(g).reduce((a, t) => a + (t[sp] || 0), 0), 0) > 60;
      if (!known) { const or = RANKS[names[o]]; return { ...base, your_games: null, opp_games: null, win_pct: null, you_win: CAT.filter((c, j) => !punts.includes(c) && rk[j] + 3 <= or[j]).join(', ') || '—', they_win: CAT.filter((c, j) => or[j] + 3 <= rk[j]).join(', ') || '—', note: 'NBA schedule not final yet; forecast later.' }; }
      const r = w === WEEK ? w4 : sim(me, R[o], sps, 2000); const gm = (Rr) => sps.reduce((s, sp) => s + Math.min(10, Rr.filter((x) => g[x.pt]?.[sp] && x.p > 0).length), 0);
      return { ...base, your_games: gm(me), opp_games: gm(R[o]), win_pct: r.win, you_win: CAT.filter((c, j) => r.cats[j] >= 65).join(', ') || '—', they_win: CAT.filter((c, j) => r.cats[j] <= 35).join(', ') || '—', note: w === WEEK ? 'This week.' : r.win >= 65 ? 'Favored.' : r.win <= 35 ? 'Underdog.' : 'Toss-up.', _cats: w === WEEK + 1 ? r.cats : undefined }; });
    const o5 = oppOf(id, WEEK + 1); const s5 = SP(WEEK + 1); const c5 = outlook[1]._cats || new Array(9).fill(50); const pm5 = proj(me, s5), po5 = proj(R[o5], s5); delete outlook[1]._cats;
    const nextweek = CAT.map((c, i) => ({ category: c, order: i + 1, plan: plan(c5[i], punts.includes(c)), you_proj: pm5[i], opp_proj: po5[i], win_pct: c5[i] }));
    const nw = outlook[1];
    const profiles = d.teams.filter((t) => t.id !== id).map((t) => { const n2 = names[t.id]; const r2 = RANKS[n2]; const theyNeed = CAT.filter((c, i) => rk[i] <= 4 && r2[i] >= 8); const theySpare = CAT.filter((c, i) => !punts.includes(c) && rk[i] >= 7 && r2[i] <= 4);
      return { team: n2, record: rec(t.id), strong: CAT.filter((c, i) => r2[i] <= 3).join(', ') || '—', weak: CAT.filter((c, i) => r2[i] >= 10).join(', ') || '—', they_need: theyNeed.join(', ') || '—', they_spare: theySpare.join(', ') || '—', fit: theyNeed.length && theySpare.length ? 'Good' : theyNeed.length || theySpare.length ? 'Some' : 'Low' }; })
      .sort((a, b) => ({ Good: 0, Some: 1, Low: 2 }[a.fit] - { Good: 0, Some: 1, Low: 2 }[b.fit])).map((r, i) => ({ order: i + 1, ...r }));
    const onTeam = new Set(me.map((x) => x.n)); const news = [...NEWS.filter((n) => n.p.some((p) => onTeam.has(p))), ...(GEN ? [GEN] : [])].map((n, i) => ({ order: i + 1, source: n.source, headline: n.headline, verdict: n.verdict, take: n.take }));
    return { team: tn, slug: slug(tn), record: rec(id), punts, nextweek_title: `Forecast: week ${WEEK + 1} vs ${names[o5]} (${DATES[WEEK + 1] || ''}): about ${nw.win_pct ?? '—'}%`, nextweek_note: `Early forecast with the current roster. Likely wins: ${nextweek.filter((x) => x.plan === 'Likely').map((x) => x.category).join(', ') || 'none'}; likely losses: ${nextweek.filter((x) => x.plan === 'Unlikely').map((x) => x.category).join(', ') || 'none'}. Rosters will change; this refreshes each update.`,
      today, moves, injuries, matchnotes, matchup, daygrid, lineup, opponent, strategy, outlook, nextweek, roster, waivers: wv, profiles, news };
  };

  const files = { 'league/ranks': ranks, 'league/teamstats': teamstats, 'league/standings': standings, 'league/txns': txns };
  if (opts.quote) files['league/quote'] = [opts.quote];
  for (const t of d.teams) files['teams/' + slug(names[t.id])] = team(t.id);
  window.SITEFILES = files;
  return { teams: d.teams.length, punts: Object.fromEntries(d.teams.map((t) => [names[t.id], PUN[t.id].join('+') || 'none'])), bytes: JSON.stringify(files).length };
};
window.SENDSITE = () => { location.href = 'http://localhost:8765/receive.html#' + encodeURIComponent(JSON.stringify({ files: window.SITEFILES })); };
