/* محاكاة جاهزة: طالب طب (المرحلة الثانية) — مواده، أساتذته، محاضراته، امتحاناته، واجباته، بطاقاته وسجل دراسته */
(function () {
  const SP = window.SP;
  const D = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return SP.today(x); };
  const T = (n, h = 10) => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(h, 0, 0, 0); return x.getTime(); };
  let n = 0; const id = (p) => p + '_' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
  const card = (q, a, box = 1, due = 0) => ({ id: id('c'), q, a, box, due: D(due) });
  const mcq = (q, options, answer) => ({ id: id('q'), type: 'mcq', q, options, answer });
  const tf = (q, isTrue) => ({ id: id('q'), type: 'tf', q, options: ['صح', 'خطأ'], answer: isTrue ? 0 : 1 });
  const short = (q, answer) => ({ id: id('q'), type: 'short', q, options: [], answer });

  const HEART = `القلب عضو عضلي يضخ الدم عبر الدورتين الرئوية والجهازية.
العقدة الجيبية الأذينية هي الناظم الطبيعي للقلب، وتولّد نحو 60 إلى 100 نبضة في الدقيقة عند الراحة.
ينتقل الإيعاز الكهربائي من العقدة الجيبية الأذينية إلى العقدة الأذينية البطينية ثم إلى حزمة هيس وألياف بركنجي.
يحدث تأخير طبيعي في العقدة الأذينية البطينية يسمح للأذينين بإكمال امتلاء البطينين قبل انقباضهما.
النتاج القلبي يساوي معدل ضربات القلب مضروباً في حجم الضربة، ويبلغ نحو خمسة لترات في الدقيقة عند البالغ في الراحة.
في تخطيط القلب تمثل الموجة P إزالة استقطاب الأذينين.
يمثل المركب QRS إزالة استقطاب البطينين، بينما تمثل الموجة T إعادة استقطاب البطينين.
المدة الطبيعية لفترة PR تتراوح بين 0.12 و0.20 ثانية.
الضغط الانقباضي هو أعلى ضغط في الشرايين أثناء انقباض البطين، والضغط الانبساطي هو أدنى ضغط أثناء ارتخائه.
يزداد النتاج القلبي أثناء التمرين بسبب زيادة معدل ضربات القلب وحجم الضربة معاً.
قانون فرانك ستارلنج ينص على أن زيادة امتلاء البطين تزيد قوة انقباضه ضمن الحدود الطبيعية.`;
  const GLYCO = `تحلل السكر سلسلة من عشرة تفاعلات تحدث في السيتوبلازم وتحوّل جزيء الغلوكوز إلى جزيئين من البيروفات.
إنزيم الفوسفوفركتوكاينيز الأول هو الإنزيم المحدد لسرعة تحلل السكر.
ينتج تحلل السكر صافياً قدره جزيئان من ATP عبر الفسفرة على مستوى الركيزة وجزيئان من NADH.
في غياب الأكسجين يتحول البيروفات إلى لاكتات لإعادة توليد NAD+ اللازم لاستمرار التحلل.
يُثبَّط إنزيم الفوسفوفركتوكاينيز الأول بارتفاع ATP والسترات، ويُنشَّط بـ AMP والفركتوز 2,6 ثنائي الفوسفات.
خلايا الدم الحمراء تعتمد كلياً على تحلل السكر لأنها لا تحتوي على ميتوكوندريا.`;

  SP.buildMedSim = () => {
    n = 0;
    const users = [
      { id: 'st', name: 'حسن', role: 'student' }, { id: 'zn', name: 'زينب', role: 'student' }, { id: 'ms', name: 'مصطفى', role: 'student' }, { id: 'rq', name: 'رقية', role: 'student' },
      { id: 'dA', name: 'د. سارة الجبوري', role: 'teacher' }, { id: 'dP', name: 'د. علي الربيعي', role: 'teacher' }, { id: 'dB', name: 'د. نور الحسيني', role: 'teacher' }, { id: 'dH', name: 'د. كريم العبيدي', role: 'teacher' },
    ];
    const members = ['st', 'zn', 'ms', 'rq'];
    const classes = [
      { id: 'an', name: 'التشريح', subject: 'Anatomy · الطرف العلوي', color: '#1F4E99', code: 'ANAT2', teacherId: 'dA', memberIds: members, created: T(-40) },
      { id: 'ph', name: 'الفسلجة', subject: 'Physiology · القلب والدم', color: '#B91C1C', code: 'PHYS2', teacherId: 'dP', memberIds: members, created: T(-40) },
      { id: 'bc', name: 'الكيمياء الحياتية', subject: 'Biochemistry · الأيض', color: '#2E7D32', code: 'BIOC2', teacherId: 'dB', memberIds: members, created: T(-40) },
      { id: 'hi', name: 'علم الأنسجة', subject: 'Histology · الأنسجة الأساسية', color: '#7B3FA0', code: 'HIST2', teacherId: 'dH', memberIds: members, created: T(-40) },
    ];

    const qAn = { id: 'qz_an', classId: 'an', by: 'dA', title: 'تشريح: الضفيرة العضدية', order: 0, timeLimit: 10, created: T(-6), questions: [
      mcq('أي عصب يغذي العضلة الدالية (Deltoid)؟', ['العصب الإبطي (Axillary)', 'العصب الكعبري (Radial)', 'العصب العضلي الجلدي', 'العصب المتوسط (Median)'], 0),
      mcq('شلل إرب (Erb\'s palsy) ينتج عن إصابة الجذرين:', ['C8–T1', 'C5–C6', 'C7 فقط', 'T1–T2'], 1),
      tf('شلل كلومبكي (Klumpke) يصيب الجذرين C5–C6.', false),
      mcq('العضلة التي تثني المرفق وهي أقوى مكبّ (supinator) للساعد:', ['العضلة ذات الرأسين العضدية (Biceps brachii)', 'العضلة العضدية (Brachialis)', 'العضلة ثلاثية الرؤوس', 'العضلة العضدية الكعبرية'], 0),
      short('أي عصب يتعرض للإصابة غالباً في كسر منتصف جسم عظم العضد؟', 'العصب الكعبري|الكعبري|radial|radial nerve'),
    ] };
    const qPh = { id: 'qz_ph', classId: 'ph', by: 'dP', title: 'فسلجة: القلب', order: 0, timeLimit: 8, created: T(-4), questions: [
      mcq('جهد الراحة الغشائي لخلية عضلة البطين يقارب:', ['−70 mV', '−90 mV', '−55 mV', '+30 mV'], 1),
      mcq('الناظم الطبيعي للقلب هو:', ['العقدة الأذينية البطينية', 'حزمة هيس', 'العقدة الجيبية الأذينية', 'ألياف بركنجي'], 2),
      tf('الضغط الانبساطي هو الضغط في الشرايين أثناء انقباض البطين.', false),
      mcq('النتاج القلبي يساوي:', ['معدل القلب × حجم الضربة', 'حجم الضربة ÷ معدل القلب', 'الضغط الانقباضي − الانبساطي', 'معدل القلب × المقاومة الطرفية'], 0),
      short('ما الهرمون الذي تفرزه الكلية لتحفيز إنتاج كريات الدم الحمراء؟', 'الإريثروبويتين|الاريثروبويتين|erythropoietin|EPO'),
    ] };
    const qBc = { id: 'qz_bc', classId: 'bc', by: 'dB', title: 'كيمياء حياتية: تحلل السكر', order: 0, timeLimit: 6, created: T(-2), questions: [
      mcq('الإنزيم المحدد لسرعة تحلل السكر هو:', ['الهكسوكاينيز', 'الفوسفوفركتوكاينيز الأول (PFK-1)', 'البيروفات كاينيز', 'الألدولاز'], 1),
      mcq('صافي ATP الناتج من تحلل جزيء غلوكوز واحد (فسفرة على مستوى الركيزة):', ['1', '2', '4', '36'], 1),
      tf('الإنزيم يغيّر ثابت التوازن للتفاعل.', false),
      mcq('نقص فيتامين C يسبب:', ['البري بري', 'البلاجرا', 'الإسقربوط (Scurvy)', 'الكساح'], 2),
      short('ما الإنزيم المحدد لسرعة تصنيع الكوليسترول؟', 'HMG-CoA reductase|HMG-CoA ريدكتيز|اتش ام جي كو اي ريدكتيز'),
    ] };
    const qHi = { id: 'qz_hi', classId: 'hi', by: 'dH', title: 'أنسجة: الظهارة والأعصاب', order: 0, timeLimit: 6, created: T(-9), questions: [
      mcq('نوع الظهارة المبطنة للرغامى (Trachea):', ['حرشفية مطبقة', 'عمودية مطبقة كاذبة مهدبة', 'مكعبة بسيطة', 'انتقالية'], 1),
      mcq('الخلايا المسؤولة عن تكوين الميالين في الجهاز العصبي المركزي:', ['خلايا شوان', 'الخلايا النجمية', 'الخلايا قليلة التغصنات (Oligodendrocytes)', 'الخلايا الدبقية الصغيرة'], 2),
      tf('ظهارة المريء من النوع الحرشفي المطبق غير المتقرن.', true),
      short('ما الخلايا التي تنتج الأجسام المضادة؟', 'خلايا البلازما|البلازما|plasma cells|الخلايا البلازمية'),
    ] };

    const results = [];
    const res = (quiz, userId, score, secs, d) => results.push({ id: id('r'), quizId: quiz.id, userId, score, total: quiz.questions.length, secs, ts: T(d, 19) });
    res(qAn, 'st', 4, 410, -5); res(qAn, 'zn', 5, 380, -5); res(qAn, 'ms', 3, 520, -4); res(qAn, 'rq', 4, 455, -4);
    res(qPh, 'st', 3, 300, -3); res(qPh, 'st', 5, 260, -2); res(qPh, 'zn', 4, 290, -3); res(qPh, 'ms', 5, 340, -3);
    res(qHi, 'st', 4, 200, -8); res(qHi, 'rq', 3, 240, -8); res(qHi, 'zn', 4, 230, -7);

    const decks = [
      { id: 'dk_an', ownerId: 'st', classId: '', name: 'تشريح: أعصاب الطرف العلوي', cards: [
        card('العصب المغذي للعضلة الدالية', 'العصب الإبطي (C5–C6)', 3, 1), card('شلل إرب: الجذور والعلامة', 'C5–C6 · وضعية «يد النادل» (Waiter\'s tip)', 2, 0),
        card('شلل كلومبكي: الجذور والعلامة', 'C8–T1 · اليد المخلبية', 1, 0), card('هبوط الرسغ (Wrist drop)', 'إصابة العصب الكعبري', 4, 3),
        card('يد القرد (Ape hand)', 'إصابة العصب المتوسط', 1, 0), card('محتويات النفق الرسغي', 'العصب المتوسط + 9 أوتار (4 FDS، 4 FDP، FPL)', 2, 0),
        card('لوح الكتف المجنّح', 'إصابة العصب الصدري الطويل ← شلل العضلة المنشارية الأمامية', 1, 0), card('ترتيب الضفيرة العضدية (حفظ)', 'جذور، جذوع، انقسامات، حبال، فروع · Randy Travis Drinks Cold Beer', 5, 6) ] },
      { id: 'dk_ph', ownerId: 'st', classId: '', name: 'فسلجة: القلب وتخطيطه', cards: [
        card('الموجة P تمثل', 'إزالة استقطاب الأذينين', 3, 2), card('المركب QRS يمثل', 'إزالة استقطاب البطينين', 2, 0), card('الموجة T تمثل', 'إعادة استقطاب البطينين', 1, 0),
        card('المدة الطبيعية لفترة PR', '0.12 – 0.20 ثانية', 1, 0), card('النتاج القلبي الطبيعي في الراحة', 'نحو 5 لترات/دقيقة (HR × SV)', 4, 4),
        card('معدل العقدة الجيبية الأذينية في الراحة', '60 – 100 نبضة/دقيقة', 2, 0), card('قانون فرانك ستارلنج', 'زيادة امتلاء البطين ← زيادة قوة الانقباض (ضمن الحدود الطبيعية)', 1, 0) ] },
      { id: 'dk_bc', ownerId: 'st', classId: '', name: 'كيمياء حياتية: الإنزيمات والفيتامينات', cards: [
        card('الإنزيم المحدد لتحلل السكر', 'PFK-1 (الفوسفوفركتوكاينيز الأول)', 2, 0), card('الإنزيم المحدد لتصنيع الكوليسترول', 'HMG-CoA reductase', 3, 1),
        card('الإنزيم المحدد لدورة كربس', 'Isocitrate dehydrogenase', 1, 0), card('الإنزيم المحدد لتصنيع الأحماض الدهنية', 'Acetyl-CoA carboxylase', 1, 0),
        card('نقص فيتامين B1 (الثيامين)', 'البري بري / متلازمة فيرنيكه', 2, 0), card('نقص النياسين (B3)', 'البلاجرا: إسهال، التهاب جلد، خرف', 1, 0),
        card('فيتامين K ضروري لعوامل التخثر', 'II، VII، IX، X (وبروتين C وS)', 1, 0) ] },
      { id: 'dk_hi', ownerId: 'st', classId: '', name: 'أنسجة: أنواع الظهارة والخلايا', cards: [
        card('ظهارة الرغامى', 'عمودية مطبقة كاذبة مهدبة مع خلايا كأسية', 3, 2), card('ظهارة المثانة', 'انتقالية (Urothelium)', 2, 0), card('ظهارة الجلد', 'حرشفية مطبقة متقرنة', 4, 5),
        card('الميالين في الجهاز العصبي المركزي', 'الخلايا قليلة التغصنات', 1, 0), card('الميالين في الجهاز العصبي المحيطي', 'خلايا شوان', 2, 0), card('الخلايا المنتجة للأجسام المضادة', 'خلايا البلازما', 1, 0) ] },
    ];

    const notes = [
      { id: id('n'), ownerId: 'st', title: 'خطة أسبوع الامتحانات', body: `• غداً: كويز الكيمياء الحياتية (تحلل السكر فقط)\n• بعد 4 أيام: عملي التشريح OSPE (الطرف العلوي)\n• بعد 9 أيام: شهري الفسلجة (القلب والدم)\n\nكل يوم: 3 جلسات تركيز × 25 دقيقة + مراجعة البطاقات المستحقة.\nأبدأ بالأصعب صباحاً (التشريح)، والمراجعة الخفيفة مساءً.`, color: '#B91C1C', pinned: true, tags: ['خطة', 'امتحانات'], classId: '', stickers: ['📌', '🎯'], updated: T(-1) },
      { id: 'n_plexus', ownerId: 'st', title: 'ملخص: الضفيرة العضدية', body: `الجذور: C5، C6، C7، C8، T1\nالجذوع: علوي (C5–C6)، متوسط (C7)، سفلي (C8–T1)\nكل جذع ينقسم إلى أمامي وخلفي\nالحبال: جانبي، إنسي، خلفي\nالفروع النهائية: العضلي الجلدي، الإبطي، الكعبري، المتوسط، الزندي\n\nللحفظ: Randy Travis Drinks Cold Beer\n(Roots, Trunks, Divisions, Cords, Branches)`, color: '#1F4E99', pinned: false, tags: ['تشريح'], classId: '', stickers: ['🧠'], updated: T(-3) },
      { id: id('n'), ownerId: 'st', title: 'الإنزيمات المحددة للسرعة', body: `تحلل السكر: PFK-1\nاستحداث السكر: Fructose-1,6-bisphosphatase\nدورة كربس: Isocitrate dehydrogenase\nتصنيع الغلايكوجين: Glycogen synthase\nتحلل الغلايكوجين: Glycogen phosphorylase\nتصنيع الأحماض الدهنية: Acetyl-CoA carboxylase\nأكسدة بيتا: Carnitine acyltransferase I (CPT-1)\nتصنيع الكوليسترول: HMG-CoA reductase`, color: '#2E7D32', pinned: false, tags: ['كيمياء حياتية'], classId: '', stickers: ['⭐'], updated: T(-2) },
      { id: id('n'), ownerId: 'dP', title: 'نقاط مهمة للشهري (من الدكتور)', body: 'ركّزوا على: الدورة القلبية بمراحلها، موجات ECG ومعانيها، فترة PR الطبيعية، النتاج القلبي وقانون فرانك ستارلنج.', color: '#B91C1C', pinned: true, tags: ['فسلجة'], classId: 'ph', stickers: ['❗'], updated: T(-2) },
    ];

    const sessions = [];
    [[-13, 45], [-12, 60], [-11, 30], [-9, 90], [-8, 75], [-7, 40], [-5, 60], [-4, 120], [-3, 50], [-2, 80], [-1, 65], [0, 25]].forEach(([d, m]) => sessions.push({ userId: 'st', ts: T(d, 20), day: D(d), min: m }));
    [[-3, 90], [-2, 60], [-1, 120], [0, 50]].forEach(([d, m]) => sessions.push({ userId: 'zn', ts: T(d, 20), day: D(d), min: m }));
    [[-2, 40], [0, 30]].forEach(([d, m]) => sessions.push({ userId: 'ms', ts: T(d, 20), day: D(d), min: m }));

    const tasks = [
      { id: id('t'), userId: 'st', text: 'راجع بطاقات التشريح المستحقة', done: false, due: D(0), classId: 'an', prio: 2 },
      { id: id('t'), userId: 'st', text: 'حل أسئلة تحلل السكر السابقة', done: false, due: D(0), classId: 'bc', prio: 3 },
      { id: id('t'), userId: 'st', text: 'ذاكر لامتحان OSPE: العظام والعضلات والأعصاب', done: false, due: D(2), classId: 'an', prio: 3 },
      { id: id('t'), userId: 'st', text: 'اكتب تقرير مختبر ضغط الدم', done: false, due: D(4), classId: 'ph', prio: 2 },
      { id: id('t'), userId: 'st', text: 'شاهد تسجيل محاضرة الدورة القلبية', done: true, due: D(-2), classId: 'ph', prio: 1 },
      { id: id('t'), userId: 'st', text: 'تعريف شرائح الظهارة', done: true, due: D(-3), classId: 'hi', prio: 2 },
    ];
    const tt = {}; const put = (day, p, v) => (tt[day + '-' + p] = v);
    [['تشريح (نظري)', 'تشريح (نظري)', 'فسلجة (نظري)', 'مختبر أنسجة', 'مختبر أنسجة'], ['كيمياء حياتية', 'فسلجة (نظري)', 'صالة التشريح', 'صالة التشريح', ''], ['أنسجة (نظري)', 'كيمياء حياتية', 'مختبر فسلجة', 'مختبر فسلجة', ''], ['تشريح (نظري)', 'فسلجة (نظري)', 'مختبر كيمياء حياتية', 'مختبر كيمياء حياتية', 'مراجعة جماعية'], ['أنسجة (نظري)', 'كيمياء حياتية', 'حلقة نقاش (Seminar)', '', '']].forEach((row, d) => row.forEach((v, i) => v && put(d, i + 1, v)));

    const posts = [
      { id: id('p'), classId: 'bc', authorId: 'zn', kind: 'question', text: 'دكتورة، هل يشمل كويز الغد دورة كربس أم تحلل السكر فقط؟', tags: ['سؤال'], likes: ['st'], comments: [{ id: id('m'), authorId: 'dB', text: 'تحلل السكر وتنظيمه فقط، ودورة كربس في الامتحان القادم.', ts: T(-1, 18) }, { id: id('m'), authorId: 'st', text: 'شكراً دكتورة 🙏', ts: T(-1, 19) }], pinned: false, ts: T(-1, 17) },
      { id: id('p'), classId: 'an', authorId: 'st', kind: 'info', text: 'طريقة حفظ فروع الضفيرة العضدية: Randy Travis Drinks Cold Beer = Roots, Trunks, Divisions, Cords, Branches 🧠', tags: ['حفظ'], likes: ['zn', 'ms', 'rq'], comments: [], pinned: false, ts: T(-3, 21) },
    ];

    const items = [
      { id: 'i_ntc_an', classId: 'an', by: 'dA', type: 'notice', title: 'الامتحان العملي (OSPE) وما يشمله', ts: T(-2, 9), important: true, text: 'الامتحان العملي يشمل:\n- عظام الطرف العلوي ومعالمها\n- عضلات الكتف والذراع\n- الضفيرة العضدية وإصاباتها\nأحضروا المعطف الأبيض، والحضور قبل الموعد بـ 15 دقيقة.' },
      { id: 'i_ntc_ph', classId: 'ph', by: 'dP', type: 'notice', title: 'محتوى الشهري', ts: T(-3, 9), important: false, text: 'الشهري يشمل الدورة القلبية وتخطيط القلب والدم. راجعوا ملزمة القلب المرفوعة في قسم الملفات.' },
      { id: 'i_exp_an', classId: 'an', by: 'dA', type: 'explain', title: 'كيف تميّز إصابات الأعصاب في اليد', ts: T(-3, 14), images: [], fileId: '', fname: '', fmime: '', text: '**القاعدة:** كل عصب له علامة سريرية مميزة.\n- **الكعبري:** هبوط الرسغ (Wrist drop)\n- **المتوسط:** يد القرد، وضعف الإبهام (ضمور البارزة الرانفية)\n- **الزندي:** اليد المخلبية، خاصة الإصبعين الرابع والخامس\n- **الإبطي:** ضعف إبعاد الكتف وفقدان الإحساس فوق العضلة الدالية\nفي العملي سيُطلب منكم ربط العلامة بالعصب وبالجذور.' },
      { id: 'i_exp_bc', classId: 'bc', by: 'dB', type: 'explain', title: 'ملخص تنظيم تحلل السكر', ts: T(-2, 15), images: [], fileId: '', fname: '', fmime: '', text: '**PFK-1** هو نقطة التحكم الرئيسية:\n- يُنشَّط بـ AMP والفركتوز 2,6 ثنائي الفوسفات\n- يُثبَّط بـ ATP والسترات\nالإنسولين يرفع الفركتوز 2,6 ثنائي الفوسفات فيسرّع التحلل، والغلوكاغون يخفضه.' },
      { id: id('i'), classId: 'bc', by: 'dB', type: 'exam', title: 'كويز الكيمياء الحياتية: تحلل السكر', ts: T(-5), date: D(1), time: '10:00', kind: 'قصير', place: 'القاعة 2', topics: ['تفاعلات تحلل السكر العشرة', 'الإنزيمات المنظِّمة وتنظيمها', 'حساب صافي ATP', 'مصير البيروفات هوائياً ولاهوائياً'], quizId: 'qz_bc' },
      { id: id('i'), classId: 'an', by: 'dA', type: 'exam', title: 'عملي التشريح (OSPE): الطرف العلوي', ts: T(-7), date: D(4), time: '08:30', kind: 'عملي', place: 'صالة التشريح', topics: ['عظام الطرف العلوي ومعالمها', 'عضلات الكتف والذراع: المنشأ والمدغم والتعصيب', 'الضفيرة العضدية وإصاباتها السريرية', 'الحفرة المرفقية والنفق الرسغي'], quizId: 'qz_an' },
      { id: id('i'), classId: 'ph', by: 'dP', type: 'exam', title: 'الشهري: فسلجة القلب والدم', ts: T(-6), date: D(9), time: '09:00', kind: 'شهري', place: 'القاعة الكبرى', topics: ['الدورة القلبية', 'تخطيط القلب الكهربائي', 'النتاج القلبي وتنظيمه', 'مكونات الدم وتكوين الكريات الحمر'], quizId: 'qz_ph' },
      { id: id('i'), classId: 'hi', by: 'dH', type: 'exam', title: 'امتحان نصف السنة: علم الأنسجة', ts: T(-10), date: D(25), time: '09:00', kind: 'نصف السنة', place: 'القاعة الكبرى', topics: ['النسيج الظهاري', 'النسيج الضام', 'النسيج العصبي', 'النسيج العضلي'], quizId: 'qz_hi' },
      { id: id('i'), classId: 'an', by: 'dA', type: 'lecture', title: 'المحاضرة 7: الضفيرة العضدية', ts: T(-6, 8), fileId: '', url: '', desc: 'محاضرة حضورية. راجع النقاط أدناه قبل العملي.', chapters: [{ t: 0, label: 'الجذور والجذوع والانقسامات' }, { t: 1, label: 'الحبال والفروع النهائية' }, { t: 2, label: 'شلل إرب وشلل كلومبكي' }, { t: 3, label: 'إصابات الأعصاب الطرفية: الكعبري، المتوسط، الزندي' }] },
      { id: id('i'), classId: 'ph', by: 'dP', type: 'lecture', title: 'المحاضرة 5: الدورة القلبية وتخطيط القلب', ts: T(-4, 8), fileId: '', url: '', desc: 'محاضرة حضورية مع شرح على السبورة. الصور في الألبوم.', chapters: [{ t: 0, label: 'مراحل الدورة القلبية' }, { t: 1, label: 'أصوات القلب' }, { t: 2, label: 'موجات ECG: P وQRS وT' }, { t: 3, label: 'الفترات الطبيعية (PR وQT)' }] },
      { id: id('i'), classId: 'bc', by: 'dB', type: 'lecture', title: 'المحاضرة 4: تحلل السكر (Glycolysis)', ts: T(-5, 8), fileId: '', url: '', desc: 'محاضرة حضورية. المطلوب للكويز: كل ما يلي.', chapters: [{ t: 0, label: 'مرحلة الاستثمار (صرف 2 ATP)' }, { t: 1, label: 'مرحلة الحصاد (إنتاج 4 ATP و2 NADH)' }, { t: 2, label: 'تنظيم PFK-1' }, { t: 3, label: 'الأيض اللاهوائي وإنتاج اللاكتات' }] },
      { id: id('i'), classId: 'an', by: 'dA', type: 'homework', title: 'ارسم الضفيرة العضدية مع الفروع النهائية', ts: T(-3), due: D(2), max: 20, desc: 'رسم بخط اليد ملوّن، مع كتابة جذور كل فرع نهائي. صوّر الرسم وارفعه.', fileId: '', fname: '', fmime: '', subs: { zn: { fileId: '', name: 'ضفيرة-زينب.jpg', mime: 'image/jpeg', ts: T(-1), late: false, grade: null, feedback: '' } } },
      { id: id('i'), classId: 'ph', by: 'dP', type: 'homework', title: 'تقرير مختبر: قياس ضغط الدم', ts: T(-2), due: D(5), max: 10, desc: 'اكتب تقريراً عن قياس ضغط الدم بالطريقة السماعية: الأدوات، الخطوات، أصوات كوروتكوف، والنتائج قبل الجهد وبعده.', fileId: '', fname: '', fmime: '', subs: {} },
      { id: id('i'), classId: 'hi', by: 'dH', type: 'homework', title: 'تعريف 6 شرائح ظهارة', ts: T(-10), due: D(-3), max: 100, desc: 'عرّف نوع الظهارة ومكانها في كل شريحة.', fileId: '', fname: '', fmime: '', subs: { st: { fileId: 'sim_sub_st', name: 'شرائح-الظهارة-حسن.txt', mime: 'text/plain', ts: T(-4), late: false, grade: 88, feedback: 'تمييز ممتاز، راجع الظهارة الانتقالية في المثانة.' } } },
    ];

    return {
      v: 1, me: 'st', dark: null, fontSize: 16, sim: 'med', users, classes, notes,
      files: [
        { id: 'sim_heart', ownerId: 'dP', name: 'ملزمة الفسلجة - القلب.txt', mime: 'text/plain', size: HEART.length * 2, tags: ['فسلجة', 'قلب'], color: '#B91C1C', star: true, stickers: ['❤️'], kind: 'handout', classId: 'ph', added: T(-3), desc: 'ملزمة الشهري. جرّب زر «أسئلة» لتوليد اختبار منها.', pages: 12, readPages: 7 },
        { id: 'sim_glyco', ownerId: 'st', name: 'ملخص تحلل السكر.txt', mime: 'text/plain', size: GLYCO.length * 2, tags: ['كيمياء حياتية'], color: '#2E7D32', star: false, stickers: ['⭐'], kind: 'file', classId: '', added: T(-2), desc: 'ملخصي لكويز الغد', pages: 0, readPages: 0 },
      ],
      boards: { st: [{ id: id('b'), kind: 'note', text: 'OSPE بعد 4 أيام!', color: '#F2C23066', x: 40, y: 30, rot: -4 }, { id: id('b'), kind: 'emoji', text: '🫀', x: 260, y: 60, rot: 6 }, { id: id('b'), kind: 'emoji', text: '🧠', x: 360, y: 180, rot: -8 }, { id: id('b'), kind: 'note', text: 'PFK-1 = الإنزيم المحدد', color: '#9BE58B66', x: 120, y: 220, rot: 3 }] },
      sessions, tasks, timetable: { st: tt }, goalMin: 120, posts, decks, quizzes: [qAn, qPh, qBc, qHi], results,
      docs: [{ id: 'd_anat', ownerId: 'st', name: 'دفتر التشريح', kind: 'blank', fileId: '', created: T(-5), updated: T(-1), pages: [{ a: [
        { id: id('a'), t: 'text', x: 0.55, y: 0.06, s: 0.042, c: '#1F4E99', v: 'الضفيرة العضدية' },
        { id: id('a'), t: 'text', x: 0.28, y: 0.15, s: 0.026, c: '#111827', v: 'C5 · C6 · C7 · C8 · T1\nجذور ← جذوع ← انقسامات ← حبال ← فروع' },
        { id: id('a'), t: 'mark', c: '#FFE14D', w: 0, x1: 0.27, y1: 0.145, x2: 0.92, y2: 0.19 },
        { id: id('a'), t: 'text', x: 0.4, y: 0.3, s: 0.026, c: '#C62828', v: 'شلل إرب: C5–C6 (يد النادل)\nشلل كلومبكي: C8–T1 (يد مخلبية)' },
        { id: id('a'), t: 'arrow', c: '#C62828', w: 0.004, x1: 0.3, y1: 0.42, x2: 0.42, y2: 0.34 },
        { id: id('a'), t: 'stk', x: 0.08, y: 0.05, s: 0.07, e: '🧠' }] }, { a: [] }] }],
      classItems: items, inbox: [{ id: id('x'), type: 'col', from: 'zn', to: 'st', name: '🗂️ خطة كويز الأيض', note: 'رتبتها لكويز باچر، شوفها', ts: T(0, 7), read: false, col: { name: 'خطة كويز الأيض (زينب)', emoji: '🧪', items: [
        { id: 'zc1', kind: 'heading', text: 'اقرأ أولاً' }, { id: 'zc2', kind: 'item', ref: 'i_exp_bc', title: 'ملخص تنظيم تحلل السكر', note: 'هاي أهم شي بالكويز', tag: '#C62828' },
        { id: 'zc3', kind: 'heading', text: 'بعدين' }, { id: 'zc4', kind: 'note', text: 'احفظ: صافي ATP = 2، وNADH = 2، والإنزيم المحدد PFK-1' }, { id: 'zc5', kind: 'note', text: 'حل فويز الكيمياء الحياتية قبل النوم' }] } },
        { id: id('x'), from: 'zn', to: 'st', fileId: 'sim_glyco_zn', name: 'أسئلة سنوات سابقة - أيض.txt', mime: 'text/plain', note: 'هاي أسئلة السنة الماضية، تفيدك لكويز باچر', ts: T(0, 8), read: false }],
      noticesMigrated: true,
      cols: [
        { id: 'col_tray', ownerId: 'st', name: 'محفوظات من الصفوف', emoji: '📥', color: '#1F4E99', tray: true, created: T(-3), updated: T(-1), items: [{ id: id('ci'), kind: 'item', ref: 'i_exp_bc', title: 'ملخص تنظيم تحلل السكر', note: '', tag: '', done: false }] },
        { id: 'col_ospe', ownerId: 'st', name: 'مراجعة OSPE التشريح', emoji: '🦴', color: '#1F4E99', created: T(-3), updated: T(-1), items: [
          { id: id('ci'), kind: 'heading', text: '1) اقرأ ما أرسلته الدكتورة' },
          { id: id('ci'), kind: 'item', ref: 'i_ntc_an', title: 'الامتحان العملي (OSPE) وما يشمله', note: 'الحضور قبل 15 دقيقة!', tag: '#C62828', done: true },
          { id: id('ci'), kind: 'item', ref: 'i_exp_an', title: 'كيف تميّز إصابات الأعصاب في اليد', note: 'أهم شي: ربط العلامة بالجذور', tag: '#E07B00', done: false },
          { id: id('ci'), kind: 'heading', text: '2) ملاحظاتي وملفاتي' },
          { id: id('ci'), kind: 'snote', ref: 'n_plexus', title: 'ملخص: الضفيرة العضدية', note: '', tag: '', done: false },
          { id: id('ci'), kind: 'doc', ref: 'd_anat', title: 'دفتر التشريح', note: 'أكمل رسم الفروع النهائية', tag: '', done: false },
          { id: id('ci'), kind: 'heading', text: '3) تدريب' },
          { id: id('ci'), kind: 'note', text: 'حل فويز «تشريح: الضفيرة العضدية» مرتين على الأقل، والهدف 5/5', done: false },
        ] },
      ],
      mascot: { st: { kind: 'owl', color: '', acc: 'cap', name: 'سند' } }, chat: {}, watch: {}, vnotes: { st: {} },
    };
  };

  /* رسم توضيحي لتخطيط القلب (يُرسم في المتصفح ويُحفظ كصورة) */
  const ecgImage = () => new Promise((res) => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 360; const x = c.getContext('2d');
    x.fillStyle = '#fff8f6'; x.fillRect(0, 0, 900, 360); x.strokeStyle = 'rgba(220,80,80,.18)'; x.lineWidth = 1;
    for (let i = 0; i <= 900; i += 18) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 360); x.stroke(); } for (let j = 0; j <= 360; j += 18) { x.beginPath(); x.moveTo(0, j); x.lineTo(900, j); x.stroke(); }
    x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath(); const base = 220; x.moveTo(0, base);
    for (let k = 0; k < 3; k++) { const o = k * 300; x.lineTo(o + 40, base); x.quadraticCurveTo(o + 60, base - 30, o + 80, base); x.lineTo(o + 110, base); x.lineTo(o + 118, base + 18); x.lineTo(o + 130, base - 140); x.lineTo(o + 142, base + 40); x.lineTo(o + 152, base); x.lineTo(o + 190, base); x.quadraticCurveTo(o + 220, base - 50, o + 250, base); x.lineTo(o + 300, base); }
    x.stroke(); x.fillStyle = '#B91C1C'; x.font = 'bold 26px sans-serif'; x.fillText('P', 50, base - 40); x.fillText('QRS', 108, base - 150); x.fillText('T', 212, base - 60);
    x.fillStyle = '#1F2937'; x.font = '20px sans-serif'; x.fillText('Normal sinus rhythm (schematic)', 560, 40); x.fillText('PR 0.12–0.20 s', 30, 320);
    c.toBlob(res, 'image/png');
  });

  SP.loadMedSim = async () => {
    const st = SP.buildMedSim();
    const HEARTB = new Blob([HEART], { type: 'text/plain' }), GLYB = new Blob([GLYCO], { type: 'text/plain' });
    const past = new Blob(['أسئلة سنوات سابقة - الأيض\n1) ما الإنزيم المحدد لتحلل السكر؟ PFK-1\n2) كم صافي ATP من تحلل جزيء غلوكوز؟ 2\n3) لماذا تعتمد كريات الدم الحمراء على تحلل السكر؟ لأنها بلا ميتوكوندريا\n4) ما مصير البيروفات لاهوائياً؟ يتحول إلى لاكتات'], { type: 'text/plain' });
    const sub = new Blob(['1- الرغامى: عمودية مطبقة كاذبة مهدبة\n2- الجلد: حرشفية مطبقة متقرنة\n3- المريء: حرشفية مطبقة غير متقرنة\n4- المثانة: انتقالية\n5- الأنابيب الكلوية القريبة: مكعبة بسيطة\n6- الأمعاء الدقيقة: عمودية بسيطة مع خلايا كأسية'], { type: 'text/plain' });
    try {
      await SP.idb.put('sim_heart', HEARTB); await SP.idb.put('sim_glyco', GLYB); await SP.idb.put('sim_glyco_zn', past); await SP.idb.put('sim_sub_st', sub);
      const ecg = await ecgImage(); if (ecg) { await SP.idb.put('sim_ecg', ecg); st.classItems.push({ id: 'i_ecg', classId: 'ph', by: 'dP', type: 'gallery', title: 'صور السبورة: تخطيط القلب', ts: T(-4, 12), desc: 'رسم توضيحي لموجات ECG الطبيعية.', images: [{ fileId: 'sim_ecg', caption: 'موجات P وQRS وT', mime: 'image/png' }] }); }
    } catch (e) { /* المحاكاة تعمل حتى لو تعذّر حفظ الملفات */ }
    st.files.push({ id: 'sim_glyco_zn', ownerId: 'st', name: 'أسئلة سنوات سابقة - أيض.txt', mime: 'text/plain', size: 400, tags: ['مستلم'], color: '', star: false, stickers: [], kind: 'file', classId: '', added: T(0, 8), desc: 'من زينب: هاي أسئلة السنة الماضية', pages: 0, readPages: 0 });
    SP.replaceState(st); SP.fillWho && SP.fillWho(); SP.applyTheme && SP.applyTheme(); SP.go('home'); SP.route && SP.route(); SP.updateBell && SP.updateBell();
    SP.toast('حُمّلت محاكاة طالب الطب: أنت الآن «حسن»، المرحلة الثانية'); SP.emit('react', 'celebrate');
  };
  SP.offerMedSim = () => SP.confirm('سيتم استبدال بياناتك الحالية في هذا المتصفح بمحاكاة طالب طب (حسن، المرحلة الثانية) مع مواده وامتحاناته. متابعة؟').then((ok) => ok && SP.loadMedSim());
})();
