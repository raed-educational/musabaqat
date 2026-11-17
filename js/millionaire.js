/* millionaire.js — من سيربح المليون: ١٥ سؤالًا، سلّم الجوائز الحقيقي، محطتا أمان (١٬٠٠٠ و٣٢٬٠٠٠)،
   وسائل المساعدة الثلاث: حذف إجابتين، اتصال بصديق (٣٠ ثانية)، الاستعانة بالجمهور. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr, Player } = W.QP;
  const K = () => W.QP.Kit;
  const PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
  const SAFE = [4, 9];
  const money = n => toAr(Number(n).toLocaleString('en'));
  const diffFor = i => i < 5 ? 1 : i < 10 ? 2 : 3;

  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null, callT = null, tid = 0;
    const wrap = h('div', { class: 'mm-wrap' });
    root.appendChild(wrap);
    const fixedCats = game.filter.cats.length < Bank.cats.length;
    let secs = 0;
    K().setup(wrap, {
      icon: '💰', title: game.title && game.title !== 'من سيربح المليون' ? game.title : 'من سيربح المليون', cls: 'mm-setup', min: 1, max: 1, def: 1,
      label: () => 'اسم المتسابق (أو اسم الفريق)',
      desc: '١٥ سؤالًا تتصاعد صعوبتها حتى المليون. محطتا الأمان عند ١٬٠٠٠ و٣٢٬٠٠٠. لك ثلاث وسائل مساعدة، وتقدر تنسحب بجائزتك في أي سؤال قبل ما تثبّت إجابتك.',
      rules: ['الأسئلة ١–٥ سهلة، ٦–١٠ متوسطة، ١١–١٥ صعبة.', 'اختر الإجابة ثم ثبّتها: «إجابة نهائية».', 'الإجابة الخاطئة ترجعك لآخر محطة أمان.'],
      noCats: fixedCats,
      extras: () => K().choice('وقت السؤال', [[0, 'بدون وقت (مثل البرنامج)'], [30, '٣٠ ث'], [45, '٤٥ ث'], [60, '٦٠ ث']], () => secs, v => { secs = v; }),
      startLabel: '💰 ابدأ اللعبة',
      onStart: cfg => { const cats = fixedCats ? game.filter.cats : cfg.cats; K().load(wrap, cats, () => { if (!stopped) begin(cfg, cats); }); }
    });

    function begin(cfg, cats) {
      const name = cfg.names[0];
      const spec = { cats, types: ['mcq'], filters: cfg.filters, test: q => q.options && q.options.length === 4 && !/^(صح|خطأ)$/.test(q.options[0]) && (!game.filter.subs || game.filter.subs.includes(q.subcategory)) };
      const P = K().picker(spec);
      const st = { i: 0, score: 0, correct: 0, wrong: 0, best: 0, log: [], start: Date.now() };
      const life = { fifty: true, call: true, aud: true };
      let level = 0, banked = 0, swapCount = 0;

      function ladder() {
        return h('ol', { class: 'mm-ladder' }, PRIZES.map((p, i) => i).reverse().map(i => h('li', { class: (i === level ? 'cur ' : '') + (i < level ? 'done ' : '') + (SAFE.includes(i) ? 'safe' : '') },
          h('span', { class: 'mm-n' }, toAr(i + 1)), h('span', { class: 'mm-diamond' }, i < level ? '◆' : ''), h('b', null, money(PRIZES[i])))));
      }

      let forcedQ = null;
      function showForced(q) { forcedQ = q; show(); }
      function show() {
        if (ended) return;
        clear();
        const q = forcedQ || P.next(diffFor(level));
        forcedQ = null;
        if (!q) return end('lost');
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        const note = P.note();
        if (note && level === 0) wrap.appendChild(h('div', { class: 'filter-note' }, note));
        const order = shuffle([0, 1, 2, 3]); wrap.__q = q;
        let chosen = null, locked = false;
        const optEls = order.map((i, k) => h('button', { class: 'mm-opt', 'data-i': i, onclick: () => select(i) }, h('span', { class: 'mm-key' }, 'أبجد'[k] + ':'), h('span', { class: 'mm-txt' }, q.options[i])));
        const lifeBar = h('div', { class: 'mm-lifes' },
          h('button', { class: 'mm-life', id: 'mmFifty', disabled: !life.fifty, title: 'حذف إجابتين', onclick: fifty }, '٥٠:٥٠'),
          h('button', { class: 'mm-life', id: 'mmCall', disabled: !life.call, title: 'اتصال بصديق', onclick: call }, '📞'),
          h('button', { class: 'mm-life', id: 'mmAud', disabled: !life.aud, title: 'الاستعانة بالجمهور', onclick: aud }, '👥'));
        const extra = h('div', { class: 'mm-extra' });
        const final = h('div', { class: 'mm-final' });
        const tb = W.QP.timerBar();
        const c = Bank.cat(q.category) || {};
        const main = h('div', { class: 'mm-main' },
          h('div', { class: 'mm-top' }, lifeBar,
            h('div', { class: 'mm-now' }, 'السؤال ', h('b', null, toAr(level + 1)), ' بقيمة ', h('b', { class: 'mm-gold' }, money(PRIZES[level]))),
            h('button', { class: 'btn ghost small', id: 'mmWalk', onclick: walk }, '🚪 انسحب بـ ' + money(banked))),
          tb.el,
          h('div', { class: 'mm-cat' }, (c.icon || '') + ' ' + (c.name || '') + (q.subcategory ? ' — ' + q.subcategory : '')),
          h('div', { class: 'mm-qbox' }, q.question),
          h('div', { class: 'mm-opts' }, optEls),
          final, extra);
        main.appendChild(W.QP.Swap.bar(() => {
          if (locked || ended) return;
          const nq = W.QP.Swap.pick({ used: P.used, current: q, types: ['mcq'], cats: cats, category: q.category, test: x => x.options && x.options.length === 4 && !/^(صح|خطأ)$/.test(x.options[0]) });
          if (!nq) return;
          swapCount++; clear(); showForced(nq);
        }, swapCount));
        wrap.appendChild(h('div', { class: 'mm-stage' }, main, ladder()));
        if (secs) timer = K().timer(secs, tb, () => { if (!locked) { locked = true; reveal(null, true); } }); else tb.el.classList.add('hidden');

        function select(i) {
          if (locked) return;
          chosen = i; Sound.tick();
          optEls.forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
          final.innerHTML = '';
          final.appendChild(h('div', { class: 'mm-ask' }, 'هل هذه إجابتك النهائية؟'));
          final.appendChild(h('div', { class: 'row center' },
            h('button', { class: 'btn primary big', id: 'mmLock', onclick: lock }, '🔒 إجابة نهائية'),
            h('button', { class: 'btn ghost', onclick: () => { chosen = null; optEls.forEach(b => b.classList.remove('sel')); final.innerHTML = ''; } }, 'تراجع')));
        }
        function lock() {
          if (locked || chosen == null) return; locked = true;
          if (timer) timer.stop();
          W.QP.Swap.hide(wrap);
          optEls.forEach(b => { b.disabled = true; if (+b.dataset.i === chosen) b.classList.add('locked'); });
          lifeBar.querySelectorAll('button').forEach(b => b.disabled = true);
          W.document.getElementById('mmWalk').disabled = true;
          final.innerHTML = ''; final.appendChild(h('div', { class: 'mm-ask pulse' }, '…'));
          let beats = 0; const hb = K().fast() ? 0 : setInterval(() => { Sound.beep(110, .18, 'sine'); if (++beats > 6) clearInterval(hb); }, 380);
          tid = K().after(level < 5 ? 1600 : level < 10 ? 2400 : 3200, () => { clearInterval(hb); reveal(chosen); });
        }
        function reveal(i, timeout) {
          W.QP.Swap.hide(wrap);
          const ok = i === q.answer;
          optEls.forEach(b => { b.disabled = true; const bi = +b.dataset.i; if (bi === q.answer) b.classList.add('right'); else if (bi === i) b.classList.add('wrong'); });
          st.log.push({ q, res: { correct: ok, timeout: !!timeout, given: i != null ? q.options[i] : '' }, pts: ok ? PRIZES[level] : 0 });
          final.innerHTML = '';
          if (ok) {
            st.correct++; banked = PRIZES[level]; Sound.good();
            const safeNow = SAFE.includes(level), won = level === PRIZES.length - 1;
            if (won) { Sound.fanfare(); if (W.QP.confetti) W.QP.confetti(wrap); }
            final.appendChild(h('div', { class: 'mm-result good' }, won ? '🎉 مبروك! ربحت المليون!' : safeNow ? '✅ صح! وضمنت ' + money(banked) + ' (محطة أمان)' : '✅ إجابة صحيحة! معك الآن ' + money(banked)));
            if (q.explanation) final.appendChild(h('div', { class: 'fb-exp' }, q.explanation));
            final.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'mmNext', onclick: () => { if (won) return end('won'); level++; show(); } }, won ? '🏆 استلم الجائزة' : 'السؤال التالي ←')));
          } else {
            st.wrong++; Sound.bad();
            banked = level > 9 ? PRIZES[9] : level > 4 ? PRIZES[4] : 0;
            final.appendChild(h('div', { class: 'mm-result bad' }, (timeout ? '⌛ انتهى الوقت! ' : '❌ إجابة خاطئة! ') + 'الإجابة الصحيحة: «' + q.options[q.answer] + '». تخرج بـ ' + money(banked)));
            if (q.explanation) final.appendChild(h('div', { class: 'fb-exp' }, q.explanation));
            final.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'mmNext', onclick: () => end('lost') }, 'النتيجة')));
          }
        }
        function walk() {
          if (locked) return;
          if (!confirm('تنسحب وتأخذ ' + money(banked) + '؟')) return;
          locked = true; if (timer) timer.stop();
          optEls.forEach(b => { b.disabled = true; if (+b.dataset.i === q.answer) b.classList.add('right'); });
          final.innerHTML = '';
          final.appendChild(h('div', { class: 'mm-result' }, '🚪 انسحبت بـ ' + money(banked) + '. الإجابة كانت: «' + q.options[q.answer] + '»'));
          final.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'mmNext', onclick: () => end('walk') }, 'النتيجة')));
        }
        function fifty() {
          if (!life.fifty || locked) return; life.fifty = false; Sound.combo();
          const wrong = shuffle(optEls.filter(b => +b.dataset.i !== q.answer)).slice(0, 2);
          wrong.forEach(b => { b.disabled = true; b.classList.add('gone'); if (+b.dataset.i === chosen) { chosen = null; final.innerHTML = ''; } });
          lifeBar.querySelector('#mmFifty').disabled = true;
        }
        function live() { return optEls.filter(b => !b.classList.contains('gone')).map(b => +b.dataset.i); }
        function call() {
          if (!life.call || locked) return; life.call = false; Sound.combo();
          lifeBar.querySelector('#mmCall').disabled = true;
          if (timer) timer.stop();
          const left = h('b', { class: 'mm-call-n' }, toAr(30));
          const box = h('div', { class: 'mm-call' }, h('div', null, '📞 اتصال بصديق — اقرأ له السؤال والخيارات: ', left, ' ثانية'));
          const sug = h('button', { class: 'btn ghost small', id: 'mmFriend', onclick: () => { sug.remove(); friendSays(); } }, '🤖 اقتراح صديق افتراضي');
          box.appendChild(sug); extra.appendChild(box);
          callT = W.QP.Timer(30, l => { left.textContent = toAr(Math.ceil(l)); }, () => { box.classList.add('over'); Sound.bad(); if (timer && secs) {} }).start();
          function friendSays() {
            const d = +q.difficulty || 2; const conf = d === 1 ? 0.9 : d === 2 ? 0.72 : 0.5;
            const L = live(); const right = Math.random() < conf; const pick = right ? q.answer : shuffle(L.filter(i => i !== q.answer))[0];
            const pct = Math.round((right ? conf : 1 - conf) * 60 + 35 + Math.random() * 5);
            box.appendChild(h('div', { class: 'mm-friend' }, '🗣 «أظن الإجابة: ' + q.options[pick] + '… متأكد تقريبًا ' + toAr(Math.min(95, pct)) + '٪»'));
          }
        }
        function aud() {
          if (!life.aud || locked) return; life.aud = false; Sound.combo();
          lifeBar.querySelector('#mmAud').disabled = true;
          const L = live(); const d = +q.difficulty || 2;
          const base = d === 1 ? 58 + Math.random() * 27 : d === 2 ? 40 + Math.random() * 25 : 24 + Math.random() * 24;
          const votes = {}; let rest = 100 - Math.round(base); votes[q.answer] = Math.round(base);
          const others = shuffle(L.filter(i => i !== q.answer));
          others.forEach((i, k) => { const v = k === others.length - 1 ? rest : Math.round(Math.random() * rest * 0.7); votes[i] = v; rest -= v; });
          const chart = h('div', { class: 'mm-aud' }, order.map((i, k) => { const v = votes[i] || 0; return h('div', { class: 'mm-bar' }, h('div', { class: 'mm-bar-col' }, h('i', { style: 'height:' + (L.includes(i) ? v : 0) + '%' })), h('b', null, toAr(L.includes(i) ? v : 0) + '٪'), h('span', null, 'أبجد'[k])); }));
          extra.appendChild(h('div', { class: 'mm-audbox' }, h('div', null, '👥 تصويت الجمهور (محاكاة)'), chart));
        }
      }

      function clear() { if (timer) { timer.stop(); timer = null; } if (callT) { callT.stop(); callT = null; } clearTimeout(tid); }

      function end(reason) {
        if (ended) return; ended = true; clear();
        st.score = banked; st.i = level;
        finish({ game, st, opts: {}, reason, money: true, capped: true, recordScore: Math.round(banked / 200), hostName: name });
      }

      K().splash(wrap, { icon: '💰', kicker: 'المتسابق: ' + name, title: 'من سيربح المليون', sub: '١٥ سؤالًا تفصلك عن المليون!', btn: 'ابدأ السؤال الأول', auto: 2500 }, show);
    }

    return { stop() { stopped = ended = true; if (timer) timer.stop(); if (callT) callT.stop(); clearTimeout(tid); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.millionaire = run;
  W.QP.MILLION_PRIZES = PRIZES;
})(window);
