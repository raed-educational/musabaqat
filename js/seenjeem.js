/* seenjeem.js — سين جيم: لوحة ٦ فئات × ٦ أسئلة (٢٠٠/٤٠٠/٦٠٠ لكل جهة) بين فريقين، مع وسائل المساعدة الخمس. */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr, Player } = W.QP;
  const R = () => W.QP.render;
  const Timer = () => W.QP.Timer, tbar = () => W.QP.timerBar;
  const fmt = n => toAr(Number(Math.round(n || 0)).toLocaleString('en'));
  const TYPES = ['mcq', 'who', 'fill'];
  const VALUES = [200, 400, 600];
  const DIFF_OF = { 200: 1, 400: 2, 600: 3 };
  const OPT_DEP = /مما يأتي|مما يلي|التالي|الآتي|الآتية|التالية|ليس من|ليست من|أي هذه|أيّ هذه|ما عدا|باستثناء|هؤلاء|مَن مِن|من من /;
  const HELPERS = {
    hole:  { name: 'الحفرة', icon: '🕳️', when: 'before', desc: 'قبل رؤية السؤال: إذا جاوبتم صح تُخصم نفس النقاط من الفريق الثاني.' },
    two:   { name: 'جاوب جوابين', icon: '✌️', when: 'after', desc: 'متردد بين جوابين؟ قولوا الاثنين، وإذا أحدهما صح تأخذون النقاط.' },
    call:  { name: 'اتصال بصديق', icon: '📞', when: 'after', desc: 'اتصلوا بصديق خلال ٣٠ ثانية.' },
    rest:  { name: 'استريح', icon: '😴', when: 'after', desc: 'اختاروا أقوى لاعب في الفريق الثاني ليستريح عن هذا السؤال.' },
    trap:  { name: 'الفخ', icon: '🪤', when: 'after', desc: 'أعطوا السؤال للفريق الثاني؛ إذا أخطأ تُخصم منه نقاط السؤال.' }
  };
  const HELPER_IDS = Object.keys(HELPERS);
  const DEFAULT_HELPERS = ['hole', 'two', 'call'];

  function topicList() {
    const out = [];
    Bank.cats.forEach(c => {
      out.push({ key: c.id, cat: c.id, sub: null, label: c.name, icon: c.icon, color: c.color });
      Bank.subcats(c.id).filter(([, n]) => n >= 40).slice(0, 10).forEach(([s]) => out.push({ key: c.id + '::' + s, cat: c.id, sub: s, label: s, catName: c.name, icon: c.icon, color: c.color }));
    });
    return out;
  }

  function pickQ(topic, diff, used, fl, forceDiff) {
    const d = forceDiff || diff;
    const base = q => q.category === topic.cat && TYPES.includes(q.type) && !used.has(q.id);
    const layers = [
      q => (!topic.sub || q.subcategory === topic.sub) && +q.difficulty === d && (!fl.stage || q.stage === fl.stage),
      q => (!topic.sub || q.subcategory === topic.sub) && +q.difficulty === d,
      q => (!topic.sub || q.subcategory === topic.sub) && (!fl.stage || q.stage === fl.stage),
      q => (!topic.sub || q.subcategory === topic.sub),
      q => +q.difficulty === d,
      () => true
    ];
    const pool = Bank.all().filter(base);
    for (let i = 0; i < layers.length; i++) {
      const list = pool.filter(layers[i]);
      if (list.length) { const sorted = list.filter(q => !OPT_DEP.test(q.question)); const L = sorted.length ? sorted : list; return { q: L[Math.floor(Math.random() * L.length)], relaxed: i > 0 }; }
    }
    return { q: null, relaxed: true };
  }

  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null, callT = null, keyH = null;
    const wrap = h('div', { class: 'sj-wrap' });
    root.appendChild(wrap);
    const topics = topicList();
    const tByKey = Object.fromEntries(topics.map(t => [t.key, t]));

    // ------------------------------------------------------------ SETUP
    function setup() {
      wrap.innerHTML = '';
      const randomTopics = shuffle(Bank.cats.map(c => c.id)).slice(0, 6);
      const team = [0, 1].map(i => ({ name: i === 0 ? (Player.name ? 'فريق ' + Player.name : 'الفريق الأول') : 'الفريق الثاني', picks: randomTopics.slice(i * 3, i * 3 + 3), helpers: DEFAULT_HELPERS.slice() }));
      let t1 = 60, t2 = 20;
      const teamBoxes = h('div', { class: 'sj-teams-setup' });
      const err = h('p', { class: 'sj-err hidden' });
      function sel(i, k) {
        const s = h('select', { class: 'inp', 'data-team': i, 'data-slot': k, onchange: e => { team[i].picks[k] = e.target.value; check(); } });
        Bank.cats.forEach(c => {
          const g = h('optgroup', { label: c.icon + ' ' + c.name });
          topics.filter(t => t.cat === c.id).forEach(t => g.appendChild(h('option', { value: t.key, selected: team[i].picks[k] === t.key }, t.sub ? '— ' + t.label : c.icon + ' ' + c.name + ' (القسم كاملًا)')));
          s.appendChild(g);
        });
        return s;
      }
      function drawTeams() {
        teamBoxes.innerHTML = '';
        team.forEach((T, i) => {
          const hb = h('div', { class: 'chips sj-helper-chips' });
          const drawH = () => { hb.innerHTML = ''; HELPER_IDS.forEach(id => { const on = T.helpers.includes(id); hb.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), title: HELPERS[id].desc, onclick: () => { if (on) T.helpers = T.helpers.filter(x => x !== id); else if (T.helpers.length < 3) T.helpers.push(id); else { T.helpers.shift(); T.helpers.push(id); } drawH(); } }, HELPERS[id].icon + ' ' + HELPERS[id].name)); }); };
          drawH();
          teamBoxes.appendChild(h('div', { class: 'card sj-team-setup t' + i },
            h('label', null, 'اسم الفريق ' + (i ? 'الثاني' : 'الأول'), h('input', { class: 'inp', maxlength: 24, value: T.name, oninput: e => { T.name = e.target.value; } })),
            h('div', { class: 'qf-label' }, 'اختر ٣ فئات لفريقك'),
            h('div', { class: 'sj-selects' }, [0, 1, 2].map(k => sel(i, k))),
            h('div', { class: 'qf-label' }, 'اختر ٣ وسائل مساعدة من ٥'), hb));
        });
      }
      function check() {
        const all = team[0].picks.concat(team[1].picks);
        const dup = all.length !== new Set(all).size;
        err.textContent = dup ? 'كل فئة تُختار مرة واحدة فقط — غيّر الفئة المكررة.' : '';
        err.classList.toggle('hidden', !dup);
        return !dup;
      }
      drawTeams();
      const timeChips = h('div', { class: 'chips center' });
      const drawTime = () => { timeChips.innerHTML = ''; [[30, 15], [45, 20], [60, 20], [90, 30], [0, 0]].forEach(([a, b]) => timeChips.appendChild(h('button', { type: 'button', class: 'chip' + (t1 === a ? ' on' : ''), onclick: () => { t1 = a; t2 = b; drawTime(); } }, a ? toAr(a) + ' ث ثم ' + toAr(b) + ' ث' : 'بدون وقت'))); };
      drawTime();
      wrap.appendChild(h('div', { class: 'card intro sj-setup' },
        h('div', { class: 'intro-icon' }, '🟧'),
        h('h1', null, 'سين جيم'),
        h('p', null, 'فريقان، وكل فريق يختار ٣ فئات (المجموع ٦ فئات و٣٦ سؤالًا). في كل فئة سؤالان بقيمة ٢٠٠ وسؤالان ٤٠٠ وسؤالان ٦٠٠. الفريق صاحب الدور يختار السؤال ويجاوب أولًا، وإذا أخطأ تنتقل الفرصة للفريق الثاني بوقت أقصر. المقدّم يكشف الإجابة ويحدد من جاوب.'),
        teamBoxes, err,
        h('div', { class: 'qf-label' }, 'وقت الإجابة (الفريق صاحب الدور ثم الفريق الثاني)'), timeChips,
        h('p', { class: 'muted small' }, 'الصعوبة «الكل» = حسب قيمة السؤال: ٢٠٠ سهل، ٤٠٠ متوسط، ٦٠٠ صعب. إذا اخترت مستوى معيّنًا صارت كل الأسئلة منه.'),
        W.QP.filterBar ? W.QP.filterBar({}) : null,
        h('div', { class: 'row center' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { const r = shuffle(topics.filter(t => !t.sub).map(t => t.key)).slice(0, 6); team[0].picks = r.slice(0, 3); team[1].picks = r.slice(3); drawTeams(); check(); } }, '🎲 فئات عشوائية'),
          h('button', { class: 'btn primary big', id: 'startBtn', onclick: () => {
            if (!check()) return;
            const names = team.map((T, i) => (T.name || '').trim().slice(0, 24) || (i ? 'الفريق الثاني' : 'الفريق الأول'));
            if (names[0] === names[1]) names[1] += ' ٢';
            begin(team.map((T, i) => ({ name: names[i], picks: T.picks.slice(), helpers: T.helpers.slice() })), t1, t2, W.QP.getQFilters ? W.QP.getQFilters() : {});
          } }, '🔥 ابدأ اللعبة'))));
    }

    // ------------------------------------------------------------ GAME
    function begin(teamsIn, T1, T2, fl) {
      const cats = [...new Set(teamsIn.flatMap(t => t.picks.map(k => tByKey[k].cat)))];
      wrap.innerHTML = '';
      wrap.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ تجهيز اللوحة…'));
      Bank.ensure(cats).then(() => { if (!stopped) build(teamsIn, T1, T2, fl); })
        .catch(() => { wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center' }, 'تعذّر تحميل ملفات الأسئلة.')); });
    }

    function build(teamsIn, T1, T2, fl) {
      const teams = teamsIn.map(t => ({ name: t.name, score: 0, correct: 0, wrong: 0, helpers: Object.fromEntries(t.helpers.map(id => [id, true])) }));
      const used = new Set(); let relaxed = false;
      const cols = [];
      [0, 1, 2].forEach(k => [0, 1].forEach(i => { // interleave team picks like the real board
        const tp = tByKey[teamsIn[i].picks[k]];
        const cells = [];
        VALUES.forEach(v => [0, 1].forEach(side => {
          const got = pickQ(tp, DIFF_OF[v], used, fl, fl.diff || null);
          if (got.q) used.add(got.q.id); if (got.relaxed) relaxed = true;
          cells.push({ v, side, q: got.q, done: !got.q, by: null });
        }));
        cols.push({ topic: tp, owner: i, cells });
      }));
      const st = { score: 0, correct: 0, wrong: 0, best: 0, log: [], start: Date.now() };
      let turn = 0, swapCount = 0;
      const note = relaxed ? 'تنبيه: بعض الفئات ليس فيها أسئلة كافية بالمستوى/المرحلة المختارة، فاستُكملت من أقرب مستوى.' : null;

      function scoreBar() {
        return h('div', { class: 'sj-scores' }, teams.map((t, i) => h('div', { class: 'sj-team t' + i + (turn === i ? ' turn' : '') },
          h('div', { class: 'sj-tname' }, t.name, turn === i ? h('span', { class: 'sj-turn' }, '🎯 الدور') : null),
          h('div', { class: 'sj-tscore' }, fmt(t.score)),
          h('div', { class: 'sj-thelp' }, Object.keys(t.helpers).map(id => h('span', { class: 'sj-hicon' + (t.helpers[id] ? '' : ' used'), title: HELPERS[id].name + (t.helpers[id] ? '' : ' (مستخدمة)') }, HELPERS[id].icon))),
          h('div', { class: 'sj-adj' },
            h('button', { class: 'btn ghost tiny', title: 'إضافة ١٠٠', onclick: () => { t.score += 100; drawBoard(); } }, '+١٠٠'),
            h('button', { class: 'btn ghost tiny', title: 'خصم ١٠٠', onclick: () => { t.score -= 100; drawBoard(); } }, '−١٠٠')))));
      }

      function drawBoard() {
        if (ended) return;
        clearTimers();
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        if (note) wrap.appendChild(h('div', { class: 'filter-note' }, note));
        wrap.appendChild(scoreBar());
        const left = cols.reduce((n, c) => n + c.cells.filter(x => !x.done).length, 0);
        wrap.appendChild(h('div', { class: 'sj-turnline' }, '🎯 دور ', h('b', { class: 't' + turn }, teams[turn].name), ' — اختاروا سؤالًا', h('span', { class: 'muted' }, ' (باقي ' + toAr(left) + ' سؤالًا)')));
        const grid = h('div', { class: 'sj-board' });
        cols.forEach((c, ci) => {
          const side = s => h('div', { class: 'sj-side' }, c.cells.map((cell, k) => cell.side !== s ? null : h('button', {
            class: 'sj-cell' + (cell.done ? ' done' + (cell.by != null ? ' by' + cell.by : '') : ''), disabled: cell.done, 'data-col': ci, 'data-cell': k,
            onclick: () => openCell(ci, k) }, fmt(cell.v))));
          grid.appendChild(h('div', { class: 'sj-col', style: '--c:' + c.topic.color },
            side(0),
            h('div', { class: 'sj-cat' }, h('div', { class: 'sj-cat-icon' }, c.topic.icon), h('div', { class: 'sj-cat-name' }, c.topic.label), c.topic.sub ? h('div', { class: 'sj-cat-sub' }, c.topic.catName) : null, h('div', { class: 'sj-owner t' + c.owner }, teams[c.owner].name)),
            side(1)));
        });
        wrap.appendChild(grid);
        wrap.appendChild(h('div', { class: 'row center sj-tools' },
          h('button', { class: 'btn ghost small', onclick: () => { if (confirm('إنهاء اللعبة الآن وإعلان النتيجة؟')) end(); } }, '🏁 إنهاء اللعبة')));
        if (!left) end();
      }

      function clearTimers() { if (timer) { timer.stop(); timer = null; } if (callT) { callT.stop(); callT = null; } }

      function openCell(ci, k) {
        const col = cols[ci], cell = col.cells[k];
        if (cell.done) return;
        let q = cell.q;
        const ctx = { hole: null, trap: null, two: false, rest: false, call: false, phase: 'pre', answering: turn };
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(scoreBar());
        const box = h('div', { class: 'card sj-q' });
        wrap.appendChild(box);
        const head = () => h('div', { class: 'sj-qhead', style: '--c:' + col.topic.color },
          h('span', { class: 'sj-qcat' }, col.topic.icon + ' ' + col.topic.label), h('span', { class: 'sj-qval' }, fmt(cell.v) + ' نقطة'),
          ctx.hole != null ? h('span', { class: 'sj-flag' }, '🕳️ الحفرة') : null, ctx.trap != null ? h('span', { class: 'sj-flag' }, '🪤 الفخ') : null,
          ctx.two ? h('span', { class: 'sj-flag' }, '✌️ جوابين') : null, ctx.rest ? h('span', { class: 'sj-flag' }, '😴 استريح') : null);

        // phase 1: before seeing the question (الحفرة)
        function pre() {
          box.innerHTML = '';
          box.appendChild(head());
          const t = teams[turn];
          box.appendChild(h('div', { class: 'sj-pre' },
            h('div', { class: 'sj-pre-team t' + turn }, '🎯 ' + t.name),
            h('p', null, 'جاهزين؟ إذا تبون «الحفرة» استخدموها الحين قبل ما تشوفون السؤال.'),
            h('div', { class: 'row center' },
              t.helpers.hole ? h('button', { class: 'btn sj-help', onclick: () => { t.helpers.hole = false; ctx.hole = turn; Sound.combo(); show(); } }, '🕳️ استخدم الحفرة') : null,
              h('button', { class: 'btn primary big', id: 'sjShowQ', onclick: show }, '👁 اعرض السؤال'),
              h('button', { class: 'btn ghost', onclick: drawBoard }, '↩ رجوع للوحة'))));
        }

        let qArea = null, tb = null, status = null, helpRow = null, ctrlRow = null;
        function show() {
          ctx.phase = 'q';
          box.innerHTML = '';
          box.appendChild(head());
          qArea = h('div', { class: 'sj-qbody' });
          qArea.appendChild(h('h2', { class: 'q-text sj-qtext' }, q.question));
          if (q.type === 'who' && q.clues) qArea.appendChild(h('ul', { class: 'sj-clues' }, q.clues.map(c => h('li', { class: 'clue' }, c))));
          if (q.type === 'mcq' || q.type === 'who') {
            const optBox = h('div', { class: 'options sj-opts' + (OPT_DEP.test(q.question) ? '' : ' hidden') }, q.options.map((o, i) => h('div', { class: 'opt', 'data-i': i }, h('span', { class: 'opt-key' }, 'أبجد'[i] || ''), h('span', null, o))));
            qArea.appendChild(optBox);
            if (optBox.classList.contains('hidden')) qArea.appendChild(h('button', { class: 'btn ghost small', onclick: e => { optBox.classList.remove('hidden'); e.target.remove(); } }, '🔤 إظهار الخيارات (اختياري)'));
          }
          box.appendChild(qArea);
          status = h('div', { class: 'sj-status' });
          tb = tbar()();
          box.appendChild(status); box.appendChild(tb.el);
          helpRow = h('div', { class: 'row center sj-helps' });
          box.appendChild(helpRow);
          ctrlRow = h('div', { class: 'row center sj-ctrl' });
          box.appendChild(ctrlRow);
          box.appendChild(W.QP.Swap.bar(() => {
            if (ctx.phase !== 'q' || ended) return;
            if (timer) { timer.stop(); timer = null; }
            const nq = W.QP.Swap.pick({ used, current: q, types: TYPES, category: col.topic.cat, test: x => TYPES.includes(x.type) });
            if (!nq) return; swapCount++; q = nq; cell.q = nq; used.add(nq.id); show();
          }, swapCount));
          startTurn(ctx.answering, T1, true);
        }

        function drawHelps() {
          helpRow.innerHTML = '';
          if (ctx.phase !== 'q' || ctx.answering !== turn || ctx.trap != null) return;
          const t = teams[turn];
          HELPER_IDS.filter(id => HELPERS[id].when === 'after' && t.helpers[id]).forEach(id => helpRow.appendChild(h('button', { class: 'btn sj-help', title: HELPERS[id].desc, onclick: () => useHelper(id) }, HELPERS[id].icon + ' ' + HELPERS[id].name)));
        }
        function useHelper(id) {
          const t = teams[turn]; if (!t.helpers[id]) return;
          t.helpers[id] = false; Sound.combo();
          if (id === 'two') { ctx.two = true; flash('✌️ ' + t.name + ' تقدرون تقولون جوابين!'); }
          if (id === 'rest') { ctx.rest = true; flash('😴 ' + t.name + ': اختاروا أقوى لاعب في «' + teams[1 - turn].name + '» ليستريح عن هذا السؤال.'); }
          if (id === 'call') { ctx.call = true; if (timer) { timer.stop(); timer = null; } callFriend(); }
          if (id === 'trap') { ctx.trap = turn; flash('🪤 الفخ! السؤال انتقل إلى «' + teams[1 - turn].name + '» — إذا أخطؤوا تُخصم منهم ' + fmt(cell.v) + ' نقطة.'); startTurn(1 - turn, T1, false); }
          const hh = box.querySelector('.sj-qhead'); if (hh) hh.replaceWith(head());
          drawHelps();
        }
        function flash(msg) { const el = h('div', { class: 'sj-flash' }, msg); box.insertBefore(el, qArea.nextSibling); }
        function callFriend() {
          const cb = h('div', { class: 'sj-call' }, h('b', null, '📞 اتصال بصديق: '), h('span', { class: 'sj-call-left' }, toAr(30)), ' ثانية');
          box.insertBefore(cb, qArea.nextSibling);
          callT = Timer()(30, left => { const s = cb.querySelector('.sj-call-left'); if (s) s.textContent = toAr(Math.ceil(left)); }, () => { cb.classList.add('over'); cb.querySelector('.sj-call-left').textContent = '٠'; Sound.bad(); }).start();
        }

        function startTurn(who, secs, first) {
          ctx.answering = who;
          if (timer) { timer.stop(); timer = null; }
          status.innerHTML = '';
          status.className = 'sj-status t' + who;
          status.appendChild(h('span', null, (first ? '🎯 يجاوب الآن: ' : '🔁 الفرصة الآن لـ: '), h('b', null, teams[who].name)));
          ctrlRow.innerHTML = '';
          if (first && ctx.trap == null) ctrlRow.appendChild(h('button', { class: 'btn ghost', id: 'sjPass', onclick: () => { Sound.bad(); startTurn(1 - who, T2, false); } }, '✘ أخطأ — الفرصة للفريق الثاني'));
          ctrlRow.appendChild(h('button', { class: 'btn primary big', id: 'sjReveal', onclick: reveal }, '📢 إظهار الإجابة'));
          drawHelps();
          if (secs) {
            timer = Timer()(secs, left => { tb.set(left, left / secs); if (left < 4 && Math.ceil(left) !== Math.ceil(left + 0.1)) Sound.tick(); }, () => {
              Sound.bad();
              if (first && ctx.trap == null) startTurn(1 - who, T2, false);
              else status.appendChild(h('span', { class: 'sj-timeup' }, ' ⌛ انتهى الوقت'));
            }).start();
          } else tb.el.classList.add('hidden');
        }

        function reveal() {
          clearTimers();
          ctx.phase = 'a'; helpRow.innerHTML = ''; ctrlRow.innerHTML = '';
          W.QP.Swap.hide(box);
          box.querySelectorAll('.sj-opts .opt').forEach(o => { if (+o.dataset.i === q.answer) o.classList.add('correct'); });
          const fb = h('div', { class: 'feedback good sj-answer' },
            h('div', { class: 'fb-title' }, '📢 الإجابة: ', h('b', null, R().answerText(q))),
            q.explanation ? h('div', { class: 'fb-exp' }, q.explanation) : null, R().sourceBlock(q));
          box.insertBefore(fb, status);
          status.innerHTML = ''; status.className = 'sj-status';
          status.appendChild(h('span', null, 'من جاوب صح؟'));
          const award = h('div', { class: 'row center sj-award' },
            teams.map((t, i) => h('button', { class: 'btn big sj-aw t' + i, 'data-team': i, onclick: () => settle(i) }, '✔ ' + t.name)),
            h('button', { class: 'btn ghost big', id: 'sjNobody', onclick: () => settle(null) }, '✘ ولا أحد'));
          ctrlRow.appendChild(award);
        }

        function settle(w) {
          const v = cell.v; const lines = [];
          if (w != null) {
            teams[w].score += v; teams[w].correct++; lines.push('+' + fmt(v) + ' لـ ' + teams[w].name);
            if (ctx.hole === w) { teams[1 - w].score -= v; lines.push('🕳️ الحفرة: −' + fmt(v) + ' من ' + teams[1 - w].name); }
            Sound.good();
          } else Sound.bad();
          if (ctx.trap != null && w !== 1 - ctx.trap) { const o = 1 - ctx.trap; teams[o].score -= v; teams[o].wrong++; lines.push('🪤 الفخ: −' + fmt(v) + ' من ' + teams[o].name); }
          cell.done = true; cell.by = w;
          st.log.push({ q, res: { correct: w != null }, pts: w != null ? v : 0, player: w != null ? teams[w].name : null });
          turn = 1 - turn;
          if (lines.length) {
            const pop = h('div', { class: 'sj-pop' }, lines.join(' • '));
            document.body.appendChild(pop); setTimeout(() => pop.remove(), 1800);
          }
          drawBoard();
        }

        pre();
      }

      function end() {
        if (ended) return; ended = true; clearTimers();
        const list = teams.map(t => ({ name: t.name, score: t.score, correct: t.correct, wrong: t.wrong })).sort((a, b) => b.score - a.score);
        const me = teams[0];
        st.score = Math.max(0, me.score); st.correct = st.log.filter(l => l.player === me.name).length; st.wrong = st.log.length - st.correct;
        const tie = list[0].score === list[1].score;
        finish({ game, st, opts, reason: 'done', party: 'seenjeem', multi: list, winner: tie ? null : list[0].name, hostName: me.name });
      }

      drawBoard();
    }

    setup();
    return { stop() { stopped = ended = true; if (timer) timer.stop(); if (callT) callT.stop(); if (keyH) W.removeEventListener('keydown', keyH); } };
  }

  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.seenjeem = run;
  W.QP.SEENJEEM = { HELPERS, VALUES, topicList };
})(window);
