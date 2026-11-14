/* app.js — pages & hash routing */
(function (W) {
  'use strict';
  const { h, Bank, Player, Board, Sound, toAr, DIFF, TYPES, GAMES, MODES, ENGINES, render } = W.QP;
  const view = document.getElementById('view');
  let running = null;
  const fmt = n => toAr(Number(n).toLocaleString('en'));
  function parseHash() { const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?'); const parts = path.split('/').filter(Boolean).map(decodeURIComponent); const params = Object.fromEntries(new URLSearchParams(qs || '')); return { parts, params }; }
  function go(path) { location.hash = '#/' + path; }
  function setActive(name) { document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === name)); }

  const SELF_SETUP = ['seenjeem', 'huroof', 'millionaire', 'letters', 'memory', 'sullam', 'bidding', 'rattib', 'mystery', 'elim', 'hotseat'];
  const FLAGSHIP = [
    ['millionaire', '💰', 'من سيربح المليون', '١٥ سؤالًا وسلّم الجوائز الحقيقي ومحطتا أمان ووسائل المساعدة الثلاث.'],
    ['letters', '🔤', 'تحدي الحروف', 'حرف عشوائي كل جولة: سباق إجابات تبدأ به، ثم «عبّي الخانات» صحابي وسورة ونبي ومدينة…'],
    ['memory', '🃏', 'بطاقة الذاكرة', 'اقلب بطاقتين وطابق كل سؤال مع جوابه، لاعب واحد أو حتى ٤ بالتناوب.'],
    ['sullam', '🪜', 'السلم الذهبي', 'اصعد درجة مع كل إجابة صحيحة، والدرجات الذهبية محطات أمان، وأول من يصل القمة يفوز.'],
    ['bidding', '💎', 'مزايدة النقاط', 'يظهر القسم أولًا وتزايد من رصيدك على ثقتك قبل السؤال، والجولة الأخيرة كل شيء أو لا شيء.'],
    ['rattib', '🔢', 'رتّب الإجابة', 'اسحب العناصر لترتيبها: السور، أحداث السيرة، الملوك، وفيات العلماء… مع درجات جزئية.'],
    ['mystery', '🎁', 'الصندوق الغامض', 'افتح صندوقًا: سؤال تخاطر فيه ×٢ أو تلعبه بأمان، أو مفاجأة: كنز، قنبلة، سرقة، تبديل نقاط.'],
    ['elim', '⚖️', 'صح ولا خطأ — الإقصاء', 'حكم سريع على إجابة مقترحة: صح أم خطأ؟ الوقت يقصر، والخطأ يُسقط قلبًا، وآخر الصامدين يفوز.'],
    ['hotseat', '🔥', 'الكرسي الساخن', 'سباق أسئلة سريعة ضد الساعة: كل فريق على الكرسي ٦٠ ثانية، والسلسلة الصحيحة تضاعف النقاط.']
  ];
  function gameCard(g) {
    const cats = g.filter.cats.map(id => Bank.cat(id)).filter(Boolean);
    const c = cats.length === 1 ? cats[0] : null;
    return h('a', { class: 'game-card', href: '#/play/' + encodeURIComponent(g.id), style: c ? { '--c': c.color } : null },
      h('div', { class: 'gc-icon' }, g.icon), h('div', { class: 'gc-body' }, h('div', { class: 'gc-title' }, g.title), h('div', { class: 'gc-desc' }, g.desc),
        h('div', { class: 'gc-meta' }, h('span', null, c ? c.icon + ' ' + c.name : '🌐 ' + toAr(cats.length) + ' أقسام'), h('span', null, '📚 ' + fmt(g.available) + ' سؤال'))));
  }

  // ---------------------------------------------------------------- HOME
  function home() {
    setActive('home');
    const total = Bank.total(); const ver = Bank.cats.reduce((s, c) => s + Bank.countVerified(c.id), 0);
    const nameIn = h('input', { class: 'inp', value: Player.name, placeholder: 'اكتب اسمك يا بطل…', maxlength: 30, oninput: e => { Player.name = e.target.value; } });
    view.appendChild(h('a', { class: 'champ-banner', href: '#/play/championship' },
      h('div', { class: 'champ-banner-icon' }, '🏆'),
      h('div', { class: 'champ-banner-body' },
        h('div', { class: 'champ-kicker' }, 'المسابقة الشاملة لكل الأقسام'),
        h('h2', null, 'البطولة الكبرى'),
        h('p', null, 'خمس جولات حماسية تغطي القرآن والعقيدة والفقه والحديث والسيرة والتراجم واللغة وتاريخ المملكة وكرة القدم — مع عجلة أقسام وجولة ذهبية بنقاط مضاعفة.'),
        h('div', { class: 'chips' },
          h('span', { class: 'chip' }, '🌅 إحماء'), h('span', { class: 'chip' }, '⚡ برق'), h('span', { class: 'chip' }, '🎡 عجلة'), h('span', { class: 'chip' }, '🧩 مهارة'), h('span', { class: 'chip' }, '🥇 الجولة الذهبية')),
        h('span', { class: 'btn primary big' }, '🔥 ابدأ البطولة'))));
    view.appendChild(h('div', { class: 'party-row' },
      h('a', { class: 'party-banner sj', id: 'homeSeenJeem', href: '#/play/seenjeem' },
        h('div', { class: 'party-icon' }, '🟧'),
        h('div', { class: 'party-body' }, h('div', { class: 'champ-kicker' }, 'لعبة الفرق الشهيرة'), h('h2', null, 'سين جيم'),
          h('p', null, '٦ فئات و٣٦ سؤالًا (٢٠٠ / ٤٠٠ / ٦٠٠) بين فريقين، مع الحفرة وجاوب جوابين واتصال بصديق واستريح والفخ.'),
          h('span', { class: 'btn primary' }, '▶ العب سين جيم'))),
      h('a', { class: 'party-banner hf', id: 'homeHuroof', href: '#/play/huroof' },
        h('div', { class: 'party-icon' }, '🐝'),
        h('div', { class: 'party-body' }, h('div', { class: 'champ-kicker' }, 'خلية الحروف'), h('h2', null, 'حروف'),
          h('p', null, 'لوحة سداسية من ٢٥ حرفًا: الأخضر يصل اليمين باليسار، والبرتقالي يصل الأعلى بالأسفل. كل حرف وراه سؤال جوابه يبدأ به.'),
          h('span', { class: 'btn primary' }, '▶ العب حروف')))));
    view.appendChild(h('div', { class: 'flag-grid' }, FLAGSHIP.filter(f => W.QP.game(f[0])).map(([id, icon, title, desc]) => h('a', { class: 'flag-card', id: 'flag-' + id, href: '#/play/' + id },
      h('div', { class: 'flag-icon' }, icon), h('div', { class: 'flag-body' }, h('h3', null, title), h('p', null, desc)), h('span', { class: 'btn primary small' }, '▶ العب')))));
    if (W.QP.movementHomeCard) view.appendChild(W.QP.movementHomeCard());
    view.appendChild(h('section', { class: 'hero' },
      h('div', { class: 'hero-text' }, h('h1', null, 'منصة ', h('span', { class: 'brand' }, 'المسابقات العلمية')), h('p', null, 'ألعاب ومسابقات في القرآن وعلومه، والحديث الصحيح، والعقيدة، والفقه وأصوله، واللغة، والسيرة، والتراجم، وتاريخ المملكة، وكرة القدم — مع ذكر المصدر لكل سؤال.'),
        h('div', { class: 'stats' }, h('div', null, h('b', null, fmt(total)), h('span', null, 'سؤال')), h('div', null, h('b', null, fmt(GAMES.length)), h('span', null, 'لعبة')), h('div', null, h('b', null, toAr(Bank.cats.length)), h('span', null, 'قسمًا')), h('div', null, h('b', null, fmt(ver)), h('span', null, 'سؤال موثّق آليًا'))),
        h('div', { class: 'player-row' }, h('a', { class: 'pf-mini', href: '#/profile', title: 'ملفي' }, W.QP.Player.avatar ? W.QP.Player.avatar() : '👤'), h('label', null, 'اسم اللاعب'), nameIn),
        h('div', { class: 'row' }, h('a', { class: 'btn primary big', id: 'onlineHome', href: '#/online' }, '📡 مسابقة أونلاين مع أصدقائك'), h('a', { class: 'btn ghost big', href: '#/profile' }, '👤 ملفي وإنجازاتي'), h('a', { class: 'btn ghost big', id: 'globalHome', href: '#/global' }, '🌍 لوحة الصدارة العامة')),
        h('div', { class: 'row' }, h('a', { class: 'btn primary big', href: '#/play/daily' }, '📅 تحدي اليوم'), h('a', { class: 'btn big', href: '#/play/' + encodeURIComponent('wheel-mix-عجلة الأقسام') }, '🎡 عجلة الأقسام'), h('a', { class: 'btn ghost big', href: '#/games' }, '🎮 كل الألعاب'))),
      h('div', { class: 'hero-art' }, h('img', { class: 'hero-logo', src: 'assets/logo-official.png', alt: 'شعار برنامج رائد' }))));
    const grid = h('div', { class: 'cat-grid' });
    function drawCats() {
      const fl = W.QP.getQFilters ? W.QP.getQFilters() : {};
      grid.innerHTML = '';
      Bank.cats.forEach(c => {
        const f = { cats: [c.id] }; if (fl.diff) f.diff = [fl.diff]; if (fl.stage) f.stage = fl.stage;
        const n = Bank.count(f); const subs = Bank.subcats(c.id).slice(0, 5);
        grid.appendChild(h('a', { class: 'cat-card', href: '#/cat/' + c.id, style: { '--c': c.color } }, h('div', { class: 'cat-icon' }, c.icon), h('div', { class: 'cat-name' }, c.name), h('div', { class: 'cat-desc' }, c.desc),
          h('div', { class: 'chips' }, subs.map(([s]) => h('span', { class: 'chip small' }, s))), h('div', { class: 'cat-count' }, fmt(n) + ' سؤال')));
      });
    }
    view.appendChild(h('h2', { class: 'section-title' }, '📚 الأقسام'));
    if (W.QP.filterBar) view.appendChild(W.QP.filterBar({ onChange: drawCats }));
    view.appendChild(grid); drawCats();
    view.appendChild(h('h2', { class: 'section-title' }, '🎮 أنماط اللعب'));
    const modes = h('div', { class: 'mode-grid' });
    Object.entries(MODES).forEach(([id, m]) => modes.appendChild(h('a', { class: 'mode', href: '#/games?mode=' + id }, h('span', { class: 'mode-icon' }, m.icon), h('b', null, m.name), h('small', null, m.desc))));
    view.appendChild(modes);
  }

  // ---------------------------------------------------------------- CATEGORY
  function category(id) {
    const c = Bank.cat(id); if (!c) return go('');
    setActive('home');
    const headStats = h('div', { class: 'chips' });
    const subWrap = h('div', { class: 'sub-grid' });
    const gameWrap = h('div', { class: 'game-grid' });
    function fBase() { const fl = W.QP.getQFilters ? W.QP.getQFilters() : {}; const f = { cats: [id] }; if (fl.diff) f.diff = [fl.diff]; if (fl.stage) f.stage = fl.stage; return f; }
    function drawCat() {
      const f = fBase(); const qn = Bank.count(f); const dc = Bank.diffCounts(id);
      headStats.innerHTML = '';
      headStats.appendChild(h('span', { class: 'chip' }, '📚 ' + fmt(qn) + ' سؤال'));
      [1, 2, 3].forEach(d => headStats.appendChild(h('span', { class: 'chip d' + d }, DIFF[d] + ': ' + fmt(Bank.count(Object.assign({}, f, { diff: [d] }))))));
      headStats.appendChild(h('span', { class: 'chip' }, '✔ موثّق: ' + fmt(Bank.countVerified(id))));
      const subs = Bank.subcats(id);
      subWrap.innerHTML = '';
      subs.forEach(([s]) => {
        const n = Bank.count(Object.assign({}, f, { subs: [s] }));
        if (n <= 0 && (f.stage || f.diff)) return;
        subWrap.appendChild(h('a', { class: 'sub', href: '#/play/' + encodeURIComponent('classic-' + id) + '?sub=' + encodeURIComponent(s) }, h('b', null, s), h('span', null, fmt(n) + ' سؤال • العب ←')));
      });
      const games = GAMES.filter(g => g.filter.cats.length === 1 && g.filter.cats[0] === id && Bank.count(W.QP.applyQFilters ? W.QP.applyQFilters(g.filter, W.QP.getQFilters()) : g.filter) >= (g.engine === 'ladder' ? 15 : 6));
      gameWrap.innerHTML = ''; games.forEach(g => gameWrap.appendChild(gameCard(g)));
    }
    view.appendChild(h('div', { class: 'cat-head', style: { '--c': c.color } }, h('div', { class: 'cat-icon big' }, c.icon), h('div', null, h('h1', null, c.name), h('p', null, c.desc), headStats)));
    if (W.QP.filterBar) view.appendChild(W.QP.filterBar({ onChange: drawCat }));
    view.appendChild(h('h2', { class: 'section-title' }, '🗂️ الأقسام الفرعية'));
    view.appendChild(subWrap);
    view.appendChild(h('h2', { class: 'section-title' }, '🎮 ألعاب ' + c.name));
    view.appendChild(gameWrap); drawCat();
  }

  // ---------------------------------------------------------------- CATALOG
  function catalog(params) {
    setActive('games');
    const catSel = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الأقسام'), h('option', { value: '__mix' }, 'ألعاب مختلطة'), Bank.cats.map(c => h('option', { value: c.id, selected: params.cat === c.id }, c.icon + ' ' + c.name)));
    const modeSel = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الأنماط'), Object.entries(MODES).map(([id, m]) => h('option', { value: id, selected: params.mode === id }, m.icon + ' ' + m.name)));
    const search = h('input', { class: 'inp', placeholder: '🔍 ابحث عن لعبة…' });
    const grid = h('div', { class: 'game-grid' }); const count = h('span', { class: 'muted' });
    function draw() {
      const cv = catSel.value, mv = modeSel.value, sv = search.value.trim();
      const fl = W.QP.getQFilters ? W.QP.getQFilters() : {};
      const list = GAMES.filter(g => {
        if (!(!cv || (cv === '__mix' ? g.filter.cats.length > 1 : g.filter.cats.length === 1 && g.filter.cats[0] === cv)) || !(!mv || g.mode === mv) || !(!sv || g.title.includes(sv) || g.desc.includes(sv))) return false;
        const f = W.QP.applyQFilters ? W.QP.applyQFilters(g.filter, fl) : g.filter;
        const need = g.mode === 'ladder' ? 15 : (g.engine === 'championship' ? 12 : 6);
        return Bank.count(f) >= need;
      });
      grid.innerHTML = ''; list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); list.forEach(g => grid.appendChild(gameCard(g))); count.textContent = fmt(list.length) + ' لعبة';
      let note = grid.parentNode && grid.parentNode.querySelector('.filter-note');
      if (note) note.remove();
      if (!list.length) grid.appendChild(h('p', { class: 'filter-note' }, 'تنبيه: لا توجد ألعاب كافية لهذا الاختيار، جرّب «الكل» في الصعوبة أو المرحلة.'));
    }
    [catSel, modeSel].forEach(s => s.addEventListener('change', draw)); search.addEventListener('input', draw);
    view.appendChild(h('h1', null, '🎮 دليل الألعاب'));
    view.appendChild(h('p', { class: 'muted' }, 'كل لعبة هنا هي تركيبة من: نمط لعب × قسم/أقسام × قواعد (وقت، أرواح، صعوبة، وسائل مساعدة). عدد الألعاب: ' + fmt(GAMES.length) + '، مبنية على ' + toAr(Object.keys(ENGINES).length) + ' محركات لعب و' + toAr(Object.keys(TYPES).length) + ' أنواع أسئلة.'));
    if (W.QP.filterBar) view.appendChild(W.QP.filterBar({ onChange: draw }));
    view.appendChild(h('div', { class: 'filters' }, catSel, modeSel, search, count)); view.appendChild(grid); draw();
  }

  // ---------------------------------------------------------------- PLAY
  function play(id, params) {
    const g = W.QP.game(id); if (!g) { view.appendChild(h('p', null, 'اللعبة غير موجودة. ')); view.appendChild(h('a', { href: '#/games' }, 'دليل الألعاب')); return; }
    setActive('games');
    if (g.rules.daily) { const d = W.QP.LS.get('daily', {}); if (d[W.QP.todayKey()]) { view.appendChild(h('div', { class: 'card center' }, h('h2', null, '📅 أنهيت تحدي اليوم'), h('p', null, 'نتيجتك اليوم: ' + fmt(Math.round(d[W.QP.todayKey()])) + ' نقطة. عد غدًا لتحدٍّ جديد!'), h('a', { class: 'btn primary', href: '#/board?game=daily' }, 'لوحة الصدارة'))); return; } }
    if (SELF_SETUP.includes(g.engine)) {
      const root = h('div', { class: 'game-root party-root ' + g.engine + '-root' });
      view.appendChild(root);
      root.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ التحميل…'));
      setTimeout(() => { root.innerHTML = ''; running = ENGINES[g.engine](g, root, W.QP.getQFilters ? W.QP.getQFilters() : {}, results) || null; }, 0);
      return;
    }
    if (g.engine === 'championship') {
      const root = h('div', { class: 'game-root champ-root' });
      view.appendChild(root);
      root.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ تحميل الأسئلة…'));
      Bank.ensure(g.filter.cats).then(() => { root.innerHTML = ''; running = ENGINES.championship(g, root, W.QP.getQFilters ? W.QP.getQFilters() : {}, results) || null; })
        .catch(() => { root.innerHTML = ''; root.appendChild(h('p', { class: 'center' }, 'تعذّر تحميل ملفات الأسئلة. إن كنت تفتح الملف مباشرة فجرّب عبر خادم أو الرابط المنشور.')); });
      return;
    }
    if (params.diff && W.QP.setQFilters) W.QP.setQFilters({ diff: +params.diff });
    const subs = g.filter.cats.length === 1 ? Bank.subcats(g.filter.cats[0]) : [];
    const subSel = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الأقسام الفرعية'), subs.filter(([s]) => !g.filter.subs || g.filter.subs.includes(s)).map(([s, n]) => h('option', { value: s, selected: params.sub === s }, s + ' (' + toAr(n) + ')')));
    const nameIn = h('input', { class: 'inp', value: Player.name, placeholder: 'اسم اللاعب', oninput: e => { Player.name = e.target.value; } });
    const avail = h('p', { class: 'muted small' });
    function availTxt() {
      const fl = W.QP.getQFilters ? W.QP.getQFilters() : {};
      const f = W.QP.applyQFilters ? W.QP.applyQFilters(g.filter, fl) : g.filter;
      const n = Bank.count(f);
      avail.textContent = 'متوفر ' + fmt(n) + ' سؤال لهذه اللعبة' + (fl.diff || fl.stage ? ' بهذا الاختيار' : '');
      return n;
    }
    const r = g.rules;
    const rulesTxt = [r.count && '❓ ' + toAr(r.count) + ' سؤالًا', r.perQ && '⏱ ' + toAr(r.perQ) + ' ثانية للسؤال', r.totalTime && '⚡ ' + toAr(r.totalTime) + ' ثانية إجمالًا', r.lives && '❤️ ' + toAr(r.lives) + ' أرواح', r.endless && '♾ حتى النهاية', r.streak && '🔥 مضاعف التتابع', r.speedBonus && '🚀 مكافأة السرعة', r.lifelines && '🛟 وسائل مساعدة', r.steps && '🪜 ' + toAr(r.steps) + ' درجة', r.rounds && '🔁 ' + toAr(r.rounds) + ' جولات'].filter(Boolean);
    const intro = h('div', { class: 'card intro' }, h('div', { class: 'intro-icon' }, g.icon), h('h1', null, g.title), h('p', null, g.desc), h('div', { class: 'chips center' }, rulesTxt.map(t => h('span', { class: 'chip' }, t))),
      h('div', { class: 'grid3' }, h('label', null, 'اسم اللاعب', nameIn), !g.rules.daily && subs.length > 1 ? h('label', null, 'القسم الفرعي', subSel) : null),
      !g.rules.daily && W.QP.filterBar ? W.QP.filterBar({ onChange: availTxt }) : null,
      h('button', { class: 'btn primary big', id: 'startBtn', onclick: start }, '▶ ابدأ اللعب'), avail);
    view.appendChild(intro); availTxt();
    function start() {
      const fl = W.QP.getQFilters ? W.QP.getQFilters() : {};
      const opts = { diff: fl.diff || null, stage: fl.stage || null, sub: subSel.value || null };
      view.innerHTML = ''; const root = h('div', { class: 'game-root' }); view.appendChild(h('div', { class: 'game-title' }, g.icon + ' ' + g.title)); view.appendChild(root);
      root.appendChild(h('p', { class: 'center muted', id: 'loadingQ' }, '⏳ جارٍ تحميل الأسئلة…'));
      Bank.ensure(g.filter.cats).then(() => { root.innerHTML = ''; running = ENGINES[g.engine](g, root, opts, results) || null; })
        .catch(() => { root.innerHTML = ''; root.appendChild(h('p', { class: 'center' }, 'تعذّر تحميل ملفات الأسئلة. إن كنت تفتح الملف مباشرة فجرّب عبر خادم أو الرابط المنشور.')); });
    }
  }

  // ---------------------------------------------------------------- RESULTS
  function results(res) {
    running = null; view.innerHTML = ''; window.scrollTo(0, 0);
    const { game, st } = res; const name = Player.name || 'لاعب';
    let rank = null;
    if (!res.multi && !res.study) { rank = Board.add({ game: game.id, title: game.title, player: name, score: Math.round(st.score), correct: st.correct, total: st.log.length, money: !!res.money }); }
    if (res.multi) res.multi.forEach(p => Board.add({ game: game.id, title: game.title, player: p.name, score: Math.round(p.score), correct: p.correct, total: st.log.length }));
    let earned = null;
    const big = res.championship || res.party || res.capped;
    const recScore = rec => big ? Math.min(5000, Math.max(0, Math.round(res.recordScore != null ? res.recordScore : rec))) : rec;
    if (!res.multi && !res.study && W.QP.Profiles) earned = W.QP.Profiles.record({ game: game.id, title: game.title, score: recScore(st.score), log: st.log, best: st.best });
    if (res.multi && big && !res.study && W.QP.Profiles) {
      const mine = res.multi.find(p => p.name === (res.hostName || name)) || res.multi.find(p => p.name === name) || res.multi[0];
      if (mine) {
        const log = st.log.filter(l => !l.player || l.player === mine.name);
        earned = W.QP.Profiles.record({ game: game.id, title: game.title, score: recScore(mine.score), log, best: st.best || mine.best });
      }
    }
    if (game.rules.daily) { const d = W.QP.LS.get('daily', {}); d[W.QP.todayKey()] = st.score; W.QP.LS.set('daily', d); }
    const pct = st.log.length ? Math.round(100 * st.correct / st.log.length) : 0;
    if (big && Sound.fanfare) Sound.fanfare(); else if (pct >= 70) Sound.win();
    if (big && W.QP.confetti) setTimeout(() => W.QP.confetti(view), 30);
    const head = h('div', { class: 'card result' + (big ? ' champ-result' : '') }, h('div', { class: 'intro-icon' }, big ? '🏆' : pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'), h('h1', null, res.money ? 'ربحت ' + fmt(st.score) + ' ريال افتراضي!' : res.study ? 'انتهت جلسة المراجعة' : res.party ? (res.winner ? '🏆 الفائز: ' + res.winner : '🤝 تعادل!') : res.championship ? 'نتيجة البطولة: ' + fmt(Math.round(st.score)) + ' نقطة' : 'النتيجة: ' + fmt(Math.round(st.score)) + ' نقطة'),
      res.party && res.scoreLabel ? h('p', { class: 'muted small' }, 'النقاط: ' + res.scoreLabel) : null,
      big && Math.round(st.score) > 5000 ? h('p', { class: 'muted small' }, 'تُحتسب في لوحة الصدارة العامة حتى ٥٠٠٠ نقطة لهذه اللعبة.') : null,
      res.multi ? h('div', { class: 'podium champ-podium' }, (res.party ? res.multi.slice() : res.multi.slice().sort((a, b) => b.score - a.score)).map((p, k) => h('div', { class: 'pod p' + k }, h('div', null, ['🥇', '🥈', '🥉'][k] || '🎖'), h('b', null, p.name), h('span', null, fmt(Math.round(p.score)))))) : res.championship ? h('div', { class: 'podium champ-podium' }, h('div', { class: 'pod p0' }, h('div', null, '🥇'), h('b', null, name), h('span', null, fmt(Math.round(st.score))))) : null,
      h('div', { class: 'stats' }, h('div', null, h('b', null, toAr(st.correct)), h('span', null, 'صحيحة')), h('div', null, h('b', null, toAr(st.wrong)), h('span', null, 'خاطئة')), h('div', null, h('b', null, toAr(pct) + '٪'), h('span', null, 'الدقة')), st.best ? h('div', null, h('b', null, toAr(st.best)), h('span', null, 'أطول تتابع')) : null, rank != null ? h('div', null, h('b', null, '#' + toAr(rank + 1)), h('span', null, 'في الصدارة')) : null),
      h('div', { class: 'row center' }, h('a', { class: 'btn primary', href: '#/play/' + encodeURIComponent(game.id) + '?r=' + Date.now() }, '🔁 العب مجددًا'), h('a', { class: 'btn', href: '#/board?game=' + encodeURIComponent(game.id) }, '🏅 لوحة الصدارة'), h('button', { class: 'btn ghost', onclick: share }, '📤 مشاركة النتيجة'), h('a', { class: 'btn ghost', href: '#/' }, '🏠 الرئيسية')));
    function share() { const t = `حصلت على ${Math.round(st.score)} نقطة في «${game.title}» (${st.correct}/${st.log.length}) على منصة المسابقات العلمية! ${location.href.split('#')[0]}#/play/${encodeURIComponent(game.id)}`; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(t); alert('تم نسخ النتيجة'); } }
    view.appendChild(head);
    if (earned && earned.newBadges.length) view.appendChild(W.QP.badgeNote(earned.newBadges));
    view.appendChild(h('h2', { class: 'section-title' }, '📝 مراجعة الأسئلة'));
    const rev = h('div', { class: 'review' });
    st.log.forEach((l, k) => rev.appendChild(h('details', { class: 'rev ' + (l.res.correct ? 'good' : 'bad') }, h('summary', null, (l.res.correct ? '✔ ' : '✘ ') + toAr(k + 1) + '. ' + l.q.question + (l.player ? ' — ' + l.player : '')),
      h('div', { class: 'rev-body' }, l.q.clues ? h('div', { class: 'muted' }, 'التلميحات: ' + l.q.clues.join(' • ')) : null, h('div', null, h('b', null, 'الإجابة: '), render.answerText(l.q)), l.res.given ? h('div', { class: 'muted' }, 'إجابتك: ' + l.res.given) : null, l.q.explanation ? h('div', { class: 'fb-exp' }, l.q.explanation) : null, render.sourceBlock(l.q),
        h('a', { class: 'report', href: 'admin.html#edit=' + encodeURIComponent(l.q.id), target: '_blank' }, '⚑ الإبلاغ عن خطأ / تعديل')))));
    view.appendChild(rev);
  }

  // ---------------------------------------------------------------- LEADERBOARD
  function board(params) {
    setActive('board');
    const all = Board.all(); const games = [...new Map(all.map(r => [r.game, r.title])).entries()];
    const sel = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الألعاب'), games.map(([id, t]) => h('option', { value: id, selected: params.game === id }, t)));
    const table = h('div');
    function draw() { const list = all.filter(r => !sel.value || r.game === sel.value).slice(0, 100); table.innerHTML = '';
      if (!list.length) { table.appendChild(h('p', { class: 'muted center' }, 'لا توجد نتائج بعد. العب أول لعبة!')); return; }
      table.appendChild(h('table', { class: 'board' }, h('thead', null, h('tr', null, ['#', 'اللاعب', 'اللعبة', 'النقاط', 'الصحيحة', 'التاريخ'].map(x => h('th', null, x)))),
        h('tbody', null, list.map((r, k) => h('tr', null, h('td', null, ['🥇', '🥈', '🥉'][k] || toAr(k + 1)), h('td', null, r.player), h('td', null, r.title), h('td', null, h('b', null, fmt(r.score))), h('td', null, toAr(r.correct) + '/' + toAr(r.total)), h('td', { class: 'muted small' }, new Date(r.date).toLocaleDateString('ar-SA')))))));
    }
    sel.addEventListener('change', draw);
    view.appendChild(h('h1', null, '🏅 لوحة الصدارة')); view.appendChild(h('p', { class: 'muted' }, 'تُحفظ النتائج على هذا الجهاز.'));
    view.appendChild(h('div', { class: 'filters' }, sel, h('button', { class: 'btn ghost small', onclick: () => { if (confirm('مسح كل النتائج من هذا الجهاز؟')) { Board.clear(); view.innerHTML = ''; board({}); } } }, '🗑 مسح النتائج'))); view.appendChild(table); draw();
  }

  // ---------------------------------------------------------------- ABOUT
  function about() {
    setActive('about');
    const LV = window.QUIZ_LEVELS || {};
    const m = Bank.cats.map(c => { const l = LV[c.id] || {}; const tot = (l.primary || 0) + (l.reference || 0) + (l.none || 0); return h('tr', null, h('td', null, c.icon + ' ' + c.name), h('td', null, fmt(tot || Bank.count({ cats: [c.id] }))), h('td', null, fmt(l.primary || 0)), h('td', null, fmt(l.reference || 0))); });
    view.appendChild(h('div', { class: 'card prose' }, h('h1', null, 'ℹ️ عن المنصة ومنهج الأسئلة'),
      h('p', null, 'كل سؤال مرتبط بمصدره. شارات التوثيق:'),
      h('ul', null, h('li', null, h('span', { class: 'badge ok' }, '✔ موثّق آليًا من نص المصدر'), ' — تم التحقق آليًا من مطابقة السؤال لنص المصدر الأصلي (نص المصحف وبياناته من api.alquran.cloud، ونصوص صحيح البخاري وصحيح مسلم)، ويُذكر رقم الحديث.'),
        h('li', null, h('span', { class: 'badge ref' }, '🔗 مأخوذ من مرجع مفتوح'), ' — بيانات مأخوذة آليًا من مرجع مفتوح (مثل ويكي بيانات/ويكيبيديا العربية) مع ذكره.'),
        h('li', null, h('span', { class: 'badge pending' }, '⏳ بانتظار المراجعة العلمية'), ' — سؤال محرر يدويًا من كتب معتمدة ويُنصح بمراجعته من مختص قبل اعتماده في مسابقات رسمية.')),
      h('p', null, 'أحاديث المنصة من الصحيحين فقط، وقد استُبعدت آليًا أي عبارة لم يُعثر عليها في نصيهما.'),
      h('table', { class: 'board' }, h('thead', null, h('tr', null, ['القسم', 'الأسئلة', 'موثّق من النص', 'من مرجع مفتوح'].map(x => h('th', null, x)))), h('tbody', null, m)),
      h('h2', null, 'الصعوبة والمرحلة الدراسية'),
      h('p', null, 'لكل سؤال مستويان يمكن اختيارهما في كل الألعاب والبطولة ودليل الألعاب، ويُحفظ اختيارك على هذا الجهاز:'),
      h('ul', null,
        h('li', null, h('b', null, 'الصعوبة: '), 'سهل، متوسط، صعب — كما هي مصنّفة في بنك الأسئلة (١ و٢ و٣).'),
        h('li', null, h('b', null, 'المرحلة الدراسية: '), 'ابتدائي، متوسط، ثانوي، جامعي. لا يوجد حقل جاهز في المصدر، فصُنّف كل سؤال تلقائيًا بحسب صعوبته وقسمه الفرعي ونوعه وطول نصه: الحقائق الأساسية والأسئلة القصيرة للمرحلة الابتدائية، والعامة لصعوبة ١–٢ للمتوسط، والأعمق لصعوبة ٢–٣ للثانوي، وموضوعات أصول الفقه وتخريج الحديث وعلم الرجال والمتون التخصصية للجامعي.')),
      h('p', null, 'إذا قلّت الأسئلة تحت اختيار معيّن تُستكمل تلقائيًا من أقرب مستوى، مع تنبيه واضح بالعربية.'),
      h('p', null, h('a', { class: 'btn', href: 'admin.html' }, '🛠 لوحة إدارة الأسئلة'))));
  }

  // ---------------------------------------------------------------- router
  function route() {
    if (running && running.stop) running.stop(); running = null;
    view.innerHTML = ''; window.scrollTo(0, 0); document.body.classList.remove('host');
    const { parts, params } = parseHash();
    const [p0, p1] = parts;
    if (!p0) home(); else if (p0 === 'cat') category(p1); else if (p0 === 'games') catalog(params); else if (p0 === 'play') play(p1, params);
    else if (p0 === 'board') board(params); else if (p0 === 'about') about();
    else if (p0 === 'global') { setActive('global'); W.QP.globalPage(view, r => { running = r; }, params); }
    else if (p0 === 'profile') { setActive('profile'); W.QP.profilePage(view); }
    else if (p0 === 'online') { setActive('online'); W.QP.onlinePage(view, parts, r => { running = r; }); } else if (p0 === 'movement') { setActive('movement'); running = (W.QP.movementPage && W.QP.movementPage(view, parts, params)) || null; } else home();
  }
  W.addEventListener('hashchange', route);
  const snd = document.getElementById('soundBtn');
  if (snd) { const upd = () => snd.textContent = Sound.on ? '🔊' : '🔇'; upd(); snd.addEventListener('click', () => { Sound.on = !Sound.on; upd(); }); }
  // projector / presentation mode (remembered) + fullscreen
  const pj = document.getElementById('projBtn'), fs = document.getElementById('fsBtn'), D = document, R = D.documentElement;
  const setProj = on => { D.body.classList.toggle('proj', on); W.QP.LS.set('projector', on); if (pj) { pj.classList.toggle('on', on); pj.setAttribute('aria-pressed', on); } };
  setProj(!!W.QP.LS.get('projector', false));
  if (pj) pj.addEventListener('click', () => setProj(!D.body.classList.contains('proj')));
  const fsEl = () => D.fullscreenElement || D.webkitFullscreenElement;
  const canFs = R.requestFullscreen || R.webkitRequestFullscreen;
  if (fs) { if (!canFs) fs.classList.add('hidden'); else {
    const upd = () => { fs.textContent = fsEl() ? '🗗' : '⛶'; fs.title = fsEl() ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'; };
    fs.addEventListener('click', () => { if (fsEl()) (D.exitFullscreen || D.webkitExitFullscreen).call(D); else { const r = (R.requestFullscreen || R.webkitRequestFullscreen).call(R); if (r && r.catch) r.catch(() => {}); } });
    D.addEventListener('fullscreenchange', upd); D.addEventListener('webkitfullscreenchange', upd); upd(); } }
  route();
})(window);
