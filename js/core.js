/* core.js — bank access, storage, utilities (no build step, works from file:// and any sub-path) */
(function (W) {
  'use strict';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('qp_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('qp_' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('qp_' + k); } catch (e) {} }
  };

  // ---------- seeded RNG / shuffling
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shuffle(arr, rnd) { rnd = rnd || Math.random; const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- Arabic normalisation for typed answers
  function norm(s) {
    return String(s || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
      .replace(/^ال/, '').replace(/[^\u0621-\u064A0-9a-z ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function levenshtein(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
  function fillMatches(input, q) {
    const x = norm(input); if (!x) return false;
    return (q.accept || [q.answer]).some(a => { const y = norm(a); return x === y || (y.length >= 5 && levenshtein(x, y) <= 1); });
  }

  // ---------- question bank (lazy per-category files + local edits)
  // data/manifest.js -> QUIZ_CATEGORIES, QUIZ_MANIFEST {cat: {"sub|type|diff|v": n}}
  // data/bank/<cat>.js -> QUIZ_BANK[cat] = [...] (loaded on demand via <script>, works on file:// and any sub-path)
  const CATS = W.QUIZ_CATEGORIES || [];
  const MAN = W.QUIZ_MANIFEST || {};
  W.QUIZ_BANK = W.QUIZ_BANK || {};
  const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
  const loading = {};
  let _all = null;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed ' + src)); document.head.appendChild(s); }); }
  function match(q, f) {
    const st = q.stage || (W.quizStageOf && W.quizStageOf(q));
    return (!f.cats || !f.cats.length || f.cats.includes(q.category)) &&
      (!f.subs || !f.subs.length || f.subs.includes(q.subcategory)) &&
      (!f.types || !f.types.length || f.types.includes(q.type)) &&
      (!f.diff || (Array.isArray(f.diff) ? f.diff.includes(+q.difficulty) : +q.difficulty === +f.diff)) &&
      (!f.stage || st === f.stage) &&
      (!f.verifiedOnly || q.verified);
  }
  const Bank = {
    cats: CATS, cat: id => catById[id], manifest: MAN,
    loaded(id) { return !!W.QUIZ_BANK[id]; },
    ensure(ids) {
      ids = (ids && ids.length ? ids : CATS.map(c => c.id)).filter(id => !W.QUIZ_BANK[id]);
      return Promise.all(ids.map(id => loading[id] = loading[id] || loadScript('data/bank/' + id + '.js'))).then(() => { _all = null; });
    },
    custom() { return LS.get('custom', []); },
    saveCustom(list) { LS.set('custom', list); _all = null; },
    deleted() { return LS.get('deleted', []); },
    setDeleted(list) { LS.set('deleted', list); _all = null; },
    all() {
      if (_all) return _all;
      const del = new Set(this.deleted()); const custom = this.custom(); const cid = new Set(custom.map(q => q.id));
      const base = []; Object.values(W.QUIZ_BANK).forEach(list => list.forEach(q => { if (!del.has(q.id) && !cid.has(q.id)) base.push(q); }));
      _all = base.concat(custom.filter(q => !del.has(q.id)));
      if (W.quizStageOf) _all.forEach(q => { q.stage = W.quizStageOf(q); });
      return _all;
    },
    invalidate() { _all = null; },
    byCat(id) { return this.all().filter(q => q.category === id); },
    // counting works without loading the data (uses the manifest) + local custom questions
    count(f) {
      f = f || {}; let n = 0;
      const MANIFEST = f.stage ? (W.QUIZ_STAGE_MANIFEST || {}) : MAN;
      CATS.forEach(c => {
        if (f.cats && f.cats.length && !f.cats.includes(c.id)) return;
        Object.entries(MANIFEST[c.id] || {}).forEach(([k, v]) => { const [sub, type, diff, ver, stage] = k.split('|'); if (match({ category: c.id, subcategory: sub, type, difficulty: +diff, verified: ver === '1', stage: stage || undefined }, f)) n += v; });
      });
      this.custom().forEach(q => { if (match(q, f)) n++; });
      return n;
    },
    countVerified(cat) { let n = 0; Object.entries(MAN[cat] || {}).forEach(([k, v]) => { if (k.endsWith('|1')) n += v; }); return n; },
    subcats(id) { const m = {}; Object.entries(MAN[id] || {}).forEach(([k, v]) => { const s = k.split('|')[0]; m[s] = (m[s] || 0) + v; }); this.custom().forEach(q => { if (q.category === id) m[q.subcategory] = (m[q.subcategory] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); },
    diffCounts(id) { const m = { 1: 0, 2: 0, 3: 0 }; Object.entries(MAN[id] || {}).forEach(([k, v]) => { m[k.split('|')[2]] += v; }); return m; },
    filter(f) { f = f || {}; return this.all().filter(q => match(q, f)); },
    pick(f, n, rnd) {
      let list = shuffle(this.filter(f), rnd);
      if (f && f.balanceCats && f.cats && f.cats.length > 1) { // round-robin across categories
        const by = {}; list.forEach(q => (by[q.category] = by[q.category] || []).push(q));
        const keys = Object.keys(by); const out = []; let i = 0;
        while (out.length < list.length) { const k = keys[i++ % keys.length]; if (by[k].length) out.push(by[k].shift()); }
        list = out;
      }
      return n ? list.slice(0, n) : list;
    }
  };
  Bank.total = () => Bank.count({});

  // ---------- player / leaderboard
  const Player = {
    get name() { return LS.get('player', ''); }, set name(v) { LS.set('player', String(v || '').trim().slice(0, 30)); }
  };
  const Board = {
    all() { return LS.get('scores', []); },
    add(rec) { const l = this.all(); rec.date = new Date().toISOString(); l.push(rec); l.sort((a, b) => b.score - a.score); LS.set('scores', l.slice(0, 500)); return l.indexOf(rec); },
    forGame(id) { return this.all().filter(r => r.game === id); },
    clear() { LS.set('scores', []); }
  };

  // ---------- sound (WebAudio beeps, no assets)
  let actx = null;
  const Sound = {
    get on() { return LS.get('sound', true); }, set on(v) { LS.set('sound', !!v); },
    beep(freq, dur, type) { if (!this.on) return; try { actx = actx || new (W.AudioContext || W.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.12, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur); } catch (e) {} },
    good() { this.beep(660, .12); setTimeout(() => this.beep(880, .18), 110); },
    bad() { this.beep(200, .3, 'sawtooth'); },
    tick() { this.beep(1200, .03, 'square'); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, .2), i * 130)); },
    count() { this.beep(392, .12, 'sine'); },
    go() { this.beep(784, .22, 'sine'); },
    combo() { this.beep(880, .08); setTimeout(() => this.beep(1174, .14), 90); },
    fanfare() { [523, 659, 784, 1047, 784, 1319].forEach((f, i) => setTimeout(() => this.beep(f, .2), i * 120)); }
  };

  // ---------- DOM helper
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach(k => { if (k == null || k === false) return; e.appendChild(k.nodeType ? k : document.createTextNode(String(k))); });
    return e;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function download(name, text, mime) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime || 'application/json' })), download: name }); document.body.appendChild(a); a.click(); a.remove(); }

  W.QP = { LS, Bank, Player, Board, Sound, h, esc, toAr, shuffle, mulberry32, hashStr, norm, fillMatches, todayKey, download, DIFF: { 1: 'سهل', 2: 'متوسط', 3: 'صعب' },
    TYPES: { mcq: 'اختيار من متعدد', tf: 'صح أم خطأ', fill: 'أكمل الفراغ', order: 'ترتيب', match: 'توصيل', who: 'من أنا؟' } };
})(window);
