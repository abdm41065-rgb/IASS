/* المحاضرات: فيديو بفصول وتقدّم وملاحظات زمنية · ألبومات صور · مواعيد امتحانات بعدّ تنازلي · واجبات بتسليم ودرجات · التقويم */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const items = () => (S().classItems = S().classItems || []);
  const TYPES = { notice: ['تبليغ', '📢'], explain: ['شرح ومعلومة', '💡'], gallery: ['صور', '🖼️'], lecture: ['محاضرة فيديو', '🎬'], exam: ['موعد امتحان', '📝'], homework: ['واجب', '📚'] };
  const EXAM_KINDS = ['قصير', 'شهري', 'نصف السنة', 'نهائي', 'عملي'];
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const parseT = (s) => { const p = String(s).trim().split(':').map(Number); return p.some(isNaN) ? null : p.reduce((a, b) => a * 60 + b, 0); };
  const examAt = (e) => new Date(`${e.date}T${e.time || '08:00'}`);
  const isTeacherOf = (classId) => (SP.classById(classId) || {}).teacherId === SP.state.me;
  const visible = (i) => SP.canSeeClass(i.classId);
  const urls = new Map();
  const blobUrl = async (k) => { if (!k) return ''; if (urls.has(k)) return urls.get(k); const b = await SP.idb.get(k); const u = b ? URL.createObjectURL(b) : ''; urls.set(k, u); return u; };
  const watch = (id) => { const w = ((S().watch = S().watch || {})[SP.state.me] = S().watch[SP.state.me] || {}); return (w[id] = w[id] || { pos: 0, dur: 0, max: 0, done: false }); };
  const vnotes = (id) => { const n = ((S().vnotes = S().vnotes || {})[SP.state.me] = S().vnotes[SP.state.me] || {}); return (n[id] = n[id] || []); };

  SP.migrateNotices = () => {
    const s = S(); if (s.noticesMigrated) return; s.noticesMigrated = true;
    (s.posts || []).filter((p) => p.kind === 'announcement' && p.classId).forEach((p) => items().push({ id: 'n_' + p.id, classId: p.classId, by: p.authorId, type: 'notice', title: p.text.split(/[.!؟\n]/)[0].slice(0, 70) || 'تبليغ', text: p.text, important: !!p.pinned, ts: p.ts }));
    s.posts = (s.posts || []).filter((p) => !(p.kind === 'announcement' && p.classId)); SP.save();
  };
  SP.importantNotices = () => items().filter((i) => i.type === 'notice' && i.important && visible(i)).sort((a, b) => b.ts - a.ts);
  SP.countdown = (d) => {
    const ms = d - Date.now(); if (ms <= 0) return 'حان الموعد';
    const D = Math.floor(ms / 864e5), H = Math.floor((ms % 864e5) / 36e5), M = Math.floor((ms % 36e5) / 6e4);
    return D ? `باقي ${D} ${D === 1 ? 'يوم' : D === 2 ? 'يومان' : D <= 10 ? 'أيام' : 'يوماً'}${H ? ` و${H} ساعة` : ''}` : H ? `باقي ${H} ساعة و${M} دقيقة` : `باقي ${M} دقيقة`;
  };
  SP.upcomingExams = (classId) => items().filter((i) => i.type === 'exam' && visible(i) && (!classId || i.classId === classId) && examAt(i) > Date.now() - 3 * 36e5).sort((a, b) => examAt(a) - examAt(b));
  const dateLabel = (e) => examAt(e).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' }) + (e.time ? ' · ' + e.time : '');
  const urgency = (e) => { const d = (examAt(e) - Date.now()) / 864e5; return d <= 2 ? 'hot' : d <= 7 ? 'warm' : ''; };
  const live = (el, fn) => { const iv = setInterval(() => { if (!el.isConnected) return clearInterval(iv); el.textContent = fn(); }, 30000); SP.cleanups.push(() => clearInterval(iv)); el.textContent = fn(); return el; };

  /* ---------- شريط الامتحان (أعلى الصف وفي الرئيسية) ---------- */
  SP.examBanner = (classId) => {
    const e = SP.upcomingExams(classId)[0]; if (!e) return null;
    return h('div', { class: 'exam-banner ' + urgency(e), role: 'status' },
      h('div', { class: 'eb-date' }, h('b', {}, examAt(e).getDate()), h('span', {}, examAt(e).toLocaleDateString('ar', { month: 'short' }))),
      h('div', { class: 'eb-main' }, h('div', { class: 'eb-kind' }, 'امتحان ' + (e.kind || '') + (classId ? '' : ' · ' + SP.className(e.classId))), h('b', {}, e.title), h('div', { class: 'eb-when' }, dateLabel(e) + (e.place ? ' · ' + e.place : ''))),
      live(h('div', { class: 'eb-count' }), () => SP.countdown(examAt(e))));
  };
  SP.examStrip = () => {
    const list = SP.upcomingExams().slice(0, 3); if (!list.length) return null;
    return h('section', { class: 'exam-strip', 'aria-label': 'امتحانات قادمة' }, h('h2', {}, 'امتحانات قادمة'),
      h('div', { class: 'grid' }, list.map((e) => h('div', { class: 'card click exam-card ' + urgency(e), onclick: () => SP.go('classes/' + e.classId + '/lec') },
        h('div', { class: 'row sp' }, h('span', { class: 'chip' }, SP.className(e.classId)), h('span', { class: 'chip' }, 'امتحان ' + (e.kind || ''))),
        h('h3', { style: { margin: '8px 0 2px' } }, e.title), h('div', { class: 'sub', style: { margin: 0 } }, dateLabel(e)), live(h('div', { class: 'eb-count' }), () => SP.countdown(examAt(e)))))));
  };

  /* ---------- إنشاء محتوى (للمعلم) ---------- */
  function composer(type, classId) {
    const myCls = SP.myClasses().filter((c) => c.teacherId === SP.state.me);
    if (!myCls.length) return SP.toast('أنشئ صفاً أولاً لتنشر فيه', 'err');
    const cls = h('select', { class: 'inp', id: 'ci-class' }, myCls.map((c) => h('option', { value: c.id, selected: c.id === classId }, c.name)));
    const title = h('input', { class: 'inp', id: 'ci-title', style: { width: '100%' } }), desc = h('textarea', { class: 'inp', id: 'ci-desc', placeholder: 'وصف أو تعليمات' });
    const fields = [SP.field('الصف', cls), SP.field('العنوان', title)]; let read;
    if (type === 'notice') {
      const text = h('textarea', { class: 'inp', id: 'ci-text', placeholder: 'نص التبليغ للطلاب', style: { minHeight: '120px' } }), imp = h('input', { type: 'checkbox', id: 'ci-important' });
      fields.push(SP.field('التبليغ', text), h('label', { class: 'row', style: { marginTop: '10px' } }, imp, ' تبليغ مهم (يُثبَّت أعلى الصف ويظهر في رئيسية الطالب)'));
      read = async () => { if (!text.value.trim()) throw new Error('اكتب نص التبليغ'); return { text: text.value.trim(), important: imp.checked, pinned: imp.checked }; };
    } else if (type === 'explain') {
      const text = h('textarea', { class: 'inp', id: 'ci-text', placeholder: 'اكتب الشرح أو المعلومة. استخدم **نص** للتعريض و- في بداية السطر للنقاط.', style: { minHeight: '180px' } }), imgs = h('input', { type: 'file', id: 'ci-images', accept: 'image/*', multiple: true }), file = h('input', { type: 'file', id: 'ci-attach' });
      fields.push(SP.field('الشرح', text), SP.field('صور توضيحية (اختياري)', imgs), SP.field('ملف مرفق (اختياري)', file));
      read = async () => {
        if (!text.value.trim()) throw new Error('اكتب الشرح');
        const images = []; for (const f of imgs.files) { if (!f.type.startsWith('image/')) continue; const k = SP.uid(); await SP.idb.put(k, f); images.push({ fileId: k, caption: f.name.replace(/\.[^.]+$/, ''), mime: f.type }); }
        let fileId = '', fname = '', fmime = ''; const f = file.files[0]; if (f) { fileId = SP.uid(); fname = f.name; fmime = f.type; await SP.idb.put(fileId, f); }
        return { text: text.value.trim(), images, fileId, fname, fmime };
      };
    } else if (type === 'lecture') {
      const file = h('input', { type: 'file', id: 'ci-video', accept: 'video/*' }), link = h('input', { class: 'inp', id: 'ci-link', placeholder: 'https://… (اختياري بدل رفع فيديو)', style: { width: '100%' } });
      const ch = h('textarea', { class: 'inp', id: 'ci-chapters', placeholder: 'الفصول، سطر لكل فصل:\n00:00 مقدمة\n05:30 الفكرة الأساسية\n12:10 أمثلة محلولة' });
      fields.push(SP.field('ملف الفيديو', file), SP.field('أو رابط المحاضرة', link), SP.field('فصول المحاضرة', ch), SP.field('الوصف', desc));
      read = async () => {
        const f = file.files[0], u = link.value.trim();
        if (!f && !/^https?:\/\//.test(u)) throw new Error('ارفع ملف فيديو أو ضع رابطاً يبدأ بـ https://');
        const chapters = ch.value.split('\n').map((l) => { const m = l.trim().match(/^(\d{1,2}(?::\d{1,2}){1,2})\s+(.+)$/); return m && parseT(m[1]) != null ? { t: parseT(m[1]), label: m[2].slice(0, 80) } : null; }).filter(Boolean).sort((a, b) => a.t - b.t);
        let fileId = ''; if (f) { fileId = SP.uid(); await SP.idb.put(fileId, f); }
        return { fileId, url: f ? '' : u, chapters, desc: desc.value.trim() };
      };
    } else if (type === 'gallery') {
      const file = h('input', { type: 'file', id: 'ci-images', accept: 'image/*', multiple: true });
      fields.push(SP.field('الصور (يمكن اختيار عدة صور)', file), SP.field('الوصف', desc));
      read = async () => {
        if (!file.files.length) throw new Error('اختر صورة واحدة على الأقل');
        const images = []; for (const f of file.files) { if (!f.type.startsWith('image/')) continue; const k = SP.uid(); await SP.idb.put(k, f); images.push({ fileId: k, caption: f.name.replace(/\.[^.]+$/, ''), mime: f.type }); }
        return { images, desc: desc.value.trim() };
      };
    } else if (type === 'exam') {
      const d = new Date(); d.setDate(d.getDate() + 7);
      const date = h('input', { class: 'inp', id: 'ci-date', type: 'date', value: SP.today(d) }), time = h('input', { class: 'inp', id: 'ci-time', type: 'time', value: '09:00' });
      const kind = h('select', { class: 'inp', id: 'ci-kind' }, EXAM_KINDS.map((k, i) => h('option', { selected: i === 1 }, k))), place = h('input', { class: 'inp', id: 'ci-place', placeholder: 'مثال: القاعة 3' });
      const topics = h('textarea', { class: 'inp', id: 'ci-topics', placeholder: 'المواضيع المشمولة، سطر لكل موضوع' });
      const quiz = h('select', { class: 'inp', id: 'ci-quiz' }, h('option', { value: '' }, 'بدون'), S().quizzes.filter((q) => q.by === SP.state.me).map((q) => h('option', { value: q.id }, q.title)));
      fields.push(h('div', { class: 'row' }, SP.field('التاريخ', date), SP.field('الوقت', time), SP.field('النوع', kind)), SP.field('المكان', place), SP.field('المواضيع', topics), SP.field('فويز للتحضير (اختياري)', quiz));
      read = async () => { if (!date.value) throw new Error('حدّد تاريخ الامتحان'); return { date: date.value, time: time.value, kind: kind.value, place: place.value.trim(), topics: topics.value.split('\n').map((x) => x.trim()).filter(Boolean), quizId: quiz.value }; };
    } else {
      const d = new Date(); d.setDate(d.getDate() + 3);
      const due = h('input', { class: 'inp', id: 'ci-due', type: 'date', value: SP.today(d) }), file = h('input', { type: 'file', id: 'ci-attach' }), max = h('input', { class: 'inp', id: 'ci-max', type: 'number', min: 1, value: 100, style: { width: '90px' } });
      fields.push(h('div', { class: 'row' }, SP.field('آخر موعد للتسليم', due), SP.field('الدرجة الكاملة', max)), SP.field('التعليمات', desc), SP.field('ملف مرفق (اختياري)', file));
      read = async () => { if (!due.value) throw new Error('حدّد موعد التسليم'); let fileId = '', fname = '', fmime = ''; const f = file.files[0]; if (f) { fileId = SP.uid(); fname = f.name; fmime = f.type; await SP.idb.put(fileId, f); } return { due: due.value, max: Math.max(1, +max.value || 100), desc: desc.value.trim(), fileId, fname, fmime, subs: {} }; };
    }
    SP.modal({ title: TYPES[type][1] + ' ' + TYPES[type][0] + ' جديد', wide: true, body: h('div', {}, fields),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'نشر للطلاب', primary: true, onclick: async (c) => {
        if (!title.value.trim()) return SP.toast('اكتب العنوان', 'err');
        try { const extra = await read(); items().push({ id: SP.uid(), classId: cls.value, by: SP.state.me, type, title: title.value.trim(), ts: Date.now(), ...extra }); }
        catch (e) { return SP.toast(e.message || 'تعذّر الحفظ', 'err'); }
        SP.save(); c(); SP.toast('نُشر في صف ' + SP.className(cls.value)); SP.emit('react', 'send'); SP.refresh();
      } }] });
  }

  /* ---------- بطاقات المحتوى ---------- */
  function gallery(it) {
    const thumb = (img, i) => { const im = h('img', { alt: img.caption, loading: 'lazy' }); blobUrl(img.fileId).then((u) => (im.src = u)); return h('button', { class: 'g-thumb', 'aria-label': 'عرض ' + img.caption, onclick: () => lightbox(it, i) }, im); };
    return h('div', { class: 'g-grid' }, it.images.slice(0, 6).map(thumb), it.images.length > 6 ? h('button', { class: 'g-thumb more', onclick: () => lightbox(it, 6) }, '+' + (it.images.length - 6)) : null);
  }
  function lightbox(it, i) {
    const img = h('img', { alt: '', style: { maxWidth: '100%', maxHeight: '62vh', display: 'block', margin: 'auto', borderRadius: '10px' } }), cap = h('p', { class: 'sub', style: { textAlign: 'center', margin: '8px 0 0' } }), count = h('span', { class: 'chip' });
    const show = () => { const x = it.images[i]; blobUrl(x.fileId).then((u) => (img.src = u)); cap.textContent = x.caption; count.textContent = `${i + 1} / ${it.images.length}`; };
    const nav = (d) => { i = (i + d + it.images.length) % it.images.length; show(); };
    const key = (e) => { if (e.key === 'ArrowLeft') nav(1); if (e.key === 'ArrowRight') nav(-1); };
    document.addEventListener('keydown', key); show();
    SP.modal({ title: it.title, wide: true, body: h('div', {}, img, cap, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('button', { class: 'btn ghost', onclick: () => nav(-1) }, 'السابقة'), count, h('button', { class: 'btn ghost', onclick: () => nav(1) }, 'التالية'),
      h('button', { class: 'btn', onclick: () => { document.removeEventListener('keydown', key); document.querySelector('.ov').remove(); const x = it.images[i]; SP.openInDesk({ id: x.fileId, name: x.caption + '.png', mime: x.mime || 'image/png' }); } }, 'اكتب عليها في دراسة'))),
      actions: [{ label: 'إغلاق', onclick: (c) => { document.removeEventListener('keydown', key); c(); } }] });
  }
  function homeworkBody(it) {
    const mineSub = (it.subs || {})[SP.state.me], late = SP.today() > it.due, teacher = isTeacherOf(it.classId);
    const status = teacher ? `${Object.keys(it.subs || {}).length} من ${(SP.classById(it.classId) || { memberIds: [] }).memberIds.length} سلّموا`
      : mineSub ? (mineSub.grade != null ? `الدرجة: ${mineSub.grade} / ${it.max}` : 'سُلّم، بانتظار التصحيح') : late ? 'انتهى الموعد ولم تسلّم' : 'لم تسلّم بعد';
    const pick = h('input', { type: 'file', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return; const k = SP.uid(); await SP.idb.put(k, f);
      it.subs = it.subs || {}; it.subs[SP.state.me] = { fileId: k, name: f.name, mime: f.type, ts: Date.now(), late: SP.today() > it.due, grade: null, feedback: '' };
      SP.save(); SP.toast('تم تسليم الواجب'); SP.emit('react', 'happy'); SP.refresh();
    } });
    return h('div', {}, it.desc ? h('p', { style: { whiteSpace: 'pre-wrap' } }, it.desc) : null,
      h('div', { class: 'row' }, h('span', { class: 'chip' + (late && !mineSub && !teacher ? ' on' : '') }, 'التسليم: ' + it.due), h('span', { class: 'chip' }, status)),
      mineSub && mineSub.feedback ? h('div', { class: 'explain' }, 'ملاحظة المعلم: ' + mineSub.feedback) : null,
      h('div', { class: 'row', style: { marginTop: '10px' } },
        it.fileId ? h('button', { class: 'btn ghost sm', onclick: async () => SP.download(it.fname || 'مرفق', await SP.idb.get(it.fileId)) }, 'المرفق') : null,
        teacher ? h('button', { class: 'btn sm', onclick: () => submissions(it) }, 'التسليمات والدرجات') : [h('button', { class: 'btn sm', onclick: () => pick.click() }, mineSub ? 'أعد التسليم' : 'سلّم الواجب'), pick]));
  }
  function submissions(it) {
    const cls = SP.classById(it.classId) || { memberIds: [] };
    SP.modal({ title: 'تسليمات: ' + it.title, wide: true, body: cls.memberIds.length ? h('div', { style: { overflowX: 'auto' } }, h('table', {}, h('thead', {}, h('tr', {}, ['الطالب', 'الملف', 'الوقت', 'الدرجة', 'ملاحظة'].map((x) => h('th', {}, x)))),
      h('tbody', {}, cls.memberIds.map((uid) => { const s = (it.subs || {})[uid];
        return h('tr', {}, h('td', {}, SP.user(uid).name), h('td', {}, s ? (s.fileId ? h('button', { class: 'btn ghost sm', onclick: async () => { const b = await SP.idb.get(s.fileId); b ? SP.download(s.name, b) : SP.toast('الملف غير موجود في هذا المتصفح', 'err'); } }, s.name) : h('span', {}, s.name)) : h('span', { class: 'sub' }, 'لم يسلّم')),
          h('td', {}, s ? SP.date(s.ts) + (s.late ? ' (متأخر)' : '') : '—'),
          h('td', {}, s ? h('input', { class: 'inp', type: 'number', min: 0, max: it.max, value: s.grade == null ? '' : s.grade, style: { width: '80px' }, 'aria-label': 'درجة ' + SP.user(uid).name, onchange: (e) => { s.grade = e.target.value === '' ? null : Math.min(it.max, Math.max(0, +e.target.value)); SP.save(); } }) : '—'),
          h('td', {}, s ? h('input', { class: 'inp', value: s.feedback || '', 'aria-label': 'ملاحظة', onchange: (e) => { s.feedback = e.target.value.slice(0, 300); SP.save(); } }) : '—'));
      })))) : SP.empty('لا طلاب في الصف'), actions: [{ label: 'تم', primary: true, onclick: (c) => { c(); SP.refresh(); } }] });
  }
  function examBody(it) {
    const quiz = it.quizId && S().quizzes.find((q) => q.id === it.quizId);
    const inTasks = S().tasks.some((t) => t.userId === SP.state.me && t.examId === it.id);
    return h('div', {}, h('div', { class: 'exam-when' }, h('b', {}, dateLabel(it)), it.place ? h('span', { class: 'sub', style: { margin: 0 } }, ' · ' + it.place) : null,
      live(h('div', { class: 'eb-count' }), () => SP.countdown(examAt(it)))),
      it.topics && it.topics.length ? h('ul', { class: 'topics' }, it.topics.map((t) => h('li', {}, t))) : null,
      h('div', { class: 'row', style: { marginTop: '10px' } }, quiz ? h('button', { class: 'btn sm', onclick: () => SP.go('quizzes/take/' + quiz.id) }, 'تحضّر بفويز «' + quiz.title + '»') : null,
        !isTeacherOf(it.classId) ? h('button', { class: 'btn ghost sm', disabled: inTasks, onclick: () => { const d = new Date(examAt(it)); d.setDate(d.getDate() - 2); S().tasks.push({ id: SP.uid(), userId: SP.state.me, text: 'ذاكر لامتحان ' + it.title, done: false, due: SP.today(d), classId: it.classId, prio: 3, examId: it.id }); SP.save(); SP.toast('أُضيفت مهمة مذاكرة قبل الامتحان بيومين'); SP.refresh(); } }, inTasks ? 'في مهامك ✓' : 'أضف مهمة مذاكرة') : null));
  }
  function lectureBody(it) {
    const w = watch(it.id), pct = w.dur ? Math.min(100, Math.round((100 * w.max) / w.dur)) : 0, teacher = isTeacherOf(it.classId);
    const watchers = teacher ? (SP.classById(it.classId) || { memberIds: [] }).memberIds.filter((u) => ((S().watch || {})[u] || {})[it.id]).length : 0;
    return h('div', {}, it.desc ? h('p', {}, it.desc) : null, it.fileId && it.chapters && it.chapters.length ? h('div', { class: 'sub', style: { margin: '0 0 8px' } }, it.chapters.length + ' فصول') : null,
      it.fileId ? [h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })), h('div', { class: 'row sp', style: { marginTop: '8px' } }, h('small', { class: 'sub', style: { margin: 0 } }, teacher ? `شاهدها ${watchers} طالب` : w.done ? 'شاهدتها ✓' : pct ? `شاهدت ${pct}%` : 'لم تشاهدها بعد'), h('button', { class: 'btn sm', onclick: () => SP.go('lectures/' + it.id) }, w.done ? 'أعد المشاهدة' : pct ? 'أكمل المشاهدة' : 'شاهد'))]
        : it.url ? h('a', { class: 'btn sm', href: it.url, target: '_blank', rel: 'noopener noreferrer' }, 'افتح المحاضرة ↗')
        : h('div', {}, h('span', { class: 'chip' }, 'محاضرة حضورية'), it.chapters && it.chapters.length ? h('ol', { class: 'topics' }, it.chapters.map((c) => h('li', {}, c.label))) : null));
  }
  const rich = (t) => { const out = h('div', { class: 'rich' }); let ul = null;
    String(t || '').split('\n').forEach((line) => { const m = line.match(/^\s*[-•]\s+(.*)/); const parts = (m ? m[1] : line).split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? h('b', {}, x) : x));
      if (m) { if (!ul) { ul = h('ul', {}); out.append(ul); } ul.append(h('li', {}, parts)); } else { ul = null; if (line.trim()) out.append(h('p', {}, parts)); } });
    return out; };
  const ciBody = (it) => it.type === 'notice' ? rich(it.text)
      : it.type === 'explain' ? h('div', {}, rich(it.text), it.images && it.images.length ? gallery(it) : null, it.fileId ? SP.fileCard(it) : null)
      : it.type === 'lecture' ? lectureBody(it) : it.type === 'gallery' ? h('div', {}, it.desc ? h('p', {}, it.desc) : null, gallery(it)) : it.type === 'exam' ? examBody(it) : homeworkBody(it);
  SP.ciBody = ciBody; SP.classComposer = (type, classId) => composer(type, classId); SP.CI_TYPES = TYPES;
  function card(it, showClass) {
    const [label, ic] = TYPES[it.type], teacher = isTeacherOf(it.classId);
    const body = ciBody(it);
    return h('article', { class: 'card ci ci-' + it.type + (it.type === 'exam' ? ' ' + urgency(it) : '') + (it.important ? ' important' : '') },
      h('div', { class: 'row sp' }, h('span', { class: 'row' }, h('span', { class: 'ci-ic', 'aria-hidden': 'true' }, ic), h('span', { class: 'chip' }, label), showClass ? h('span', { class: 'chip' }, SP.className(it.classId)) : null),
        h('span', { class: 'row' }, h('small', { class: 'sub', style: { margin: 0 } }, SP.date(it.ts)), teacher ? h('span', { class: 'chip', title: 'عدد الطلاب الذين حفظوه في دراستهم' }, '📥 ' + (SP.savedBy ? SP.savedBy(it.id) : 0)) : null, !teacher && SP.saveToStudy ? h('button', { class: 'btn sm ' + (SP.isSaved(it.id) ? 'ghost' : ''), onclick: () => { SP.saveToStudy(it); SP.refresh(); } }, SP.isSaved(it.id) ? 'محفوظ ✓' : 'احفظ في دراستي') : null, teacher ? h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('حذف «' + it.title + '»؟')) { S().classItems = items().filter((x) => x.id !== it.id); SP.save(); SP.refresh(); } } }, 'حذف') : null)),
      it.important ? h('div', { class: 'imp-flag' }, '📌 تبليغ مهم') : null, h('h3', { style: { margin: '10px 0 8px' } }, it.title), body);
  }

  /* ---------- لوحة المحاضرات (داخل الصف وعلى مستوى كل الصفوف) ---------- */
  SP.classItemsPanel = (classId) => {
    let type = ''; const root = h('div', {}), list = h('div', { class: 'ci-list' });
    const canPost = classId ? isTeacherOf(classId) : SP.myClasses().some((c) => c.teacherId === SP.state.me);
    const draw = () => {
      const all = items().filter((i) => visible(i) && TYPES[i.type] && (!classId || i.classId === classId) && (!type || i.type === type)).sort((a, b) => (!!b.important - !!a.important) || (a.type === 'exam' && b.type === 'exam' ? examAt(a) - examAt(b) : b.ts - a.ts));
      list.replaceChildren(...(all.length ? all.map((i) => card(i, !classId)) : [h('div', { class: 'empty' }, h('div', { class: 'sticker', style: { fontSize: '2.4rem', marginBottom: '8px' } }, '🎓'), canPost ? 'لم تنشر شيئاً بعد. أرسل تبليغاً أو شرحاً أو صوراً أو موعد امتحان.' : 'لم يرسل الأستاذ شيئاً بعد.')]));
      chips.replaceChildren(h('button', { class: 'chip' + (!type ? ' on' : ''), onclick: () => { type = ''; draw(); } }, 'الكل'), ...Object.entries(TYPES).map(([k, [l, ic]]) => h('button', { class: 'chip' + (type === k ? ' on' : ''), onclick: () => { type = k; draw(); } }, ic + ' ' + l)));
    };
    const chips = h('div', { class: 'row', style: { gap: '4px' } });
    if (canPost) root.append(h('div', { class: 'row ci-compose' }, Object.entries(TYPES).map(([k, [l, ic]]) => h('button', { class: 'btn ghost', onclick: () => composer(k, classId) }, ic + ' ' + l))));
    root.append(h('div', { style: { margin: '12px 0' } }, chips), list);
    draw(); return root;
  };

  /* ---------- صفحة مشاهدة المحاضرة ---------- */
  function lecturePage(it) {
    const w = watch(it.id), notes = vnotes(it.id), teacher = isTeacherOf(it.classId);
    const v = h('video', { controls: true, playsinline: true, preload: 'metadata', class: 'lec-video' }); blobUrl(it.fileId).then((u) => (v.src = u));
    const prog = h('div', { class: 'bar' }, h('i', {})), progTxt = h('small', { class: 'sub', style: { margin: 0 } });
    const upd = () => { const p = w.dur ? Math.min(100, Math.round((100 * w.max) / w.dur)) : 0; prog.firstChild.style.width = p + '%'; progTxt.textContent = w.done ? 'أكملت المحاضرة ✓' : `شاهدت ${p}%`; chapList.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.t <= v.currentTime && v.currentTime < +(b.dataset.next || 1e9))); };
    let lastSave = 0;
    v.addEventListener('loadedmetadata', () => { w.dur = v.duration || w.dur; if (w.pos > 3 && w.pos < v.duration - 5) { v.currentTime = w.pos; SP.toast('أكملت من ' + fmt(w.pos)); } upd(); });
    v.addEventListener('timeupdate', () => {
      w.pos = v.currentTime; w.max = Math.max(w.max, v.currentTime);
      if (!w.done && w.dur && w.max / w.dur >= 0.9) { w.done = true; SP.save(); SP.emit('react', 'celebrate'); }
      if (Date.now() - lastSave > 4000) { lastSave = Date.now(); SP.save(); } upd();
    });
    SP.cleanups.push(() => SP.save());
    const speed = h('select', { class: 'inp', id: 'lec-speed', 'aria-label': 'سرعة التشغيل', onchange: (e) => (v.playbackRate = +e.target.value) }, [0.75, 1, 1.25, 1.5, 2].map((x) => h('option', { value: x, selected: x === 1 }, x + '×')));
    const chapList = h('div', { class: 'chapters' }, (it.chapters || []).map((c, i, a) => h('button', { class: 'chap', 'data-t': c.t, 'data-next': a[i + 1] ? a[i + 1].t : '', onclick: () => { v.currentTime = c.t; v.play && v.play().catch(() => {}); } }, h('span', { class: 'chip' }, fmt(c.t)), ' ' + c.label)));
    const nInp = h('input', { class: 'inp', id: 'lec-note', placeholder: 'اكتب ملاحظة عند هذه اللحظة…', style: { flex: 1 } }), nList = h('div', {});
    const drawNotes = () => nList.replaceChildren(...(notes.length ? notes.slice().sort((a, b) => a.t - b.t).map((n) => h('div', { class: 'vnote' }, h('button', { class: 'chip', onclick: () => (v.currentTime = n.t) }, fmt(n.t)), h('span', {}, n.text), h('button', { class: 'btn ghost sm', 'aria-label': 'حذف', onclick: () => { notes.splice(notes.indexOf(n), 1); SP.save(); drawNotes(); } }, '✕'))) : [h('p', { class: 'sub' }, 'ملاحظاتك تُربط بالدقيقة؛ اضغط الوقت لتعود إليها.')]));
    const addNote = () => { if (!nInp.value.trim()) return; notes.push({ t: Math.floor(v.currentTime || 0), text: nInp.value.trim().slice(0, 300) }); nInp.value = ''; SP.save(); drawNotes(); };
    nInp.addEventListener('keydown', (e) => e.key === 'Enter' && addNote());
    drawNotes();
    const watchers = teacher ? (SP.classById(it.classId) || { memberIds: [] }).memberIds.map((u) => { const x = ((S().watch || {})[u] || {})[it.id]; return [SP.user(u).name, x && x.dur ? Math.min(100, Math.round((100 * x.max) / x.dur)) : 0]; }) : null;
    return h('div', {}, h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('classes/' + it.classId + '/lec') }, 'رجوع إلى ' + SP.className(it.classId))),
      h('h1', {}, it.title), it.desc ? h('p', { class: 'sub' }, it.desc) : null,
      h('div', { class: 'lec-layout' },
        h('div', {}, v, h('div', { class: 'row sp', style: { marginTop: '10px' } }, h('div', { style: { flex: 1 } }, prog, progTxt), speed),
          h('h2', {}, 'ملاحظاتي على المحاضرة'), h('div', { class: 'row' }, nInp, h('button', { class: 'btn', onclick: addNote }, 'أضف')), nList),
        h('aside', {}, it.chapters && it.chapters.length ? [h('h2', { style: { marginTop: 0 } }, 'الفصول'), chapList] : null,
          watchers ? [h('h2', {}, 'من شاهد'), h('table', {}, h('tbody', {}, watchers.map(([n, p]) => h('tr', {}, h('td', {}, n), h('td', {}, h('div', { class: 'bar', style: { width: '90px' } }, h('i', { style: { width: p + '%' } }))), h('td', {}, p + '%')))))] : null)));
  }
  SP.reg('lectures', '', 'منشورات الأساتذة', (p) => {
    if (p[0]) { const it = items().find((x) => x.id === p[0] && x.type === 'lecture' && visible(x)); return it ? lecturePage(it) : SP.page('المحاضرة غير موجودة', '', h('button', { class: 'btn', onclick: () => SP.go('lectures') }, 'رجوع')); }
    return SP.page('منشورات الأساتذة', SP.isTeacher() ? 'أرسل لطلابك تبليغات وشرحاً وصوراً ومحاضرات ومواعيد امتحانات وواجبات.' : 'كل ما أرسله أساتذتك في كل صفوفك. احفظ ما يهمك في «دراسة».', SP.examBanner(), SP.classItemsPanel(''));
  });

  /* ---------- التقويم ---------- */
  SP.reg('calendar', '', 'التقويم', () => {
    const root = h('div', {}); let cur = new Date(); cur.setDate(1);
    const draw = () => {
      const y = cur.getFullYear(), m = cur.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), t = SP.today();
      const ev = {}; const add = (d, e) => (ev[d] = ev[d] || []).push(e);
      items().filter(visible).forEach((i) => { if (i.type === 'exam') add(i.date, ['exam', 'امتحان: ' + i.title, 'classes/' + i.classId + '/lec']); if (i.type === 'homework') add(i.due, ['hw', 'تسليم: ' + i.title, 'classes/' + i.classId + '/lec']); });
      S().tasks.filter((x) => x.userId === SP.state.me && x.due && !x.done).forEach((x) => add(x.due, ['task', x.text, 'tasks']));
      const cells = []; for (let i = 0; i < first; i++) cells.push(h('div', { class: 'cal-cell empty-cell' }));
      for (let d = 1; d <= days; d++) { const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; cells.push(h('div', { class: 'cal-cell' + (key === t ? ' today' : '') }, h('span', { class: 'cal-d' }, d), (ev[key] || []).map(([k, txt, go]) => h('button', { class: 'cal-ev ' + k, title: txt, onclick: () => SP.go(go) }, txt)))); }
      root.replaceChildren(SP.page('التقويم', 'امتحاناتك وواجباتك ومهامك في شهر واحد.',
        h('div', { class: 'row sp', style: { marginBottom: '12px' } }, h('button', { class: 'btn ghost sm', onclick: () => { cur.setMonth(m - 1); draw(); } }, 'الشهر السابق'), h('h2', { style: { margin: 0 } }, cur.toLocaleDateString('ar', { month: 'long', year: 'numeric' })), h('button', { class: 'btn ghost sm', onclick: () => { cur.setMonth(m + 1); draw(); } }, 'الشهر التالي')),
        h('div', { class: 'cal-legend row' }, h('span', { class: 'cal-ev exam' }, 'امتحان'), h('span', { class: 'cal-ev hw' }, 'واجب'), h('span', { class: 'cal-ev task' }, 'مهمة')),
        h('div', { class: 'cal-wrap' }, h('div', { class: 'cal' }, ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((d) => h('div', { class: 'cal-h' }, d)), cells))));
    };
    draw(); return root;
  });
})();
