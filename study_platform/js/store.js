/* الحالة + التخزين: localStorage للبيانات، IndexedDB للملفات (حجم كبير) */
(function () {
  const SP = (window.SP = { views: {}, nav: [], cleanups: [], listeners: {} });
  SP.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  SP.today = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  SP.COLORS = ['#007AFF', '#5AC8FA', '#0A4FB3', '#64A9FF', '#32ADE6', '#1E3A8A', '#3B82F6', '#9CC7FF'];
  SP.EMOJIS = ['⭐', '🔥', '💡', '✅', '❗', '❓', '📌', '🎯', '🏆', '🧠', '📖', '✏️', '🔬', '🧮', '🌍', '🎨', '🎵', '💻', '⚡', '🚀', '👍', '❤️', '😀', '🤔', '🌟', '📅', '⏰', '🔖'];
  SP.DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  const KEY = 'sp_state_v1';

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
      results: [],
    };
  }

  SP.load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) {} return seed(); };
  SP.state = SP.load();
  SP.reset = () => { SP.state = seed(); SP.save(); };
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
