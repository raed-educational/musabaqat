/* memory.js — بطاقة الذاكرة: اقلب بطاقتين وطابق السؤال مع جوابه. ١–٤ لاعبين بالتناوب، عدّاد حركات ووقت. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr, norm } = W.QP;
  const K = () => W.QP.Kit;
  const SIZES = { s: { cols: 4, rows: 3, label: '٤×٣ (٦ أزواج)' }, m: { cols: 4, rows: 4, label: '٤×٤ (٨ أزواج)' }, l: { cols: 6, rows: 5, label: '٦×٥ (١٥ زوجًا)' } };
  const clock = s => toAr(Math.floor(s / 60)) + ':' + toAr(String(Math.floor(s % 60)).padStart(2, '0'));

  function run(game, root, opts, finish) {
    let stopped = false, ended = false, tick = null, flipT = 0;
    const wrap = h('div', { class: 'mem-wrap' });
    root.appendChild(wrap);
    let size = 'm';
    K().setup(wrap, {
      icon: '🃏', title: 'بطاقة الذاكرة', min: 1, max: 4, def: 2, unit: ' لاعبين', countLabel: 'عدد اللاعبين / الفرق',
      desc: 'البطاقات مقلوبة: نصفها أسئلة ونصفها أجوبة. اقلب بطاقتين في كل دور؛ إذا كان الجواب جواب السؤال تبقى مكشوفة وتلعب مرة ثانية، وإذا لا تنقلب وينتقل الدور.',
      extras: () => K().choice('حجم اللوحة', Object.entries(SIZES).map(([k, v]) => [k, v.label]), () => size, v => { size = v; }),
      startLabel: '🃏 ابدأ اللعب',
      onStart: cfg => K().load(wrap, cfg.cats, () => { if (!stopped) begin(cfg); })
    });

    function begin(cfg) {
      const S = SIZES[size]; const nPairs = S.cols * S.rows / 2;
      const P = K().picker({ cats: cfg.cats, types: ['mcq', 'fill'], filters: cfg.filters, test: q => { const a = q.type === 'mcq' ? q.options[q.answer] : q.answer; return a && String(a).length <= 30 && q.question.length <= 90 && !K().OPT_DEP.test(q.question) && !/^(صح|خطأ)$/.test(a) && !/____|…|\.\.\./.test(q.question); } });
      const pairs = []; const seen = new Set(); let guard = 0;
      while (pairs.length < nPairs && guard++ < 400) {
        const q = P.next(null, cfg.cats[pairs.length % cfg.cats.length]); if (!q) break;
        const a = q.type === 'mcq' ? q.options[q.answer] : q.answer; const k = norm(a);
        if (seen.has(k)) continue; seen.add(k);
        pairs.push({ q, a });
      }
      const players = cfg.names.map(name => ({ name, score: 0, pairs: 0, correct: 0 }));
      const cards = shuffle(pairs.flatMap((p, i) => [{ pair: i, kind: 'q', text: p.q.question }, { pair: i, kind: 'a', text: p.a }]));
      const log = [];
      let turn = 0, moves = 0, open = [], busy = false, matched = 0, secs = 0;
      wrap.innerHTML = ''; W.scrollTo(0, 0);
      const note = P.note(); if (note) wrap.appendChild(h('div', { class: 'filter-note' }, note));
      const sc = h('div'); const hud = h('div', { class: 'mem-hud' }); const reader = h('div', { class: 'mem-reader' }, 'اقلب بطاقتين…');
      const grid = h('div', { class: 'mem-grid c' + S.cols, style: '--cols:' + S.cols + ';--rows:' + S.rows });
      wrap.appendChild(sc); wrap.appendChild(hud); wrap.appendChild(reader); wrap.appendChild(grid);
      wrap.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn ghost small', onclick: () => { if (confirm('إنهاء اللعبة؟')) end(); } }, '🏁 إنهاء')));
      const els = cards.map((c, i) => h('button', { class: 'mem-card ' + c.kind, 'data-i': i, 'data-pair': c.pair, 'aria-label': 'بطاقة', onclick: () => flip(i) },
        h('span', { class: 'mem-back' }, '؟'), h('span', { class: 'mem-front' }, h('i', null, c.kind === 'q' ? 'سؤال' : 'جواب'), h('span', null, c.text))));
      els.forEach(e => grid.appendChild(e));
      function drawTop() {
        sc.innerHTML = ''; sc.appendChild(K().scores(players, players.length > 1 ? turn : -1, { val: p => toAr(p.pairs), sub: () => 'أزواج' }));
        hud.innerHTML = ''; hud.appendChild(h('span', null, '🔁 الحركات: ', h('b', null, toAr(moves)))); hud.appendChild(h('span', null, '⏱ ', h('b', { class: 'mem-clock' }, clock(secs)))); hud.appendChild(h('span', null, '🧩 ', h('b', null, toAr(matched) + ' / ' + toAr(pairs.length))));
        if (players.length > 1) hud.appendChild(h('span', { class: 'mem-turn' }, '🎯 الدور: ', h('b', null, players[turn].name)));
      }
      drawTop();
      tick = setInterval(() => { secs++; const c = hud.querySelector('.mem-clock'); if (c) c.textContent = clock(secs); }, 1000);
      function flip(i) {
        if (busy || ended) return;
        const c = cards[i], e = els[i];
        if (e.classList.contains('up') || e.classList.contains('done')) return;
        e.classList.add('up'); Sound.tick();
        open.push(i);
        reader.innerHTML = '';
        open.forEach(j => reader.appendChild(h('div', { class: 'mem-read ' + cards[j].kind }, h('i', null, cards[j].kind === 'q' ? 'سؤال' : 'جواب'), cards[j].text)));
        if (open.length < 2) return;
        moves++;
        const [x, y] = open.map(j => cards[j]);
        const p = players[turn];
        if (x.pair === y.pair && x.kind !== y.kind) {
          open.forEach(j => { els[j].classList.add('done'); els[j].style.setProperty('--tc', K().COLORS[turn % 4]); });
          p.pairs++; p.score += 100; p.correct++; matched++; Sound.good();
          log.push({ q: pairs[x.pair].q, res: { correct: true }, pts: 100, player: p.name });
          reader.appendChild(h('div', { class: 'kit-msg good' }, '✔ تطابق! ' + (players.length > 1 ? p.name + ' يلعب مرة ثانية' : '')));
          open = [];
          drawTop();
          if (matched === pairs.length) K().after(900, end);
        } else {
          Sound.bad(); busy = true;
          reader.appendChild(h('div', { class: 'kit-msg bad' }, '✘ لا تطابق'));
          flipT = setTimeout(() => { open.forEach(j => els[j].classList.remove('up')); open = []; busy = false; if (players.length > 1) turn = (turn + 1) % players.length; drawTop(); }, K().fast() ? 30 : 1500);
        }
        drawTop();
      }
      function end() {
        if (ended) return; ended = true; clearInterval(tick); clearTimeout(flipT);
        if (players.length === 1) { const p = players[0]; p.score = p.pairs * 100 + Math.max(0, pairs.length * 3 - moves) * 20; }
        pairs.forEach((pp, i) => { if (!log.find(l => l.q === pp.q)) log.push({ q: pp.q, res: { correct: false }, pts: 0 }); });
        K().end(finish, game, players, log, { res: { scoreLabel: 'كل زوج = ١٠٠' + (players.length === 1 ? '، ومكافأة لقلة الحركات' : '') + ' — الحركات: ' + toAr(moves) + '، الوقت: ' + clock(secs) } });
      }
      wrap.__cards = cards;
    }
    return { stop() { stopped = ended = true; clearInterval(tick); clearTimeout(flipT); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.memory = run;
})(window);
