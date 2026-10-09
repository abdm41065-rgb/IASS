/* المشاركة · الإعدادات · البحث */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const KINDS = { info: ['💡', 'معلومة'], question: ['❓', 'سؤال'], link: ['🔗', 'رابط/مصدر'], announcement: ['📢', 'إعلان'] };
  const str = (v, n = 5000) => String(v == null ? '' : v).slice(0, n);

  /* ---------- مشاركة المعلومات (موجز) ---------- */
  SP.feed = (classId) => {
    const root = h('div', {}); let kind = 'info', filter = '';
    const text = h('textarea', { class: 'inp', placeholder: 'شارك معلومة، سؤالاً، أو مصدراً مفيداً…' }), tags = SP.tagInput([]);
    const kindSel = h('select', { class: 'inp', onchange: (e) => (kind = e.target.value) }, Object.entries(KINDS).filter(([k]) => k !== 'announcement' || (SP.isTeacher() && classId)).map(([k, [i, l]]) => h('option', { value: k }, i + ' ' + l)));
    const cls = classId != null && classId !== '' ? null : SP.classSelect('', false), list = h('div', {});
    const canDel = (p) => p.authorId === SP.state.me || (p.classId && (SP.classById(p.classId) || {}).teacherId === SP.state.me);
    const draw = () => {
      const posts = S().posts.filter((p) => (classId ? p.classId === classId : filter ? p.classId === filter : !p.classId || SP.canSeeClass(p.classId))).sort((a, b) => b.pinned - a.pinned || b.ts - a.ts);
      list.replaceChildren(...(posts.length ? posts.map((p) => {
        const u = SP.user(p.authorId), c = h('input', { class: 'inp', placeholder: 'اكتب تعليقاً…', style: { flex: 1 } });
        const send = () => { if (!c.value.trim()) return; p.comments.push({ id: SP.uid(), authorId: SP.state.me, text: c.value.trim(), ts: Date.now() }); SP.save(); draw(); };
        return h('div', { class: 'card', style: { marginBottom: '10px' } }, h('div', { class: 'row sp' }, h('span', { class: 'row' }, SP.avatar(u), h('div', {}, h('b', {}, u.name), h('div', { class: 'sub', style: { margin: 0 } }, SP.date(p.ts) + (p.classId ? ' · ' + SP.className(p.classId) : ' · عام')))), h('span', {}, p.pinned ? '📌 ' : '', h('span', { class: 'chip' }, KINDS[p.kind][0] + ' ' + KINDS[p.kind][1]))),
          h('p', { style: { margin: '10px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, p.text), h('div', {}, (p.tags || []).map((t) => h('span', { class: 'chip' }, '#' + t))),
          h('div', { class: 'row', style: { margin: '8px 0' } }, h('button', { class: 'btn ghost sm', onclick: () => { const i = p.likes.indexOf(SP.state.me); i < 0 ? p.likes.push(SP.state.me) : p.likes.splice(i, 1); SP.save(); draw(); } }, (p.likes.includes(SP.state.me) ? '❤️ ' : '🤍 ') + p.likes.length),
            canDel(p) ? [h('button', { class: 'btn ghost sm', onclick: () => { p.pinned = !p.pinned; SP.save(); draw(); } }, p.pinned ? 'إلغاء التثبيت' : '📌 تثبيت'), h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('حذف المنشور؟')) { S().posts = S().posts.filter((x) => x.id !== p.id); SP.save(); draw(); } } }, '🗑️')] : null),
          p.comments.map((m) => h('div', { class: 'row', style: { background: 'var(--bg)', borderRadius: '10px', padding: '6px 10px', marginBottom: '4px' } }, h('b', {}, SP.user(m.authorId).name + ':'), h('span', {}, m.text))),
          h('div', { class: 'row' }, c, h('button', { class: 'btn sm', onclick: send }, 'رد')));
      }) : [SP.empty('لا منشورات بعد. كن أول من يشارك!')]));
    };
    root.append(h('div', { class: 'card' }, text, h('div', { class: 'row', style: { marginTop: '8px' } }, kindSel, cls, tags, h('button', { class: 'btn', onclick: () => {
      if (!text.value.trim()) return SP.toast('اكتب شيئاً أولاً', 'err');
      S().posts.push({ id: SP.uid(), classId: classId || (cls ? cls.value : ''), authorId: SP.state.me, kind, text: text.value.trim(), tags: SP.parseTags(tags.value), likes: [], comments: [], pinned: false, ts: Date.now() });
      SP.save(); text.value = ''; tags.value = ''; draw();
    } }, 'نشر'))), (classId == null || classId === '') ? h('div', { class: 'row', style: { margin: '10px 0' } }, h('label', {}, 'عرض: ', h('select', { class: 'inp', onchange: (e) => { filter = e.target.value; draw(); } }, h('option', { value: '' }, 'الكل'), SP.myClasses().map((c) => h('option', { value: c.id }, c.name))))) : null, h('div', { style: { marginTop: '12px' } }, list)); draw(); return root;
  };

  /* حزم المشاركة: تصدير/استيراد ملف JSON (للتبادل بين الأجهزة) */
  function exportPack() {
    const s = S(), me = SP.state.me, sel = new Set(), items = [
      ...s.notes.filter((n) => n.ownerId === me).map((x) => ['note', x, x.title]), ...s.decks.filter((d) => d.ownerId === me).map((x) => ['deck', x, x.name]), ...s.quizzes.filter((q) => q.by === me).map((x) => ['quiz', x, x.title])];
    SP.modal({ title: 'تصدير حزمة مشاركة', body: items.length ? h('div', {}, items.map(([t, x, label]) => h('label', { style: { display: 'block' } }, h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? sel.add(x.id) : sel.delete(x.id)) }), ` ${{ note: '📝', deck: '🃏', quiz: '❓' }[t]} ${label}`))) : SP.empty('لا شيء لتصديره'),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'تصدير', primary: true, onclick: (c) => {
        const pack = { type: 'sp-share', v: 1, from: SP.me().name, notes: [], decks: [], quizzes: [] };
        items.filter(([, x]) => sel.has(x.id)).forEach(([t, x]) => pack[t + 's'].push(x));
        if (!sel.size) return SP.toast('اختر عنصراً واحداً على الأقل', 'err');
        SP.download('study-share.json', JSON.stringify(pack, null, 1), 'application/json'); c();
      } }] });
  }
  function importPack(file) {
    file.text().then((t) => {
      let p; try { p = JSON.parse(t); } catch (e) { return SP.toast('الملف ليس JSON صالحاً', 'err'); }
      if (!p || p.type !== 'sp-share') return SP.toast('هذا ليس ملف مشاركة من المنصة', 'err');
      const me = SP.state.me, now = Date.now(); let n = 0; const arr = (x) => (Array.isArray(x) ? x.slice(0, 200) : []);
      arr(p.notes).forEach((x) => { S().notes.push({ id: SP.uid(), ownerId: me, title: str(x.title, 200), body: str(x.body, 20000), color: SP.COLORS.includes(x.color) ? x.color : SP.COLORS[2], pinned: false, tags: arr(x.tags).map((y) => str(y, 40)), classId: '', stickers: arr(x.stickers).filter((e) => SP.EMOJIS.includes(e)), updated: now }); n++; });
      arr(p.decks).forEach((x) => { S().decks.push({ id: SP.uid(), ownerId: me, classId: '', name: str(x.name, 200), cards: arr(x.cards).map((c) => ({ id: SP.uid(), q: str(c.q, 500), a: str(c.a, 500), box: 1, due: SP.today() })) }); n++; });
      arr(p.quizzes).forEach((x) => {
        const qs = arr(x.questions).map((q) => { const type = ['mcq', 'tf', 'short'].includes(q.type) ? q.type : 'mcq', opts = type === 'tf' ? ['صح', 'خطأ'] : type === 'mcq' ? arr(q.options).slice(0, 8).map((o) => str(o, 200)) : []; return { id: SP.uid(), type, q: str(q.q, 500), options: opts, answer: type === 'short' ? str(q.answer, 200) : Math.min(Math.max(0, +q.answer || 0), Math.max(0, opts.length - 1)) }; }).filter((q) => q.q && (q.type !== 'mcq' || q.options.length >= 2));
        if (qs.length) { S().quizzes.push({ id: SP.uid(), classId: '', by: me, title: str(x.title, 200), order: S().quizzes.length, timeLimit: Math.max(0, +x.timeLimit || 0), created: now, questions: qs }); n++; }
      });
      SP.save(); SP.toast(`تم استيراد ${n} عنصر من ${str(p.from, 50) || 'مجهول'}`); SP.refresh();
    });
  }
  SP.reg('share', '💬', 'المشاركة', () => {
    const inp = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: (e) => e.target.files[0] && importPack(e.target.files[0]) });
    return SP.page('مشاركة المعلومات', 'تبادل المعلومات والأسئلة مع زملائك ومعلميك، وشارك ملاحظاتك وفويزاتك كملف.',
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: exportPack }, '📤 تصدير حزمة (ملاحظات/بطاقات/فويزات)'), h('button', { class: 'btn ghost', onclick: () => inp.click() }, '📥 استيراد حزمة'), inp), h('div', { style: { marginTop: '14px' } }, SP.feed()));
  });

  /* ---------- الإعدادات ---------- */
  SP.reg('settings', '⚙️', 'الإعدادات', () => {
    const s = S(), name = h('input', { class: 'inp', placeholder: 'اسم المستخدم' }), role = h('select', { class: 'inp' }, h('option', { value: 'student' }, 'طالب'), h('option', { value: 'teacher' }, 'معلم')), restore = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((t) => { try { const d = JSON.parse(t); if (d.v !== 1 || !Array.isArray(d.users) || !Array.isArray(d.classes) || !d.users.some((u) => u.id === d.me)) throw 0; SP.replaceState(d); SP.toast('تمت الاستعادة'); location.reload(); } catch (x) { SP.toast('ملف النسخة الاحتياطية غير صالح', 'err'); } });
    } });
    return SP.page('الإعدادات', 'المستخدمون والمظهر والنسخ الاحتياطي.',
      h('div', { class: 'card' }, h('p', { class: 'sub' }, '⚠️ هذه النسخة تعمل محلياً داخل متصفحك: الأدوار (معلم/طالب) للتنظيم على هذا الجهاز وليست حماية حقيقية، والبيانات لا تُرسل لأي خادم. لمشاركة حقيقية بين أجهزة مختلفة يلزم ربطها بخادم/قاعدة بيانات.')),
      h('h2', {}, 'المستخدمون'), h('div', { class: 'grid s' }, s.users.map((u) => h('div', { class: 'card row sp' }, h('span', { class: 'row' }, SP.avatar(u), h('div', {}, h('b', {}, u.name), h('div', { class: 'sub', style: { margin: 0 } }, u.role === 'teacher' ? 'معلم' : 'طالب'))),
        s.users.length > 1 && u.id !== s.me ? h('button', { class: 'btn ghost sm', 'aria-label': 'حذف', onclick: async () => { if (await SP.confirm('حذف ' + u.name + ' وكل بياناته؟')) { s.users = s.users.filter((x) => x.id !== u.id); s.notes = s.notes.filter((n) => n.ownerId !== u.id); s.decks = s.decks.filter((d) => d.ownerId !== u.id); s.tasks = s.tasks.filter((t) => t.userId !== u.id); s.results = s.results.filter((r) => r.userId !== u.id); s.classes.forEach((c) => (c.memberIds = c.memberIds.filter((m) => m !== u.id))); s.files.filter((f) => f.ownerId === u.id).forEach((f) => SP.idb.del(f.id)); s.files = s.files.filter((f) => f.ownerId !== u.id); SP.save(); SP.refresh(); SP.fillWho && SP.fillWho(); } } }, '🗑️') : null))),
      h('div', { class: 'row', style: { marginTop: '10px' } }, name, role, h('button', { class: 'btn', onclick: () => { if (!name.value.trim()) return; s.users.push({ id: SP.uid(), name: name.value.trim(), role: role.value }); SP.save(); SP.refresh(); SP.fillWho && SP.fillWho(); } }, '➕ إضافة مستخدم')),
      h('h2', {}, 'المظهر'), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => SP.toggleTheme() }, '🌓 تبديل الوضع الليلي'), h('label', {}, 'حجم الخط ', h('select', { class: 'inp', onchange: (e) => { s.fontSize = +e.target.value; SP.save(); SP.applyTheme(); } }, [14, 16, 18, 20].map((n) => h('option', { value: n, selected: s.fontSize === n }, n))))),
      h('h2', {}, 'البيانات'), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => SP.download('study-backup.json', JSON.stringify(s), 'application/json') }, '⬇️ نسخة احتياطية'), h('button', { class: 'btn ghost', onclick: () => restore.click() }, '⬆️ استعادة'), restore,
        h('button', { class: 'btn bad', onclick: async () => { if (await SP.confirm('سيتم مسح كل البيانات والعودة للبيانات التجريبية. متابعة؟')) { SP.reset(); location.reload(); } } }, '🗑️ مسح كل شيء')),
      h('p', { class: 'sub', style: { marginTop: '8px' } }, 'ملاحظة: النسخة الاحتياطية لا تتضمن محتوى الملفات المرفوعة (يُحفظ بمساحة منفصلة في المتصفح).'));
  });

  /* ---------- البحث ---------- */
  SP.reg('search', '🔍', 'بحث', (p) => {
    const q = decodeURIComponent(p[0] || '').trim().toLowerCase(), s = S();
    if (!q) return SP.page('البحث', 'اكتب في خانة البحث بالأعلى.');
    const has = (...x) => x.join(' ').toLowerCase().includes(q);
    const sec = (title, items) => (items.length ? h('div', {}, h('h2', {}, title), h('div', { class: 'grid' }, items)) : null);
    const link = (ic, t, sub, go) => h('div', { class: 'card click', onclick: () => SP.go(go) }, h('b', {}, ic + ' ' + t), h('div', { class: 'sub', style: { margin: 0 } }, sub));
    const out = [
      sec('الملاحظات', s.notes.filter((n) => (n.classId ? SP.canSeeClass(n.classId) : n.ownerId === s.me) && has(n.title, n.body, n.tags.join(' '))).map((n) => link('📝', n.title, n.body.slice(0, 80), 'notes'))),
      sec('الملفات', s.files.filter((f) => (f.classId ? SP.canSeeClass(f.classId) : f.ownerId === s.me) && has(f.name, f.desc, f.tags.join(' '))).map((f) => link('📁', f.name, f.desc || SP.size(f.size), f.kind === 'handout' ? 'handouts' : 'files'))),
      sec('الفويزات', s.quizzes.filter((x) => (x.classId ? SP.canSeeClass(x.classId) : x.by === s.me) && has(x.title, x.questions.map((y) => y.q).join(' '))).map((x) => link('❓', x.title, x.questions.length + ' أسئلة', 'quizzes'))),
      sec('البطاقات', s.decks.filter((d) => (d.ownerId === s.me || (d.classId && SP.canSeeClass(d.classId))) && has(d.name, d.cards.map((c) => c.q + c.a).join(' '))).map((d) => link('🃏', d.name, d.cards.length + ' بطاقة', 'cards/' + d.id))),
      sec('المنشورات', s.posts.filter((x) => (!x.classId || SP.canSeeClass(x.classId)) && has(x.text, (x.tags || []).join(' '))).map((x) => link('💬', x.text.slice(0, 60), SP.user(x.authorId).name, 'share'))),
      sec('الصفوف', SP.myClasses().filter((c) => has(c.name, c.subject)).map((c) => link('🏫', c.name, c.subject, 'classes/' + c.id))),
    ].filter(Boolean);
    return SP.page('نتائج البحث: ' + q, '', out.length ? out : SP.empty('لا نتائج'));
  });
})();
