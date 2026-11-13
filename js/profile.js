/* profile.js — local player profiles: stats per category, achievements, history, export/import between devices */
(function (W) {
  'use strict';
  const { LS, h, toAr, Bank } = W.QP;
  const AVATARS = ['🦁', '🐪', '🦅', '🐎', '🌙', '⭐', '📖', '🕌', '⚽', '🏆', '🧠', '🌴', '🦉', '🐬', '🚀', '💎', '🔥', '🌹', '🎯', '🛡️'];
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  function blank(name, avatar) {
    return { id: uid(), name: name || 'لاعب', avatar: avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)], created: new Date().toISOString(),
      games: 0, questions: 0, correct: 0, points: 0, bestScore: 0, bestStreak: 0, cats: {}, days: [], badges: {}, history: [], online: { games: 0, wins: 0 } };
  }
  const ACH = [
    { id: 'first', icon: '🎬', name: 'البداية', desc: 'أكمل أول لعبة', test: p => p.games >= 1 },
    { id: 'g10', icon: '🎮', name: 'لاعب نشيط', desc: 'أكمل ١٠ ألعاب', test: p => p.games >= 10 },
    { id: 'g50', icon: '🕹️', name: 'محترف الألعاب', desc: 'أكمل ٥٠ لعبة', test: p => p.games >= 50 },
    { id: 'q100', icon: '💯', name: 'مئة إجابة', desc: 'أجب إجابة صحيحة عن ١٠٠ سؤال', test: p => p.correct >= 100 },
    { id: 'q1000', icon: '🧠', name: 'ألف إجابة', desc: 'أجب إجابة صحيحة عن ١٬٠٠٠ سؤال', test: p => p.correct >= 1000 },
    { id: 'perfect', icon: '🌟', name: 'العلامة الكاملة', desc: 'أنهِ لعبة من ٥ أسئلة فأكثر بلا خطأ', test: (p, last) => last && last.total >= 5 && last.correct === last.total },
    { id: 'streak10', icon: '🔥', name: 'تتابع ناري', desc: '١٠ إجابات صحيحة متتالية', test: p => p.bestStreak >= 10 },
    { id: 'cats4', icon: '🧭', name: 'المستكشف', desc: 'العب في ٤ أقسام مختلفة', test: p => Object.keys(p.cats).length >= 4 },
    { id: 'cats12', icon: '🌐', name: 'الموسوعة', desc: 'العب في كل الأقسام الاثني عشر', test: p => Object.keys(p.cats).length >= 12 },
    { id: 'days3', icon: '📅', name: 'المواظب', desc: 'العب في ٣ أيام مختلفة', test: p => p.days.length >= 3 },
    { id: 'days7', icon: '🗓️', name: 'أسبوع كامل', desc: 'العب في ٧ أيام مختلفة', test: p => p.days.length >= 7 },
    { id: 'online1', icon: '📡', name: 'أول منافسة', desc: 'شارك في مسابقة أونلاين', test: p => p.online.games >= 1 },
    { id: 'onlinewin', icon: '👑', name: 'بطل الغرفة', desc: 'افز بالمركز الأول في مسابقة أونلاين', test: p => p.online.wins >= 1 }
  ].concat((W.QUIZ_CATEGORIES || []).map(c => ({ id: 'master-' + c.id, icon: c.icon, name: 'متقن ' + c.name, desc: '٥٠ إجابة صحيحة في ' + c.name, test: p => (p.cats[c.id] || {}).c >= 50 })));

  const Profiles = {
    AVATARS, ACH,
    list() { return LS.get('profiles', []); },
    save(list) { LS.set('profiles', list); },
    activeId() { return LS.get('activeProfile', null); },
    get active() {
      let l = this.list(); let p = l.find(x => x.id === this.activeId());
      if (!p) { // migrate legacy single name / create default
        p = l[0] || blank(LS.get('player', '') || 'لاعب'); if (!l.length) { l.push(p); this.save(l); } LS.set('activeProfile', p.id);
      }
      return p;
    },
    update(fn) { const l = this.list(); const a = this.active; const i = l.findIndex(x => x.id === a.id); const p = i >= 0 ? l[i] : a; fn(p); if (i >= 0) l[i] = p; else l.push(p); this.save(l); return p; },
    create(name, avatar) { const p = blank(String(name || '').trim().slice(0, 30) || 'لاعب', avatar); const l = this.list(); l.push(p); this.save(l); LS.set('activeProfile', p.id); return p; },
    switchTo(id) { if (this.list().some(p => p.id === id)) LS.set('activeProfile', id); },
    remove(id) { const l = this.list().filter(p => p.id !== id); this.save(l); if (this.activeId() === id) LS.set('activeProfile', l[0] ? l[0].id : null); },
    // record a finished game: rec = {game, title, score, log:[{q,res}], best, online:{rank, players}}
    record(rec) {
      const newly = [];
      const p = this.update(p => {
        const correct = rec.log.filter(l => l.res && l.res.correct).length; const total = rec.log.length;
        p.games++; p.questions += total; p.correct += correct; p.points += Math.max(0, Math.round(rec.score || 0));
        p.bestScore = Math.max(p.bestScore, Math.round(rec.score || 0));
        let run = 0, best = rec.best || 0; rec.log.forEach(l => { run = l.res && l.res.correct ? run + 1 : 0; best = Math.max(best, run); }); p.bestStreak = Math.max(p.bestStreak, best);
        rec.log.forEach(l => { const c = l.q && l.q.category; if (!c) return; const s = p.cats[c] = p.cats[c] || { q: 0, c: 0 }; s.q++; if (l.res && l.res.correct) s.c++; });
        const d = new Date().toISOString().slice(0, 10); if (!p.days.includes(d)) p.days = p.days.concat(d).slice(-400);
        if (rec.online) { p.online.games++; if (rec.online.rank === 1 && rec.online.players > 1) p.online.wins++; }
        p.history.unshift({ t: new Date().toISOString(), game: rec.title || rec.game, score: Math.round(rec.score || 0), correct, total, online: rec.online || null }); p.history = p.history.slice(0, 60);
        const last = { correct, total };
        ACH.forEach(a => { if (!p.badges[a.id] && a.test(p, last)) { p.badges[a.id] = new Date().toISOString(); newly.push(a); } });
      });
      return { profile: p, newBadges: newly };
    },
    // portable code: base64(utf8 json) with a prefix; also a .json file
    exportCode(p) { p = p || this.active; const json = JSON.stringify({ v: 1, app: 'musabaqat', profile: p }); return 'MSBQ1:' + btoa(unescape(encodeURIComponent(json))); },
    importCode(code) {
      code = String(code || '').trim(); let obj;
      try { obj = code.startsWith('{') ? JSON.parse(code) : JSON.parse(decodeURIComponent(escape(atob(code.replace(/^MSBQ1:/, '').replace(/\s+/g, ''))))); } catch (e) { throw new Error('الرمز غير صالح'); }
      const p = obj && obj.profile; if (!p || !p.id || !p.name || typeof p.games !== 'number') throw new Error('الرمز لا يحتوي ملف لاعب');
      const base = blank(p.name, p.avatar); const clean = Object.assign(base, p, { name: String(p.name).slice(0, 30) });
      const l = this.list(); const i = l.findIndex(x => x.id === clean.id); if (i >= 0) l[i] = clean; else l.push(clean); this.save(l); LS.set('activeProfile', clean.id); return clean;
    }
  };
  // keep the old Player API working (name field on home/intro screens edits the active profile)
  Object.defineProperty(W.QP.Player, 'name', { configurable: true, get() { return Profiles.active.name; }, set(v) { const n = String(v || '').trim().slice(0, 30); Profiles.update(p => { p.name = n || p.name; }); LS.set('player', n); } });
  W.QP.Player.avatar = () => Profiles.active.avatar;
  W.QP.Profiles = Profiles;

  // ---------------------------------------------------------------- page
  W.QP.profilePage = function (view) {
    const fmt = n => toAr(Number(n).toLocaleString('en'));
    const p = Profiles.active; const acc = p.questions ? Math.round(100 * p.correct / p.questions) : 0;
    const rerender = () => { view.innerHTML = ''; W.QP.profilePage(view); };
    const nameIn = h('input', { class: 'inp', value: p.name, maxlength: 30, onchange: e => { W.QP.Player.name = e.target.value; rerender(); } });
    const av = h('div', { class: 'avatars' }, AVATARS.map(a => h('button', { class: 'av' + (a === p.avatar ? ' on' : ''), onclick: () => { Profiles.update(x => { x.avatar = a; }); rerender(); } }, a)));
    view.appendChild(h('div', { class: 'card profile-head' },
      h('div', { class: 'pf-avatar' }, p.avatar),
      h('div', { class: 'pf-main' }, h('h1', null, p.name), h('label', null, 'اسم اللاعب', nameIn), h('div', { class: 'muted small' }, 'اختر رمزك:'), av),
    ));
    view.appendChild(h('div', { class: 'stats pf-stats' },
      [[fmt(p.games), 'لعبة'], [fmt(p.correct) + '/' + fmt(p.questions), 'إجابة صحيحة'], [toAr(acc) + '٪', 'الدقة'], [fmt(p.points), 'مجموع النقاط'], [fmt(p.bestScore), 'أفضل نتيجة'], [toAr(p.bestStreak), 'أطول تتابع'], [toAr(p.days.length), 'أيام اللعب'], [toAr(p.online.games) + ' / ' + toAr(p.online.wins), 'أونلاين / فوز']]
        .map(([b, s]) => h('div', null, h('b', null, b), h('span', null, s)))));
    view.appendChild(h('h2', { class: 'section-title' }, '📊 أداؤك في الأقسام'));
    view.appendChild(h('div', { class: 'pf-cats' }, Bank.cats.map(c => { const s = p.cats[c.id] || { q: 0, c: 0 }; const pc = s.q ? Math.round(100 * s.c / s.q) : 0;
      return h('div', { class: 'pf-cat', style: { '--c': c.color } }, h('div', null, c.icon + ' ' + c.name), h('div', { class: 'pf-bar' }, h('i', { style: { width: pc + '%' } })), h('small', { class: 'muted' }, s.q ? toAr(s.c) + ' من ' + toAr(s.q) + ' (' + toAr(pc) + '٪)' : 'لم تلعب بعد')); })));
    const got = ACH.filter(a => p.badges[a.id]).length;
    view.appendChild(h('h2', { class: 'section-title' }, '🏅 الإنجازات (' + toAr(got) + ' من ' + toAr(ACH.length) + ')'));
    view.appendChild(h('div', { class: 'badges' }, ACH.map(a => h('div', { class: 'ach' + (p.badges[a.id] ? ' on' : ''), title: a.desc }, h('div', { class: 'ach-i' }, a.icon), h('b', null, a.name), h('small', null, a.desc)))));
    view.appendChild(h('h2', { class: 'section-title' }, '🕘 آخر الألعاب'));
    const rows = p.history.slice(0, 20).map(r => h('tr', null, h('td', null, new Date(r.t).toLocaleDateString('ar-SA')), h('td', null, (r.online ? '📡 ' : '') + r.game + (r.online ? ' — المركز ' + toAr(r.online.rank) + ' من ' + toAr(r.online.players) : '')), h('td', null, fmt(r.score)), h('td', null, toAr(r.correct) + '/' + toAr(r.total))));
    view.appendChild(p.history.length ? h('table', { class: 'board' }, h('thead', null, h('tr', null, ['التاريخ', 'اللعبة', 'النقاط', 'الصحيحة'].map(x => h('th', null, x)))), h('tbody', null, rows)) : h('p', { class: 'muted' }, 'لا توجد ألعاب بعد — ابدأ أول لعبة!'));
    // transfer + multiple profiles
    const codeBox = h('textarea', { class: 'inp code', rows: 3, placeholder: 'الصق رمز ملف اللاعب هنا…' });
    const msg = h('div', { class: 'muted small' });
    const fileIn = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'hidden', onchange: e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { codeBox.value = t; doImport(); }); } });
    function doImport() { try { const np = Profiles.importCode(codeBox.value); msg.textContent = '✔ تم استيراد ملف «' + np.name + '»'; setTimeout(rerender, 600); } catch (e) { msg.textContent = '✘ ' + e.message; } }
    view.appendChild(h('h2', { class: 'section-title' }, '🔄 نقل ملفك إلى جهاز آخر'));
    view.appendChild(h('div', { class: 'card' },
      h('p', { class: 'muted' }, 'ملفك محفوظ في هذا المتصفح فقط. لنقله: انسخ الرمز أو نزّل الملف، ثم افتح المنصة في الجهاز الآخر واستورده من هذه الصفحة.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', id: 'copyCode', onclick: () => { const c = Profiles.exportCode(); codeBox.value = c; (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => msg.textContent = '✔ تم نسخ الرمز', () => msg.textContent = 'انسخ الرمز من المربع'); } }, '📋 نسخ رمز ملفي'),
        h('button', { class: 'btn', onclick: () => W.QP.download('musabaqat-' + p.name + '.json', JSON.stringify({ v: 1, app: 'musabaqat', profile: Profiles.active }, null, 1)) }, '⬇️ تنزيل ملفي'),
        h('button', { class: 'btn', id: 'importBtn', onclick: doImport }, '⬆️ استيراد من الرمز'),
        h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, '📂 استيراد من ملف'), fileIn),
      codeBox, msg));
    const others = Profiles.list();
    const newName = h('input', { class: 'inp', placeholder: 'اسم لاعب جديد', maxlength: 30 });
    view.appendChild(h('h2', { class: 'section-title' }, '👥 اللاعبون على هذا الجهاز'));
    view.appendChild(h('div', { class: 'card' }, h('div', { class: 'pf-list' }, others.map(o => h('div', { class: 'pf-item' + (o.id === p.id ? ' on' : '') }, h('span', { class: 'pf-av' }, o.avatar), h('b', null, o.name), h('small', { class: 'muted' }, toAr(o.games) + ' لعبة'),
      o.id === p.id ? h('span', { class: 'chip small' }, 'النشط') : h('button', { class: 'btn small', onclick: () => { Profiles.switchTo(o.id); rerender(); } }, 'تبديل'),
      others.length > 1 ? h('button', { class: 'btn small ghost', onclick: () => { if (confirm('حذف ملف «' + o.name + '» من هذا الجهاز؟')) { Profiles.remove(o.id); rerender(); } } }, '🗑') : null))),
      h('div', { class: 'row' }, newName, h('button', { class: 'btn primary', onclick: () => { if (!newName.value.trim()) return; Profiles.create(newName.value); rerender(); } }, '➕ إضافة لاعب'))));
  };
})(window);
