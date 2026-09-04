/* ── الأقسام والمنتجات ─────────────────────────────────────────────────────
   لإضافة منتج: انسخ أي عنصر وعدّل حقوله. الحقول:

     id       معرّف فريد لا يتكرّر (يُستعمل في السلة)
     name     الاسم المعروض بالعربية
     latin    اسم المنتج كما هو على العبوة
     brand    الماركة
     cat      معرّف القسم من قائمة CATEGORIES أدناه
     size     الحجم أو العدد
     price    السعر بالدينار العراقي (رقم بلا فواصل)
     was      السعر قبل التخفيض — احذف الحقل إذا لا يوجد عرض
     note     سطر واحد يوصف الاستعمال
     form     شكل الرسم التوضيحي: bottle | tube | pump | jar | dropper | rollon | box
     tags     وسوم قصيرة تظهر على البطاقة
     image    مسار صورة حقيقية للمنتج — عند تعبئته تحلّ محلّ الرسم التوضيحي

   المعروض هنا مستحضرات عناية وتجميل ومكمّلات فقط، مطابقةً لنطاق خدمة
   التوصيل المعلن. الأدوية التي تُصرف بوصفة لا تُباع عبر الموقع.
   ------------------------------------------------------------------------ */

window.HM_CATEGORIES = [
  { id: 'skin', name: 'العناية بالبشرة',      desc: 'منظّفات وسيرومات ومرطّبات' },
  { id: 'sun',  name: 'واقيات الشمس',          desc: 'حماية يومية بعوامل مختلفة' },
  { id: 'hair', name: 'العناية بالشعر',        desc: 'تساقط، قشرة، وترطيب' },
  { id: 'body', name: 'العناية الشخصية',       desc: 'الجسم واليدين ومزيلات التعرّق' },
  { id: 'supp', name: 'الفيتامينات والمكمّلات', desc: 'دعم يومي للبشرة والشعر والمناعة' }
];

