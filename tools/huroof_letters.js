global.window=global; const fs=require('fs');
fs.readdirSync('data/bank').forEach(f=>require(require('path').resolve('data/bank',f)));
const all=[].concat(...Object.values(window.QUIZ_BANK));
const LET='ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
function ans(q){ if(q.type==='mcq'||q.type==='who') return q.options[q.answer]; if(q.type==='fill') return q.answer; return null;}
function first(a){ let s=String(a).replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,'').replace(/[﴿﴾«»"'()\[\]\-–—.:،,؛!؟?]/g,' ').trim();
 s=s.replace(/^(و?ال)(?=[\u0621-\u064A]{2})/,''); const c=s[0]; if(!c) return null; return c.replace(/[أإآٱء]/,'ا').replace('ى','ي').replace('ة','ه').replace('ؤ','و').replace('ئ','ي');}
const bad=/مما يأتي|مما يلي|التالي|الآتي|الآتية|التالية|ليس من|ليست من|أيّ هذه|أي هذه|ما عدا|عدا|باستثناء|جميع ما سبق|كل ما سبق/;
const m={}; LET.forEach(l=>m[l]={n:0,cats:new Set()});
all.forEach(q=>{const a=ans(q); if(!a||bad.test(q.question)) return; if(String(a).split(/\s+/).length>4||/^\d/.test(a)) return; const c=first(a); if(m[c]){m[c].n++;m[c].cats.add(q.category);}});
LET.forEach(l=>console.log(l,m[l].n,m[l].cats.size));
