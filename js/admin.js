/* admin.js — browse / filter / add / edit / delete / import / export questions (localStorage overlay + file export) */
(function (W) {
  'use strict';
  const { h, Bank, toAr, DIFF, TYPES, download, LS } = W.QP;
  const root = document.getElementById('adm');
  const PAGE = 50; let page = 0;
  Bank.ensure().then(init).catch(e => { root.innerHTML = 'تعذّر تحميل البيانات: ' + e.message; });

  function init() {
    root.innerHTML = '';
    const cat = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الأقسام'), Bank.cats.map(c => h('option', { value: c.id }, c.icon + ' ' + c.name)));
    const sub = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الفرعية'));
    const type = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الأنواع'), Object.entries(TYPES).map(([k, v]) => h('option', { value: k }, v)));
    const diff = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل المستويات'), [1, 2, 3].map(d => h('option', { value: d }, DIFF[d])));
    const ver = h('select', { class: 'inp' }, h('option', { value: '' }, 'كل الحالات'), h('option', { value: 'primary' }, 'موثّق من النص'), h('option', { value: 'reference' }, 'من مرجع مفتوح'), h('option', { value: 'none' }, 'بانتظار المراجعة'), h('option', { value: 'custom' }, 'المضافة/المعدلة محليًا'));
    const q = h('input', { class: 'inp', placeholder: '🔍 بحث في النص أو المصدر' });
    const list = h('div'); const info = h('div', { class: 'muted' });
    cat.addEventListener('change', () => { sub.innerHTML = ''; sub.appendChild(h('option', { value: '' }, 'كل الفرعية')); if (cat.value) Bank.subcats(cat.value).forEach(([s, n]) => sub.appendChild(h('option', { value: s }, s + ' (' + n + ')'))); page = 0; draw(); });
    [sub, type, diff, ver].forEach(x => x.addEventListener('change', () => { page = 0; draw(); })); q.addEventListener('input', () => { page = 0; draw(); });
    const fileIn = h('input', { type: 'file', accept: '.json,.csv', class: 'hidden', onchange: e => importFile(e.target.files[0]) });
    root.appendChild(h('h1', null, '🛠 إدارة بنك الأسئلة'));
    root.appendChild(h('p', { class: 'muted' }, 'التعديلات والإضافات تُحفظ في هذا المتصفح (localStorage)، ويمكن تصديرها JSON/CSV ثم دمجها في البنك الدائم عبر tools/build_bank.py (ضع ملف CSV في tools/imports).'));
    root.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => edit(null) }, '➕ سؤال جديد'), h('button', { class: 'btn', onclick: () => fileIn.click() }, '📥 استيراد JSON / CSV'), fileIn,
      h('button', { class: 'btn', onclick: () => download('questions-filtered.json', JSON.stringify(current(), null, 1)) }, '📤 تصدير النتائج JSON'),
      h('button', { class: 'btn', onclick: () => download('questions-filtered.csv', toCSV(current()), 'text/csv') }, '📤 تصدير CSV'),
      h('button', { class: 'btn ghost', onclick: () => download('local-changes.json', JSON.stringify({ custom: Bank.custom(), deleted: Bank.deleted() }, null, 1)) }, '💾 تصدير تعديلاتي المحلية'),
      h('button', { class: 'btn ghost', onclick: () => download('questions_template.csv', '\ufeff' + 'category,subcategory,type,difficulty,question,options,answer,explanation,source,verified\nfiqh,الصلاة,mcq,1,كم عدد ركعات صلاة الفجر؟,ركعتان|ثلاث|أربع|ركعة,ركعتان,بالإجماع,المغني لابن قدامة,false\n', 'text/csv') }, '📄 قالب CSV')));
    root.appendChild(h('div', { class: 'adm-grid' }, cat, sub, type, diff, ver, q)); root.appendChild(info); root.appendChild(list);
    function current() {
      const custom = new Set(Bank.custom().map(x => x.id)); const s = q.value.trim();
      return Bank.all().filter(x => (!cat.value || x.category === cat.value) && (!sub.value || x.subcategory === sub.value) && (!type.value || x.type === type.value) && (!diff.value || +x.difficulty === +diff.value)
        && (!ver.value || (ver.value === 'custom' ? custom.has(x.id) : (x.verificationLevel || (x.verified ? 'primary' : 'none')) === ver.value)) && (!s || (x.question + ' ' + (x.source || '') + ' ' + JSON.stringify(x.options || x.items || x.pairs || x.answer)).includes(s)));
    }
    function draw() {
      const all = current(); const pages = Math.max(1, Math.ceil(all.length / PAGE)); page = Math.min(page, pages - 1);
      info.textContent = 'النتائج: ' + toAr(all.length) + ' — الصفحة ' + toAr(page + 1) + ' من ' + toAr(pages);
      list.innerHTML = '';
      all.slice(page * PAGE, page * PAGE + PAGE).forEach(x => list.appendChild(h('div', { class: 'qrow' }, h('span', { class: 'tag light' }, (Bank.cat(x.category) || {}).icon + ' ' + TYPES[x.type]), h('div', null, h('div', { class: 'q' }, x.question), h('div', { class: 'muted small' }, (x.subcategory || '') + ' • ' + (x.source || 'بلا مصدر'))),
        h('span', { class: 'd' + x.difficulty }, DIFF[x.difficulty]), h('span', { class: 'badge ' + ({ primary: 'ok', reference: 'ref' }[x.verificationLevel] || 'pending') }, { primary: 'موثّق', reference: 'مرجع مفتوح' }[x.verificationLevel] || 'للمراجعة'),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => edit(x) }, '✏️'), h('button', { class: 'btn small bad', onclick: () => del(x) }, '🗑')))));
      list.appendChild(h('div', { class: 'row center' }, h('button', { class: 'btn small', disabled: page === 0, onclick: () => { page--; draw(); } }, '→ السابق'), h('button', { class: 'btn small', disabled: page >= pages - 1, onclick: () => { page++; draw(); } }, 'التالي ←')));
    }
    W.__admDraw = draw; draw();
    const m = location.hash.match(/edit=([^&]+)/); if (m) { const x = Bank.all().find(y => y.id === decodeURIComponent(m[1])); if (x) edit(x); }
  }
  function del(x) { if (!confirm('حذف هذا السؤال (محليًا)؟')) return; const d = Bank.deleted(); d.push(x.id); Bank.setDeleted(d); Bank.saveCustom(Bank.custom().filter(y => y.id !== x.id)); W.__admDraw(); }
  function upsert(x) { const c = Bank.custom().filter(y => y.id !== x.id); c.push(x); Bank.saveCustom(c); }
  function edit(x) {
    x = x ? JSON.parse(JSON.stringify(x)) : { id: 'loc-' + Date.now().toString(36), category: Bank.cats[0].id, subcategory: '', type: 'mcq', difficulty: 1, question: '', options: ['', '', '', ''], answer: 0, explanation: '', source: '', verified: false, verificationLevel: 'none' };
    const F = {};
    const cat = F.category = h('select', { class: 'inp' }, Bank.cats.map(c => h('option', { value: c.id, selected: c.id === x.category }, c.name)));
    const type = F.type = h('select', { class: 'inp' }, Object.entries(TYPES).map(([k, v]) => h('option', { value: k, selected: k === x.type }, v)));
    const sub = h('input', { class: 'inp', value: x.subcategory || '' }); const diff = h('select', { class: 'inp' }, [1, 2, 3].map(d => h('option', { value: d, selected: +x.difficulty === d }, DIFF[d])));
    const qq = h('textarea', { class: 'inp' }); qq.value = x.type === 'who' ? (x.clues || []).join('\n') : x.question;
    const body = h('textarea', { class: 'inp' }); const ans = h('input', { class: 'inp' });
    const exp = h('textarea', { class: 'inp' }); exp.value = x.explanation || ''; const src = h('input', { class: 'inp', value: x.source || '' });
    const help = h('div', { class: 'muted small full' });
    function fillBody() {
      const t = type.value;
      if (t === 'mcq' || t === 'who') { body.value = (x.options || []).join('\n'); ans.value = x.options ? x.options[x.answer] || '' : ''; help.textContent = 'الخيارات: كل خيار في سطر. الإجابة: انسخ نص الخيار الصحيح.' + (t === 'who' ? ' (نص السؤال = التلميحات، كل تلميح في سطر)' : ''); }
      else if (t === 'tf') { body.value = 'صح\nخطأ'; ans.value = x.answer === 1 ? 'خطأ' : 'صح'; help.textContent = 'الإجابة: صح أو خطأ'; }
      else if (t === 'fill') { body.value = (x.accept || []).join('\n'); ans.value = x.answer || ''; help.textContent = 'الإجابة النموذجية، وفي المربع: صيغ مقبولة أخرى (سطر لكل صيغة).'; }
      else if (t === 'order') { body.value = (x.items || []).join('\n'); ans.value = ''; help.textContent = 'العناصر بالترتيب الصحيح، كل عنصر في سطر.'; }
      else if (t === 'match') { body.value = (x.pairs || []).map(p => p.join(' = ')).join('\n'); ans.value = ''; help.textContent = 'كل زوج في سطر بالشكل: يمين = يسار'; }
    }
    type.addEventListener('change', fillBody); fillBody();
    const dlg = h('div', { class: 'card', style: { position: 'fixed', inset: '5% 8%', overflow: 'auto', zIndex: 50 } },
      h('h2', null, x.question ? '✏️ تعديل سؤال' : '➕ سؤال جديد'), h('div', { class: 'ed' }, h('label', null, 'القسم', cat), h('label', null, 'القسم الفرعي', sub), h('label', null, 'النوع', type), h('label', null, 'الصعوبة', diff),
        h('label', { class: 'full' }, 'نص السؤال', qq), h('label', { class: 'full' }, 'الخيارات / العناصر', body), help, h('label', { class: 'full' }, 'الإجابة الصحيحة', ans), h('label', { class: 'full' }, 'الشرح', exp), h('label', { class: 'full' }, 'المصدر (إلزامي: كتاب/سورة:آية/رقم الحديث…)', src)),
      h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => dlg.remove() }, 'إلغاء'), h('button', { class: 'btn primary', onclick: save }, '💾 حفظ')));
    document.body.appendChild(dlg);
    function save() {
      if (!src.value.trim()) return alert('المصدر إلزامي لكل سؤال.');
      const t = type.value, lines = body.value.split('\n').map(s => s.trim()).filter(Boolean);
      const out = { id: x.id, category: cat.value, subcategory: sub.value.trim(), type: t, difficulty: +diff.value, question: qq.value.trim(), explanation: exp.value.trim(), source: src.value.trim(), verified: false, verificationLevel: 'none', editedLocally: true };
      if (t === 'mcq' || t === 'who') { out.options = lines; out.answer = lines.indexOf(ans.value.trim()); if (out.answer < 0) return alert('الإجابة يجب أن تطابق أحد الخيارات.'); if (t === 'who') { out.clues = qq.value.split('\n').map(s => s.trim()).filter(Boolean); out.question = 'من أنا؟'; } }
      else if (t === 'tf') { out.options = ['صح', 'خطأ']; out.answer = ans.value.trim() === 'خطأ' ? 1 : 0; }
      else if (t === 'fill') { out.answer = ans.value.trim(); out.accept = [out.answer].concat(lines); }
      else if (t === 'order') { if (lines.length < 2) return alert('أدخل عنصرين على الأقل'); out.items = lines; }
      else if (t === 'match') { out.pairs = lines.map(l => l.split('=').map(s => s.trim())); if (out.pairs.some(p => p.length !== 2)) return alert('صيغة التوصيل: يمين = يسار'); }
      upsert(out); dlg.remove(); W.__admDraw();
    }
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = rows.shift().map(s => s.replace(/^\ufeff/, '').trim());
    return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').trim()])));
  }
  function fromRow(r, k) {
    const t = r.type || 'mcq'; const opts = (r.options || '').split('|').map(s => s.trim()).filter(Boolean);
    const q = { id: 'imp-' + Date.now().toString(36) + '-' + k, category: r.category, subcategory: r.subcategory || '', type: t, difficulty: +r.difficulty || 1, question: r.question, explanation: r.explanation || '', source: r.source || '', verified: false, verificationLevel: 'none' };
    if (t === 'mcq' || t === 'who') { q.options = opts; q.answer = /^\d+$/.test(r.answer) ? +r.answer : opts.indexOf(r.answer); if (t === 'who') { q.clues = r.question.split('|'); q.question = 'من أنا؟'; } }
    else if (t === 'tf') { q.options = ['صح', 'خطأ']; q.answer = r.answer === 'خطأ' || r.answer === '1' || r.answer === 'false' ? 1 : 0; }
    else if (t === 'fill') { q.answer = r.answer; q.accept = [r.answer].concat(opts); }
    else if (t === 'order') q.items = opts; else if (t === 'match') q.pairs = opts.map(o => o.split('='));
    return q;
  }
  function valid(q) { return q && Bank.cat(q.category) && q.question && q.source && (q.type !== 'mcq' || (q.options.length >= 2 && q.answer >= 0)); }
  function importFile(f) {
    if (!f) return; const rd = new FileReader();
    rd.onload = () => { let list = [];
      try { if (/\.csv$/i.test(f.name)) list = parseCSV(rd.result).map(fromRow); else { const j = JSON.parse(rd.result); list = Array.isArray(j) ? j : (j.custom || []); } } catch (e) { return alert('ملف غير صالح: ' + e.message); }
      const ok = list.filter(valid), bad = list.length - ok.length; const c = Bank.custom(); const ids = new Set(c.map(x => x.id)); ok.forEach(q => { q.id = q.id || 'imp-' + Math.random().toString(36).slice(2); if (!ids.has(q.id)) c.push(q); });
      Bank.saveCustom(c); alert('تم استيراد ' + ok.length + ' سؤال' + (bad ? '، ورُفض ' + bad + ' (بلا مصدر أو بيانات ناقصة)' : '')); W.__admDraw(); };
    rd.readAsText(f, 'utf-8');
  }
  function toCSV(list) {
    const e = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const rows = list.map(q => { const opts = q.type === 'order' ? q.items : q.type === 'match' ? q.pairs.map(p => p.join('=')) : q.type === 'fill' ? (q.accept || []).slice(1) : q.options || [];
      const ans = q.type === 'mcq' || q.type === 'who' || q.type === 'tf' ? q.options[q.answer] : q.type === 'fill' ? q.answer : '';
      return [q.category, q.subcategory, q.type, q.difficulty, q.type === 'who' ? q.clues.join('|') : q.question, opts.join('|'), ans, q.explanation, q.source, q.verified].map(e).join(','); });
    return '\ufeffcategory,subcategory,type,difficulty,question,options,answer,explanation,source,verified\n' + rows.join('\n');
  }
})(window);