window.HM_PRODUCTS = [

  /* ── العناية بالبشرة ─────────────────────────────────────────────────── */
  { id: 'sk-01', name: 'ماء ميسيلار للبشرة الحسّاسة', latin: 'Sensibio H2O', brand: 'Bioderma',
    cat: 'skin', size: '500 مل', price: 28000, form: 'bottle',
    note: 'يزيل المكياج وأوساخ اليوم دون شطف ودون تهييج.',
    tags: ['بشرة حسّاسة', 'بدون عطر'], image: null },

  { id: 'sk-02', name: 'غسول رغوي منظّف', latin: 'Foaming Facial Cleanser', brand: 'CeraVe',
    cat: 'skin', size: '473 مل', price: 35000, form: 'pump',
    note: 'للبشرة الدهنية والمختلطة، يحافظ على حاجز البشرة.',
    tags: ['بشرة دهنية', 'سيراميدات'], image: null },

  { id: 'sk-03', name: 'سيروم فيتامين C بتركيز 20%', latin: 'Vitamin C 20% Serum', brand: 'Nacomi',
    cat: 'skin', size: '30 مل', price: 24000, was: 29000, form: 'dropper',
    note: 'يُستعمل صباحاً لتوحيد اللون، مع واقي شمس بعده.',
    tags: ['توحيد اللون', 'صباحي'], image: null },

  { id: 'sk-04', name: 'سيروم نياسيناميد 10% + زنك', latin: 'Niacinamide 10% + Zinc 1%', brand: 'The Ordinary',
    cat: 'skin', size: '30 مل', price: 16000, form: 'dropper',
    note: 'يقلّل مظهر المسام ولمعان البشرة الدهنية.',
    tags: ['المسام', 'الدهنية'], image: null },

  { id: 'sk-05', name: 'كريم معالج للحبوب', latin: 'Effaclar Duo+', brand: 'La Roche-Posay',
    cat: 'skin', size: '40 مل', price: 38000, form: 'tube',
    note: 'للبشرة المعرّضة للحبوب وآثارها، يُوضع موضعياً أو على كامل الوجه.',
    tags: ['حبوب', 'آثار'], image: null },

  { id: 'sk-06', name: 'بلسم مرمّم متعدّد الاستعمال', latin: 'Cicaplast Baume B5', brand: 'La Roche-Posay',
    cat: 'skin', size: '40 مل', price: 27000, form: 'tube',
    note: 'يهدّئ الجفاف والتشقّق والاحمرار بعد التقشير أو الحلاقة.',
    tags: ['مهدّئ', 'للعائلة'], image: null },

  { id: 'sk-07', name: 'كريم نهاري مضاد للتجاعيد', latin: 'Hyaluron-Filler Day SPF 30', brand: 'Eucerin',
    cat: 'skin', size: '50 مل', price: 55000, form: 'jar',
    note: 'يملأ الخطوط الدقيقة ويحمي من الأشعة في خطوة واحدة.',
    tags: ['مكافحة التجاعيد', 'SPF 30'], image: null },

  { id: 'sk-08', name: 'كريم مرطّب للمناطق الجافة', latin: 'Bariéderm Cica-Crème', brand: 'Uriage',
    cat: 'skin', size: '40 مل', price: 30000, form: 'tube',
    note: 'يعزل ويعيد بناء الجلد المتضرّر من الجفاف الشديد.',
    tags: ['جفاف شديد', 'حاجز واقٍ'], image: null },

  { id: 'sk-09', name: 'كريم مرطّب بماء حراري', latin: 'Eau Thermale Water Cream', brand: 'Uriage',
    cat: 'skin', size: '40 مل', price: 34000, form: 'jar',
    note: 'ترطيب خفيف لا يترك أثراً دهنياً، مناسب تحت المكياج.',
    tags: ['ترطيب خفيف', 'يومي'], image: null },

  { id: 'sk-10', name: 'رذاذ ماء حراري مهدّئ', latin: 'Thermal Spring Water', brand: 'Avène',
    cat: 'skin', size: '300 مل', price: 25000, form: 'bottle',
    note: 'يهدّئ الاحمرار وحرارة الجلد بعد الشمس أو الحلاقة.',
    tags: ['مهدّئ', 'بعد الشمس'], image: null },

  { id: 'sk-11', name: 'مرطّب يومي للبشرة الجافة', latin: 'QV Cream', brand: 'QV',
    cat: 'skin', size: '250 غم', price: 22000, form: 'jar',
    note: 'قوام غنيّ بلا عطر، مناسب للبشرة شديدة الجفاف والأطفال.',
    tags: ['بدون عطر', 'عائلي'], image: null },

  { id: 'sk-12', name: 'كريم موضعي لمحيط العين', latin: 'Hyaluron-Filler Eye Care', brand: 'Eucerin',
    cat: 'skin', size: '15 مل', price: 46000, form: 'tube',
    note: 'لمنطقة العين الرقيقة: الخطوط الدقيقة والانتفاخ.',
    tags: ['محيط العين'], image: null },

  /* ── واقيات الشمس ────────────────────────────────────────────────────── */
  { id: 'sn-01', name: 'واقي شمس مائي الملمس SPF 50', latin: 'Fusion Water SPF 50+', brand: 'ISDIN',
    cat: 'sun', size: '50 مل', price: 40000, was: 45000, form: 'tube',
    note: 'يمتصّ فوراً بلا أثر أبيض، مناسب للاستعمال اليومي تحت المكياج.',
    tags: ['SPF 50+', 'الأكثر طلباً'], image: null },

  { id: 'sn-02', name: 'واقي شمس ملوّن SPF 50', latin: 'Fusion Water Color SPF 50+', brand: 'ISDIN',
    cat: 'sun', size: '50 مل', price: 44000, form: 'tube',
    note: 'درجة لون موحّدة تُغني عن كريم الأساس الخفيف.',
    tags: ['SPF 50+', 'ملوّن'], image: null },

  { id: 'sn-03', name: 'واقي شمس للبشرة الدهنية SPF 50', latin: 'Oil Control Fluid SPF 50+', brand: 'Eucerin',
    cat: 'sun', size: '50 مل', price: 47000, form: 'tube',
    note: 'لمسة نهائية مطفية تضبط اللمعان طوال اليوم.',
    tags: ['SPF 50+', 'مطفي'], image: null },

  { id: 'sn-04', name: 'واقي شمس معدني للبشرة الحسّاسة', latin: 'Bariésun Mineral Cream SPF 50+', brand: 'Uriage',
    cat: 'sun', size: '100 مل', price: 42000, form: 'tube',
    note: 'فلاتر معدنية فقط، مناسب للبشرة شديدة الحساسية والأطفال.',
    tags: ['SPF 50+', 'معدني'], image: null },

  /* ── العناية بالشعر ──────────────────────────────────────────────────── */
  { id: 'hr-01', name: 'شامبو مقوٍّ للشعر المتساقط', latin: 'Anaphase+ Shampoo', brand: 'Ducray',
    cat: 'hair', size: '200 مل', price: 26000, form: 'bottle',
    note: 'شامبو مكمّل لبرنامج علاج التساقط، يُستعمل مرتين إلى ثلاث أسبوعياً.',
    tags: ['تساقط', 'مكمّل'], image: null },

  { id: 'hr-02', name: 'شامبو للقشرة الدهنية', latin: 'Kelual DS Shampoo', brand: 'Ducray',
    cat: 'hair', size: '100 مل', price: 30000, form: 'bottle',
    note: 'للقشرة الشديدة والحكّة في فروة الرأس الدهنية.',
    tags: ['قشرة', 'فروة دهنية'], image: null },

  { id: 'hr-03', name: 'شامبو مضاد للقشرة', latin: 'Dercos Anti-Dandruff', brand: 'Vichy',
    cat: 'hair', size: '200 مل', price: 29000, form: 'bottle',
    note: 'استعمال يومي ممكن، يخفّف الحكّة من الأسبوع الأول.',
    tags: ['قشرة', 'يومي'], image: null },

  { id: 'hr-04', name: 'سيروم مركّز لجذور الشعر', latin: 'Neoptide Expert Serum', brand: 'Ducray',
    cat: 'hair', size: '30 مل × 3', price: 78000, form: 'dropper',
    note: 'يُطبّق على فروة نظيفة يومياً، والنتيجة تُقيَّم بعد ثلاثة أشهر.',
    tags: ['كورس 3 أشهر'], image: null },

  { id: 'hr-05', name: 'بلسم مرمّم للشعر التالف', latin: 'Renu Repair Conditioner', brand: 'inoPharm',
    cat: 'hair', size: '250 مل', price: 21000, form: 'bottle',
    note: 'للشعر المصبوغ أو المعرّض للحرارة، يقلّل التشابك والتقصّف.',
    tags: ['ترميم', 'مصبوغ'], image: null },

  /* ── العناية الشخصية ─────────────────────────────────────────────────── */
  { id: 'bd-01', name: 'غسول لطيف للجسم', latin: 'Gentle Wash', brand: 'QV',
    cat: 'body', size: '250 مل', price: 18000, form: 'pump',
    note: 'بديل الصابون للبشرة الجافة والحسّاسة، لا يسبّب الشدّ بعد الاستحمام.',
    tags: ['بدون صابون'], image: null },

  { id: 'bd-02', name: 'كريم مرطّب للجسم', latin: 'Atoderm Crème', brand: 'Bioderma',
    cat: 'body', size: '500 مل', price: 32000, form: 'pump',
    note: 'ترطيب يومي للجلد الجاف والمتقشّر على الذراعين والساقين.',
    tags: ['جفاف الجسم'], image: null },

  { id: 'bd-03', name: 'مزيل تعرّق للبشرة الحسّاسة', latin: 'Deodorant Roll-On 48h', brand: 'Vichy',
    cat: 'body', size: '50 مل', price: 22000, form: 'rollon',
    note: 'فعّالية 48 ساعة بلا كحول، مناسب بعد إزالة الشعر.',
    tags: ['بدون كحول', '48 ساعة'], image: null },

  { id: 'bd-04', name: 'كريم مكثّف لليدين', latin: 'Bariéderm Hand Cream', brand: 'Uriage',
    cat: 'body', size: '75 مل', price: 19000, form: 'tube',
    note: 'يعالج تشقّق اليدين من غسل اليدين المتكرّر والبرد.',
    tags: ['تشقّق اليدين'], image: null },

  /* ── الفيتامينات والمكمّلات ──────────────────────────────────────────── */
  { id: 'sp-01', name: 'فيتامين د3 — 5000 وحدة', latin: 'Vitamin D3 5000 IU', brand: 'مكمّل غذائي',
    cat: 'supp', size: '60 كبسولة', price: 18000, form: 'box',
    note: 'يُؤخذ مع وجبة دسمة لتحسين الامتصاص.',
    tags: ['كبسولات'], image: null },

  { id: 'sp-02', name: 'أوميغا 3 — زيت السمك', latin: 'Omega 3 Fish Oil 1000mg', brand: 'مكمّل غذائي',
    cat: 'supp', size: '60 كبسولة', price: 25000, form: 'box',
    note: 'دعم للقلب والمفاصل وجفاف البشرة.',
    tags: ['كبسولات'], image: null },

  { id: 'sp-03', name: 'بيوتين للشعر والأظافر', latin: 'Biotin 10000 mcg', brand: 'مكمّل غذائي',
    cat: 'supp', size: '60 قرص', price: 20000, form: 'box',
    note: 'يُستعمل ضمن برنامج متكامل لتقوية الشعر والأظافر.',
    tags: ['شعر وأظافر'], image: null },

  { id: 'sp-04', name: 'زنك — 50 ملغم', latin: 'Zinc 50mg', brand: 'مكمّل غذائي',
    cat: 'supp', size: '100 قرص', price: 12000, form: 'box',
    note: 'مساند للمناعة وللبشرة المعرّضة للحبوب.',
    tags: ['مناعة'], image: null },

  { id: 'sp-05', name: 'كولاجين بحري + فيتامين C', latin: 'Marine Collagen + Vitamin C', brand: 'مكمّل غذائي',
    cat: 'supp', size: '30 كيس', price: 45000, form: 'box',
    note: 'يُذاب في الماء ويُشرب يومياً، ويُقيَّم بعد ثمانية أسابيع.',
    tags: ['أكياس'], image: null },

  { id: 'sp-06', name: 'حديد + حمض الفوليك', latin: 'Iron + Folic Acid', brand: 'مكمّل غذائي',
    cat: 'supp', size: '30 كبسولة', price: 15000, form: 'box',
    note: 'يُفضَّل تناوله بعيداً عن الشاي والحليب.',
    tags: ['كبسولات'], image: null }
];
