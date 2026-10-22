/* الرئيسية · الصفوف · المعلمون · الطلاب */
(function () {
  const SP = window.SP, h = SP.h;
  SP.reg = (key, icon, label, render) => { SP.views[key] = { icon, label, render }; };
  const S = () => SP.state;

  /* ---------- الرئيسية ---------- */
  SP.reg('home', '🏠', 'الرئيسية', () => {
    const me = SP.me(), s = S(), uid = me.id, t = SP.today();
    const todayMin = SP.studyMin(uid, t), goal = s.goalMin || 60;
    const tasks = s.tasks.filter((x) => x.userId === uid && !x.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
    SP.migrateNotices && SP.migrateNotices();
    const anns = (s.classItems || []).filter((i) => i.type === 'notice' && SP.canSeeClass(i.classId)).sort((a, b) => (!!b.important - !!a.important) || b.ts - a.ts).slice(0, 3);
    const hr = new Date().getHours(), greet = hr < 12 ? 'صباح الخير' : hr < 18 ? 'نهارك سعيد' : 'مساء الخير';
    const last = (s.docs || []).filter((d) => d.ownerId === uid).sort((a, b) => b.updated - a.updated)[0];
    const next = tasks[0], pct = Math.min(100, Math.round((100 * todayMin) / goal));
    const ex = SP.upcomingExams ? SP.upcomingExams()[0] : null;
    const line = ex && (new Date(`${ex.date}T${ex.time || '08:00'}`) - Date.now()) < 7 * 864e5 ? `امتحان «${ex.title}»: ${SP.countdown(new Date(`${ex.date}T${ex.time || '08:00'}`))}` : next ? `أقرب مهمة: ${next.text}${next.due ? ' (' + next.due + ')' : ''}` : last ? `آخر ما فتحته: «${last.name}»` : 'ابدأ بفتح درس في «دراسة» أو جلسة تركيز قصيرة.';
    const hero = h('section', { class: 'hero', 'aria-label': 'ملخص اليوم' }, h('div', { class: 'hero-fx', 'aria-hidden': 'true' }, ['✦', '✎', '★', '∑', '⌁', '✦', '◯', 'π'].map((c, i) => h('i', { style: `--k:${i}` }, c))), h('span', { class: 'sticker hero-stk', 'aria-hidden': 'true' }, SP.streak(uid) >= 3 ? '🔥' : pct >= 100 ? '🌟' : '✏️'),
      h('div', {}, h('div', { class: 'day' }, new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })),
        h('h1', {}, `${greet}، ${me.name}`), h('p', { class: 'line' }, line),
        h('div', { class: 'meta' }, h('div', {}, h('b', {}, SP.streak(uid)), h('span', {}, 'أيام متتالية')), h('div', {}, h('b', {}, SP.xp(uid)), h('span', {}, 'نقاط')), h('div', {}, h('b', {}, SP.myClasses().length), h('span', {}, 'صفوف'))),
        h('button', { class: 'btn go', onclick: () => SP.go(last ? 'desk/' + last.id : 'desk') }, last ? 'تابع الدراسة' : 'افتح درساً')),
      h('div', { class: 'ring', style: { '--p': pct }, role: 'img', 'aria-label': `دراسة اليوم ${todayMin} من ${goal} دقيقة` }, h('span', {}, h('b', { style: { fontSize: '1.6rem' } }, todayMin + 'د'), h('small', {}, 'من ' + goal + ' دقيقة اليوم'))));
    hero.querySelector('.ring').style.setProperty('--p', pct);
    const simCard = !s.sim && !s.simHide ? h('div', { class: 'card sim-offer' }, h('div', {}, h('b', {}, 'جرّب المنصة كطالب طب 🩺'), h('p', { class: 'sub', style: { margin: '2px 0 0' } }, 'محاكاة كاملة: التشريح والفسلجة والكيمياء الحياتية والأنسجة، مع امتحانات وواجبات وبطاقات.')),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => SP.offerMedSim() }, 'ابدأ المحاكاة'), h('button', { class: 'btn ghost', onclick: () => { s.simHide = true; SP.save(); SP.refresh(); } }, 'لاحقاً'))) : null;
    return h('div', {}, simCard, hero, SP.examStrip && SP.examStrip(), SP.flowHomeCard && SP.flowHomeCard(),
      h('div', { class: 'grid', style: { marginTop: '10px' } },
        h('div', {}, h('h2', {}, 'تبليغات الأساتذة'), anns.length ? anns.map((p) => h('div', { class: 'card click' + (p.important ? ' important' : ''), style: { marginBottom: '8px' }, onclick: () => SP.go('classes/' + p.classId + '/lec') }, h('div', { class: 'row sp' }, h('b', {}, (p.important ? '📌 ' : '📢 ') + p.title), h('span', { class: 'chip' }, SP.className(p.classId))), h('p', { style: { margin: '6px 0 0' } }, p.text.slice(0, 160)))) : SP.empty('لا توجد تبليغات')),
        h('div', {}, h('h2', {}, 'مهام قادمة'), tasks.length ? tasks.map((x) => h('div', { class: 'card', style: { marginBottom: '8px' } }, x.text, ' ', h('span', { class: 'chip' }, x.due || 'بلا موعد'))) : SP.empty('لا مهام معلّقة'))),
      h('nav', { class: 'home-links', 'aria-label': 'روابط سريعة' }, [['calendar', '📅 التقويم'], ['tasks', '✅ المهام والجدول'], ['progress', '📈 تقدّمي'], ['study', '⏱️ جلسة تركيز']].map(([k, l]) => h('a', { href: '#/' + k }, l))));
  });

  /* ---------- الصفوف ---------- */
  function classCard(c) {
    const n = c.memberIds.length;
    return h('div', { class: 'card click', style: { borderTop: `5px solid ${c.color}` }, onclick: () => SP.go('classes/' + c.id) },
      h('h3', {}, c.name), h('p', { class: 'sub' }, c.subject || ''),
      h('div', { class: 'row sp' }, h('span', {}, '' + SP.user(c.teacherId).name), h('span', { class: 'chip' }, n + ' طالب')));
  }
  function newClassModal() {
    const name = h('input', { class: 'inp', style: { width: '100%' }, placeholder: 'مثال: العلوم - الصف الخامس' }), subj = h('input', { class: 'inp', style: { width: '100%' } });
    let color = SP.COLORS[SP.state.classes.length % 8];
    SP.modal({ title: 'إنشاء صف', body: h('div', {}, SP.field('اسم الصف', name), SP.field('المادة', subj), SP.field('اللون', SP.swatches(color, (c) => (color = c)))),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: (c) => {
        if (!name.value.trim()) return SP.toast('اكتب اسم الصف', 'err');
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        SP.state.classes.push({ id: SP.uid(), name: name.value.trim(), subject: subj.value.trim(), color, code, teacherId: SP.state.me, memberIds: [], created: Date.now() });
        SP.save(); c(); SP.refresh(); SP.toast('تم إنشاء الصف. كود الانضمام: ' + code);
      } }] });
  }
  function joinModal() {
    const code = h('input', { class: 'inp', style: { width: '100%' }, placeholder: 'كود الصف' });
    SP.modal({ title: 'الانضمام إلى صف', body: SP.field('أدخل الكود الذي أعطاك إياه المعلم', code),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'انضمام', primary: true, onclick: (c) => {
        const cl = SP.state.classes.find((x) => x.code === code.value.trim().toUpperCase());
        if (!cl) return SP.toast('الكود غير صحيح', 'err');
        if (!cl.memberIds.includes(SP.state.me)) cl.memberIds.push(SP.state.me);
        SP.save(); c(); SP.go('classes/' + cl.id); SP.toast('تم الانضمام إلى ' + cl.name);
      } }] });
  }
  function classDetail(id, startTab) {
    const c = SP.classById(id);
    if (!c || !SP.canSeeClass(id)) return SP.page('الصف غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('classes') }, 'رجوع'));
    const isOwner = SP.isTeacher() && c.teacherId === SP.state.me, root = h('div', {});
    let tab = ['members', 'quizzes', 'files', 'posts', 'prog'].includes(startTab) ? startTab : 'members';
    const draw = () => {
      const s = S(); let body;
      if (tab === 'over') {
        const anns = s.posts.filter((p) => p.classId === id && p.kind === 'announcement').sort((a, b) => b.ts - a.ts);
        const text = h('textarea', { class: 'inp', placeholder: 'اكتب إعلاناً لطلاب الصف…' });
        body = h('div', {},
          isOwner ? h('div', { class: 'card' }, text, h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: () => {
            if (!text.value.trim()) return;
            s.posts.push({ id: SP.uid(), classId: id, authorId: SP.state.me, kind: 'announcement', text: text.value.trim(), tags: ['إعلان'], likes: [], comments: [], pinned: false, ts: Date.now() });
            SP.save(); draw();
          } }, 'نشر إعلان')) : null,
          h('h2', {}, 'الإعلانات'), anns.length ? anns.map((p) => h('div', { class: 'card', style: { marginBottom: '8px' } }, h('p', {}, p.text), h('small', { class: 'sub' }, SP.date(p.ts)))) : SP.empty('لا توجد إعلانات'));
      } else if (tab === 'lec') {
        body = SP.classItemsPanel ? SP.classItemsPanel(id) : h('div');
      } else if (tab === 'members') {
        const addable = s.users.filter((u) => u.role === 'student' && !c.memberIds.includes(u.id)), sel = h('select', { class: 'inp' }, addable.map((u) => h('option', { value: u.id }, u.name)));
        body = h('div', {}, h('div', { class: 'card row' }, h('b', {}, '' + SP.user(c.teacherId).name), h('span', { class: 'chip' }, 'المعلم')),
          isOwner && addable.length ? h('div', { class: 'row', style: { margin: '10px 0' } }, sel, h('button', { class: 'btn', onclick: () => { c.memberIds.push(sel.value); SP.save(); draw(); } }, 'إضافة طالب')) : null,
          h('div', { class: 'grid s', style: { marginTop: '10px' } }, c.memberIds.map((m) => { const u = SP.user(m); return h('div', { class: 'card row sp' }, h('span', { class: 'row' }, SP.avatar(u), u.name), isOwner ? h('button', { class: 'btn sm bad', 'aria-label': 'إزالة', onclick: async () => { if (await SP.confirm('إزالة ' + u.name + ' من الصف؟')) { c.memberIds = c.memberIds.filter((x) => x !== m); SP.save(); draw(); } } }, '✕') : null); })));
      } else if (tab === 'quizzes') {
        body = SP.quizList ? SP.quizList(id) : h('div');
      } else if (tab === 'files') {
        body = SP.fileGrid ? SP.fileGrid({ classId: id }) : h('div');
      } else if (tab === 'posts') {
        body = SP.feed ? SP.feed(id) : h('div');
      } else {
        const rows = c.memberIds.map((m) => ({ u: SP.user(m), avg: SP.avgScore(m), min: SP.studyMin(m), xp: SP.xp(m) })).sort((a, b) => b.xp - a.xp);
        body = rows.length ? h('table', {}, h('thead', {}, h('tr', {}, ['الطالب', 'متوسط الفويزات', 'دقائق الدراسة', 'نقاط XP'].map((x) => h('th', {}, x)))),
          h('tbody', {}, rows.map((r) => h('tr', {}, h('td', {}, r.u.name), h('td', {}, r.avg == null ? '—' : r.avg + '%'), h('td', {}, r.min), h('td', {}, r.xp))))) : SP.empty('لا يوجد طلاب بعد');
      }
      root.replaceChildren(...[
        h('div', { class: 'row sp' }, h('div', {}, h('h1', {}, h('span', { class: 'dot', style: { background: c.color } }), ' ', c.name), h('p', { class: 'sub' }, c.subject || '')),
          h('div', { class: 'row' }, isOwner ? h('span', { class: 'chip', title: 'كود الانضمام' }, 'الكود: ' + c.code) : null,
            isOwner ? h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('حذف الصف نهائياً مع فويزاته ومنشوراته؟')) { const s2 = S(); s2.classes = s2.classes.filter((x) => x.id !== id); s2.quizzes = s2.quizzes.filter((x) => x.classId !== id); s2.posts = s2.posts.filter((x) => x.classId !== id); SP.save(); SP.go('classes'); } } }, 'حذف') : null,
            !isOwner && SP.state.me ? h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('مغادرة الصف؟')) { c.memberIds = c.memberIds.filter((x) => x !== SP.state.me); SP.save(); SP.go('classes'); } } }, 'مغادرة') : null)),
        h('button', { class: 'btn ghost sm', style: { marginBottom: '10px' }, onclick: () => SP.go('classes/' + id) }, 'رجوع إلى المحادثة'), SP.tabs([['members', 'الأعضاء'], ['quizzes', 'الفويزات'], ['files', 'الملفات'], ['posts', 'النقاش'], ['prog', 'التقدم']], tab, (k) => { tab = k; draw(); }), body].filter(Boolean));
    };
    draw(); return root;
  }
  SP.classDetail = classDetail; SP.newClassModal = newClassModal; SP.joinModal = joinModal;
  SP.reg('classes', '🏫', 'الصفوف', (p) => {
    if (p[0]) return classDetail(p[0], p[1]);
    const list = SP.myClasses();
    return SP.page('الصفوف', SP.isTeacher() ? 'أنشئ صفوفك وشارك الكود مع طلابك.' : 'الصفوف التي انضممت إليها.',
      h('div', { class: 'row' }, SP.isTeacher() ? h('button', { class: 'btn', onclick: newClassModal }, 'إنشاء صف') : h('button', { class: 'btn', onclick: joinModal }, 'انضمام بكود')),
      h('div', { class: 'grid', style: { marginTop: '14px' } }, list.length ? list.map(classCard) : SP.empty('لا توجد صفوف بعد')));
  });

  /* ---------- مكان المعلمين ---------- */
  SP.reg('teachers', '👨‍🏫', 'المعلمون', () => {
    const s = S(), teachers = s.users.filter((u) => u.role === 'teacher'), me = SP.me();
    const dir = h('div', { class: 'grid' }, teachers.map((t) => {
      const cls = s.classes.filter((c) => c.teacherId === t.id);
      return h('div', { class: 'card' }, h('div', { class: 'row' }, SP.avatar(t), h('div', {}, h('b', {}, t.name), h('div', { class: 'sub', style: { margin: 0 } }, cls.length + ' صفوف'))),
        h('div', { style: { marginTop: '8px' } }, cls.map((c) => h('span', { class: 'chip', style: { borderColor: c.color } }, c.name))));
    }));
    if (!SP.isTeacher()) return SP.page('المعلمون', 'تعرّف على معلميك وصفوفهم. اطرح سؤالاً من قسم «المشاركة».', dir,
      h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => SP.go('share') }, 'اسأل معلمك')));
    const mine = SP.myClasses(), pending = s.quizzes.filter((q) => mine.some((c) => c.id === q.classId));
    return SP.page('لوحة المعلم', 'أدواتك لإدارة الصفوف والمتابعة.',
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => SP.go('classes') }, 'إدارة الصفوف'), h('button', { class: 'btn', onclick: () => SP.go('quizzes') }, 'فويز جديد'), h('button', { class: 'btn', onclick: () => SP.go('files') }, 'نشر ملف لصف'), h('button', { class: 'btn', onclick: () => SP.go('students') }, 'متابعة الطلاب')),
      h('h2', {}, 'نتائج الفويزات'),
      pending.length ? h('table', {}, h('thead', {}, h('tr', {}, ['الفويز', 'الصف', 'المحاولات', 'متوسط الدرجات', 'الأفضل'].map((x) => h('th', {}, x)))),
        h('tbody', {}, pending.map((q) => { const rs = s.results.filter((r) => r.quizId === q.id), top = SP.bestResults(q.id)[0];
          return h('tr', {}, h('td', {}, q.title), h('td', {}, SP.className(q.classId)), h('td', {}, rs.length), h('td', {}, rs.length ? Math.round(100 * rs.reduce((a, r) => a + r.score / r.total, 0) / rs.length) + '%' : '—'), h('td', {}, top ? SP.user(top.userId).name + ' (' + top.score + '/' + top.total + ')' : '—')); }))) : SP.empty('لم تنشئ فويزات بعد'),
      h('h2', {}, 'المعلمون في المنصة'), dir);
  });

  /* ---------- مكان الطلاب ---------- */
  function studentModal(u) {
    const s = S(), rs = s.results.filter((r) => r.userId === u.id).sort((a, b) => b.ts - a.ts);
    SP.modal({ title: u.name, wide: true, body: h('div', {}, h('div', { class: 'grid s' },
      h('div', { class: 'card stat' }, h('b', {}, SP.avgScore(u.id) == null ? '—' : SP.avgScore(u.id) + '%'), h('span', {}, 'متوسط الفويزات')),
      h('div', { class: 'card stat' }, h('b', {}, SP.studyMin(u.id)), h('span', {}, 'دقائق الدراسة')),
      h('div', { class: 'card stat' }, h('b', {}, SP.xp(u.id)), h('span', {}, 'نقاط XP'))),
      h('h2', {}, 'آخر النتائج'), rs.length ? h('table', {}, rs.slice(0, 10).map((r) => { const q = s.quizzes.find((x) => x.id === r.quizId); return h('tr', {}, h('td', {}, q ? q.title : 'محذوف'), h('td', {}, r.score + '/' + r.total), h('td', {}, SP.date(r.ts))); })) : SP.empty('لا نتائج')),
      actions: [{ label: 'إغلاق', onclick: (c) => c() }] });
  }
  SP.reg('students', '🎓', 'الطلاب', () => {
    const s = S(), me = SP.me();
    let ids;
    if (SP.isTeacher()) ids = [...new Set(SP.myClasses().flatMap((c) => c.memberIds))];
    else ids = [...new Set(SP.myClasses().flatMap((c) => c.memberIds).concat(me.id))];
    const rows = ids.map((id) => SP.user(id)).sort((a, b) => SP.xp(b.id) - SP.xp(a.id));
    const badges = (u) => [SP.xp(u.id) >= 20 && '⭐', SP.streak(u.id) >= 3 && '🔥', (SP.avgScore(u.id) || 0) >= 80 && '🏆'].filter(Boolean).join(' ');
    return SP.page('الطلاب', SP.isTeacher() ? 'متابعة طلاب صفوفك.' : 'زملاؤك في الصفوف ولوحة الشرف.',
      rows.length ? h('div', { class: 'grid' }, rows.map((u, i) => h('div', { class: 'card ' + (SP.isTeacher() ? 'click' : ''), onclick: () => SP.isTeacher() && studentModal(u) },
        h('div', { class: 'row' }, SP.avatar(u), h('div', {}, h('b', {}, u.name + (u.id === me.id ? ' (أنت)' : '')), h('div', { class: 'sub', style: { margin: 0 } }, `#${i + 1} · ${SP.xp(u.id)} XP ${badges(u)}`))),
        h('div', { class: 'bar', style: { marginTop: '10px' } }, h('i', { style: { width: Math.min(100, SP.avgScore(u.id) || 0) + '%' } })),
        h('small', { class: 'sub' }, 'متوسط الفويزات: ' + (SP.avgScore(u.id) == null ? '—' : SP.avgScore(u.id) + '%'))))) : SP.empty('لا يوجد طلاب بعد. أضف طلاباً من صفحة الصف.'));
  });
})();
