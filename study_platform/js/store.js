/* الحالة + التخزين: localStorage للبيانات، IndexedDB للملفات (حجم كبير) */
(function () {
  const SP = (window.SP = { views: {}, nav: [], cleanups: [], listeners: {} });
  SP.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  SP.today = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  SP.COLORS = ['#1F4E99', '#3A6FB8', '#0F2E5C', '#5B8BD1', '#2C5F8A', '#7EA3D6', '#163A70', '#9DB8E0'];
  SP.EMOJIS = ['⭐', '🔥', '💡', '✅', '❗', '❓', '📌', '🎯', '🏆', '🧠', '📖', '✏️', '🔬', '🧮', '🌍', '🎨', '🎵', '💻', '⚡', '🚀', '👍', '❤️', '😀', '🤔', '🌟', '📅', '⏰', '🔖'];
  SP.DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  const KEY = 'sp_state_v1';

  SP.sampleDoc = (owner) => ({ id: SP.uid(), ownerId: owner, name: 'دفتر تجريبي', kind: 'blank', fileId: '', created: Date.now(), updated: Date.now(), pages: [{ a: [
    { id: SP.uid(), t: 'text', x: 0.62, y: 0.07, s: 0.045, c: '#1F4E99', v: 'هذا دفترك' },
    { id: SP.uid(), t: 'text', x: 0.3, y: 0.15, s: 0.028, c: '#111827', v: 'اكتب على الصفحة، ارسم بالقلم، ظلّل المهم،\nوأشّر بالأسهم، وأضف ملصقات وصوراً وفيديوهات.' },
    { id: SP.uid(), t: 'mark', c: '#FFE14D', w: 0, x1: 0.29, y1: 0.145, x2: 0.9, y2: 0.2 },
    { id: SP.uid(), t: 'arrow', c: '#C62828', w: 0.005, x1: 0.25, y1: 0.42, x2: 0.4, y2: 0.24 },
    { id: SP.uid(), t: 'oval', c: '#2E7D32', w: 0.004, x1: 0.05, y1: 0.42, x2: 0.45, y2: 0.52 },
    { id: SP.uid(), t: 'text', x: 0.12, y: 0.445, s: 0.03, c: '#2E7D32', v: 'جرّب الأدوات' },
    { id: SP.uid(), t: 'stk', x: 0.08, y: 0.06, s: 0.08, e: '⭐' }] }, { a: [] }] });
  SP.sampleItems = (classes) => {
    if (!classes.some((c) => c.id === 'c1')) return [];
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return SP.today(x); };
    return [
      { id: SP.uid(), classId: 'c1', by: 't1', type: 'exam', title: 'امتحان الكسور الشهري', ts: Date.now(), date: d(6), time: '09:00', kind: 'شهري', place: 'القاعة 3', topics: ['جمع الكسور وطرحها', 'ضرب الكسور', 'تبسيط الكسور'], quizId: '' },
      { id: SP.uid(), classId: 'c1', by: 't1', type: 'homework', title: 'حل تمارين صفحة 42', ts: Date.now(), due: d(3), max: 100, desc: 'حل التمارين من 1 إلى 8 وصوّر الحل وارفعه هنا.', fileId: '', fname: '', fmime: '', subs: {} },
    ];
  };
  function seed() {
    const t = SP.today();
    const q1 = SP.uid(), d1 = SP.uid();
    return {
      v: 1, me: 's1', dark: null, fontSize: 16,
      users: [
        { id: 't1', name: 'المعلم أحمد', role: 'teacher' },
        { id: 's1', name: 'علي', role: 'student' },
        { id: 's2', name: 'مريم', role: 'student' },
      ],
      classes: [{ id: 'c1', name: 'الرياضيات', subject: 'رياضيات', color: SP.COLORS[0], code: 'MATH24', teacherId: 't1', memberIds: ['s1', 's2'], created: Date.now() }],
      notes: [{ id: SP.uid(), ownerId: 's1', title: 'مرحباً بك 👋', body: 'هذه ملاحظتك الأولى. يمكنك إضافة وسوم وألوان وملصقات، وتثبيت الملاحظات المهمة.', color: SP.COLORS[2], pinned: true, tags: ['بداية'], classId: '', stickers: ['⭐'], updated: Date.now() }],
      files: [], boards: {}, sessions: [], tasks: [
        { id: SP.uid(), userId: 's1', text: 'مراجعة درس الكسور', done: false, due: t, classId: 'c1', prio: 2 },
      ],
      timetable: {}, goalMin: 60,
      posts: [{ id: SP.uid(), classId: 'c1', authorId: 't1', kind: 'announcement', text: 'أهلاً بكم في صف الرياضيات! الفويز الأول متاح الآن.', tags: ['إعلان'], likes: [], comments: [], pinned: true, ts: Date.now() }],
      decks: [{ id: d1, ownerId: 's1', classId: 'c1', name: 'قوانين الرياضيات', cards: [
        { id: SP.uid(), q: 'مساحة المستطيل؟', a: 'الطول × العرض', box: 1, due: t },
        { id: SP.uid(), q: 'مساحة المثلث؟', a: '½ × القاعدة × الارتفاع', box: 1, due: t },
        { id: SP.uid(), q: 'محيط الدائرة؟', a: '2 × π × نصف القطر', box: 1, due: t }] }],
      quizzes: [{ id: q1, classId: 'c1', by: 't1', title: 'فويز: الأساسيات', order: 0, timeLimit: 0, created: Date.now(), questions: [
        { id: SP.uid(), type: 'mcq', q: 'ما ناتج 7 × 8؟', options: ['54', '56', '58', '64'], answer: 1 },
        { id: SP.uid(), type: 'tf', q: 'العدد 15 عدد أولي.', options: ['صح', 'خطأ'], answer: 1 },
        { id: SP.uid(), type: 'short', q: 'ما ناتج 100 ÷ 4؟', options: [], answer: '25' }] }],
      results: [], docs: [SP.sampleDoc('s1')], classItems: null,
    };
  }

  SP.load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { if (!s.docs) s.docs = [SP.sampleDoc(s.me)]; if (!s.classItems) s.classItems = SP.sampleItems(s.classes); return s; } } catch (e) {} return seed(); };
  SP.state = SP.load();
  if (!SP.state.classItems) SP.state.classItems = SP.sampleItems(SP.state.classes);
  SP.reset = () => { SP.state = seed(); SP.state.classItems = SP.sampleItems(SP.state.classes); SP.save(); };
  SP.replaceState = (s) => { SP.state = s; SP.save(); };
  SP.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(SP.state)); }
    catch (e) { SP.toast && SP.toast('تعذّر الحفظ: مساحة المتصفح ممتلئة', 'err'); }
  };
  SP.on = (ev, fn) => { (SP.listeners[ev] = SP.listeners[ev] || []).push(fn); SP.cleanups.push(() => (SP.listeners[ev] = SP.listeners[ev].filter((f) => f !== fn))); };
  SP.emit = (ev, ...a) => (SP.listeners[ev] || []).slice().forEach((f) => f(...a));

  /* ملفات ثنائية في IndexedDB */
  SP.idb = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('sp_files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const t = db.transaction('f', mode); const out = fn(t.objectStore('f'));
      t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error);
    }));
    return { put: (k, v) => tx('readwrite', (s) => s.put(v, k)), get: (k) => tx('readonly', (s) => s.get(k)), del: (k) => tx('readwrite', (s) => s.delete(k)) };
  })();

  /* مساعدات الصلاحيات والبيانات */
  SP.user = (id) => SP.state.users.find((u) => u.id === id) || { id, name: 'مستخدم محذوف', role: 'student' };
  SP.me = () => SP.user(SP.state.me);
  SP.isTeacher = () => SP.me().role === 'teacher';
  SP.myClasses = () => SP.state.classes.filter((c) => (SP.isTeacher() ? c.teacherId === SP.state.me : c.memberIds.includes(SP.state.me)));
  SP.classById = (id) => SP.state.classes.find((c) => c.id === id);
  SP.className = (id) => (SP.classById(id) || {}).name || '';
  SP.canSeeClass = (id) => !id || SP.myClasses().some((c) => c.id === id);
  SP.studyMin = (uid, day) => SP.state.sessions.filter((s) => s.userId === uid && (!day || s.day === day)).reduce((a, s) => a + s.min, 0);
  SP.streak = (uid) => {
    const days = new Set(SP.state.sessions.filter((s) => s.userId === uid).map((s) => s.day));
    let n = 0; const d = new Date();
    if (!days.has(SP.today(d))) d.setDate(d.getDate() - 1);
    while (days.has(SP.today(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  SP.bestResults = (quizId) => {
    const best = {};
    SP.state.results.filter((r) => r.quizId === quizId).forEach((r) => {
      const b = best[r.userId];
      if (!b || r.score > b.score || (r.score === b.score && r.secs < b.secs)) best[r.userId] = r;
    });
    return Object.values(best).sort((a, b) => b.score / b.total - a.score / a.total || a.secs - b.secs);
  };
  SP.avgScore = (uid) => {
    const mine = {}; SP.state.results.filter((r) => r.userId === uid).forEach((r) => { const p = r.score / r.total; mine[r.quizId] = Math.max(mine[r.quizId] || 0, p); });
    const v = Object.values(mine); return v.length ? Math.round((100 * v.reduce((a, b) => a + b, 0)) / v.length) : null;
  };
  SP.xp = (uid) => {
    const s = SP.state;
    const quiz = Math.round(Object.values(s.results.filter((r) => r.userId === uid).reduce((m, r) => ((m[r.quizId] = Math.max(m[r.quizId] || 0, r.score / r.total)), m), {})).reduce((a, b) => a + b * 10, 0));
    return quiz + Math.floor(SP.studyMin(uid) / 5) + 2 * s.notes.filter((n) => n.ownerId === uid).length + 2 * s.files.filter((f) => f.ownerId === uid).length + 3 * s.posts.filter((p) => p.authorId === uid).length;
  };
})();
