/* leaderboard.js — protected global leaderboard on Firebase (Firestore + anonymous auth).
   Each profile on a device gets its own anonymous Firebase user (a named Firebase app per profile, so the
   sign-in is remembered per profile) and writes exactly one document: leaderboard/{uid}.
   Security rules (firestore.rules) only accept sane values, small increments and one write per 15 s.
   The global record counts games played from the moment the profile joins the board (its next game on),
   so old local totals never need to be "replayed" past the per-update limits. */
(function (W) {
  'use strict';
  const { h, toAr, Bank, Profiles, LS } = W.QP;
  const CFG = { apiKey: 'AIzaSyAMHdIzimXm6ExSjVQE7hebQ2KT4MQWkFo', authDomain: 'musabaqat-f24e4.firebaseapp.com', projectId: 'musabaqat-f24e4',
    storageBucket: 'musabaqat-f24e4.firebasestorage.app', messagingSenderId: '652659925275', appId: '1:652659925275:web:c26e3b75c144dce6a373be' };
  const SDK = 'https://www.gstatic.com/firebasejs/12.6.0/';
  const COL = 'leaderboard', GAP = 17000, MAX_G = 3, MAX_P = 15000, PER_GAME = 5000;
  const CAT_IDS = (W.QUIZ_CATEGORIES || []).map(c => c.id);
  const fmt = n => toAr(Number(n || 0).toLocaleString('en'));
  const stripTags = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[<>&"'`\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  const int = v => { v = Math.floor(Number(v)); return Number.isFinite(v) && v > 0 ? v : 0; };

  let fbP = null; // lazy-load the official modular SDK (ESM from gstatic)
  const fb = () => fbP || (fbP = Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(SDK + f)))
    .then(([app, auth, fs]) => ({ ...app, ...auth, ...fs })).catch(e => { fbP = null; throw e; }));
  const apps = {};
  async function appFor(name) { const F = await fb(); if (!apps[name]) { const a = F.getApps().find(x => x.name === name) || F.initializeApp(CFG, name); apps[name] = { app: a, db: F.getFirestore(a) }; } return { F, ...apps[name] }; }
  async function userFor(p) { // anonymous user of this profile on this device
    const { F, app, db } = await appFor('lb_' + p.id); const auth = F.getAuth(app); await auth.authStateReady();
    const u = auth.currentUser || (await F.signInAnonymously(auth)).user;
    const map = LS.get('lbUid', {}); if (map[p.id] !== u.uid) { map[p.id] = u.uid; LS.set('lbUid', map); }
    return { F, db, auth, uid: u.uid };
  }
  // ---------------------------------------------------------------- local bookkeeping
  const enabled = () => LS.get('lbPublish', true);
  const cur = p => { const cats = {}; Object.entries(p.cats || {}).forEach(([k, v]) => { if (CAT_IDS.includes(k) && v) cats[k] = { q: int(v.q), c: int(v.c) }; });
    return { games: int(p.games), points: int(p.points), correct: int(p.correct), answered: int(p.questions), wins: int((p.online || {}).wins), cats }; };
  const sub = (a, b) => { const r = {}; ['games', 'points', 'correct', 'answered', 'wins'].forEach(k => r[k] = Math.max(0, a[k] - (b[k] || 0)));
    r.cats = {}; Object.entries(a.cats).forEach(([k, v]) => { const o = (b.cats || {})[k] || {}; const q = Math.max(0, v.q - (o.q || 0)), c = Math.min(q, Math.max(0, v.c - (o.c || 0))); if (q) r.cats[k] = { q, c }; }); return r; };
  const stKey = id => 'lbState_' + id;
  const getSt = p => LS.get(stKey(p.id), null), setSt = (p, s) => LS.set(stKey(p.id), s);
  const ensureSt = p => { if (p && p.id && enabled() && !getSt(p)) setSt(p, { base: cur(p), pub: null, at: 0 }); };
  function docVals(d) { const c = {}; Object.entries(d.cats || {}).forEach(([k, v]) => { c[k] = { q: int(v && v.q), c: int(v && v.c) }; });
    return { games: int(d.games), points: int(d.points), correct: int(d.correct), answered: int(d.answered), wins: int(d.wins), cats: c }; }
  function nextStep(target, pub) { // biggest write the rules accept from `pub` toward `target`
    const pg = pub ? pub.games : 0, pp = pub ? pub.points : 0;
    const games = Math.min(target.games, pg + MAX_G);
    const points = Math.max(pp, Math.min(target.points, pub ? pp + MAX_P : MAX_P, games * PER_GAME));
    const answered = Math.max(target.answered, pub ? pub.answered : 0), correct = Math.min(answered, Math.max(target.correct, pub ? pub.correct : 0));
    const cats = {}; Object.entries(target.cats).slice(0, 13).forEach(([k, v]) => { cats[k] = { q: v.q, c: Math.min(v.q, v.c) }; });
    const more = games < target.games || (points < target.points && points === pp + MAX_P);
    return { games, points, correct, answered, wins: Math.min(target.wins, games), cats, more };
  }
  // ---------------------------------------------------------------- publishing
  let timer = null, busy = false, fails = 0, synced = {};
  async function publish(p) {
    p = p || Profiles.active; if (!enabled() || !p || !p.id) return null;
    ensureSt(p); let st = getSt(p);
    const { F, db, uid } = await userFor(p); const ref = F.doc(db, COL, uid);
    if (!synced[p.id]) { // reconcile with what the server holds
      const snap = await F.getDoc(ref); const c = cur(p);
      if (snap.exists()) { const d = docVals(snap.data()); if (!st.pub) st.base = sub(c, d); st.pub = d; st.at = Math.max(st.at || 0, (snap.data().updatedAt && snap.data().updatedAt.toMillis()) || 0); }
      else if (st.pub) { st = { base: c, pub: null, at: 0 }; }
      setSt(p, st); synced[p.id] = true;
    }
    const target = sub(cur(p), st.base);
    if (!target.games) return null; // nothing played since joining the board
    const wait = (st.at || 0) + GAP - Date.now(); if (wait > 0) { schedule(wait + 200); return null; }
    const s = nextStep(target, st.pub), same = st.pub && ['games', 'points', 'correct', 'answered', 'wins'].every(k => st.pub[k] === s[k]) && JSON.stringify(st.pub.cats) === JSON.stringify(s.cats);
    const name = stripTags(p.name).slice(0, 30) || 'لاعب', avatar = [...stripTags(p.avatar)].slice(0, 8).join('') || '👤';
    if (same && st.name === name && st.avatar === avatar) return null;
    await F.setDoc(ref, { name, avatar, points: s.points, games: s.games, correct: s.correct, answered: s.answered, wins: s.wins, cats: s.cats, updatedAt: F.serverTimestamp() });
    const { more, ...pub } = s; setSt(p, { base: st.base, pub, at: Date.now(), name, avatar }); LS.set('lbLast', { t: Date.now(), ok: ['Firebase'] }); fails = 0;
    if (more) schedule(GAP + 500);
    return pub;
  }
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (busy) return schedule(3000); busy = true;
      try { await publish(); } catch (e) { if (++fails <= 3) schedule(20000 * fails); if (W.console) console.warn('leaderboard publish failed:', e && (e.code || e.message)); }
      finally { busy = false; }
    }, ms == null ? 2500 : ms);
  }
  async function unpublish(p) {
    p = p || Profiles.active; LS.set(stKey(p.id), null); delete synced[p.id];
    try { const { F, db, uid } = await userFor(p); await F.deleteDoc(F.doc(db, COL, uid)); return true; } catch (e) { return false; }
  }
  const GlobalLB = {
    enabled, fb, appFor, userFor, nextStep, COL,
    setEnabled(v) { LS.set('lbPublish', !!v); if (v) { ensureSt(Profiles.active); this.schedule(0); } else return unpublish(); },
    publishNow: p => publish(p), schedule, unpublish,
    myUid: p => LS.get('lbUid', {})[(p || Profiles.active).id] || null,
    last() { return LS.get('lbLast', null); }
  };
  // the board counts from the profile's next game on: snapshot the baseline before every game is recorded
  const _record = Profiles.record.bind(Profiles); Profiles.record = function (rec) { ensureSt(Profiles.active); const r = _record(rec); GlobalLB.schedule(); return r; };
  const _update = Profiles.update.bind(Profiles); Profiles.update = function (fn) { const r = _update(fn); if (r && getSt(r) && getSt(r).pub) GlobalLB.schedule(); return r; };
  try { ensureSt(Profiles.active); } catch (e) {}
  W.QP.GlobalLB = GlobalLB;

  // ---------------------------------------------------------------- page
  W.QP.globalPage = function (view, setRunning, params) {
    const me = Profiles.active; let stopped = false; let tab = params && params.cat && CAT_IDS.includes(params.cat) ? params.cat : 'all';
    setRunning({ stop() { stopped = true; } });
    const myUid = GlobalLB.myUid(me);
    const status = h('div', { class: 'muted small', id: 'lbStatus' }, '⏳ جارٍ الاتصال بقاعدة بيانات اللوحة…');
    const tabs = h('div', { class: 'chips lb-tabs' });
    const body = h('div', { id: 'lbBody' }, h('p', { class: 'center muted' }, '⏳ جارٍ تحميل النتائج…'));
    view.appendChild(h('div', { class: 'card' }, h('h1', null, '🌍 لوحة الصدارة العامة'),
      h('p', { class: 'muted' }, 'نتائج اللاعبين من كل الأجهزة، محفوظة في قاعدة بيانات محمية وبدون أي تسجيل. تظهر نتيجتك هنا تلقائيًا من أول لعبة تلعبها بعد انضمامك، ويمكنك إيقاف ذلك من ', h('a', { href: '#/profile' }, 'ملفي'), '.'),
      !enabled() ? h('p', { class: 'chip' }, '⏸ نشر نتيجتك متوقف حاليًا من ملفك') : null, status,
      h('div', { class: 'row' }, h('button', { class: 'btn small', id: 'lbRefresh', onclick: () => load(true) }, '🔁 تحديث')), tabs));
    view.appendChild(body);
    function drawTabs() {
      tabs.innerHTML = '';
      [['all', '🏆 الكل']].concat(Bank.cats.map(c => [c.id, c.icon + ' ' + c.name])).forEach(([id, label]) => tabs.appendChild(h('button', { class: 'chip' + (tab === id ? ' on' : ''), 'data-tab': id, onclick: () => { tab = id; drawTabs(); load(); } }, label)));
    }
    const cache = {};
    function clean(id, d) {
      const v = docVals(d || {}); const name = stripTags(d.name).slice(0, 30); if (!name) return null;
      return { id, ...v, name, avatar: [...stripTags(d.avatar)].slice(0, 8).join('') || '👤', t: d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0 };
    }
    async function load(force) {
      const key = tab; status.textContent = '⏳ جارٍ التحميل…';
      try {
        if (force || !cache[key]) {
          const { F, db } = await appFor('lb_read'); const col = F.collection(db, COL);
          const field = key === 'all' ? 'points' : 'cats.' + key + '.c';
          const snap = await F.getDocs(F.query(col, F.orderBy(field, 'desc'), F.limit(100)));
          const list = snap.docs.map(d => clean(d.id, d.data())).filter(Boolean);
          let mine = null;
          if (myUid && !list.some(r => r.id === myUid)) { // my rank when I'm below the top 100
            const ms = await F.getDoc(F.doc(db, COL, myUid));
            if (ms.exists()) { const r = clean(ms.id, ms.data()); const val = key === 'all' ? r.points : (r.cats[key] || {}).c;
              if (r && val > 0) { const c = await F.getCountFromServer(F.query(col, F.where(field, '>', val))); mine = { r, rank: c.data().count + 1 }; } }
          }
          cache[key] = { list, mine, at: Date.now() };
        }
        if (stopped || key !== tab) return;
        status.textContent = '🟢 متصل بقاعدة البيانات المحمية • آخر تحديث ' + new Date(cache[key].at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        draw(cache[key]);
      } catch (e) {
        if (stopped) return; status.textContent = '';
        body.innerHTML = ''; body.appendChild(h('div', { class: 'card center' }, h('div', { class: 'intro-icon' }, '📡'), h('h2', null, 'تعذّر الوصول إلى اللوحة العامة'),
          h('p', null, 'لا يوجد اتصال بالإنترنت أو أن الخدمة لا تستجيب الآن. نتائجك محفوظة في جهازك، وستُرسل إلى اللوحة عند عودة الاتصال.'),
          h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => load(true) }, '🔁 أعد المحاولة'), h('a', { class: 'btn', href: '#/board' }, 'لوحة الصدارة على هذا الجهاز'))));
      }
    }
    function draw({ list, mine }) {
      const cat = tab === 'all' ? null : tab;
      body.innerHTML = '';
      if (!list.length) { body.appendChild(h('p', { class: 'center muted' }, cat ? 'لا توجد نتائج في هذا القسم بعد.' : 'لا توجد نتائج بعد — كن أول من يظهر هنا!')); return; }
      const head = cat ? ['#', 'اللاعب', 'إجابات صحيحة', 'الدقة', 'آخر تحديث'] : ['#', 'اللاعب', 'النقاط', 'الألعاب', 'الدقة', 'آخر تحديث'];
      const row = (r, k) => {
        const cc = cat ? (r.cats[cat] || { q: 0, c: 0 }) : null;
        const acc = cat ? (cc.q ? Math.round(100 * cc.c / cc.q) : 0) : (r.answered ? Math.round(100 * r.correct / r.answered) : 0);
        const cells = cat ? [fmt(cc.c), toAr(acc) + '٪'] : [fmt(r.points), fmt(r.games), toAr(acc) + '٪'];
        const isMe = r.id === myUid;
        return h('tr', { class: isMe ? 'me' : '' }, h('td', null, ['🥇', '🥈', '🥉'][k] || toAr(k + 1)), h('td', null, h('span', { class: 'lb-av' }, r.avatar), ' ', r.name, isMe ? h('span', { class: 'chip small' }, 'أنت') : null),
          cells.map(c => h('td', null, c)), h('td', { class: 'muted small' }, r.t ? new Date(r.t).toLocaleDateString('ar-SA') : '—'));
      };
      const rows = list.map(row); if (mine) rows.push(h('tr', null, h('td', { colspan: head.length, class: 'center muted' }, '⋯')), row(mine.r, mine.rank - 1));
      body.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'board global-board' }, h('thead', null, h('tr', null, head.map(x => h('th', null, x)))), h('tbody', null, rows))));
      const myIdx = list.findIndex(r => r.id === myUid);
      body.appendChild(h('p', { class: 'muted small center' }, 'يظهر أعلى ' + toAr(100) + ' لاعب' + (myIdx >= 0 ? ' • مركزك: ' + toAr(myIdx + 1) : mine ? ' • مركزك: ' + toAr(mine.rank) : ' • العب لعبة لتظهر في اللوحة')));
    }
    drawTabs(); load();
  };
})(window);
