/* bidding.js — مزايدة النقاط: يظهر القسم أولًا، كل فريق يزايد من رصيده على ثقته قبل رؤية السؤال؛ الصح يكسب المزايدة والخطأ يخسرها. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, toAr, shuffle } = W.QP;
  const K = () => W.QP.Kit;
  const DL = { 1: 'سهل', 2: 'متوسط', 3: 'صعب' };
  function run(game, root, opts, finish) {
    let stopped = false, ended = false;
    const wrap = h('div', { class: 'bd-wrap' });
    root.appendChild(wrap);
    let rounds = 8, start = 1000, secret = false;
    K().setup(wrap, {
      icon: '💎', title: 'مزايدة النقاط', min: 2, max: 4, def: 2,
      desc: 'كل فريق يبدأ برصيد. في كل جولة يظهر القسم ومستوى السؤال فقط، فيزايد كل فريق بجزء من رصيده حسب ثقته. بعدها يظهر السؤال: الإجابة الصحيحة تضيف المزايدة لرصيدك، والخاطئة تخصمها. والجولة الأخيرة «كل شيء أو لا شيء».',
      extras: () => [
        ...K().choice('عدد الجولات (قبل الأخيرة)', [[6, '٦'], [8, '٨'], [10, '١٠']], () => rounds, v => { rounds = v; }),
        ...K().choice('رصيد البداية', [[500, '٥٠٠'], [1000, '١٠٠٠'], [2000, '٢٠٠٠']], () => start, v => { start = v; }),
        ...K().choice('المزايدة', [[false, 'مكشوفة'], [true, 'سرّية (كل فريق يخفي مزايدته)']], () => secret, v => { secret = v; })],
      startLabel: '💎 ابدأ المزايدة',
      onStart: cfg => K().load(wrap, cfg.cats, () => { if (!stopped) begin(cfg); })
    });
    function begin(cfg) {
      const P = K().picker({ cats: cfg.cats, types: ['mcq'], filters: cfg.filters, test: K().MCQ });
      const teams = cfg.names.map(name => ({ name, score: start, correct: 0 }));
      const log = []; let r = 0, swapCount = 0;
      const catDeck = []; const nextCat = () => { if (!catDeck.length) catDeck.push(...shuffle(cfg.cats)); return catDeck.shift(); };
      function round() {
        if (ended) return;
        const final = r === rounds;
        const cat = nextCat(); const d = final ? 3 : [1, 2, 2, 3][Math.floor(Math.random() * 4)];
        const c = Bank.cat(cat) || {};
        const bids = teams.map(t => final ? Math.max(0, Math.round(t.score / 2 / 50) * 50) : Math.min(Math.max(0, t.score), 100));
        const lockd = teams.map(() => !secret);
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(teams, -1, { sub: () => 'الرصيد' }));
        wrap.appendChild(h('div', { class: 'bd-cat' + (final ? ' final' : '') },
          h('div', { class: 'champ-kicker' }, final ? '🔥 الجولة الأخيرة: كل شيء أو لا شيء' : 'الجولة ' + toAr(r + 1) + ' من ' + toAr(rounds)),
          h('div', { class: 'bd-cat-name' }, (c.icon || '') + ' ' + (c.name || '')), h('div', { class: 'bd-diff d' + d }, 'المستوى: ' + DL[d])));
        const cards = h('div', { class: 'bd-bids' });
        function drawBids() {
          cards.innerHTML = '';
          teams.forEach((t, i) => {
            const max = Math.max(0, t.score);
            const set = v => { bids[i] = Math.max(0, Math.min(max, v)); drawBids(); };
            const hidden = secret && lockd[i];
            cards.appendChild(h('div', { class: 'bd-card', style: '--tc:' + K().COLORS[i] },
              h('div', { class: 'bd-tname' }, t.name), h('div', { class: 'bd-bal' }, 'الرصيد: ' + K().fmt(t.score)),
              h('div', { class: 'bd-val' }, hidden ? '🔒' : K().fmt(bids[i])),
              hidden ? h('button', { class: 'btn ghost small', onclick: () => { lockd[i] = false; drawBids(); } }, '✏️ تعديل') : [
                h('div', { class: 'bd-step' }, h('button', { class: 'btn ghost small', onclick: () => set(bids[i] - 50) }, '−٥٠'), h('button', { class: 'btn ghost small', onclick: () => set(bids[i] + 50) }, '+٥٠')),
                h('div', { class: 'bd-quick' }, [100, 250, 500].filter(v => v <= max).map(v => h('button', { class: 'chip', onclick: () => set(v) }, K().fmt(v))), h('button', { class: 'chip bd-all', 'data-team': i, onclick: () => set(max) }, 'الكل')),
                secret ? h('button', { class: 'btn small bd-lock', onclick: () => { lockd[i] = true; drawBids(); } }, '🔒 إخفاء المزايدة') : null]));
          });
        }
        drawBids();
        wrap.appendChild(cards);
        wrap.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'bdReveal', onclick: () => { if (secret && !lockd.every(Boolean)) { alert('كل فريق لازم يخفي مزايدته أولًا'); return; } question(cat, d, bids.slice(), final); } }, secret ? '🔓 اكشف المزايدات والسؤال' : '❓ اعرض السؤال')));
      }
      function question(cat, d, bids, final, forced) {
        const q = forced || P.next(d, cat);
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(teams, -1, { sub: (p) => 'المزايدة: ' + K().fmt(bids[teams.indexOf(p)]) }));
        const M = K().mcq(q, null);
        wrap.appendChild(M.el);
        const tb = W.QP.timerBar(); M.el.insertBefore(tb.el, M.el.firstChild);
        const marks = teams.map(() => false);
        const ctrl = h('div', { class: 'kit-ctrl' });
        wrap.appendChild(ctrl);
        let timer = K().timer(final ? 45 : 30, tb, () => {});
        let revealed = false;
        wrap.appendChild(W.QP.Swap.bar(() => {
          if (revealed || ended) return; timer.stop();
          const nq = W.QP.Swap.pick({ used: P.used, current: q, types: ['mcq'], cats: cfg.cats, category: cat, test: K().MCQ });
          if (!nq) return; swapCount++; question(cat, d, bids, final, nq);
        }, swapCount));
        ctrl.appendChild(h('button', { class: 'btn primary big', id: 'bdShow', onclick: reveal }, '📢 إظهار الإجابة'));
        function reveal() {
          if (revealed) return; revealed = true; timer.stop(); M.lock(); M.show(null);
          W.QP.Swap.hide(wrap);
          ctrl.innerHTML = '';
          ctrl.appendChild(h('div', { class: 'kit-msg' }, 'الإجابة: «' + q.options[q.answer] + '» — من جاوب صح؟'));
          const row = h('div', { class: 'bd-marks' });
          const draw = () => { row.innerHTML = ''; teams.forEach((t, i) => row.appendChild(h('button', { class: 'bd-mark' + (marks[i] ? ' on' : ''), 'data-team': i, style: '--tc:' + K().COLORS[i], onclick: () => { marks[i] = !marks[i]; draw(); } }, (marks[i] ? '✔ ' : '✘ ') + t.name))); };
          draw();
          ctrl.appendChild(row);
          ctrl.appendChild(h('button', { class: 'btn primary big', id: 'bdApply', onclick: apply }, '✅ احتساب'));
        }
        function apply() {
          teams.forEach((t, i) => { const b = bids[i]; if (marks[i]) { t.score += b; t.correct++; } else t.score -= b; log.push({ q, res: { correct: marks[i] }, pts: marks[i] ? b : -b, player: t.name }); });
          Sound[marks.some(Boolean) ? 'good' : 'bad']();
          ctrl.innerHTML = '';
          ctrl.appendChild(h('div', { class: 'bd-deltas' }, teams.map((t, i) => h('span', { class: marks[i] ? 'good' : 'bad' }, t.name + ': ' + (marks[i] ? '+' : '−') + K().fmt(bids[i])))));
          wrap.querySelector('.kit-scores').replaceWith(K().scores(teams, -1, { sub: () => 'الرصيد' }));
          if (final) { ctrl.appendChild(h('button', { class: 'btn primary big', id: 'bdNext', onclick: end }, '🏁 النتيجة النهائية')); return; }
          r++;
          ctrl.appendChild(h('button', { class: 'btn primary big', id: 'bdNext', onclick: round }, r === rounds ? '🔥 الجولة الأخيرة ←' : 'الجولة التالية ←'));
        }
        wrap.__q = q;
      }
      function end() { if (ended) return; ended = true; teams.forEach(t => { t.score = Math.max(0, t.score); }); K().end(finish, game, teams, log, { res: { scoreLabel: 'الرصيد النهائي' } }); }
      round();
    }
    return { stop() { stopped = ended = true; } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.bidding = run;
})(window);
