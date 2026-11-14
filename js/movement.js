/* movement.js — الألعاب الحركية: قائمة، تفاصيل، مؤقت، وعدّاد فرق */
(function (W) {
  'use strict';
  const { h, toAr, Sound, LS } = W.QP;
  const ALL = () => W.QP_MOVEMENT_GAMES || [];
  const AGES = ['ابتدائي', 'متوسط', 'ثانوي', 'جامعي'];
  const PLACES = ['صالة', 'ساحة', 'فصل'];
  const SIZES = [
    { id: '', label: 'الكل' },
    { id: 's', label: 'قليل (حتى ٨)' },
    { id: 'm', label: 'متوسط (٩–١٥)' },
    { id: 'l', label: 'كثير (١٦+)' }
  ];
  const TOOLS = [
    { id: '', label: 'الكل' },
    { id: 'no', label: 'بدون أدوات' },
    { id: 'yes', label: 'مع أدوات' }
  ];

  let stopRun = null;

  function setActive() {
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === 'movement'));
  }
  function playersLabel(g) { return toAr(g.pmin) + '–' + toAr(g.pmax) + ' لاعبًا'; }
  function parseF(params) {
    return { age: params.age || '', place: params.place || '', tools: params.tools || '', size: params.size || '', kind: params.kind || '', q: params.q || '' };
  }
  function href(f, id) {
    const p = new URLSearchParams();
    if (f.age) p.set('age', f.age);
    if (f.place) p.set('place', f.place);
    if (f.tools) p.set('tools', f.tools);
    if (f.size) p.set('size', f.size);
    if (f.kind) p.set('kind', f.kind);
    if (f.q) p.set('q', f.q);
    const qs = p.toString();
    return '#/movement' + (id ? '/' + encodeURIComponent(id) : '') + (qs ? '?' + qs : '');
  }
  function norm(s) {
    return String(s || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
  }
  function overlaps(a1, a2, b1, b2) { return a1 <= b2 && b1 <= a2; }
  function matches(g, f) {
    if (f.age && !(g.ages || []).includes(f.age)) return false;
    if (f.place && !(g.places || []).includes(f.place)) return false;
    if (f.kind && g.kind !== f.kind) return false;
    if (f.tools === 'no' && !g.noTools) return false;
    if (f.tools === 'yes' && g.noTools) return false;
    if (f.size === 's' && !overlaps(g.pmin, g.pmax, 1, 8)) return false;
    if (f.size === 'm' && !overlaps(g.pmin, g.pmax, 9, 15)) return false;
    if (f.size === 'l' && !overlaps(g.pmin, g.pmax, 16, 200)) return false;
    if (f.q) {
      const q = norm(f.q);
      const blob = norm([g.name, g.goal, g.kind, g.tools, g.win, ...(g.steps || [])].join(' '));
      if (q && blob.indexOf(q) === -1) return false;
    }
    return true;
  }
  function kinds() {
    const s = [];
    ALL().forEach(g => { if (g.kind && s.indexOf(g.kind) === -1) s.push(g.kind); });
    return s;
  }
  function card(g, f) {
    return h('a', { class: 'mv-card', href: href(f, g.id) },
      h('div', { class: 'mv-card-icon' }, g.icon),
      h('div', { class: 'mv-card-body' },
        h('div', { class: 'mv-card-title' }, g.name),
        h('div', { class: 'mv-card-desc' }, g.goal),
        h('div', { class: 'chips' },
          h('span', { class: 'chip small' }, g.kind),
          ...(g.places || []).map(p => h('span', { class: 'chip small' }, p)),
          h('span', { class: 'chip small' }, g.noTools ? 'بدون أدوات' : 'مع أدوات'),
          h('span', { class: 'chip small' }, playersLabel(g))
        )));
  }

  function catalog(view, params) {
    setActive();
    const f = parseF(params);
    const grid = h('div', { class: 'mv-grid' });
    const countEl = h('div', { class: 'mv-count' });
    const search = h('input', { class: 'inp mv-search', type: 'search', placeholder: 'ابحث عن لعبة بالاسم أو الفكرة…', value: f.q, maxlength: 80, 'aria-label': 'بحث في الألعاب الحركية' });

    function list() { return ALL().filter(g => matches(g, f)); }
    function syncHash() {
      const url = href(f);
      if (location.hash !== url) {
        try { history.replaceState(null, '', url); } catch (e) {}
      }
    }
    function draw() {
      const items = list();
      countEl.textContent = toAr(items.length) + ' لعبة';
      grid.innerHTML = '';
      if (!items.length) {
        grid.appendChild(h('p', { class: 'center muted mv-empty' }, 'لا توجد ألعاب بهذه التصفية. جرّب «الكل» أو امسح البحث.'));
        return;
      }
      items.forEach(g => grid.appendChild(card(g, f)));
    }
    function goRandom() {
      const items = list();
      if (!items.length) return;
      const g = items[Math.floor(Math.random() * items.length)];
      location.hash = href(f, g.id);
    }

    const filtersHost = h('div', { class: 'qfilters mv-filters' });
    function chipBtn(label, on, fn) {
      return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: fn }, label);
    }
    function row(label, kids) {
      return h('div', { class: 'qf-row mv-frow' }, h('span', { class: 'qf-label' }, label), h('div', { class: 'chips' }, kids));
    }
    function rebuildFilters() {
      filtersHost.innerHTML = '';
      filtersHost.appendChild(row('العمر', [
        chipBtn('الكل', !f.age, () => { f.age = ''; refresh(); }),
        ...AGES.map(a => chipBtn(a, f.age === a, () => { f.age = f.age === a ? '' : a; refresh(); }))
      ]));
      filtersHost.appendChild(row('المكان', [
        chipBtn('الكل', !f.place, () => { f.place = ''; refresh(); }),
        ...PLACES.map(p => chipBtn(p, f.place === p, () => { f.place = f.place === p ? '' : p; refresh(); }))
      ]));
      filtersHost.appendChild(row('الأدوات', TOOLS.map(t => chipBtn(t.label, f.tools === t.id, () => { f.tools = t.id; refresh(); }))));
      filtersHost.appendChild(row('عدد اللاعبين', SIZES.map(s => chipBtn(s.label, f.size === s.id, () => { f.size = s.id; refresh(); }))));
      const ks = kinds();
      if (ks.length) {
        filtersHost.appendChild(row('النوع', [
          chipBtn('الكل', !f.kind, () => { f.kind = ''; refresh(); }),
          ...ks.map(k => chipBtn(k, f.kind === k, () => { f.kind = f.kind === k ? '' : k; refresh(); }))
        ]));
      }
    }
    function refresh() { syncHash(); rebuildFilters(); draw(); }

    let tSearch = 0;
    search.addEventListener('input', () => {
      f.q = search.value;
      clearTimeout(tSearch);
      tSearch = setTimeout(() => { syncHash(); draw(); }, 120);
    });

    view.appendChild(h('div', { class: 'mv-head' },
      h('div', null,
        h('h1', null, '🏃 الألعاب الحركية'),
        h('p', { class: 'mv-lead' }, 'مجموعة ألعاب حركة للطلاب والشباب: في الفصل والصالة والساحة، من الابتدائي إلى الجامعي. اختر لعبة أو اطلب اختيارًا عشوائيًا، ثم شغّل المؤقت وعدّاد النقاط أثناء التنفيذ.')
      ),
      h('div', { class: 'mv-actions no-print' },
        search,
        h('button', { type: 'button', class: 'btn primary big', onclick: goRandom }, '🎲 اختر لعبة عشوائية')
      )));
    view.appendChild(filtersHost);
    view.appendChild(countEl);
    view.appendChild(grid);
    rebuildFilters();
    draw();
  }

  function section(title, kids, cls) {
    return h('section', { class: 'mv-sec' + (cls ? ' ' + cls : '') }, h('h2', null, title), kids);
  }

  function detail(view, id, params) {
    setActive();
    const f = parseF(params);
    const g = ALL().find(x => x.id === id);
    if (!g) {
      view.appendChild(h('div', { class: 'card center' },
        h('p', null, 'هذه اللعبة غير موجودة.'),
        h('a', { class: 'btn primary', href: href(f) }, 'العودة إلى قائمة الألعاب الحركية')));
      return;
    }
    function goRandom() {
      const items = ALL().filter(x => matches(x, f) && x.id !== g.id);
      const pool = items.length ? items : ALL().filter(x => x.id !== g.id);
      if (!pool.length) return;
      const n = pool[Math.floor(Math.random() * pool.length)];
      location.hash = href(f, n.id);
    }
    const meta = [
      ['الفئة العمرية', (g.ages || []).join('، ')],
      ['عدد اللاعبين', playersLabel(g)],
      ['المكان', (g.places || []).join(' / ')],
      ['الأدوات', g.noTools ? 'بدون أدوات' : (g.tools || 'أدوات بسيطة')],
      ['المدة', g.duration || '—'],
      ['النوع', g.kind || '']
    ];
    view.appendChild(h('div', { class: 'mv-detail' },
      h('div', { class: 'row between mv-toolbar no-print' },
        h('a', { class: 'btn ghost', href: href(f) }, '← كل الألعاب الحركية'),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: () => W.print() }, '🖨️ طباعة'),
          h('button', { type: 'button', class: 'btn primary', onclick: goRandom }, '🎲 لعبة عشوائية أخرى')
        )),
      h('header', { class: 'mv-hero' },
        h('div', { class: 'mv-hero-icon' }, g.icon),
        h('h1', null, g.name),
        h('p', { class: 'mv-goal' }, g.goal),
        h('div', { class: 'chips' },
          ...(g.ages || []).map(a => h('span', { class: 'chip' }, a)),
          ...(g.places || []).map(p => h('span', { class: 'chip' }, p)),
          h('span', { class: 'chip' }, g.noTools ? 'بدون أدوات' : 'مع أدوات'),
          h('span', { class: 'chip' }, playersLabel(g))
        )),
      h('div', { class: 'mv-meta' }, meta.map(([k, v]) => h('div', null, h('b', null, k), v))),
      section('طريقة اللعب', h('ol', { class: 'mv-steps' }, (g.steps || []).map(s => h('li', null, s)))),
      section('قواعد الفوز', h('p', null, g.win || '')),
      section('تنبيهات السلامة', h('p', null, g.safety || ''), 'safety'),
      g.quiz ? section('فكرة لدمجها مع أسئلة المسابقة', h('p', null, g.quiz), 'quiz') : null,
      runner()
    ));
  }

  function runner() {
    const PRESETS = [
      { s: 30, label: '٣٠ ث' }, { s: 60, label: '١ د' }, { s: 120, label: '٢ د' },
      { s: 180, label: '٣ د' }, { s: 300, label: '٥ د' }, { s: 600, label: '١٠ د' }
    ];
    let total = LS.get('mv_timer', 60) || 60;
    let left = total, ticking = false, iv = null;
    const timeEl = h('div', { class: 'mv-time', id: 'mvTime' }, fmt(left));
    const fill = h('div', { class: 'tbar-fill' });
    const bar = h('div', { class: 'mv-tbar', 'aria-hidden': 'true' }, fill);
    const presets = h('div', { class: 'mv-presets' });

    function fmt(sec) {
      sec = Math.max(0, Math.round(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return toAr(m) + ':' + toAr(String(s).padStart(2, '0'));
    }
    function paint() {
      timeEl.textContent = fmt(left);
      const warn = left <= 10 && total > 0;
      timeEl.classList.toggle('warn', warn && ticking);
      fill.classList.toggle('warn', left / (total || 1) <= 0.2);
      fill.style.width = (total ? Math.max(0, 100 * left / total) : 0) + '%';
      presets.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', PRESETS[i].s === total && !ticking && left === total));
    }
    function stop() { ticking = false; if (iv) { clearInterval(iv); iv = null; } paint(); }
    function start() {
      if (left <= 0) left = total;
      if (ticking) return;
      ticking = true;
      if (Sound && Sound.go) Sound.go();
      const t0 = Date.now(), startLeft = left;
      iv = setInterval(() => {
        left = Math.max(0, startLeft - (Date.now() - t0) / 1000);
        if (left <= 10 && left > 9.8 && Sound && Sound.tick) Sound.tick();
        if (left <= 0) {
          left = 0; stop();
          if (Sound && Sound.win) Sound.win();
          if (navigator.vibrate) try { navigator.vibrate([200, 80, 200]); } catch (e) {}
        }
        paint();
      }, 100);
      paint();
    }
    function setTotal(s) { total = s; left = s; LS.set('mv_timer', s); stop(); paint(); }

    PRESETS.forEach(p => presets.appendChild(h('button', { type: 'button', class: 'chip', onclick: () => setTotal(p.s) }, p.label)));

    const nTeams = Math.min(6, Math.max(2, Number(LS.get('mv_nteams', 2)) || 2));
    const saved = LS.get('mv_teams', []) || [];
    const teams = [];
    const teamsBox = h('div', { class: 'mv-teams' });
    function renderTeams(n) {
      teamsBox.innerHTML = '';
      teams.length = 0;
      for (let i = 0; i < n; i++) {
        const st = { name: (saved[i] && saved[i].name) || ('فريق ' + toAr(i + 1)), score: 0 };
        teams.push(st);
        const sc = h('div', { class: 'mv-score' }, toAr(0));
        const inp = h('input', { class: 'inp', maxlength: 20, value: st.name, 'aria-label': 'اسم الفريق ' + toAr(i + 1), oninput: e => { st.name = e.target.value; persistNames(); } });
        function setScore(d) {
          st.score = Math.max(0, st.score + d);
          sc.textContent = toAr(st.score);
          if (d > 0 && Sound && Sound.good) Sound.good();
        }
        teamsBox.appendChild(h('div', { class: 'mv-team' },
          inp, sc,
          h('div', { class: 'mv-score-btns' },
            h('button', { type: 'button', class: 'btn good', onclick: () => setScore(1), 'aria-label': 'زيادة نقطة' }, '+'),
            h('button', { type: 'button', class: 'btn bad', onclick: () => setScore(-1), 'aria-label': 'إنقاص نقطة' }, '−')
          )));
      }
      LS.set('mv_nteams', n);
    }
    function persistNames() { LS.set('mv_teams', teams.map(t => ({ name: t.name }))); }
    renderTeams(nTeams);

    stopRun = () => { stop(); };

    paint();
    return h('section', { class: 'mv-runner no-print', id: 'mvRunner' },
      h('h2', null, '⏱ مؤقت الجولة وعدّاد النقاط'),
      h('div', { class: 'mv-timer-wrap' }, timeEl, bar, presets,
        h('div', { class: 'mv-timer-btns' },
          h('button', { type: 'button', class: 'btn primary', onclick: start }, '▶ تشغيل'),
          h('button', { type: 'button', class: 'btn', onclick: stop }, '⏸ إيقاف'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { left = total; stop(); paint(); } }, '↺ تصفير المؤقت')
        )),
      teamsBox,
      h('div', { class: 'mv-runner-tools' },
        h('button', { type: 'button', class: 'btn', onclick: () => renderTeams(Math.min(6, teams.length + 1)) }, '＋ فريق'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (teams.length > 2) renderTeams(teams.length - 1); } }, '− فريق'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => { teams.forEach(t => t.score = 0); teamsBox.querySelectorAll('.mv-score').forEach(el => { el.textContent = toAr(0); }); } }, 'تصفير النقاط')
      ));
  }

  function movementHomeCard() {
    const n = toAr(ALL().length || 110);
    return h('a', { class: 'mv-banner', href: '#/movement' },
      h('div', { class: 'mv-banner-icon' }, '🏃'),
      h('div', { class: 'mv-banner-body' },
        h('div', { class: 'champ-kicker' }, 'للحركة والحماس في الفصل والصالة والساحة'),
        h('h2', null, 'الألعاب الحركية'),
        h('p', null, n + ' لعبة جماعية للطلاب والشباب، من الابتدائي إلى الجامعي: تتابع ومطاردة وكرة وتوازن وألعاب فصل بلا أدوات، مع مؤقت وعدّاد نقاط للفرق.'),
        h('div', { class: 'chips' },
          h('span', { class: 'chip' }, '🏁 تتابع'), h('span', { class: 'chip' }, '⚽ كرة'), h('span', { class: 'chip' }, '🤝 تعاون'),
          h('span', { class: 'chip' }, '📚 للفصل'), h('span', { class: 'chip' }, '🎲 اختيار عشوائي')),
        h('span', { class: 'btn primary big' }, '🎨 تصفّح الألعاب')));
  }

  function movementPage(view, parts, params) {
    if (stopRun) { try { stopRun(); } catch (e) {} stopRun = null; }
    const id = parts[1];
    if (id) detail(view, id, params || {});
    else catalog(view, params || {});
    return { stop() { if (stopRun) { try { stopRun(); } catch (e) {} stopRun = null; } } };
  }

  W.QP.movementPage = movementPage;
  W.QP.movementHomeCard = movementHomeCard;
})(window);
