/* huroof.js — حروف (خلية الحروف): لوحة سداسية ٥×٥ من الحروف بين فريقين.
   الأخضر يصل اليمين باليسار، والبرتقالي يصل الأعلى بالأسفل. أول مسار متصل يفوز بالجولة. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr, Player } = W.QP;
  const Timer = () => W.QP.Timer, tbar = () => W.QP.timerBar;
  const fmt = n => toAr(Number(Math.round(n || 0)).toLocaleString('en'));
  const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
  const SHOW = { 'ا': 'أ', 'ه': 'هـ' };
  const N = 5;
  const COLORS = ['#22b45e', '#ff7a1f'];
  const DIRS = ['يصل اليمين ↔ اليسار', 'يصل الأعلى ↕ الأسفل'];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const S = 50, HW = Math.sqrt(3) * S; // hex radius / width (pointy-top)
  let dataP = null;
  function loadData() {
    if (W.HUROOF_Q && W.HUROOF_SCHOOL) return Promise.resolve();
    return dataP = dataP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'data/huroof.js'; s.onload = () => { const t = document.createElement('script'); t.src = 'data/huroof-school.js'; t.onload = res; t.onerror = res; document.head.appendChild(t); }; s.onerror = () => { dataP = null; rej(new Error('huroof data')); }; document.head.appendChild(s); });
  }
  // odd-r offset layout: odd rows shifted half a hex to the right
  function neighbors(r, c) {
    const odd = r & 1;
    const d = odd ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
    return d.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N);
  }
  // team 0 (green): column 0 ↔ column N-1 (left/right). team 1 (orange): row 0 ↔ row N-1 (top/bottom)
  function winningPath(owner, team) {
    const start = [], seen = new Set(), prev = {};
    for (let i = 0; i < N; i++) { const [r, c] = team === 0 ? [i, 0] : [0, i]; if (owner[r][c] === team) { start.push([r, c]); seen.add(r + ',' + c); } }
    const q = start.slice();
    while (q.length) {
      const [r, c] = q.shift();
      if ((team === 0 && c === N - 1) || (team === 1 && r === N - 1)) { const path = [[r, c]]; let k = r + ',' + c; while (prev[k]) { path.push(prev[k]); k = prev[k].join(','); } return path; }
      neighbors(r, c).forEach(([a, b]) => { const k = a + ',' + b; if (!seen.has(k) && owner[a][b] === team) { seen.add(k); prev[k] = [r, c]; q.push([a, b]); } });
    }
    return null;
  }
  function center(r, c) { return [HW * (c + 0.5 * (r & 1)) + HW * 1.5, 1.5 * S * r + S * 2.6]; }
  function hexPts(x, y, s) { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); p.push((x + s * Math.cos(a)).toFixed(1) + ',' + (y + s * Math.sin(a)).toFixed(1)); } return p.join(' '); }
  function el(tag, attrs, kids) { const e = document.createElementNS(SVGNS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); (kids || []).forEach(k => e.appendChild(k)); return e; }

  function toQ(row, L) {
    const [id, category, difficulty, stage, question, answer, clues, source, sub] = row;
    return { id, category, difficulty, stage, question, answer, accept: [answer], type: 'fill', clues: clues || null, source, subcategory: sub, letter: L, verificationLevel: 'none' };
  }
  function pickFor(L, used, cfg) {
    const rows = (W.HUROOF_Q && W.HUROOF_Q[L]) || [];
    const fl = cfg.filters || {};
    const layers = [
      r => cfg.cats.includes(r[1]) && (!fl.diff || r[2] === fl.diff) && (!fl.stage || r[3] === fl.stage) && (!(fl.stage === 'mutawassit' && fl.diff === 1) || r[9] === 1),
      r => (fl.stage === 'mutawassit' && fl.diff === 1) && r[9] === 1,
      r => cfg.cats.includes(r[1]) && (!fl.diff || r[2] === fl.diff),
      r => cfg.cats.includes(r[1]),
      () => true
    ];
    for (let i = 0; i < layers.length; i++) {
      let list = rows.filter(layers[i]).filter(r => !used.has(r[0]));
      if (!list.length && i === layers.length - 1) list = rows.slice();
      if (list.length) { const r = list[Math.floor(Math.random() * list.length)]; used.add(r[0]); return { q: toQ(r, L), relaxed: i > 0 }; }
    }
    return { q: null, relaxed: true };
  }

  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null, keyH = null;
    const wrap = h('div', { class: 'hf-wrap' });
    root.appendChild(wrap);

    function setup() {
      wrap.innerHTML = '';
      const names = ['الأخضر', 'البرتقالي'];
      let target = 2, secs = 20;
      let cats = Bank.cats.map(c => c.id);
      const tChips = h('div', { class: 'chips center' }), sChips = h('div', { class: 'chips center' }), cChips = h('div', { class: 'chips center hf-cats' });
      const drawT = () => { tChips.innerHTML = ''; [[1, 'جولة واحدة'], [2, 'أفضل من ٣ (أول من يفوز بجولتين)'], [3, 'أفضل من ٥ (أول من يفوز بثلاث)']].forEach(([v, l]) => tChips.appendChild(h('button', { type: 'button', class: 'chip' + (target === v ? ' on' : ''), onclick: () => { target = v; drawT(); } }, l))); };
      const drawS = () => { sChips.innerHTML = ''; [[15, '١٥ ث'], [20, '٢٠ ث'], [30, '٣٠ ث'], [0, 'بدون وقت']].forEach(([v, l]) => sChips.appendChild(h('button', { type: 'button', class: 'chip' + (secs === v ? ' on' : ''), onclick: () => { secs = v; drawS(); } }, l))); };
      const drawC = () => { cChips.innerHTML = ''; cChips.appendChild(h('button', { type: 'button', class: 'chip' + (cats.length === Bank.cats.length ? ' on' : ''), onclick: () => { cats = Bank.cats.map(c => c.id); drawC(); } }, '🌐 كل الأقسام')); Bank.cats.forEach(c => { const on = cats.includes(c.id); cChips.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: () => { if (cats.length === Bank.cats.length) cats = [c.id]; else if (on) cats = cats.filter(x => x !== c.id); else cats = cats.concat(c.id); if (!cats.length) cats = Bank.cats.map(x => x.id); drawC(); } }, c.icon + ' ' + c.name)); }); };
      drawT(); drawS(); drawC();
      const inputs = names.map((n, i) => h('label', { class: 'hf-name t' + i }, 'اسم الفريق ' + (i ? 'البرتقالي (يصل الأعلى بالأسفل ↕)' : 'الأخضر (يصل اليمين باليسار ↔)'), h('input', { class: 'inp', maxlength: 20, value: n })));
      wrap.appendChild(h('div', { class: 'card intro hf-setup' },
        h('div', { class: 'intro-icon' }, '🐝'),
        h('h1', null, 'حروف'),
        h('p', null, 'خلية من ٢٥ حرفًا وفريقان. اختاروا حرفًا، والسؤال جوابه يبدأ بهذا الحرف. أسرع فريق يضغط الجرس ويجاوب صح يأخذ الخلية بلونه. الأخضر يحاول يوصل بين اليمين واليسار، والبرتقالي بين الأعلى والأسفل. أول فريق يكمل طريقه المتصل يفوز بالجولة.'),
        h('div', { class: 'grid2 hf-names' }, inputs),
        h('div', { class: 'qf-label' }, 'عدد الجولات'), tChips,
        h('div', { class: 'qf-label' }, 'وقت السؤال'), sChips,
        h('div', { class: 'qf-label' }, 'أقسام الأسئلة'), cChips,
        W.QP.filterBar ? W.QP.filterBar({}) : null,
        h('button', { class: 'btn primary big', id: 'startBtn', onclick: () => {
          const nm = inputs.map((l, i) => (l.querySelector('input').value || '').trim().slice(0, 20) || names[i]);
          if (nm[0] === nm[1]) nm[1] += ' ٢';
          const cfg = { names: nm, target, secs, cats: cats.slice(), filters: W.QP.getQFilters ? W.QP.getQFilters() : {} };
          wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ تجهيز الحروف…'));
          loadData().then(() => { if (!stopped) begin(cfg); }).catch(() => { wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center' }, 'تعذّر تحميل أسئلة الحروف.')); });
        } }, '🔥 ابدأ حروف'),
        h('p', { class: 'muted small' }, 'الجرس: زر الفريق على الشاشة، أو من لوحة المفاتيح: A للأخضر و L للبرتقالي.')));
    }

    function begin(cfg) {
      const teams = cfg.names.map((name, i) => ({ name, wins: 0, cells: 0, correct: 0, color: COLORS[i] }));
      const used = new Set();
      const st = { score: 0, correct: 0, wrong: 0, best: 0, log: [], start: Date.now() };
      let roundNo = 0, chooser = Math.random() < 0.5 ? 0 : 1, letters = null, owner = null, history = [], relaxedAny = false, firstDraw = true;

      function newRound() {
        roundNo++;
        letters = []; const L = shuffle(LETTERS).slice(0, N * N);
        for (let r = 0; r < N; r++) letters.push(L.slice(r * N, r * N + N));
        owner = Array.from({ length: N }, () => Array(N).fill(-1));
        history = [];
        firstDraw = true;
        drawBoard();
      }

      function boardSvg(onPick, hi) {
        const wv = HW * (N + 2.5), hv = 1.5 * S * (N + 1) + S * 2.2;
        const svg = el('svg', { viewBox: '0 0 ' + wv.toFixed(0) + ' ' + hv.toFixed(0), class: 'hf-svg', role: 'img', 'aria-label': 'لوحة الحروف' });
        // border hexes: green on left/right (columns -1 and N), orange on top/bottom (rows -1 and N)
        for (let r = -1; r <= N; r++) for (let c = -1; c <= N; c++) {
          const inside = r >= 0 && r < N && c >= 0 && c < N; if (inside) continue;
          const isTB = (r === -1 || r === N) && c >= 0 && c < N;
          const isLR = (c === -1 || c === N) && r >= 0 && r < N;
          if (!isTB && !isLR) continue;
          const [x, y] = center(r, c);
          svg.appendChild(el('polygon', { points: hexPts(x, y, S * 0.97), fill: isLR ? COLORS[0] : COLORS[1], opacity: '0.9', class: 'hf-edge' }));
        }
        const onPath = new Set((hi || []).map(p => p.join(',')));
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const [x, y] = center(r, c); const o = owner[r][c];
          const g = el('g', { class: 'hf-hex' + (o < 0 ? ' free' : ' own' + o) + (onPath.has(r + ',' + c) ? ' path' : ''), 'data-r': r, 'data-c': c, 'data-letter': letters[r][c], tabindex: o < 0 && onPick ? '0' : '-1' });
          g.appendChild(el('polygon', { points: hexPts(x, y, S * 0.95), fill: o < 0 ? '#fff7dc' : COLORS[o], stroke: '#06272a', 'stroke-width': '4' }));
          const t = el('text', { x: x.toFixed(1), y: (y + S * 0.12).toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': (S * 0.95).toFixed(0), 'font-weight': '800', fill: o < 0 ? '#06272a' : '#fff' });
          t.textContent = SHOW[letters[r][c]] || letters[r][c];
          g.appendChild(t);
          if (o < 0 && onPick) { g.addEventListener('click', () => onPick(r, c)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onPick(r, c); }); }
          svg.appendChild(g);
        }
        return svg;
      }

      function header() {
        return h('div', { class: 'hf-head' },
          teams.map((t, i) => h('div', { class: 'hf-team t' + i + (chooser === i ? ' turn' : '') },
            h('div', { class: 'hf-tname' }, t.name),
            h('div', { class: 'hf-tdir' }, DIRS[i]),
            h('div', { class: 'hf-twins' }, 'الجولات: ', h('b', null, toAr(t.wins)), ' / ' + toAr(cfg.target)))),
          h('div', { class: 'hf-round' }, 'الجولة ' + toAr(roundNo)));
      }

      function drawBoard() {
        if (ended) return;
        if (timer) { timer.stop(); timer = null; }
        setKeys(null);
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        if (relaxedAny && cfg.filters && (cfg.filters.diff || cfg.filters.stage)) wrap.appendChild(h('div', { class: 'filter-note' }, 'تنبيه: بعض الحروف ليس لها أسئلة كافية بالاختيار المحدد، فاستُكملت من أقسام/مستويات أخرى.'));
        wrap.appendChild(header());
        wrap.appendChild(h('div', { class: 'hf-turnline' }, firstDraw && roundNo === 1 ? '🎲 القرعة: ' : '🎯 ', 'يختار الحرف: ', h('b', { class: 't' + chooser }, teams[chooser].name)));
        firstDraw = false;
        wrap.appendChild(h('div', { class: 'hf-board' }, boardSvg(openCell)));
        wrap.appendChild(h('div', { class: 'row center hf-tools' },
          history.length ? h('button', { class: 'btn ghost small', onclick: () => { const last = history.pop(); owner[last.r][last.c] = -1; teams[last.t].cells--; chooser = last.prevChooser; st.log.length = last.logLen; drawBoard(); } }, '↩ تراجع عن آخر خلية') : null,
          h('button', { class: 'btn ghost small', onclick: () => { if (confirm('إنهاء المباراة الآن؟')) end(); } }, '🏁 إنهاء المباراة')));
      }

      function setKeys(fn) { if (keyH) W.removeEventListener('keydown', keyH); keyH = fn; if (fn) W.addEventListener('keydown', fn); }

      function openCell(r, c, again) {
        const L = letters[r][c];
        const got = pickFor(L, used, cfg);
        if (got.relaxed) relaxedAny = true;
        const q = got.q;
        if (!q) { alert('لا توجد أسئلة لهذا الحرف'); return; }
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(header());
        const c0 = Bank.cat(q.category) || {};
        const box = h('div', { class: 'card hf-q' });
        const big = h('div', { class: 'hf-letter' }, SHOW[L] || L);
        box.appendChild(h('div', { class: 'hf-qtop' }, big,
          h('div', { class: 'hf-qinfo' },
            h('div', { class: 'hf-hint' }, 'الجواب يبدأ بحرف «' + (SHOW[L] || L) + '»'),
            h('div', { class: 'q-meta' }, h('span', { class: 'tag light' }, (c0.icon || '') + ' ' + (c0.name || '')), again ? h('span', { class: 'tag light' }, 'سؤال آخر لنفس الحرف') : null))));
        box.appendChild(h('h2', { class: 'q-text hf-qtext' }, q.question));
        if (q.clues) box.appendChild(h('ul', { class: 'sj-clues' }, q.clues.map(x => h('li', { class: 'clue' }, x))));
        const tb = tbar()(); box.appendChild(tb.el); if (!cfg.secs) tb.el.classList.add('hidden');
        const status = h('div', { class: 'hf-status' }, '🔔 أسرع فريق يضغط الجرس');
        box.appendChild(status);
        const ctrl = h('div', { class: 'hf-ctrl' });
        box.appendChild(ctrl);
        wrap.appendChild(box);
        let buzzed = null, locked = [false, false], revealed = false;

        function startTimer(sec, onEnd) { if (timer) timer.stop(); if (!sec) return; timer = Timer()(sec, left => { tb.set(left, left / sec); if (left < 4 && Math.ceil(left) !== Math.ceil(left + 0.1)) Sound.tick(); }, onEnd).start(); }
        function drawCtrl() {
          ctrl.innerHTML = '';
          if (revealed) {
            ctrl.appendChild(h('div', { class: 'hf-who' }, 'من جاوب صح؟'));
            ctrl.appendChild(h('div', { class: 'row center' },
              teams.map((t, i) => h('button', { class: 'btn big hf-aw t' + i, 'data-team': i, onclick: () => award(i) }, '✔ ' + t.name)),
              h('button', { class: 'btn ghost big', id: 'hfNobody', onclick: () => { st.log.push({ q, res: { correct: false }, pts: 0 }); Sound.bad(); openCell(r, c, true); } }, '✘ ولا أحد — سؤال آخر'),
              h('button', { class: 'btn ghost', onclick: drawBoard }, '↩ اللوحة')));
            return;
          }
          if (buzzed == null) {
            ctrl.appendChild(h('div', { class: 'hf-buzzers' }, teams.map((t, i) => h('button', { class: 'hf-buzz t' + i, 'data-team': i, disabled: locked[i], onclick: () => buzz(i) }, h('span', null, '🔔'), h('b', null, t.name), h('small', null, i ? 'L' : 'A')))));
          } else {
            ctrl.appendChild(h('div', { class: 'row center' },
              !locked[1 - buzzed] ? h('button', { class: 'btn ghost', id: 'hfWrong', onclick: () => { locked[buzzed] = true; Sound.bad(); const o = 1 - buzzed; buzzed = null; buzz(o); } }, '✘ أخطأ — الفرصة لـ ' + teams[1 - buzzed].name) : null));
          }
          ctrl.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'hfReveal', onclick: reveal }, '📢 إظهار الإجابة')));
        }
        function buzz(i) {
          if (revealed || buzzed != null || locked[i]) return;
          buzzed = i; Sound.go();
          status.className = 'hf-status t' + i;
          status.textContent = '🔔 ' + teams[i].name + ' يجاوب الآن!';
          startTimer(cfg.secs ? Math.min(10, cfg.secs) : 0, () => { Sound.bad(); status.textContent = '⌛ انتهى وقت ' + teams[i].name; });
          drawCtrl();
        }
        function reveal() {
          if (revealed) return; revealed = true; if (timer) { timer.stop(); timer = null; }
          setKeys(null);
          const fb = h('div', { class: 'feedback good hf-answer' }, h('div', { class: 'fb-title' }, '📢 الإجابة: ', h('b', null, q.answer)), q.source ? h('div', { class: 'source' }, h('b', null, 'المصدر: '), q.source) : null);
          box.insertBefore(fb, status);
          drawCtrl();
        }
        function award(i) {
          owner[r][c] = i; teams[i].cells++; teams[i].correct++;
          history.push({ r, c, t: i, prevChooser: chooser, logLen: st.log.length });
          chooser = i; Sound.good();
          st.log.push({ q, res: { correct: true }, pts: 100, player: teams[i].name });
          const path = winningPath(owner, i);
          if (path) return roundWon(i, path);
          drawBoard();
        }
        setKeys(e => { if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = (e.key || '').toLowerCase(); if (k === 'a' || k === 'ش') buzz(0); else if (k === 'l' || k === 'م') buzz(1); });
        startTimer(cfg.secs, () => { Sound.bad(); if (buzzed == null) status.textContent = '⌛ انتهى الوقت — اكشف الإجابة'; });
        drawCtrl();
      }

      function roundWon(i, path) {
        teams[i].wins++;
        const done = teams[i].wins >= cfg.target;
        chooser = 1 - i; // the loser picks first next board
        wrap.innerHTML = '';
        wrap.appendChild(header());
        Sound.fanfare(); if (W.QP.confetti) W.QP.confetti(wrap);
        wrap.appendChild(h('div', { class: 'hf-win t' + i }, '🏆 ' + teams[i].name + ' فاز بالجولة ' + toAr(roundNo) + '!'));
        wrap.appendChild(h('div', { class: 'hf-board' }, boardSvg(null, path)));
        wrap.appendChild(h('div', { class: 'row center' }, done
          ? h('button', { class: 'btn primary big', id: 'hfNext', onclick: end }, '🏁 النتيجة النهائية')
          : h('button', { class: 'btn primary big', id: 'hfNext', onclick: newRound }, '▶ الجولة التالية (يبدأ ' + teams[1 - i].name + ')')));
      }

      function end() {
        if (ended) return; ended = true; if (timer) timer.stop(); setKeys(null);
        const pts = t => t.cells * 100 + t.wins * 500;
        const list = teams.map(t => ({ name: t.name, score: pts(t), correct: t.correct, wins: t.wins })).sort((a, b) => b.wins - a.wins || b.score - a.score);
        const me = teams[0];
        st.score = pts(me); st.correct = me.correct; st.wrong = st.log.length - st.correct;
        const tie = list[0].wins === list[1].wins && list[0].score === list[1].score;
        finish({ game, st, opts, reason: 'done', party: 'huroof', multi: list, winner: tie ? null : list[0].name, hostName: me.name, scoreLabel: 'خلية = ١٠٠، جولة = ٥٠٠' });
      }

      newRound();
    }

    setup();
    return { stop() { stopped = ended = true; if (timer) timer.stop(); if (keyH) W.removeEventListener('keydown', keyH); } };
  }

  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.huroof = run;
  W.QP.HUROOF = { LETTERS, neighbors, winningPath, N };
})(window);
