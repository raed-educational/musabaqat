/* mystery.js — الصندوق الغامض: افتح صندوقًا؛ فيه سؤال بقيمة، أو مفاجأة (مكافأة، قنبلة، سرقة، تبديل…). خاطر ×٢ أو العب بأمان. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr } = W.QP;
  const K = () => W.QP.Kit;
  const SURPRISES = [
    { id: 'bonus', icon: '💰', name: 'كنز!', desc: '+٣٠٠ نقطة مباشرة' },
    { id: 'bomb', icon: '💣', name: 'قنبلة!', desc: '−٢٠٠ نقطة' },
    { id: 'steal', icon: '🦹', name: 'سرقة!', desc: 'اسرق ٢٠٠ نقطة من فريق تختاره' },
    { id: 'swap', icon: '🔄', name: 'تبديل!', desc: 'بدّل نقاطك مع فريق تختاره (إن شئت)' },
    { id: 'skip', icon: '⏭', name: 'خسرت الدور', desc: 'لا شيء هذه المرة' },
    { id: 'gift', icon: '🎁', name: 'هدية للجميع', desc: '+١٠٠ لكل الفرق الأخرى' }
  ];
  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null;
    const wrap = h('div', { class: 'mx-wrap' });
    root.appendChild(wrap);
    let nBoxes = 16;
    K().setup(wrap, {
      icon: '🎁', title: 'الصندوق الغامض', min: 2, max: 4, def: 2,
      desc: 'لوحة صناديق مرقّمة. كل فريق يفتح صندوقًا في دوره: إمّا سؤال بقيمة (١٠٠–٥٠٠) تقرر قبل رؤيته تلعبه بأمان أو تخاطر ×٢ (الخطأ يخصم القيمة)، أو مفاجأة: كنز، قنبلة، سرقة، تبديل نقاط، خسارة دور، هدية للجميع.',
      extras: () => K().choice('عدد الصناديق', [[12, '١٢'], [16, '١٦'], [20, '٢٠']], () => nBoxes, v => { nBoxes = v; }),
      startLabel: '🎁 افتح الصناديق',
      onStart: cfg => K().load(wrap, cfg.cats, () => { if (!stopped) begin(cfg); })
    });
    function begin(cfg) {
      const P = K().picker({ cats: cfg.cats, types: ['mcq'], filters: cfg.filters, test: K().MCQ });
      const teams = cfg.names.map(name => ({ name, score: 0, correct: 0 }));
      const nS = Math.round(nBoxes * 0.3);
      const vals = [100, 200, 300, 400, 500];
      const boxes = shuffle([...Array(nBoxes - nS)].map((_, i) => ({ kind: 'q', v: vals[i % 5] })).concat([...Array(nS)].map((_, i) => ({ kind: 's', s: SURPRISES[i % SURPRISES.length] }))));
      const log = []; let turn = 0;
      function board(msg) {
        if (ended) return;
        if (timer) timer.stop();
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(teams, turn));
        if (msg) wrap.appendChild(msg);
        wrap.appendChild(h('div', { class: 'kit-turn' }, '🎯 دور ', h('b', { style: 'color:' + K().COLORS[turn] }, teams[turn].name), ' — اختر صندوقًا'));
        wrap.appendChild(h('div', { class: 'mx-grid n' + nBoxes, style: '--c:' + (nBoxes === 20 ? 5 : 4) + ';--r:' + (nBoxes === 20 ? 4 : nBoxes / 4) }, boxes.map((b, i) => h('button', { class: 'mx-box' + (b.open ? ' open' : ''), 'data-i': i, disabled: !!b.open, onclick: () => openBox(i) },
          b.open ? h('span', { class: 'mx-open' }, b.kind === 'q' ? (b.by != null ? '✔' : '✘') : b.s.icon) : [h('span', { class: 'mx-gift' }, '🎁'), h('b', null, toAr(i + 1))]))));
        wrap.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn ghost small', onclick: () => { if (confirm('إنهاء اللعبة؟')) end(); } }, '🏁 إنهاء')));
        fit();
        if (boxes.every(b => b.open)) end();
      }
      function fit() {
        if (!wrap.isConnected || ended) { W.removeEventListener('resize', fit); return; }
        const g = wrap.querySelector('.mx-grid'); if (!g) return;
        g.style.maxWidth = '';
        const r = g.getBoundingClientRect(); const z = r.width / (g.offsetWidth || 1) || 1;
        const c = nBoxes === 20 ? 5 : 4, rows = Math.ceil(nBoxes / c);
        const avail = (W.innerHeight - r.top - 70) / z;
        const boxH = Math.max(70, avail / rows - 12);
        const w = boxH * 1.25 * c + 12 * (c - 1);
        if (w < g.offsetWidth) g.style.maxWidth = Math.round(w) + 'px';
      }
      W.addEventListener('resize', fit);
      function next(msg) { turn = (turn + 1) % teams.length; board(msg); }
      function pickTeam(label, cb) {
        const others = teams.map((t, i) => i).filter(i => i !== turn);
        return h('div', { class: 'kit-ctrl' }, h('div', { class: 'kit-msg' }, label), others.map(i => h('button', { class: 'btn big mx-target', 'data-team': i, style: 'border-color:' + K().COLORS[i], onclick: () => cb(i) }, teams[i].name)));
      }
      function openBox(i) {
        const b = boxes[i]; if (b.open) return; b.open = true;
        const t = teams[turn];
        Sound.fanfare();
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(teams, turn));
        const stage = h('div', { class: 'card mx-stage' });
        wrap.appendChild(stage);
        if (b.kind === 's') {
          const s = b.s;
          stage.appendChild(h('div', { class: 'mx-reveal' }, h('div', { class: 'mx-big' }, s.icon), h('h2', null, s.name), h('p', null, s.desc)));
          const done = txt => { Sound.good(); next(h('div', { class: 'kit-msg' }, txt)); };
          if (s.id === 'bonus') { t.score += 300; stage.appendChild(h('button', { class: 'btn primary big', id: 'mxNext', onclick: () => done('💰 ' + t.name + ' +٣٠٠') }, 'تمام ←')); }
          else if (s.id === 'bomb') { t.score -= 200; Sound.bad(); stage.appendChild(h('button', { class: 'btn primary big', id: 'mxNext', onclick: () => done('💣 ' + t.name + ' −٢٠٠') }, 'تمام ←')); }
          else if (s.id === 'skip' ) { stage.appendChild(h('button', { class: 'btn primary big', id: 'mxNext', onclick: () => done('⏭ ' + t.name + ' خسر الدور') }, 'تمام ←')); }
          else if (s.id === 'gift') { teams.forEach((x, k) => { if (k !== turn) x.score += 100; }); stage.appendChild(h('button', { class: 'btn primary big', id: 'mxNext', onclick: () => done('🎁 +١٠٠ لكل الفرق الأخرى') }, 'تمام ←')); }
          else if (s.id === 'steal') stage.appendChild(pickTeam('من تسرق منه ٢٠٠؟', k => { teams[k].score -= 200; t.score += 200; done('🦹 ' + t.name + ' سرق ٢٠٠ من ' + teams[k].name); }));
          else if (s.id === 'swap') { stage.appendChild(pickTeam('مع من تبدّل نقاطك؟', k => { const x = teams[k].score; teams[k].score = t.score; t.score = x; done('🔄 تبادل ' + t.name + ' و' + teams[k].name + ' النقاط'); })); stage.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn ghost', id: 'mxNoSwap', onclick: () => done('🔄 ' + t.name + ' قرر عدم التبديل') }, 'لا أبدّل'))); }
          return;
        }
        const d = b.v <= 200 ? 1 : b.v <= 300 ? 2 : 3;
        const q = P.next(d);
        const c = Bank.cat(q.category) || {};
        stage.appendChild(h('div', { class: 'mx-reveal' }, h('div', { class: 'mx-big' }, '❓'), h('h2', null, 'سؤال بقيمة ' + K().fmt(b.v)), h('p', null, 'القسم: ' + (c.icon || '') + ' ' + (c.name || '') + ' — قرروا قبل رؤية السؤال:')));
        stage.appendChild(h('div', { class: 'kit-ctrl' },
          h('button', { class: 'btn big', id: 'mxSafe', onclick: () => ask(1) }, '🛡 العب بأمان (+' + K().fmt(b.v) + ' أو ٠)'),
          h('button', { class: 'btn primary big', id: 'mxRisk', onclick: () => ask(2) }, '🔥 خاطر ×٢ (+' + K().fmt(b.v * 2) + ' أو −' + K().fmt(b.v) + ')')));
        function ask(mult) {
          stage.innerHTML = '';
          const tb = W.QP.timerBar(); const msg = h('div', { class: 'kit-msg' }); const ctrl = h('div', { class: 'kit-ctrl' });
          const M = K().mcq(q, k => answer(k));
          stage.appendChild(h('div', { class: 'kit-turn' }, (mult === 2 ? '🔥 مخاطرة ×٢ — ' : '🛡 ') + t.name + ' — ' + K().fmt(b.v * mult)));
          stage.appendChild(tb.el); stage.appendChild(M.el); stage.appendChild(msg); stage.appendChild(ctrl);
          timer = K().timer(30, tb, () => answer(null));
          let done = false;
          function answer(k) {
            if (done) return; done = true; timer.stop(); M.lock(); M.show(k);
            const ok = k === q.answer; let pts = 0;
            if (ok) { pts = b.v * mult; t.score += pts; t.correct++; b.by = turn; Sound.good(); }
            else { if (mult === 2) { pts = -b.v; t.score += pts; } Sound.bad(); }
            log.push({ q, res: { correct: ok }, pts, player: t.name });
            msg.className = 'kit-msg ' + (ok ? 'good' : 'bad');
            msg.textContent = ok ? '✔ صح! +' + K().fmt(pts) : (k == null ? '⌛ انتهى الوقت' : '✘ خطأ') + (mult === 2 ? ' — المخاطرة كلفتكم ' + K().fmt(b.v) : '') + ' — الإجابة: «' + q.options[q.answer] + '»';
            ctrl.appendChild(h('button', { class: 'btn primary big', id: 'mxNext', onclick: () => next() }, 'الدور التالي ←'));
          }
          wrap.__q = q;
        }
      }
      function end() { if (ended) return; ended = true; if (timer) timer.stop(); K().end(finish, game, teams, log, { res: { scoreLabel: 'نقاط الصناديق والمفاجآت' } }); }
      board();
    }
    return { stop() { stopped = ended = true; if (timer) timer.stop(); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.mystery = run;
})(window);
