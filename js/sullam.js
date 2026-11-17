/* sullam.js — السلم الذهبي: كل إجابة صحيحة درجة للأعلى، والخطأ يرجعك لآخر درجة ذهبية. أول من يصل القمة يفوز. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, toAr } = W.QP;
  const K = () => W.QP.Kit;
  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null;
    const wrap = h('div', { class: 'sl-wrap' });
    root.appendChild(wrap);
    let steps = 15, secs = 30, drop = 'gold';
    K().setup(wrap, {
      icon: '🪜', title: 'السلم الذهبي', min: 1, max: 4, def: 2,
      desc: 'كل فريق يصعد درجة مع كل إجابة صحيحة. كل ٥ درجات درجة ذهبية: مكافأة ٣٠٠ نقطة ومحطة أمان. الإجابة الخاطئة ترجعك لآخر درجة ذهبية وصلتها. كلما صعدت صارت الأسئلة أصعب، وأول من يصل القمة يفوز.',
      extras: () => [
        ...K().choice('طول السلم', [[10, '١٠ درجات'], [15, '١٥ درجة'], [20, '٢٠ درجة']], () => steps, v => { steps = v; }),
        ...K().choice('وقت السؤال', [[20, '٢٠ ث'], [30, '٣٠ ث'], [45, '٤٥ ث'], [0, 'بدون']], () => secs, v => { secs = v; }),
        ...K().choice('عند الخطأ', [['gold', 'ارجع لآخر درجة ذهبية'], ['one', 'انزل درجة واحدة']], () => drop, v => { drop = v; })],
      startLabel: '🪜 ابدأ الصعود',
      onStart: cfg => K().load(wrap, cfg.cats, () => { if (!stopped) begin(cfg); })
    });
    function begin(cfg) {
      const P = K().picker({ cats: cfg.cats, types: ['mcq'], filters: cfg.filters, test: K().MCQ });
      const teams = cfg.names.map(name => ({ name, score: 0, pos: 0, safe: 0, correct: 0 }));
      const log = []; let turn = 0, swapCount = 0, forcedQ = null;
      const isGold = s => s > 0 && s % 5 === 0;
      function ladder() {
        const L = h('div', { class: 'sl-ladder' });
        for (let s = steps; s >= 0; s--) {
          L.appendChild(h('div', { class: 'sl-rung' + (isGold(s) ? ' gold' : '') + (s === steps ? ' top' : '') + (s === 0 ? ' ground' : '') },
            h('span', { class: 'sl-n' }, s === steps ? '🏆' : s === 0 ? 'البداية' : toAr(s)),
            h('span', { class: 'sl-tokens' }, teams.map((t, i) => t.pos === s ? h('i', { class: 'sl-token' + (i === turn ? ' turn' : ''), style: '--tc:' + K().COLORS[i], title: t.name }, toAr(i + 1)) : null))));
        }
        return L;
      }
      function show() {
        if (ended) return;
        if (timer) timer.stop();
        const t = teams[turn];
        const frac = t.pos / steps; const d = frac < 0.34 ? 1 : frac < 0.67 ? 2 : 3;
        const q = forcedQ || P.next(d); forcedQ = null;
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        const note = P.note(); if (note) wrap.appendChild(h('div', { class: 'filter-note' }, note));
        wrap.appendChild(K().scores(teams, turn, { sub: p => 'الدرجة ' + toAr(p.pos) + ' / ' + toAr(steps) }));
        const tb = W.QP.timerBar();
        const msg = h('div', { class: 'kit-msg' });
        const ctrl = h('div', { class: 'kit-ctrl' });
        const M = K().mcq(q, i => answer(i));
        const side = h('div', { class: 'sl-q' }, h('div', { class: 'kit-turn' }, '🎯 دور ', h('b', { style: 'color:' + K().COLORS[turn] }, t.name), ' — على الدرجة ' + toAr(t.pos)), tb.el, M.el, msg, ctrl);
        wrap.appendChild(h('div', { class: 'sl-stage' }, side, ladder()));
        wrap.querySelector('.sl-q').appendChild(W.QP.Swap.bar(() => {
          if (done || ended) return; if (timer) timer.stop();
          const nq = W.QP.Swap.pick({ used: P.used, current: q, types: ['mcq'], cats: cfg.cats, category: q.category, test: K().MCQ });
          if (!nq) return; swapCount++; forcedQ = nq; show();
        }, swapCount));
        timer = K().timer(secs, tb, () => answer(null));
        let done = false;
        function answer(i) {
          if (done) return; done = true; if (timer) timer.stop();
          W.QP.Swap.hide(wrap);
          M.lock(); M.show(i);
          const ok = i === q.answer;
          log.push({ q, res: { correct: ok, timeout: i == null }, pts: 0, player: t.name });
          if (ok) {
            t.pos++; t.correct++; const pts = 100 * (+q.difficulty || 1); t.score += pts; log[log.length - 1].pts = pts;
            let txt = '✔ صح! ' + t.name + ' يصعد للدرجة ' + toAr(t.pos) + ' (+' + K().fmt(pts) + ')';
            if (isGold(t.pos) && t.pos < steps) { t.safe = t.pos; t.score += 300; txt += ' ✨ درجة ذهبية! +٣٠٠ ومحطة أمان'; Sound.fanfare(); } else Sound.good();
            msg.className = 'kit-msg good'; msg.textContent = txt;
          } else {
            const from = t.pos; t.pos = drop === 'gold' ? t.safe : Math.max(t.safe, t.pos - 1);
            Sound.bad(); msg.className = 'kit-msg bad'; msg.textContent = (i == null ? '⌛ انتهى الوقت! ' : '✘ خطأ! ') + 'الإجابة: «' + q.options[q.answer] + '» — ' + (from === t.pos ? t.name + ' يبقى مكانه' : t.name + ' ينزل للدرجة ' + toAr(t.pos));
          }
          const lad = wrap.querySelector('.sl-ladder'); if (lad) lad.replaceWith(ladder());
          if (t.pos >= steps) {
            t.score += 500; Sound.fanfare(); if (W.QP.confetti) W.QP.confetti(wrap);
            msg.textContent = '🏆 ' + t.name + ' وصل القمة! (+٥٠٠)';
            ctrl.appendChild(h('button', { class: 'btn primary big', id: 'slNext', onclick: end }, '🏁 النتيجة'));
            return;
          }
          ctrl.appendChild(h('button', { class: 'btn primary big', id: 'slNext', onclick: () => { turn = (turn + 1) % teams.length; show(); } }, teams.length > 1 ? 'دور ' + teams[(turn + 1) % teams.length].name + ' ←' : 'السؤال التالي ←'));
        }
        wrap.__q = q;
      }
      function end() {
        if (ended) return; ended = true; if (timer) timer.stop();
        const winner = teams.slice().sort((a, b) => b.pos - a.pos || b.score - a.score)[0];
        K().end(finish, game, teams, log, { winner: winner.name, res: { scoreLabel: 'كل إجابة = ١٠٠×الصعوبة، الدرجة الذهبية +٣٠٠، القمة +٥٠٠' } });
      }
      wrap.appendChild(h('div'));
      show();
      root.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn ghost small', onclick: () => { if (confirm('إنهاء اللعبة؟')) end(); } }, '🏁 إنهاء')));
    }
    return { stop() { stopped = ended = true; if (timer) timer.stop(); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.sullam = run;
})(window);
