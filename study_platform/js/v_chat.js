/* الصفوف كمحادثات (نمط تليكرام): قائمة محادثات، فقاعات، ردود، تفاعلات، تثبيت، مشاهدات، تصويت، وخيارات للأستاذ */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const items = () => (S().classItems = S().classItems || []);
  const REACTS = ['👍', '❤️', '🔥', '😂', '😮', '🙏'];
  const LABEL = { msg: '', notice: '📢 تبليغ', explain: '💡 شرح', gallery: '🖼️ صور', lecture: '🎬 محاضرة', exam: '📝 امتحان', homework: '📚 واجب', poll: '📊 تصويت' };
  const reads = () => ((S().reads = S().reads || {})[SP.state.me] = S().reads[SP.state.me] || {});
  const settings = (c) => (c.chat = Object.assign({ students: true, reactions: true }, c.chat || {}));
  const isTeacher = (c) => c.teacherId === SP.state.me;
  const msgsOf = (cid) => items().filter((i) => i.classId === cid).sort((a, b) => a.ts - b.ts);
  const time = (ts) => new Date(ts).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });
  const dayKey = (ts) => SP.today(new Date(ts));
  const dayLabel = (ts) => { const k = dayKey(ts), t = SP.today(), y = new Date(); y.setDate(y.getDate() - 1); return k === t ? 'اليوم' : k === SP.today(y) ? 'أمس' : new Date(ts).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const preview = (m) => !m ? 'لا رسائل بعد' : m.type === 'msg' ? (m.text || '').slice(0, 60) : m.type === 'gallery' && !m.title ? '🖼️ صورة' : (LABEL[m.type] || '') + ': ' + (m.title || m.q || '');
  const unread = (cid) => { const r = reads()[cid] || 0; return items().filter((i) => i.classId === cid && i.ts > r && i.by !== SP.state.me).length; };
  SP.chatUnread = () => SP.myClasses().reduce((n, c) => n + unread(c.id), 0);
  const viewsOf = (c, m) => c.memberIds.filter((u) => (((S().reads || {})[u] || {})[c.id] || 0) >= m.ts).length;
  const initial = (n) => n.replace(/^(ال|د\.\s*)/, '').trim().slice(0, 1);
  const colorFor = (uid) => ['#C2410C', '#2E7D32', '#7B3FA0', '#0F766E', '#B91C1C', '#1F4E99'][[...uid].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 6];

  /* ---------- قائمة المحادثات ---------- */
  function chatList(activeId) {
    const list = SP.myClasses().map((c) => ({ c, last: msgsOf(c.id).slice(-1)[0] })).sort((a, b) => ((b.last || {}).ts || b.c.created) - ((a.last || {}).ts || a.c.created));
    return h('aside', { class: 'tg-list', 'aria-label': 'الصفوف' },
      h('div', { class: 'tg-list-head' }, h('b', {}, 'الصفوف'), SP.isTeacher() ? h('button', { class: 'btn sm', onclick: () => SP.newClassModal() }, 'صف جديد') : h('button', { class: 'btn sm', onclick: () => SP.joinModal() }, 'انضمام بكود')),
      list.length ? list.map(({ c, last }) => { const n = unread(c.id), s = settings(c);
        return h('a', { class: 'tg-chat' + (c.id === activeId ? ' on' : ''), href: '#/classes/' + c.id },
          h('span', { class: 'tg-av', style: { background: c.color } }, initial(c.name)),
          h('span', { class: 'tg-mid' }, h('span', { class: 'tg-name' }, (s.students ? '' : '📣 ') + c.name), h('span', { class: 'tg-prev' }, last ? (last.by === SP.state.me ? 'أنت: ' : last.type === 'msg' ? SP.user(last.by).name.replace(/^د\.\s*/, '') + ': ' : '') + preview(last) : 'لا رسائل بعد')),
          h('span', { class: 'tg-meta' }, last ? h('small', {}, dayKey(last.ts) === SP.today() ? time(last.ts) : new Date(last.ts).toLocaleDateString('ar', { day: 'numeric', month: 'short' })) : null, n ? h('span', { class: 'tg-badge' }, n) : null)); })
        : h('div', { class: 'empty' }, SP.isTeacher() ? 'أنشئ صفك الأول.' : 'انضم إلى صف بالكود من أستاذك.'));
  }

  /* ---------- فقاعة الرسالة ---------- */
  function pollBody(c, m) {
    const votes = m.votes || {}, total = Object.values(votes).filter((v) => v != null).length, mineV = votes[SP.state.me];
    return h('div', { class: 'poll' }, h('b', { class: 'poll-q' }, m.q), h('small', { class: 'sub', style: { margin: 0 } }, m.closed ? 'تصويت مغلق' : 'تصويت · اختر إجابة'),
      m.opts.map((o, i) => { const n = Object.values(votes).filter((v) => v === i).length, pct = total ? Math.round((100 * n) / total) : 0, show = mineV != null || isTeacher(c) || m.closed;
        return h('button', { class: 'poll-opt' + (mineV === i ? ' mine' : ''), disabled: m.closed || isTeacher(c), onclick: () => { m.votes = m.votes || {}; m.votes[SP.state.me] = i; SP.save(); SP.refresh(); } },
          h('span', { class: 'poll-fill', style: { width: (show ? pct : 0) + '%' } }), h('span', { class: 'poll-t' }, (mineV === i ? '✓ ' : '') + o), show ? h('span', { class: 'poll-n' }, pct + '%') : null); }),
      h('small', { class: 'sub', style: { margin: 0 } }, total + ' صوت'));
  }
  function bubble(c, m, ui) {
    const me = m.by === SP.state.me, teacher = isTeacher(c), sender = SP.user(m.by), s = settings(c);
    const reply = m.replyTo && items().find((x) => x.id === m.replyTo);
    let content;
    if (m.type === 'msg') content = h('div', { class: 'tg-text', dir: 'auto' }, m.text);
    else if (m.type === 'poll') content = pollBody(c, m);
    else if (m.type === 'gallery' && !m.title) content = SP.ciBody(m);
    else content = h('div', {}, h('div', { class: 'tg-kind' }, LABEL[m.type] + (m.important ? ' · 📌 مهم' : '')), m.important ? h('div', { class: 'imp-flag' }, '📌 تبليغ مهم') : null, m.title ? h('b', { class: 'tg-title' }, m.title) : null, SP.ciBody(m));
    const rx = m.reactions || {};
    const reacts = Object.entries(rx).filter(([, u]) => u.length).map(([e, u]) => h('button', { class: 'tg-rx' + (u.includes(SP.state.me) ? ' mine' : ''), 'aria-label': `${e} ${u.length}`, title: u.map((x) => SP.user(x).name).join('، '), onclick: () => react(m, e) }, e + ' ' + u.length));
    const saveBtn = !teacher && m.type !== 'msg' && m.type !== 'poll' && SP.saveToStudy ? h('button', { class: 'tg-save', onclick: () => { SP.saveToStudy(m); SP.refresh(); } }, SP.isSaved(m.id) ? 'محفوظ ✓' : 'احفظ في دراستي') : null;
    const wrap = h('div', { class: 'tg-row' + (me ? ' me' : ''), 'data-id': m.id },
      !me ? h('span', { class: 'tg-av sm', style: { background: m.by === c.teacherId ? c.color : colorFor(m.by) } }, initial(sender.name)) : null,
      h('div', { class: 'tg-bubble ci ci-' + m.type + (m.important ? ' important' : '') + (m.type === 'exam' && SP.upcomingExams ? '' : '') },
        !me ? h('div', { class: 'tg-from', style: { color: m.by === c.teacherId ? c.color : colorFor(m.by) } }, sender.name + (m.by === c.teacherId ? ' · الأستاذ' : '')) : null,
        reply ? h('button', { class: 'tg-quote', onclick: () => ui.jump(reply.id) }, h('b', {}, SP.user(reply.by).name), h('span', {}, preview(reply))) : null,
        content,
        reacts.length ? h('div', { class: 'tg-rxs' }, reacts) : null,
        h('div', { class: 'tg-foot' }, saveBtn, teacher && m.type !== 'msg' ? h('span', { class: 'chip', title: 'حفظه في دراسته' }, '📥 ' + (SP.savedBy ? SP.savedBy(m.id) : 0)) : null, m.pinned ? h('span', { title: 'مثبّتة' }, '📌') : null, m.edited ? h('small', {}, 'معدّلة') : null,
          (me || teacher) && m.by === c.teacherId ? h('small', { title: 'عدد من شاهدها من الطلاب' }, '👁 ' + viewsOf(c, m)) : null, h('small', {}, time(m.ts)),
          h('button', { class: 'tg-more', 'aria-label': 'خيارات الرسالة', onclick: (e) => menu(e, c, m, ui) }, '⋯'))));
    return wrap;
  }
  function react(m, e) { m.reactions = m.reactions || {}; const u = (m.reactions[e] = m.reactions[e] || []), i = u.indexOf(SP.state.me); i < 0 ? u.push(SP.state.me) : u.splice(i, 1); SP.save(); SP.refresh(); }
  function menu(ev, c, m, ui) {
    document.querySelectorAll('.tg-menu').forEach((x) => x.remove());
    const teacher = isTeacher(c), me = m.by === SP.state.me, s = settings(c);
    const close = () => { pop.remove(); document.removeEventListener('pointerdown', out, true); };
    const out = (e) => !pop.contains(e.target) && close();
    const act = (label, fn) => h('button', { class: 'tg-mi', onclick: () => { close(); fn(); } }, label);
    const pop = h('div', { class: 'tg-menu', role: 'menu' },
      s.reactions ? h('div', { class: 'tg-mrx' }, REACTS.map((e) => h('button', { 'aria-label': 'تفاعل ' + e, onclick: () => { close(); react(m, e); } }, e))) : null,
      (s.students || teacher) ? act('↩️ رد', () => ui.reply(m)) : null,
      m.text ? act('📋 نسخ النص', () => navigator.clipboard && navigator.clipboard.writeText(m.text).then(() => SP.toast('نُسخ'), () => {})) : null,
      !teacher && m.type !== 'msg' && SP.saveToStudy ? act('🔖 احفظ في دراستي', () => { SP.saveToStudy(m); SP.refresh(); }) : null,
      teacher ? act(m.pinned ? '📌 إلغاء التثبيت' : '📌 تثبيت', () => { m.pinned = !m.pinned; SP.save(); SP.refresh(); }) : null,
      teacher && m.type === 'poll' && !m.closed ? act('🔒 إغلاق التصويت', () => { m.closed = true; SP.save(); SP.refresh(); }) : null,
      (me && (m.type === 'msg' || m.type === 'notice' || m.type === 'explain')) ? act('✏️ تعديل', () => edit(m)) : null,
      (teacher || me) ? act('🗑️ حذف', async () => { if (await SP.confirm('حذف هذه الرسالة؟')) { S().classItems = items().filter((x) => x.id !== m.id); SP.save(); SP.refresh(); } }) : null);
    document.body.append(pop);
    const r = ev.currentTarget.getBoundingClientRect(); pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px'; pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left - pop.offsetWidth / 2)) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', out, true));
  }
  function edit(m) {
    const ta = h('textarea', { class: 'inp', id: 'tg-edit', style: { minHeight: '120px' } }); ta.value = m.text || '';
    SP.modal({ title: 'تعديل الرسالة', body: ta, actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'حفظ', primary: true, onclick: (x) => { if (!ta.value.trim()) return; m.text = ta.value.trim(); m.edited = true; SP.save(); x(); SP.refresh(); } }] });
  }

  /* ---------- خيارات الأستاذ ---------- */
  function classSettings(c) {
    const s = settings(c);
    const mode = h('div', { class: 'grid s' }, [[true, 'مجموعة', 'الطلاب يكتبون ويردّون'], [false, 'قناة', 'الأستاذ فقط ينشر، والطلاب يقرأون ويتفاعلون']].map(([v, l, d]) =>
      h('label', { class: 'card tg-opt' }, h('input', { type: 'radio', name: 'tg-mode', checked: s.students === v, onchange: () => (s.students = v) }), h('b', {}, l), h('small', { class: 'sub', style: { margin: 0 } }, d))));
    const rx = h('input', { type: 'checkbox', id: 'tg-rx', checked: s.reactions, onchange: (e) => (s.reactions = e.target.checked) });
    SP.modal({ title: 'خيارات الصف: ' + c.name, body: h('div', {}, h('label', { class: 'lbl' }, 'من يكتب في المحادثة؟'), mode, h('label', { class: 'row', style: { marginTop: '12px' } }, rx, ' السماح بالتفاعلات (إيموجي)'),
      h('div', { class: 'card', style: { marginTop: '12px' } }, h('b', {}, 'كود الانضمام: ' + c.code), h('p', { class: 'sub', style: { margin: '4px 0 0' } }, 'شاركه مع طلابك لينضموا.'))),
      actions: [{ label: 'تم', primary: true, onclick: (x) => { SP.save(); x(); SP.refresh(); } }] });
  }
  function pollComposer(c) {
    const q = h('input', { class: 'inp', id: 'poll-q', style: { width: '100%' }, placeholder: 'السؤال' }), box = h('div', { class: 'grid', style: { gap: '6px' } }), opts = ['', ''];
    const draw = () => box.replaceChildren(...opts.map((o, i) => h('div', { class: 'row' }, h('input', { class: 'inp', style: { flex: 1 }, placeholder: 'خيار ' + (i + 1), value: o, oninput: (e) => (opts[i] = e.target.value) }), opts.length > 2 ? h('button', { class: 'btn ghost sm', onclick: () => { opts.splice(i, 1); draw(); } }, '✕') : null)));
    draw();
    SP.modal({ title: '📊 تصويت جديد', body: h('div', {}, SP.field('السؤال', q), h('label', { class: 'lbl' }, 'الخيارات'), box, h('button', { class: 'btn ghost sm', style: { marginTop: '6px' }, onclick: () => { if (opts.length < 6) { opts.push(''); draw(); } } }, 'خيار آخر')),
      actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'نشر', primary: true, onclick: (x) => { const o = opts.map((y) => y.trim()).filter(Boolean); if (!q.value.trim() || o.length < 2) return SP.toast('اكتب السؤال وخيارين على الأقل', 'err'); items().push({ id: SP.uid(), classId: c.id, by: SP.state.me, type: 'poll', title: '', q: q.value.trim(), opts: o, votes: {}, ts: Date.now() }); SP.save(); x(); SP.refresh(); } }] });
  }

  /* ---------- المحادثة ---------- */
  function chatView(c) {
    const s = settings(c), teacher = isTeacher(c), canWrite = teacher || s.students;
    let replyTo = null, query = '';
    const list = h('div', { class: 'tg-msgs', role: 'log', 'aria-label': 'رسائل ' + c.name });
    const ui = {
      jump: (id) => { const el = list.querySelector(`[data-id="${id}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); } },
      reply: (m) => { replyTo = m; replyBar.hidden = false; replyBar.querySelector('span').textContent = SP.user(m.by).name + ': ' + preview(m); input.focus(); },
    };
    const drawMsgs = () => {
      const all = msgsOf(c.id).filter((m) => !query || [m.text, m.title, m.q, m.desc].join(' ').includes(query));
      const out = []; let lastDay = '';
      all.forEach((m) => { const k = dayKey(m.ts); if (k !== lastDay) { out.push(h('div', { class: 'tg-day' }, h('span', {}, dayLabel(m.ts)))); lastDay = k; } out.push(bubble(c, m, ui)); });
      list.replaceChildren(...(out.length ? out : [h('div', { class: 'tg-empty' }, query ? 'لا نتائج' : teacher ? 'ابدأ المحادثة: اكتب رسالة أو أرسل تبليغاً أو شرحاً من 📎' : 'لا رسائل بعد')]));
      requestAnimationFrame(() => (list.scrollTop = list.scrollHeight));
      reads()[c.id] = Date.now(); SP.save();
    };
    const pinned = msgsOf(c.id).filter((m) => m.pinned).slice(-1)[0];
    const input = h('textarea', { class: 'tg-input', id: 'tg-input', rows: 1, placeholder: canWrite ? 'اكتب رسالة…' : '', 'aria-label': 'رسالة', dir: 'auto' });
    const send = () => {
      const t = input.value.trim(); if (!t) return;
      items().push({ id: SP.uid(), classId: c.id, by: SP.state.me, type: 'msg', title: '', text: t.slice(0, 4000), replyTo: replyTo ? replyTo.id : '', ts: Date.now() });
      input.value = ''; input.style.height = ''; replyTo = null; replyBar.hidden = true; SP.save(); drawMsgs();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; });
    const replyBar = h('div', { class: 'tg-replybar', hidden: true }, h('b', {}, '↩️ رد على: '), h('span', {}), h('button', { class: 'btn ghost sm', 'aria-label': 'إلغاء الرد', onclick: () => { replyTo = null; replyBar.hidden = true; } }, '✕'));
    const imgPick = h('input', { type: 'file', id: 'tg-img', accept: 'image/*', multiple: true, hidden: true, onchange: async (e) => {
      const images = []; for (const f of e.target.files) { if (!f.type.startsWith('image/')) continue; const k = SP.uid(); await SP.idb.put(k, f); images.push({ fileId: k, caption: f.name.replace(/\.[^.]+$/, ''), mime: f.type }); }
      e.target.value = ''; if (!images.length) return; items().push({ id: SP.uid(), classId: c.id, by: SP.state.me, type: 'gallery', title: '', desc: input.value.trim(), images, ts: Date.now() }); input.value = ''; SP.save(); drawMsgs();
    } });
    const ATTACH = teacher ? [['📷', 'صورة', () => imgPick.click()], ['📢', 'تبليغ', () => SP.classComposer('notice', c.id)], ['💡', 'شرح ومعلومة', () => SP.classComposer('explain', c.id)], ['🖼️', 'ألبوم صور', () => SP.classComposer('gallery', c.id)], ['🎬', 'محاضرة فيديو', () => SP.classComposer('lecture', c.id)], ['📝', 'موعد امتحان', () => SP.classComposer('exam', c.id)], ['📚', 'واجب', () => SP.classComposer('homework', c.id)], ['📊', 'تصويت', () => pollComposer(c)]]
      : [['📷', 'صورة', () => imgPick.click()]];
    const attachMenu = h('div', { class: 'attach-menu', hidden: true, role: 'menu' }, ATTACH.map(([ic, l, fn]) => h('button', { class: 'tg-mi', onclick: () => { attachMenu.hidden = true; fn(); } }, h('span', { class: 'am-ic' }, ic), l)));
    const emojiMenu = h('div', { class: 'attach-menu emoji-menu', hidden: true }, SP.EMOJIS.map((e) => h('button', { class: 'emo', onclick: () => { input.value += e; input.focus(); } }, e)));
    const toggle = (m, other) => { other.hidden = true; m.hidden = !m.hidden; };
    const search = h('input', { class: 'inp tg-search', type: 'search', placeholder: 'ابحث في المحادثة', hidden: true, 'aria-label': 'بحث في المحادثة', oninput: (e) => { query = e.target.value.trim(); drawMsgs(); } });
    const head = h('header', { class: 'tg-head' }, h('a', { class: 'btn ghost sm tg-back', href: '#/classes', 'aria-label': 'كل الصفوف' }, '→'),
      h('span', { class: 'tg-av', style: { background: c.color } }, initial(c.name)),
      h('div', { class: 'tg-hinfo' }, h('b', {}, c.name), h('small', {}, `${c.memberIds.length} طالب · ${s.students ? 'مجموعة' : 'قناة'} · ${SP.user(c.teacherId).name}`)),
      h('button', { class: 'btn ghost sm', 'aria-label': 'بحث', onclick: () => { search.hidden = !search.hidden; if (!search.hidden) search.focus(); else { query = ''; search.value = ''; drawMsgs(); } } }, '🔍'),
      h('a', { class: 'btn ghost sm', href: '#/classes/' + c.id + '/info', 'aria-label': 'تفاصيل الصف' }, 'ℹ️', h('span', { class: 'tg-lbl' }, ' تفاصيل الصف')),
      teacher ? h('button', { class: 'btn sm tg-settings', 'aria-label': 'خيارات الصف', onclick: () => classSettings(c) }, '⚙️', h('span', { class: 'tg-lbl' }, ' خيارات')) : null);
    const exam = SP.examBanner ? SP.examBanner(c.id) : null;
    const pinBar = pinned ? h('button', { class: 'tg-pin', onclick: () => ui.jump(pinned.id) }, h('b', {}, '📌 رسالة مثبّتة'), h('span', {}, preview(pinned))) : null;
    const composer = canWrite ? h('div', { class: 'tg-compose' }, replyBar, h('div', { class: 'tg-cbar' },
        h('button', { class: 'tg-ic tg-attach', 'aria-label': 'إرفاق', 'aria-haspopup': 'menu', onclick: () => toggle(attachMenu, emojiMenu) }, '📎'), imgPick,
        h('button', { class: 'tg-ic', 'aria-label': 'إيموجي', onclick: () => toggle(emojiMenu, attachMenu) }, '😊'), input,
        h('button', { class: 'tg-send', 'aria-label': 'إرسال', onclick: send }, h('span', { 'aria-hidden': 'true' }, '➤'))), attachMenu, emojiMenu)
      : h('div', { class: 'tg-locked' }, '📣 هذه قناة: الأستاذ فقط ينشر. تقدر تتفاعل وتحفظ الرسائل في دراستك.');
    const root = h('section', { class: 'tg-chatpane' }, head, search, [exam, pinBar].filter(Boolean), list, composer);
    drawMsgs(); return root;
  }

  SP.reg('classes', '🏫', 'الصفوف', (p) => {
    const id = p[0], c = id && SP.classById(id);
    if (id && p[1] === 'info') return SP.classDetail(id, p[2]);
    if (id && (!c || !SP.canSeeClass(id))) return SP.page('الصف غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('classes') }, 'رجوع'));
    return h('div', { class: 'tg' + (c ? ' has-chat' : '') }, chatList(id), c ? chatView(c) : h('section', { class: 'tg-chatpane tg-none' }, h('div', { class: 'tg-empty' }, h('div', { class: 'sticker', style: { fontSize: '2.6rem', marginBottom: '8px' } }, '💬'), 'اختر صفاً لتفتح محادثته')));
  });
})();
