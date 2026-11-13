/* online.js — online rooms across devices with no server of our own: WebRTC peer-to-peer (free public PeerJS broker),
   with automatic fallback to a free public MQTT relay over secure WebSocket when a direct link is blocked.
   The host's browser is the authority (picks questions, keeps time, scores); guests only render and send answers. */
(function (W) {
  'use strict';
  const { h, toAr, Bank, Sound, shuffle, Profiles } = W.QP;
  const LIBS = { peer: ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'],
    qr: ['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js', 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'] };
  const PREFIX = 'msbq-room-';
  const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
  const fmt = n => toAr(Number(n).toLocaleString('en'));
  function loadOne(urls) { return urls.reduce((p, u) => p.catch(() => new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = rej; document.head.appendChild(s); })), Promise.reject()); }
  function needPeer() { return W.Peer ? Promise.resolve() : loadOne(LIBS.peer).then(() => { if (!W.Peer) throw new Error('nopeer'); }); }
  const ERR = {
    'browser-incompatible': 'متصفحك لا يدعم الاتصال المباشر (WebRTC). جرّب Chrome أو Safari حديثًا.',
    'peer-unavailable': 'لم نجد غرفة بهذا الرمز، أو أن المضيف أغلق الصفحة. تأكد من الرمز.',
    network: 'تعذّر الوصول إلى خادم الربط. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
    'server-error': 'خادم الربط المجاني لا يستجيب حاليًا. أعد المحاولة بعد قليل.',
    'socket-error': 'انقطع الاتصال بخادم الربط. أعد المحاولة.', 'socket-closed': 'انقطع الاتصال بخادم الربط. أعد المحاولة.',
    disconnected: 'انقطع الاتصال بخادم الربط.', webrtc: 'تعذّر إنشاء اتصال مباشر بين الجهازين (قد تمنعه شبكة العمل أو الجوال). جرّب شبكة أخرى.',
    nopeer: 'تعذّر تحميل مكتبة الاتصال (قد يكون الإنترنت مقطوعًا أو محجوبًا).', timeout: 'انتهت مهلة الاتصال. تأكد من الرمز وأن المضيف ما زال في صفحة الغرفة.'
  };
  const errText = e => ERR[(e && (e.type || e.message)) || ''] || ('حدث خطأ في الاتصال' + (e && e.type ? ' (' + e.type + ')' : ''));
  const joinLink = code => location.href.split('#')[0] + '#/online/join/' + code;

  // ---------------------------------------------------------------- transports
  // conn = { id, kind:'p2p'|'relay', send(m), close(), onData:fn, onClose:fn }
  LIBS.mqtt = ['https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js'];
  const BROKERS = ['wss://public.cloud.shiftr.io', 'wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  const TOPIC = code => 'musabaqat/v1/' + code;
  function needMqtt() { return W.mqtt ? Promise.resolve() : loadOne(LIBS.mqtt).then(() => { if (!W.mqtt) throw new Error('nopeer'); }); }
  function mqttClient(url) {
    return new Promise((res, rej) => {
      let c; try { c = W.mqtt.connect(url, { username: 'public', password: 'public', connectTimeout: 8000, reconnectPeriod: 0, clean: true }); } catch (e) { return rej(e); }
      const to = setTimeout(() => { try { c.end(true); } catch (e) {} rej(new Error('timeout')); }, 9000);
      c.once('connect', () => { clearTimeout(to); c.options.reconnectPeriod = 2000; res(c); });
      c.once('error', () => {});
    });
  }
  function mkConn(id, kind, send, close) { const c = { id, kind, open: true, send, onData: () => {}, onClose: () => {} }; c.close = () => { if (!c.open) return; c.open = false; try { close && close(); } catch (e) {} c.onClose(); }; return c; }
  const Net = {
    // host listens on PeerJS and on MQTT relays at the same time; ready when at least one works
    host(code, H) {
      let peer = null, alive = true; const clients = []; const relayConns = {}; let readyCalled = false, fails = 0; const total = 1 + 1;
      const ready = kind => { if (!readyCalled) { readyCalled = true; H.onReady(kind); } };
      const fail = e => { if (++fails >= total && !readyCalled) H.onError(e); };
      needPeer().then(() => {
        peer = new W.Peer(PREFIX + code, { debug: 0 });
        peer.on('open', () => { if (alive) ready('p2p'); });
        peer.on('error', e => { if (e.type === 'unavailable-id') { alive && H.onTaken(); return; } if (e.type === 'peer-unavailable' || e.type === 'webrtc') return; fail(e); });
        peer.on('disconnected', () => { if (alive) try { peer.reconnect(); } catch (e) {} });
        peer.on('connection', dc => {
          const c = mkConn(dc.peer, 'p2p', m => { if (dc.open) dc.send(m); }, () => dc.close());
          dc.on('open', () => H.onConn(c)); dc.on('data', m => c.onData(m)); dc.on('close', () => c.close());
        });
      }).catch(fail);
      needMqtt().then(() => Promise.all(BROKERS.map(u => mqttClient(u).then(cl => {
        if (!alive) return cl.end(true);
        clients.push(cl);
        cl.subscribe(TOPIC(code) + '/h', { qos: 0 });
        cl.on('message', (t, buf) => {
          let x; try { x = JSON.parse(buf.toString()); } catch (e) { return; }
          if (!x || typeof x.g !== 'string' || x.g.length > 40) return;
          let c = relayConns[x.g];
          if (x.bye) { if (c) c.close(); return; }
          if (!c) {
            const gid = x.g;
            c = relayConns[gid] = mkConn('r-' + gid, 'relay', m => cl.publish(TOPIC(code) + '/g/' + gid, JSON.stringify(m)), () => { delete relayConns[gid]; });
            c.seen = Date.now(); H.onConn(c);
          }
          c.seen = Date.now();
          if (x.m && x.m.t !== 'ping') c.onData(x.m);
        });
        ready('relay');
      }, () => null))).then(r => { if (!clients.length) fail({ type: 'network' }); })).catch(fail);
      const hb = setInterval(() => { // one shared heartbeat on the room topic instead of one message per player
        Object.values(relayConns).forEach(c => { if (Date.now() - c.seen > 25000) c.close(); });
        if (Object.keys(relayConns).length) clients.forEach(cl => { try { cl.publish(TOPIC(code) + '/all', '{"t":"ping"}'); } catch (e) {} });
      }, 5000);
      return { broadcast(m) { const t = TOPIC(code) + '/all', d = JSON.stringify(m); clients.forEach(cl => { try { cl.publish(t, d); } catch (e) {} }); },
        close() { alive = false; clearInterval(hb); clients.forEach(cl => { try { cl.publish(TOPIC(code) + '/all', JSON.stringify({ t: 'closed' })); } catch (e) {} }); Object.values(relayConns).forEach(c => { try { c.send({ t: 'closed' }); } catch (e) {} }); setTimeout(() => { clients.forEach(c => { try { c.end(true); } catch (e) {} }); if (peer) peer.destroy(); }, 300); } };
    },
    // guest: try a direct WebRTC link first, fall back to the MQTT relay if it does not come up quickly
    join(code, G) {
      let alive = true, peer = null, cur = null, client = null;
      const attempt = (fn, ms) => new Promise((res, rej) => {
        let done = false; const to = setTimeout(() => { if (!done) { done = true; rej({ type: 'timeout' }); } }, ms);
        fn(c => { // c is open; wait for host's first reply
          if (done) return c.close();
          G.onOpen(c);
          const prev = c.onData; c.onData = m => { if (!done) { done = true; clearTimeout(to); res(c); } prev(m); };
        }, e => { if (!done) { done = true; clearTimeout(to); rej(e); } });
      });
      const viaPeer = (ok, bad) => needPeer().then(() => {
        peer = new W.Peer({ debug: 0 });
        peer.on('error', e => bad(e));
        peer.on('open', () => {
          const dc = peer.connect(PREFIX + code, { reliable: true });
          const c = mkConn('p', 'p2p', m => { if (dc.open) dc.send(m); }, () => dc.close());
          dc.on('open', () => ok(c)); dc.on('data', m => c.onData(m)); dc.on('close', () => c.close()); dc.on('error', e => bad(e));
        });
      }).catch(bad);
      const viaRelay = url => (ok, bad) => needMqtt().then(() => mqttClient(url)).then(cl => {
        client = cl; const gid = Math.random().toString(36).slice(2, 12);
        const up = m => cl.publish(TOPIC(code) + '/h', JSON.stringify({ g: gid, m }));
        const c = mkConn('r', 'relay', up, () => { try { cl.publish(TOPIC(code) + '/h', JSON.stringify({ g: gid, bye: 1 })); } catch (e) {} setTimeout(() => cl.end(true), 200); });
        let seen = Date.now();
        cl.subscribe([TOPIC(code) + '/g/' + gid, TOPIC(code) + '/all'], { qos: 0 }, () => ok(c));
        cl.on('message', (t, buf) => { let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; } seen = Date.now(); if (m && m.t === 'closed') return c.close(); if (m && m.t !== 'ping') c.onData(m); });
        const hb = setInterval(() => { if (!c.open || cl.disconnecting || cl.disconnected) return clearInterval(hb); if (Date.now() - seen > 25000) { clearInterval(hb); c.close(); } else up({ t: 'ping' }); }, 5000);
      }).catch(bad);
      const cleanupPeer = () => { try { peer && peer.destroy(); } catch (e) {} peer = null; };
      // each public relay is tried in turn (the host listens on all of them), so a full or unreachable broker is skipped
      const relays = () => BROKERS.reduce((p, u) => p.catch(() => { if (!alive) throw { type: 'closed' }; try { client && client.end(true); } catch (e) {} client = null; return attempt(viaRelay(u), 9000); }), Promise.reject());
      attempt(viaPeer, 9000).catch(e1 => { cleanupPeer(); if (!alive) throw e1; return relays().catch(e2 => { throw { type: 'peer-unavailable' }; }); })
        .then(c => { cur = c; G.onReady(c); }, e => { if (alive) G.onError(e); });
      return { close() { alive = false; try { cur && cur.close(); } catch (e) {} cleanupPeer(); try { client && client.end(true); } catch (e) {} } };
    }
  };
  function errorCard(view, text, retry) {
    view.innerHTML = '';
    view.appendChild(h('div', { class: 'card center online-err' }, h('div', { class: 'intro-icon' }, '📡'), h('h2', null, 'تعذّر الاتصال'), h('p', null, text),
      h('p', { class: 'muted small' }, 'الألعاب الفردية والجماعية على جهاز واحد تعمل دائمًا دون إنترنت للربط.'),
      h('div', { class: 'row center' }, retry ? h('button', { class: 'btn primary', onclick: retry }, '🔁 أعد المحاولة') : null, h('a', { class: 'btn', href: '#/online' }, 'صفحة المسابقات أونلاين'), h('a', { class: 'btn ghost', href: '#/games' }, '🎮 الألعاب على جهاز واحد'))));
  }
  // players: already-ranked top rows; opt.total = room size, opt.mine = [score, rank] when "me" is outside the shown rows
  function scoreTable(players, me, opt) {
    opt = opt || {}; const cap = opt.cap || 15;
    const l = players.slice().sort((a, b) => b.score - a.score).slice(0, cap);
    const total = opt.total || players.length;
    const row = (p, k) => h('div', { class: 'lb-row' + (p.id === me ? ' me' : '') + (p.left ? ' left' : '') }, h('span', { class: 'lb-rank' }, ['🥇', '🥈', '🥉'][k] || toAr(k + 1)), h('span', { class: 'lb-av' }, p.avatar || '👤'), h('b', null, p.name + (p.left ? ' (غادر)' : '')), p.via === 'relay' ? h('span', { class: 'lb-via', title: 'عبر وسيط' }, '☁️') : p.via === 'p2p' ? h('span', { class: 'lb-via', title: 'اتصال مباشر' }, '⚡') : null, h('span', { class: 'lb-sc' }, fmt(p.score)), p.answered != null ? h('span', { class: 'lb-st' }, p.answered ? '✔' : '…') : null);
    const rows = l.map((p, k) => row(p, p.rank != null ? p.rank - 1 : k));
    const inTop = l.some(p => p.id === me);
    if (!inTop && opt.mine) rows.push(h('div', { class: 'lb-gap' }, '⋯'), row({ id: me, name: 'أنت', avatar: Profiles.active.avatar, score: opt.mine[0] }, opt.mine[1] - 1));
    if (total > l.length) rows.push(h('div', { class: 'muted small center' }, 'إجمالي اللاعبين: ' + toAr(total)));
    return h('div', { class: 'live-board' }, rows);
  }
  function qView(m, onPick) {
    const card = h('div', { class: 'q-card online-q' });
    const c = Bank.cat(m.q.category);
    card.appendChild(h('div', { class: 'q-head' }, h('span', { class: 'chip' }, (c ? c.icon + ' ' + c.name : '') + (m.q.subcategory ? ' • ' + m.q.subcategory : '')), h('span', { class: 'chip' }, 'السؤال ' + toAr(m.i + 1) + ' من ' + toAr(m.n))));
    const bar = h('div', { class: 'tbar' }, h('i')); card.appendChild(bar);
    card.appendChild(h('h2', { class: 'q-text' }, m.q.question));
    const box = h('div', { class: 'options' + (m.q.type === 'tf' ? ' tf' : '') });
    const btns = m.q.options.map((o, i) => h('button', { class: 'opt', 'data-i': i, onclick: () => { if (card.dataset.locked) return; card.dataset.locked = 1; btns.forEach(b => b.disabled = true); btns[i].classList.add('picked'); onPick(i); } }, h('span', { class: 'opt-key' }, m.q.type === 'tf' ? '' : 'أبجد'[i] || ''), h('span', null, o)));
    btns.forEach(b => box.appendChild(b)); card.appendChild(box);
    const status = h('div', { class: 'muted center small online-status' }); card.appendChild(status);
    const t0 = Date.now(); const dur = m.dur * 1000;
    const tick = setInterval(() => { const left = Math.max(0, dur - (Date.now() - t0)); bar.firstChild.style.width = (100 * left / dur) + '%'; if (left <= 0) { clearInterval(tick); if (!card.dataset.locked) { card.dataset.locked = 1; btns.forEach(b => b.disabled = true); status.textContent = '⌛ انتهى الوقت'; } } }, 100);
    return { card, status, stop: () => clearInterval(tick), reveal(ans, mine) { clearInterval(tick); card.dataset.locked = 1; btns.forEach((b, i) => { b.disabled = true; if (i === ans) b.classList.add('right'); else if (i === mine) b.classList.add('wrong'); }); } };
  }
  function revealBox(m, mine) {
    const ok = mine === m.answer;
    return h('div', { class: 'feedback ' + (ok ? 'good' : 'bad') }, h('div', { class: 'fb-title' }, mine == null ? '⌛ لم تُجب' : ok ? '✔ إجابة صحيحة' + (m.gained ? ' +' + toAr(m.gained) : '') : '✘ إجابة خاطئة'),
      !ok ? h('div', { class: 'fb-answer' }, h('b', null, 'الإجابة الصحيحة: '), m.options[m.answer]) : null, m.explanation ? h('div', { class: 'fb-exp' }, m.explanation) : null,
      h('div', { class: 'source' }, h('div', null, h('b', null, 'المصدر: '), m.source || '—')));
  }
  function finalView(view, ranking, me, title, onAgain, info) {
    info = info || {}; let mine = ranking.findIndex(p => p.id === me);
    const myScore = mine >= 0 ? ranking[mine].score : info.mine ? info.mine[0] : 0; if (mine < 0 && info.mine) mine = info.mine[1] - 1;
    const total = info.total || ranking.length;
    Sound.win();
    view.appendChild(h('div', { class: 'card result online-result' }, h('div', { class: 'intro-icon' }, mine === 0 ? '👑' : '🏁'), h('h1', null, 'انتهت المسابقة'),
      mine >= 0 ? h('p', null, 'مركزك: ' + toAr(mine + 1) + ' من ' + toAr(total) + ' — ' + fmt(myScore) + ' نقطة') : null,
      h('div', { class: 'podium' }, ranking.slice(0, 3).map((p, k) => h('div', { class: 'pod p' + k }, h('div', null, ['🥇', '🥈', '🥉'][k]), h('b', null, (p.avatar || '') + ' ' + p.name), h('span', null, fmt(p.score))))),
      scoreTable(ranking, me, { cap: 30, total, mine: info.mine }),
      h('div', { class: 'row center' }, onAgain ? h('button', { class: 'btn primary', onclick: onAgain }, '🔁 جولة جديدة بنفس الغرفة') : null, h('a', { class: 'btn', href: '#/profile' }, '👤 ملفي'), h('a', { class: 'btn ghost', href: '#/online' }, '📡 غرفة أخرى'))));
  }

  // ================================================================ landing
  function landing(view) {
    const code = h('input', { class: 'inp code-in', placeholder: 'رمز الغرفة', maxlength: 5, dir: 'ltr', oninput: e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } });
    const pr = Profiles.active;
    view.appendChild(h('div', { class: 'card intro online-intro' }, h('div', { class: 'intro-icon' }, '📡'), h('h1', null, 'مسابقات أونلاين بين الأجهزة'),
      h('p', null, 'أنشئ غرفة على جهازك، وشارك رمزها أو رابطها أو رمز QR، فينضم أصدقاؤك من جوالاتهم وتتنافسون على نفس الأسئلة في الوقت نفسه مع لوحة نتائج مباشرة.'),
      h('p', { class: 'muted small' }, 'تلعب باسم: ' + pr.avatar + ' ' + pr.name + ' — ', h('a', { href: '#/profile' }, 'غيّر ملفك')),
      h('div', { class: 'online-choice' },
        h('div', { class: 'oc' }, h('h2', null, '🏠 أنشئ غرفة'), h('p', { class: 'muted small' }, 'أنت المضيف: تختار القسم وعدد الأسئلة والوقت، وتبقى الصفحة مفتوحة طوال المسابقة.'), h('a', { class: 'btn primary big', id: 'hostBtn', href: '#/online/host' }, 'إنشاء غرفة')),
        h('div', { class: 'oc' }, h('h2', null, '🔑 انضم إلى غرفة'), code, h('button', { class: 'btn big', id: 'joinBtn', onclick: () => { if (code.value.length >= 4) location.hash = '#/online/join/' + code.value; } }, 'انضمام'))),
      h('p', { class: 'muted small' }, 'يتم الربط مباشرة بين الأجهزة (WebRTC) عبر خادم ربط مجاني عام، وإن منعت الشبكة الاتصال المباشر ننتقل تلقائيًا إلى وسيط عام مجاني. لا حاجة لحسابات، ولا تُرسل إلا الأسماء والأسئلة والإجابات.')));
  }

  // ================================================================ host
  function host(view, setRunning) {
    const me = 'host'; let net = null, code = null, stopped = false;
    const P = { [me]: { id: me, name: Profiles.active.name, avatar: Profiles.active.avatar, score: 0, correct: 0, conn: null } };
    let game = null; // {qs, i, s, answers:{id:{choice,t}}, qStart, timer, log, phase}
    const R = { stop() { stopped = true; clearTimeout(game && game.timer); try { broadcast({ t: 'closed' }); } catch (e) {} if (net) net.close(); } };
    setRunning(R);
    view.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ إنشاء الغرفة…'));
    function list() { return Object.values(P).filter(p => !p.gone); }
    function pub() { return list().map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: Math.round(p.score), left: !!p.left, via: p.conn ? p.conn.kind : (p.id === me ? 'host' : null), answered: game && game.phase === 'q' ? !!(game.answers[p.id]) : null })); }
    function send(p, m) { if (p.conn && p.conn.open) try { p.conn.send(m); } catch (e) {} }
    function broadcast(m) { let relay = false; list().forEach(p => { if (p.conn && p.conn.kind === 'relay') relay = true; else send(p, m); }); if (relay && net && net.broadcast) net.broadcast(m); }
    function ranked() { const l = pub().sort((a, b) => b.score - a.score); l.forEach((p, k) => { p.rank = k + 1; }); return l; }
    function ptsMap(l, gained) { const o = {}; l.forEach(p => { o[p.id] = [p.score, p.rank, gained ? gained[p.id] || 0 : 0]; }); return o; }
    function start(attempt) {
      code = newCode(); let shown = false;
      const to = setTimeout(() => { if (!shown && !stopped) { net && net.close(); errorCard(view, errText({ type: 'timeout' }), () => { view.innerHTML = ''; start(0); }); } }, 25000);
      net = Net.host(code, {
        onReady: () => { clearTimeout(to); if (!stopped && !shown) { shown = true; lobby(); } },
        onTaken: () => { clearTimeout(to); net.close(); if (attempt < 3) start(attempt + 1); },
        onError: e => { clearTimeout(to); if (!stopped) errorCard(view, errText(e), () => { view.innerHTML = ''; start(0); }); },
        onConn: c => {
          c.onData = m => onMsg(c, m);
          c.onClose = () => { const p = P[c.id]; if (p && p.conn === c) { p.left = true; p.conn = null; if (!game || game.phase === 'end') delete P[c.id]; refresh(); } };
        }
      });
    }
    function onMsg(conn, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hello') {
        const name = String(m.name || 'لاعب').slice(0, 30), avatar = String(m.avatar || '👤').slice(0, 4);
        const prev = P[conn.id];
        P[conn.id] = Object.assign(prev || { id: conn.id, score: 0, correct: 0 }, { name, avatar, conn, left: false });
        send(P[conn.id], { t: 'welcome', code, you: conn.id, title: settingsTitle() });
        if (game && game.phase === 'q') send(P[conn.id], qMsg());
        refresh(); Sound.tick();
      } else if (m.t === 'answer' && game && game.phase === 'q' && m.i === game.i && !game.answers[conn.id] && P[conn.id] && P[conn.id].conn === conn) {
        game.answers[conn.id] = { choice: +m.choice, t: Date.now() }; refresh(); maybeEnd();
      }
    }
    let lobbyEls = null;
    function settingsTitle() { return lobbyEls ? lobbyEls.title() : ''; }
    function lobby() {
      view.innerHTML = '';
      const link = joinLink(code);
      const catSel = h('select', { class: 'inp', id: 'oCat' }, h('option', { value: '' }, '🌐 كل الأقسام'), Bank.cats.map(c => h('option', { value: c.id }, c.icon + ' ' + c.name)));
      const nSel = h('select', { class: 'inp', id: 'oN' }, [5, 10, 15, 20, 30].map(n => h('option', { value: n, selected: n === 10 }, toAr(n) + ' أسئلة')));
      const tSel = h('select', { class: 'inp', id: 'oT' }, [10, 15, 20, 30, 45].map(n => h('option', { value: n, selected: n === 20 }, toAr(n) + ' ثانية')));
      const dSel = h('select', { class: 'inp', id: 'oD' }, h('option', { value: '' }, 'كل المستويات'), [1, 2, 3].map(d => h('option', { value: d }, W.QP.DIFF[d])));
      const qr = h('div', { class: 'qr' });
      loadOne(LIBS.qr).then(() => { try { const q = W.qrcode(0, 'M'); q.addData(link); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) {} }).catch(() => {});
      const players = h('div', { class: 'lobby-players' });
      const startBtn = h('button', { class: 'btn primary big', id: 'oStart', onclick: () => begin() }, '▶ ابدأ المسابقة');
      lobbyEls = { players, title: () => (catSel.value ? Bank.cat(catSel.value).name : 'كل الأقسام') + ' • ' + toAr(nSel.value) + ' أسئلة' };
      view.appendChild(h('div', { class: 'card online-lobby' },
        h('h1', null, '🏠 غرفتك جاهزة'),
        h('div', { class: 'room-share' },
          h('div', null, h('div', { class: 'muted small' }, 'رمز الغرفة'), h('div', { class: 'room-code', id: 'roomCode', dir: 'ltr' }, code),
            h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => copy(link) }, '📋 نسخ رابط الانضمام'), navigator.share ? h('button', { class: 'btn small', onclick: () => navigator.share({ title: 'انضم إلى مسابقتي', text: 'انضم إلى غرفتي في منصة المسابقات العلمية — الرمز ' + code, url: link }).catch(() => {}) }, '📤 مشاركة') : null),
            h('div', { class: 'muted small', dir: 'ltr' }, link)),
          qr),
        h('div', { class: 'grid3' }, h('label', null, 'القسم', catSel), h('label', null, 'عدد الأسئلة', nSel), h('label', null, 'وقت السؤال', tSel), h('label', null, 'المستوى', dSel)),
        h('h2', null, '👥 اللاعبون'), players,
        h('div', { class: 'row center' }, startBtn),
        h('p', { class: 'muted small center' }, '⚠️ أبقِ هذه الصفحة مفتوحة: جهازك هو الذي يدير المسابقة، وإغلاقها ينهي الغرفة.')));
      lobbyEls.start = () => ({ cat: catSel.value, n: +nSel.value, dur: +tSel.value, diff: dSel.value ? +dSel.value : null });
      refresh();
    }
    function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => alert('تم نسخ الرابط'), () => prompt('انسخ الرابط:', t)); }
    let rTimer = null, rLast = 0;
    function refresh() { // coalesce bursts (many players answering at once) into at most ~3 updates per second
      if (rTimer) return; const wait = Math.max(0, 300 - (Date.now() - rLast));
      rTimer = setTimeout(() => { rTimer = null; rLast = Date.now(); doRefresh(); }, wait);
    }
    function doRefresh() {
      if (stopped) return;
      const l = ranked(); const answered = game && game.phase === 'q' ? Object.keys(game.answers).length : null;
      broadcast({ t: 'lobby', players: l.slice(0, 30), total: l.length, answered });
      if (lobbyEls && lobbyEls.players && (!game || game.phase === 'end')) { lobbyEls.players.innerHTML = ''; lobbyEls.players.appendChild(scoreTable(l.map(p => Object.assign({}, p, { answered: null })), me, { cap: 60, total: l.length })); lobbyEls.players.appendChild(h('p', { class: 'muted small' }, toAr(l.length) + ' لاعب في الغرفة' + (l.length < 2 ? ' — بانتظار انضمام الأصدقاء (يمكنك البدء وحدك للتجربة)' : ''))); }
      if (game && game.board) { game.board.innerHTML = ''; if (answered != null) game.board.appendChild(h('div', { class: 'muted small' }, 'أجاب ' + toAr(answered) + ' من ' + toAr(l.filter(p => !p.left).length))); game.board.appendChild(scoreTable(l, me, { cap: 15, total: l.length, mine: (() => { const x = l.find(p => p.id === me); return x ? [x.score, x.rank] : null; })() })); }
    }
    function begin() {
      const s = lobbyEls.start(); const cats = s.cat ? [s.cat] : Bank.cats.map(c => c.id);
      view.innerHTML = ''; view.appendChild(h('p', { class: 'center muted' }, '⏳ جارٍ تحميل الأسئلة…'));
      Bank.ensure(cats).then(() => {
        const f = { cats, types: ['mcq', 'tf'], balanceCats: cats.length > 1 }; if (s.diff) f.diff = [s.diff];
        let qs = Bank.pick(f, s.n); if (qs.length < s.n && s.diff) { delete f.diff; qs = Bank.pick(f, s.n); }
        if (!qs.length) { errorCard(view, 'لا توجد أسئلة مناسبة لهذا الاختيار.'); return; }
        list().forEach(p => { p.score = 0; p.correct = 0; }); Object.keys(P).forEach(k => { if (P[k].left) delete P[k]; });
        game = { qs: qs.map(q => { const ord = q.type === 'tf' ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i)); return { q, ord }; }), i: -1, s, log: [], phase: 'q' };
        broadcast({ t: 'start', n: qs.length, title: lobbyEls.title() });
        next();
      }).catch(() => errorCard(view, 'تعذّر تحميل ملفات الأسئلة.'));
    }
    function qMsg() { const { q, ord } = game.qs[game.i]; const left = Math.max(3, Math.round((game.s.dur * 1000 - (Date.now() - game.qStart)) / 1000)); return { t: 'q', i: game.i, n: game.qs.length, dur: left, q: { question: q.question, options: ord.map(k => q.options[k]), type: q.type, category: q.category, subcategory: q.subcategory, difficulty: q.difficulty } }; }
    let myQ = null;
    function next() {
      if (stopped) return;
      game.i++; if (game.i >= game.qs.length) return finish();
      game.phase = 'q'; game.answers = {}; game.qStart = Date.now();
      const m = qMsg(); broadcast(m);
      view.innerHTML = '';
      myQ = qView(m, i => { if (game.phase === 'q' && !game.answers[me]) { game.answers[me] = { choice: i, t: Date.now() }; myQ.status.textContent = 'تم تسجيل إجابتك…'; refresh(); maybeEnd(); } });
      const board = h('div'); game.board = board;
      view.appendChild(h('div', { class: 'online-game' }, h('div', { class: 'og-main' }, myQ.card), h('div', { class: 'og-side card' }, h('h3', null, '📊 النتائج المباشرة'), board, h('div', { class: 'row' }, h('button', { class: 'btn small ghost', id: 'skipBtn', onclick: () => endQ() }, '⏭ إنهاء السؤال الآن')))));
      refresh();
      game.timer = setTimeout(endQ, game.s.dur * 1000 + 800);
    }
    function maybeEnd() { const active = list().filter(p => !p.left); if (active.every(p => game.answers[p.id])) { clearTimeout(game.timer); game.timer = setTimeout(endQ, 600); } }
    function endQ() {
      if (!game || game.phase !== 'q') return; clearTimeout(game.timer); game.phase = 'reveal';
      const { q, ord } = game.qs[game.i]; const ans = ord.indexOf(q.answer); const dur = game.s.dur * 1000;
      const gained = {};
      list().forEach(p => { const a = game.answers[p.id]; let g = 0; if (a && a.choice === ans) { g = 100 + Math.round(100 * Math.max(0, 1 - (a.t - game.qStart) / dur)); p.score += g; p.correct++; } gained[p.id] = g; });
      game.log.push({ q, res: { correct: !!(game.answers[me] && game.answers[me].choice === ans) } });
      const base = { t: 'reveal', i: game.i, answer: ans, options: ord.map(k => q.options[k]), explanation: q.explanation || '', source: q.source || '', last: game.i === game.qs.length - 1 };
      const l = ranked(); broadcast(Object.assign({}, base, { players: l.slice(0, 15), total: l.length, pts: ptsMap(l, gained) }));
      const mine = game.answers[me] ? game.answers[me].choice : null;
      myQ.reveal(ans, mine); (mine === ans ? Sound.good() : Sound.bad());
      const main = view.querySelector('.og-main');
      const fb = revealBox(Object.assign({}, base, { gained: gained[me] }), mine); main.appendChild(fb); try { fb.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      main.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn primary', id: 'nextBtn', onclick: () => { clearTimeout(game.timer); next(); } }, base.last ? '🏁 النتائج النهائية' : 'السؤال التالي ←')));
      refresh();
      game.timer = setTimeout(next, 9000);
    }
    function finish() {
      game.phase = 'end';
      const ranking = ranked();
      broadcast({ t: 'end', ranking: ranking.slice(0, 30), total: ranking.length, pts: ptsMap(ranking) });
      const meP = P[me]; const rank = ranking.findIndex(p => p.id === me) + 1;
      const r = Profiles.record({ game: 'online', title: 'مسابقة أونلاين — ' + lobbyEls.title(), score: meP.score, log: game.log, online: { rank, players: ranking.length } });
      view.innerHTML = ''; finalView(view, ranking.slice(0, 30), me, '', () => { game = null; lobby(); }, { total: ranking.length, mine: [meP.score, rank] });
      if (r.newBadges.length) view.appendChild(badgeNote(r.newBadges));
    }
    start(0);
  }

  // ================================================================ guest
  function guest(view, code, setRunning) {
    code = String(code || '').toUpperCase();
    let net = null, conn = null, me = null, stopped = false, cur = null, myAns = null, log = [], lastQ = null, lastPts = null, title = '';
    setRunning({ stop() { stopped = true; if (net) net.close(); } });
    view.appendChild(h('div', { class: 'card center' }, h('div', { class: 'intro-icon' }, '🔑'), h('h2', null, 'جارٍ الانضمام إلى الغرفة ', h('span', { dir: 'ltr' }, code), '…'), h('p', { class: 'muted', id: 'joinStatus' }, 'نحاول الربط المباشر بجهاز المضيف، وإن تعذّر ننتقل تلقائيًا إلى الربط عبر وسيط.')));
    function retry() { view.innerHTML = ''; guest(view, code, setRunning); }
    net = Net.join(code, {
      onOpen: c => { conn = c; c.onData = onMsg; c.send({ t: 'hello', name: Profiles.active.name, avatar: Profiles.active.avatar }); },
      onReady: c => { conn = c; c.onClose = () => { if (!stopped && cur !== 'closed') errorCard(view, 'انتهت الغرفة: أغلق المضيف الصفحة أو انقطع الاتصال.', retry); }; },
      onError: e => { if (!stopped) errorCard(view, errText(e), retry); }
    });
    let boardEl = null, qv = null;
    function onMsg(m) {
      if (stopped || !m) return;
      if (m.t === 'welcome') { me = m.you; title = m.title || ''; if (cur !== 'q' && cur !== 'reveal') waiting([]); }
      else if (m.t === 'lobby') {
        if (!me) return;
        if (cur === 'lobby' || cur == null) waiting(m.players || [], m.total);
        else if (boardEl && cur === 'q') { boardEl.innerHTML = ''; if (m.answered != null) boardEl.appendChild(h('div', { class: 'muted small' }, 'أجاب ' + toAr(m.answered) + ' من ' + toAr(m.total))); boardEl.appendChild(scoreTable(m.players || [], me, { total: m.total, mine: lastPts })); }
      }
      else if (m.t === 'start') { log = []; title = m.title || title; }
      else if (m.t === 'q') {
        cur = 'q'; myAns = null; lastQ = m; view.innerHTML = '';
        qv = qView(m, i => { myAns = i; conn.send({ t: 'answer', i: m.i, choice: i }); qv.status.textContent = 'تم إرسال إجابتك… بانتظار البقية'; });
        boardEl = h('div');
        view.appendChild(h('div', { class: 'online-game' }, h('div', { class: 'og-main' }, qv.card), h('div', { class: 'og-side card' }, h('h3', null, '📊 النتائج المباشرة'), boardEl)));
      } else if (m.t === 'reveal') {
        if (!me) return;
        const pm = (m.pts || {})[me]; m.mine = myAns; m.gained = pm ? pm[2] : 0; if (pm) lastPts = [pm[0], pm[1]];
        cur = 'reveal'; if (qv) qv.reveal(m.answer, m.mine);
        (m.mine === m.answer ? Sound.good() : Sound.bad());
        if (lastQ) log.push({ q: { category: lastQ.q.category }, res: { correct: m.mine === m.answer } });
        const main = view.querySelector('.og-main'); if (main) { const fb = revealBox(m, m.mine); main.appendChild(fb); main.appendChild(h('p', { class: 'muted center small' }, m.last ? 'بانتظار النتائج النهائية…' : 'بانتظار السؤال التالي من المضيف…')); try { fb.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
        if (boardEl && m.players) { boardEl.innerHTML = ''; boardEl.appendChild(scoreTable(m.players, me, { total: m.total, mine: lastPts })); }
      } else if (m.t === 'end') {
        cur = 'end'; view.innerHTML = '';
        if (!me) return;
        const pm = (m.pts || {})[me] || [0, m.total || 1]; const total = m.total || m.ranking.length;
        const r = Profiles.record({ game: 'online', title: 'مسابقة أونلاين' + (title ? ' — ' + title : ''), score: pm[0], log, online: { rank: pm[1], players: total } });
        finalView(view, m.ranking, me, '', null, { total, mine: [pm[0], pm[1]] });
        view.appendChild(h('p', { class: 'muted center' }, 'ابقَ في الصفحة إن أراد المضيف بدء جولة جديدة.'));
        if (r.newBadges.length) view.appendChild(badgeNote(r.newBadges));
        cur = 'lobby-after';
      } else if (m.t === 'closed') { cur = 'closed'; errorCard(view, 'أغلق المضيف الغرفة.', null); }
    }
    function waiting(players, total) {
      if (cur === 'lobby-after' && !players.length) return;
      if (cur === 'lobby-after') { /* keep final results visible but update nothing */ return; }
      cur = 'lobby'; view.innerHTML = '';
      view.appendChild(h('div', { class: 'card center online-wait' }, h('div', { class: 'intro-icon' }, '✅'), h('h1', null, 'انضممت إلى الغرفة ', h('span', { dir: 'ltr' }, code)),
        h('p', null, 'بانتظار أن يبدأ المضيف المسابقة…'), players.length ? scoreTable(players.map(p => Object.assign(p, { answered: null })), me, { cap: 30, total: total || players.length }) : null,
        h('p', { class: 'muted small' }, 'تلعب باسم ' + Profiles.active.avatar + ' ' + Profiles.active.name + ' • نوع الربط: ' + (conn && conn.kind === 'p2p' ? 'مباشر بين الجهازين' : 'عبر وسيط عام'))));
    }
  }
  function badgeNote(list) { return h('div', { class: 'card center new-badges' }, h('h3', null, '🏅 إنجاز جديد!'), h('div', { class: 'badges' }, list.map(a => h('div', { class: 'ach on' }, h('div', { class: 'ach-i' }, a.icon), h('b', null, a.name), h('small', null, a.desc))))); }
  W.QP.badgeNote = badgeNote;
  W.QP.onlinePage = function (view, parts, setRunning) {
    if (parts[1] === 'host') host(view, setRunning);
    else if (parts[1] === 'join' && parts[2]) guest(view, parts[2], setRunning);
    else landing(view);
  };
})(window);
