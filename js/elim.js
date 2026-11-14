/* elim.js — صح ولا خطأ: الإقصاء. عبارة + إجابة مقترحة، اللاعب يحكم صح/خطأ قبل نفاد الوقت؛ الخطأ يُسقط قلبًا، ومن تنفد قلوبه يخرج. آخر الصامدين يفوز. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr } = W.QP;
  const K = () => W.QP.Kit;
  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null, keyH = null;
    const onKey = e => keyH && keyH(e); W.addEventListener('keydown', onKey);
    const wrap = h('div', { class: 'el-wrap' });
    root.appendChild(wrap);
    let lives = 2, speed = 1;
    K().setup(wrap, {
      icon: '⚖️', title: 'صح ولا خطأ — الإقصاء', min: 1, max: 8, def: 4, unit: ' لاعبين', countLabel: 'عدد اللاعبين',
      label: (i, n) => n === 1 ? 'اسم اللاعب' : 'اللاعب ' + toAr(i + 1),
      defNames: ['اللاعب الأول', 'اللاعب الثاني', 'اللاعب الثالث', 'اللاعب الرابع', 'اللاعب الخامس', 'اللاعب السادس', 'اللاعب السابع', 'اللاعب الثامن'],
      desc: 'يظهر سؤال ومعه إجابة مقترحة: هل هي صحيحة أم خاطئة؟ اللاعبون بالدور، والوقت يقصر كل جولة والأسئلة تصعب. الخطأ أو نفاد الوقت يُسقط قلبًا، ومن تنفد قلوبه يُقصى. آخر من يصمد هو البطل (وفي الفردي: كم جولة تصمد؟).',
      extras: () => [].concat(
        K().choice('القلوب لكل لاعب', [[1, '❤️ ١'], [2, '❤️ ٢'], [3, '❤️ ٣']], () => lives, v => { lives = v; }),
        K().choice('السرعة', [[0, 'ثابتة ١٥ث'], [1, 'تتسارع ١٢←٥ث']], () => speed, v => { speed = v; })),
      startLabel: '⚖️ ابدأ الإقصاء',
      onStart: cfg => K().load(wrap, cfg.cats, () => { if (!stopped) begin(cfg); })
    });
    function begin(cfg) {
      const dep = K().OPT_DEP;
      const P = K().picker({ cats: cfg.cats, types: ['mcq', 'tf'], filters: cfg.filters, test: q => q.type === 'tf' ? q.options && q.options.length === 2 : K().MCQ(q) && !dep.test(q.question) && !q.options.some(o => /ما سبق|جميع ما|كلاهما|لا شيء|كل ما/.test(o)) });
      const players = cfg.names.map(name => ({ name, score: 0, correct: 0, lives, out: false, rounds: 0 }));
      const log = []; let turn = 0, round = 1, outOrder = 0;
      const solo = players.length === 1;
      const alive = () => players.filter(p => !p.out);
      const secs = () => speed ? Math.max(5, 13 - round) : 15;
      function statement(q) {
        if (q.type === 'tf') return { text: q.question, cand: null, truth: /صح|صحيح/.test(q.options[q.answer]) };
        const truth = Math.random() < 0.5;
        const wrongs = q.options.map((_, i) => i).filter(i => i !== q.answer);
        const k = truth ? q.answer : wrongs[Math.floor(Math.random() * wrongs.length)];
        return { text: q.question, cand: q.options[k], truth };
      }
      const hearts = p => p.out ? '❌ خرج' : '❤️'.repeat(p.lives) + '🤍'.repeat(Math.max(0, lives - p.lives));
      function play() {
        if (ended) return;
        if (timer) timer.stop();
        const p = players[turn];
        const q = P.next(round <= 2 ? 1 : round <= 4 ? [1, 2] : round <= 6 ? 2 : [2, 3]);
        const s = statement(q);
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(players, turn, { val: p2 => K().fmt(p2.score), sub: hearts }));
        wrap.appendChild(h('div', { class: 'kit-turn' }, '⚖️ الجولة ' + toAr(round) + ' — دور ', h('b', { style: 'color:' + K().COLORS[turn % 4] }, p.name), ' — ⏱ ' + toAr(secs()) + 'ث'));
        const tb = W.QP.timerBar();
        const c = Bank.cat(q.category) || {};
        const card = h('div', { class: 'q-card el-card' },
          h('div', { class: 'q-meta' }, h('span', { class: 'tag light' }, (c.icon || '') + ' ' + (c.name || '')), h('span', { class: 'tag d' + q.difficulty }, ({ 1: 'سهل', 2: 'متوسط', 3: 'صعب' })[q.difficulty] || '')),
          h('h2', { class: 'q-text' }, s.text),
          s.cand != null ? h('div', { class: 'el-cand' }, h('span', null, 'الإجابة المقترحة:'), h('b', null, s.cand)) : null);
        const msg = h('div', { class: 'kit-msg' }); const ctrl = h('div', { class: 'kit-ctrl' });
        const bT = h('button', { class: 'el-btn t', id: 'elTrue', onclick: () => answer(true) }, '✔', h('span', null, 'صح'));
        const bF = h('button', { class: 'el-btn f', id: 'elFalse', onclick: () => answer(false) }, '✘', h('span', null, 'خطأ'));
        wrap.appendChild(tb.el); wrap.appendChild(card); wrap.appendChild(h('div', { class: 'el-btns' }, bT, bF)); wrap.appendChild(msg); wrap.appendChild(ctrl);
        wrap.__q = s;
        let done = false;
        timer = K().timer(secs(), tb, () => answer(null));
        keyH = e => { if (done) return; if (e.key === 'ArrowRight' || e.key === '1') answer(true); else if (e.key === 'ArrowLeft' || e.key === '2') answer(false); };
        function answer(v) {
          if (done) return; done = true; timer.stop(); bT.disabled = bF.disabled = true;
          const ok = v === s.truth; p.rounds++;
          (s.truth ? bT : bF).classList.add('right'); if (v != null && !ok) (v ? bT : bF).classList.add('wrong');
          if (ok) { p.correct++; p.score += 100 * (+q.difficulty || 1); Sound.good(); }
          else { p.lives--; Sound.bad(); if (p.lives <= 0) { p.out = true; p.outAt = ++outOrder; } }
          log.push({ q, res: { correct: ok }, pts: ok ? 100 : 0, player: p.name });
          msg.className = 'kit-msg ' + (ok ? 'good' : 'bad');
          const right = s.cand != null ? (s.truth ? ' — نعم، «' + s.cand + '» صحيحة' : ' — الصحيح: «' + q.options[q.answer] + '»') : '';
          msg.textContent = (ok ? '✔ أحسنت!' : v == null ? '⌛ انتهى الوقت!' : '✘ خطأ!') + right + (p.out ? ' — ' + p.name + (solo ? ' انتهت قلوبك!' : ' خرج من المنافسة 💥') : '');
          const al = alive();
          const over = solo ? p.out : al.length <= 1;
          ctrl.appendChild(h('button', { class: 'btn primary big', id: 'elNext', onclick: () => over ? end() : advance() }, over ? '🏆 النتيجة' : 'التالي ←'));
        }
      }
      function advance() {
        if (solo) { if (players[0].rounds % 3 === 0) round++; play(); return; }
        let k = turn;
        do { k = (k + 1) % players.length; if (k === 0) round++; } while (players[k].out);
        turn = k; play();
      }
      function end() {
        if (ended) return; ended = true; keyH = null; W.removeEventListener('keydown', onKey); if (timer) timer.stop();
        const al = alive();
        if (!solo) { if (al.length === 1) al[0].score += 500; players.forEach(p => { if (p.out) p.score += p.outAt * 50; }); }
        else players[0].score += players[0].rounds * 20;
        const champ = solo ? null : (al[0] || null);
        const go = () => K().end(finish, game, players, log, { winner: champ ? champ.name : null, res: { scoreLabel: solo ? 'صمدت ' + toAr(players[0].rounds) + ' سؤالًا' : 'الصامد الأخير +٥٠٠ ومكافأة لكل من صمد أطول' } });
        if (champ) { W.QP.confetti && W.QP.confetti(); K().splash(wrap, { icon: '👑', kicker: 'آخر الصامدين', title: champ.name, sub: 'صمد حتى النهاية بـ ' + toAr(champ.correct) + ' إجابة صحيحة', btn: 'النتائج ←', auto: 4000 }, go); }
        else go();
      }
      K().splash(wrap, { icon: '⚖️', kicker: 'صح ولا خطأ', title: 'الإقصاء يبدأ!', sub: (solo ? 'لاعب واحد' : toAr(players.length) + ' لاعبين') + ' — ' + toAr(lives) + ' قلوب لكل لاعب', auto: 2500 }, play);
    }
    return { stop() { stopped = ended = true; keyH = null; W.removeEventListener('keydown', onKey); if (timer) timer.stop(); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.elim = run;
})(window);
