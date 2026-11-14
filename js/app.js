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
    view.appendChild(h('section', { class: 'hero' },
      h('div', { class: 'hero-text' }, h('h1', null, 'منصة ', h('span', { class: 'brand' }, 'المسابقات العلمية')), h('p', null, 'ألعاب ومسابقات في القرآن وعلومه، والحديث الصحيح، والعقيدة، والفقه وأصوله، واللغة، والسيرة، والتراجم، وتاريخ المملكة، وكرة القدم — مع ذكر المصدر لكل سؤال.'),
        h('div', { class: 'stats' }, h('div', null, h('b', null, fmt(total)), h('span', null, 'سؤال')), h('div', null, h('b', null, fmt(GAMES.length)), h('span', null, 'لعبة')), h('div', null, h('b', null, toAr(Bank.cats.length)), h('span', null, 'قسمًا')), h('div', null, h('b', null, fmt(ver)), h('span', null, 'سؤال موثّق آليًا'))),
        h('div', { class: 'player-row' }, h('a', { class: 'pf-mini', href: '#/profile', title: 'ملفي' }, W.QP.Player.avatar ? W.QP.Player.avatar() : '👤'), h('label', null, 'اسم اللاعب'), nameIn),
        h('div', { class: 'row' }, h('a', { class: 'btn primary big', id: 'onlineHome', href: '#/online' }, '📡 مسابقة أونلاين مع أصدقائك'), h('a', { class: 'btn ghost big', href: '#/profile' }, '👤 ملفي وإنجازاتي'), h('a', { class: 'btn ghost big', id: 'globalHome', href: '#/global' }, '🌍 لوحة الصدارة العامة')),
        h('div', { class: 'row' }, h('a', { class: 'btn primary big', href: '#/play/daily' }, '📅 تحدي اليوم'), h('a', { class: 'btn big', href: '#/play/' + encodeURIComponent('wheel-mix-عجلة الأقسام') }, '🎡 عجلة الأقسام'), h('a', { class: 'btn ghost big', href: '#/games' }, '🎮 كل الألعاب'))),
      h('div', { class: 'hero-art', 'aria-hidden': 'true' }, '🏆')));
    const grid = h('div', { class: 'cat-grid' });
    Bank.cats.forEach(c => {
      const n = Bank.count({ cats: [c.id] }); const subs = Bank.subcats(c.id).slice(0, 5);
      grid.appendChild(h('a', { class: 'cat-card', href: '#/cat/' + c.id, style: { '--c': c.color } }, h('div', { class: 'cat-icon' }, c.icon), h('div', { class: 'cat-name' }, c.name), h('div', { class: 'cat-desc' }, c.desc),
        h('div', { class: 'chips' }, subs.map(([s]) => h('span', { class: 'chip small' }, s))), h('div', { class: 'cat-count' }, fmt(n) + ' سؤال')));
    });
    view.appendChild(h('h2', { class: 'section-title' }, '📚 الأقسام')); view.appendChild(grid);
    view.appendChild(h('h2', { class: 'section-title' }, '🎮 أنماط اللعب'));
    const modes = h('div', { class: 'mode-grid' });
    Object.entries(MODES).forEach(([id, m]) => modes.appendChild(h('a', { class: 'mode', href: '#/games?mode=' + id }, h('span', { class: 'mode-icon' }, m.icon), h('b', null, m.name), h('small', null, m.desc))));
    view.appendChild(modes);
  }

  // ---------------------------------------------------------------- CATEGORY
  function category(id) {
    const c = Bank.cat(id); if (!c) return go('');
    setActive('home');
    const subs = Bank.subcats(id); const qn = Bank.count({ cats: [id] }); const dc = Bank.diffCounts(id);
    const byD = [dc[1], dc[2], dc[3]];
    view.appendChild(h('div', { class: 'cat-head', style: { '--c': c.color } }, h('div', { class: 'cat-icon big' }, c.icon), h('div', null, h('h1', null, c.name), h('p', null, c.desc),
      h('div', { class: 'chips' }, h('span', { class: 'chip' }, '📚 ' + fmt(qn) + ' سؤال'), [1, 2, 3].map(d => h('span', { class: 'chip d' + d }, DIFF[d] + ': ' + fmt(byD[d - 1]))), h('span', { class: 'chip' }, '✔ موثّق: ' + fmt(Bank.countVerified(id)))))));
    view.appendChild(h('h2', { class: 'section-title' }, '🗂️ الأقسام الفرعية'));
    view.appendChild(h('div', { class: 'sub-grid' }, subs.map(([s, n]) => h('a', { class: 'sub', href: '#/play/' + encodeURIComponent('classic-' + id) + '?sub=' + encodeURIComponent(s) }, h('b', null, s), h('span', null, fmt(n) + ' سؤال • العب ←')))));
    view.appendChild(h('h2', { class: 'section-title' }, '🎮 ألعاب ' + c.name));
    view.appendChild(h('div', { class: 'game-grid' }, GAMES.filter(g => g.filter.cats.length === 1 && g.filter.cats[0] === id).map(gameCard)));
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
      const list = GAMES.filter(g => (!cv || (cv === '__mix' ? g.filter.cats.length > 1 : g.filter.cats.length === 1 && g.filter.cats[0] === cv)) && (!mv || g.mode === mv) && (!sv || g.title.includes(sv) || g.desc.includes(sv)));
      grid.innerHTML = ''; list.forEach(g => grid.appendChild(gameCard(g))); count.textContent = fmt(list.length) + ' لعبة';
    }
    [catSel, modeSel].forEach(s => s.addEventListener('change', draw)); search.addEventListener('input', draw);
    view.appendChild(h('h1', null, '🎮 دليل الألعاب'));
    view.appendChild(h('p', { class: 'muted' }, 'كل لعبة هنا هي تركيبة من: نمط لعب × قسم/أقسام × قواعد (وقت، أرواح، صعوبة، وسائل مساعدة). عدد الألعاب: ' + fmt(GAMES.length) + '، مبنية على ' + toAr(Object.keys(ENGINES).length) + ' محركات لعب و' + toAr(Object.keys(TYPES).length) + ' أنواع أسئلة.'));
    view.appendChild(h('div', { class: 'filters' }, catSel, modeSel, search, count)); view.appendChild(grid); draw();
  }

  // ---------------------------------------------------------------- PLAY
  function play(id, params) {
    const g = W.QP.game(id); if (!g) { view.appendChild(h('p', null, 'اللعبة غير موجودة. ')); view.appendChild(h('a', { href: '#/games' }, 'دليل الألعاب')); return; }
    setActive('games');
    if (g.rules.daily) { const d = W.QP.LS.get('daily', {}); if (d[W.QP.todayKey()]) { view.appendChild(h('div', { class: 'card center' }, h('h2', null, '📅 أنهيت تحدي اليوم'), h('p', null, 'نتيجتك اليوم: ' + fmt(Math.round(d[W.QP.todayKey()])) + ' نقطة. عد غدًا لتحدٍّ جديد!'), h('a', { class: 'btn primary', href: '#/board?game=daily' }, 'لوحة الصدارة'))); return; } }
    const diffSel = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل المستويات'), [1, 2, 3].map(d => h('option', { value: d, selected: String(params.diff) === String(d) }, DIFF[d])));
    const subs = g.filter.cats.length === 1 ? Bank.subcats(g.filter.cats[0]) : [];
    const subSel = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الأقسام الفرعية'), subs.filter(([s]) => !g.filter.subs || g.filter.subs.includes(s)).map(([s, n]) => h('option', { value: s, selected: params.sub === s }, s + ' (' + toAr(n) + ')')));
    const nameIn = h('input', { class: 'inp', value: Player.name, placeholder: 'اسم اللاعب', oninput: e => { Player.name = e.target.value; } });
    const r = g.rules;
    const rulesTxt = [r.count && '❓ ' + toAr(r.count) + ' سؤالًا', r.perQ && '⏱ ' + toAr(r.perQ) + ' ثانية للسؤال', r.totalTime && '⚡ ' + toAr(r.totalTime) + ' ثانية إجمالًا', r.lives && '❤️ ' + toAr(r.lives) + ' أرواح', r.endless && '♾ حتى النهاية', r.streak && '🔥 مضاعف التتابع', r.speedBonus && '🚀 مكافأة السرعة', r.lifelines && '🛟 وسائل مساعدة', r.steps && '🪜 ' + toAr(r.steps) + ' درجة', r.rounds && '🔁 ' + toAr(r.rounds) + ' جولات'].filter(Boolean);
    const intro = h('div', { class: 'card intro' }, h('div', { class: 'intro-icon' }, g.icon), h('h1', null, g.title), h('p', null, g.desc), h('div', { class: 'chips center' }, rulesTxt.map(t => h('span', { class: 'chip' }, t))),
      h('div', { class: 'grid3' }, h('label', null, 'اسم اللاعب', nameIn), !g.rules.daily && g.engine !== 'ladder' ? h('label', null, 'مستوى الصعوبة', diffSel) : null, !g.rules.daily && subs.length > 1 ? h('label', null, 'القسم الفرعي', subSel) : null),
      h('button', { class: 'btn primary big', id: 'startBtn', onclick: start }, '▶ ابدأ اللعب'), h('p', { class: 'muted small' }, 'متوفر ' + fmt(g.available) + ' سؤال لهذه اللعبة'));
    view.appendChild(intro);
    function start() {
      const opts = { diff: diffSel.value ? +diffSel.value : null, sub: subSel.value || null };
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
    if (!res.multi && !res.study && W.QP.Profiles) earned = W.QP.Profiles.record({ game: game.id, title: game.title, score: st.score, log: st.log, best: st.best });
    if (game.rules.daily) { const d = W.QP.LS.get('daily', {}); d[W.QP.todayKey()] = st.score; W.QP.LS.set('daily', d); }
    const pct = st.log.length ? Math.round(100 * st.correct / st.log.length) : 0;
    if (pct >= 70) Sound.win();
    const head = h('div', { class: 'card result' }, h('div', { class: 'intro-icon' }, pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'), h('h1', null, res.money ? 'ربحت ' + fmt(st.score) + ' ريال افتراضي!' : res.study ? 'انتهت جلسة المراجعة' : 'النتيجة: ' + fmt(Math.round(st.score)) + ' نقطة'),
      res.multi ? h('div', { class: 'podium' }, res.multi.slice().sort((a, b) => b.score - a.score).map((p, k) => h('div', { class: 'pod p' + k }, h('div', null, ['🥇', '🥈', '🥉'][k] || '🎖'), h('b', null, p.name), h('span', null, fmt(Math.round(p.score)))))) : null,
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
    else if (p0 === 'online') { setActive('online'); W.QP.onlinePage(view, parts, r => { running = r; }); } else home();
  }
  W.addEventListener('hashchange', route);
  const snd = document.getElementById('soundBtn');
  if (snd) { const upd = () => snd.textContent = Sound.on ? '🔊' : '🔇'; upd(); snd.addEventListener('click', () => { Sound.on = !Sound.on; upd(); }); }
  route();
})(window);
