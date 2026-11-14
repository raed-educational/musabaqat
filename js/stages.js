/* stages.js — تصنيف كل سؤال إلى مرحلة دراسية.
   الحقول المستخدمة: الصعوبة (1/2/3) + القسم الفرعي + نوع السؤال + طول نص السؤال.
   القاعدة باختصار:
     ابتدائي: حقائق أساسية وصعوبة 1، أو أسئلة قصيرة عامة/مدرسية.
     متوسط:  صعوبة 1–2 عامة، أو أسئلة أطول قليلًا من المستوى الأساسي.
     ثانوي:  صعوبة 2–3، أو موضوعات أعمق (تفسير، نحو متقدم، بطولات…).
     جامعي:  أصول الفقه ومصادرها، تخريج الحديث وعلم الرجال، طبقات الرواة،
             والمتون التخصصية (الواسطية، كتاب التوحيد، شروح مطوّلة).
   إذا قلّت الأسئلة تحت خيار المستخدم، تُستكمل تلقائيًا من أقرب مرحلة/مستوى مع تنبيه عربي. */
(function (W) {
  'use strict';
  const LABELS = { ibtidai: 'ابتدائي', mutawassit: 'متوسط', thanawi: 'ثانوي', jami: 'جامعي' };
  const DIFF_LABELS = { 1: 'سهل', 2: 'متوسط', 3: 'صعب' };
  const BASIC = {
    quran: ['المكي والمدني', 'سور وآيات', 'الأجزاء', 'سجدات التلاوة', 'تحديد السورة', 'ترتيب السور', 'علوم القرآن'],
    aqeedah: ['أركان الإيمان', 'الإيمان', 'الملائكة', 'الكتب والرسل', 'القدر', 'اليوم الآخر', 'التوحيد', 'كتب العقيدة'],
    fiqh: ['الصلاة', 'الطهارة', 'الصيام', 'الحج', 'الزكاة', 'الأسرة', 'الأيمان'],
    usul: ['الحكم الشرعي', 'الأدلة', 'المقاصد', 'مؤلفات', 'الدلالات', 'القواعد الفقهية'],
    lugha: ['النحو', 'الأدب', 'البلاغة', 'المعاجم'],
    hadith: ['متون الأحاديث', 'كتب الحديث', 'مصطلح الحديث'],
    sira: ['المولد والنشأة', 'البعثة', 'الهجرة', 'الغزوات', 'حجة الوداع والوفاة', 'آل البيت', 'الأحداث بالترتيب', 'تواريخ السيرة'],
    sahaba: ['فضائل', 'الألقاب', 'الخلفاء الراشدون', 'المبشرون بالجنة'],
    tabieen: ['أعلام التابعين', 'تعريفات', 'تراجم التابعين', 'أنساب التابعين'],
    ulama: ['الأئمة الأربعة', 'المحدثون', 'علماء معاصرون', 'مؤلفات العلماء', 'علماء'],
    saudi: ['المناطق الإدارية', 'الملوك', 'الدولة السعودية الأولى', 'الدولة السعودية الثانية', 'توحيد المملكة', 'الاقتصاد والتنمية', 'الرموز الوطنية', 'الحدود والجغرافيا', 'المدن والمعالم'],
    football: ['كأس العالم', 'الأندية السعودية', 'المنتخب السعودي', 'قوانين اللعبة', 'البطولات القارية', 'تاريخ اللعبة']
  };
  const SPECIALIST = {
    quran: [],
    aqeedah: ['كتاب التوحيد', 'العقيدة الواسطية'],
    fiqh: [],
    usul: ['أبواب أصول الفقه (البحر المحيط)', 'تخريج الفروع على القواعد (ابن رجب)', 'الفروق الفقهية (القرافي)', 'أبواب أصول الفقه (روضة الناظر)', 'أبواب أصول الفقه (المستصفى)', 'فروع القواعد الكبرى (السيوطي)', 'تخريج الفروع على القواعد (الونشريسي)', 'قواعد المذهب المالكي (الونشريسي)', 'أبواب أصول الفقه (اللمع)', 'تخريج الفروع على الأصول (الإسنوي)', 'أبواب أصول الفقه (شرح تنقيح الفصول)'],
    lugha: ['العروض', 'النقد'],
    hadith: ['تخريج الأحاديث', 'علم الرجال'],
    sira: ['أحداث السيرة (ابن هشام)', 'القرآن في السيرة (ابن هشام)', 'القرآن في كتب السيرة'],
    sahaba: ['الرواة عن الصحابة (الكاشف)', 'مساكن الصحابة (التقريب)', 'وفيات الصحابة'],
    tabieen: ['طبقات التابعين (التقريب)', 'مراتب الرواة (التقريب)', 'التابعون في أسانيد الصحيحين', 'الشيوخ والتلاميذ'],
    ulama: ['الشيوخ والتلاميذ'],
    saudi: ['رجال الدولة'],
    football: ['الملاعب']
  };
  function has(map, q) { return (map[q.category] || []).indexOf(q.subcategory) >= 0; }

  function stageOf(q) {
    if (!q) return 'mutawassit';
    if (q.curated === 'school') return LABELS[q.level] ? q.level : 'mutawassit';
    const d = +q.difficulty || 2;
    const typ = q.type || 'mcq';
    const len = String(q.question || '').length;
    const hardType = typ === 'fill' || typ === 'order' || typ === 'match';
    const sub = q.subcategory || '';
    const cat = q.category;

    // Football: questions are short, so classify by topic rather than length
    if (cat === 'football') {
      if (sub === 'الأندية') return d <= 1 ? 'ibtidai' : 'mutawassit';
      if (sub === 'البطولات' || sub === 'الجوائز') return 'thanawi';
      if (sub === 'اللاعبون') return d <= 2 ? 'thanawi' : 'jami';
      if (sub === 'الملاعب') return 'jami';
    }

    if (has(SPECIALIST, q)) {
      if (d === 1) return 'thanawi';
      if (d === 2 && len < 55) return 'thanawi';
      return 'jami';
    }
    // year-of-death biographical facts — suitable for intermediate/high school
    if (/وفيات/.test(sub) && !has(SPECIALIST, q)) {
      if (d <= 2 || len < 90) return 'mutawassit';
      return 'thanawi';
    }
    if (has(BASIC, q)) {
      if (sub === 'المدن والمعالم') {
        if (d === 1 || (d === 2 && len < 62) || (d === 3 && len < 56)) return 'ibtidai';
        if (d === 2 || (d === 3 && len < 62)) return 'mutawassit';
        return 'thanawi';
      }
      if (d === 1) return hardType ? 'mutawassit' : 'ibtidai';
      if (d === 2) return len < 85 ? 'ibtidai' : 'mutawassit';
      return len < 70 ? 'mutawassit' : 'thanawi';
    }
    if (d === 1) return (hardType || len > 95) ? 'mutawassit' : 'ibtidai';
    if (d === 2) {
      if (len < 48) return 'ibtidai';
      if (len < 110) return 'mutawassit';
      return 'thanawi';
    }
    if (len < 52) return 'mutawassit';
    if (len < 115) return 'thanawi';
    return 'jami';
  }

  function getFilters() {
    const d = (W.QP && W.QP.LS) ? W.QP.LS.get('qfilters', null) : null;
    const o = d && typeof d === 'object' ? d : {};
    const diff = o.diff === 1 || o.diff === 2 || o.diff === 3 ? o.diff : null;
    const stage = LABELS[o.stage] ? o.stage : null;
    return { diff, stage };
  }
  function setFilters(part) {
    const cur = getFilters();
    if (part && 'diff' in part) cur.diff = part.diff ? +part.diff : null;
    if (part && 'stage' in part) cur.stage = LABELS[part.stage] ? part.stage : null;
    if (W.QP && W.QP.LS) W.QP.LS.set('qfilters', cur);
    return cur;
  }
  function applyTo(f, filters) {
    f = Object.assign({}, f || {});
    filters = filters || getFilters();
    if (filters.diff) f.diff = [filters.diff];
    if (filters.stage) f.stage = filters.stage;
    return f;
  }
  function relaxNote(filters, relaxed) {
    if (!relaxed) return null;
    const bits = [];
    if (relaxed.indexOf('stage') >= 0 && filters.stage) bits.push('المرحلة «' + LABELS[filters.stage] + '»');
    if (relaxed.indexOf('diff') >= 0 && filters.diff) bits.push('المستوى «' + DIFF_LABELS[filters.diff] + '»');
    if (!bits.length) return null;
    return 'تنبيه: لا توجد أسئلة كافية لخيار ' + bits.join(' و') + '، فاستُكملت بأسئلة من أقرب مستوى حتى تكتمل اللعبة.';
  }
  function pickRelaxed(filter, n, rnd, min) {
    const Bank = W.QP.Bank;
    min = min || Math.min(n || 6, 6);
    const start = Object.assign({}, filter || {});
    const attempts = [
      [Object.assign({}, start), null],
      // «متوسط + سهل»: نبقى داخل المجموعة المنهجية أولًا (بدون تقييد القسم الفرعي) قبل أي استكمال
      [Object.assign({}, start, { subs: null }), null],
      [Object.assign({}, start, { stage: null }), start.stage ? 'stage' : null],
      [Object.assign({}, start, { stage: null, diff: null }), (start.stage && start.diff) ? 'stage,diff' : start.diff ? 'diff' : start.stage ? 'stage' : null]
    ];
    let best = [], relaxed = null;
    for (let i = 0; i < attempts.length; i++) {
      const ff = attempts[i][0];
      if (ff.stage == null) delete ff.stage;
      if (ff.diff == null) delete ff.diff;
      if (ff.subs == null) delete ff.subs;
      const list = Bank.pick(ff, 0, rnd);
      best = list; relaxed = attempts[i][1];
      if (list.length >= min) break;
    }
    const out = n ? best.slice(0, n) : best;
    out.filterNote = relaxNote({ stage: start.stage, diff: Array.isArray(start.diff) ? start.diff[0] : start.diff }, relaxed);
    out.relaxed = relaxed;
    return out;
  }

  W.quizStageOf = stageOf;
  W.QUIZ_STAGE_LABELS = LABELS;
  W.QUIZ_DIFF_LABELS = DIFF_LABELS;
  W.QUIZ_STAGE_ORDER = ['ibtidai', 'mutawassit', 'thanawi', 'jami'];
  function filterBar(opts) {
    opts = opts || {};
    const { h } = W.QP;
    const box = h('div', { class: 'qfilters' });
    function draw() {
      const fl = getFilters();
      box.innerHTML = '';
      const diffRow = h('div', { class: 'chips qf-row' }, h('span', { class: 'qf-label' }, 'الصعوبة'));
      [['', 'الكل'], [1, 'سهل'], [2, 'متوسط'], [3, 'صعب']].forEach(([v, lab]) => {
        const on = (v === '' && !fl.diff) || fl.diff === v;
        diffRow.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: () => { setFilters({ diff: v || null }); draw(); opts.onChange && opts.onChange(getFilters()); } }, lab));
      });
      const stRow = h('div', { class: 'chips qf-row' }, h('span', { class: 'qf-label' }, 'المرحلة الدراسية'));
      [['', 'الكل']].concat(Object.keys(LABELS).map(k => [k, LABELS[k]])).forEach(([v, lab]) => {
        const on = (v === '' && !fl.stage) || fl.stage === v;
        stRow.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: () => { setFilters({ stage: v || null }); draw(); opts.onChange && opts.onChange(getFilters()); } }, lab));
      });
      // زر واضح للمجموعة المنهجية السهلة المخصصة للمرحلة المتوسطة
      const schoolOn = fl.stage === 'mutawassit' && fl.diff === 1;
      const nSchool = (W.QP && W.QP.Bank) ? W.QP.Bank.count({ stage: 'mutawassit', diff: [1] }) : 0;
      box.appendChild(h('button', { type: 'button', class: 'qf-school' + (schoolOn ? ' on' : ''), id: 'qfSchool', onclick: () => { if (schoolOn) setFilters({ stage: null, diff: null }); else setFilters({ stage: 'mutawassit', diff: 1 }); draw(); opts.onChange && opts.onChange(getFilters()); } },
        h('span', { class: 'qf-school-i' }, '🎒'),
        h('span', null, h('b', null, schoolOn ? '✔ أسئلة المرحلة المتوسطة السهلة مفعّلة' : 'أسئلة المرحلة المتوسطة السهلة'), h('small', null, (nSchool ? nSchool.toLocaleString('ar-SA') + ' سؤال ' : '') + 'من منهج المتوسط وكتاب القيم القرآنية — اضغط ' + (schoolOn ? 'لإلغائها' : 'لتفعيلها')))));
      box.appendChild(diffRow);
      box.appendChild(stRow);
    }
    draw();
    return box;
  }
  if (W.QP) {
    W.QP.stageOf = stageOf;
    W.QP.STAGES = LABELS;
    W.QP.getQFilters = getFilters;
    W.QP.setQFilters = setFilters;
    W.QP.applyQFilters = applyTo;
    W.QP.pickRelaxed = pickRelaxed;
    W.QP.relaxNote = relaxNote;
    W.QP.filterBar = filterBar;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { stageOf, LABELS, DIFF_LABELS, BASIC, SPECIALIST };
})(typeof window !== 'undefined' ? window : global);
