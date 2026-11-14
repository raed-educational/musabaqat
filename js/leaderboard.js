/* leaderboard.js — global public leaderboard with no accounts: each profile publishes one RETAINED record on a public MQTT relay
   (topic musabaqat/lb/v1/<profileId>); the page subscribes to musabaqat/lb/v1/+ on every reachable relay and merges the records. */
(function (W) {
  'use strict';
  const { h, toAr, Bank, Profiles, LS } = W.QP;
  const BROKERS = [['wss://public.cloud.shiftr.io', 'shiftr.io'], ['wss://broker.emqx.io:8084/mqtt', 'EMQX'], ['wss://broker.hivemq.com:8884/mqtt', 'HiveMQ']];
  const MQTT_JS = ['https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js'];
  const BASE = 'musabaqat/lb/v1/';
  const CAT_IDS = (W.QUIZ_CATEGORIES || []).map(c => c.id);
  const fmt = n => toAr(Number(n).toLocaleString('en'));
  function loadOne(urls) { return urls.reduce((p, u) => p.catch(() => new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = rej; document.head.appendChild(s); })), Promise.reject()); }
  const needMqtt = () => W.mqtt ? Promise.resolve() : loadOne(MQTT_JS).then(() => { if (!W.mqtt) throw new Error('nolib'); });
  function connect(url) {
    return new Promise((res, rej) => {
      let c; try { c = W.mqtt.connect(url, { username: 'public', password: 'public', connectTimeout: 8000, reconnectPeriod: 0, clean: true }); } catch (e) { return rej(e); }
      const to = setTimeout(() => { try { c.end(true); } catch (e) {} rej(new Error('timeout')); }, 9000);
      c.once('connect', () => { clearTimeout(to); res(c); }); c.on('error', () => {});
    });
  }
  // ---------------------------------------------------------------- sanitising
  const stripTags = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[<>&"'`\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  const int = (v, max) => { v = Math.floor(Number(v)); return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0; };
  function clean(topicId, raw) {
    if (!raw || raw.length > 4096) return null;
    let r; try { r = JSON.parse(raw); } catch (e) { return null; }
    if (!r || typeof r !== 'object' || r.v !== 1 || r.id !== topicId || !/^[a-z0-9]{6,24}$/.test(topicId)) return null;
    const name = stripTags(r.name).slice(0, 30); if (!name) return null;
    const avatar = [...stripTags(r.avatar)].slice(0, 2).join('') || '👤';
    const games = int(r.games, 100000); if (!games) return null;
    const questions = int(r.questions, games * 100), correct = int(r.correct, questions);
    // a game is worth at most a few thousand points in any mode; clamp anything beyond that
    const points = int(r.points, games * 5000), bestScore = int(r.bestScore, 20000);
    const cats = {}; if (r.cats && typeof r.cats === 'object') CAT_IDS.forEach(id => { const c = r.cats[id]; if (c) { const q = int(c.q, questions), k = int(c.c, Math.min(q, correct)); if (q) cats[id] = { q, c: k }; } });
    let t = Number(r.t); if (!Number.isFinite(t) || t > Date.now() + 864e5 || t < 1.7e12) return null;
    return { id: topicId, name, avatar, games, questions, correct, points, bestScore, cats, wins: int(r.wins, games), t };
  }
  // ---------------------------------------------------------------- publishing (debounced, all reachable relays)
  const enabled = () => LS.get('lbPublish', true);
  function record(p) {
    const cats = {}; Object.entries(p.cats || {}).forEach(([k, v]) => { if (CAT_IDS.includes(k) && v && v.q) cats[k] = { q: v.q, c: v.c }; });
    return { v: 1, id: p.id, name: String(p.name || 'لاعب').slice(0, 30), avatar: p.avatar, points: p.points, games: p.games, questions: p.questions, correct: p.correct, bestScore: p.bestScore, cats, wins: (p.online || {}).wins || 0, t: Date.now() };
  }
  function publishAll(topic, payload) {
    return needMqtt().then(() => Promise.all(BROKERS.map(([u, label]) => connect(u).then(c => new Promise(res => {
      c.publish(topic, payload, { retain: true, qos: 1 }, err => { setTimeout(() => { try { c.end(); } catch (e) {} }, 300); res(err ? null : label); });
      setTimeout(() => res(null), 6000);
    }), () => null)))).then(r => r.filter(Boolean));
  }
  let timer = null;
  const GlobalLB = {
    enabled, BROKERS,
    setEnabled(v) { LS.set('lbPublish', !!v); if (v) this.schedule(0); else this.unpublish(); },
    publishNow(p) { p = p || Profiles.active; if (!enabled() || !p || !/^[a-z0-9]{6,24}$/.test(p.id) || !p.games) return Promise.resolve([]); return publishAll(BASE + p.id, JSON.stringify(record(p))).then(ok => { LS.set('lbLast', { t: Date.now(), ok }); return ok; }); },
    schedule(ms) { clearTimeout(timer); timer = setTimeout(() => this.publishNow().catch(() => {}), ms == null ? 2500 : ms); },
    unpublish(p) { p = p || Profiles.active; return publishAll(BASE + p.id, '').catch(() => []); }, // empty retained payload deletes the record
    last() { return LS.get('lbLast', null); }
  };
  // auto-publish whenever stats/name/avatar change
  const _record = Profiles.record.bind(Profiles); Profiles.record = function (rec) { const r = _record(rec); GlobalLB.schedule(); return r; };
  const _update = Profiles.update.bind(Profiles); Profiles.update = function (fn) { const r = _update(fn); if (r && r.games) GlobalLB.schedule(); return r; };
  W.QP.GlobalLB = GlobalLB;

  // ---------------------------------------------------------------- page
  W.QP.globalPage = function (view, setRunning, params) {
    const me = Profiles.active; const recs = {}; const clients = []; let stopped = false; let tab = params && params.cat && CAT_IDS.includes(params.cat) ? params.cat : 'all';
    setRunning({ stop() { stopped = true; clients.forEach(c => { try { c.end(true); } catch (e) {} }); } });
    const status = h('div', { class: 'muted small', id: 'lbStatus' }, '⏳ جارٍ الاتصال بخوادم اللوحة العامة…');
    const tabs = h('div', { class: 'chips lb-tabs' });
    const body = h('div', { id: 'lbBody' }, h('p', { class: 'center muted' }, '⏳ جارٍ جمع النتائج…'));
    view.appendChild(h('div', { class: 'card' }, h('h1', null, '🌍 لوحة الصدارة العامة'),
      h('p', { class: 'muted' }, 'نتائج اللاعبين من كل الأجهزة، بدون أي تسجيل. تظهر نتيجتك هنا تلقائيًا بعد أن تلعب، ويمكنك إيقاف ذلك من ', h('a', { href: '#/profile' }, 'ملفي'), '.'),
      !enabled() ? h('p', { class: 'chip' }, '⏸ نشر نتيجتك متوقف حاليًا من ملفك') : null, status, tabs));
    view.appendChild(body);
    function drawTabs() {
      tabs.innerHTML = '';
      [['all', '🏆 الكل']].concat(Bank.cats.map(c => [c.id, c.icon + ' ' + c.name])).forEach(([id, label]) => tabs.appendChild(h('button', { class: 'chip' + (tab === id ? ' on' : ''), 'data-tab': id, onclick: () => { tab = id; drawTabs(); draw(); } }, label)));
    }
    let drawT = null; const drawSoon = () => { if (!drawT) drawT = setTimeout(() => { drawT = null; draw(); }, 250); };
    function draw() {
      if (stopped) return;
      let list = Object.values(recs);
      const cat = tab === 'all' ? null : tab;
      if (cat) list = list.filter(r => r.cats[cat] && r.cats[cat].c > 0).sort((a, b) => b.cats[cat].c - a.cats[cat].c || (b.cats[cat].c / b.cats[cat].q) - (a.cats[cat].c / a.cats[cat].q));
      else list.sort((a, b) => b.points - a.points || b.correct - a.correct);
      body.innerHTML = '';
      if (!list.length) { body.appendChild(h('p', { class: 'center muted' }, cat ? 'لا توجد نتائج في هذا القسم بعد.' : 'لا توجد نتائج بعد — كن أول من يظهر هنا!')); return; }
      const myIdx = list.findIndex(r => r.id === me.id);
      const top = list.slice(0, 100);
      const head = cat ? ['#', 'اللاعب', 'إجابات صحيحة', 'الدقة', 'آخر تحديث'] : ['#', 'اللاعب', 'النقاط', 'الألعاب', 'الدقة', 'آخر تحديث'];
      const row = (r, k) => {
        const acc = cat ? (r.cats[cat].q ? Math.round(100 * r.cats[cat].c / r.cats[cat].q) : 0) : (r.questions ? Math.round(100 * r.correct / r.questions) : 0);
        const cells = cat ? [fmt(r.cats[cat].c), toAr(acc) + '٪'] : [fmt(r.points), fmt(r.games), toAr(acc) + '٪'];
        return h('tr', { class: r.id === me.id ? 'me' : '' }, h('td', null, ['🥇', '🥈', '🥉'][k] || toAr(k + 1)), h('td', null, h('span', { class: 'lb-av' }, r.avatar), ' ', r.name, r.id === me.id ? h('span', { class: 'chip small' }, 'أنت') : null),
          cells.map(c => h('td', null, c)), h('td', { class: 'muted small' }, new Date(r.t).toLocaleDateString('ar-SA')));
      };
      const rows = top.map(row); if (myIdx >= 100) rows.push(h('tr', null, h('td', { colspan: head.length, class: 'center muted' }, '⋯')), row(list[myIdx], myIdx));
      body.appendChild(h('table', { class: 'board global-board' }, h('thead', null, h('tr', null, head.map(x => h('th', null, x)))), h('tbody', null, rows)));
      body.appendChild(h('p', { class: 'muted small center' }, 'عدد اللاعبين في اللوحة: ' + fmt(list.length) + (myIdx >= 0 ? ' • مركزك: ' + toAr(myIdx + 1) : me.games ? ' • لم تظهر نتيجتك بعد' : ' • العب لعبة لتظهر في اللوحة')));
    }
    drawTabs();
    const ok = [];
    needMqtt().then(() => Promise.all(BROKERS.map(([u, label]) => connect(u).then(c => {
      if (stopped) return c.end(true);
      clients.push(c); ok.push(label);
      c.on('message', (topic, buf) => {
        const id = topic.slice(BASE.length); if (!id || id.includes('/')) return;
        if (!buf || !buf.length) { delete recs[id]; return drawSoon(); }
        const r = clean(id, buf.toString()); if (!r) return;
        if (!recs[id] || recs[id].t <= r.t) { recs[id] = r; drawSoon(); }
      });
      c.subscribe(BASE + '+', { qos: 1 }); setTimeout(() => { if (!stopped) draw(); }, 3000); // retained records arrive right away; show the empty state if there are none
      status.textContent = '🟢 متصل بـ ' + ok.join(' و ') + ' — تُحدَّث اللوحة مباشرة';
    }, () => null)))).then(() => {
      if (stopped) return;
      if (!ok.length) {
        status.textContent = '';
        body.innerHTML = ''; body.appendChild(h('div', { class: 'card center' }, h('div', { class: 'intro-icon' }, '📡'), h('h2', null, 'تعذّر الوصول إلى اللوحة العامة'),
          h('p', null, 'خوادم اللوحة المجانية لا تستجيب الآن، أو أن شبكتك تمنع الاتصال بها. نتائجك محفوظة في جهازك، وستظهر في اللوحة العامة عند عودة الاتصال.'),
          h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => { location.hash = '#/global?r=' + Date.now(); } }, '🔁 أعد المحاولة'), h('a', { class: 'btn', href: '#/board' }, 'لوحة الصدارة على هذا الجهاز'))));
        return;
      }
      setTimeout(() => { if (!stopped) draw(); }, 4000);
    }).catch(() => { status.textContent = '✘ تعذّر تحميل مكتبة الاتصال. تحقق من الإنترنت ثم أعد المحاولة.'; body.innerHTML = ''; });
  };
})(window);
