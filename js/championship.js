/* championship.js — البطولة الكبرى: خمس جولات تغطي كل الأقسام */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr, Player, Board } = W.QP;
  const { questionCard, feedback } = W.QP.render;
  const Timer = () => W.QP.Timer, tbar = () => W.QP.timerBar, spin = () => W.QP.spinWheel;
  const fast = () => !!W.__QP_FAST;
  const after = (ms, fn) => { if (fast()) { fn(); return 0; } return setTimeout(fn, ms); };
  const fmt = n => toAr(Number(Math.round(n || 0)).toLocaleString('en'));
  const ALLQ = ['mcq', 'tf', 'who', 'fill', 'order', 'match'];
  const CHOICE = ['mcq', 'tf'];

  const ROUNDS = [
    { id: 'warm',  name: 'الإحماء',          title: 'الجولة الأولى: الإحماء',          icon: '🌅', desc: 'أسئلة متنوعة من عدة أقسام لتسخين الهمم.', types: CHOICE, diff: [1, 2], perQ: 20, speedBonus: true, streak: true },
    { id: 'blitz', name: 'البرق',             title: 'الجولة الثانية: البرق',           icon: '⚡', desc: 'وقت قصير جدًا… أجب بأقصى سرعة!', types: CHOICE, diff: [1, 2], perQ: 8, speedBonus: true, speedWeight: 3, streak: true },
    { id: 'wheel', name: 'عجلة الأقسام',      title: 'الجولة الثالثة: عجلة الأقسام',    icon: '🎡', desc: 'العجلة تدور وتختار القسم قبل كل سؤال!', types: CHOICE.concat(['who']), diff: [1, 2, 3], perQ: 18, wheel: true, speedBonus: true, streak: true },
    { id: 'skill', name: 'المهارة',           title: 'الجولة الرابعة: المهارة',         icon: '🧩', desc: 'من أنا؟ رتّب وصِل… أثبت مهارتك.', types: ['who', 'order', 'match'], diff: [1, 2, 3], perQ: 45, streak: true },
    { id: 'gold',  name: 'الجولة الذهبية',    title: 'الجولة الخامسة: الجولة الذهبية', icon: '🥇', desc: 'أسئلة أصعب ونقاط مضاعفة. هذه جولة التتويج!', types: ['mcq', 'who', 'fill'], diff: [3], perQ: 25, scoreMult: 2, speedBonus: true, streak: true, golden: true }
  ];
  const LENGTHS = {
    quick:  { key: 'quick',  label: 'سريعة',  hint: '١٢ سؤالًا — نحو ١٠ دقائق', counts: [3, 2, 3, 2, 2] },
    normal: { key: 'normal', label: 'عادية',  hint: '٢٤ سؤالًا — نحو ٢٠ دقيقة', counts: [5, 5, 5, 4, 5] },
    long:   { key: 'long',   label: 'طويلة',  hint: '٣٦ سؤالًا — نحو نصف ساعة', counts: [7, 8, 7, 7, 7] }
  };

  function pickOne(cat, types, diff, used, filters, allowRelax) {
    const layers = [];
    const fl = filters || {};
    layers.push(fl);
    if (allowRelax && fl.stage) layers.push(Object.assign({}, fl, { stage: null }));
    if (allowRelax && (fl.stage || fl.diff)) layers.push({ diff: null, stage: null });
    let relaxed = false;
    for (const layer of layers) {
      const d = layer.diff ? [layer.diff] : diff;
      const tries = [
        { cats: cat ? [cat] : null, types, diff: d, stage: layer.stage || undefined },
        { cats: cat ? [cat] : null, types, stage: layer.stage || undefined },
        { cats: cat ? [cat] : null, diff: d, stage: layer.stage || undefined },
        { cats: cat ? [cat] : null, stage: layer.stage || undefined },
        { types, diff: d, stage: layer.stage || undefined },
        { types, stage: layer.stage || undefined },
        layer.stage || layer.diff ? { stage: layer.stage || undefined, diff: d } : {}
      ];
      for (const f of tries) {
        if (!f.stage) delete f.stage;
        if (!f.diff) delete f.diff;
        if (!f.cats) delete f.cats;
        const list = Bank.filter(f).filter(q => !used.has(q.id));
        if (list.length) {
          if (layer !== fl) relaxed = true;
          return { q: list[Math.floor(Math.random() * list.length)], relaxed };
        }
      }
    }
    return { q: null, relaxed };
  }
  function buildRounds(lenKey, filters) {
    const len = LENGTHS[lenKey] || LENGTHS.normal;
    const cats = shuffle(Bank.cats.map(c => c.id));
    const total = len.counts.reduce((a, b) => a + b, 0);
    const plan = [];
    for (let i = 0; i < total; i++) plan.push(cats[i % cats.length]);
    const used = new Set();
    let relaxed = false;
    function fill(allowRelax) {
      const leftover = plan.slice();
      const rounds = ROUNDS.map((r, ri) => {
        const n = len.counts[ri], slice = leftover.splice(0, n), qs = [];
        slice.forEach(cat => { const got = pickOne(cat, r.types, r.diff, used, filters, allowRelax); if (got.q) { used.add(got.q.id); qs.push(got.q); if (got.relaxed) relaxed = true; } });
        while (qs.length < n) { const got = pickOne(null, r.types, r.diff, used, filters, allowRelax); if (!got.q) break; used.add(got.q.id); qs.push(got.q); if (got.relaxed) relaxed = true; }
        return Object.assign({}, r, { qs });
      });
      return rounds;
    }
    let rounds = fill(false);
    if (rounds.some((r, i) => r.qs.length < len.counts[i]) && (filters && (filters.stage || filters.diff))) {
      used.clear();
      rounds = fill(true);
    }
    const note = relaxed && W.QP.relaxNote ? W.QP.relaxNote(filters, (filters.stage && filters.diff) ? 'stage,diff' : filters.stage ? 'stage' : 'diff') : null;
    return { rounds, note };
  }

  function confetti(root) {
    if (!root) return;
    const box = h('div', { class: 'champ-confetti', 'aria-hidden': 'true' });
    const cols = ['#e8962e', '#5fd0d6', '#f5b45a', '#4fd08a', '#fff', '#ff7a6b'];
    for (let i = 0; i < 90; i++) {
      box.appendChild(h('i', { style: { left: (Math.random() * 100) + '%', background: cols[i % cols.length], animationDelay: (Math.random() * 0.9) + 's', animationDuration: (1.8 + Math.random() * 1.6) + 's', transform: 'rotate(' + (Math.random() * 360) + 'deg)' } }));
    }
    root.appendChild(box);
    setTimeout(() => box.remove(), 4500);
  }
  W.QP.confetti = confetti;
  W.QP.CHAMP_ROUNDS = ROUNDS;
  W.QP.CHAMP_LENGTHS = LENGTHS;

  function comboPop(root, n) {
    if (n < 2) return;
    const el = h('div', { class: 'champ-combo' }, '🔥 ×' + toAr(n));
    root.appendChild(el); Sound.combo();
    setTimeout(() => el.remove(), 900);
  }

  function runChampionship(game, root, opts, finish) {
    let stopped = false, perT = null, cur = null, ended = false;
    const wrap = h('div', { class: 'champ-wrap' });
    root.appendChild(wrap);

    function setup() {
      wrap.innerHTML = '';
      let nP = 1, lenKey = 'normal';
      const namesBox = h('div', { class: 'champ-names' });
      const drawNames = () => {
        namesBox.innerHTML = '';
        const prev = [...wrap.querySelectorAll('.champ-names .inp')].map(i => i.value);
        for (let i = 0; i < nP; i++) {
          const def = prev[i] || (i === 0 && Player.name) || (nP === 1 ? 'لاعب' : 'متسابق ' + toAr(i + 1));
          namesBox.appendChild(h('label', null, nP === 1 ? 'اسم اللاعب' : 'اسم المتسابق ' + toAr(i + 1),
            h('input', { class: 'inp', maxlength: 20, value: def, placeholder: 'اكتب الاسم' })));
        }
      };
      const pChips = h('div', { class: 'chips center champ-pills' });
      const lChips = h('div', { class: 'chips center champ-pills' });
      const drawP = () => {
        pChips.innerHTML = '';
        [1, 2, 3, 4, 5, 6].forEach(n => pChips.appendChild(h('button', { type: 'button', class: 'chip' + (nP === n ? ' on' : ''), onclick: () => { nP = n; drawP(); drawNames(); } }, n === 1 ? 'فردي' : toAr(n) + ' متسابقين')));
      };
      const drawL = () => {
        lChips.innerHTML = '';
        Object.values(LENGTHS).forEach(L => lChips.appendChild(h('button', { type: 'button', class: 'chip' + (lenKey === L.key ? ' on' : ''), onclick: () => { lenKey = L.key; drawL(); hint.textContent = L.hint; } }, L.label)));
      };
      const hint = h('p', { class: 'muted small' }, LENGTHS.normal.hint);
      drawP(); drawL(); drawNames();
      const startBtn = h('button', { class: 'btn primary big', id: 'startBtn', onclick: () => {
        const names = [...namesBox.querySelectorAll('.inp')].map(i => (i.value || '').trim().slice(0, 20) || 'متسابق');
        if (names[0]) Player.name = names[0];
        begin(names, lenKey, W.QP.getQFilters ? W.QP.getQFilters() : {});
      } }, '🔥 ابدأ البطولة');
      wrap.appendChild(h('div', { class: 'card intro champ-setup' },
        h('div', { class: 'intro-icon' }, '🏆'),
        h('h1', null, 'البطولة الكبرى'),
        h('p', null, 'مسابقة شاملة حماسية تغطي كل الأقسام الاثني عشر في خمس جولات مختلفة. جهّز نفسك أو فرّق المتسابقين، واختار مدة البطولة.'),
        h('div', { class: 'champ-rounds-preview' }, ROUNDS.map(r => h('div', { class: 'champ-rp' }, h('span', null, r.icon), h('b', null, r.name), h('small', null, r.desc)))),
        h('label', null, 'عدد المتسابقين (فردي أو أسماء الفرق)'), pChips,
        namesBox,
        h('label', null, 'مدة البطولة'), lChips, hint,
        W.QP.filterBar ? W.QP.filterBar({}) : null,
        startBtn,
        h('p', { class: 'muted small' }, 'تُحفظ النتيجة في ملفك ولوحة الصدارة مثل بقية الألعاب.')));
    }

    function begin(names, lenKey, filters) {
      const built = buildRounds(lenKey, filters || {});
      const rounds = built.rounds;
      if (rounds.every(r => !r.qs.length)) { wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center' }, 'تعذّر تجهيز الأسئلة.')); return; }
      const filterNote = built.note;
      const players = names.map((name, i) => ({ name, score: 0, correct: 0, wrong: 0, streak: 0, best: 0, prevRank: i }));
      const st = { i: 0, score: 0, correct: 0, wrong: 0, streak: 0, best: 0, log: [], start: Date.now(), roundPts: [] };
      let rIdx = 0, qIdx = 0, turn = 0, prevRanks = players.map((_, i) => i);

      function ranked() { return players.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ar')); }

      function drawHud(round) {
        const p = players[turn];
        const hud = h('div', { class: 'hud champ-hud' });
        hud.appendChild(h('div', { class: 'hud-item' }, '🏆 ', h('b', null, fmt(players.length === 1 ? p.score : p.score))));
        hud.appendChild(h('div', { class: 'hud-item' }, '❓ ' + toAr(qIdx + 1) + ' / ' + toAr(round.qs.length)));
        if (players.length > 1) hud.appendChild(h('div', { class: 'hud-item champ-turn' }, '🎯 دور: ', h('b', null, p.name)));
        hud.appendChild(h('div', { class: 'hud-item' + (p.streak >= 2 ? ' champ-hot' : '') }, '🔥 ', toAr(p.streak)));
        const steps = h('div', { class: 'champ-steps' }, rounds.map((rr, i) => h('span', { class: 'champ-step' + (i === rIdx ? ' on' : i < rIdx ? ' done' : '') + (rr.golden ? ' gold' : ''), title: rr.title }, rr.icon)));
        return { hud, steps };
      }

      function showScoreboard(done, onNext) {
        const list = ranked();
        const rows = list.map((p, k) => {
          const now = k, was = prevRanks.indexOf(players.indexOf(p));
          const mv = was < 0 || was === now ? '•' : now < was ? '▲' : '▼';
          const cls = was >= 0 && now < was ? 'up' : was >= 0 && now > was ? 'down' : '';
          return h('div', { class: 'champ-sb-row ' + cls },
            h('span', { class: 'champ-sb-rank' }, ['🥇', '🥈', '🥉'][k] || toAr(k + 1)),
            h('b', null, p.name),
            h('span', { class: 'champ-sb-mv ' + cls }, mv),
            h('span', { class: 'champ-sb-sc' }, fmt(p.score)));
        });
        prevRanks = list.map(p => players.indexOf(p));
        wrap.innerHTML = '';
        wrap.appendChild(h('div', { class: 'card champ-board center' },
          h('h2', null, done ? '🏁 نهاية البطولة' : '📊 ترتيب الجولة'),
          h('p', { class: 'muted' }, done ? 'توجّهوا إلى المنصة!' : 'هكذا وقف المتسابقون بعد «' + rounds[rIdx].name + '»'),
          h('div', { class: 'champ-sb' }, rows),
          h('button', { class: 'btn primary big', onclick: onNext }, done ? 'عرض النتيجة النهائية ←' : 'الجولة التالية ←')));
      }

      function splash(round, then) {
        Sound.fanfare();
        wrap.innerHTML = '';
        if (filterNote && rIdx === 0) wrap.appendChild(h('div', { class: 'filter-note' }, filterNote));
        const el = h('div', { class: 'champ-splash' + (round.golden ? ' gold' : '') },
          h('div', { class: 'champ-splash-icon' }, round.icon),
          h('div', { class: 'champ-kicker' }, 'الجولة ' + toAr(rIdx + 1) + ' من ' + toAr(rounds.length)),
          h('h1', null, round.title),
          h('p', null, round.desc),
          round.golden ? h('div', { class: 'champ-double' }, '✨ النقاط مضاعفة ×٢') : null,
          h('button', { class: 'btn primary big', onclick: () => { clearTimeout(tid); then(); } }, 'انطلق!'));
        wrap.appendChild(el);
        const tid = after(fast() ? 0 : 2200, then);
      }

      function countdown(then) {
        if (fast()) return then();
        wrap.innerHTML = '';
        const num = h('div', { class: 'champ-count-num' }, '٣');
        wrap.appendChild(h('div', { class: 'champ-count' }, num));
        const seq = ['٣', '٢', '١', 'انطلق!'];
        let i = 0;
        const tick = () => {
          if (stopped || ended) return;
          num.textContent = seq[i];
          num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
          if (i < 3) Sound.count(); else Sound.go();
          i++;
          if (i < seq.length) setTimeout(tick, 700);
          else setTimeout(then, 450);
        };
        tick();
      }

      function playRound() {
        const round = rounds[rIdx];
        qIdx = 0;
        splash(round, () => countdown(() => showQ()));
      }

      function showQ() {
        if (stopped || ended) return;
        const round = rounds[rIdx];
        if (qIdx >= round.qs.length) return afterRound();
        const q = round.qs[qIdx];
        const p = players[turn];
        wrap.innerHTML = '';
        const { hud, steps } = drawHud(round);
        const tb = tbar()();
        const stage = h('div', { class: 'stage' });
        wrap.appendChild(steps); wrap.appendChild(hud); wrap.appendChild(tb.el); wrap.appendChild(stage);

        const go = () => {
          const t0 = Date.now();
          cur = { q, answered: false };
          const { card, ctrl } = questionCard(q, res => onAnswer(round, q, res, (Date.now() - t0) / 1000, tb), { rnd: Math.random, perQ: round.perQ });
          cur.ctrl = ctrl; stage.appendChild(card);
          if (round.perQ) {
            const lim = (q.type === 'order' || q.type === 'match') ? Math.max(round.perQ, 60) : q.type === 'fill' ? Math.max(round.perQ, 30) : round.perQ;
            perT = Timer()(lim, left => { tb.set(left, left / lim); if (left < 4 && Math.ceil(left) !== Math.ceil(left + 0.1)) Sound.tick(); }, () => { ctrl.lock && ctrl.lock(); onAnswer(round, q, { correct: false, timeout: true }, lim, tb); }).start();
          }
        };
        if (round.wheel && !fast()) spin()(stage, q, go); else go();
      }

      function onAnswer(round, q, res, secs, tb) {
        if (!cur || cur.answered || ended) return; cur.answered = true;
        if (perT) { perT.stop(); perT = null; }
        if (cur.ctrl && cur.ctrl.cleanup) cur.ctrl.cleanup();
        const p = players[turn];
        let pts = 0, mult = (res.mult || 1) * (round.scoreMult || 1);
        if (res.correct || res.partial) {
          const base = 100 * (q.difficulty || 1) * (res.correct ? 1 : res.partial * 0.6);
          if (round.speedBonus && tb && perT) { /* perT already stopped; use secs vs limit */ }
          if (round.speedBonus && secs != null && round.perQ) {
            const lim = (q.type === 'order' || q.type === 'match') ? Math.max(round.perQ, 60) : q.type === 'fill' ? Math.max(round.perQ, 30) : round.perQ;
            const frac = Math.max(0, 1 - (secs / lim));
            mult *= 1 + 0.5 * (round.speedWeight || 1) * frac;
          }
          if (res.correct) { p.streak++; p.best = Math.max(p.best, p.streak); if (round.streak) mult *= 1 + Math.min(p.streak - 1, 10) * 0.1; }
          pts = base * mult;
        }
        if (res.correct) { p.correct++; st.correct++; Sound.good(); } else { p.wrong++; st.wrong++; p.streak = 0; Sound.bad(); }
        p.score += pts; st.score = players.length === 1 ? p.score : ranked()[0].score;
        st.log.push({ q, res, pts, secs, player: p.name });
        const stageCard = wrap.querySelector('.q-card');
        if (res.correct && p.streak >= 2) comboPop(wrap, p.streak);
        const nextBtn = h('button', { class: 'btn primary', onclick: nextQ }, qIdx + 1 >= round.qs.length ? 'عرض ترتيب الجولة ←' : 'السؤال التالي ←');
        const extra = h('div', { class: 'row end champ-fb' }, h('span', { class: 'pts' }, pts ? '+' + fmt(pts) + ' نقطة' : ''), nextBtn);
        if (stageCard) stageCard.appendChild(feedback(q, res, extra));
        else wrap.appendChild(feedback(q, res, extra));
        // refresh hud score
        const hudSc = wrap.querySelector('.hud-item b');
        if (hudSc) hudSc.textContent = fmt(p.score);
      }

      function nextQ() {
        if (ended) return;
        qIdx++;
        if (players.length > 1) turn = (turn + 1) % players.length;
        showQ();
      }

      function afterRound() {
        st.roundPts.push(ranked().map(p => ({ name: p.name, score: p.score })));
        if (rIdx + 1 >= rounds.length) {
          showScoreboard(true, endGame);
        } else {
          showScoreboard(false, () => { rIdx++; turn = 0; playRound(); });
        }
      }

      function endGame() {
        if (ended) return; ended = true;
        if (perT) perT.stop();
        const list = ranked();
        const hostName = Player.name || names[0];
        const host = players.find(p => p.name === hostName) || players[0];
        // st reflects the recorded player (the device profile / first name)
        st.score = host.score; st.correct = host.correct; st.wrong = host.wrong; st.best = host.best;
        const res = { game, st, opts, reason: 'done', championship: true, hostName: host.name };
        if (players.length > 1) res.multi = list;
        finish(res);
      }

      playRound();
    }

    setup();
    return { stop() { stopped = ended = true; if (perT) perT.stop(); } };
  }

  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.championship = runChampionship;
})(window);
