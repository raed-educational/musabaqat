/* rattib.js — رتّب الإجابة: اسحب العناصر (لمس أو فأرة) لترتيبها، مع درجات جزئية ووضع الفرق. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr } = W.QP;
  const K = () => W.QP.Kit;
  let dataP = null;
  function loadData() {
    if (W.ORDER_Q) return Promise.resolve();
    return dataP = dataP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'data/order.js'; s.onload = res; s.onerror = () => { dataP = null; rej(new Error('order')); }; document.head.appendChild(s); });
  }
  // drag & drop list with pointer events (touch + mouse) and ▲▼ buttons
  function sortable(items) {
    const list = h('ol', { class: 'rt-list' });
    const make = txt => {
      const li = h('li', { class: 'rt-item', 'data-v': txt },
        h('span', { class: 'rt-grip', 'aria-hidden': 'true' }, '⋮⋮'), h('span', { class: 'rt-txt' }, txt),
        h('span', { class: 'rt-arrows' }, h('button', { type: 'button', class: 'rt-up', 'aria-label': 'لأعلى', onclick: e => { e.stopPropagation(); const p = li.previousElementSibling; if (p) list.insertBefore(li, p); Sound.tick(); } }, '▲'),
          h('button', { type: 'button', class: 'rt-down', 'aria-label': 'لأسفل', onclick: e => { e.stopPropagation(); const n = li.nextElementSibling; if (n) list.insertBefore(n, li); Sound.tick(); } }, '▼')));
      li.addEventListener('pointerdown', e => {
        if (e.target.closest('button') || list.classList.contains('locked')) return;
        e.preventDefault(); li.classList.add('drag'); const D = document;
        const move = ev => {
          const els = [...list.children].filter(x => x !== li);
          let before = null;
          for (const x of els) { const r = x.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { before = x; break; } }
          if (before !== li.nextElementSibling || (!before && list.lastElementChild !== li)) { list.insertBefore(li, before); }
        };
        const up = () => { li.classList.remove('drag'); D.removeEventListener('pointermove', move); D.removeEventListener('pointerup', up); D.removeEventListener('pointercancel', up); Sound.tick(); };
        D.addEventListener('pointermove', move); D.addEventListener('pointerup', up); D.addEventListener('pointercancel', up);
      });
      return li;
    };
    items.forEach(t => list.appendChild(make(t)));
    return { el: list, order: () => [...list.children].map(x => x.dataset.v), lock() { list.classList.add('locked'); list.querySelectorAll('button').forEach(b => b.disabled = true); } };
  }

  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null;
    const wrap = h('div', { class: 'rt-wrap' });
    root.appendChild(wrap);
    let count = 8, secs = 60;
    K().setup(wrap, {
      icon: '🔢', title: 'رتّب الإجابة', min: 1, max: 4, def: 2,
      desc: 'رتّب العناصر بالترتيب الصحيح: سور المصحف، أحداث السيرة، الخلفاء والملوك، وفيات العلماء والصحابة، أركان الإيمان والإسلام، الحروف… اسحب بإصبعك أو بالفأرة، أو استخدم الأسهم. كل عنصر في مكانه الصحيح له نقاطه.',
      extras: () => [
        ...K().choice('عدد الأسئلة', [[6, '٦'], [8, '٨'], [12, '١٢']], () => count, v => { count = v; }),
        ...K().choice('وقت السؤال', [[45, '٤٥ ث'], [60, '٦٠ ث'], [90, '٩٠ ث'], [0, 'بدون']], () => secs, v => { secs = v; })],
      startLabel: '🔢 ابدأ الترتيب',
      onStart: cfg => { wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ التحميل…')); loadData().then(() => { if (!stopped) begin(cfg); }); }
    });
    function begin(cfg) {
      const fl = cfg.filters || {};
      const pool = W.ORDER_Q;
      const used = new Set(); let relaxed = false;
      const catDeck = [];
      function pick() {
        if (!catDeck.length) catDeck.push(...shuffle(cfg.cats));
        const cat = catDeck.shift();
        const layers = [q => q.category === cat && (!fl.diff || q.difficulty === fl.diff) && (!fl.stage || q.stage === fl.stage), q => q.category === cat && (!fl.diff || q.difficulty === fl.diff), q => q.category === cat, q => cfg.cats.includes(q.category), () => true];
        for (const [i, L] of layers.entries()) { const l = pool.filter(q => L(q) && !used.has(q.id)); if (l.length) { if (i > 0 && i < 3 && (fl.diff || fl.stage)) relaxed = true; const q = l[Math.floor(Math.random() * l.length)]; used.add(q.id); return q; } }
        return pool[0];
      }
      const qs = []; for (let i = 0; i < count * cfg.names.length && i < 48; i++) qs.push(pick());
      const teams = cfg.names.map(name => ({ name, score: 0, correct: 0 }));
      const log = []; let i = 0;
      function show() {
        if (ended) return;
        if (i >= qs.length) return end();
        const q = qs[i]; const turn = i % teams.length; const t = teams[turn];
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        if (relaxed && i === 0) wrap.appendChild(h('div', { class: 'filter-note' }, 'تنبيه: بعض الأقسام ليس فيها أسئلة ترتيب كافية بالاختيار المحدد، فاستُكملت من أقرب مستوى.'));
        wrap.appendChild(K().scores(teams, teams.length > 1 ? turn : -1));
        const c = Bank.cat(q.category) || {};
        let sh = shuffle(q.items); let g = 0; while (sh.join() === q.items.join() && g++ < 5) sh = shuffle(q.items);
        const S = sortable(sh);
        const tb = W.QP.timerBar();
        const msg = h('div', { class: 'kit-msg' }); const ctrl = h('div', { class: 'kit-ctrl' });
        const check = h('button', { class: 'btn primary big', id: 'rtCheck', onclick: () => grade(false) }, '✅ تحقق من الترتيب');
        ctrl.appendChild(check);
        wrap.appendChild(h('div', { class: 'kit-turn' }, (teams.length > 1 ? '🎯 دور ' : '') , teams.length > 1 ? h('b', null, t.name) : null, ' — السؤال ' + toAr(Math.floor(i / teams.length) + 1) + ' من ' + toAr(Math.ceil(qs.length / teams.length))));
        wrap.appendChild(h('div', { class: 'q-card rt-card' },
          h('div', { class: 'q-meta' }, h('span', { class: 'tag light' }, (c.icon || '') + ' ' + (c.name || '')), q.subcategory ? h('span', { class: 'tag light' }, q.subcategory) : null, h('span', { class: 'tag d' + q.difficulty }, ({ 1: 'سهل', 2: 'متوسط', 3: 'صعب' })[q.difficulty])),
          h('h2', { class: 'q-text' }, q.question), tb.el,
          h('div', { class: 'rt-ends' }, h('span', null, '⬆ الأول')), S.el, h('div', { class: 'rt-ends' }, h('span', null, '⬇ الأخير')), msg, ctrl));
        timer = K().timer(secs, tb, () => grade(true));
        let graded = false;
        function grade(timeout) {
          if (graded) return; graded = true; if (timer) timer.stop();
          S.lock();
          const got = S.order(); let right = 0;
          [...S.el.children].forEach((li, k) => { const ok = got[k] === q.items[k]; if (ok) right++; li.classList.add(ok ? 'ok' : 'no'); });
          const frac = right / q.items.length; const full = right === q.items.length;
          const pts = Math.round(100 * (q.difficulty || 1) * frac);
          t.score += pts; if (full) t.correct++;
          log.push({ q, res: { correct: full, partial: full ? 0 : frac }, pts, player: t.name });
          Sound[full ? 'good' : 'bad']();
          msg.className = 'kit-msg ' + (full ? 'good' : frac >= 0.5 ? '' : 'bad');
          msg.textContent = (timeout ? '⌛ انتهى الوقت — ' : '') + (full ? '✔ ترتيب كامل! ' : '◐ ' + toAr(right) + ' من ' + toAr(q.items.length) + ' في مكانها — ') + '+' + K().fmt(pts);
          ctrl.innerHTML = '';
          ctrl.appendChild(h('div', { class: 'rt-answer' }, h('b', null, 'الترتيب الصحيح: '), h('ol', null, q.items.map((x, k) => h('li', null, x, q.values ? h('small', null, ' (' + q.values[k] + ')') : null)))));
          if (q.source) ctrl.appendChild(h('div', { class: 'source' }, h('b', null, 'المصدر: '), q.source));
          ctrl.appendChild(h('button', { class: 'btn primary big', id: 'rtNext', onclick: () => { i++; show(); } }, i + 1 >= qs.length ? '🏁 النتيجة' : 'التالي ←'));
        }
        wrap.__q = q;
      }
      function end() { if (ended) return; ended = true; if (timer) timer.stop(); K().end(finish, game, teams, log, { res: { scoreLabel: 'نقاط السؤال = ١٠٠ × الصعوبة × نسبة العناصر في مكانها' } }); }
      show();
    }
    return { stop() { stopped = ended = true; if (timer) timer.stop(); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.rattib = run;
})(window);
