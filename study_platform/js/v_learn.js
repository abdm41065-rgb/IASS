/* الدراسة (مؤقت) · البطاقات · الفويزات · المهام والجدول · التقدم */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;

  /* ---------- مؤقت التركيز (عام: يستمر أثناء التنقل) ---------- */
  const T = (SP.timer = { mode: 'focus', total: 1500, left: 1500, endAt: 0, running: false, iv: 0 });
  const MODES = { focus: ['تركيز', 25], short: ['استراحة قصيرة', 5], long: ['استراحة طويلة', 15] };
  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  SP.fmtTime = fmt;
  SP.logStudy = (min) => { if (min > 0) { S().sessions.push({ userId: SP.state.me, ts: Date.now(), day: SP.today(), min }); SP.save(); SP.emit('react', 'celebrate'); } };
  function tick() {
    T.left = Math.max(0, Math.ceil((T.endAt - Date.now()) / 1000));
    if (T.left <= 0) {
      stop(); const done = T.mode === 'focus'; if (done) SP.logStudy(Math.round(T.total / 60));
      SP.beep(); SP.toast(done ? '🎉 انتهت جلسة التركيز وتم تسجيلها' : '⏰ انتهت الاستراحة'); T.left = T.total;
    }
    SP.emit('tick');
  }
  function stop() { clearInterval(T.iv); T.running = false; }
  SP.timerSet = (mode, min) => { stop(); T.mode = mode; T.total = T.left = Math.max(1, min) * 60; SP.emit('tick'); };
  SP.timerToggle = () => { if (T.running) { T.left = Math.max(0, Math.ceil((T.endAt - Date.now()) / 1000)); stop(); } else { T.endAt = Date.now() + T.left * 1000; T.running = true; T.iv = setInterval(tick, 500); } SP.emit('tick'); };

  SP.reg('study', '⏱️', 'التركيز', () => {
    const time = h('div', { class: 'big' }), ring = h('div', { class: 'ring' }), btn = h('button', { class: 'btn', onclick: SP.timerToggle }), goalTxt = h('div', { class: 'sub', style: { textAlign: 'center' } });
    const minInp = h('input', { class: 'inp', type: 'number', min: 1, max: 180, value: T.total / 60, style: { width: '80px' } });
    const upd = () => {
      time.textContent = fmt(T.left); btn.textContent = T.running ? 'إيقاف مؤقت' : 'ابدأ';
      const m = SP.studyMin(SP.state.me, SP.today()), g = S().goalMin || 60; ring.style.setProperty('--p', Math.min(100, (100 * m) / g)); ring.replaceChildren(h('span', {}, m + '/' + g + 'د')); goalTxt.textContent = 'هدف اليوم: ' + g + ' دقيقة';
    };
    SP.on('tick', upd); upd();
    const modes = h('div', { class: 'row', style: { justifyContent: 'center' } }, Object.entries(MODES).map(([k, [l, m]]) => h('button', { class: 'btn ghost', onclick: () => { SP.timerSet(k, m); minInp.value = m; SP.refresh(); } }, l + ' ' + m + 'د')));
    const goal = h('input', { class: 'inp', type: 'number', min: 5, value: S().goalMin || 60, style: { width: '90px' } });
    const manual = h('input', { class: 'inp', type: 'number', min: 1, value: 15, style: { width: '90px' } });
    return SP.page('التركيز', 'جلسات تركيز بنظام بومودورو. تُسجَّل الدقائق تلقائياً في تقدّمك.',
      h('div', { class: 'grid' },
        h('div', { class: 'card' }, h('p', { class: 'sub', style: { textAlign: 'center' } }, MODES[T.mode][0]), time, modes,
          h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, btn, h('button', { class: 'btn ghost', onclick: () => { SP.timerSet(T.mode, T.total / 60); SP.refresh(); } }, 'إعادة'), h('label', {}, 'مدة مخصصة ', minInp, ' د ', h('button', { class: 'btn ghost sm', onclick: () => { SP.timerSet(T.mode, +minInp.value || 25); } }, 'تطبيق')))),
        h('div', { class: 'card' }, ring, goalTxt, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('label', {}, 'الهدف اليومي ', goal, ' د '), h('button', { class: 'btn ghost sm', onclick: () => { S().goalMin = +goal.value || 60; SP.save(); SP.refresh(); } }, 'حفظ')),
          h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('label', {}, 'تسجيل يدوي ', manual, ' د '), h('button', { class: 'btn ghost sm', onclick: () => { SP.logStudy(+manual.value || 0); SP.toast('تم التسجيل'); SP.refresh(); } }, 'أضف')))),
      h('h2', {}, 'سجل الدراسة'), (() => { const mine = S().sessions.filter((x) => x.userId === SP.state.me).slice(-8).reverse(); return mine.length ? h('div', {}, mine.map((x) => h('span', { class: 'chip' }, x.day + ' · ' + x.min + 'د'))) : SP.empty('لا جلسات بعد'); })());
  });

  /* ---------- البطاقات التعليمية (تكرار متباعد) ---------- */
  const INTERVAL = [0, 0, 1, 2, 4, 8, 16];
  const visibleDeck = (d) => d.ownerId === SP.state.me || (d.classId && SP.canSeeClass(d.classId));
  function deckModal() {
    const name = h('input', { class: 'inp', style: { width: '100%' } }), cls = SP.classSelect('', false);
    SP.modal({ title: 'مجموعة بطاقات جديدة', body: h('div', {}, SP.field('الاسم', name), SP.field('مشاركتها مع صف؟', cls)), actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: (c) => { if (!name.value.trim()) return; const d = { id: SP.uid(), ownerId: SP.state.me, classId: cls.value, name: name.value.trim(), cards: [] }; S().decks.push(d); SP.save(); c(); SP.go('cards/' + d.id); } }] });
  }
  function studyDeck(d, root) {
    const t = SP.today(); let queue = d.cards.filter((c) => (c.due || t) <= t), shown = false, done = 0; const total = queue.length;
    const draw = () => {
      if (!queue.length) { root.replaceChildren(SP.page('أحسنت! 🎉', `راجعت ${total} بطاقة.`, h('button', { class: 'btn', onclick: () => SP.go('cards/' + d.id) }, 'رجوع'))); return; }
      const c = queue[0];
      root.replaceChildren(SP.page('مراجعة: ' + d.name, `${done}/${total}`, h('div', { class: 'bar' }, h('i', { style: { width: (100 * done) / Math.max(1, total) + '%' } })),
        h('div', { class: 'card flash', style: { margin: '14px 0' }, role: 'button', tabindex: 0, onclick: () => { shown = true; draw(); } }, shown ? h('div', {}, h('small', { class: 'sub' }, c.q), h('div', {}, c.a)) : c.q),
        shown ? h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn bad', onclick: () => { c.box = 1; c.due = t; queue.push(queue.shift()); shown = false; SP.save(); draw(); } }, 'لم أعرفها'),
          h('button', { class: 'btn ok', onclick: () => { c.box = Math.min(6, (c.box || 1) + 1); const dd = new Date(); dd.setDate(dd.getDate() + INTERVAL[c.box]); c.due = SP.today(dd); queue.shift(); done++; shown = false; SP.save(); draw(); } }, 'عرفتها')) : h('p', { class: 'sub', style: { textAlign: 'center' } }, 'اضغط على البطاقة لإظهار الإجابة'),
        h('div', { style: { textAlign: 'center', marginTop: '14px' } }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('cards/' + d.id) }, 'إنهاء'))));
    }; draw();
  }
  SP.reg('cards', '🃏', 'البطاقات', (p) => {
    if (!p[0]) {
      const list = S().decks.filter(visibleDeck), t = SP.today();
      return SP.page('البطاقات التعليمية', 'احفظ بالتكرار المتباعد: البطاقة التي تعرفها تظهر لك لاحقاً بفترات أطول.', h('button', { class: 'btn', onclick: deckModal }, 'مجموعة جديدة'),
        h('div', { class: 'grid', style: { marginTop: '14px' } }, list.length ? list.map((d) => { const due = d.cards.filter((c) => (c.due || t) <= t).length; return h('div', { class: 'card click', onclick: () => SP.go('cards/' + d.id) }, h('h3', {}, d.name), h('p', { class: 'sub' }, d.cards.length + ' بطاقة · ' + (d.classId ? SP.className(d.classId) : 'شخصية')), h('span', { class: 'chip' + (due ? ' on' : '') }, due + ' للمراجعة')); }) : SP.empty('لا توجد مجموعات')));
    }
    const d = S().decks.find((x) => x.id === p[0]); if (!d || !visibleDeck(d)) return SP.page('غير موجودة', '', h('button', { class: 'btn', onclick: () => SP.go('cards') }, 'رجوع'));
    const mine = d.ownerId === SP.state.me, root = h('div', {});
    if (p[1] === 'study') { if (!mine) return SP.page('انسخ المجموعة أولاً', '', h('button', { class: 'btn', onclick: () => SP.go('cards/' + d.id) }, 'رجوع')); studyDeck(d, root); return root; }
    const q = h('input', { class: 'inp', placeholder: 'السؤال', style: { flex: 1 } }), a = h('input', { class: 'inp', placeholder: 'الإجابة', style: { flex: 1 } }), bulk = h('textarea', { class: 'inp', placeholder: 'استيراد جماعي: سطر لكل بطاقة بالشكل  سؤال | إجابة' });
    const t = SP.today(), due = d.cards.filter((c) => (c.due || t) <= t).length;
    return SP.page(d.name, d.cards.length + ' بطاقة · ' + due + ' للمراجعة اليوم', h('div', { class: 'row' }, mine ? h('button', { class: 'btn', onclick: () => SP.go('cards/' + d.id + '/study') }, 'ابدأ المراجعة (' + due + ')') : h('button', { class: 'btn', onclick: () => { const c = JSON.parse(JSON.stringify(d)); c.id = SP.uid(); c.ownerId = SP.state.me; c.classId = ''; c.cards.forEach((x) => { x.id = SP.uid(); x.box = 1; x.due = t; }); S().decks.push(c); SP.save(); SP.go('cards/' + c.id); } }, 'نسخ إلى مجموعاتي'),
      h('button', { class: 'btn ghost', onclick: () => SP.go('cards') }, 'رجوع'), mine ? h('button', { class: 'btn ghost', onclick: async () => { if (await SP.confirm('حذف المجموعة؟')) { S().decks = S().decks.filter((x) => x.id !== d.id); SP.save(); SP.go('cards'); } } }, 'حذف') : null),
      mine ? h('div', { class: 'card', style: { margin: '12px 0' } }, h('div', { class: 'row' }, q, a, h('button', { class: 'btn', onclick: () => { if (!q.value.trim() || !a.value.trim()) return; d.cards.push({ id: SP.uid(), q: q.value.trim(), a: a.value.trim(), box: 1, due: t }); SP.save(); SP.refresh(); } }, 'إضافة')),
        h('div', { style: { marginTop: '8px' } }, bulk, h('button', { class: 'btn ghost sm', style: { marginTop: '6px' }, onclick: () => { let n = 0; bulk.value.split('\n').forEach((l) => { const [x, y] = l.split('|'); if (x && y && x.trim() && y.trim()) { d.cards.push({ id: SP.uid(), q: x.trim(), a: y.trim(), box: 1, due: t }); n++; } }); SP.save(); SP.toast(n + ' بطاقة'); SP.refresh(); } }, 'استيراد'))) : null,
      h('table', {}, d.cards.map((c) => h('tr', {}, h('td', {}, c.q), h('td', {}, c.a), h('td', {}, h('span', { class: 'chip' }, 'مستوى ' + (c.box || 1))), mine ? h('td', {}, h('button', { class: 'btn ghost sm', 'aria-label': 'حذف', onclick: () => { d.cards = d.cards.filter((x) => x.id !== c.id); SP.save(); SP.refresh(); } }, '✕')) : null))));
  });

  /* ---------- الفويزات ---------- */
  const visibleQuiz = (q) => (q.classId ? SP.canSeeClass(q.classId) : q.by === SP.state.me);
  const canManage = (q) => q.by === SP.state.me;
  const blank = () => ({ id: SP.uid(), type: 'mcq', q: '', options: ['', '', '', ''], answer: 0 });
  function quizEditor(quiz) {
    const q = quiz ? JSON.parse(JSON.stringify(quiz)) : { id: SP.uid(), classId: '', by: SP.state.me, title: '', order: S().quizzes.length, timeLimit: 0, created: Date.now(), questions: [blank()] };
    const title = h('input', { class: 'inp', style: { width: '100%' }, value: q.title, placeholder: 'عنوان الفويز' }), cls = SP.classSelect(q.classId, false), lim = h('input', { class: 'inp', type: 'number', min: 0, value: q.timeLimit, style: { width: '90px' } }), box = h('div', {});
    const draw = () => box.replaceChildren(...q.questions.map((qq, i) => {
      const typeSel = h('select', { class: 'inp', onchange: (e) => { qq.type = e.target.value; qq.options = qq.type === 'mcq' ? ['', '', '', ''] : qq.type === 'tf' ? ['صح', 'خطأ'] : []; qq.answer = qq.type === 'short' ? '' : 0; draw(); } }, [['mcq', 'اختيار من متعدد'], ['tf', 'صح / خطأ'], ['short', 'إجابة قصيرة']].map(([v, l]) => h('option', { value: v, selected: qq.type === v }, l)));
      return h('div', { class: 'card', style: { margin: '8px 0' } }, h('div', { class: 'row sp' }, h('b', {}, 'سؤال ' + (i + 1)), h('span', { class: 'row' }, typeSel, q.questions.length > 1 ? h('button', { class: 'btn ghost sm', onclick: () => { q.questions.splice(i, 1); draw(); } }, '✕') : null)),
        h('input', { class: 'inp', style: { width: '100%', margin: '6px 0' }, placeholder: 'نص السؤال', value: qq.q, oninput: (e) => (qq.q = e.target.value) }),
        qq.type === 'short' ? h('input', { class: 'inp', style: { width: '100%' }, placeholder: 'الإجابة الصحيحة (يمكن عدة إجابات مفصولة بـ |)', value: qq.answer, oninput: (e) => (qq.answer = e.target.value) })
          : qq.options.map((o, k) => h('label', { class: 'row', style: { margin: '4px 0' } }, h('input', { type: 'radio', name: 'a' + qq.id, checked: qq.answer === k, onchange: () => (qq.answer = k) }), qq.type === 'tf' ? h('span', {}, o) : h('input', { class: 'inp', style: { flex: 1 }, placeholder: 'خيار ' + (k + 1), value: o, oninput: (e) => (qq.options[k] = e.target.value) }))));
    })); draw();
    SP.modal({ title: quiz ? 'تعديل الفويز' : 'فويز جديد', wide: true, body: h('div', {}, SP.field('العنوان', title), h('div', { class: 'row' }, SP.field('الصف', cls), SP.field('المدة بالدقائق (0 = بلا حد)', lim)), box, h('button', { class: 'btn ghost', style: { marginTop: '8px' }, onclick: () => { q.questions.push(blank()); draw(); } }, 'سؤال')),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'حفظ', primary: true, onclick: (c) => {
        if (!title.value.trim()) return SP.toast('اكتب عنوان الفويز', 'err');
        for (const qq of q.questions) {
          if (!qq.q.trim()) return SP.toast('أحد الأسئلة بلا نص', 'err');
          if (qq.type === 'mcq' && qq.options.filter((o) => o.trim()).length < 2) return SP.toast('أضف خيارين على الأقل لكل سؤال اختيار', 'err');
          if (qq.type === 'mcq' && !qq.options[qq.answer].trim()) return SP.toast('الإجابة الصحيحة يجب أن تكون خياراً غير فارغ', 'err');
          if (qq.type === 'short' && !String(qq.answer).trim()) return SP.toast('أدخل الإجابة الصحيحة للسؤال القصير', 'err');
        }
        Object.assign(q, { title: title.value.trim(), classId: cls.value, timeLimit: +lim.value || 0 });
        if (quiz) S().quizzes[S().quizzes.findIndex((x) => x.id === q.id)] = q; else S().quizzes.push(q);
        SP.save(); c(); SP.refresh();
      } }] });
  }
  function leaderboard(q) {
    const rows = SP.bestResults(q.id);
    SP.modal({ title: 'ترتيب: ' + q.title, body: rows.length ? h('table', {}, h('thead', {}, h('tr', {}, ['#', 'الطالب', 'الدرجة', 'الوقت'].map((x) => h('th', {}, x)))), h('tbody', {}, rows.map((r, i) => h('tr', {}, h('td', {}, ['🥇', '🥈', '🥉'][i] || i + 1), h('td', {}, SP.user(r.userId).name), h('td', {}, r.score + '/' + r.total), h('td', {}, fmt(r.secs)))))) : SP.empty('لا نتائج بعد'), actions: [{ label: 'إغلاق', onclick: (c) => c() }] });
  }
  SP.quizList = (classId) => {
    const root = h('div', {}), list = h('div', { class: 'grid' });
    let sort = 'order';
    const draw = () => {
      let qs = S().quizzes.filter((q) => visibleQuiz(q) && (!classId || q.classId === classId));
      qs = sort === 'date' ? qs.sort((a, b) => b.created - a.created) : sort === 'title' ? qs.sort((a, b) => a.title.localeCompare(b.title, 'ar')) : qs.sort((a, b) => a.order - b.order);
      list.replaceChildren(...(qs.length ? qs.map((q, i) => {
        const mine = S().results.filter((r) => r.quizId === q.id && r.userId === SP.state.me), best = mine.length ? Math.max(...mine.map((r) => Math.round((100 * r.score) / r.total))) : null;
        const move = (dir) => { const j = i + dir; if (j < 0 || j >= qs.length) return; const a = qs[i], b = qs[j]; [a.order, b.order] = [b.order, a.order]; if (a.order === b.order) b.order += dir * -0.5; SP.save(); draw(); };
        return h('div', { class: 'card' }, h('div', { class: 'row sp' }, h('h3', {}, q.title), h('span', { class: 'chip' }, q.questions.length + ' أسئلة')),
          h('p', { class: 'sub' }, (q.classId ? SP.className(q.classId) : 'تدريب شخصي') + (q.timeLimit ? ' · ' + q.timeLimit + 'د' : '') + (best != null ? ' · أفضل نتيجة لك: ' + best + '%' : '')),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => SP.go('quizzes/take/' + q.id) }, best == null ? 'ابدأ' : 'أعد المحاولة'), h('button', { class: 'btn ghost sm', onclick: () => leaderboard(q) }, 'الترتيب'),
            canManage(q) ? [h('button', { class: 'btn ghost sm', onclick: () => quizEditor(q) }, 'تعديل'), h('button', { class: 'btn ghost sm', title: 'تصدير', onclick: () => SP.download(q.title + '.quiz.json', JSON.stringify(q, null, 1), 'application/json') }, 'تنزيل'),
              h('button', { class: 'btn ghost sm', 'aria-label': 'أعلى', disabled: sort !== 'order' || i === 0, onclick: () => move(-1) }, '▲'), h('button', { class: 'btn ghost sm', 'aria-label': 'أسفل', disabled: sort !== 'order' || i === qs.length - 1, onclick: () => move(1) }, '▼'),
              h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('حذف الفويز ونتائجه؟')) { S().quizzes = S().quizzes.filter((x) => x.id !== q.id); S().results = S().results.filter((r) => r.quizId !== q.id); SP.save(); draw(); } } }, 'حذف')] : null));
      }) : [SP.empty('لا توجد فويزات')]));
    };
    root.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => quizEditor() }, 'فويز جديد'), h('label', {}, 'الترتيب: ', h('select', { class: 'inp', onchange: (e) => { sort = e.target.value; draw(); } }, [['order', 'ترتيبي اليدوي'], ['date', 'الأحدث'], ['title', 'أبجدي']].map(([v, l]) => h('option', { value: v }, l))))), h('div', { style: { marginTop: '12px' } }, list)); draw(); return root;
  };
  const norm = (s) => String(s).trim().toLowerCase().replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  const correct = (qq, a) => (qq.type === 'short' ? a != null && String(qq.answer).split('|').some((x) => norm(x) === norm(a)) : a === qq.answer);
  function takeQuiz(q) {
    const root = h('div', {}), ans = {}, t0 = Date.now(); let timer = 0, finished = false;
    const finish = () => {
      if (finished) return; finished = true; clearInterval(timer);
      const score = q.questions.filter((qq) => correct(qq, ans[qq.id])).length, secs = Math.round((Date.now() - t0) / 1000);
      S().results.push({ id: SP.uid(), quizId: q.id, userId: SP.state.me, score, total: q.questions.length, secs, ts: Date.now() }); SP.save(); SP.emit('react', score / q.questions.length >= 0.8 ? 'celebrate' : 'encourage');
      root.replaceChildren(h('div', { class: 'sticker big-stk', 'aria-hidden': 'true' }, score === q.questions.length ? '🏆' : score / q.questions.length >= 0.6 ? '⭐' : '💪'), SP.page(`نتيجتك: ${score}/${q.questions.length}`, Math.round((100 * score) / q.questions.length) + '% · ' + fmt(secs),
        q.questions.map((qq, i) => { const ok = correct(qq, ans[qq.id]); return h('div', { class: 'card', style: { margin: '8px 0' } }, h('b', {}, `${i + 1}. ${qq.q} ${ok ? '✅' : '❌'}`),
          qq.type === 'short' ? h('p', {}, 'إجابتك: ' + (ans[qq.id] || '—') + ' · الصحيحة: ' + String(qq.answer).split('|')[0]) : qq.options.map((o, k) => h('div', { class: 'opt ' + (k === qq.answer ? 'right' : k === ans[qq.id] ? 'wrong' : '') }, o))); }),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => SP.go('quizzes') }, 'رجوع للفويزات'), h('button', { class: 'btn ghost', onclick: () => leaderboard(q) }, 'الترتيب'))));
    };
    const clock = h('span', { class: 'chip' });
    if (q.timeLimit) { timer = setInterval(() => { const left = q.timeLimit * 60 - Math.round((Date.now() - t0) / 1000); clock.textContent = '⏳ ' + fmt(Math.max(0, left)); if (left <= 0) finish(); }, 500); SP.cleanups.push(() => clearInterval(timer)); }
    root.append(SP.page(q.title, q.questions.length + ' أسئلة', clock, q.questions.map((qq, i) => h('div', { class: 'card', style: { margin: '10px 0' } }, h('b', {}, `${i + 1}. ${qq.q}`),
      qq.type === 'short' ? h('input', { class: 'inp', style: { width: '100%', marginTop: '8px' }, placeholder: 'إجابتك', oninput: (e) => (ans[qq.id] = e.target.value) })
        : qq.options.map((o, k) => h('label', { class: 'opt' }, h('input', { type: 'radio', name: 'q' + qq.id, onchange: () => (ans[qq.id] = k) }), ' ' + o)))),
    h('button', { class: 'btn', onclick: finish }, 'تسليم'))); return root;
  }
  SP.reg('quizzes', '❓', 'الفويزات', (p) => {
    if (p[0] === 'take') { const q = S().quizzes.find((x) => x.id === p[1]); return q && visibleQuiz(q) ? takeQuiz(q) : SP.page('غير موجود', ''); }
    return SP.page('الفويزات', 'أنشئ فويزات، رتّبها، وتنافس في لوحة الترتيب.', SP.quizList());
  });

  /* ---------- المهام والجدول ---------- */
  SP.reg('tasks', '✅', 'المهام والجدول', () => {
    let tab = 'tasks'; const root = h('div', {});
    const draw = () => {
      let body;
      if (tab === 'tasks') {
        const txt = h('input', { class: 'inp', placeholder: 'مهمة جديدة…', style: { flex: 1 } }), due = h('input', { class: 'inp', type: 'date' }), cls = SP.classSelect('', false), pr = h('select', { class: 'inp' }, [['1', 'عادية'], ['2', 'مهمة'], ['3', 'عاجلة']].map(([v, l]) => h('option', { value: v }, l)));
        const mine = S().tasks.filter((x) => x.userId === SP.state.me).sort((a, b) => a.done - b.done || (a.due || '9').localeCompare(b.due || '9') || b.prio - a.prio);
        body = h('div', {}, h('div', { class: 'card row' }, txt, due, cls, pr, h('button', { class: 'btn', onclick: () => { if (!txt.value.trim()) return; S().tasks.push({ id: SP.uid(), userId: SP.state.me, text: txt.value.trim(), done: false, due: due.value, classId: cls.value, prio: +pr.value }); SP.save(); draw(); } }, 'إضافة')),
          h('div', { style: { marginTop: '12px' } }, mine.length ? mine.map((x) => h('div', { class: 'card row sp', style: { marginBottom: '6px', opacity: x.done ? 0.55 : 1 } }, h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: x.done, onchange: (e) => { x.done = e.target.checked; SP.save(); draw(); } }), h('span', { style: { textDecoration: x.done ? 'line-through' : '' } }, ['', '', '⚠️ ', '🔥 '][x.prio] + x.text)), h('span', { class: 'row' }, x.due ? h('span', { class: 'chip' + (!x.done && x.due < SP.today() ? ' on' : '') }, x.due) : null, x.classId ? h('span', { class: 'chip' }, SP.className(x.classId)) : null, h('button', { class: 'btn ghost sm', 'aria-label': 'حذف', onclick: () => { S().tasks = S().tasks.filter((y) => y.id !== x.id); SP.save(); draw(); } }, '✕')))) : SP.empty('لا مهام. أضف أول مهمة!')));
      } else {
        const tt = (S().timetable[SP.state.me] = S().timetable[SP.state.me] || {});
        body = h('div', { style: { overflowX: 'auto' } }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'الحصة'), SP.DAYS.map((d) => h('th', {}, d)))), h('tbody', {}, [1, 2, 3, 4, 5, 6, 7].map((p) => h('tr', {}, h('th', {}, p), SP.DAYS.map((d, di) => h('td', {}, h('input', { class: 'inp', style: { width: '100%', minWidth: '90px' }, value: tt[di + '-' + p] || '', 'aria-label': d + ' الحصة ' + p, onchange: (e) => { tt[di + '-' + p] = e.target.value; SP.save(); } }))))))));
      }
      root.replaceChildren(SP.page('المهام والجدول', 'نظّم واجباتك وجدولك الأسبوعي.', SP.tabs([['tasks', 'المهام'], ['tt', 'الجدول الأسبوعي']], tab, (k) => { tab = k; draw(); }), body));
    }; draw(); return root;
  });

  /* ---------- التقدم والإنجازات ---------- */
  const BADGES = [
    ['📝', 'أول ملاحظة', (u, s) => s.notes.some((n) => n.ownerId === u)], ['📁', 'منظّم الملفات (3 ملفات)', (u, s) => s.files.filter((f) => f.ownerId === u).length >= 3],
    ['🔥', 'شعلة 3 أيام', (u) => SP.streak(u) >= 3], ['⏱️', 'ساعة تركيز', (u) => SP.studyMin(u) >= 60], ['🏆', 'نجم الفويز (90%+)', (u, s) => s.results.some((r) => r.userId === u && r.score / r.total >= 0.9)],
    ['🧠', 'حافظ (5 بطاقات متقدمة)', (u, s) => s.decks.filter((d) => d.ownerId === u).flatMap((d) => d.cards).filter((c) => (c.box || 1) >= 4).length >= 5], ['💬', 'مشارك (3 منشورات)', (u, s) => s.posts.filter((p) => p.authorId === u).length >= 3],
  ];
  SP.reg('progress', '📊', 'التقدم', () => {
    const u = SP.state.me, s = S(), days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
    const mins = days.map((d) => SP.studyMin(u, SP.today(d))), labels = days.map((d) => d.toLocaleDateString('ar', { weekday: 'short' }));
    const recent = s.results.filter((r) => r.userId === u).slice(-8), cards = s.decks.filter((d) => d.ownerId === u).flatMap((d) => d.cards);
    return SP.page('تقدّمي', 'أرقامك وإنجازاتك.', h('div', { class: 'grid s' },
      h('div', { class: 'card stat' }, h('b', {}, SP.studyMin(u)), h('span', {}, 'إجمالي دقائق الدراسة')), h('div', { class: 'card stat' }, h('b', {}, SP.streak(u) + '🔥'), h('span', {}, 'أيام متتالية')),
      h('div', { class: 'card stat' }, h('b', {}, SP.avgScore(u) == null ? '—' : SP.avgScore(u) + '%'), h('span', {}, 'متوسط الفويزات')), h('div', { class: 'card stat' }, h('b', {}, cards.filter((c) => (c.box || 1) >= 4).length + '/' + cards.length), h('span', {}, 'بطاقات متقنة')), h('div', { class: 'card stat' }, h('b', {}, SP.xp(u)), h('span', {}, 'نقاط XP'))),
      h('div', { class: 'grid' }, h('div', { class: 'card' }, h('h3', {}, 'دقائق الدراسة (آخر 7 أيام)'), SP.bars(mins, labels, 'var(--brand2)')),
        h('div', { class: 'card' }, h('h3', {}, 'نتائج الفويزات الأخيرة %'), recent.length ? SP.bars(recent.map((r) => Math.round((100 * r.score) / r.total)), recent.map((_, i) => i + 1)) : SP.empty('لا نتائج'))),
      h('h2', {}, 'الإنجازات'), h('div', { class: 'grid s' }, BADGES.map(([ic, name, f]) => { const ok = f(u, s); return h('div', { class: 'card stat', style: { opacity: ok ? 1 : 0.4 } }, h('b', {}, ic), h('span', {}, name + (ok ? ' ✓' : ' 🔒'))); })));
  });
})();
