/* engine.js — game engines. All games in the catalog are configurations of these engines. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, mulberry32, hashStr, fillMatches, toAr, DIFF, TYPES, Board, Player, todayKey, LS } = W.QP;

  // =====================================================================
  // Question renderers (one per question format). render(q, el, done, ctx)
  // done({correct: bool, partial: 0..1, mult: number, given: string})
  // =====================================================================
  function answerText(q) {
    if (q.type === 'mcq' || q.type === 'tf' || q.type === 'who') return q.options[q.answer];
    if (q.type === 'fill') return q.answer;
    if (q.type === 'order') return q.items.join(' ← ');
    if (q.type === 'match') return q.pairs.map(p => p[0] + ' = ' + p[1]).join('، ');
    return '';
  }
  const R = {};
  R.mcq = function (q, el, done, ctx) {
    const order = shuffle(q.options.map((o, i) => i), ctx.rnd);
    const btns = [];
    const box = h('div', { class: 'options' + (q.type === 'tf' ? ' tf' : '') });
    order.forEach((i, k) => {
      const b = h('button', { class: 'opt', 'data-i': i, onclick: () => pick(i) }, h('span', { class: 'opt-key' }, q.type === 'tf' ? '' : 'أبجد'[k] || ''), h('span', null, q.options[i]));
      btns.push(b); box.appendChild(b);
    });
    el.appendChild(box);
    let locked = false;
    function pick(i) {
      if (locked) return; locked = true;
      btns.forEach(b => { b.disabled = true; const bi = +b.dataset.i; if (bi === q.answer) b.classList.add('correct'); else if (bi === i) b.classList.add('wrong'); });
      done({ correct: i === q.answer, given: q.options[i] });
    }
    return {
      lock() { locked = true; btns.forEach(b => { b.disabled = true; if (+b.dataset.i === q.answer) b.classList.add('correct'); }); },
      fifty() { const wrong = shuffle(btns.filter(b => +b.dataset.i !== q.answer && !b.disabled)); wrong.slice(0, Math.max(0, wrong.length - 1)).forEach(b => { b.disabled = true; b.classList.add('gone'); }); },
      pickIndex: pick, buttons: btns
    };
  };
  R.tf = R.mcq;
  R.who = function (q, el, done, ctx) {
    let shown = 1;
    const list = h('ol', { class: 'clues' });
    const more = h('button', { class: 'btn ghost small', onclick: reveal }, '🔎 تلميح آخر');
    function draw() { list.innerHTML = ''; q.clues.slice(0, shown).forEach((c, i) => list.appendChild(h('li', { class: 'clue', style: { animationDelay: '0s' } }, c))); more.disabled = shown >= q.clues.length; more.textContent = shown >= q.clues.length ? 'كل التلميحات ظاهرة' : `🔎 تلميح آخر (${toAr(q.clues.length - shown)} متبقية)`; }
    function reveal() { if (shown < q.clues.length) { shown++; draw(); } }
    el.appendChild(list); el.appendChild(more); draw();
    const timer = setInterval(() => { if (shown < q.clues.length) { shown++; draw(); } else clearInterval(timer); }, Math.max(4000, ((ctx.perQ || 40) * 1000) / (q.clues.length + 1)));
    const inner = R.mcq(q, el, res => { clearInterval(timer); const used = shown; shown = q.clues.length; draw(); more.disabled = true; res.mult = Math.max(0.4, 1 - (used - 1) * 0.2); done(res); }, ctx);
    return Object.assign({}, inner, { lock() { clearInterval(timer); inner.lock(); }, cleanup() { clearInterval(timer); } });
  };
  R.fill = function (q, el, done, ctx) {
    const inp = h('input', { class: 'fill-input', type: 'text', placeholder: 'اكتب إجابتك هنا…', autocomplete: 'off', dir: 'rtl' });
    const go = h('button', { class: 'btn primary', onclick: submit }, 'تحقق');
    const hint = ctx.hints ? h('button', { class: 'btn ghost small', onclick: () => { hintBox.textContent = 'تبدأ بـ: «' + String(q.answer).trim().split(' ')[0].slice(0, 2) + '…» — عدد الكلمات: ' + toAr(String(q.answer).trim().split(/\s+/).length); used = true; } }, '💡 تلميح') : null;
    const hintBox = h('div', { class: 'hint' });
    let used = false, locked = false;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    el.appendChild(h('div', { class: 'fill-row' }, inp, go, hint)); el.appendChild(hintBox);
    setTimeout(() => inp.focus(), 50);
    function submit() { if (locked || !inp.value.trim()) return; locked = true; inp.disabled = go.disabled = true; const ok = fillMatches(inp.value, q); inp.classList.add(ok ? 'correct' : 'wrong'); done({ correct: ok, given: inp.value, mult: used ? 0.6 : 1 }); }
    return { lock() { locked = true; inp.disabled = go.disabled = true; } };
  };
  R.order = function (q, el, done, ctx) {
    let pool = shuffle(q.items.map((t, i) => i), ctx.rnd);
    if (pool.every((v, i) => v === i) && pool.length > 1) pool = pool.reverse();
    const chosen = []; let locked = false;
    const slots = h('ol', { class: 'order-slots' }), bank = h('div', { class: 'order-bank' });
    const check = h('button', { class: 'btn primary', onclick: submit, disabled: true }, 'تحقق من الترتيب');
    const reset = h('button', { class: 'btn ghost small', onclick: () => { if (locked) return; chosen.length = 0; draw(); } }, '↺ إعادة');
    function draw() {
      slots.innerHTML = ''; bank.innerHTML = '';
      q.items.forEach((_, k) => slots.appendChild(h('li', { class: 'slot' + (chosen[k] != null ? ' filled' : ''), onclick: () => { if (!locked && chosen[k] != null) { chosen.splice(k, 1); draw(); } } }, chosen[k] != null ? q.items[chosen[k]] : '…')));
      pool.filter(i => !chosen.includes(i)).forEach(i => bank.appendChild(h('button', { class: 'chip', onclick: () => { if (!locked) { chosen.push(i); draw(); } } }, q.items[i])));
      check.disabled = chosen.length !== q.items.length || locked;
    }
    el.appendChild(h('p', { class: 'muted small' }, 'اضغط العناصر بالترتيب الصحيح (من الأول إلى الأخير). اضغط عنصرًا في القائمة لإزالته.'));
    el.appendChild(bank); el.appendChild(slots); el.appendChild(h('div', { class: 'row' }, check, reset)); draw();
    function submit() {
      locked = true; let right = 0;
      [...slots.children].forEach((li, k) => { const ok = chosen[k] === k; if (ok) right++; li.classList.add(ok ? 'correct' : 'wrong'); });
      check.disabled = true; done({ correct: right === q.items.length, partial: right / q.items.length, given: chosen.map(i => q.items[i]).join(' ← ') });
    }
    return { lock() { locked = true; check.disabled = true; } };
  };
  R.match = function (q, el, done, ctx) {
    const right = shuffle(q.pairs.map((p, i) => i), ctx.rnd);
    const map = {}; let sel = null, locked = false;
    const colors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16'];
    const L = h('div', { class: 'match-col' }), Rr = h('div', { class: 'match-col' });
    const check = h('button', { class: 'btn primary', onclick: submit, disabled: true }, 'تحقق من التوصيل');
    function draw() {
      L.innerHTML = ''; Rr.innerHTML = '';
      q.pairs.forEach((p, i) => { const c = map[i] != null ? colors[i % colors.length] : null; L.appendChild(h('button', { class: 'chip match-item' + (sel === i ? ' sel' : ''), style: c ? { borderColor: c, background: c + '22' } : null, onclick: () => { if (!locked) { sel = i; draw(); } } }, p[0])); });
      right.forEach(j => { const owner = Object.keys(map).find(k => map[k] === j); const c = owner != null ? colors[owner % colors.length] : null;
        Rr.appendChild(h('button', { class: 'chip match-item', 'data-j': j, style: c ? { borderColor: c, background: c + '22' } : null, onclick: () => { if (locked || sel == null) return; Object.keys(map).forEach(k => { if (map[k] === j) delete map[k]; }); map[sel] = j; sel = null; draw(); } }, q.pairs[j][1])); });
      check.disabled = Object.keys(map).length !== q.pairs.length || locked;
    }
    el.appendChild(h('p', { class: 'muted small' }, 'اختر عنصرًا من العمود الأول ثم ما يقابله من العمود الثاني.'));
    el.appendChild(h('div', { class: 'match-grid' }, L, Rr)); el.appendChild(check); draw();
    function submit() {
      locked = true; let ok = 0; q.pairs.forEach((p, i) => { if (map[i] === i) ok++; });
      [...L.children].forEach((b, i) => b.classList.add(map[i] === i ? 'correct' : 'wrong'));
      check.disabled = true; done({ correct: ok === q.pairs.length, partial: ok / q.pairs.length, given: ok + '/' + q.pairs.length });
    }
    return { lock() { locked = true; check.disabled = true; } };
  };

  function sourceBlock(q) {
    const lvl = q.verificationLevel || (q.verified ? 'primary' : 'none');
    const badge = lvl === 'primary' ? h('span', { class: 'badge ok', title: q.verifiedAgainst || '' }, '✔ موثّق آليًا من نص المصدر')
      : lvl === 'book' ? h('span', { class: 'badge ok' }, '📗 من كتاب القيم القرآنية')
      : lvl === 'school' ? h('span', { class: 'badge ref' }, '📘 من منهج المرحلة المتوسطة')
      : lvl === 'reference' ? h('span', { class: 'badge ref', title: q.verifiedAgainst || '' }, '🔗 مأخوذ من مرجع مفتوح')
      : h('span', { class: 'badge pending' }, '⏳ بانتظار المراجعة العلمية');
    return h('div', { class: 'source' }, h('div', null, h('b', null, 'المصدر: '), q.source || '—'), badge);
  }
  function feedback(q, res, extra) {
    return h('div', { class: 'feedback ' + (res.correct ? 'good' : res.partial ? 'mid' : 'bad') },
      h('div', { class: 'fb-title' }, res.correct ? '✔ إجابة صحيحة' : res.timeout ? '⌛ انتهى الوقت' : res.partial ? `◐ إجابة جزئية (${Math.round(res.partial * 100)}٪)` : '✘ إجابة خاطئة'),
      !res.correct ? h('div', { class: 'fb-answer' }, h('b', null, 'الإجابة الصحيحة: '), answerText(q)) : null,
      q.explanation ? h('div', { class: 'fb-exp' }, q.explanation) : null, sourceBlock(q), extra || null);
  }
  function qHeader(q) {
    const c = Bank.cat(q.category) || {};
    return h('div', { class: 'q-meta' }, h('span', { class: 'tag', style: { background: (c.color || '#555') + '22', color: c.color } }, (c.icon || '') + ' ' + (c.name || q.category)),
      q.subcategory ? h('span', { class: 'tag light' }, q.subcategory) : null, h('span', { class: 'tag light' }, TYPES[q.type] || q.type), h('span', { class: 'tag d' + q.difficulty }, DIFF[q.difficulty] || ''));
  }
  function questionCard(q, done, ctx) {
    const card = h('div', { class: 'q-card' }); card.appendChild(qHeader(q));
    card.appendChild(h('h2', { class: 'q-text' }, q.question));
    const body = h('div', { class: 'q-body' }); card.appendChild(body);
    const ctrl = (R[q.type] || R.mcq)(q, body, done, ctx || {});
    return { card, ctrl };
  }

  // =====================================================================
  // Timer helper
  // =====================================================================
  function Timer(seconds, onTick, onEnd) {
    let left = seconds, id = null, start = Date.now(), stopped = false;
    const t = { get left() { return left; }, get frac() { return left / seconds; },
      start() { start = Date.now(); id = setInterval(() => { left = Math.max(0, seconds - (Date.now() - start) / 1000); onTick && onTick(left); if (left <= 0) { t.stop(); onEnd && onEnd(); } }, 100); return t; },
      stop() { if (id) clearInterval(id); id = null; stopped = true; }, add(s) { seconds += s; }, sub(s) { seconds -= s; } };
    return t;
  }
  function timerBar() { const fill = h('div', { class: 'tbar-fill' }); const label = h('span', { class: 'tbar-label' }); const el = h('div', { class: 'tbar' }, fill, label); return { el, set(left, frac) { fill.style.width = Math.max(0, frac * 100) + '%'; fill.classList.toggle('warn', frac < .3); label.textContent = toAr(Math.ceil(left)) + ' ث'; } }; }

  // =====================================================================
  // Questions picking per game
  // =====================================================================
  function gameQuestions(game, opts, n) {
    const f = Object.assign({}, game.filter);
    if (opts.diff) f.diff = [opts.diff];
    if (opts.stage) f.stage = opts.stage;
    if (opts.sub) f.subs = [opts.sub];
    const rnd = game.rules.daily ? mulberry32(hashStr(todayKey() + game.id)) : Math.random;
    const min = n ? Math.min(n, 6) : 6;
    if (W.QP.pickRelaxed) {
      const list = W.QP.pickRelaxed(f, n || 0, rnd, min);
      return list;
    }
    let list = Bank.pick(f, 0, rnd);
    if (!list.length && (opts.diff || opts.stage)) { delete f.diff; delete f.stage; list = Bank.pick(f, 0, rnd); }
    return n ? list.slice(0, n) : list;
  }

  // =====================================================================
  // Engine: quiz (solo) — covers classic, tf, blitz, survival, sudden death, speed,
  // fill, order, match, who-am-I, beginner, expert, marathon, wheel, daily, verified
  // =====================================================================
  function runQuiz(game, root, opts, finish) {
    const r = game.rules; const rnd = r.daily ? mulberry32(hashStr(todayKey() + game.id + 'o')) : Math.random;
    const qs = gameQuestions(game, opts, r.endless ? 0 : r.count);
    if (!qs.length) { root.appendChild(h('p', null, 'لا توجد أسئلة كافية لهذه اللعبة بالخيارات الحالية.')); return; }
    if (qs.filterNote) root.appendChild(h('div', { class: 'filter-note' }, qs.filterNote));
    const st = { i: 0, score: 0, correct: 0, wrong: 0, streak: 0, best: 0, lives: r.lives || 0, log: [], start: Date.now(), life: { fifty: 1, skip: 1, time: 1 } };
    const hud = h('div', { class: 'hud' }); const tb = timerBar(); const stage = h('div', { class: 'stage' });
    const lifeBar = h('div', { class: 'lifelines' });
    root.appendChild(hud); root.appendChild(tb.el); root.appendChild(lifeBar); root.appendChild(stage);
    let total = null, perT = null, cur = null, ended = false;
    if (r.totalTime) { total = Timer(r.totalTime, left => tb.set(left, left / r.totalTime), () => end('time')).start(); }
    function drawHud() {
      hud.innerHTML = '';
      hud.appendChild(h('div', { class: 'hud-item' }, '🏆 ', h('b', null, toAr(Math.round(st.score)))));
      hud.appendChild(h('div', { class: 'hud-item' }, r.endless ? '❓ ' + toAr(st.i + 1) + (r.allowQuit ? ' / ' + toAr(qs.length) : '') : '❓ ' + toAr(Math.min(st.i + 1, qs.length)) + ' / ' + toAr(qs.length)));
      if (r.lives) hud.appendChild(h('div', { class: 'hud-item lives' }, '❤️'.repeat(st.lives) + '🤍'.repeat(Math.max(0, r.lives - st.lives))));
      if (r.streak) hud.appendChild(h('div', { class: 'hud-item' }, '🔥 ', toAr(st.streak)));
      if (r.allowQuit || r.endless) hud.appendChild(h('button', { class: 'btn ghost small', onclick: () => end('quit') }, 'إنهاء'));
    }
    function drawLifelines(q) {
      lifeBar.innerHTML = ''; if (!r.lifelines) return;
      const can = t => st.life[t] > 0 && cur && !cur.answered;
      if (r.lifelines.includes('fifty') && ['mcq', 'who'].includes(q.type)) lifeBar.appendChild(h('button', { class: 'btn ghost small', disabled: !can('fifty'), onclick: () => { st.life.fifty--; cur.ctrl.fifty && cur.ctrl.fifty(); drawLifelines(q); } }, '½ حذف إجابتين'));
      if (r.lifelines.includes('skip')) lifeBar.appendChild(h('button', { class: 'btn ghost small', disabled: !can('skip'), onclick: () => { st.life.skip--; stopQ(); cur.answered = true; next(); } }, '⏭ تخطَّ السؤال'));
      if (r.lifelines.includes('time') && perT) lifeBar.appendChild(h('button', { class: 'btn ghost small', disabled: !can('time'), onclick: () => { st.life.time--; perT.add(15); drawLifelines(q); } }, '⏱ +15 ثانية'));
    }
    function stopQ() { if (perT) perT.stop(); if (cur && cur.ctrl && cur.ctrl.cleanup) cur.ctrl.cleanup(); }
    function show() {
      if (ended) return;
      if (st.i >= qs.length) return end('done');
      const q = qs[st.i]; stage.innerHTML = ''; drawHud();
      const go = () => {
        const t0 = Date.now();
        cur = { q, answered: false };
        const { card, ctrl } = questionCard(q, res => onAnswer(q, res, (Date.now() - t0) / 1000), { rnd, perQ: r.perQ, hints: r.hints });
        cur.ctrl = ctrl; stage.appendChild(card); drawLifelines(q);
        if (r.perQ && !r.totalTime) { const lim = q.type === 'order' || q.type === 'match' ? Math.max(r.perQ, 60) : q.type === 'fill' ? Math.max(r.perQ, 30) : r.perQ; perT = Timer(lim, left => { tb.set(left, left / lim); if (left < 4 && Math.ceil(left) !== Math.ceil(left + .1)) Sound.tick(); }, () => { ctrl.lock && ctrl.lock(); onAnswer(q, { correct: false, timeout: true }, lim); }).start(); }
      };
      if (r.wheel) spinWheel(stage, q, go); else go();
    }
    function onAnswer(q, res, secs) {
      if (!cur || cur.answered) return; cur.answered = true; stopQ(); drawLifelines(q);
      let pts = 0;
      if (res.correct || res.partial) {
        const base = 100 * (q.difficulty || 1) * (res.correct ? 1 : res.partial * 0.6);
        let mult = (res.mult || 1) * (r.scoreMult || 1);
        if (r.speedBonus && perT) mult *= 1 + 0.5 * (r.speedWeight || 1) * Math.max(0, perT.frac);
        if (res.correct) { st.streak++; st.best = Math.max(st.best, st.streak); if (r.streak) mult *= 1 + Math.min(st.streak - 1, 10) * 0.1; }
        pts = base * mult;
      }
      if (res.correct) { st.correct++; Sound.good(); } else { st.wrong++; st.streak = 0; Sound.bad(); if (r.lives) st.lives--; if (r.wrongPenalty && total) total.sub(r.wrongPenalty); }
      st.score += pts; st.log.push({ q, res, pts, secs });
      drawHud();
      const dead = r.lives && st.lives <= 0;
      const fast = !!r.totalTime;
      const nextBtn = h('button', { class: 'btn primary', onclick: () => next() }, dead ? 'عرض النتيجة' : st.i + 1 >= qs.length ? 'عرض النتيجة' : 'السؤال التالي ←');
      stage.firstChild.appendChild(feedback(q, res, fast ? null : h('div', { class: 'row end' }, h('span', { class: 'pts' }, pts ? '+' + toAr(Math.round(pts)) + ' نقطة' : ''), nextBtn)));
      if (fast) setTimeout(next, res.correct ? 650 : 1500); else setTimeout(() => nextBtn.focus(), 30);
    }
    function next() { if (ended) return; if (r.lives && st.lives <= 0) return end('lives'); st.i++; show(); }
    function end(reason) { if (ended) return; ended = true; stopQ(); if (total) total.stop(); finish({ game, st, reason, opts }); }
    show();
    return { stop() { ended = true; stopQ(); if (total) total.stop(); } };
  }
  function spinWheel(stage, q, go) {
    const cats = Bank.cats; const target = Bank.cat(q.category);
    const disp = h('div', { class: 'wheel' }, h('div', { class: 'wheel-inner' }, '🎡'));
    stage.appendChild(h('div', { class: 'wheel-wrap' }, disp));
    let k = 0, delay = 60; const seq = () => { const c = cats[k++ % cats.length]; disp.firstChild.textContent = c.icon + ' ' + c.name; disp.style.borderColor = c.color; Sound.tick(); delay *= 1.12; if (delay < 380) setTimeout(seq, delay); else { disp.firstChild.textContent = target.icon + ' ' + target.name; disp.style.borderColor = target.color; disp.classList.add('landed'); setTimeout(() => { stage.innerHTML = ''; go(); }, 700); } };
    seq();
  }

  // =====================================================================
  // Engine: ladder (millionaire)
  // =====================================================================
  const PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
  function runLadder(game, root, opts, finish) {
    const pool = gameQuestions(game, Object.assign({}, opts, { diff: null }), 0).filter(q => q.type === 'mcq' && q.options.length === 4);
    const byD = d => pool.filter(q => q.difficulty === d);
    const used = new Set(); const take = d => { const l = byD(d).filter(q => !used.has(q.id)); const q = l[0] || pool.find(x => !used.has(x.id)); if (q) used.add(q.id); return q; };
    const qs = PRIZES.map((_, i) => take(i < 5 ? 1 : i < 10 ? 2 : 3)).filter(Boolean);
    const st = { i: 0, score: 0, correct: 0, wrong: 0, log: [], life: { fifty: 1, audience: 1, friend: 1, swap: 1 }, best: 0 };
    const wrap = h('div', { class: 'ladder-wrap' }); const main = h('div', { class: 'ladder-main' }); const side = h('ol', { class: 'ladder', reversed: true });
    wrap.appendChild(main); wrap.appendChild(side); root.appendChild(wrap);
    let cur = null, perT = null, ended = false; const tb = timerBar();
    const safe = i => i === 4 || i === 9;
    function drawSide() { side.innerHTML = ''; PRIZES.slice().reverse().forEach((p, k) => { const i = PRIZES.length - 1 - k; side.appendChild(h('li', { class: (i === st.i ? 'cur ' : '') + (i < st.i ? 'done ' : '') + (safe(i) ? 'safe' : '') }, h('span', null, toAr(i + 1)), h('b', null, toAr(p.toLocaleString('en')) ))); }); }
    function show() {
      if (st.i >= qs.length) return end('won');
      const q = qs[st.i]; main.innerHTML = ''; drawSide();
      const lifes = h('div', { class: 'lifelines' });
      const { card, ctrl } = questionCard(q, res => answered(q, res), { rnd: Math.random });
      cur = { q, ctrl, answered: false };
      const L = (key, label, fn) => lifes.appendChild(h('button', { class: 'btn ghost small', disabled: !st.life[key], onclick: e => { if (cur.answered) return; st.life[key]--; e.target.disabled = true; fn(); } }, label));
      L('fifty', '½ حذف إجابتين', () => ctrl.fifty());
      L('audience', '👥 رأي الجمهور', () => { const live = ctrl.buttons.filter(b => !b.disabled); let rest = 100; const good = 45 + Math.floor(Math.random() * 30); const vals = live.map(b => { const i = +b.dataset.i; return i === q.answer ? good : 0; }); rest -= good; live.forEach((b, k) => { if (!vals[k]) { const v = k === live.length - 1 ? rest : Math.floor(Math.random() * rest); vals[k] = v; rest -= v; } }); if (rest > 0) vals[vals.findIndex(v => v === good)] += rest; live.forEach((b, k) => b.appendChild(h('span', { class: 'aud' }, toAr(vals[k]) + '٪'))); });
      L('friend', '📞 اتصل بصديق', () => { const sure = Math.random() < 0.8; const live = ctrl.buttons.filter(b => !b.disabled); const pickB = sure ? live.find(b => +b.dataset.i === q.answer) : live[Math.floor(Math.random() * live.length)]; card.appendChild(h('div', { class: 'hint' }, '📞 صديقك يقول: «أظن أن الإجابة هي: ' + q.options[+pickB.dataset.i] + '»' + (sure ? '' : ' (غير متأكد)'))); });
      L('swap', '🔄 تبديل السؤال', () => { const nq = take(q.difficulty); if (nq) { qs[st.i] = nq; if (perT) perT.stop(); show(); } });
      main.appendChild(h('div', { class: 'row between' }, h('div', { class: 'prize' }, 'سؤال ' + toAr(st.i + 1) + ' بقيمة ', h('b', null, toAr(PRIZES[st.i].toLocaleString('en')))), h('button', { class: 'btn ghost small', onclick: () => end('walk') }, '🚪 انسحب بجائزتك')));
      main.appendChild(tb.el); main.appendChild(lifes); main.appendChild(card);
      const lim = st.i < 5 ? 30 : st.i < 10 ? 45 : 60;
      perT = Timer(lim, left => tb.set(left, left / lim), () => { ctrl.lock(); answered(q, { correct: false, timeout: true }); }).start();
    }
    function answered(q, res) {
      if (cur.answered) return; cur.answered = true; if (perT) perT.stop();
      st.log.push({ q, res, pts: res.correct ? PRIZES[st.i] : 0 });
      if (res.correct) { st.correct++; Sound.good(); st.score = PRIZES[st.i]; cur.ctrl.buttons && 0; main.lastChild.appendChild(feedback(q, res, h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => { st.i++; show(); } }, st.i + 1 >= qs.length ? 'استلم المليون! 🎉' : 'السؤال التالي ←')))); }
      else { st.wrong++; Sound.bad(); st.score = st.i >= 10 ? PRIZES[9] : st.i >= 5 ? PRIZES[4] : 0; main.lastChild.appendChild(feedback(q, res, h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => end('lost') }, 'عرض النتيجة')))); }
    }
    function end(reason) { if (ended) return; ended = true; if (perT) perT.stop(); if (reason === 'walk' && st.i > 0) st.score = PRIZES[st.i - 1]; if (reason === 'won') Sound.win(); finish({ game, st, reason, opts, money: true }); }
    show();
    return { stop() { ended = true; if (perT) perT.stop(); } };
  }

  // =====================================================================
  // Engine: duel (2 players alternate on one device)
  // =====================================================================
  function playersForm(n, labels, onStart, extra) {
    const inputs = labels.map((l, i) => h('input', { class: 'inp', value: l, maxlength: 20 }));
    const box = h('div', { class: 'card setup' }, h('h3', null, 'أسماء المتنافسين'), h('div', { class: 'grid2' }, inputs), extra || null,
      h('button', { class: 'btn primary big', onclick: () => onStart(inputs.map((x, i) => x.value.trim() || labels[i])) }, 'ابدأ المنافسة'));
    return box;
  }
  function runDuel(game, root, opts, finish) {
    const r = game.rules;
    root.appendChild(playersForm(2, [Player.name || 'اللاعب الأول', 'اللاعب الثاني'], names => {
      root.innerHTML = '';
      const qs = gameQuestions(game, opts, r.rounds * 2); const P = names.map(n => ({ name: n, score: 0, correct: 0 }));
      const board = h('div', { class: 'duel-board' }); const tb = timerBar(); const stage = h('div', { class: 'stage' });
      if (qs.filterNote) root.appendChild(h('div', { class: 'filter-note' }, qs.filterNote));
      root.appendChild(board); root.appendChild(tb.el); root.appendChild(stage);
      let i = 0, perT = null, done = false; const log = [];
      function drawBoard() { board.innerHTML = ''; P.forEach((p, k) => board.appendChild(h('div', { class: 'duel-p' + (i % 2 === k ? ' turn' : '') }, h('div', { class: 'duel-name' }, (k ? '🟥 ' : '🟦 ') + p.name), h('div', { class: 'duel-score' }, toAr(Math.round(p.score)))))); }
      function show() {
        if (i >= qs.length) return end();
        const q = qs[i]; const p = P[i % 2]; stage.innerHTML = ''; drawBoard();
        stage.appendChild(h('div', { class: 'turn-banner' }, 'دور: ' + p.name + ' — الجولة ' + toAr(Math.floor(i / 2) + 1) + ' من ' + toAr(Math.ceil(qs.length / 2))));
        let answered = false;
        const { card, ctrl } = questionCard(q, res => onA(res), { rnd: Math.random, perQ: r.perQ }); stage.appendChild(card);
        perT = Timer(r.perQ, left => tb.set(left, left / r.perQ), () => { ctrl.lock && ctrl.lock(); onA({ correct: false, timeout: true }); }).start();
        function onA(res) { if (answered) return; answered = true; perT.stop(); const pts = res.correct ? 100 * (q.difficulty || 1) * (1 + 0.5 * perT.frac) : 0; p.score += pts; if (res.correct) { p.correct++; Sound.good(); } else Sound.bad(); log.push({ q, res, pts, player: p.name }); drawBoard();
          card.appendChild(feedback(q, res, h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => { i++; show(); } }, 'التالي ←')))); }
      }
      function end() { if (done) return; done = true; finish({ game, opts, multi: P, st: { score: Math.max(...P.map(p => p.score)), correct: P[0].correct + P[1].correct, wrong: log.length - P[0].correct - P[1].correct, log } }); }
      show();
    }));
  }

  // =====================================================================
  // Engine: buzzer (2 players, same question, first to buzz answers)
  // =====================================================================
  function runBuzzer(game, root, opts, finish) {
    const r = game.rules;
    root.appendChild(playersForm(2, [Player.name || 'اللاعب الأول', 'اللاعب الثاني'], names => {
      root.innerHTML = '';
      const qs = gameQuestions(game, opts, r.rounds).filter(q => q.type === 'mcq' || q.type === 'tf'); const P = names.map(n => ({ name: n, score: 0, correct: 0 }));
      const board = h('div', { class: 'duel-board' }); const tb = timerBar(); const stage = h('div', { class: 'stage' });
      if (qs.filterNote) root.appendChild(h('div', { class: 'filter-note' }, qs.filterNote));
      root.appendChild(board); root.appendChild(tb.el); root.appendChild(stage);
      let i = 0, perT = null, buzzed = null, done = false, locked = [false, false]; const log = [];
      const keyH = e => { const k = e.key.toLowerCase(); if (k === 'a' || k === 'ش') buzz(0); if (k === 'l' || k === 'م') buzz(1); };
      document.addEventListener('keydown', keyH);
      function drawBoard() { board.innerHTML = ''; P.forEach((p, k) => board.appendChild(h('div', { class: 'duel-p' + (buzzed === k ? ' turn' : '') }, h('div', { class: 'duel-name' }, (k ? '🟥 ' : '🟦 ') + p.name), h('div', { class: 'duel-score' }, toAr(p.score)),
        h('button', { class: 'buzz ' + (k ? 'red' : 'blue'), disabled: buzzed != null || locked[k], onclick: () => buzz(k) }, '🔔 ' + (k ? 'L' : 'A'))))); }
      let ctrl = null, card = null;
      function show() {
        if (i >= qs.length) return end();
        const q = qs[i]; stage.innerHTML = ''; buzzed = null; locked = [false, false]; drawBoard();
        const qc = questionCard(q, res => onA(res), { rnd: Math.random }); ctrl = qc.ctrl; card = qc.card; stage.appendChild(card);
        ctrl.buttons.forEach(b => b.disabled = true);
        stage.appendChild(h('p', { class: 'muted center' }, 'اضغط الجرس للإجابة: اللاعب الأول مفتاح A، والثاني مفتاح L، أو الأزرار على الشاشة.'));
        perT = Timer(r.perQ, left => tb.set(left, left / r.perQ), () => { ctrl.lock(); onA({ correct: false, timeout: true }); }).start();
      }
      function buzz(k) { if (buzzed != null || locked[k] || !ctrl || done) return; buzzed = k; Sound.beep(k ? 500 : 700, .2); drawBoard(); ctrl.buttons.forEach(b => { if (!b.classList.contains('gone')) b.disabled = false; }); }
      function onA(res) {
        const q = qs[i];
        if (res.timeout || buzzed == null) { perT.stop(); log.push({ q, res, pts: 0 }); return after(res); }
        const p = P[buzzed];
        if (res.correct) { perT.stop(); p.score += 1; p.correct++; Sound.good(); log.push({ q, res, pts: 1, player: p.name }); return after(res); }
        // wrong: other player may try
        Sound.bad(); p.score -= 0; locked[buzzed] = true; const other = 1 - buzzed;
        if (!locked[other]) { buzzed = null; drawBoard(); const fresh = questionCard(q, rr => onA(rr), { rnd: Math.random }); stage.replaceChild(fresh.card, card); card = fresh.card; ctrl = fresh.ctrl; ctrl.buttons.forEach(b => { b.disabled = true; if (b.textContent.includes(res.given)) { b.classList.add('gone'); } }); stage.appendChild(h('p', { class: 'hint center' }, 'إجابة خاطئة! الفرصة الآن لـ ' + P[other].name)); }
        else { perT.stop(); log.push({ q, res, pts: 0 }); after(res); }
      }
      function after(res) { ctrl.lock && ctrl.lock(); card.appendChild(feedback(qs[i], res, h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => { i++; show(); } }, 'التالي ←')))); }
      function end() { if (done) return; done = true; document.removeEventListener('keydown', keyH); finish({ game, opts, multi: P, st: { score: Math.max(...P.map(p => p.score)), correct: P[0].correct + P[1].correct, wrong: log.length - P[0].correct - P[1].correct, log } }); }
      show();
    }));
  }

  // =====================================================================
  // Engine: teams (host screen for حلقات / مدارس / مسابقات)
  // =====================================================================
  function runTeams(game, root, opts, finish) {
    const r = game.rules;
    const nSel = h('select', { class: 'inp' }, [2, 3, 4, 5, 6].map(n => h('option', { value: n }, toAr(n) + ' فرق')));
    const roundsSel = h('select', { class: 'inp' }, [10, 20, 30, 50].map(n => h('option', { value: n, selected: n === r.rounds }, toAr(n) + ' سؤالًا')));
    const timeSel = h('select', { class: 'inp' }, [15, 30, 45, 60, 90].map(n => h('option', { value: n, selected: n === r.perQ }, toAr(n) + ' ثانية')));
    const names = h('div', { class: 'grid3' });
    const defaults = ['فريق الفرقان', 'فريق النور', 'فريق الهدى', 'فريق اليقين', 'فريق الإحسان', 'فريق البيان'];
    function drawNames() { names.innerHTML = ''; for (let k = 0; k < +nSel.value; k++) names.appendChild(h('input', { class: 'inp', value: defaults[k] })); }
    nSel.addEventListener('change', drawNames); drawNames();
    root.appendChild(h('div', { class: 'card setup' }, h('h3', null, '⚙️ إعداد مسابقة الفرق'), h('p', { class: 'muted' }, 'اعرض هذه الشاشة على جهاز عرض. المقدم يقرأ السؤال، ثم يُظهر الإجابة ويمنح النقاط للفريق الصحيح، ويمكن «سرقة» السؤال بنصف النقاط.'),
      h('div', { class: 'grid3' }, h('label', null, 'عدد الفرق', nSel), h('label', null, 'عدد الأسئلة', roundsSel), h('label', null, 'وقت السؤال', timeSel)), names,
      h('button', { class: 'btn primary big', onclick: start }, 'ابدأ المسابقة 🎤')));
    function start() {
      const T = [...names.querySelectorAll('input')].map((x, k) => ({ name: x.value.trim() || defaults[k], score: 0, correct: 0 }));
      const qs = gameQuestions(game, opts, +roundsSel.value); const lim = +timeSel.value;
      const tNote = qs.filterNote;
      root.innerHTML = ''; root.classList.add('host');
      if (tNote) root.appendChild(h('div', { class: 'filter-note' }, tNote));
      const board = h('div', { class: 'team-board' }); const tb = timerBar(); const stage = h('div', { class: 'stage' });
      const tools = h('div', { class: 'row end' }, h('button', { class: 'btn ghost small', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } }, '⛶ ملء الشاشة'), h('button', { class: 'btn ghost small', onclick: () => end() }, 'إنهاء المسابقة'));
      root.appendChild(tools); root.appendChild(board); root.appendChild(tb.el); root.appendChild(stage);
      let i = 0, perT = null, done = false, turn = 0; const log = [];
      function drawBoard() { board.innerHTML = ''; T.forEach((t, k) => board.appendChild(h('div', { class: 'team' + (k === turn ? ' turn' : '') }, h('div', { class: 'team-name' }, t.name), h('div', { class: 'team-score' }, toAr(t.score)), h('div', { class: 'row center' }, h('button', { class: 'btn ghost tiny', onclick: () => { t.score++; drawBoard(); } }, '+'), h('button', { class: 'btn ghost tiny', onclick: () => { t.score--; drawBoard(); } }, '−'))))); }
      function show() {
        if (i >= qs.length) return end();
        const q = qs[i]; stage.innerHTML = ''; turn = i % T.length; drawBoard();
        const pts = q.difficulty || 1;
        stage.appendChild(h('div', { class: 'turn-banner' }, 'السؤال ' + toAr(i + 1) + ' من ' + toAr(qs.length) + ' — دور: ' + T[turn].name + ' — القيمة: ' + toAr(pts * 10) + ' نقطة'));
        const { card, ctrl } = questionCard(q, () => {}, { rnd: Math.random, perQ: lim }); stage.appendChild(card);
        const award = h('div', { class: 'award' });
        let revealed = false;
        function reveal(timeout) {
          if (revealed) return; revealed = true; perT.stop(); ctrl.lock && ctrl.lock();
          card.appendChild(feedback(q, { correct: true }, null)); card.querySelector('.fb-title').textContent = '📢 الإجابة: ' + answerText(q);
          award.innerHTML = ''; award.appendChild(h('div', { class: 'muted' }, 'من أجاب إجابة صحيحة؟'));
          T.forEach((t, k) => award.appendChild(h('button', { class: 'btn ' + (k === turn ? 'primary' : 'ghost'), onclick: () => { const v = k === turn ? pts * 10 : pts * 5; t.score += v; t.correct++; Sound.good(); log.push({ q, res: { correct: true }, pts: v, player: t.name }); nextQ(); } }, t.name + (k === turn ? ' (+' + toAr(pts * 10) + ')' : ' سرقة (+' + toAr(pts * 5) + ')'))));
          award.appendChild(h('button', { class: 'btn ghost', onclick: () => { log.push({ q, res: { correct: false }, pts: 0 }); Sound.bad(); nextQ(); } }, 'لا أحد'));
        }
        award.appendChild(h('button', { class: 'btn primary big', onclick: () => reveal() }, '👁 إظهار الإجابة'));
        card.appendChild(award);
        perT = Timer(lim, left => { tb.set(left, left / lim); }, () => { Sound.bad(); reveal(true); }).start();
      }
      function nextQ() { i++; show(); }
      function end() { if (done) return; done = true; if (perT) perT.stop(); root.classList.remove('host'); finish({ game, opts, multi: T, st: { score: Math.max(...T.map(t => t.score)), correct: log.filter(l => l.res.correct).length, wrong: log.filter(l => !l.res.correct).length, log } }); }
      show();
    }
  }

  // =====================================================================
  // Engine: study (flashcards)
  // =====================================================================
  function runStudy(game, root, opts, finish) {
    const qs = gameQuestions(game, opts, game.rules.count || 30); let i = 0, known = 0, unknown = 0; const log = [];
    if (qs.filterNote) root.appendChild(h('div', { class: 'filter-note' }, qs.filterNote));
    const stage = h('div', { class: 'stage' }); root.appendChild(stage);
    function show() {
      stage.innerHTML = ''; if (i >= qs.length) return finish({ game, opts, st: { score: known * 10, correct: known, wrong: unknown, log }, study: true });
      const q = qs[i]; let flipped = false;
      const back = h('div', { class: 'flash-back hidden' }, h('div', { class: 'fb-answer big' }, answerText(q)), q.explanation ? h('div', { class: 'fb-exp' }, q.explanation) : null, sourceBlock(q));
      const card = h('div', { class: 'q-card flash' }, qHeader(q), h('div', { class: 'muted small' }, 'بطاقة ' + toAr(i + 1) + ' / ' + toAr(qs.length)), h('h2', { class: 'q-text' }, q.question),
        q.type === 'who' ? h('ol', { class: 'clues' }, q.clues.map(c => h('li', { class: 'clue' }, c))) : null,
        (q.type === 'mcq' || q.type === 'tf' || q.type === 'who') ? h('ul', { class: 'flash-opts' }, q.options.map(o => h('li', null, o))) : null,
        q.type === 'order' ? h('p', { class: 'muted' }, 'رتّب: ' + shuffle(q.items).join(' • ')) : null,
        q.type === 'match' ? h('p', { class: 'muted' }, 'صِل: ' + q.pairs.map(p => p[0]).join(' • ')) : null, back);
      const flip = h('button', { class: 'btn primary', onclick: () => { flipped = true; back.classList.remove('hidden'); flip.remove(); rate.classList.remove('hidden'); } }, '↻ اقلب البطاقة');
      const rate = h('div', { class: 'row center hidden' }, h('button', { class: 'btn good', onclick: () => { known++; log.push({ q, res: { correct: true }, pts: 10 }); i++; show(); } }, '✔ أعرفها'), h('button', { class: 'btn bad', onclick: () => { unknown++; log.push({ q, res: { correct: false }, pts: 0 }); i++; show(); } }, '✘ أحتاج مراجعة'));
      stage.appendChild(card); stage.appendChild(h('div', { class: 'row center' }, flip, rate));
    }
    show();
  }

  W.QP.ENGINES = { quiz: runQuiz, ladder: runLadder, duel: runDuel, buzzer: runBuzzer, teams: runTeams, study: runStudy };
  W.QP.render = { questionCard, feedback, answerText, sourceBlock };
  W.QP.Timer = Timer; W.QP.timerBar = timerBar; W.QP.spinWheel = spinWheel;
})(window);
