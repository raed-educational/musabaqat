/* letters.js — تحدي الحروف: حرف يُسحب كل جولة، سباق إجابات تبدأ بالحرف، ثم جولة «عبّي الخانات». */
(function (W) {
  'use strict';
  const { h, Bank, Sound, shuffle, toAr } = W.QP;
  const K = () => W.QP.Kit;
  const SHOW = { 'ا': 'أ', 'ه': 'هـ' };
  const SURAHS = 'الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبأ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبأ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس'.split(' ').map(s => s.replace('_', ' '));
  const PROPHETS = 'آدم إدريس نوح هود صالح إبراهيم لوط إسماعيل إسحاق يعقوب يوسف أيوب شعيب موسى هارون ذو_الكفل داود سليمان إلياس اليسع يونس زكريا يحيى عيسى محمد'.split(' ').map(s => s.replace('_', ' '));
  const CITIES = 'الرياض جدة مكة_المكرمة المدينة_المنورة الدمام الخبر الظهران الأحساء القطيف الجبيل الطائف تبوك بريدة عنيزة الرس حائل أبها خميس_مشيط جازان نجران الباحة سكاكا عرعر القريات الخرج المجمعة الزلفي شقراء الدوادمي وادي_الدواسر الأفلاج ينبع العلا الوجه ضباء أملج رابغ القنفذة الليث بيشة النماص محايل_عسير صبيا أبو_عريش صامطة شرورة حفر_الباطن الخفجي رأس_تنورة بقيق النعيرية طريف رفحاء تيماء دومة_الجندل طبرجل الغاط حوطة_بني_تميم الدرعية ثادق ضرما المزاحمية رنية تربة الخرمة ظلم البدائع البكيرية المذنب'.split(' ').map(s => s.replace(/_/g, ' '));
  const COUNTRIES = 'السعودية الإمارات البحرين الكويت قطر عمان اليمن العراق الأردن سوريا لبنان فلسطين مصر السودان ليبيا تونس الجزائر المغرب موريتانيا الصومال جيبوتي جزر_القمر تركيا إيران باكستان أفغانستان الهند بنغلاديش إندونيسيا ماليزيا بروناي الصين اليابان كوريا تايلاند الفلبين فيتنام سنغافورة كازاخستان أوزبكستان طاجيكستان ألبانيا البوسنة فرنسا ألمانيا إيطاليا إسبانيا البرتغال بريطانيا هولندا بلجيكا سويسرا النمسا السويد النرويج الدنمارك فنلندا بولندا روسيا اليونان كندا أمريكا المكسيك البرازيل الأرجنتين تشيلي كولومبيا بيرو أستراليا نيوزيلندا نيجيريا السنغال مالي النيجر تشاد إثيوبيا كينيا غانا الكاميرون'.split(' ').map(s => s.replace(/_/g, ' '));
  const FILL = [
    { id: 'sahabi', name: 'صحابي', icon: '⭐' }, { id: 'surah', name: 'سورة', icon: '📖', list: SURAHS }, { id: 'nabi', name: 'نبي', icon: '🌙', list: PROPHETS },
    { id: 'alim', name: 'عالم', icon: '🎓' }, { id: 'city', name: 'مدينة سعودية', icon: '🇸🇦', list: CITIES }, { id: 'country', name: 'دولة', icon: '🌍', list: COUNTRIES },
    { id: 'club', name: 'نادٍ رياضي', icon: '⚽' }, { id: 'book', name: 'كتاب', icon: '📚' }, { id: 'ghazwa', name: 'غزوة أو مكان في السيرة', icon: '🏕️' }
  ];
  const strip = s => String(s).replace(/[\u064B-\u065F\u0670]/g, '');
  const firstL = s => { let x = strip(s).replace(/^ال(?=..)/, ''); const c = x[0] || ''; return c.replace(/[أإآٱء]/, 'ا').replace('ى', 'ي').replace('ة', 'ه'); };
  let dataP = null;
  function loadData() {
    if (W.HUROOF_Q && W.HUROOF_SCHOOL) return Promise.resolve();
    return dataP = dataP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'data/huroof.js'; s.onload = () => { const t = document.createElement('script'); t.src = 'data/huroof-school.js'; t.onload = res; t.onerror = res; document.head.appendChild(t); }; s.onerror = () => { dataP = null; rej(new Error('letters')); }; document.head.appendChild(s); });
  }

  function run(game, root, opts, finish) {
    let stopped = false, ended = false, timer = null, keyH = null, spinT = 0;
    const wrap = h('div', { class: 'lt-wrap' });
    root.appendChild(wrap);
    let rounds = 5, race = 60, fillOn = true, fillSecs = 60;
    let fillCats = ['sahabi', 'surah', 'nabi', 'alim', 'city', 'country'];
    K().setup(wrap, {
      icon: '🔤', title: 'تحدي الحروف', min: 2, max: 4, def: 2,
      desc: 'كل جولة يُسحب حرف عشوائي. أولًا «سباق الحرف»: أسئلة جوابها يبدأ بالحرف، وأسرع فريق يضغط ويجاوب صح ياخذ النقاط قبل ما يخلص الوقت. ثم «عبّي الخانات»: كل فريق يكتب صحابي وسورة ونبي ومدينة… تبدأ بنفس الحرف، والمقدّم يصحح.',
      rules: ['السباق: صح = +١٠٠، خطأ = −٥٠ ويُقفل الجرس على الفريق لهذا السؤال.', 'الخانات: إجابة صحيحة لم يكتبها غيرك = ١٠٠، مكررة مع فريق آخر = ٥٠.', 'الجرس: أزرار الفرق أو مفاتيح ١ ٢ ٣ ٤.'],
      extras: () => {
        const fc = h('div', { class: 'chips center' });
        const drawF = () => { fc.innerHTML = ''; FILL.forEach(f => { const on = fillCats.includes(f.id); fc.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: () => { fillCats = on ? fillCats.filter(x => x !== f.id) : fillCats.concat(f.id); if (!fillCats.length) fillCats = ['surah']; drawF(); } }, f.icon + ' ' + f.name)); }); };
        drawF();
        return [K().choice('عدد الجولات (الحروف)', [[3, '٣'], [5, '٥'], [7, '٧']], () => rounds, v => { rounds = v; }),
          K().choice('وقت سباق الحرف', [[45, '٤٥ ث'], [60, '٦٠ ث'], [90, '٩٠ ث']], () => race, v => { race = v; }),
          K().choice('جولة «عبّي الخانات»', [[true, 'مفعّلة'], [false, 'بدونها']], () => fillOn, v => { fillOn = v; }),
          h('div', { class: 'qf-label' }, 'خانات الجولة'), fc];
      },
      startLabel: '🔤 ابدأ التحدي',
      onStart: cfg => { wrap.innerHTML = ''; wrap.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ التحميل…')); loadData().then(() => { if (!stopped) begin(cfg); }).catch(() => { wrap.innerHTML = 'تعذّر التحميل'; }); }
    });

    function begin(cfg) {
      const teams = cfg.names.map(name => ({ name, score: 0, correct: 0 }));
      const log = [];
      const fl = cfg.filters || {};
      const used = new Set();
      let swapCount = 0;
      const okRow = r => cfg.cats.includes(r[1]);
      const rowsFor = L => (W.HUROOF_Q[L] || []);
      const letters = W.QP.HUROOF ? W.QP.HUROOF.LETTERS : Object.keys(W.HUROOF_Q);
      const rich = letters.filter(L => rowsFor(L).filter(okRow).length >= 12);
      const deck = shuffle(rich.length >= rounds ? rich : letters).slice(0, rounds);
      let rIdx = 0;

      function pick(L) {
        const rows = rowsFor(L);
        const sch = fl.stage === 'mutawassit' && fl.diff === 1;
        const layers = [r => okRow(r) && (!fl.diff || r[2] === fl.diff) && (!fl.stage || r[3] === fl.stage) && (!sch || r[9] === 1), r => sch && r[9] === 1, r => okRow(r) && (!fl.diff || r[2] === fl.diff), okRow, () => true];
        for (const f of layers) { const l = rows.filter(r => f(r) && !used.has(r[0])); if (l.length) { const r = l[Math.floor(Math.random() * l.length)]; used.add(r[0]); return { id: r[0], category: r[1], difficulty: r[2], stage: r[3], question: r[4], answer: r[5], accept: [r[5]], type: 'fill', clues: r[6] || null, source: r[7], subcategory: r[8] }; } }
        return null;
      }
      function pickEasy(L, current) {
        const rows = rowsFor(L).concat((W.HUROOF_SCHOOL && W.HUROOF_SCHOOL[L]) || []);
        const pool = rows.map(r => ({ id: r[0], category: r[1], difficulty: r[2], stage: r[3], question: r[4], answer: r[5], accept: [r[5]], type: 'fill', clues: r[6] || null, source: r[7], subcategory: r[8], curated: r[9] === 1 ? 'school' : undefined }));
        return W.QP.Swap.pick({ pool, used, current, cats: cfg.cats, category: current && current.category });
      }
      function stopTimer() { if (timer) { timer.stop(); timer = null; } }
      function setKeys(fn) { if (keyH) W.removeEventListener('keydown', keyH); keyH = fn; if (fn) W.addEventListener('keydown', fn); }

      function drawLetter() {
        if (ended) return;
        const L = deck[rIdx];
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        wrap.appendChild(K().scores(teams, -1));
        const big = h('div', { class: 'lt-draw' }, '؟');
        wrap.appendChild(h('div', { class: 'card center lt-drawcard' }, h('div', { class: 'champ-kicker' }, 'الجولة ' + toAr(rIdx + 1) + ' من ' + toAr(deck.length)), h('h2', null, 'سحب الحرف…'), big,
          h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'ltGo', disabled: true, onclick: () => raceRound(L) }, '⚡ ابدأ سباق الحرف'))));
        let n = 0; const total = K().fast() ? 1 : 16;
        const spin = () => { big.textContent = SHOW[letters[n % letters.length]] || letters[(n * 7) % letters.length]; Sound.tick(); if (++n < total) spinT = setTimeout(spin, 60 + n * 8); else { big.textContent = SHOW[L] || L; big.classList.add('landed'); Sound.fanfare(); wrap.querySelector('#ltGo').disabled = false; } };
        spin();
      }

      function raceRound(L) {
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        const sc = h('div'); const drawSc = () => { sc.innerHTML = ''; sc.appendChild(K().scores(teams, -1)); };
        drawSc();
        const tb = W.QP.timerBar();
        const head = h('div', { class: 'lt-head' }, h('div', { class: 'lt-letter' }, SHOW[L] || L), h('div', null, h('div', { class: 'champ-kicker' }, 'سباق الحرف — الجولة ' + toAr(rIdx + 1)), h('div', { class: 'lt-hint' }, 'كل الإجابات تبدأ بحرف «' + (SHOW[L] || L) + '»')));
        const stage = h('div', { class: 'card lt-stage' });
        wrap.appendChild(sc); wrap.appendChild(head); wrap.appendChild(tb.el); wrap.appendChild(stage);
        let over = false;
        timer = K().timer(race, tb, () => { over = true; Sound.bad(); afterRace(); });
        function afterRace() { stopTimer(); setKeys(null); if (fillOn) fillRound(L); else nextRound(); }
        function nextQ(forced) {
          if (over || ended) return;
          const q = forced || pick(L); if (!q) return afterRace();
          const c = Bank.cat(q.category) || {};
          stage.innerHTML = '';
          stage.appendChild(h('div', { class: 'q-meta' }, h('span', { class: 'tag light' }, (c.icon || '') + ' ' + (c.name || ''))));
          stage.appendChild(h('h2', { class: 'q-text lt-q' }, q.question));
          if (q.clues) stage.appendChild(h('ul', { class: 'sj-clues' }, q.clues.map(x => h('li', { class: 'clue' }, x))));
          const status = h('div', { class: 'kit-msg' }, '🔔 أسرع فريق!');
          const ctrl = h('div', { class: 'kit-ctrl' });
          stage.appendChild(status); stage.appendChild(ctrl);
          stage.appendChild(W.QP.Swap.bar(() => {
            if (over || ended) return;
            const nq = pickEasy(L, q);
            if (!nq) return; swapCount++; nextQ(nq);
          }, swapCount));
          const locked = teams.map(() => false); let buzzed = null;
          function draw() {
            ctrl.innerHTML = '';
            if (buzzed == null) {
              teams.forEach((t, i) => ctrl.appendChild(h('button', { class: 'lt-buzz', 'data-team': i, style: '--tc:' + K().COLORS[i], disabled: locked[i], onclick: () => buzz(i) }, '🔔 ' + t.name, h('small', null, toAr(i + 1)))));
              ctrl.appendChild(h('button', { class: 'btn ghost', id: 'ltSkip', onclick: () => { status.textContent = '📢 الإجابة: ' + q.answer; log.push({ q, res: { correct: false }, pts: 0 }); ctrl.innerHTML = ''; ctrl.appendChild(h('button', { class: 'btn primary', id: 'ltNext', onclick: nextQ }, 'التالي ←')); } }, '⏭ تخطي (إظهار الإجابة)'));
            } else {
              ctrl.appendChild(h('button', { class: 'btn primary big', id: 'ltRight', onclick: () => { const t = teams[buzzed]; t.score += 100; t.correct++; Sound.good(); log.push({ q, res: { correct: true }, pts: 100, player: t.name }); status.className = 'kit-msg good'; status.textContent = '✔ ' + t.name + ' +١٠٠ — الإجابة: ' + q.answer; drawSc(); ctrl.innerHTML = ''; K().after(1100, nextQ); } }, '✔ صح'));
              ctrl.appendChild(h('button', { class: 'btn big', id: 'ltWrong', onclick: () => { const t = teams[buzzed]; t.score -= 50; locked[buzzed] = true; Sound.bad(); drawSc(); buzzed = null; status.className = 'kit-msg bad'; status.textContent = '✘ ' + t.name + ' −٥٠ — الفرصة للبقية'; if (locked.every(Boolean)) { status.textContent = '📢 الإجابة: ' + q.answer; log.push({ q, res: { correct: false }, pts: 0 }); ctrl.innerHTML = ''; K().after(1300, nextQ); } else draw(); } }, '✘ خطأ'));
            }
          }
          function buzz(i) { if (buzzed != null || locked[i] || over) return; buzzed = i; Sound.go(); status.className = 'kit-msg'; status.textContent = '🔔 ' + teams[i].name + ' يجاوب!'; draw(); }
          setKeys(e => { const n = '١٢٣٤'.indexOf(e.key) >= 0 ? '١٢٣٤'.indexOf(e.key) : '1234'.indexOf(e.key); if (n >= 0 && n < teams.length) buzz(n); });
          draw();
        }
        nextQ();
        stage.parentNode.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn ghost small', id: 'ltEndRace', onclick: () => { over = true; afterRace(); } }, '⏩ إنهاء السباق')));
      }

      function fillRound(L) {
        wrap.innerHTML = ''; W.scrollTo(0, 0);
        const cats = FILL.filter(f => fillCats.includes(f.id));
        const tb = W.QP.timerBar();
        wrap.appendChild(h('div', { class: 'lt-head' }, h('div', { class: 'lt-letter' }, SHOW[L] || L), h('div', null, h('div', { class: 'champ-kicker' }, 'عبّي الخانات — الجولة ' + toAr(rIdx + 1)), h('div', { class: 'lt-hint' }, 'كل فريق يكتب في ورقته كلمة لكل خانة تبدأ بحرف «' + (SHOW[L] || L) + '»'))));
        wrap.appendChild(tb.el);
        wrap.appendChild(h('div', { class: 'lt-fill-grid' }, cats.map(f => h('div', { class: 'lt-fill-cell' }, h('span', null, f.icon), h('b', null, f.name), h('i', null, (SHOW[L] || L) + '…')))));
        const ctrl = h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'ltScore', onclick: score }, '✍️ انتهى الوقت — صحّح'));
        wrap.appendChild(ctrl);
        timer = K().timer(fillSecs, tb, () => { Sound.bad(); score(); });
        let scored = false;
        function score() {
          if (scored) return; scored = true; stopTimer();
          wrap.innerHTML = ''; W.scrollTo(0, 0);
          wrap.appendChild(h('div', { class: 'lt-head' }, h('div', { class: 'lt-letter' }, SHOW[L] || L), h('div', null, h('div', { class: 'champ-kicker' }, 'التصحيح'), h('div', { class: 'lt-hint' }, 'اضغط على خانة كل فريق: ✔ صحيحة (١٠٠) ← مكررة (٥٠) ← ✘'))));
          const marks = cats.map(() => teams.map(() => 0)); // 0 none, 2 unique, 1 dup
          const table = h('div', { class: 'lt-score' });
          const totalRow = h('div', { class: 'lt-total' });
          function pts(t) { return marks.reduce((s, m) => s + (m[t] === 2 ? 100 : m[t] === 1 ? 50 : 0), 0); }
          function drawT() {
            table.innerHTML = '';
            table.appendChild(h('div', { class: 'lt-srow head', style: 'grid-template-columns:minmax(110px,1.3fr) repeat(' + teams.length + ',minmax(0,1fr))' }, h('div', null, 'الخانة'), teams.map((t, i) => h('div', { style: 'color:' + K().COLORS[i] }, t.name))));
            cats.forEach((f, ci) => {
              const ex = f.list ? f.list.filter(x => firstL(x) === L).slice(0, 6) : [];
              table.appendChild(h('div', { class: 'lt-srow', style: 'grid-template-columns:minmax(110px,1.3fr) repeat(' + teams.length + ',minmax(0,1fr))' },
                h('div', { class: 'lt-sname' }, f.icon + ' ' + f.name, ex.length ? h('small', null, 'أمثلة: ' + ex.join('، ')) : f.list ? h('small', null, 'لا توجد أمثلة شائعة بهذا الحرف') : null),
                teams.map((t, ti) => h('button', { class: 'lt-mark m' + marks[ci][ti], 'data-c': ci, 'data-t': ti, onclick: () => { marks[ci][ti] = marks[ci][ti] === 0 ? 2 : marks[ci][ti] === 2 ? 1 : 0; drawT(); } }, marks[ci][ti] === 2 ? '✔ ١٠٠' : marks[ci][ti] === 1 ? '⇄ ٥٠' : '—'))));
            });
            totalRow.textContent = teams.map(t => t.name + ': +' + K().fmt(pts(teams.indexOf(t)))).join('   •   ');
          }
          drawT();
          wrap.appendChild(table); wrap.appendChild(totalRow);
          wrap.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary big', id: 'ltApply', onclick: () => {
            teams.forEach((t, i) => { const p = pts(i); t.score += p; });
            Sound.good(); nextRound();
          } }, '✅ اعتماد النقاط')));
        }
      }

      function nextRound() {
        stopTimer(); setKeys(null);
        rIdx++;
        if (rIdx >= deck.length) return end();
        drawLetter();
      }
      function end() { if (ended) return; ended = true; stopTimer(); setKeys(null); K().end(finish, game, teams, log); }
      drawLetter();
    }
    return { stop() { stopped = ended = true; if (timer) timer.stop(); clearTimeout(spinT); if (keyH) W.removeEventListener('keydown', keyH); } };
  }
  W.QP.ENGINES = W.QP.ENGINES || {};
  W.QP.ENGINES.letters = run;
  W.QP.LETTER_LISTS = { SURAHS, PROPHETS, CITIES, COUNTRIES };
})(window);
