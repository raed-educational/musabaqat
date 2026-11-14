// Builds the curated easy question set for المرحلة المتوسطة (curated:'school').
// Source: tools/school/<cat>.txt  (one question per line; easy to append more later, e.g. from a book)
//   #sub: اسم القسم الفرعي          -> sets subcategory for following lines
//   #src: المصدر الافتراضي           -> default source for following lines
//   #level: ibtidai|mutawassit       -> stage (default mutawassit)
//   سؤال | الإجابة الصحيحة | خطأ1 | خطأ2 | خطأ3 | الشرح | المصدر(اختياري)
//   صح: عبارة | الشرح | المصدر   /   خطأ: عبارة | الشرح | المصدر      (صح أو خطأ)
// The correct answer is ALWAYS written first; options are shuffled deterministically.
// Output: data/school/<cat>.js (window.QUIZ_SCHOOL[cat]), data/school-manifest.js, data/huroof-school.js
// Usage: node tools/build_school.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const CATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/categories.json'), 'utf8')).map(c => c.id);
const strip = s => String(s || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
const norm = s => strip(s).replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u064A0-9a-z]/gi, '');
const manifest = {}, hur = {}; let errors = 0, total = 0; const report = [];
const seenQ = new Map();
function hash(s) { return crypto.createHash('sha1').update(s).digest('hex'); }
function firstLetter(a) {
  let s = strip(a).replace(/[﴿﴾«»"'()\[\]\-–—.:،,؛!؟?*]/g, ' ').trim();
  s = s.replace(/^ال(?=[\u0621-\u064A]{2})/, '');
  const c = s[0]; if (!c) return null;
  return c.replace(/[أإآٱء]/, 'ا').replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي');
}
const HBAD = /مما يأتي|مما يلي|التالي|الآتي|ليس من|ليست من|أي هذه|ما عدا|باستثناء|ما سبق|من من |أيّ|أي /;
const OUT = {}; CATS.forEach(c => OUT[c] = []);
// every tools/school/*.txt file: <cat>.txt defaults to that category; other files (e.g. a book) use "#cat: id"
const files = fs.readdirSync(path.join(ROOT, 'tools/school')).filter(f => f.endsWith('.txt')).sort();
files.forEach(fname => {
  let cat = CATS.includes(fname.replace(/\.txt$/, '')) ? fname.replace(/\.txt$/, '') : null;
  let sub = 'عام', src = 'منهج الدراسات الإسلامية — المرحلة المتوسطة (المملكة العربية السعودية)', level = 'mutawassit', tag = null;
  fs.readFileSync(path.join(ROOT, 'tools/school', fname), 'utf8').split(/\r?\n/).forEach((raw, ln) => {
    const line = raw.trim(); if (!line || line.startsWith('//')) return;
    const err = m => { errors++; console.error(`${fname}:${ln + 1}: ${m}\n   ${line}`); };
    let m;
    if ((m = line.match(/^#cat:\s*(\w+)$/))) { if (!CATS.includes(m[1])) return err('unknown cat'); cat = m[1]; return; }
    if ((m = line.match(/^#sub:\s*(.+)$/))) { sub = m[1].trim(); return; }
    if ((m = line.match(/^#src:\s*(.+)$/))) { src = m[1].trim(); return; }
    if ((m = line.match(/^#level:\s*(\w+)$/))) { level = m[1]; return; }
    if ((m = line.match(/^#tag:\s*(\S*)$/))) { tag = m[1] || null; return; }
    if (line.startsWith('#')) return;
    if (!cat) return err('no #cat');
    const p = line.split('|').map(s => s.trim());
    let q;
    if ((m = p[0].match(/^(صح|خطأ)\s*:\s*(.+)$/))) {
      q = { type: 'tf', question: m[2], options: ['صح', 'خطأ'], answer: m[1] === 'صح' ? 0 : 1, explanation: p[1] || '', source: p[2] ? (src.startsWith('كتاب') ? src + '؛ ' + p[2] : p[2]) : src };
    } else {
      if (p.length < 5) return err('needs question + 4 options');
      const opts = p.slice(1, 5);
      if (opts.some(o => !o)) return err('empty option');
      if (new Set(opts.map(norm)).size !== 4) return err('duplicate options');
      const h = hash(cat + p[0] + opts[0]);
      const order = [0, 1, 2, 3].map(i => [i, hash(h + i)]).sort((a, b) => a[1] < b[1] ? -1 : 1).map(x => x[0]);
      q = { type: 'mcq', question: p[0], options: order.map(i => opts[i]), answer: order.indexOf(0), explanation: p[5] || '', source: p[6] ? (src.startsWith('كتاب') ? src + '؛ ' + p[6] : p[6]) : src };
    }
    const key = norm(q.question) + '|' + norm(q.options[q.answer]);
    if (seenQ.has(key)) return err('duplicate of ' + seenQ.get(key));
    seenQ.set(key, fname + ':' + (ln + 1));
    const full = Object.assign({ category: cat, subcategory: sub, difficulty: 1 }, q, {
      id: 'sch-' + cat.slice(0, 3) + '-' + hash(cat + q.question + q.options[q.answer]).slice(0, 10),
      verified: false, verificationLevel: tag ? 'book' : 'school', curated: 'school', level, stage: level
    });
    if (tag) full.book = tag;
    OUT[cat].push(full);
    const k = [sub, full.type, 1, 0, level, 'school', tag || ''].join('|');
    manifest[cat] = manifest[cat] || {}; manifest[cat][k] = (manifest[cat][k] || 0) + 1;
    if (full.type === 'mcq' && !HBAD.test(full.question)) {
      const A = strip(full.options[full.answer]).trim();
      if (A.split(/\s+/).length <= 4 && A.length <= 40 && !/^[0-9٠-٩]/.test(A)) {
        const L = firstLetter(A);
        if (L && /[\u0621-\u064A]/.test(L)) (hur[L] = hur[L] || []).push([full.id, cat, 1, level, full.question, A, 0, full.source, sub, 1]);
      }
    }
  });
});
CATS.forEach(cat => {
  const out = OUT[cat];
  fs.writeFileSync(path.join(ROOT, 'data/school', cat + '.js'), '/* generated by tools/build_school.js from tools/school/*.txt */\n(window.QUIZ_SCHOOL=window.QUIZ_SCHOOL||{})[' + JSON.stringify(cat) + ']=' + JSON.stringify(out) + ';\n');
  total += out.length;
  const lv = {}; out.forEach(q => { lv[q.level] = (lv[q.level] || 0) + 1; if (q.book) lv.book = (lv.book || 0) + 1; });
  report.push(cat + ' ' + out.length + ' ' + JSON.stringify(lv));
});
fs.writeFileSync(path.join(ROOT, 'data/school-manifest.js'), '/* generated by tools/build_school.js — counts of the curated easy set (sub|type|diff|verified|stage|school) */\nwindow.QUIZ_SCHOOL_MANIFEST=' + JSON.stringify(manifest) + ';\n');
fs.writeFileSync(path.join(ROOT, 'data/huroof-school.js'), '/* generated by tools/build_school.js — curated easy rows for حروف/تحدي الحروف (10th field = 1 school) */\n(function(W){if(W.HUROOF_SCHOOL)return;var S=' + JSON.stringify(hur) + ';W.HUROOF_Q=W.HUROOF_Q||{};Object.keys(S).forEach(function(L){W.HUROOF_Q[L]=(W.HUROOF_Q[L]||[]).concat(S[L]);});W.HUROOF_SCHOOL=true;})(window);\n');
report.forEach(r => console.log(r));
console.log('TOTAL', total, 'huroof rows', Object.values(hur).reduce((a, b) => a + b.length, 0), 'errors', errors);
if (errors) process.exitCode = 1;
