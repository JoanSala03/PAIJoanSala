/* ==========================================================================
   Pizarra Fantasy · aplicación
   ========================================================================== */
(function () {
  'use strict';

  const DB = window.FantasyDB;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
  const f1 = n => nf1.format(n);
  const f0 = n => nf0.format(n);
  const money = n => f1(n) + ' M€';
  const sum = (arr, fn = x => x) => arr.reduce((a, b) => a + (fn(b) || 0), 0);
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const POS = ['POR', 'DEF', 'CEN', 'DEL'];
  const POS_NAME = { POR: 'Portero', DEF: 'Defensa', CEN: 'Centrocampista', DEL: 'Delantero' };
  const POS_PLURAL = { POR: 'Porteros', DEF: 'Defensas', CEN: 'Centrocampistas', DEL: 'Delanteros' };
  const STATUS_TXT = { ok: 'Disponible', doubtful: 'Duda', injured: 'Lesionado', suspended: 'Sancionado' };
  const FORMATIONS_STD = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
  const FORMATIONS_PREM = ['3-3-4', '4-2-4', '5-2-3'];
  const FORMATIONS = FORMATIONS_STD.concat(FORMATIONS_PREM);
  const formations = () => (state.premium ? FORMATIONS : FORMATIONS_STD);
  const FDR_TXT = { 1: 'Muy asequible', 2: 'Asequible', 3: 'Igualado', 4: 'Exigente', 5: 'Muy exigente' };
  const MAX_SQUAD = 24;
  const STORE = 'pizarra-fantasy-v2';

  let PLAYED, NEXT, LAST;
  function computeWeeks() {
    PLAYED = DB.playedJornadas(new Date());
    NEXT = Math.min(38, PLAYED + 1);
    LAST = Math.max(1, PLAYED);
  }
  computeWeeks();
  const dateTxt = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', opts).replace('.', '');

  const EXAMPLE = ['rma-courtois', 'get-david-soria', 'bar-jules-kounde', 'rma-dean-huijsen', 'atm-david-hancko', 'atm-alex-grimaldo',
    'ray-andrei-ratiu', 'osa-alejandro-catena', 'bar-pedri', 'atm-alex-baena', 'ray-isi-palazon', 'val-javi-guerra', 'bet-isco',
    'rma-kylian-mbappe', 'rso-mikel-oyarzabal', 'osa-ante-budimir', 'bet-antony', 'dep-yeremay-hernandez'];

  /* ---------------- Estado ---------------- */
  const defaults = () => ({
    v: 2, squad: EXAMPLE.slice(), example: true, formation: '4-3-3', lineup: null, budget: 8.5,
    overrides: {}, statusOv: {}, valueOv: {}, posOv: {}, apiIds: {}, custom: [], official: null, officialFixtures: null, officialWeek: 0, tab: 'resumen', noticeHidden: false,
    market: { q: '', pos: 'ALL', team: 'ALL', max: '', sort: 'xp', dir: -1, limit: 40 },
    premium: false, league: null, leagueSel: null, myTeam: {}, fidMap: {}, calOnlyMine: false, calJ: LAST, cmp: ['rma-kylian-mbappe', 'bar-lamine-yamal']
  });
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === 2) return Object.assign(defaults(), s, { market: Object.assign(defaults().market, s.market) }); }
    } catch (e) { /* almacenamiento no disponible */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* sin persistencia */ } }

  /* ---------------- Jugadores y métricas ---------------- */
  let ALL = [], BY = {};
  function rebuild() {
    const posOv = state.posOv || {};
    ALL = DB.PLAYERS.map(p => (posOv[p.id] && posOv[p.id] !== p.pos ? Object.assign({}, p, { pos: posOv[p.id] }) : p))
      .concat(state.custom.map(c => Object.assign({ custom: true }, c)));
    BY = Object.fromEntries(ALL.map(p => [p.id, p]));
    state.squad = state.squad.filter(id => BY[id]);
    memo.clear();
  }
  const memo = new Map();
  const team = id => DB.TEAM[id];
  const inSquad = id => state.squad.includes(id);
  const statusOf = p => state.statusOv[p.id] || p.status || 'ok';
  const unavailable = p => ['injured', 'suspended'].includes(statusOf(p));

  function fixtureOf(teamId, j) {
    const g = DB.ROUNDS[j - 1].find(g => g.home === teamId || g.away === teamId);
    return g.home === teamId ? { opp: g.away, home: true } : { opp: g.home, home: false };
  }
  function fdr(teamId, j) {
    const f = fixtureOf(teamId, j);
    const s = team(f.opp).str + (f.home ? -3 : 3) - (team(teamId).str - 70) * 0.25;
    return s < 62 ? 1 : s < 68 ? 2 : s < 76 ? 3 : s < 85 ? 4 : 5;
  }
  function matchResult(j, teamId) {
    if (j > PLAYED) return null;
    return DB.simulateJornada(j).matches.find(m => m.home === teamId || m.away === teamId);
  }
  function week(p, j) {
    const f = fixtureOf(p.team, j);
    const ov = state.overrides[p.id] && state.overrides[p.id][j];
    const s = p.custom ? null : DB.simulateJornada(j).stats[p.id];
    if (ov === 'x') return { j, opp: f.opp, home: f.home, played: false, pts: 0, min: 0, g: 0, a: 0, manual: true };
    if (Array.isArray(ov)) return { j, opp: f.opp, home: f.home, played: true, pts: Number(ov[0]) || 0, min: ov[1] || 0, g: ov[2] || 0, a: ov[3] || 0, cs: false, manual: true, official: true };
    if (ov !== undefined && ov !== null && ov !== '') return Object.assign({ min: 90, g: 0, a: 0 }, s || {}, { j, opp: f.opp, home: f.home, played: true, pts: Number(ov), manual: true });
    if (s) return s;
    return { j, opp: f.opp, home: f.home, played: false, pts: 0, min: 0, g: 0, a: 0 };
  }
  const expectedPts = p => 1.5 + p.q * 0.55;
  const sig = x => 1 / (1 + Math.exp(-x));

  function metrics(p) {
    if (memo.has(p.id)) return memo.get(p.id);
    const hist = range(1, PLAYED).map(j => week(p, j));
    const played = hist.filter(h => h.played);
    const total = sum(hist, h => h.pts);
    const apps = played.length;
    const avg = apps ? total / apps : 0;
    const last3 = hist.slice(-3);
    const form3 = last3.length ? sum(last3, h => h.pts) / last3.length : 0;
    const exp = expectedPts(p);
    // Valor de mercado: evoluciona con la forma reciente
    const base = p.custom ? (Number(p.value) || 1) : DB.baseValue(p);
    const values = [base * 0.92];
    for (let k = 1; k <= PLAYED; k++) {
      const win = hist.slice(Math.max(0, k - 3), k);
      const fk = sum(win, h => h.pts) / win.length;
      values.push(p.custom ? base : base * (0.74 + 0.5 * sig((fk - exp) / 2.4)));
    }
    let value = values[values.length - 1];
    if (state.valueOv[p.id]) value = state.valueOv[p.id];
    else if (unavailable(p)) value *= 0.93;
    if (!state.valueOv[p.id]) values[values.length - 1] = value;
    const m = {
      hist, total, apps, avg, form3, exp, value, values,
      goals: sum(played, h => h.g), assists: sum(played, h => h.a),
      cs: played.filter(h => h.cs).length,
      trend: values.length > 1 ? value - values[values.length - 2] : 0
    };
    memo.set(p.id, m);
    return m;
  }

  function xp(p, j = NEXT) {
    if (j > 38) return 0;
    if (unavailable(p) && j <= NEXT) return 0;
    const m = metrics(p);
    const f = fixtureOf(p.team, j);
    const prior = m.exp;
    const base = 0.45 * (PLAYED ? m.form3 : prior) + 0.3 * (m.apps ? m.avg : prior) + 0.25 * prior;
    const mult = 1 + (team(p.team).str - team(f.opp).str) / 100 * 1.2 + (f.home ? 0.06 : -0.04);
    let avail = PLAYED ? Math.min(1, 0.35 + 0.75 * (m.apps / PLAYED)) : 0.85;
    if (p.custom && !m.apps) avail = 0.85;
    if (statusOf(p) === 'doubtful' && j <= NEXT) avail *= 0.55;
    return Math.max(0, base * mult * avail);
  }
  const xpRange = (p, k = 3) => sum(range(NEXT, Math.min(38, NEXT + k - 1)), j => xp(p, j));

  /* ---------------- Alineación ---------------- */
  const needOf = f => { const [d, m, a] = f.split('-').map(Number); return { POR: 1, DEF: d, CEN: m, DEL: a }; };
  function slotsOf(f) { const n = needOf(f); return POS.flatMap(pos => Array(n[pos]).fill(pos)); }
  function bestXI(formation, ids) {
    const need = needOf(formation);
    const ps = ids.map(id => BY[id]).filter(Boolean);
    const out = [];
    POS.forEach(pos => {
      const c = ps.filter(p => p.pos === pos).sort((a, b) => xp(b) - xp(a));
      for (let i = 0; i < need[pos]; i++) out.push(c[i] ? c[i].id : null);
    });
    return out;
  }
  const xiTotal = ids => sum(ids, id => (id && BY[id] ? xp(BY[id]) : 0));
  function bestFormation(ids) {
    let best = null;
    formations().forEach(f => { const xi = bestXI(f, ids); const t = xiTotal(xi); if (!best || t > best.total + 0.01) best = { f, xi, total: t }; });
    return best;
  }
  function currentXI() {
    const slots = slotsOf(state.formation);
    let xi = state.lineup;
    const valid = Array.isArray(xi) && xi.length === 11 && xi.every((id, i) => id === null || (inSquad(id) && BY[id].pos === slots[i]));
    if (!valid) { xi = bestXI(state.formation, state.squad); state.lineup = xi; }
    return xi;
  }
  const bench = () => { const xi = currentXI(); return state.squad.filter(id => !xi.includes(id)).map(id => BY[id]).sort(byPosXp); };
  const byPosXp = (a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || xp(b) - xp(a);

  /* ---------------- Fragmentos de UI ---------------- */
  const lum = hex => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const inkOn = hex => (lum(hex) > 0.33 ? '#10201a' : '#ffffff');
  const crest = (id, lg) => { const t = team(id); return `<span class="crest${lg ? ' lg' : ''}" style="--c1:${t.color};--c2:${t.color2};color:${inkOn(t.color)}" title="${esc(t.name)}">${id}</span>`; };
  const posTag = pos => `<span class="pos pos-${pos}" title="${POS_NAME[pos]}">${pos}</span>`;
  const statusPill = p => { const s = statusOf(p); return `<span class="status st-${s}">${STATUS_TXT[s]}</span>`; };
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  function jersey(p, size = 48) {
    const t = team(p.team);
    return `<svg class="jersey" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M16 5 10 7 2 14l5 8 4-3v25h26V19l4 3 5-8-8-7-6-2c-2 4-14 4-16 0Z" fill="${t.color}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
      <path d="M10 7 2 14l5 8 4-3ZM38 7l8 7-5 8-4-3Z" fill="${t.color2}" opacity=".9"/>
      <path d="M16 5c2 4 14 4 16 0" fill="none" stroke="${t.color2}" stroke-width="2"/>
      <text x="24" y="33" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="13" fill="${inkOn(t.color)}">${esc(initials(p.name))}</text>
    </svg>`;
  }
  function pcell(p, opts = {}) {
    const t = team(p.team);
    return `<div class="pcell">${opts.jersey ? jersey(p, 34) : crest(p.team)}<div class="pcell-text">
      <button class="pname" data-action="player" data-id="${p.id}">${esc(p.name)}</button>
      <span class="pmeta">${posTag(p.pos)} ${esc(t.name)}</span></div></div>`;
  }
  function ptsBadge(v) { const cls = v < 0 ? ' neg' : v === 0 ? ' zero' : ''; return `<span class="pts-badge${cls}">${f0(v)}</span>`; }
  function formBars(p, n = 5) {
    const h = metrics(p).hist.slice(-n);
    if (!h.length) return '<span class="muted">—</span>';
    const tip = h.map(x => `J${x.j} ${x.played ? x.pts : 'no jugó'}`).join(' · ');
    return `<span class="form" data-tip="${esc('<b>Últimas jornadas</b><br>' + tip)}">${h.map(x => {
      if (!x.played) return '<i class="dnp"></i>';
      const hh = clamp(Math.abs(x.pts) / 16 * 22, 3, 22);
      return `<i class="${x.pts < 0 ? 'neg' : ''}" style="height:${hh}px"></i>`;
    }).join('')}</span>`;
  }
  function fdrChip(teamId, j, showJ) {
    if (j > 38) return '';
    const f = fixtureOf(teamId, j), n = fdr(teamId, j), o = team(f.opp);
    const tip = `<b>J${j} · ${dateTxt(DB.DATES[j - 1])}</b><br>${f.home ? 'vs ' : 'en '}${esc(o.name)} (${f.home ? 'casa' : 'fuera'})<br>Dificultad ${n}/5 · ${FDR_TXT[n]}`;
    return `<span class="fdr fdr-${n}" data-tip="${esc(tip)}">${showJ ? `<small>J${j}</small>` : ''}${f.opp}<small>${f.home ? 'casa' : 'fuera'}</small></span>`;
  }
  const fdrRow = (teamId, k = 3) => `<span class="fdr-row">${range(NEXT, Math.min(38, NEXT + k - 1)).map(j => fdrChip(teamId, j)).join('')}</span>`;
  const addBtn = p => inSquad(p.id)
    ? `<button class="add-btn owned" data-action="toggle-squad" data-id="${p.id}" aria-label="Quitar ${esc(p.name)} de mi plantilla" data-tip="Quitar de mi plantilla">✓</button>`
    : `<button class="add-btn" data-action="toggle-squad" data-id="${p.id}" aria-label="Añadir ${esc(p.name)} a mi plantilla" data-tip="Añadir a mi plantilla">+</button>`;
  const trendTxt = d => Math.abs(d) < 0.05 ? '<span class="muted">=</span>' : d > 0 ? `<span class="delta-up">▲ ${f1(d)}</span>` : `<span class="delta-down">▼ ${f1(-d)}</span>`;

  /* ---------------- Gráficos SVG ---------------- */
  function niceStep(span) { const steps = [1, 2, 5, 10, 20, 25, 50, 100]; return steps.find(s => span / s <= 5) || 200; }
  function barChart(items, opts = {}) {
    const W = 640, H = opts.height || 230, ml = 34, mr = 10, mt = 18, mb = 36;
    if (!items.length) return '<p class="muted">Aún no se ha disputado ninguna jornada.</p>';
    const vals = items.map(d => d.v);
    let lo = Math.min(0, ...vals), hi = Math.max(opts.minMax || 10, ...vals);
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const y = v => mt + (hi - v) / (hi - lo) * (H - mt - mb);
    const band = (W - ml - mr) / items.length, bw = Math.min(30, band * 0.62);
    const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
    const maxI = vals.indexOf(Math.max(...vals)), minI = vals.indexOf(Math.min(...vals));
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Gráfico de barras')}">`;
    ticks.forEach(v => { s += `<line class="${v === 0 ? 'zero' : 'gridline'}" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
    items.forEach((d, i) => {
      const cx = ml + band * i + band / 2, x = cx - bw / 2;
      s += `<g class="col" data-tip="${esc(d.tip || `${d.label}: ${d.v}`)}">`;
      s += `<rect class="hit" x="${ml + band * i}" y="${mt}" width="${band}" height="${H - mt - mb}"/>`;
      if (d.dnp) {
        s += `<rect class="bar dnp" x="${x}" y="${y(0) - 2}" width="${bw}" height="3" rx="1.5"/>`;
      } else if (d.v === 0) {
        s += `<rect class="bar zero-pts" x="${x}" y="${y(0) - 2}" width="${bw}" height="4" rx="1.5"/>`;
      } else {
        const y0 = y(0), y1 = y(d.v), r = Math.min(4, Math.abs(y1 - y0), bw / 2);
        const path = d.v > 0
          ? `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 + r}V${y0}Z`
          : `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 - r}V${y0}Z`;
        s += `<path class="bar${d.v < 0 ? ' neg' : ''}" d="${path}"/>`;
      }
      if ((i === maxI || (i === minI && vals[minI] < 0)) && !d.dnp) {
        s += `<text class="lbl-strong" x="${cx}" y="${d.v >= 0 ? y(d.v) - 6 : y(d.v) + 14}" text-anchor="middle">${d.v}</text>`;
      }
      const showLbl = items.length <= 19 || i % 2 === 0;
      if (showLbl) s += `<text x="${cx}" y="${H - mb + 16}" text-anchor="middle">${esc(d.label)}</text>`;
      if (d.sub && items.length <= 12) s += `<text x="${cx}" y="${H - mb + 30}" text-anchor="middle" font-size="10">${esc(d.sub)}</text>`;
      s += '</g>';
    });
    if (opts.avg !== undefined) {
      s += `<line class="avgline" x1="${ml}" x2="${W - mr}" y1="${y(opts.avg)}" y2="${y(opts.avg)}"/>`;
      s += `<text class="avg-text" x="${W - mr}" y="${y(opts.avg) - 6}" text-anchor="end">media ${f1(opts.avg)}</text>`;
    }
    return s + '</svg>';
  }
  function lineChart(values, labels, opts = {}) {
    const W = 400, H = opts.height || 170, ml = 34, mr = 58, mt = 14, mb = 26;
    if (values.length < 2) return '';
    let lo = Math.min(...values), hi = Math.max(...values);
    const pad = (hi - lo) * 0.15 || hi * 0.1 || 1; lo -= pad; hi += pad;
    const x = i => ml + i / (values.length - 1) * (W - ml - mr);
    const y = v => mt + (hi - v) / (hi - lo) * (H - mt - mb);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Evolución')}">`;
    [lo + pad, (lo + hi) / 2, hi - pad].forEach(v => { s += `<line class="gridline" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${f1(v)}</text>`; });
    s += `<path class="area" d="M${pts.join('L')}L${x(values.length - 1)},${H - mb}L${x(0)},${H - mb}Z"/>`;
    s += `<path class="line" d="M${pts.join('L')}"/>`;
    values.forEach((v, i) => {
      s += `<g data-tip="${esc(`<b>${labels[i]}</b><br>${money(v)}`)}"><rect class="hit" x="${x(i) - 12}" y="${mt}" width="24" height="${H - mt - mb}"/>`;
      if (i === values.length - 1) s += `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="5"/>`;
      s += '</g>';
      if (values.length <= 12 || i % 3 === 0 || i === values.length - 1) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(labels[i])}</text>`;
    });
    const lv = values[values.length - 1];
    s += `<text class="lbl-strong" x="${x(values.length - 1) + 10}" y="${y(lv) + 4}">${money(lv)}</text>`;
    return s + '</svg>';
  }

  /* ---------------- Alertas ---------------- */
  function buildAlerts() {
    const xi = currentXI().filter(Boolean).map(id => BY[id]);
    const out = [];
    xi.forEach(p => {
      const s = statusOf(p);
      if (s === 'injured' || s === 'suspended') out.push({ lvl: 'bad', ico: '!', p, title: `${p.name} está ${STATUS_TXT[s].toLowerCase()} y es titular`, sub: 'Cámbialo antes del cierre de la jornada: sumará 0 puntos.' });
      else if (s === 'doubtful') out.push({ lvl: 'warn', ico: '?', p, title: `${p.name} es duda para la J${NEXT}`, sub: 'Vigila la convocatoria y ten preparado un suplente.' });
    });
    const need = needOf(state.formation);
    POS.forEach(pos => {
      const have = currentXI().filter((id, i) => id && slotsOf(state.formation)[i] === pos).length;
      if (have < need[pos]) out.push({ lvl: 'bad', ico: '!', title: `Te faltan ${need[pos] - have} ${POS_PLURAL[pos].toLowerCase()} en el once`, sub: `La formación ${state.formation} pide ${need[pos]}. Ficha o cambia de sistema.` });
    });
    const bf = bestFormation(state.squad), cur = xiTotal(currentXI());
    if (bf && bf.total - cur > 2) out.push({ lvl: 'warn', ico: '↑', title: `Tu alineación puede mejorar ${f1(bf.total - cur)} puntos esperados`, sub: `Mejor opción: ${bf.f}. Aplícala en el Asistente o en Mi equipo.`, action: 'apply-best', actionTxt: 'Aplicar' });
    xi.forEach(p => {
      const m = metrics(p);
      if (PLAYED >= 3 && m.form3 < m.exp - 2.5 && !unavailable(p)) out.push({ lvl: 'warn', ico: '↓', p, title: `${p.name} está en mala racha`, sub: `${f1(m.form3)} pts de media en las 3 últimas (esperado ≈ ${f1(m.exp)}).` });
      const hard = range(NEXT, Math.min(38, NEXT + 2)).filter(j => fdr(p.team, j) >= 4).length;
      if (hard >= 3) out.push({ lvl: 'warn', ico: '◆', p, title: `Calendario muy duro para ${p.name}`, sub: 'Tres rivales exigentes seguidos. Valora venderlo o reservarlo.' });
    });
    bench().forEach(p => {
      if (PLAYED && metrics(p).form3 >= 8 && !unavailable(p)) out.push({ lvl: 'good', ico: '★', p, title: `${p.name} está en forma en tu banquillo`, sub: `${f1(metrics(p).form3)} pts de media en las 3 últimas. ¿Le das la titularidad?` });
    });
    return out;
  }
  function alertsHtml(list, limit = 6) {
    if (!list.length) return `<div class="alert good"><span class="ico">✓</span><p>Todo en orden<small>Ningún titular lesionado, sancionado ni en duda.</small></p><span></span></div>`;
    return list.slice(0, limit).map(a => `<div class="alert ${a.lvl}"><span class="ico">${a.ico}</span>
      <p>${esc(a.title)}<small>${esc(a.sub)}</small></p>
      ${a.action ? `<button class="btn btn-sm" data-action="${a.action}">${a.actionTxt}</button>` : a.p ? `<button class="btn btn-sm btn-ghost" data-action="player" data-id="${a.p.id}">Ver</button>` : '<span></span>'}</div>`).join('')
      + (list.length > limit ? `<p class="muted" style="margin:0;font-size:13px">+${list.length - limit} avisos más</p>` : '');
  }

  /* ---------------- Vistas ---------------- */
  const VIEWS = { resumen: viewResumen, equipo: viewEquipo, calendario: viewCalendario, mercado: viewMercado, liga: viewLiga, asistente: viewAsistente };
  function render() {
    rebuild();
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
    const main = $('#main');
    main.innerHTML = noticeHtml() + `<div class="view">${VIEWS[state.tab]()}</div>`;
    if (state.tab === 'mercado') updateMarket();
    save();
  }
  function noticeHtml() {
    if (state.noticeHidden) return '';
    const off = state.official;
    const body = off
      ? `<b>Datos oficiales de LaLiga Fantasy</b> del ${new Date(off.fetchedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}: precios, posiciones, estado y puntos de ${off.players} jugadores. Vuelve a sincronizar después de cada jornada.`
      : `<b>Resultados (J1–J7) y calendario (J8–J12) reales.</b> Los precios, posiciones y puntos por jugador son estimaciones hasta que cargues los datos oficiales de LaLiga Fantasy: <button class="link" data-action="open-data">cómo sincronizar</button>.`;
    return `<div class="notice" style="margin-bottom:20px"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 5v6M10 14v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <p>${body} ${state.example ? 'La plantilla cargada es un ejemplo: <button class="link" data-action="clear-squad-direct">empieza la tuya</button>.' : ''}</p>
      <button class="btn btn-sm btn-ghost" data-action="hide-notice" aria-label="Ocultar aviso">✕</button></div>`;
  }

  function addPlayersPanel(empty) {
    const n = state.squad.length;
    return `<section class="panel add-panel">
      <div class="add-panel-text">
        <h2 class="panel-title">${empty ? 'Monta tu plantilla' : 'Añade jugadores'}</h2>
        <p class="panel-sub">Están los ${f0(DB.PLAYERS.length)} jugadores de los 20 equipos de LaLiga 2026/27. Escribe dos letras del nombre, del equipo o el dorsal y pulsa <b>+</b>.</p>
      </div>
      ${searchBox('vsearch', 'Ej.: «lam», «pedri», «betis», «10»…', true)}
      <div class="add-panel-foot"><span class="num"><b>${n}</b>/${MAX_SQUAD} en tu plantilla</span>
        <span class="muted">Atajos: <kbd>/</kbd> buscar · <kbd>Shift</kbd>+<kbd>Enter</kbd> añadir</span></div>
    </section>`;
  }
  function emptySquad() {
    return addPlayersPanel(true) + `<div class="panel"><div class="empty-state"><h3>Tu plantilla está vacía</h3>
      <p>Usa el buscador de arriba para añadir a tus jugadores. La app calculará su forma, rivales y puntos esperados.</p>
      <button class="btn" data-action="tab" data-tab="mercado">O explora el mercado completo</button></div></div>`;
  }

  function viewResumen() {
    if (!state.squad.length) return emptySquad();
    const squad = state.squad.map(id => BY[id]);
    const xiIds = currentXI(), xi = xiIds.filter(Boolean).map(id => BY[id]);
    const alerts = buildAlerts();
    const nextXP = xiTotal(xiIds);
    const lastXI = PLAYED ? sum(xi, p => week(p, PLAYED).pts) : 0;
    const totalPts = sum(squad, p => metrics(p).total);
    const squadVal = sum(squad, p => metrics(p).value);
    const prevVal = sum(squad, p => { const v = metrics(p).values; return v[v.length - 2] ?? v[v.length - 1]; });
    const best = squad.slice().sort((a, b) => metrics(b).total - metrics(a).total)[0];
    const myTeams = [...new Set(squad.map(p => p.team))];
    const games = DB.ROUNDS[NEXT - 1].map(g => {
      const mine = squad.filter(p => p.team === g.home || p.team === g.away);
      return { g, mine };
    }).filter(x => x.mine.length).sort((a, b) => b.mine.length - a.mine.length);

    const perJ = range(1, PLAYED).map(j => {
      const v = sum(xi, p => week(p, j).pts);
      return { label: 'J' + j, v, tip: `<b>Jornada ${j}</b><br>${v} pts de tu once actual<br>${esc(xi.map(p => `${p.name} ${week(p, j).played ? week(p, j).pts : '–'}`).slice(0, 11).join(' · '))}` };
    });
    const avgJ = perJ.length ? sum(perJ, d => d.v) / perJ.length : 0;
    const hot = squad.filter(p => PLAYED).sort((a, b) => metrics(b).form3 - metrics(a).form3).slice(0, 5);
    const cold = squad.filter(p => !unavailable(p)).sort((a, b) => (metrics(a).form3 - metrics(a).exp) - (metrics(b).form3 - metrics(b).exp)).slice(0, 5);

    return `
    <section class="hero">
      <div class="hero-main">
        <span class="eyebrow">Próxima jornada · ${dateTxt(DB.DATES[NEXT - 1], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1 class="hero-title">Jornada ${NEXT} <em>· ${state.formation}</em></h1>
        <p style="margin:0;max-width:52ch">Tu once previsto suma <b>${f1(nextXP)} puntos esperados</b>. ${alerts.filter(a => a.lvl === 'bad').length ? `Hay <b>${alerts.filter(a => a.lvl === 'bad').length} problema(s) urgentes</b> en la alineación.` : 'No hay bajas en tu once titular.'}</p>
        <div class="hero-stats">
          <div class="hero-stat"><b>${f1(nextXP)}</b><span>Puntos esperados J${NEXT}</span></div>
          <div class="hero-stat"><b>${PLAYED ? f0(lastXI) : '—'}</b><span>Tu once en la J${LAST}</span></div>
          <div class="hero-stat"><b>${alerts.length}</b><span>Avisos activos</span></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" data-action="tab" data-tab="equipo">Revisar mi once</button>
          <button class="btn" data-action="tab" data-tab="asistente">Ver recomendaciones</button>
        </div>
      </div>
      <aside class="hero-side">
        <div class="panel-head" style="margin:0"><span class="eyebrow">Tus jugadores en la J${NEXT}</span><span class="panel-sub">${games.length} partidos</span></div>
        <div class="fixture-list">${games.slice(0, 7).map(({ g, mine }) => `
          <div class="fixture mine" data-tip="${esc('<b>' + mine.map(p => p.name).join(', ') + '</b>')}">
            <div class="h"><span>${esc(team(g.home).name)}</span>${crest(g.home)}</div>
            <span class="score vs">${mine.length} <small style="font-size:10px">jug.</small></span>
            <div class="a">${crest(g.away)}<span>${esc(team(g.away).name)}</span></div>
          </div>`).join('')}
          ${games.length > 7 ? `<p class="muted" style="margin:0;font-size:13px">y ${games.length - 7} partidos más</p>` : ''}
        </div>
      </aside>
    </section>

    <section class="kpis">
      <div class="kpi"><div class="kpi-label">Puntos de tu plantilla</div><div class="kpi-value">${f0(totalPts)}</div><div class="kpi-foot">${squad.length} jugadores · ${f1(totalPts / squad.length)} por jugador</div></div>
      <div class="kpi"><div class="kpi-label">Valor de plantilla</div><div class="kpi-value">${f1(squadVal)}<small>M€</small></div><div class="kpi-foot">${trendTxt(squadVal - prevVal)} desde la J${Math.max(1, PLAYED - 1)}</div></div>
      <div class="kpi"><div class="kpi-label">Media de tu once / jornada</div><div class="kpi-value">${f1(avgJ)}</div><div class="kpi-foot">con la alineación actual</div></div>
      <div class="kpi"><div class="kpi-label">Máximo anotador</div><div class="kpi-value" style="font-size:28px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${best ? esc(best.name) : '—'}</div><div class="kpi-foot">${best ? `${metrics(best).total} pts · ${f1(metrics(best).avg)} de media` : ''}</div></div>
    </section>

    <section class="grid">
      <div class="panel span-8">
        <div class="panel-head"><div><h2 class="panel-title">Tu once, jornada a jornada</h2><div class="panel-sub">Puntos que habría sumado tu alineación actual en cada jornada disputada</div></div></div>
        ${barChart(perJ, { avg: avgJ, minMax: 40, label: 'Puntos del once por jornada' })}
      </div>
      <div class="panel span-4">
        <div class="panel-head"><h2 class="panel-title">Avisos</h2><span class="panel-sub">J${NEXT}</span></div>
        <div class="alerts">${alertsHtml(alerts, 5)}</div>
      </div>
      <div class="panel span-6">
        <div class="panel-head"><h2 class="panel-title">En racha</h2><span class="panel-sub">Media de las 3 últimas jornadas</span></div>
        <div class="rank">${hot.map((p, i) => rankItem(p, i, f1(metrics(p).form3))).join('')}</div>
      </div>
      <div class="panel span-6">
        <div class="panel-head"><h2 class="panel-title">Rinden por debajo</h2><span class="panel-sub">Forma frente a lo esperado por su nivel</span></div>
        <div class="rank">${cold.map((p, i) => { const d = metrics(p).form3 - metrics(p).exp; return rankItem(p, i, `<span class="${d < 0 ? 'delta-down' : 'delta-up'}">${d < 0 ? '' : '+'}${f1(d)}</span>`); }).join('')}</div>
      </div>
    </section>`;
  }
  function rankItem(p, i, val) {
    return `<div class="rank-item"><span class="rank-n">${i + 1}</span>
      <div style="display:flex;gap:12px;align-items:center;min-width:0;justify-content:space-between;flex-wrap:wrap">${pcell(p)}<span style="display:flex;gap:10px;align-items:center">${formBars(p)}${fdrRow(p.team, 2)}</span></div>
      <span class="xp">${val}</span></div>`;
  }

  /* --- Mi equipo --- */
  function viewEquipo() {
    if (!state.squad.length) return emptySquad();
    const xi = currentXI(), slots = slotsOf(state.formation);
    const rows = { DEL: [], CEN: [], DEF: [], POR: [] };
    xi.forEach((id, i) => rows[slots[i]].push({ id, i }));
    const total = xiTotal(xi), bf = bestFormation(state.squad);
    const squad = state.squad.map(id => BY[id]).sort(byPosXp);
    const counts = POS.map(pos => `${posTag(pos)} <b class="num">${squad.filter(p => p.pos === pos).length}</b>`).join(' &nbsp; ');
    const squadVal = sum(squad, p => metrics(p).value);

    const slotHtml = ({ id, i }) => {
      if (!id) return `<button class="slot empty" data-action="slot" data-i="${i}" aria-label="Elegir ${POS_NAME[slots[i]].toLowerCase()}"><span class="ghost">+</span><span class="slot-name">${POS_NAME[slots[i]]}</span></button>`;
      const p = BY[id], st = statusOf(p), f = fixtureOf(p.team, NEXT);
      const alert = st === 'injured' || st === 'suspended' ? '<span class="slot-alert bad">!</span>' : st === 'doubtful' ? '<span class="slot-alert warn">?</span>' : '';
      return `<button class="slot" data-action="slot" data-i="${i}" data-tip="${esc(`<b>${p.name}</b><br>${STATUS_TXT[st]} · ${f.home ? 'vs' : 'en'} ${team(f.opp).name}<br>${f1(xp(p))} pts esperados`)}">
        ${alert}${jersey(p)}<span class="slot-name">${esc(p.name)}</span>
        <span class="slot-info"><span class="slot-xp">${f1(xp(p))}</span><span class="slot-opp">${f.home ? '' : '@'}${f.opp}</span></span></button>`;
    };

    return `
    ${addPlayersPanel()}
    <section class="panel">
      <div class="toolbar" style="justify-content:space-between">
        <div class="field">Formación<div class="chips" role="group" aria-label="Formación">${formations().map(f => `<button class="chip${FORMATIONS_PREM.includes(f) ? ' chip-prem' : ''}" aria-pressed="${f === state.formation}" data-action="formation" data-f="${f}"${FORMATIONS_PREM.includes(f) ? ' title="Formación premium"' : ''}>${f}</button>`).join('')}</div>
          <label class="prem-toggle"><input id="premium-toggle" type="checkbox" ${state.premium ? 'checked' : ''}> Tengo formaciones premium <span class="prem-badge">★ ${FORMATIONS_PREM.join(' · ')}</span></label></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-action="auto-xi">Mejor once en ${state.formation}</button>
          <button class="btn btn-primary" data-action="apply-best">Mejor formación (${bf ? bf.f : '—'})</button>
        </div>
      </div>
    </section>
    <section class="team-layout">
      <div style="display:grid;gap:10px;min-width:0">
        <div class="pitch" aria-label="Alineación sobre el campo">
          <svg class="pitch-lines" viewBox="0 0 70 80" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".35">
              <rect x="2" y="2" width="66" height="76"/><path d="M2 2h66"/><path d="M27 2a8 8 0 0 0 16 0"/>
              <rect x="17" y="64" width="36" height="14"/><rect x="27" y="73" width="16" height="5"/><path d="M29 64a7 6 0 0 1 12 0"/>
            </g></svg>
          ${['DEL', 'CEN', 'DEF', 'POR'].map(pos => `<div class="pitch-row">${rows[pos].map(slotHtml).join('')}</div>`).join('')}
        </div>
        <div class="legend"><span><b class="xp" style="font-size:15px">${f1(total)}</b> puntos esperados en la J${NEXT}</span><span>Pulsa un jugador del campo para cambiarlo.</span></div>
      </div>
      <aside class="panel" style="display:grid;gap:12px">
        <div class="panel-head" style="margin:0"><h2 class="panel-title">Banquillo</h2><span class="panel-sub">${bench().length} jugadores</span></div>
        <div class="bench">${bench().map(p => `<div class="bench-item">${posTag(p.pos)}<div style="min-width:0"><button class="pname" data-action="player" data-id="${p.id}">${esc(p.name)}</button><div class="pmeta">${STATUS_TXT[statusOf(p)]} · ${fixtureOf(p.team, NEXT).home ? 'vs' : 'en'} ${fixtureOf(p.team, NEXT).opp}</div></div><span class="xp">${f1(xp(p))}</span></div>`).join('') || '<p class="muted" style="margin:0">Sin suplentes.</p>'}</div>
        <hr class="sep">
        <div style="display:grid;gap:6px;font-size:14px">
          <div>${counts}</div>
          <div class="muted">Valor total: <b style="color:var(--ink)">${money(squadVal)}</b> · ${squad.length}/${MAX_SQUAD} jugadores</div>
        </div>
      </aside>
    </section>
    <section class="panel">
      <div class="panel-head"><h2 class="panel-title">Plantilla completa</h2><span class="panel-sub">Ordenada por posición y puntos esperados</span></div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>Jugador</th><th>Estado</th><th class="r">Valor</th><th class="r">Pts</th><th class="r">Media</th><th>Forma</th><th class="r">xP J${NEXT}</th><th>Próximos rivales</th><th></th></tr></thead>
        <tbody>${squad.map(p => { const m = metrics(p); return `<tr class="owned">
          <td>${pcell(p)}</td><td>${statusPill(p)}</td>
          <td class="r num">${money(m.value)}<div style="font-size:11px">${trendTxt(m.trend)}</div></td>
          <td class="r">${ptsBadge(m.total)}</td><td class="r num">${f1(m.avg)}</td><td>${formBars(p)}</td>
          <td class="r"><span class="xp">${f1(xp(p))}</span>${currentXI().includes(p.id) ? '' : ' <small class="muted">sup.</small>'}</td>
          <td>${fdrRow(p.team, 3)}</td><td>${addBtn(p)}</td></tr>`; }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  /* --- Calendario --- */
  function viewCalendario() {
    const js = range(NEXT, Math.min(38, NEXT + 4));
    const mineCount = id => state.squad.filter(pid => BY[pid].team === id).length;
    let teams = DB.TEAMS.map(t => ({ t, avg: sum(js, j => fdr(t.id, j)) / js.length, mine: mineCount(t.id) }));
    if (state.calOnlyMine) teams = teams.filter(x => x.mine);
    teams.sort((a, b) => a.avg - b.avg || b.mine - a.mine);
    const J = clamp(state.calJ, 1, 38);
    const played = J <= PLAYED;
    const list = played ? DB.simulateJornada(J).matches : DB.ROUNDS[J - 1];
    const myTeams = new Set(state.squad.map(id => BY[id].team));

    return `
    <section class="panel">
      <div class="panel-head">
        <div><h2 class="panel-title">Dificultad de los próximos partidos</h2><div class="panel-sub">Jornadas ${js[0]}–${js[js.length - 1]} · equipos ordenados de calendario más fácil a más difícil${js.some(j => DB.ROUNDS[j - 1][0].prov) ? ' · las jornadas marcadas con * son provisionales' : ''}</div></div>
        <button class="chip" aria-pressed="${state.calOnlyMine}" data-action="cal-only-mine">Solo equipos de mi plantilla</button>
      </div>
      <div class="legend" style="margin-bottom:12px">${[1, 2, 3, 4, 5].map(n => `<span><i style="background:var(--fdr${n})"></i>${n} · ${FDR_TXT[n]}</span>`).join('')}</div>
      <div class="table-wrap"><table class="t fdr-table">
        <thead><tr><th>Equipo</th>${js.map(j => `<th class="c">J${j}${DB.ROUNDS[j - 1][0].prov ? '*' : ''}<div style="font-weight:500;letter-spacing:0;text-transform:none">${dateTxt(DB.DATES[j - 1], { day: 'numeric', month: 'short' })}</div></th>`).join('')}<th class="r">Media</th></tr></thead>
        <tbody>${teams.map(({ t, avg, mine }) => `<tr class="${mine ? 'mine' : ''}">
          <td><span class="tname">${crest(t.id, true)}${esc(t.name)} ${mine ? `<span class="owncount" title="Jugadores en tu plantilla">${mine}</span>` : ''}</span></td>
          ${js.map(j => `<td class="c">${fdrChip(t.id, j)}</td>`).join('')}
          <td class="r"><span class="xp">${f1(avg)}</span></td></tr>`).join('') || `<tr><td colspan="${js.length + 2}" class="muted">No tienes jugadores en plantilla.</td></tr>`}</tbody>
      </table></div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div><h2 class="panel-title">${played ? 'Resultados' : 'Partidos'} · Jornada ${J}</h2><div class="panel-sub">${dateTxt(DB.DATES[J - 1], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${played ? '' : ' · pendiente'}</div></div>
        <div style="display:flex;gap:6px"><button class="btn btn-sm" data-action="cal-j" data-d="-1" ${J <= 1 ? 'disabled' : ''} aria-label="Jornada anterior">‹ J${J - 1}</button><button class="btn btn-sm" data-action="cal-j" data-d="1" ${J >= 38 ? 'disabled' : ''} aria-label="Jornada siguiente">J${J + 1} ›</button></div>
      </div>
      <div class="fixture-list" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))">${list.map(m => {
        const mine = myTeams.has(m.home) || myTeams.has(m.away);
        return `<div class="fixture${mine ? ' mine' : ''}"><div class="h"><span>${esc(team(m.home).name)}</span>${crest(m.home)}</div>
          <span class="score${played && m.hg !== null ? '' : ' vs'}">${played ? (m.hg !== null ? `${m.hg} - ${m.ag}` : '–') : 'vs'}</span>
          <div class="a">${crest(m.away)}<span>${esc(team(m.away).name)}</span></div></div>`;
      }).join('')}</div>
    </section>`;
  }

  /* --- Mercado --- */
  function viewMercado() {
    const mk = state.market;
    return `
    <section class="panel">
      <div class="panel-head"><div><h2 class="panel-title">Mercado de jugadores</h2><div class="panel-sub">Busca, filtra y añade jugadores a tu plantilla. «Pts/M€» mide puntos esperados en 3 jornadas por millón.</div></div></div>
      <div class="toolbar" style="margin-bottom:14px">
        <label class="field" style="flex:1 1 220px">Buscar<input id="mk-q" class="input" type="search" placeholder="Nombre del jugador" value="${esc(mk.q)}" autocomplete="off"></label>
        <div class="field">Posición<div class="chips" role="group" aria-label="Posición">${['ALL', ...POS].map(p => `<button class="chip" aria-pressed="${mk.pos === p}" data-action="market-pos" data-pos="${p}">${p === 'ALL' ? 'Todas' : p}</button>`).join('')}</div></div>
        <label class="field">Equipo<select id="mk-team" class="select"><option value="ALL">Todos</option>${DB.TEAMS.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${t.id}" ${mk.team === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <label class="field" style="width:120px">Precio máx. (M€)<input id="mk-max" class="input" type="number" min="0" step="0.5" value="${esc(mk.max)}" placeholder="Sin límite"></label>
      </div>
      <div class="table-wrap"><table class="t"><thead><tr id="mk-head"></tr></thead><tbody id="mk-body"></tbody></table></div>
      <div id="mk-foot" style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap"></div>
    </section>`;
  }
  const MK_COLS = [
    { k: 'name', t: 'Jugador' }, { k: 'status', t: 'Estado' }, { k: 'value', t: 'Valor', r: 1 }, { k: 'total', t: 'Pts', r: 1 },
    { k: 'avg', t: 'Media', r: 1 }, { k: 'form', t: 'Forma 3J', r: 1 }, { k: 'xp', t: `xP J${NEXT}`, r: 1 }, { k: 'ppm', t: 'Pts/M€', r: 1 },
    { k: null, t: 'Próximos' }, { k: null, t: '' }
  ];
  function marketRows() {
    const mk = state.market, q = DB.slug(mk.q);
    const max = parseFloat(mk.max);
    const key = {
      name: p => p.name, status: p => statusOf(p), value: p => metrics(p).value, total: p => metrics(p).total,
      avg: p => metrics(p).avg, form: p => metrics(p).form3, xp: p => xp(p), ppm: p => xpRange(p, 3) / metrics(p).value
    }[mk.sort] || (p => xp(p));
    return ALL.filter(p => (mk.pos === 'ALL' || p.pos === mk.pos) && (mk.team === 'ALL' || p.team === mk.team)
      && (!q || DB.slug(p.name).includes(q) || DB.slug(team(p.team).name).includes(q))
      && (isNaN(max) || metrics(p).value <= max))
      .sort((a, b) => { const A = key(a), B = key(b); return (typeof A === 'string' ? A.localeCompare(B) : A - B) * mk.dir; });
  }
  function updateMarket() {
    const mk = state.market, rows = marketRows();
    $('#mk-head').innerHTML = MK_COLS.map(c => c.k
      ? `<th class="sortable${c.r ? ' r' : ''}" data-action="sort" data-k="${c.k}" ${mk.sort === c.k ? `aria-sort="${mk.dir < 0 ? 'descending' : 'ascending'}"` : ''}>${c.t}${mk.sort === c.k ? (mk.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`
      : `<th>${c.t}</th>`).join('');
    $('#mk-body').innerHTML = rows.slice(0, mk.limit).map(p => { const m = metrics(p); return `<tr class="${inSquad(p.id) ? 'owned' : ''}">
      <td>${pcell(p)}</td><td>${statusPill(p)}</td><td class="r num">${money(m.value)}<div style="font-size:11px">${trendTxt(m.trend)}</div></td>
      <td class="r">${ptsBadge(m.total)}</td><td class="r num">${f1(m.avg)}</td><td class="r num">${f1(m.form3)}</td>
      <td class="r"><span class="xp">${f1(xp(p))}</span></td><td class="r num">${f1(xpRange(p, 3) / m.value)}</td>
      <td>${fdrRow(p.team, 3)}</td><td>${addBtn(p)}</td></tr>`; }).join('') || `<tr><td colspan="10" class="muted" style="padding:24px 8px">Ningún jugador coincide con los filtros. Prueba a quitar el precio máximo o a buscar por equipo.</td></tr>`;
    $('#mk-foot').innerHTML = `<span class="muted" style="font-size:13px">${Math.min(rows.length, mk.limit)} de ${rows.length} jugadores</span>
      ${rows.length > mk.limit ? '<button class="btn" data-action="market-more">Mostrar 40 más</button>' : ''}`;
  }

  /* --- Asistente --- */
  function swapSuggestions() {
    const budget = Number(state.budget) || 0;
    const owned = new Set(state.squad);
    const squad = state.squad.map(id => BY[id]);
    const weak = squad.slice().sort((a, b) => (unavailable(b) - unavailable(a)) || xpRange(a) - xpRange(b));
    const used = new Set(), out = [];
    for (const p of weak) {
      if (out.length >= 4) break;
      const money_ = budget + metrics(p).value;
      const cand = ALL.filter(c => c.pos === p.pos && !owned.has(c.id) && !used.has(c.id) && !unavailable(c) && metrics(c).value <= money_)
        .sort((a, b) => xpRange(b) - xpRange(a))[0];
      if (!cand) continue;
      const gain = xpRange(cand) - xpRange(p);
      if (gain < 1.5) continue;
      used.add(cand.id);
      out.push({ out: p, in: cand, gain, cost: metrics(cand).value - metrics(p).value });
    }
    return out;
  }
  function sellCandidates() {
    return state.squad.map(id => BY[id]).map(p => {
      const m = metrics(p);
      const hard = sum(range(NEXT, Math.min(38, NEXT + 2)), j => fdr(p.team, j)) / 3;
      const reasons = [];
      let score = (m.exp - m.form3) * 0.8 + (hard - 3) * 1.2 + m.value * 0.04;
      if (unavailable(p)) { score += 5; reasons.push(STATUS_TXT[statusOf(p)]); }
      if (m.form3 < m.exp - 1.5) reasons.push(`forma baja (${f1(m.form3)})`);
      if (hard >= 3.6) reasons.push('calendario duro');
      if (m.trend < -0.05) reasons.push('valor a la baja');
      return { p, score, reasons };
    }).filter(x => x.reasons.length).sort((a, b) => b.score - a.score).slice(0, 4);
  }
  function viewAsistente() {
    if (!state.squad.length) return emptySquad();
    const bf = bestFormation(state.squad), cur = xiTotal(currentXI());
    const swaps = swapSuggestions(), sells = sellCandidates();
    const bargains = ALL.filter(p => !inSquad(p.id) && !unavailable(p) && PLAYED).sort((a, b) => xpRange(b) / metrics(b).value - xpRange(a) / metrics(a).value).slice(0, 6);
    const slots = slotsOf(bf.f);
    const [a, b] = state.cmp.map(id => BY[id]).filter(Boolean);
    const options = ALL.slice().sort((x, y) => x.name.localeCompare(y.name)).map(p => `<option value="${esc(p.name)} · ${team(p.team).name}"></option>`).join('');

    return `
    <section class="grid">
      <div class="panel span-6">
        <div class="panel-head"><div><h2 class="panel-title">Once ideal · J${NEXT}</h2><div class="panel-sub">Formación ${bf.f} · ${f1(bf.total)} pts esperados ${bf.total - cur > 0.05 ? `(<span class="delta-up">+${f1(bf.total - cur)}</span> sobre tu once actual)` : '(ya es tu alineación)'}</div></div>
          <button class="btn btn-primary" data-action="apply-best" ${bf.total - cur > 0.05 ? '' : 'disabled'}>Aplicar</button></div>
        <div class="rank">${bf.xi.map((id, i) => {
          if (!id) return `<div class="rank-item"><span class="rank-n">${posTag(slots[i])}</span><span class="muted">Hueco libre: ficha un ${POS_NAME[slots[i]].toLowerCase()}</span><span></span></div>`;
          const p = BY[id];
          return `<div class="rank-item"><span>${posTag(p.pos)}</span><div style="display:flex;gap:10px;align-items:center;justify-content:space-between;min-width:0;flex-wrap:wrap">${pcell(p)}${fdrChip(p.team, NEXT)}</div><span class="xp">${f1(xp(p))}</span></div>`;
        }).join('')}</div>
      </div>
      <div class="span-6" style="display:grid;gap:20px;align-content:start">
        <div class="panel">
          <div class="panel-head"><div><h2 class="panel-title">Fichajes recomendados</h2><div class="panel-sub">Cambios que más mejoran tus puntos esperados en las 3 próximas jornadas</div></div>
            <label class="field" style="width:140px">Saldo disponible (M€)<input id="budget" class="input" type="number" step="0.1" value="${esc(state.budget)}"></label></div>
          <div style="display:grid;gap:8px">${swaps.map(s => `<div class="swap">
            <div style="min-width:0">${pcell(s.out)}</div><span class="swap-arrow" aria-hidden="true">→</span><div style="min-width:0">${pcell(s.in)}</div>
            <div class="swap-gain"><span class="delta-up">+${f1(s.gain)} xP</span><span class="muted" style="font-size:12px">${s.cost >= 0 ? 'cuesta ' + money(s.cost) : 'libera ' + money(-s.cost)}</span>
            <button class="btn btn-sm" data-action="swap-do" data-out="${s.out.id}" data-in="${s.in.id}">Hacer cambio</button></div></div>`).join('') || '<p class="muted" style="margin:0">Con este saldo no hay ningún cambio que mejore claramente tu equipo. Sube el saldo para ver más opciones.</p>'}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2 class="panel-title">Candidatos a vender</h2><span class="panel-sub">Bajas, mala forma o rivales duros</span></div>
          <div class="rank">${sells.map((x, i) => `<div class="rank-item"><span class="rank-n">${i + 1}</span><div style="min-width:0">${pcell(x.p)}<div class="pmeta" style="margin-top:2px">${esc(x.reasons.join(' · '))}</div></div><span class="num" style="font-weight:700">${money(metrics(x.p).value)}</span></div>`).join('') || '<p class="muted" style="margin:0">No hay ningún jugador que convenga vender ahora mismo.</p>'}</div>
        </div>
      </div>
      <div class="panel span-12">
        <div class="panel-head"><div><h2 class="panel-title">Chollos del mercado</h2><div class="panel-sub">Más puntos esperados por millón en las 3 próximas jornadas</div></div><button class="btn" data-action="tab" data-tab="mercado">Abrir mercado</button></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Jugador</th><th class="r">Valor</th><th class="r">Forma 3J</th><th class="r">xP 3J</th><th class="r">Pts/M€</th><th>Próximos</th><th></th></tr></thead>
        <tbody>${bargains.map(p => `<tr><td>${pcell(p)}</td><td class="r num">${money(metrics(p).value)}</td><td class="r num">${f1(metrics(p).form3)}</td><td class="r"><span class="xp">${f1(xpRange(p))}</span></td><td class="r num"><b>${f1(xpRange(p) / metrics(p).value)}</b></td><td>${fdrRow(p.team, 3)}</td><td>${addBtn(p)}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="panel span-12">
        <div class="panel-head"><div><h2 class="panel-title">Comparador</h2><div class="panel-sub">Enfrenta a dos jugadores antes de decidir</div></div></div>
        <datalist id="plist">${options}</datalist>
        <div class="compare" style="margin-bottom:14px">
          <input id="cmp-0" class="input" list="plist" placeholder="Jugador A" value="${a ? esc(a.name + ' · ' + team(a.team).name) : ''}">
          <span class="muted" style="font-family:var(--f-display);font-weight:800">VS</span>
          <input id="cmp-1" class="input" list="plist" placeholder="Jugador B" value="${b ? esc(b.name + ' · ' + team(b.team).name) : ''}">
        </div>
        <div id="cmp-out">${a && b ? compareHtml(a, b) : '<p class="muted">Elige dos jugadores.</p>'}</div>
      </div>
    </section>`;
  }
  function compareHtml(a, b) {
    const A = metrics(a), B = metrics(b);
    const rows = [
      ['Puntos', A.total, B.total, f0], ['Media', A.avg, B.avg, f1], ['Forma (3J)', A.form3, B.form3, f1],
      ['Partidos', A.apps, B.apps, f0], ['Goles', A.goals, B.goals, f0], ['Asistencias', A.assists, B.assists, f0],
      [`xP J${NEXT}`, xp(a), xp(b), f1], ['xP 3 jornadas', xpRange(a), xpRange(b), f1],
      ['Valor (menos es mejor)', -A.value, -B.value, v => money(-v)]
    ];
    const head = `<div class="cmp-row"><div style="justify-self:end">${pcell(a)}</div><span class="lab">${statusPill(a)} ${statusPill(b)}</span><div>${pcell(b)}</div></div>`;
    return head + rows.map(([lab, x, y, fmt]) => `<div class="cmp-row"><span class="l ${x > y ? 'win' : ''}">${fmt(x)}</span><span class="lab">${lab}</span><span class="rr ${y > x ? 'win' : ''}">${fmt(y)}</span></div>`).join('')
      + `<div class="cmp-row"><span style="justify-self:end">${fdrRow(a.team, 3)}</span><span class="lab">Próximos</span><span>${fdrRow(b.team, 3)}</span></div>`;
  }

  /* ---------------- Ficha de jugador ---------------- */
  let editing = false;
  function openPlayer(id) {
    const p = BY[id]; if (!p) return;
    const t = team(p.team), m = metrics(p), st = statusOf(p);
    const items = m.hist.map(h => ({
      label: 'J' + h.j, sub: (h.home ? '' : '@') + h.opp, v: h.played ? h.pts : 0, dnp: !h.played,
      tip: `<b>J${h.j} · ${h.home ? 'vs' : 'en'} ${esc(team(h.opp).name)}</b><br>${h.played ? `${h.pts} puntos${h.manual ? ' (manual)' : ''}<br>${h.min || 90}′ · ${h.g || 0} G · ${h.a || 0} A` : 'No jugó'}`
    }));
    const pos = state.squad.includes(id);
    const verdict = (() => {
      if (unavailable(p)) return ['Vender o esperar', `Está ${STATUS_TXT[st].toLowerCase()}. No puntuará en la J${NEXT}.`];
      const x3 = xpRange(p) / 3, gap = m.form3 - m.exp;
      if (gap > 2 && x3 > m.exp) return ['Imprescindible', 'En gran forma y con un calendario favorable. Alinéalo.'];
      if (x3 > m.exp + 0.5) return ['Alinear', 'Rinde a su nivel y los próximos rivales le favorecen.'];
      if (gap < -2.5) return ['En observación', 'Su forma reciente está muy por debajo de lo esperado.'];
      if (sum(range(NEXT, Math.min(38, NEXT + 2)), j => fdr(p.team, j)) >= 12) return ['Precaución', 'Le esperan rivales exigentes en las próximas jornadas.'];
      return ['Opción fiable', 'Rendimiento estable y sin alarmas.'];
    })();

    const dlg = $('#modal');
    dlg.innerHTML = `
      <div class="modal-head" style="--c1:${t.color};--c2:${t.color2}">
        ${jersey(p, 64)}
        <div style="min-width:0"><h2>${esc(p.name)}</h2>
          <div class="sub">${posTag(p.pos)} ${POS_NAME[p.pos]} · ${esc(t.name)}${p.num ? ` · #${p.num}` : ""} ${statusPill(p)} ${p.custom ? '<span class="status st-doubtful">Manual</span>' : ''}</div></div>
        <button class="modal-close" data-action="close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <div class="stat-strip">
          <div><span>Puntos</span><b>${f0(m.total)}</b></div><div><span>Media</span><b>${f1(m.avg)}</b></div>
          <div><span>Forma 3J</span><b>${f1(m.form3)}</b></div><div><span>Partidos</span><b>${m.apps}/${PLAYED}</b></div>
          <div><span>Goles</span><b>${m.goals}</b></div><div><span>Asist.</span><b>${m.assists}</b></div>
          <div><span>xP J${NEXT}</span><b style="color:var(--accent-ink)">${f1(xp(p))}</b></div><div><span>Valor</span><b>${f1(m.value)}<small style="font-size:14px"> M€</small></b></div>
        </div>
        <div class="verdict"><strong>${verdict[0]}</strong><span>${verdict[1]}</span></div>
        <div>
          <div class="panel-head"><h3 class="panel-title" style="font-size:18px">Puntos por jornada</h3>
            <div class="legend"><span><i style="background:var(--bar)"></i>Puntos</span><span><i style="background:var(--bar-neg)"></i>Negativos</span><span><i style="background:var(--line)"></i>No jugó</span></div></div>
          ${barChart(items, { avg: m.apps ? m.avg : undefined, label: 'Puntos por jornada de ' + p.name })}
        </div>
        <div class="two-col">
          <div><h3 class="panel-title" style="font-size:18px;margin-bottom:10px">Próximos 5 partidos</h3>
            <div class="next-fix">${range(NEXT, Math.min(38, NEXT + 4)).map(j => fdrChip(p.team, j, true)).join('')}</div>
            <p class="muted" style="font-size:13px;margin:10px 0 0">Puntos esperados: ${range(NEXT, Math.min(38, NEXT + 4)).map(j => `J${j} <b style="color:var(--ink)">${f1(xp(p, j))}</b>`).join(' · ')}</p></div>
          <div><h3 class="panel-title" style="font-size:18px;margin-bottom:4px">Valor de mercado</h3>
            ${lineChart(m.values, ['Inicio', ...range(1, PLAYED).map(j => 'J' + j)], { label: 'Evolución del valor de ' + p.name })}</div>
        </div>
        <div>
          <div class="panel-head"><h3 class="panel-title" style="font-size:18px">Desglose</h3>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="edit-actions">${editActions()}</div></div>
          <div class="table-wrap" style="margin:0 -20px;padding:0 20px"><table class="t"><thead><tr><th>Jornada</th><th>Rival</th><th class="c">Res.</th><th class="r">Min</th><th class="r">G</th><th class="r">A</th><th class="c">P. cero</th><th class="c">Tarj.</th><th class="r">Puntos</th></tr></thead>
            <tbody>${m.hist.slice().reverse().map(h => { const r = matchResult(h.j, p.team); const gf = r ? (r.home === p.team ? r.hg : r.ag) : null, ga = r ? (r.home === p.team ? r.ag : r.hg) : null;
              const res = r && r.hg !== null ? `<span class="${gf > ga ? 'delta-up' : gf < ga ? 'delta-down' : 'muted'}">${gf}-${ga}</span>` : '';
              return `<tr><td>J${h.j}</td><td><span class="pcell">${crest(h.opp)} ${h.home ? 'vs' : 'en'} ${esc(team(h.opp).name)}</span></td><td class="c num">${res}</td>
              <td class="r num">${h.played ? (h.min || 90) + '′' : '—'}</td><td class="r num">${h.played ? h.g || 0 : ''}</td><td class="r num">${h.played ? h.a || 0 : ''}</td>
              <td class="c">${h.cs ? '✓' : ''}</td><td class="c">${h.rc ? '🟥' : h.yc ? '🟨' : ''}</td>
              <td class="r">${editing ? `<input class="input edit-pts" type="number" data-j="${h.j}" value="${h.played ? h.pts : ''}" placeholder="—" aria-label="Puntos J${h.j}">` : (h.played ? ptsBadge(h.pts) : '<span class="muted">—</span>') + (h.manual ? '<span class="manual-mark" title="Introducido a mano">M</span>' : '')}</td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">Sin jornadas disputadas.</td></tr>'}</tbody></table></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;justify-content:space-between">
          <label class="field">Estado físico<select id="status-sel" class="select" data-id="${p.id}">${Object.entries(STATUS_TXT).map(([k, v]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <button class="btn ${pos ? 'btn-danger' : 'btn-primary'}" data-action="toggle-squad" data-id="${p.id}">${pos ? 'Quitar de mi plantilla' : 'Añadir a mi plantilla'}</button>
        </div>
      </div>`;
    dlg.dataset.player = id;
    if (!dlg.open) dlg.showModal();
  }
  function editActions() {
    return editing
      ? '<button class="btn btn-sm" data-action="cancel-edit">Cancelar</button><button class="btn btn-sm btn-primary" data-action="save-pts">Guardar puntos</button>'
      : '<button class="btn btn-sm" data-action="edit-pts">Corregir puntos</button>';
  }

  /* ---------------- Selector de hueco ---------------- */
  function openPicker(i) {
    const slots = slotsOf(state.formation), pos = slots[i], xi = currentXI();
    const cands = state.squad.map(id => BY[id]).filter(p => p.pos === pos).sort((a, b) => xp(b) - xp(a));
    const dlg = $('#modal');
    dlg.dataset.player = '';
    dlg.innerHTML = `<div class="modal-body">
      <div class="panel-head" style="margin:0"><div><h2 class="panel-title">Elegir ${POS_NAME[pos].toLowerCase()}</h2><div class="panel-sub">Ordenados por puntos esperados en la J${NEXT}</div></div><button class="btn btn-ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>
      <div class="pick-list">${cands.map(p => `<button class="pick-item${xi[i] === p.id ? ' current' : ''}" data-action="pick" data-i="${i}" data-id="${p.id}">
        <span class="pcell">${crest(p.team)}<span class="pcell-text"><b>${esc(p.name)}</b><span class="pmeta">${STATUS_TXT[statusOf(p)]} · ${xi.includes(p.id) && xi[i] !== p.id ? 'ya es titular (se intercambian)' : xi[i] === p.id ? 'en este hueco' : 'suplente'}</span></span></span>
        ${fdrChip(p.team, NEXT)}<span class="xp">${f1(xp(p))}</span></button>`).join('') || `<p class="muted">No tienes ${POS_PLURAL[pos].toLowerCase()} en la plantilla.</p>`}
        ${xi[i] ? `<button class="btn btn-ghost" data-action="pick" data-i="${i}" data-id="">Dejar el hueco vacío</button>` : ''}
        <button class="btn" data-action="tab" data-tab="mercado" data-close="1" data-pos="${pos}">Buscar ${POS_PLURAL[pos].toLowerCase()} en el mercado</button></div></div>`;
    if (!dlg.open) dlg.showModal();
  }

  /* ---------------- Datos: exportar, importar, API ---------------- */
  function openData() {
    const dlg = $('#modal');
    dlg.dataset.player = '';
    const exportJson = JSON.stringify({ squad: state.squad, formation: state.formation, lineup: state.lineup, overrides: state.overrides, statusOv: state.statusOv, valueOv: state.valueOv, custom: state.custom, budget: state.budget }, null, 1);
    dlg.innerHTML = `<div class="modal-body">
      <div class="panel-head" style="margin:0"><div><h2 class="panel-title">Gestionar datos</h2><div class="panel-sub">Tus cambios se guardan en este navegador</div></div><button class="btn btn-ghost" data-action="close-modal" aria-label="Cerrar">✕</button></div>

      <section style="display:grid;gap:10px"><h3 class="panel-title" style="font-size:18px">Datos oficiales de LaLiga Fantasy</h3>
        ${state.official ? `<p class="status st-ok" style="justify-self:start">Cargados el ${new Date(state.official.fetchedAt).toLocaleString('es-ES')} · ${state.official.matched} enlazados, ${state.official.added} nuevos</p>` : ''}
        <ol class="steps">
          <li>En tu ordenador, abre la carpeta <code>fantasy</code> del proyecto y haz doble clic en <code>sincronizar.bat</code> (Windows) o ejecuta <code>python3 sincronizar.py</code> (Mac/Linux).</li>
          <li>El programa descarga precios, posiciones, estado y puntos de cada jornada y crea el archivo <code>datos-oficiales.json</code>.</li>
          <li>Si abres la app desde esa carpeta (<code>index.html</code>) se carga sola. Si la usas desde el enlace, pulsa el botón y elige ese archivo.</li>
        </ol>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label class="btn btn-primary" style="cursor:pointer">Cargar datos-oficiales.json<input id="official-file" type="file" accept=".json,application/json" hidden></label>
          <span id="official-msg" class="muted" style="font-size:13px"></span></div></section>
      <hr class="sep">

      <section style="display:grid;gap:8px"><h3 class="panel-title" style="font-size:18px">Añadir un jugador que falta</h3>
        <form id="custom-form" class="toolbar">
          <label class="field" style="flex:1 1 180px">Nombre<input id="cu-name" class="input" required placeholder="Ej.: Fermín López"></label>
          <label class="field">Equipo<select id="cu-team" class="select">${DB.TEAMS.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
          <label class="field">Posición<select id="cu-pos" class="select">${POS.map(p => `<option value="${p}">${POS_NAME[p]}</option>`).join('')}</select></label>
          <label class="field" style="width:100px">Valor (M€)<input id="cu-val" class="input" type="number" step="0.1" min="0.1" value="2"></label>
          <button class="btn btn-primary" type="submit">Añadir a mi plantilla</button>
        </form></section>
      <hr class="sep">

      <section style="display:grid;gap:8px"><h3 class="panel-title" style="font-size:18px">Copia de seguridad</h3>
        <p class="muted" style="margin:0;font-size:14px">Copia este texto para guardar tu plantilla y tus correcciones, o pega aquí una copia (o carga un archivo .json) para recuperarla.</p>
        <textarea id="data-json" class="input" rows="6" style="font-family:ui-monospace,Menlo,monospace;font-size:12px;width:100%;resize:vertical">${esc(exportJson)}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn" data-action="copy-json">Copiar</button>
          <button class="btn btn-primary" data-action="import-json">Importar el texto</button>
          <label class="btn" style="cursor:pointer">Cargar archivo<input id="data-file" type="file" accept=".json,application/json" hidden></label>
          <span id="data-msg" class="muted" style="font-size:13px"></span>
        </div></section>
      <hr class="sep">

      <section style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-danger" data-action="clear-squad">Vaciar mi plantilla</button>
        <button class="btn btn-danger" data-action="reset-all">Restablecer todo</button>
      </section></div>`;
    if (!dlg.open) dlg.showModal();
  }
  function applyImport(obj) {
    if (obj && obj.source === 'laliga-fantasy') { applyOfficial(obj); return; }
    if (obj && obj.source === 'laliga-fantasy-liga') { applyLeague(obj); return; }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.squad)) throw new Error('El texto no tiene el formato de una copia de Pizarra Fantasy (falta "squad").');
    ['squad', 'formation', 'lineup', 'overrides', 'statusOv', 'valueOv', 'custom', 'budget'].forEach(k => { if (obj[k] !== undefined) state[k] = obj[k]; });
    if (!FORMATIONS.includes(state.formation)) state.formation = '4-3-3';
    state.example = false;
  }

  /* ---------------- Datos oficiales (generados por sincronizar.py) ---------------- */
  const POS_OK = new Set(POS), ST_OK = new Set(Object.keys(STATUS_TXT));
  const words = s => norm(s).split(/[\s.\-']+/).filter(w => w.length > 1);
  function matchLocal(o, used, pool) {
    const cands = (pool || DB.PLAYERS).filter(p => (!o.team || p.team === o.team) && !used.has(p.id));
    const nn = norm(o.nick), nf = norm(o.name || o.nick);
    let c = cands.filter(p => { const n = norm(p.name); return n === nn || n === nf; });
    if (c.length !== 1) c = cands.filter(p => { const n = norm(p.name); return (' ' + nf + ' ').includes(' ' + n + ' ') || (' ' + n + ' ').includes(' ' + nn + ' '); });
    if (c.length !== 1) { const last = words(o.nick).pop(); c = last ? cands.filter(p => words(p.name).includes(last)) : []; }
    if (c.length !== 1) { const first = words(o.nick)[0]; c = first ? cands.filter(p => words(p.name)[0] === first) : []; }
    return c.length === 1 ? c[0] : null;
  }
  function applyOfficial(data) {
    if (!data || data.source !== 'laliga-fantasy' || !Array.isArray(data.players)) throw new Error('El archivo no es un datos-oficiales.json válido.');
    const week = Math.max(0, Math.min(38, Number(data.week) || 0));
    const used = new Set();
    let matched = 0, added = 0;
    state.posOv = state.posOv || {};
    data.players.forEach(o => {
      if (!DB.TEAM[o.team] || !POS_OK.has(o.pos)) return;
      const local = matchLocal(o, used);
      let id;
      if (local) { id = local.id; used.add(id); matched++; }
      else {
        id = 'lf-' + o.fid;
        const value = Math.max(0.1, Number(o.value) || 0.2);
        const q = clamp(Math.round(Math.log(value / 0.17) / Math.log(1.8)), 1, 10);
        const c = { id, team: o.team, name: o.nick || o.name, pos: o.pos, q, value, status: 'ok' };
        const i = state.custom.findIndex(x => x.id === id);
        if (i >= 0) state.custom[i] = c; else { state.custom.push(c); added++; }
      }
      (state.fidMap = state.fidMap || {})[o.fid] = id;
      if (Number(o.value) > 0) state.valueOv[id] = Number(o.value);
      if (ST_OK.has(o.status)) state.statusOv[id] = o.status;
      if (local) { if (o.pos !== local.pos) state.posOv[id] = o.pos; else delete state.posOv[id]; }
      const ov = {};
      const wk = o.weeks || {};
      for (let j = 1; j <= week; j++) {
        const v = wk[j];
        ov[j] = Array.isArray(v) ? v : typeof v === 'number' ? [v, 90, 0, 0] : 'x';
      }
      state.overrides[id] = ov;
    });
    if (data.fixtures && typeof data.fixtures === 'object') { state.officialFixtures = data.fixtures; DB.setFixtures(data.fixtures); }
    if (week) { state.officialWeek = week; DB.setMinPlayed(week); }
    state.official = { fetchedAt: data.fetchedAt || new Date().toISOString(), players: data.players.length, matched, added, week };
    computeWeeks(); rebuild(); memo.clear(); save(); render();
    $('#md-label').innerHTML = `<b>J${NEXT}</b><span>${dateTxt(DB.DATES[NEXT - 1])}</span>`;
    toast(`Datos oficiales cargados: ${matched} enlazados, ${added} nuevos`);
    return state.official;
  }


  /* ---------------- Mi liga privada (generado por sincronizar.py --liga) ---------------- */
  function resolvePlayer(o) {
    state.fidMap = state.fidMap || {};
    const known = state.fidMap[o.fid];
    if (known && (DB.PLAYERS.some(p => p.id === known) || state.custom.some(c => c.id === known))) return known;
    if (!DB.TEAM[o.team] || !POS_OK.has(o.pos)) return null;
    const local = matchLocal(o, new Set());
    let id;
    if (local) id = local.id;
    else {
      id = 'lf-' + o.fid;
      if (!state.custom.some(c => c.id === id)) {
        const value = Math.max(0.1, Number(o.value) || 0.2);
        state.custom.push({ id, team: o.team, name: o.nick || o.name, pos: o.pos, q: clamp(Math.round(Math.log(value / 0.17) / Math.log(1.8)), 1, 10), value, status: 'ok' });
      }
    }
    state.fidMap[o.fid] = id;
    if (Number(o.value) > 0) state.valueOv[id] = Number(o.value);
    if (ST_OK.has(o.status)) state.statusOv[id] = o.status;
    if (local && o.pos !== local.pos) (state.posOv = state.posOv || {})[id] = o.pos;
    return id;
  }
  function applyLeague(data) {
    if (!data || data.source !== 'laliga-fantasy-liga' || !Array.isArray(data.leagues)) throw new Error('El archivo no es un datos-liga.json válido.');
    data.leagues.forEach(lg => {
      (lg.market || []).forEach(m => { m.id = resolvePlayer(m); });
      (lg.teams || []).forEach(t => (t.players || []).forEach(p => { p.id = resolvePlayer(p); }));
    });
    state.league = data;
    if (!data.leagues.some(l => l.id === state.leagueSel)) state.leagueSel = data.leagues[0] ? data.leagues[0].id : null;
    rebuild(); memo.clear(); save(); render();
    toast(`Liga cargada: ${data.leagues.map(l => l.name).join(', ')}`);
  }
  const relTime = iso => {
    if (!iso) return '—';
    const ms = new Date(iso).getTime() - Date.now();
    if (!isFinite(ms)) return '—';
    if (ms <= 0) return 'ya';
    const h = Math.round(ms / 36e5);
    return h < 24 ? `en ${h} h` : `en ${Math.round(h / 24)} d`;
  };
  const locked = p => p.clauseLockEnd && new Date(p.clauseLockEnd).getTime() > Date.now();

  function ligaHelp(first) {
    return `<section class="panel" style="display:grid;gap:14px">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Opción avanzada</span><h2 class="panel-title">Con el programa y tu token</h2>
        <div class="panel-sub">Mercado del día, plantillas de tus rivales, cláusulas y saldo. Se descargan con tu sesión, solo en tu ordenador.</div></div></div>
      <ol class="steps">
        <li>En el ordenador, entra en la <b>web de LaLiga Fantasy</b> con Chrome o Edge (no en la app del móvil) e inicia sesión.</li>
        <li>Pulsa <kbd>F12</kbd>, abre la pestaña <b>Red</b> (Network) y recarga con <kbd>F5</kbd>. En el filtro escribe <code>api-fantasy</code>.</li>
        <li>Pulsa cualquier petición de la lista. En <b>Encabezados → Encabezados de solicitud</b> busca <code>authorization: Bearer eyJ…</code> y copia todo lo que va después de <code>Bearer</code>.</li>
        <li>En la carpeta <code>fantasy</code>, haz doble clic en <code>sincronizar-liga.bat</code>, pega el token (clic derecho; no se verá) y pulsa Enter.</li>
        <li>Abre <code>index.html</code> de esa carpeta (se carga solo) o pulsa aquí abajo y elige <code>datos-liga.json</code>.</li>
      </ol>
      <p class="notice" style="margin:0"><span><b>Tu token es como tu contraseña</b> durante unas horas: no lo pegues en ningún chat (tampoco aquí) ni lo subas a GitHub. Caduca solo; si el programa dice que está caducado, cópialo otra vez.</span></p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="btn btn-primary" style="cursor:pointer">Cargar datos-liga.json<input id="league-file" type="file" accept=".json,application/json" hidden></label>
        <span id="league-msg" class="muted" style="font-size:13px"></span></div>
    </section>`;
  }

  function viewLiga() {
    const L = state.league;
    if (!L || !L.leagues || !L.leagues.length) return capturePanel() + ligaHelp(true);
    const lg = L.leagues.find(l => l.id === state.leagueSel) || L.leagues[0];
    const mine = (state.myTeam || {})[lg.id];
    const market = (lg.market || []).map(m => ({ m, p: BY[m.id] })).filter(x => x.p)
      .map(x => Object.assign(x, { x3: xpRange(x.p), ppm: xpRange(x.p) / Math.max(0.1, x.m.price) }))
      .sort((a, b) => b.ppm - a.ppm);
    const best = market.filter(x => !unavailable(x.p)).slice(0, 3).map(x => x.m.id);
    const verdict = x => {
      if (unavailable(x.p)) return `<span class="status st-injured">${STATUS_TXT[statusOf(x.p)]}</span>`;
      if (best.includes(x.m.id) && x.x3 >= 10 && x.m.price <= x.m.value * 1.05) return '<span class="status st-ok">Chollo</span>';
      if (x.m.price > x.m.value * 1.15) return '<span class="status st-doubtful">Caro</span>';
      return '<span class="muted">—</span>';
    };
    const teams = (lg.teams || []).slice().sort((a, b) => a.position - b.position);
    const targets = teams.filter(t => t.id !== mine).flatMap(t => (t.players || []).map(pl => ({ t, pl, p: BY[pl.id] })))
      .filter(x => x.p && x.pl.clause > 0 && !locked(x.pl) && !unavailable(x.p))
      .map(x => Object.assign(x, { x3: xpRange(x.p), ppm: xpRange(x.p) / x.pl.clause }))
      .sort((a, b) => b.ppm - a.ppm).slice(0, 8);
    const myT = teams.find(t => t.id === mine);
    const diff = (a, b) => { const d = (a - b) / Math.max(0.1, b) * 100; return Math.abs(d) < 1 ? '<span class="muted">=</span>' : `<span class="${d > 0 ? 'delta-down' : 'delta-up'}">${d > 0 ? '+' : ''}${f0(d)}%</span>`; };

    return capturePanel() + `
    <section class="panel">
      <div class="panel-head" style="margin:0">
        <div><span class="eyebrow">Liga privada</span><h2 class="hero-title" style="font-size:clamp(26px,4vw,40px)">${esc(lg.name)}</h2>
          <div class="panel-sub">Datos del ${new Date(L.fetchedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · ${teams.length} equipos · ${market.length} jugadores en el mercado</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${L.leagues.length > 1 ? `<div class="chips">${L.leagues.map(l => `<button class="chip" aria-pressed="${l.id === lg.id}" data-action="league-sel" data-id="${esc(l.id)}">${esc(l.name)}</button>`).join('')}</div>` : ''}
          <label class="btn" style="cursor:pointer">Actualizar<input id="league-file" type="file" accept=".json,application/json" hidden></label>
        </div>
      </div>
      ${myT ? `<div class="kpis" style="margin-top:16px">
        <div class="kpi"><div class="kpi-label">Tu posición</div><div class="kpi-value">${myT.position}º</div><div class="kpi-foot">de ${teams.length} · ${f0(myT.points)} pts</div></div>
        <div class="kpi"><div class="kpi-label">Tu saldo</div><div class="kpi-value">${myT.money !== null && myT.money !== undefined ? f1(myT.money) : '—'}<small>M€</small></div><div class="kpi-foot">según la liga</div></div>
        <div class="kpi"><div class="kpi-label">Valor de tu equipo</div><div class="kpi-value">${f1(myT.value)}<small>M€</small></div><div class="kpi-foot">${(myT.players || []).length} jugadores</div></div>
        <div class="kpi"><div class="kpi-label">Al líder</div><div class="kpi-value">${myT.position === 1 ? '—' : f0(teams[0].points - myT.points)}</div><div class="kpi-foot">${myT.position === 1 ? '¡vas primero!' : 'puntos de diferencia'}</div></div>
      </div>` : `<p class="notice" style="margin:16px 0 0"><span>Dinos cuál es tu equipo: abre tu fila en <b>Clasificación</b> y pulsa <b>«Es mi equipo»</b>. Se cargarán tu plantilla y tu saldo.</span></p>`}
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2 class="panel-title">Mercado de hoy</h2><div class="panel-sub">Ordenado por puntos esperados en 3 jornadas por cada millón del precio de venta</div></div></div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>Jugador</th><th>Vende</th><th class="r">Valor</th><th class="r">Precio</th><th class="r">Forma 3J</th><th class="r">xP J${NEXT}</th><th class="r">xP 3J</th><th class="r">Pts/M€</th><th>Próximos</th><th class="r">Pujas</th><th>Acaba</th><th></th><th></th></tr></thead>
        <tbody>${market.map(x => `<tr class="${inSquad(x.p.id) ? 'owned' : ''}">
          <td>${pcell(x.p)}</td><td>${esc(x.m.seller)}</td><td class="r num">${money(x.m.value)}</td>
          <td class="r num"><b>${money(x.m.price)}</b><div style="font-size:11px">${diff(x.m.price, x.m.value)}</div></td>
          <td class="r num">${f1(metrics(x.p).form3)}</td><td class="r"><span class="xp">${f1(xp(x.p))}</span></td><td class="r num">${f1(x.x3)}</td>
          <td class="r num"><b>${f1(x.ppm)}</b></td><td>${fdrRow(x.p.team, 3)}</td><td class="r num">${x.m.bids || 0}</td>
          <td class="num">${relTime(x.m.expires)}</td><td>${verdict(x)}</td><td>${addBtn(x.p)}</td></tr>`).join('') || '<tr><td colspan="13" class="muted" style="padding:20px 8px">No hay jugadores en el mercado de esta liga.</td></tr>'}</tbody>
      </table></div>
    </section>

    <section class="grid">
      <div class="panel span-7">
        <div class="panel-head"><div><h2 class="panel-title">Clasificación</h2><div class="panel-sub">Abre un equipo para ver sus jugadores y cláusulas</div></div></div>
        <div class="league-teams">${teams.map(t => `<details class="lteam${t.id === mine ? ' mine' : ''}">
          <summary><span class="rank-n">${t.position}</span><span class="lteam-name">${esc(t.manager)}${t.id === mine ? ' <span class="owncount">Tú</span>' : ''}</span>
            <span class="lteam-stats"><b class="num">${f0(t.points)} pts</b><span class="num">${money(t.value)}${t.money !== null && t.money !== undefined ? ` · saldo ${money(t.money)}` : ''}</span></span></summary>
          <div class="lteam-body">
            ${t.id === mine ? '' : `<button class="btn btn-sm btn-primary" data-action="my-team" data-id="${esc(t.id)}">Es mi equipo</button>`}
            <div class="table-wrap" style="margin:0;padding:0"><table class="t"><thead><tr><th>Jugador</th><th class="r">Valor</th><th class="r">Cláusula</th><th class="r">xP 3J</th><th>Cláusula</th></tr></thead>
            <tbody>${(t.players || []).map(pl => { const p = BY[pl.id]; if (!p) return ''; return `<tr><td>${pcell(p)}</td><td class="r num">${money(pl.value)}</td>
              <td class="r num">${pl.clause ? money(pl.clause) : '—'}</td><td class="r num">${f1(xpRange(p))}</td>
              <td>${locked(pl) ? `<span class="status st-doubtful">Bloqueada ${relTime(pl.clauseLockEnd)}</span>` : '<span class="status st-ok">Libre</span>'}</td></tr>`; }).join('')}</tbody></table></div>
          </div></details>`).join('')}</div>
      </div>
      <div class="panel span-5">
        <div class="panel-head"><div><h2 class="panel-title">Cláusulas a por las que ir</h2><div class="panel-sub">Rivales con la cláusula libre · más puntos por millón</div></div></div>
        <div class="rank">${targets.map((x, i) => `<div class="rank-item"><span class="rank-n">${i + 1}</span>
          <div style="min-width:0">${pcell(x.p)}<div class="pmeta" style="margin-top:2px">de ${esc(x.t.manager)} · cláusula <b>${money(x.pl.clause)}</b> · ${f1(x.x3)} xP en 3J</div></div>
          <span class="xp">${f1(x.ppm)}</span></div>`).join('') || '<p class="muted" style="margin:0">No hay cláusulas libres interesantes ahora mismo.</p>'}</div>
      </div>
    </section>`;
  }


  /* ---------------- Sincronizar con capturas (Claude lee las imágenes) ---------------- */
  let sampleFn = null, sampleImg = null, sampleState = 'loading', shotCtl = null, shotPending = null;
  (async () => {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') { sampleState = 'outside'; return; }
      const s = await window.claude.use('sample');
      if (s) {
        sampleFn = s;
        const lim = await s.limits().catch(() => null);
        sampleImg = lim && lim.images ? lim.images : null;
      }
      sampleState = sampleFn && sampleImg ? 'ready' : 'none';
    } catch (e) { sampleState = 'none'; }
    if (state.tab === 'liga') render();
  })();

  const SHOT_PROMPT = () => `Estas imágenes son capturas de pantalla de la app LaLiga Fantasy (temporada 2026/27) de un usuario y su liga privada con amigos. Para CADA imagen, en el mismo orden, extrae lo que se ve.
Tipos de pantalla: "mercado" (jugadores a la venta, con precio), "plantilla" (jugadores de un mánager, con valor y/o cláusula), "otro" (cualquier otra cosa).
Códigos de equipo: ${DB.TEAMS.map(t => t.id + '=' + t.name).join(', ')}.
Importes en millones de euros como número con decimales (12.345.678 € -> 12.35; 850.000 € -> 0.85).
Responde SOLO con un array JSON, un objeto por imagen, así:
[{"kind":"mercado","manager":null,"mine":false,"money":null,"points":null,"players":[{"name":"Pedri","team":"BAR","pos":"CEN","value":45.2,"price":47.0,"clause":null,"seller":"Mercado","bids":2}]}]
Reglas: name tal como aparece; team con el código (deduce el club por el escudo o el texto); pos POR/DEF/CEN/DEL si se ve, si no null; value = valor de mercado; price = precio de venta en el mercado; clause = cláusula de rescisión; seller = quién lo vende ("Mercado" si es la liga); manager = dueño de la plantilla si aparece; mine = true si es el equipo del propio usuario ("Mi equipo", "Mi plantilla", "Alineación"); money = saldo si aparece; points = puntos totales del mánager si aparecen. No inventes nada: null en lo que no se vea.`;

  function findByName(name, team) {
    const o = { nick: String(name || ''), name: String(name || ''), team: DB.TEAM[team] ? team : null };
    if (!o.nick.trim()) return null;
    let p = o.team ? matchLocal(o, new Set(), ALL) : null;
    if (!p) { const r = searchPlayers(o.nick, 2); if (r.total === 1 || (r.list[0] && norm(r.list[0].name) === norm(o.nick))) p = r.list[0]; }
    return p || null;
  }
  const num = v => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v));

  async function readShots(files) {
    const msg = $('#shot-msg');
    const say = t => { const m = $('#shot-msg'); if (m) m.textContent = t; };
    if (!sampleFn || !sampleImg) { say('Esta función solo funciona en la web publicada en claude.ai.'); return; }
    const imgs = Array.from(files).filter(f => sampleImg.mediaTypes.includes(f.type));
    if (!imgs.length) { say('Elige imágenes (PNG o JPG).'); return; }
    const screens = [];
    shotCtl = new AbortController();
    $('#shot-stop').hidden = false;
    try {
      for (let i = 0; i < imgs.length; i += sampleImg.maxCount) {
        const chunk = imgs.slice(i, i + sampleImg.maxCount);
        say(`Leyendo ${chunk.length === imgs.length ? chunk.length : `${i + 1}-${i + chunk.length} de ${imgs.length}`} captura(s)… puede tardar hasta un minuto.`);
        const res = await sampleFn.json(SHOT_PROMPT(), { images: chunk, signal: shotCtl.signal });
        (Array.isArray(res) ? res : [res]).forEach(sc => { if (sc && typeof sc === 'object') screens.push(sc); });
      }
    } catch (e) {
      const copy = {
        cancelled: 'Lectura cancelada.', not_granted: 'Para leer capturas tienes que permitir que la página use Claude.',
        rate_limited: 'Demasiadas lecturas seguidas o límite de uso alcanzado. Prueba en un rato.',
        image_rejected: 'Alguna imagen no se ha podido leer. Prueba con otra captura (PNG o JPG).',
        invalid_json: 'No he entendido bien las capturas. Vuelve a intentarlo o súbelas de una en una.',
        refused: 'No se han podido leer esas imágenes.'
      };
      say(copy[e && e.code] || 'Ha fallado la lectura. Vuelve a intentarlo.');
      const st = $('#shot-stop'); if (st) st.hidden = true;
      if (!screens.length) return;
    }
    const st = $('#shot-stop'); if (st) st.hidden = true;
    shotPending = screens.map(sc => ({
      kind: ['mercado', 'plantilla'].includes(sc.kind) ? sc.kind : 'otro',
      manager: sc.manager ? String(sc.manager) : null, mine: !!sc.mine,
      money: num(sc.money), points: num(sc.points),
      rows: (Array.isArray(sc.players) ? sc.players : []).map(r => {
        const p = findByName(r.name, r.team);
        return { read: String(r.name || '?'), team: r.team, id: p ? p.id : null, value: num(r.value), price: num(r.price), clause: num(r.clause), seller: r.seller ? String(r.seller) : null, bids: num(r.bids) || 0 };
      })
    })).filter(sc => sc.kind !== 'otro' && sc.rows.length);
    say(shotPending.length ? 'Revisa lo que he leído y pulsa «Guardar».' : 'No he encontrado ni mercado ni plantillas en esas capturas.');
    const box = $('#shot-review'); if (box) box.innerHTML = shotReviewHtml();
  }

  function shotReviewHtml() {
    if (!shotPending || !shotPending.length) return '';
    const ok = shotPending.reduce((a, sc) => a + sc.rows.filter(r => r.id).length, 0);
    const all = shotPending.reduce((a, sc) => a + sc.rows.length, 0);
    return `<div class="shot-review">${shotPending.map((sc, si) => `
      <div class="shot-screen"><div class="panel-head" style="margin:0 0 6px">
        <b>${sc.kind === 'mercado' ? 'Mercado' : `Plantilla${sc.manager ? ' de ' + esc(sc.manager) : ''}${sc.mine ? ' (tu equipo)' : ''}`}</b>
        <span class="muted" style="font-size:12px">${sc.rows.length} jugadores${sc.money !== null ? ` · saldo ${money(sc.money)}` : ''}</span></div>
        ${sc.kind === 'plantilla' && !sc.mine ? `<label class="field" style="max-width:260px">Mánager<input class="input shot-manager" data-si="${si}" value="${esc(sc.manager || '')}" placeholder="Nombre de tu amigo"></label>` : ''}
        <div class="table-wrap" style="margin:0;padding:0"><table class="t"><tbody>${sc.rows.map(r => {
          const p = r.id && BY[r.id];
          return `<tr><td>${p ? pcell(p) : `<span class="status st-injured">No reconocido</span> ${esc(r.read)}`}</td>
            <td class="r num">${r.value !== null ? 'valor ' + money(r.value) : ''}</td>
            <td class="r num">${r.price !== null ? '<b>' + money(r.price) + '</b>' : r.clause !== null ? 'cláusula ' + money(r.clause) : ''}</td>
            <td class="muted">${r.seller ? esc(r.seller) : ''}</td></tr>`;
        }).join('')}</tbody></table></div></div>`).join('')}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" data-action="shots-save">Guardar ${ok} de ${all} jugadores</button>
        <button class="btn btn-ghost" data-action="shots-cancel">Descartar</button>
        ${ok < all ? '<span class="muted" style="font-size:13px">Los no reconocidos se ignoran; si falta alguno, añádelo en Datos.</span>' : ''}</div></div>`;
  }

  function saveShots() {
    if (!shotPending) return;
    $$('.shot-manager').forEach(inp => { const sc = shotPending[Number(inp.dataset.si)]; if (sc) sc.manager = inp.value.trim() || sc.manager; });
    if (!state.league || !state.league.leagues || !state.league.leagues.length) {
      state.league = { source: 'manual', leagues: [{ id: 'manual', name: 'Mi liga', market: [], teams: [] }] };
      state.leagueSel = 'manual';
    }
    const lg = state.league.leagues.find(l => l.id === state.leagueSel) || state.league.leagues[0];
    lg.market = lg.market || []; lg.teams = lg.teams || [];
    const toRow = r => { const p = BY[r.id]; return { id: r.id, nick: p.name, team: p.team, pos: p.pos, value: r.value !== null ? r.value : metrics(p).value, price: r.price, clause: r.clause, seller: r.seller || 'Mercado', bids: r.bids, expires: null, clauseLockEnd: null }; };
    const marketRows = shotPending.filter(sc => sc.kind === 'mercado').flatMap(sc => sc.rows.filter(r => r.id).map(r => Object.assign(r, { price: r.price !== null ? r.price : r.value })).filter(r => r.price !== null));
    if (marketRows.length) {
      const seen = new Set();
      lg.market = marketRows.filter(r => !seen.has(r.id) && seen.add(r.id)).map(toRow);
    }
    shotPending.filter(sc => sc.kind === 'plantilla').forEach(sc => {
      const rows = sc.rows.filter(r => r.id);
      if (!rows.length) return;
      const mgr = sc.mine ? (sc.manager || 'Yo') : (sc.manager || 'Rival ' + (lg.teams.length + 1));
      let t = lg.teams.find(x => (sc.mine && x.id === (state.myTeam || {})[lg.id]) || norm(x.manager) === norm(mgr));
      if (!t) { t = { id: 'm-' + DB.slug(mgr) + '-' + Date.now().toString(36), manager: mgr, position: lg.teams.length + 1, points: 0, value: 0, money: null, players: [] }; lg.teams.push(t); }
      const prev = Object.fromEntries((t.players || []).map(p => [p.id, p]));
      t.players = rows.map(r => Object.assign({}, prev[r.id] || {}, toRow(r), { clause: r.clause !== null ? r.clause : (prev[r.id] ? prev[r.id].clause : null) }));
      if (sc.points !== null) t.points = sc.points;
      if (sc.money !== null) t.money = sc.money;
      t.value = sum(t.players, p => p.value);
      if (sc.mine) {
        state.myTeam = Object.assign({}, state.myTeam, { [lg.id]: t.id });
        state.squad = [...new Set(t.players.map(p => p.id))].slice(0, MAX_SQUAD);
        state.lineup = null; state.example = false;
        if (t.money !== null) state.budget = t.money;
      }
    });
    lg.teams.sort((a, b) => b.points - a.points).forEach((t, i) => { t.position = i + 1; });
    // Los valores que se ven en las capturas son los oficiales de hoy
    shotPending.forEach(sc => sc.rows.forEach(r => { if (r.id && r.value) state.valueOv[r.id] = r.value; }));
    state.league.fetchedAt = new Date().toISOString();
    shotPending = null;
    memo.clear(); save(); render();
    toast('Capturas guardadas en Mi liga');
  }

  function capturePanel() {
    const can = sampleFn && sampleImg;
    return `<section class="panel capture">
      <div class="capture-text">
        <span class="eyebrow">Lo más fácil · sin token</span>
        <h2 class="panel-title">Sincronizar con capturas</h2>
        <p class="panel-sub" style="margin:4px 0 0">En la app de LaLiga Fantasy haz capturas del <b>Mercado</b>, de <b>tu equipo</b> y de los <b>equipos de tus amigos</b> (con las cláusulas). Súbelas aquí todas a la vez: Claude las lee y rellena el mercado, los precios, las cláusulas y tu saldo.</p>
      </div>
      <div class="capture-actions">
        ${can ? `<label class="btn btn-primary" style="cursor:pointer">Subir capturas<input id="shots" type="file" accept="${sampleImg.mediaTypes.join(',')}" multiple hidden></label>
          <button id="shot-stop" class="btn btn-ghost" data-action="shots-stop" hidden>Parar</button>`
        : `<span class="muted" style="font-size:13px">${{ outside: 'Abre la web publicada en claude.ai para usar esta función.', none: 'Aquí no se pueden leer imágenes. Ábrela en claude.ai con tu cuenta.', loading: 'Preparando…' }[sampleState] || ''}</span>`}
        <span id="shot-msg" class="muted" style="font-size:13px">${can ? 'Usa tu cuenta de Claude; la primera vez te pedirá permiso.' : ''}</span>
      </div>
      <div id="shot-review" style="grid-column:1/-1">${shotReviewHtml()}</div>
    </section>`;
  }

  /* ---------------- Buscador con sugerencias ---------------- */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function searchPlayers(query, limit = 8) {
    const q = norm(query).trim();
    if (!q) return { list: [], total: 0 };
    const tokens = q.split(/\s+/);
    const isNum = /^\d{1,2}$/.test(q);
    const scored = [];
    ALL.forEach(p => {
      const n = norm(p.name), t = norm(team(p.team).name) + ' ' + p.team.toLowerCase();
      if (isNum) { if (String(p.num) === q) scored.push({ p, s: 0 }); return; }
      let s = 0;
      for (const tk of tokens) {
        if (n.startsWith(tk)) s += 0;
        else if (n.split(/[\s.\-']+/).some(w => w.startsWith(tk))) s += 1;
        else if (n.includes(tk)) s += 2;
        else if (t.split(/\s+/).some(w => w.startsWith(tk))) s += 3;
        else return;
      }
      scored.push({ p, s });
    });
    scored.sort((a, b) => a.s - b.s || b.p.q - a.p.q || a.p.name.localeCompare(b.p.name));
    return { list: scored.slice(0, limit).map(x => x.p), total: scored.length };
  }
  function highlight(name, query) {
    const nq = norm(query).trim();
    if (!nq || /^\d+$/.test(nq)) return esc(name);
    const n = norm(name);
    const marks = new Array(name.length).fill(false);
    nq.split(/\s+/).forEach(tk => {
      let i = -1;
      const re = new RegExp('(^|[\\s.\\-\'])' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = re.exec(n);
      if (m) i = m.index + m[1].length; else i = n.indexOf(tk);
      if (i >= 0) for (let k = i; k < i + tk.length && k < marks.length; k++) marks[k] = true;
    });
    let out = '', open = false;
    for (let i = 0; i < name.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; }
      if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += esc(name[i]);
    }
    return out + (open ? '</mark>' : '');
  }
  const searchState = {};
  function renderSuggestions(input) {
    const box = input.closest('.psearch'), pop = box.querySelector('.psearch-pop');
    const q = input.value;
    const nq = norm(q).trim();
    const ss = searchState[input.id] = searchState[input.id] || { active: 0 };
    if (nq.length < 2 && !/^\d$/.test(nq)) {
      pop.hidden = true; input.setAttribute('aria-expanded', 'false');
      if (nq.length === 1) { pop.hidden = false; pop.innerHTML = '<p class="sug-empty">Escribe una letra más…</p>'; }
      return;
    }
    const { list, total } = searchPlayers(q, 8);
    ss.ids = list.map(p => p.id);
    ss.active = clamp(ss.active, 0, Math.max(0, list.length - 1));
    pop.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (!list.length) {
      pop.innerHTML = `<p class="sug-empty">No hay ningún jugador de LaLiga con «${esc(q)}».<br><button class="link" data-action="open-data">Añadir uno a mano</button></p>`;
      return;
    }
    pop.innerHTML = `<div class="sug-head"><span>${total === 1 ? '1 jugador' : `${total} jugadores`}${total > list.length ? ` · mostrando ${list.length}` : ''}</span><span class="sug-keys">↑↓ elegir · Enter ficha · + plantilla</span></div>`
      + `<div role="listbox" id="${input.id}-list">` + list.map((p, i) => {
        const m = metrics(p), own = inSquad(p.id);
        return `<div class="sug${own ? ' own' : ''}" role="option" id="${input.id}-opt-${i}" aria-selected="${i === ss.active}" data-action="sug-open" data-id="${p.id}" data-input="${input.id}">
          ${crest(p.team)}
          <div class="sug-main"><span class="sug-name">${highlight(p.name, q)}</span>
            <span class="pmeta">${posTag(p.pos)} ${esc(team(p.team).name)}${p.num ? ` · <span class="num">#${p.num}</span>` : ''} · ${STATUS_TXT[statusOf(p)]}</span></div>
          <div class="sug-stats"><b class="num">${money(m.value)}</b><span class="num">${f1(m.avg)} pts/partido</span></div>
          <button class="add-btn${own ? ' owned' : ''}" data-action="sug-toggle" data-id="${p.id}" data-input="${input.id}" aria-label="${own ? 'Quitar' : 'Añadir'} ${esc(p.name)}" title="${own ? 'En tu plantilla (pulsa para quitar)' : 'Añadir a mi plantilla'}">${own ? '✓' : '+'}</button>
        </div>`;
      }).join('') + '</div>';
    input.setAttribute('aria-activedescendant', `${input.id}-opt-${ss.active}`);
  }
  function closeSuggestions(except) {
    $$('.psearch').forEach(b => {
      const inp = b.querySelector('input');
      if (inp === except) return;
      b.querySelector('.psearch-pop').hidden = true; inp.setAttribute('aria-expanded', 'false');
    });
  }
  function restoreSearch(inputId, value) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    inp.value = value; inp.focus();
    renderSuggestions(inp);
  }
  const searchBox = (id, placeholder, big) => `
    <div class="psearch${big ? ' big' : ''}">
      <svg class="psearch-ico" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m13 13 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="${id}" class="psearch-input" type="search" autocomplete="off" spellcheck="false" placeholder="${placeholder}" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" aria-label="Buscar jugador">
      <div class="psearch-pop" hidden></div>
    </div>`;

  /* ---------------- Acciones ---------------- */
  function toggleSquad(id) {
    const p = BY[id];
    if (inSquad(id)) {
      state.squad = state.squad.filter(x => x !== id);
      if (state.lineup) state.lineup = state.lineup.map(x => (x === id ? null : x));
      toast(`${p.name} sale de tu plantilla`);
    } else {
      if (state.squad.length >= MAX_SQUAD) { toast(`Máximo ${MAX_SQUAD} jugadores en plantilla`); return; }
      state.squad.push(id);
      const slots = slotsOf(state.formation), xi = currentXI();
      const i = xi.findIndex((x, k) => !x && slots[k] === p.pos);
      if (i >= 0) xi[i] = id;
      toast(`${p.name} añadido a tu plantilla`);
    }
    state.example = false;
  }
  let toastT;
  function toast(t) {
    let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2400);
  }
  function setTab(t) {
    if (!VIEWS[t]) return;
    state.tab = t;
    try { history.replaceState(null, '', '#' + t); } catch (e) { /* sin historial */ }
    render();
    window.scrollTo({ top: 0 });
  }
  let confirmArm = null;
  function armed(key, btn, text) {
    if (confirmArm === key) { confirmArm = null; return true; }
    confirmArm = key; btn.textContent = text; setTimeout(() => { if (confirmArm === key) confirmArm = null; }, 4000);
    return false;
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    const dlg = $('#modal');
    if (!e.target.closest('.psearch')) closeSuggestions();
    if (!el) { if (e.target === dlg) dlg.close(); return; }
    const a = el.dataset.action, id = el.dataset.id;
    const refreshModal = () => { if (dlg.open && dlg.dataset.player) openPlayer(dlg.dataset.player); };
    switch (a) {
      case 'tab': if (el.dataset.close && dlg.open) dlg.close(); if (el.dataset.pos) { state.market.pos = el.dataset.pos; state.market.limit = 40; } setTab(el.dataset.tab); break;
      case 'player': editing = false; openPlayer(id); break;
      case 'sug-open': closeSuggestions(); editing = false; openPlayer(id); break;
      case 'sug-toggle': {
        const inp = document.getElementById(el.dataset.input), val = inp ? inp.value : '';
        toggleSquad(id); render(); restoreSearch(el.dataset.input, val); break;
      }
      case 'close-modal': dlg.close(); break;
      case 'toggle-squad': toggleSquad(id); render(); refreshModal(); break;
      case 'formation': state.formation = el.dataset.f; state.lineup = bestXI(state.formation, state.squad); render(); break;
      case 'auto-xi': state.lineup = bestXI(state.formation, state.squad); toast('Once optimizado'); render(); break;
      case 'apply-best': { const bf = bestFormation(state.squad); if (bf) { state.formation = bf.f; state.lineup = bf.xi; toast(`Alineación ${bf.f} aplicada`); } render(); break; }
      case 'slot': openPicker(Number(el.dataset.i)); break;
      case 'pick': {
        const i = Number(el.dataset.i), xi = currentXI().slice(), pid = el.dataset.id || null;
        const j = pid ? xi.indexOf(pid) : -1;
        if (j >= 0 && j !== i) xi[j] = xi[i];
        xi[i] = pid; state.lineup = xi; dlg.close(); render(); break;
      }
      case 'shots-stop': if (shotCtl) shotCtl.abort(); break;
      case 'shots-cancel': shotPending = null; { const b = $('#shot-review'); if (b) b.innerHTML = ''; } break;
      case 'shots-save': saveShots(); break;
      case 'league-sel': state.leagueSel = id; render(); break;
      case 'my-team': {
        const lg = state.league.leagues.find(l => l.id === state.leagueSel) || state.league.leagues[0];
        const t = lg.teams.find(x => x.id === id);
        state.myTeam = Object.assign({}, state.myTeam, { [lg.id]: id });
        state.squad = [...new Set((t.players || []).map(p => p.id).filter(Boolean))].slice(0, MAX_SQUAD);
        state.lineup = null; state.example = false;
        if (t.money !== null && t.money !== undefined) state.budget = t.money;
        toast(`Plantilla de ${t.manager} cargada como la tuya`); render(); break;
      }
      case 'hide-notice': state.noticeHidden = true; render(); break;
      case 'open-data': openData(); break;
      case 'cal-only-mine': state.calOnlyMine = !state.calOnlyMine; render(); break;
      case 'cal-j': state.calJ = clamp(state.calJ + Number(el.dataset.d), 1, 38); render(); break;
      case 'market-pos': state.market.pos = el.dataset.pos; state.market.limit = 40; $$('[data-action="market-pos"]').forEach(c => c.setAttribute('aria-pressed', String(c === el))); updateMarket(); save(); break;
      case 'market-more': state.market.limit += 40; updateMarket(); break;
      case 'sort': { const k = el.dataset.k; if (state.market.sort === k) state.market.dir *= -1; else { state.market.sort = k; state.market.dir = k === 'name' || k === 'status' ? 1 : -1; } updateMarket(); save(); break; }
      case 'edit-pts': editing = true; refreshModal(); break;
      case 'cancel-edit': editing = false; refreshModal(); break;
      case 'save-pts': {
        const pid = dlg.dataset.player; const ov = {};
        const sim = BY[pid].custom ? {} : null;
        $$('.edit-pts', dlg).forEach(inp => {
          const j = Number(inp.dataset.j), v = inp.value.trim();
          const auto = sim ? null : DB.simulateJornada(j).stats[pid];
          if (v === '') return;
          if (auto && Number(v) === auto.pts && !(state.overrides[pid] && state.overrides[pid][j] !== undefined)) return;
          ov[j] = Number(v);
        });
        if (Object.keys(ov).length) state.overrides[pid] = ov; else delete state.overrides[pid];
        editing = false; memo.clear(); save(); toast('Puntos guardados'); render(); openPlayer(pid); break;
      }
      case 'swap-do': {
        const o = el.dataset.out, n = el.dataset.in;
        state.budget = Math.round(((Number(state.budget) || 0) + metrics(BY[o]).value - metrics(BY[n]).value) * 10) / 10;
        state.squad = state.squad.map(x => (x === o ? n : x));
        if (state.lineup) state.lineup = state.lineup.map(x => (x === o ? n : x));
        state.example = false; toast(`Fichado ${BY[n].name}, vendido ${BY[o].name}`); render(); break;
      }
      case 'copy-json': {
        const ta = $('#data-json');
        const fallback = () => { ta.select(); $('#data-msg').textContent = 'Texto seleccionado: cópialo con Ctrl+C / Cmd+C.'; };
        try { navigator.clipboard.writeText(ta.value).then(() => { $('#data-msg').textContent = 'Copiado al portapapeles.'; }, fallback); } catch (err) { fallback(); }
        break;
      }
      case 'import-json':
        try { applyImport(JSON.parse($('#data-json').value)); memo.clear(); render(); dlg.close(); toast('Copia importada'); }
        catch (err) { $('#data-msg').textContent = err instanceof SyntaxError ? 'El texto no es un JSON válido. Revisa que esté completo.' : err.message; }
        break;
      case 'clear-squad': if (armed('clear', el, 'Pulsa otra vez para vaciar')) { state.squad = []; state.lineup = null; state.example = false; dlg.close(); render(); toast('Plantilla vaciada'); } break;
      case 'clear-squad-direct': state.squad = []; state.lineup = null; state.example = false; setTab('equipo'); { const v = $('#vsearch'); if (v) v.focus(); } toast('Escribe dos letras y añade a tus jugadores con +'); break;
      case 'focus-search': { const v = $('#vsearch') || $('#gsearch'); if (v) { v.focus(); v.scrollIntoView({ block: 'center' }); } break; }
      case 'reset-all': if (armed('reset', el, 'Pulsa otra vez para borrarlo todo')) { state = defaults(); dlg.close(); render(); toast('Datos restablecidos'); } break;
    }
  });

  let qT;
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.classList && t.classList.contains('psearch-input')) { (searchState[t.id] = searchState[t.id] || {}).active = 0; renderSuggestions(t); return; }
    if (t.id === 'mk-q') { clearTimeout(qT); qT = setTimeout(() => { state.market.q = t.value; state.market.limit = 40; updateMarket(); save(); }, 120); }
    if (t.id === 'mk-max') { state.market.max = t.value; updateMarket(); save(); }
    if (t.id === 'budget') { state.budget = Number(t.value) || 0; save(); clearTimeout(qT); qT = setTimeout(() => { const pos = t.selectionStart; render(); const b = $('#budget'); if (b) { b.focus(); try { b.setSelectionRange(pos, pos); } catch (er) { /* number input */ } } }, 500); }
    if (t.id === 'cmp-0' || t.id === 'cmp-1') {
      const p = ALL.find(x => `${x.name} · ${team(x.team).name}` === t.value || x.name.toLowerCase() === t.value.toLowerCase());
      if (p) { state.cmp[t.id === 'cmp-0' ? 0 : 1] = p.id; save(); const [a, b] = state.cmp.map(i => BY[i]); $('#cmp-out').innerHTML = a && b ? compareHtml(a, b) : ''; }
    }
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !$('#modal').open) { e.preventDefault(); $('#gsearch').focus(); return; }
    if (!t.classList || !t.classList.contains('psearch-input')) return;
    const ss = searchState[t.id] || { active: 0, ids: [] };
    const n = (ss.ids || []).length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); ss.active = (ss.active + 1) % n; renderSuggestions(t); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); ss.active = (ss.active - 1 + n) % n; renderSuggestions(t); }
    else if (e.key === 'Enter' && n) { e.preventDefault(); const id = ss.ids[ss.active]; if (e.shiftKey || e.ctrlKey || e.metaKey) { const v = t.value; toggleSquad(id); render(); restoreSearch(t.id, v); } else { closeSuggestions(); openPlayer(id); } }
    else if (e.key === 'Escape') { t.value = ''; closeSuggestions(); }
  });
  document.addEventListener('focusin', e => { const t = e.target; if (t.classList && t.classList.contains('psearch-input') && t.value) renderSuggestions(t); });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'mk-team') { state.market.team = t.value; state.market.limit = 40; updateMarket(); save(); }
    if (t.id === 'status-sel') { const p = BY[t.dataset.id]; if (t.value === p.status) delete state.statusOv[p.id]; else state.statusOv[p.id] = t.value; memo.clear(); render(); openPlayer(p.id); toast('Estado actualizado'); }
    if (t.id === 'premium-toggle') {
      state.premium = t.checked;
      if (!state.premium && FORMATIONS_PREM.includes(state.formation)) { state.formation = '4-3-3'; state.lineup = bestXI('4-3-3', state.squad); }
      render(); toast(state.premium ? 'Formaciones premium activadas' : 'Formaciones premium desactivadas');
    }
    if (t.id === 'shots' && t.files.length) { readShots(t.files); t.value = ''; }
    if (t.id === 'league-file' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try { applyLeague(JSON.parse(r.result)); }
        catch (err) { const m = $('#league-msg'); const txt = err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message; if (m) m.textContent = txt; else toast(txt); }
      };
      r.readAsText(t.files[0]);
    }
    if (t.id === 'official-file' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try { const res = applyOfficial(JSON.parse(r.result)); openData(); $('#official-msg').textContent = `Listo: ${res.matched} jugadores enlazados y ${res.added} añadidos.`; }
        catch (err) { $('#official-msg').textContent = err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message; }
      };
      r.readAsText(t.files[0]);
    }
    if (t.id === 'data-file' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => { $('#data-json').value = r.result; $('#data-msg').textContent = 'Archivo cargado. Pulsa «Importar el texto».'; };
      r.readAsText(t.files[0]);
    }
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'custom-form') return;
    e.preventDefault();
    const name = $('#cu-name').value.trim(); if (!name) return;
    const teamId = $('#cu-team').value, pos = $('#cu-pos').value, value = Math.max(0.1, Number($('#cu-val').value) || 1);
    const id = 'custom-' + teamId.toLowerCase() + '-' + DB.slug(name) + '-' + Date.now().toString(36);
    const q = clamp(Math.round(Math.log(value / 0.28) / Math.log(1.64)), 1, 10);
    state.custom.push({ id, team: teamId, name, pos, q, value, status: 'ok' });
    rebuild(); toggleSquad(id); render(); $('#modal').close();
    toast(`${name} creado. Introduce sus puntos desde su ficha.`);
  });
  $('#modal').addEventListener('close', () => { editing = false; });

  /* ---------------- Tooltip ---------------- */
  const tip = document.createElement('div'); tip.id = 'tip'; tip.hidden = true; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  let tipEl = null;
  function showTip(el) {
    tipEl = el; tip.innerHTML = el.getAttribute('data-tip'); tip.hidden = false;
    const r = el.getBoundingClientRect();
    let x = r.left + r.width / 2; const y = Math.max(r.top, 8);
    const w = tip.offsetWidth; x = clamp(x, w / 2 + 8, window.innerWidth - w / 2 - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    if (r.top - tip.offsetHeight - 12 < 0) { tip.style.transform = 'translate(-50%, 10px)'; tip.style.top = r.bottom + 'px'; } else tip.style.transform = '';
  }
  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && el !== tipEl) showTip(el); else if (!el && tipEl) { tip.hidden = true; tipEl = null; } });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); });
  document.addEventListener('focusout', () => { tip.hidden = true; tipEl = null; });
  window.addEventListener('scroll', () => { tip.hidden = true; tipEl = null; }, { passive: true });

  /* ---------------- Arranque ---------------- */
  $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $('#data-btn').addEventListener('click', openData);
  $('#gsearch-slot').outerHTML = searchBox('gsearch', 'Buscar jugador…');
  if (state.officialFixtures) DB.setFixtures(state.officialFixtures);
  if (state.officialWeek) DB.setMinPlayed(state.officialWeek);
  computeWeeks();
  rebuild();
  const OD = window.OFFICIAL_DATA;
  if (OD && OD.source === 'laliga-fantasy' && (!state.official || String(OD.fetchedAt) > String(state.official.fetchedAt))) {
    try { applyOfficial(OD); } catch (e) { /* datos locales dañados: se ignoran */ }
  }
  const LD = window.LEAGUE_DATA;
  if (LD && LD.source === 'laliga-fantasy-liga' && (!state.league || String(LD.fetchedAt) > String(state.league.fetchedAt))) {
    try { applyLeague(LD); } catch (e) { /* se ignora */ }
  }

  $('#md-label').innerHTML = `<b>J${NEXT}</b><span>${dateTxt(DB.DATES[NEXT - 1])}</span>`;
  const h = (location.hash || '').slice(1);
  if (VIEWS[h]) state.tab = h;
  rebuild();
  render();
})();
