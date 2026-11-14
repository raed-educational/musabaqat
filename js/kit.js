/* kit.js — أدوات مشتركة لألعاب المقدّم/البروجكتر (إعداد الفرق، اختيار الأسئلة مع الفلاتر، لوحة النقاط، النهاية). */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr, Player } = W.QP;
  const fast = () => !!W.__QP_FAST;
  const K = {
    fast,
    after(ms, fn) { if (fast()) { fn(); return 0; } return setTimeout(fn, ms); },
    fmt: n => toAr(Number(Math.round(n || 0)).toLocaleString('en')),
    COLORS: ['#e8962e', '#5fd0d6', '#4fd08a', '#c792ff'],
    OPT_DEP: /مما يأتي|مما يلي|التالي|الآتي|الآتية|التالية|ليس من|ليست من|أي هذه|أيّ هذه|ما عدا|باستثناء|هؤلاء|مَن مِن|من من /,
    ALL_CATS: () => Bank.cats.map(c => c.id)
  };

  // chips to choose categories (default: all 12)
  K.catChips = function (state) {
    const box = h('div', { class: 'chips center kit-cats' });
    const all = K.ALL_CATS();
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(h('button', { type: 'button', class: 'chip' + (state.cats.length === all.length ? ' on' : ''), onclick: () => { state.cats = all.slice(); draw(); } }, '🌐 كل الأقسام'));
      Bank.cats.forEach(c => { const on = state.cats.includes(c.id) && state.cats.length !== all.length; box.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: () => { if (state.cats.length === all.length) state.cats = [c.id]; else if (state.cats.includes(c.id)) state.cats = state.cats.filter(x => x !== c.id); else state.cats = state.cats.concat(c.id); if (!state.cats.length) state.cats = all.slice(); draw(); } }, c.icon + ' ' + c.name)); });
    };
    draw();
    return box;
  };
  K.choice = function (label, items, get, set) { // items: [[value,label]]
    const box = h('div', { class: 'chips center' });
    const draw = () => { box.innerHTML = ''; items.forEach(([v, l]) => box.appendChild(h('button', { type: 'button', class: 'chip' + (get() === v ? ' on' : ''), onclick: () => { set(v); draw(); } }, l))); };
    draw();
    return [h('div', { class: 'qf-label' }, label), box];
  };

  // setup card: names (min..max players/teams), categories, filters, extra options
  K.setup = function (wrap, o) {
    wrap.innerHTML = '';
    const state = { n: o.def || o.min || 2, cats: K.ALL_CATS() };
    const names = h('div', { class: 'kit-names' });
    const prev = [];
    const label = i => o.label ? o.label(i, state.n) : (state.n === 1 ? 'اسم اللاعب' : 'اسم الفريق ' + toAr(i + 1));
    const defName = i => state.n === 1 ? (Player.name || 'لاعب') : (o.defNames ? o.defNames[i] : 'الفريق ' + ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'][i]);
    const drawNames = () => {
      [...names.querySelectorAll('input')].forEach((x, i) => { prev[i] = x.value; });
      names.innerHTML = '';
      for (let i = 0; i < state.n; i++) names.appendChild(h('label', { class: 'kit-name', style: '--tc:' + K.COLORS[i % 4] }, label(i), h('input', { class: 'inp', maxlength: 20, value: prev[i] || defName(i) })));
    };
    drawNames();
    const nRow = [];
    if (o.max > o.min) {
      const opts = []; for (let i = o.min; i <= o.max; i++) opts.push([i, i === 1 ? 'فردي' : toAr(i) + (o.unit || ' فرق')]);
      nRow.push(...K.choice(o.countLabel || 'عدد المتسابقين', opts, () => state.n, v => { state.n = v; drawNames(); }));
    }
    const extras = o.extras ? o.extras(state) : null;
    wrap.appendChild(h('div', { class: 'card intro kit-setup ' + (o.cls || '') },
      h('div', { class: 'intro-icon' }, o.icon), h('h1', null, o.title), h('p', null, o.desc),
      o.rules ? h('ul', { class: 'kit-rules' }, o.rules.map(r => h('li', null, r))) : null,
      nRow, names, extras,
      o.noCats ? null : [h('div', { class: 'qf-label' }, 'أقسام الأسئلة'), K.catChips(state)],
      W.QP.filterBar ? W.QP.filterBar({}) : null,
      h('button', { class: 'btn primary big', id: 'startBtn', onclick: () => {
        const nm = [...names.querySelectorAll('input')].map((x, i) => (x.value || '').trim().slice(0, 20) || defName(i));
        nm.forEach((x, i) => { if (nm.indexOf(x) !== i) nm[i] = x + ' ' + toAr(i + 1); });
        if (state.n === 1 && nm[0]) Player.name = nm[0];
        o.onStart({ names: nm, cats: state.cats.slice(), filters: W.QP.getQFilters ? W.QP.getQFilters() : {}, state });
      } }, o.startLabel || '🔥 ابدأ')));
  };

  K.load = function (wrap, cats, then) {
    wrap.innerHTML = '';
    wrap.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ تحميل الأسئلة…'));
    return Bank.ensure(cats).then(() => then()).catch(() => { wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center' }, 'تعذّر تحميل ملفات الأسئلة.')); });
  };

  // question picker with filter relaxation. spec: {cats, types, test(q), filters:{diff,stage}}
  K.picker = function (spec) {
    const used = new Set(); const fl = spec.filters || {};
    let relaxed = false;
    const base = Bank.all().filter(q => (!spec.types || spec.types.includes(q.type)) && (!spec.test || spec.test(q)));
    const inCats = base.filter(q => spec.cats.includes(q.category));
    function next(diffs, cat) {
      const D = fl.diff ? [fl.diff] : (diffs ? [].concat(diffs) : null);
      const src = cat ? inCats.filter(q => q.category === cat) : inCats;
      const layers = [
        q => (!D || D.includes(+q.difficulty)) && (!fl.stage || q.stage === fl.stage),
        q => (!D || D.includes(+q.difficulty)),
        q => (!fl.stage || q.stage === fl.stage),
        () => true
      ];
      for (const [i, L] of layers.entries()) {
        for (const S of [src, inCats, base]) {
          const list = S.filter(q => !used.has(q.id) && L(q));
          if (list.length) { if (i > 0 && (fl.diff || fl.stage)) relaxed = true; const q = list[Math.floor(Math.random() * list.length)]; used.add(q.id); return q; }
        }
      }
      used.clear(); return base[Math.floor(Math.random() * base.length)] || null;
    }
    return { next, used, get relaxed() { return relaxed; }, note() { return relaxed ? 'تنبيه: لا توجد أسئلة كافية بالمستوى/المرحلة المختارة، فاستُكملت من أقرب مستوى.' : null; } };
  };
  K.MCQ = q => q.type === 'mcq' && q.options && q.options.length >= 3;

  // scoreboard of players/teams
  K.scores = function (players, turn, o) {
    o = o || {};
    return h('div', { class: 'kit-scores n' + players.length }, players.map((p, i) => h('div', { class: 'kit-team' + (turn === i ? ' turn' : '') + (p.out ? ' out' : ''), style: '--tc:' + K.COLORS[i % 4] },
      h('div', { class: 'kit-tname' }, p.name), h('div', { class: 'kit-tscore' }, o.val ? o.val(p) : K.fmt(p.score)), o.sub ? h('div', { class: 'kit-tsub' }, o.sub(p)) : null)));
  };

  K.splash = function (wrap, o, then) {
    wrap.innerHTML = ''; W.scrollTo(0, 0);
    Sound.fanfare && Sound.fanfare();
    let done = false, t = 0; const go = () => { if (done) return; done = true; clearTimeout(t); then(); };
    wrap.appendChild(h('div', { class: 'champ-splash kit-splash' }, h('div', { class: 'champ-splash-icon' }, o.icon), o.kicker ? h('div', { class: 'champ-kicker' }, o.kicker) : null, h('h1', null, o.title), o.sub ? h('p', null, o.sub) : null, h('button', { class: 'btn primary big', id: 'splashGo', onclick: go }, o.btn || 'انطلق!')));
    if (o.auto && !fast()) t = setTimeout(go, o.auto);
  };

  // simple mcq block for host screens: options shown, click to choose (or host reveal)
  K.mcq = function (q, onPick, o) {
    o = o || {};
    const c = Bank.cat(q.category) || {};
    const box = h('div', { class: 'q-card kit-q' });
    box.appendChild(h('div', { class: 'q-meta' }, h('span', { class: 'tag light' }, (c.icon || '') + ' ' + (c.name || '')), q.subcategory ? h('span', { class: 'tag light' }, q.subcategory) : null, h('span', { class: 'tag d' + q.difficulty }, ({ 1: 'سهل', 2: 'متوسط', 3: 'صعب' })[q.difficulty] || '')));
    box.appendChild(h('h2', { class: 'q-text' }, q.question));
    const order = o.keepOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i));
    const btns = order.map((i, k) => h('button', { class: 'opt', 'data-i': i, onclick: () => { if (locked) return; onPick && onPick(i, btns[k]); } }, h('span', { class: 'opt-key' }, 'أبجد'[k] || ''), h('span', null, q.options[i])));
    let locked = false;
    box.appendChild(h('div', { class: 'options' }, btns));
    return { el: box, btns, lock() { locked = true; btns.forEach(b => b.disabled = true); }, show(chosen) { btns.forEach(b => { const i = +b.dataset.i; if (i === q.answer) b.classList.add('correct'); else if (i === chosen) b.classList.add('wrong'); }); }, fifty() { shuffle(btns.filter(b => +b.dataset.i !== q.answer)).slice(0, 2).forEach(b => { b.disabled = true; b.classList.add('gone'); }); } };
  };

  K.end = function (finish, game, players, log, extra) {
    extra = extra || {};
    const list = players.map(p => ({ name: p.name, score: Math.round(p.score || 0), correct: p.correct || 0 }));
    const sorted = extra.keepOrder ? list : list.slice().sort((a, b) => b.score - a.score);
    const me = players[0];
    const st = { score: Math.max(0, Math.round(me.score || 0)), correct: log.filter(l => l.res && l.res.correct && (!l.player || l.player === me.name)).length, wrong: 0, best: 0, log, start: Date.now() };
    st.wrong = log.filter(l => !l.player || l.player === me.name).length - st.correct;
    const tie = sorted.length > 1 && sorted[0].score === sorted[1].score && !extra.winner;
    finish(Object.assign({ game, st, opts: {}, reason: 'done', party: game.id, multi: sorted, winner: extra.winner || (tie ? null : sorted[0].name), hostName: me.name }, extra.res || {}));
  };

  K.timer = function (secs, tb, onEnd) {
    if (!secs) { tb.el.classList.add('hidden'); return { stop() {} }; }
    return W.QP.Timer(secs, left => { tb.set(left, left / secs); if (left < 4 && Math.ceil(left) !== Math.ceil(left + 0.1)) Sound.tick(); }, onEnd).start();
  };

  W.QP.Kit = K;
})(window);
