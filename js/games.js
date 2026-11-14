/* games.js — the games catalog is pure configuration on top of a few engines.
   A game = { id, name, icon, engine, desc, filter:{cats,subs,types,diff}, rules:{...} }
   Engines: quiz (solo; rule modules: perQ timer, total timer, lives, streak, endless, daily seed, wheel, hints),
            ladder (millionaire), duel (turns), buzzer (2 players same device), teams (host screen), study (flashcards). */
(function (W) {
  'use strict';
  const { Bank } = W.QP;
  const ALLQ = ['mcq', 'tf', 'who', 'fill', 'order', 'match'];
  const CHOICE = ['mcq', 'tf', 'who'];

  // ---- mode presets (each is one "mechanic configuration")
  const MODES = {
    classic:  { name: 'المسابقة الكلاسيكية', icon: '🎯', engine: 'quiz', desc: '10 أسئلة متنوعة، 25 ثانية لكل سؤال، مكافأة للسرعة والتتابع.', types: ALLQ, rules: { count: 10, perQ: 25, speedBonus: true, streak: true, lifelines: ['fifty', 'skip'] } },
    tf:       { name: 'صح أم خطأ', icon: '✅', engine: 'quiz', desc: '15 عبارة، قرّر بسرعة: صح أم خطأ؟', types: ['tf'], rules: { count: 15, perQ: 10, speedBonus: true, streak: true } },
    blitz:    { name: 'التحدي الخاطف', icon: '⚡', engine: 'quiz', desc: 'دقيقة واحدة! أجب عن أكبر عدد ممكن.', types: CHOICE, rules: { totalTime: 60, endless: true, streak: true, wrongPenalty: 5 } },
    survival: { name: 'النجاة (3 أرواح)', icon: '❤️', engine: 'quiz', desc: 'استمر حتى تفقد أرواحك الثلاث.', types: CHOICE.concat(['fill']), rules: { lives: 3, endless: true, perQ: 20, streak: true } },
    sudden:   { name: 'الموت المفاجئ', icon: '💀', engine: 'quiz', desc: 'خطأ واحد ينهي اللعبة. كم تصمد؟', types: CHOICE, rules: { lives: 1, endless: true, perQ: 15, streak: true } },
    speed:    { name: 'سرعة البديهة', icon: '⏱️', engine: 'quiz', desc: '12 سؤالًا بـ7 ثوانٍ فقط لكل سؤال، النقاط حسب السرعة.', types: ['mcq', 'tf'], rules: { count: 12, perQ: 7, speedBonus: true, speedWeight: 3 } },
    ladder:   { name: 'من سيربح المليون', icon: '💰', engine: 'millionaire', desc: '15 سؤالًا متصاعدة الصعوبة حتى المليون، محطتا أمان (1,000 و32,000)، حذف إجابتين واتصال بصديق والاستعانة بالجمهور.', types: ['mcq'], rules: { steps: 15 } },
    fill:     { name: 'أكمل الفراغ', icon: '✍️', engine: 'quiz', desc: 'اكتب الإجابة بنفسك.', types: ['fill'], rules: { count: 10, perQ: 45, hints: true } },
    order:    { name: 'رتّب بالتسلسل', icon: '🔢', engine: 'quiz', desc: 'رتّب العناصر بالترتيب الصحيح.', types: ['order'], rules: { count: 6, perQ: 60 } },
    match:    { name: 'صِل الأزواج', icon: '🔗', engine: 'quiz', desc: 'صِل كل عنصر بما يناسبه.', types: ['match'], rules: { count: 6, perQ: 60 } },
    who:      { name: 'من أنا؟', icon: '🕵️', engine: 'quiz', desc: 'تُكشف التلميحات تباعًا؛ كلما أجبت مبكرًا زادت نقاطك.', types: ['who'], rules: { count: 8, perQ: 40 } },
    beginner: { name: 'بداية الطريق (سهل)', icon: '🌱', engine: 'quiz', desc: 'أسئلة سهلة للمبتدئين.', types: CHOICE, diff: [1], rules: { count: 10, perQ: 30, lifelines: ['fifty', 'skip', 'time'] } },
    expert:   { name: 'مستوى الخبراء (صعب)', icon: '🧠', engine: 'quiz', desc: 'أصعب الأسئلة فقط.', types: ALLQ, diff: [3], rules: { count: 10, perQ: 30, speedBonus: true, scoreMult: 2 } },
    marathon: { name: 'الماراثون', icon: '🏃', engine: 'quiz', desc: 'كل أسئلة القسم دون توقف حتى تنهيها أو تنسحب.', types: ALLQ, rules: { endless: true, allowQuit: true, streak: true } },
    duel:     { name: 'تحدي الثنائي', icon: '🤺', engine: 'duel', desc: 'لاعبان على نفس الجهاز بالتناوب.', types: CHOICE, rules: { rounds: 8, perQ: 20 } },
    buzzer:   { name: 'الجرس السريع', icon: '🔔', engine: 'buzzer', desc: 'لاعبان، من يضغط الجرس أولًا يجيب. (مفتاح A للأول و L للثاني)', types: ['mcq', 'tf'], rules: { rounds: 10, perQ: 15 } },
    teams:    { name: 'مسابقة الفرق (شاشة المقدم)', icon: '👥', engine: 'teams', desc: 'للحلقات والمدارس والمسابقات: فرق ونقاط وسرقة الإجابة.', types: ALLQ, rules: { rounds: 20, perQ: 30 } },
    study:    { name: 'بطاقات المراجعة', icon: '🗂️', engine: 'study', desc: 'تعلّم بالبطاقات مع الشرح والمصدر.', types: ALLQ, rules: { count: 30 } },
    wheel:    { name: 'عجلة الأقسام', icon: '🎡', engine: 'quiz', desc: 'العجلة تختار القسم قبل كل سؤال!', types: CHOICE, rules: { count: 12, perQ: 20, wheel: true, speedBonus: true } },
    verified: { name: 'تحدي الموثّق', icon: '🛡️', engine: 'quiz', desc: 'أسئلة جرى التحقق منها آليًا مقابل نص المصدر فقط.', types: ALLQ, verifiedOnly: true, rules: { count: 12, perQ: 25, speedBonus: true } },
    seenjeem: { name: 'سين جيم', icon: '🟧', engine: 'seenjeem', desc: 'لوحة ٦ فئات و٣٦ سؤالًا (٢٠٠/٤٠٠/٦٠٠) بين فريقين، مع وسائل المساعدة: الحفرة، جاوب جوابين، اتصال بصديق، استريح، الفخ.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    huroof: { name: 'حروف', icon: '🐝', engine: 'huroof', desc: 'خلية الحروف السداسية: الأخضر يصل اليمين باليسار والبرتقالي يصل الأعلى بالأسفل، وكل حرف وراه سؤال جوابه يبدأ به.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    letters: { name: 'تحدي الحروف', icon: '🔤', engine: 'letters', desc: 'حرف عشوائي كل جولة: سباق إجابات تبدأ بالحرف ثم جولة «عبّي الخانات».', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    memory: { name: 'بطاقة الذاكرة', icon: '🃏', engine: 'memory', desc: 'اقلب بطاقتين وطابق كل سؤال مع جوابه، لاعب واحد أو حتى ٤ بالتناوب.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    sullam: { name: 'السلم الذهبي', icon: '🪜', engine: 'sullam', desc: 'اصعد درجة مع كل إجابة صحيحة، والدرجات الذهبية محطات أمان، وأول من يصل القمة يفوز.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    bidding: { name: 'مزايدة النقاط', icon: '💎', engine: 'bidding', desc: 'يظهر القسم أولًا وتزايد من رصيدك على ثقتك قبل السؤال، والجولة الأخيرة كل شيء أو لا شيء.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    rattib: { name: 'رتّب الإجابة', icon: '🔢', engine: 'rattib', desc: 'اسحب العناصر لترتيبها: السور، أحداث السيرة، الملوك، وفيات العلماء… مع درجات جزئية.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    mystery: { name: 'الصندوق الغامض', icon: '🎁', engine: 'mystery', desc: 'افتح صندوقًا: سؤال تخاطر فيه ×٢ أو تلعبه بأمان، أو مفاجأة: كنز، قنبلة، سرقة، تبديل نقاط.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    elim: { name: 'صح ولا خطأ — الإقصاء', icon: '⚖️', engine: 'elim', desc: 'حكم سريع على إجابة مقترحة: صح أم خطأ؟ الوقت يقصر، والخطأ يُسقط قلبًا، وآخر الصامدين يفوز.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    hotseat: { name: 'الكرسي الساخن', icon: '🔥', engine: 'hotseat', desc: 'سباق أسئلة سريعة ضد الساعة: كل فريق على الكرسي ٦٠ ثانية، والسلسلة الصحيحة تضاعف النقاط.', types: ['mcq', 'who', 'fill'], rules: { party: true } },
    championship: { name: 'البطولة الكبرى', icon: '🏆', engine: 'championship', desc: 'خمس جولات حماسية تشمل كل الأقسام: إحماء، برق، عجلة، مهارة، والجولة الذهبية بنقاط مضاعفة.', types: ALLQ, rules: { championship: true } }
  };

  const RELIGIOUS = ['quran', 'aqeedah', 'fiqh', 'usul', 'hadith', 'sira'];
  const HISTORY = ['sira', 'sahaba', 'tabieen', 'ulama'];
  const CULTURE = ['saudi', 'football', 'lugha', 'ulama'];
  const games = [];
  function add(g) { games.push(g); }
  function make(modeId, cats, extra) {
    const m = MODES[modeId]; extra = extra || {};
    return Object.assign({ id: modeId + '-' + (extra.key || cats.join('+')), mode: modeId, name: m.name, icon: m.icon, engine: m.engine, desc: m.desc,
      filter: Object.assign({ cats, subs: extra.subs || null, types: extra.types || m.types, diff: extra.diff || m.diff || null, verifiedOnly: !!m.verifiedOnly, balanceCats: cats.length > 1 }, extra.book ? { book: extra.book } : {}),
      rules: Object.assign({}, m.rules, extra.rules || {}) }, extra.title ? { title: extra.title } : {});
  }
  const minNeeded = g => g.mode === 'ladder' ? 15 : g.rules.count ? Math.min(g.rules.count, 6) : 6;

  // ---- per-category variants
  Bank.cats.forEach(c => {
    ['classic', 'tf', 'blitz', 'survival', 'sudden', 'speed', 'ladder', 'fill', 'order', 'match', 'who', 'beginner', 'expert', 'marathon', 'duel', 'buzzer', 'teams', 'study', 'verified']
      .forEach(mid => add(make(mid, [c.id], { title: MODES[mid].name + ' — ' + c.name })));
    // subcategory classics (the big subcategories become their own games)
    Bank.subcats(c.id).filter(([, n]) => n >= 12).slice(0, 4).forEach(([sub]) =>
      add(make('classic', [c.id], { key: c.id + ':' + sub, subs: [sub], title: 'مسابقة ' + sub + ' — ' + c.name })));
  });
  // ---- «كتاب القيم القرآنية» (أسئلة سهلة للمرحلة المتوسطة من كتاب صاحب المنصة) — من الكتاب فقط
  const BOOK_CATS = ['aqeedah', 'fiqh', 'quran', 'hadith'];
  [['classic', 'مسابقة كتاب القيم القرآنية', { count: 15 }], ['tf', 'صح أم خطأ — كتاب القيم القرآنية', null], ['teams', 'مسابقة الفرق — كتاب القيم القرآنية', null], ['ladder', 'من سيربح المليون — كتاب القيم القرآنية', null], ['study', 'بطاقات مراجعة كتاب القيم القرآنية', null], ['survival', 'النجاة — كتاب القيم القرآنية', null]]
    .forEach(([mid, title, rules]) => add(make(mid, BOOK_CATS, { key: 'qiyam', book: 'qiyam', title, types: mid === 'tf' ? ['tf'] : (mid === 'ladder' ? ['mcq'] : ['mcq', 'tf']), rules: Object.assign({}, rules || {}) })));
  // ---- special Quran / Hadith games
  add(make('who', ['quran'], { key: 'guess-surah', subs: ['تحديد السورة'], types: ['who', 'mcq'], title: 'خمّن السورة', rules: { count: 10 } }));
  add(make('classic', ['quran'], { key: 'complete-ayah', subs: ['أكمل الآية'], types: ['mcq'], title: 'أكمل الآية' }));
  add(make('fill', ['quran'], { key: 'last-word', subs: ['أكمل الآية'], title: 'الكلمة الأخيرة من الآية' }));
  add(make('order', ['quran'], { key: 'surah-order', subs: ['ترتيب السور'], title: 'رتّب السور كما في المصحف' }));
  add(make('match', ['quran'], { key: 'ayah-count', subs: ['سور وآيات'], title: 'صِل السورة بعدد آياتها' }));
  add(make('tf', ['quran'], { key: 'makki', subs: ['المكي والمدني'], types: ['tf', 'mcq'], title: 'مكية أم مدنية؟' }));
  add(make('blitz', ['quran'], { key: 'juz', subs: ['الأجزاء', 'ترتيب السور'], title: 'سباق الأجزاء والسور' }));
  add(make('classic', ['quran'], { key: 'tafsir', subs: ['التفسير', 'أسباب النزول', 'علوم القرآن'], title: 'التفسير وأسباب النزول وعلوم القرآن' }));
  add(make('classic', ['hadith'], { key: 'complete-hadith', subs: ['متون الأحاديث'], types: ['mcq', 'fill'], title: 'أكمل الحديث الشريف' }));
  add(make('classic', ['hadith'], { key: 'narrators', subs: ['رواة الأحاديث'], title: 'من راوي الحديث؟' }));
  add(make('ladder', ['hadith'], { key: 'takhrij', subs: ['تخريج الأحاديث', 'متون الأحاديث', 'رواة الأحاديث', 'مصطلح الحديث'], title: 'مليونير السنة' }));
  add(make('classic', ['hadith'], { key: 'mustalah', subs: ['مصطلح الحديث', 'كتب الحديث', 'علم الرجال'], title: 'مصطلح الحديث وكتب السنة' }));
  add(make('order', ['sira', 'saudi'], { key: 'chronology', title: 'رتّب الأحداث التاريخية' }));
  add(make('classic', ['fiqh', 'usul'], { key: 'fiqh-usul', title: 'الفقه وأصوله' }));
  // ---- mixed / cross-category
  const ALL = Bank.cats.map(c => c.id);
  add(Object.assign(make('championship', ALL, { key: 'grand', title: 'البطولة الكبرى' }), { id: 'championship', icon: '🏆', featured: true, desc: 'خمس جولات حماسية تغطي كل الأقسام الاثني عشر: إحماء، برق، عجلة الأقسام، المهارة، والجولة الذهبية.' }));
  add(Object.assign(make('seenjeem', ALL, { key: 'seenjeem', title: 'سين جيم' }), { id: 'seenjeem', featured: true }));
  add(Object.assign(make('huroof', ALL, { key: 'huroof', title: 'حروف' }), { id: 'huroof', featured: true }));
  add(Object.assign(make('ladder', ALL, { key: 'millionaire', title: 'من سيربح المليون' }), { id: 'millionaire', featured: true }));
  add(Object.assign(make('letters', ALL, { key: 'letters', title: 'تحدي الحروف' }), { id: 'letters', featured: true }));
  add(Object.assign(make('memory', ALL, { key: 'memory', title: 'بطاقة الذاكرة' }), { id: 'memory', featured: true }));
  add(Object.assign(make('sullam', ALL, { key: 'sullam', title: 'السلم الذهبي' }), { id: 'sullam', featured: true }));
  add(Object.assign(make('bidding', ALL, { key: 'bidding', title: 'مزايدة النقاط' }), { id: 'bidding', featured: true }));
  add(Object.assign(make('rattib', ALL, { key: 'rattib', title: 'رتّب الإجابة' }), { id: 'rattib', featured: true }));
  add(Object.assign(make('mystery', ALL, { key: 'mystery', title: 'الصندوق الغامض' }), { id: 'mystery', featured: true }));
  add(Object.assign(make('elim', ALL, { key: 'elim', title: 'صح ولا خطأ — الإقصاء' }), { id: 'elim', featured: true }));
  add(Object.assign(make('hotseat', ALL, { key: 'hotseat', title: 'الكرسي الساخن' }), { id: 'hotseat', featured: true }));
  [['classic', ALL, 'الشامل'], ['blitz', ALL, 'الخاطف الشامل'], ['survival', ALL, 'النجاة الشامل'],
   ['teams', ALL, 'مسابقة الفرق الكبرى'], ['duel', ALL, 'تحدي الثنائي الشامل'], ['buzzer', ALL, 'الجرس الشامل'], ['wheel', ALL, 'عجلة الأقسام'],
   ['who', ALL, 'من أنا؟ الشامل'], ['order', ALL, 'ترتيب شامل'], ['match', ALL, 'توصيل شامل'], ['verified', ALL, 'تحدي الموثّق الشامل'],
   ['classic', RELIGIOUS, 'التحدي الشرعي'], ['ladder', RELIGIOUS, 'مليون العلوم الشرعية'], ['teams', RELIGIOUS, 'مسابقة الحلقات الشرعية'],
   ['classic', HISTORY, 'السير والتراجم'], ['wheel', HISTORY, 'عجلة السير'], ['classic', CULTURE, 'الثقافة العامة'], ['wheel', CULTURE, 'عجلة الثقافة'],
   ['marathon', ALL, 'الماراثون الكبير'], ['expert', ALL, 'تحدي الخبراء الشامل'], ['study', ALL, 'بطاقات مراجعة شاملة']]
    .forEach(([mid, cats, title]) => add(make(mid, cats, { key: 'mix-' + title, title })));
  // ---- daily challenge (seeded by date — same questions for everybody today)
  add(Object.assign(make('classic', ALL, { key: 'daily', title: 'تحدي اليوم', rules: { count: 10, perQ: 25, daily: true, speedBonus: true } }), { id: 'daily', icon: '📅', desc: 'نفس الأسئلة العشرة لكل اللاعبين اليوم، محاولة واحدة يوميًا.' }));

  // keep only games that have enough questions
  const playable = games.filter(g => { const n = Bank.count(g.filter); g.available = n; return n >= minNeeded(g); });
  playable.forEach(g => { g.title = g.title || g.name; });
  W.QP.MODES = MODES;
  W.QP.GAMES = playable;
  W.QP.GAMES_ALL_DEFINED = games.length;
  W.QP.game = id => playable.find(g => g.id === id);
})(window);
