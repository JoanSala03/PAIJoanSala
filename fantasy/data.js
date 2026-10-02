/* ==========================================================================
   Pizarra Fantasy · base de datos y motor de simulación
   --------------------------------------------------------------------------
   Equipos de LaLiga EA Sports 2026/27 y plantillas de referencia.
   El calendario, los resultados y las puntuaciones se generan con un motor
   determinista (misma semilla = mismos datos) para que la app funcione sin
   conexión. Cualquier puntuación se puede corregir a mano desde la ficha del
   jugador o importando un JSON con datos reales.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- Equipos (str = nivel global 0-100) ---------- */
  const TEAMS = [
    { id: 'ALA', name: 'Alavés',          color: '#1f4fa3', color2: '#ffffff', str: 63 },
    { id: 'ATH', name: 'Athletic Club',   color: '#d71f2b', color2: '#ffffff', str: 78 },
    { id: 'ATM', name: 'Atlético',        color: '#cb3524', color2: '#1d3a8a', str: 86 },
    { id: 'BAR', name: 'Barcelona',       color: '#a50044', color2: '#004d98', str: 94 },
    { id: 'BET', name: 'Real Betis',      color: '#0b9444', color2: '#ffffff', str: 76 },
    { id: 'CEL', name: 'Celta',           color: '#8ac3ee', color2: '#d4002f', str: 70 },
    { id: 'DEP', name: 'Deportivo',       color: '#1b4ea0', color2: '#ffffff', str: 63 },
    { id: 'ELC', name: 'Elche',           color: '#0a7a3c', color2: '#ffffff', str: 62 },
    { id: 'ESP', name: 'Espanyol',        color: '#1a7bc7', color2: '#ffffff', str: 66 },
    { id: 'GET', name: 'Getafe',          color: '#0055a5', color2: '#ffffff', str: 64 },
    { id: 'LEV', name: 'Levante',         color: '#a3132b', color2: '#123a7a', str: 60 },
    { id: 'MAL', name: 'Málaga',          color: '#4a8fd1', color2: '#ffffff', str: 60 },
    { id: 'OSA', name: 'Osasuna',         color: '#c8102e', color2: '#0a2240', str: 67 },
    { id: 'RAC', name: 'Racing',          color: '#118847', color2: '#ffffff', str: 61 },
    { id: 'RAY', name: 'Rayo Vallecano',  color: '#e30613', color2: '#ffffff', str: 68 },
    { id: 'RMA', name: 'Real Madrid',     color: '#d8b55a', color2: '#2b2b6b', str: 93 },
    { id: 'RSO', name: 'Real Sociedad',   color: '#0067b1', color2: '#ffffff', str: 72 },
    { id: 'SEV', name: 'Sevilla',         color: '#d4021d', color2: '#ffffff', str: 66 },
    { id: 'VAL', name: 'Valencia',        color: '#f39200', color2: '#1a1a1a', str: 66 },
    { id: 'VIL', name: 'Villarreal',      color: '#f5d000', color2: '#00529f', str: 80 }
  ];

  /* ---------- Plantillas de referencia: [equipo, nombre, posición, calidad 1-10] ---------- */
  const RAW = [
    ['RMA','Courtois','POR',9],['RMA','Carvajal','DEF',6],['RMA','Militão','DEF',7],['RMA','Huijsen','DEF',8],
    ['RMA','Alexander-Arnold','DEF',7],['RMA','Álvaro Carreras','DEF',7],['RMA','Valverde','CEN',8],['RMA','Bellingham','CEN',9],
    ['RMA','Tchouaméni','CEN',7],['RMA','Arda Güler','CEN',8],['RMA','Mastantuono','CEN',6],['RMA','Mbappé','DEL',10],
    ['RMA','Vinícius Jr.','DEL',9],['RMA','Rodrygo','DEL',7],
    ['BAR','Joan García','POR',9],['BAR','Koundé','DEF',8],['BAR','Cubarsí','DEF',8],['BAR','Araujo','DEF',6],
    ['BAR','Balde','DEF',7],['BAR','Eric García','DEF',6],['BAR','Pedri','CEN',9],['BAR','Frenkie de Jong','CEN',7],
    ['BAR','Fermín López','CEN',7],['BAR','Gavi','CEN',6],['BAR','Dani Olmo','CEN',7],['BAR','Lamine Yamal','DEL',10],
    ['BAR','Raphinha','DEL',9],['BAR','Ferran Torres','DEL',7],
    ['ATM','Oblak','POR',8],['ATM','Le Normand','DEF',6],['ATM','Giménez','DEF',6],['ATM','Hancko','DEF',7],
    ['ATM','Marcos Llorente','DEF',7],['ATM','Koke','CEN',6],['ATM','Pablo Barrios','CEN',7],['ATM','Álex Baena','CEN',8],
    ['ATM','Julián Álvarez','DEL',9],['ATM','Sørloth','DEL',7],['ATM','Giuliano Simeone','DEL',7],
    ['ATH','Unai Simón','POR',7],['ATH','Dani Vivian','DEF',6],['ATH','Laporte','DEF',6],['ATH','Yuri Berchiche','DEF',5],
    ['ATH','Gorosabel','DEF',5],['ATH','Oihan Sancet','CEN',7],['ATH','Jauregizar','CEN',6],['ATH','Nico Williams','DEL',8],
    ['ATH','Iñaki Williams','DEL',6],['ATH','Guruzeta','DEL',6],['ATH','Berenguer','DEL',6],
    ['VIL','Luiz Júnior','POR',6],['VIL','Mouriño','DEF',6],['VIL','Renato Veiga','DEF',6],['VIL','Pedraza','DEF',6],
    ['VIL','Parejo','CEN',6],['VIL','Comesaña','CEN',6],['VIL','Moleiro','CEN',7],['VIL','Nicolas Pépé','DEL',7],
    ['VIL','Gerard Moreno','DEL',7],['VIL','Mikautadze','DEL',7],['VIL','Ayoze Pérez','DEL',7],
    ['BET','Pau López','POR',6],['BET','Bellerín','DEF',5],['BET','Natan','DEF',6],['BET','Ricardo Rodríguez','DEF',5],
    ['BET','Isco','CEN',7],['BET','Pablo Fornals','CEN',7],['BET','Lo Celso','CEN',7],['BET','Antony','DEL',8],
    ['BET','Abde','DEL',7],['BET','Cucho Hernández','DEL',7],
    ['RSO','Remiro','POR',7],['RSO','Aramburu','DEF',5],['RSO','Zubeldia','DEF',6],['RSO','Sergio Gómez','DEF',6],
    ['RSO','Brais Méndez','CEN',6],['RSO','Turrientes','CEN',5],['RSO','Take Kubo','DEL',7],['RSO','Oyarzabal','DEL',8],
    ['RSO','Barrenetxea','DEL',6],
    ['CEL','Radu','POR',5],['CEL','Mingueza','DEF',6],['CEL','Starfelt','DEF',5],['CEL','Javi Rodríguez','DEF',5],
    ['CEL','Ilaix Moriba','CEN',6],['CEL','Fran Beltrán','CEN',5],['CEL','Iago Aspas','DEL',6],['CEL','Borja Iglesias','DEL',7],
    ['CEL','Williot Swedberg','DEL',6],['CEL','Bryan Zaragoza','DEL',6],
    ['SEV','Vlachodimos','POR',6],['SEV','Azpilicueta','DEF',5],['SEV','Kike Salas','DEF',5],['SEV','José Ángel Carmona','DEF',5],
    ['SEV','Agoumé','CEN',5],['SEV','Djibril Sow','CEN',5],['SEV','Rubén Vargas','DEL',6],['SEV','Isaac Romero','DEL',6],
    ['SEV','Akor Adams','DEL',6],
    ['VAL','Dimitrievski','POR',6],['VAL','Gayà','DEF',6],['VAL','Tárrega','DEF',6],['VAL','Foulquier','DEF',5],
    ['VAL','Pepelu','CEN',6],['VAL','Javi Guerra','CEN',7],['VAL','Diego López','DEL',7],['VAL','Hugo Duro','DEL',7],
    ['VAL','Arnaut Danjuma','DEL',6],['VAL','Luis Rioja','DEL',6],
    ['OSA','Sergio Herrera','POR',6],['OSA','Catena','DEF',6],['OSA','Rosier','DEF',5],['OSA','Abel Bretones','DEF',5],
    ['OSA','Moncayola','CEN',5],['OSA','Lucas Torró','CEN',5],['OSA','Aimar Oroz','CEN',6],['OSA','Rubén García','DEL',6],
    ['OSA','Ante Budimir','DEL',7],['OSA','Víctor Muñoz','DEL',6],
    ['GET','David Soria','POR',7],['GET','Djené','DEF',6],['GET','Domingos Duarte','DEF',5],['GET','Juan Iglesias','DEF',5],
    ['GET','Luis Milla','CEN',6],['GET','Arambarri','CEN',5],['GET','Borja Mayoral','DEL',6],['GET','Adrián Liso','DEL',6],
    ['RAY','Augusto Batalla','POR',7],['RAY','Lejeune','DEF',6],['RAY','Ratiu','DEF',6],['RAY','Pep Chavarría','DEF',5],
    ['RAY','Isi Palazón','CEN',7],['RAY','Unai López','CEN',5],['RAY','Óscar Valentín','CEN',5],['RAY','Álvaro García','DEL',6],
    ['RAY','Jorge de Frutos','DEL',6],['RAY','Alemão','DEL',6],
    ['ESP','Dmitrovic','POR',6],['ESP','Omar El Hilali','DEF',5],['ESP','Leandro Cabrera','DEF',5],['ESP','Carlos Romero','DEF',5],
    ['ESP','Edu Expósito','CEN',6],['ESP','Pol Lozano','CEN',5],['ESP','Pere Milla','CEN',5],['ESP','Roberto Fernández','DEL',6],
    ['ESP','Kike García','DEL',6],['ESP','Javi Puado','DEL',6],
    ['ALA','Antonio Sivera','POR',6],['ALA','Nahuel Tenaglia','DEF',5],['ALA','Jon Pacheco','DEF',5],['ALA','Jonny Otto','DEF',5],
    ['ALA','Jon Guridi','CEN',6],['ALA','Antonio Blanco','CEN',5],['ALA','Carlos Vicente','DEL',6],['ALA','Toni Martínez','DEL',6],
    ['ALA','Lucas Boyé','DEL',6],
    ['ELC','Matías Dituro','POR',5],['ELC','Pedro Bigas','DEF',5],['ELC','Affengruber','DEF',5],['ELC','Álvaro Núñez','DEF',5],
    ['ELC','Aleix Febas','CEN',5],['ELC','Marc Aguado','CEN',5],['ELC','Rafa Mir','DEL',6],['ELC','André Silva','DEL',6],
    ['ELC','Germán Valera','DEL',5],
    ['LEV','Mathew Ryan','POR',5],['LEV','Unai Elgezabal','DEF',5],['LEV','Matías Moreno','DEF',5],['LEV','Manu Sánchez','DEF',5],
    ['LEV','Oriol Rey','CEN',5],['LEV','Pablo Martínez','CEN',5],['LEV','Carlos Álvarez','CEN',6],['LEV','Iván Romero','DEL',6],
    ['LEV','Roger Brugué','DEL',5],
    ['RAC','Jokin Ezkieta','POR',5],['RAC','Mantilla','DEF',5],['RAC','Javi Castro','DEF',5],['RAC','Saúl García','DEF',5],
    ['RAC','Íñigo Sainz-Maza','CEN',5],['RAC','Peio Canales','CEN',6],['RAC','Andrés Martín','DEL',6],['RAC','Asier Villalibre','DEL',5],
    ['RAC','Juan Carlos Arana','DEL',5],
    ['DEP','Germán Parreño','POR',5],['DEP','Ximo Navarro','DEF',5],['DEP','Pablo Vázquez','DEF',5],['DEP','Sergio Escudero','DEF',5],
    ['DEP','José Ángel','CEN',5],['DEP','Diego Villares','CEN',5],['DEP','Yeremay Hernández','DEL',7],['DEP','David Mella','DEL',6],
    ['DEP','Zakaria Eddahchouri','DEL',6],
    ['MAL','Alfonso Herrero','POR',5],['MAL','Einar Galilea','DEF',5],['MAL','Carlos Puga','DEF',5],['MAL','Dani Sánchez','DEF',5],
    ['MAL','Dani Lorenzo','CEN',5],['MAL','Izan Merino','CEN',5],['MAL','Joaquín Muñoz','DEL',6],['MAL','Chupe','DEL',6],
    ['MAL','David Larrubia','DEL',6]
  ];

  /* ---------- Estado médico/disciplinario de referencia ---------- */
  const STATUS = {
    'Carvajal': 'doubtful', 'Araujo': 'injured', 'Gavi': 'doubtful', 'Giménez': 'injured',
    'Laporte': 'doubtful', 'Isco': 'injured', 'Gerard Moreno': 'injured', 'Iago Aspas': 'doubtful',
    'Azpilicueta': 'suspended', 'Arnaut Danjuma': 'doubtful', 'Djené': 'suspended', 'Rubén García': 'doubtful',
    'Rodrygo': 'doubtful', 'Kike García': 'injured', 'Mantilla': 'suspended'
  };

  /* ---------- Utilidades deterministas ---------- */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poisson(r, lambda) {
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }
  function pickWeighted(r, items, weightFn) {
    const w = items.map(weightFn); const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let x = r() * total;
    for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  }
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  /* ---------- Jugadores ---------- */
  const TEAM = Object.fromEntries(TEAMS.map(t => [t.id, t]));
  const PLAYERS = RAW.map(([team, name, pos, q]) => ({
    id: team.toLowerCase() + '-' + slug(name), team, name, pos, q,
    status: STATUS[name] || 'ok'
  }));
  // El primer portero de cada equipo es el titular
  const GK_STARTER = {};
  PLAYERS.forEach(p => { if (p.pos === 'POR' && !GK_STARTER[p.team]) GK_STARTER[p.team] = p.id; });

  /* ---------- Calendario: 38 jornadas, doble vuelta ---------- */
  const SEASON_SEED = hash('laliga-2026-27');
  const order = TEAMS.map(t => t.id);
  (function shuffle() { const r = rng(SEASON_SEED); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } })();

  const ROUNDS = [];
  (function circle() {
    const n = order.length, arr = order.slice();
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        games.push((r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
      ROUNDS.push(games);
      arr.splice(1, 0, arr.pop());
    }
    for (let r = 0; r < n - 1; r++) ROUNDS.push(ROUNDS[r].map(g => ({ home: g.away, away: g.home })));
  })();

  // Fechas (domingo de cada jornada) con parones de selecciones
  const BREAKS = ['2026-09-06', '2026-10-11', '2026-11-15', '2026-12-27', '2027-01-03', '2027-03-28'];
  const DATES = [];
  (function dates() {
    const d = new Date('2026-08-16T12:00:00');
    while (DATES.length < 38) {
      const iso = d.toISOString().slice(0, 10);
      if (!BREAKS.includes(iso)) DATES.push(iso);
      d.setDate(d.getDate() + 7);
    }
  })();

  function playedJornadas(now) {
    const t = (now || new Date()).getTime();
    let n = 0;
    DATES.forEach((iso, i) => { if (t > new Date(iso + 'T23:59:00').getTime() + 864e5) n = i + 1; });
    return Math.min(38, Math.max(0, n));
  }

  /* ---------- Simulación de partido y puntos (sistema tipo LaLiga Fantasy) ---------- */
  const GOAL_PTS = { POR: 6, DEF: 6, CEN: 5, DEL: 4 };
  const GOAL_W = { POR: 0, DEF: 0.55, CEN: 1.6, DEL: 3.4 };
  const AST_W = { POR: 0.05, DEF: 0.9, CEN: 2.2, DEL: 1.7 };
  const byTeam = {};
  PLAYERS.forEach(p => (byTeam[p.team] = byTeam[p.team] || []).push(p));

  const cache = {};
  function simulateJornada(j) {
    if (cache[j]) return cache[j];
    const out = { matches: [], stats: {} };
    ROUNDS[j - 1].forEach(g => {
      const r = rng(hash(`J${j}-${g.home}-${g.away}`));
      const H = TEAM[g.home], A = TEAM[g.away];
      const lh = Math.max(0.25, 1.45 * Math.pow(H.str / A.str, 2.1) * 1.08);
      const la = Math.max(0.2, 1.2 * Math.pow(A.str / H.str, 2.1) * 0.94);
      const hg = poisson(r, lh), ag = poisson(r, la);
      out.matches.push({ home: g.home, away: g.away, hg, ag });
      [[g.home, hg, ag, true, g.away], [g.away, ag, hg, false, g.home]].forEach(([team, gf, ga, home, opp]) => {
        const squad = byTeam[team];
        const lastJ = playedJornadas();
        const playing = squad.filter(p => {
          // los lesionados/sancionados actuales no jugaron la última jornada
          if (p.status !== 'ok' && p.status !== 'doubtful' && j >= lastJ) return false;
          if (p.pos === 'POR') return GK_STARTER[team] === p.id;
          return r() < Math.min(0.97, 0.3 + p.q * 0.075);
        });
        const st = {};
        playing.forEach(p => {
          const full = r() < 0.55 + p.q * 0.04;
          st[p.id] = { j, team, opp, home, gf, ga, played: true, min: full ? 90 : (r() < 0.5 ? 70 : 30), g: 0, a: 0, cs: false, yc: 0, rc: 0, base: 0, pts: 0 };
        });
        for (let k = 0; k < gf; k++) {
          const sc = pickWeighted(r, playing, p => GOAL_W[p.pos] * Math.pow(p.q, 1.6) * (st[p.id].min / 90));
          if (sc) st[sc.id].g++;
          if (r() < 0.72) {
            const as = pickWeighted(r, playing.filter(p => p !== sc), p => AST_W[p.pos] * Math.pow(p.q, 1.4));
            if (as) st[as.id].a++;
          }
        }
        playing.forEach(p => {
          const s = st[p.id];
          let pts = s.min >= 60 ? 2 : 1;
          pts += s.g * GOAL_PTS[p.pos] + s.a * 3;
          if (ga === 0 && s.min >= 60) { s.cs = true; pts += p.pos === 'POR' ? 4 : p.pos === 'DEF' ? 3 : p.pos === 'CEN' ? 1 : 0; }
          if (p.pos === 'POR' || p.pos === 'DEF') pts -= Math.floor(ga / 2);
          if (p.pos === 'POR') pts += Math.round(r() * 3 * (A.str > H.str ? 1.2 : 0.8));
          if (r() < 0.13) { s.yc = 1; pts -= 1; }
          if (r() < 0.012) { s.rc = 1; pts -= 3; }
          // Componente de valoración (estadísticas avanzadas / crónica)
          const res = gf > ga ? 1 : gf < ga ? -0.6 : 0.2;
          s.base = Math.round(gauss(r) * 1.7 + (p.q - 5) * 0.32 + res + (s.min < 60 ? -0.6 : 0.3));
          pts += s.base;
          s.pts = pts;
        });
        Object.assign(out.stats, st);
      });
    });
    cache[j] = out;
    return out;
  }

  /* ---------- Valor de mercado (M€) ---------- */
  function baseValue(p) { return 0.28 * Math.pow(1.64, p.q); }

  global.FantasyDB = {
    TEAMS, TEAM, PLAYERS, ROUNDS, DATES, GK_STARTER,
    playedJornadas, simulateJornada, baseValue, hash, rng, slug
  };
})(window);
