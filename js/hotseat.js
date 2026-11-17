/* hotseat.js — الكرسي الساخن: كل فريق يجلس على الكرسي لمدة محددة ويجيب أكبر عدد من الأسئلة السريعة؛ سلسلة الإجابات الصحيحة تضاعف النقاط. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, toAr } = W.QP;
  const K = () => W.QP.Kit;
  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null, keyH = null, tickId = 0;
    const onKey = e => keyH && keyH(e); W.addEventListener('keydown', onKey);
    const wrap = h('div', { class: 'hs-wrap' });
    root.appendChild(wrap);
    let secs = 60, rounds = 2;
    K().setup(wrap, {
      icon: '🔥', title: 'الكرسي الساخن', min: 1, max: 4, def: 2,
      desc: 'كل فريق يجلس على «الكرسي الساخن» لمدة محددة ويجيب على أكبر عدد من الأسئلة المتتالية. كل إجابة صحيحة +١٠٠، وكل ٣ صحيحة متتالية ترفع المضاعِف (×٢ ثم ×٣)، والخطأ يصفّر السلسلة. يمكن «التمرير» بلا خصم. الأعلى نقاطًا بعد كل الأدوار يفوز.',
      extras: () => [].concat(
        K().choice('مدة الكرسي', [[30, '٣٠ث'], [60, '٦٠ث'], [90, '٩٠ث']], () => secs, v => { secs = v; }),
        K().choice('عدد الأدوار لكل فريق', [[1, '١'], [2, '٢'], [3, '٣']], () => rounds, v => { rounds = v; })),
      startLabel: '🔥 إلى الكرسي',
      onStart: cfg => K().load(wrap, cfg.cats, () => { if (!stopped) begin(cfg); })
    });
    function begin(cfg) {
      const P = K().picker({ cats: cfg.cats, types: ['mcq'], filters: cfg.filters, test: q => K().MCQ(q) && q.question.length <= 160 });
      const teams = cfg.names.map(name => ({ name, score: 0, correct: 0, best: 0, turns: [] }));
      const log = []; let turn = 0, round = 1;
      function intro() {
        if (ended) return;
        K().splash(wrap, { icon: '🔥', kicker: 'الكرسي الساخن — الدور ' + toAr(round) + ' من ' + toAr(rounds), title: teams[turn].name, sub: toAr(secs) + ' ثانية — جاهزون؟', btn: '🔥 ابدأ العد' }, seat);
      }
      function seat() {
        if (ended) return;
        const t = teams[turn];
        let streak = 0, n = 0, ok = 0, pts = 0, cur = null, locked = false, over = false;
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(teams, turn));
        const big = h('div', { class: 'hs-clock' }, toAr(secs));
        const mult = h('div', { class: 'hs-mult' });
        const stat = h('div', { class: 'hs-stat' });
        const tb = W.QP.timerBar();
        wrap.appendChild(h('div', { class: 'hs-top' }, h('div', { class: 'hs-seat' }, '🔥 ', h('b', { style: 'color:' + K().COLORS[turn] }, t.name)), big, mult, stat));
        wrap.appendChild(tb.el);
        const area = h('div', { class: 'hs-area' }); wrap.appendChild(area);
        let swapCount = 0;
        const pass = h('button', { class: 'btn ghost big', id: 'hsPass', onclick: () => { if (!locked && !over) { Sound.tick && Sound.tick(); log.push({ q: cur, res: { correct: false, skipped: true }, pts: 0, player: t.name }); streak = 0; nextQ(); } } }, '⏭ تمرير');
        const swapHost = h('div', { class: 'swap-host' });
        wrap.appendChild(h('div', { class: 'kit-ctrl' }, pass, swapHost));
        const m = () => streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
        const paint = () => { mult.textContent = '×' + toAr(m()) + (streak ? ' — سلسلة ' + toAr(streak) : ''); mult.className = 'hs-mult x' + m(); stat.textContent = '✔ ' + toAr(ok) + ' / ' + toAr(n) + ' — ' + K().fmt(pts); };
        function paintSwap() {
          swapHost.innerHTML = '';
          if (over) return;
          swapHost.appendChild(W.QP.Swap.bar(() => {
            if (locked || over) return;
            const nq = W.QP.Swap.pick({ used: P.used, current: cur, types: ['mcq'], cats: cfg.cats, category: cur && cur.category, test: x => K().MCQ(x) && x.question.length <= 160 });
            if (!nq) return; swapCount++; cur = nq; locked = false; renderQ();
          }, swapCount));
        }
        function renderQ() {
          if (over) return;
          const M = K().mcq(cur, i => pick(i, M));
          area.innerHTML = ''; area.appendChild(M.el); wrap.__q = cur;
          keyH = e => { const k = '1234'.indexOf(e.key); if (k >= 0 && M.btns[k]) M.btns[k].click(); };
          paint(); paintSwap();
        }
        function nextQ() {
          if (over) return;
          locked = false; cur = P.next(n < 4 ? [1, 2] : [1, 2, 3]); n++;
          renderQ();
        }
        function pick(i, M) {
          if (locked || over) return; locked = true; M.lock(); M.show(i);
          W.QP.Swap.hide(swapHost);
          const good = i === cur.answer;
          if (good) { const g = 100 * m(); streak++; ok++; pts += g; t.score += g; t.correct++; t.best = Math.max(t.best, streak); Sound.good(); }
          else { streak = 0; Sound.bad(); }
          log.push({ q: cur, res: { correct: good }, pts: good ? 100 : 0, player: t.name });
          paint();
          K().after(good ? 450 : 900, nextQ);
        }
        let left = secs;
        timer = K().timer(secs, tb, () => stop());
        clearInterval(tickId); const tick = tickId = setInterval(() => { left--; if (left >= 0) big.textContent = toAr(left); if (left <= 10) big.classList.add('hot'); }, 1000);
        wrap.__end = () => stop();
        function stop() {
          if (over) return; over = true; clearInterval(tick); timer && timer.stop(); keyH = null;
          t.turns.push(pts); Sound.fanfare && Sound.fanfare();
          area.innerHTML = '';
          area.appendChild(h('div', { class: 'card hs-sum' }, h('div', { class: 'hs-big' }, '⏰'), h('h2', null, 'انتهى وقت ' + t.name),
            h('div', { class: 'hs-nums' }, h('div', null, h('b', null, toAr(ok)), h('span', null, 'صحيحة')), h('div', null, h('b', null, toAr(n)), h('span', null, 'سؤال')), h('div', null, h('b', null, K().fmt(pts)), h('span', null, 'نقطة')), h('div', null, h('b', null, toAr(t.best)), h('span', null, 'أطول سلسلة')))));
          pass.remove();
          const last = turn === teams.length - 1 && round === rounds;
          wrap.querySelector('.kit-ctrl').appendChild(h('button', { class: 'btn primary big', id: 'hsNext', onclick: () => { if (last) return end(); turn++; if (turn >= teams.length) { turn = 0; round++; } intro(); } }, last ? '🏆 النتيجة' : 'الفريق التالي ←'));
        }
        nextQ();
      }
      function end() { if (ended) return; ended = true; keyH = null; W.removeEventListener('keydown', onKey); K().end(finish, game, teams, log, { res: { scoreLabel: '١٠٠ لكل صحيحة × مضاعِف السلسلة' } }); }
      intro();
    }
    return { stop() { clearInterval(tickId); stopped = ended = true; keyH = null; W.removeEventListener('keydown', onKey); if (timer) timer.stop(); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.hotseat = run;
})(window);
