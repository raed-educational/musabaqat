// يولّد أسئلة سهلة من جداول حقائق بسيطة (المشتّتات تُختار من بقية الجدول) -> tools/school/<cat>-tables.txt
// Usage: node tools/school/gen/tables.js   ثم   node tools/build_school.js
const fs = require('fs'), path = require('path');
let seed = 2026; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick3 = (pool, not) => { const c = pool.filter(x => x !== not && !String(not).split('/').includes(x)); const out = []; while (out.length < 3 && c.length) { const i = Math.floor(rnd() * c.length); out.push(c.splice(i, 1)[0]); } return out; };
const out = {};
function table(cat, sub, src, rows, qf, expl, opts) {
  opts = opts || {};
  const L = (out[cat] = out[cat] || []);
  L.push('#sub: ' + sub, '#src: ' + src);
  const pool = rows.map(r => r[1]);
  rows.forEach(r => { const ds = (r[2] && r[2].length === 3) ? r[2] : pick3(opts.pool || pool, r[1]); L.push([qf(r[0]), r[1], ...ds, expl ? expl(r) : ''].join(' | ')); });
}
const D = require('./data.js');
D(table);
Object.entries(out).forEach(([cat, lines]) => fs.writeFileSync(path.join(__dirname, '..', cat + '-tables.txt'), '// مولّد آليًا من tools/school/gen/data.js — لا تعدّل يدويًا\n#cat: ' + cat + '\n' + lines.join('\n') + '\n'));
console.log(Object.entries(out).map(([c, l]) => c + ':' + l.filter(x => !x.startsWith('#')).length).join(' '));
