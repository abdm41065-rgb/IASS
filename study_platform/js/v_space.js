/* مساحتي (دراسة): الطالب يجمع ما يصله من الصفوف ومن ملفاته، يضيف ملاحظاته، يرتّبه في مجموعات بالسحب، ويرسل ترتيبه لزملائه */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const cols = () => (S().cols = S().cols || []);
  const mine = () => cols().filter((c) => c.ownerId === SP.state.me);
  const TAGS = ['', '#C62828', '#E07B00', '#2E7D32', '#1F4E99', '#7B3FA0'];
  const EMO = ['📚', '🫀', '🧠', '🧪', '🦴', '🔬', '📝', '⭐', '🎯', '💊'];
  const ICON = { notice: '📢', explain: '💡', gallery: '🖼️', lecture: '🎬', exam: '📝', homework: '📚' };
  const touch = (c) => { c.updated = Date.now(); SP.save(); };

  SP.savedTray = () => {
    let t = mine().find((c) => c.tray);
    if (!t) { t = { id: SP.uid(), ownerId: SP.state.me, name: 'محفوظات من الصفوف', emoji: '📥', color: '#1F4E99', tray: true, created: Date.now(), updated: Date.now(), items: [] }; cols().unshift(t); SP.save(); }
    return t;
  };
  SP.isSaved = (itemId) => mine().some((c) => c.items.some((i) => i.kind === 'item' && i.ref === itemId));
  SP.saveToStudy = (it) => {
    if (SP.isSaved(it.id)) return SP.toast('محفوظ مسبقاً في دراستك');
    const t = SP.savedTray(); t.items.unshift({ id: SP.uid(), kind: 'item', ref: it.id, title: it.title, note: '', tag: '', done: false }); touch(t);
    SP.toast('حُفظ في دراستك ← «محفوظات من الصفوف»'); SP.emit('react', 'happy');
  };
  SP.savedBy = (itemId) => S().users.filter((u) => cols().some((c) => c.ownerId === u.id && c.items.some((i) => i.kind === 'item' && i.ref === itemId))).length;

  /* ما يمكن إضافته لمجموعة */
  const classItem = (id) => (S().classItems || []).find((x) => x.id === id && SP.canSeeClass(x.classId));
  function resolve(i) {
    if (i.kind === 'item') { const it = classItem(i.ref); if (!it) return { icon: '⚠️', title: i.title || 'عنصر غير متاح', sub: 'لم يعد متاحاً لك', go: null };
      const sub = it.type === 'exam' ? `امتحان · ${it.date} ${it.time || ''}` : it.type === 'homework' ? `واجب · التسليم ${it.due}` : (it.text || it.desc || '').replace(/\*\*/g, '').slice(0, 140);
      return { icon: ICON[it.type] || '📌', title: it.title, sub, cls: SP.className(it.classId), go: it.type === 'lecture' && it.fileId ? 'lectures/' + it.id : 'classes/' + it.classId + '/lec' }; }
    if (i.kind === 'wdoc') { const d = (S().wdocs || []).find((x) => x.id === i.ref); return d ? { icon: '📄', title: d.name, sub: `مستند · ${d.words || 0} كلمة`, go: 'writer/' + d.id } : { icon: '⚠️', title: i.title || 'مستند محذوف', sub: '', go: null }; }
    if (i.kind === 'doc') { const d = (S().docs || []).find((x) => x.id === i.ref); return d ? { icon: '🖍️', title: d.name, sub: `ملف بتعليقاتي · ${d.pages.length} صفحة`, go: 'desk/' + d.id } : { icon: '⚠️', title: i.title || 'ملف محذوف', sub: '', go: null }; }
    if (i.kind === 'file') { const f = S().files.find((x) => x.id === i.ref); return f ? { icon: '📎', title: f.name, sub: f.desc || SP.size(f.size), file: f, go: null } : { icon: '⚠️', title: i.title || 'ملف محذوف', sub: '', go: null }; }
    if (i.kind === 'snote') { const n = S().notes.find((x) => x.id === i.ref); return n ? { icon: '🗒️', title: n.title, sub: n.body.slice(0, 140), go: 'notes' } : { icon: '⚠️', title: i.title || 'ملاحظة محذوفة', sub: '', go: null }; }
    return { icon: '📝', title: '', sub: '' };
  }
  function pickModal(c, draw) {
    const sources = [
      ['من الصفوف', (S().classItems || []).filter((x) => SP.canSeeClass(x.classId)).sort((a, b) => b.ts - a.ts).map((x) => ['item', x.id, (ICON[x.type] || '📌') + ' ' + x.title, SP.className(x.classId)])],
      ['مستنداتي', (S().wdocs || []).filter((x) => x.ownerId === SP.state.me).map((x) => ['wdoc', x.id, '📄 ' + x.name, ''])],
      ['ملفات عليها تعليقاتي', (S().docs || []).filter((x) => x.ownerId === SP.state.me).map((x) => ['doc', x.id, '🖍️ ' + x.name, ''])],
      ['ملفاتي', S().files.filter((x) => (x.classId ? SP.canSeeClass(x.classId) : x.ownerId === SP.state.me)).map((x) => ['file', x.id, '📎 ' + x.name, ''])],
      ['ملاحظاتي', S().notes.filter((x) => x.ownerId === SP.state.me).map((x) => ['snote', x.id, '🗒️ ' + x.title, ''])],
    ];
    const chosen = new Set();
    SP.modal({ title: 'أضف إلى «' + c.name + '»', wide: true, body: h('div', { class: 'pick' }, sources.map(([label, list]) => list.length ? h('div', {}, h('h3', {}, label), h('div', { class: 'pick-list' }, list.map(([k, id, t, sub]) => h('label', { class: 'pick-item' }, h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? chosen.add(k + ':' + id) : chosen.delete(k + ':' + id)) }), h('span', {}, t), sub ? h('small', { class: 'sub', style: { margin: 0 } }, sub) : null)))) : null)),
      actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'أضف', primary: true, onclick: (x) => { [...chosen].forEach((s) => { const [kind, ref] = s.split(':'); c.items.push({ id: SP.uid(), kind, ref, title: resolve({ kind, ref }).title, note: '', tag: '', done: false }); }); touch(c); x(); draw(); } }] });
  }

  /* ---------- قائمة المجموعات ---------- */
  function newCol(after) {
    const name = h('input', { class: 'inp', id: 'col-name', style: { width: '100%' }, placeholder: 'مثال: مراجعة امتحان التشريح العملي' }); let emoji = EMO[0];
    const em = h('div', { class: 'row' }); const draw = () => em.replaceChildren(...EMO.map((e) => h('button', { class: 'emo' + (e === emoji ? ' on' : ''), onclick: () => { emoji = e; draw(); } }, e))); draw();
    SP.modal({ title: 'مجموعة جديدة', body: h('div', {}, SP.field('الاسم', name), SP.field('الرمز', em)), actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إنشاء', primary: true, onclick: (x) => {
      const c = { id: SP.uid(), ownerId: SP.state.me, name: name.value.trim() || 'مجموعتي', emoji, color: '#1F4E99', created: Date.now(), updated: Date.now(), items: [] }; cols().push(c); SP.save(); x(); after ? after(c) : SP.go('space/' + c.id);
    } }] });
  }
  function listView() {
    SP.savedTray();
    const shares = (S().inbox || []).filter((m) => m.to === SP.state.me && m.type === 'col' && !m.imported);
    const list = mine().sort((a, b) => (b.tray - a.tray) || b.updated - a.updated);
    return SP.page('دراسة', 'مساحتك الخاصة: احفظ ما يرسله الأساتذة، أضف ملاحظاتك، ورتّب كل شيء في مجموعات كما تحب، ثم أرسل ترتيبك لزملائك.',
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => newCol() }, 'مجموعة جديدة'), h('button', { class: 'btn ghost', onclick: () => SP.go('classes') }, 'تصفّح الصفوف واحفظ منها')),
      shares.length ? h('div', { class: 'card share-in' }, h('b', {}, '📨 ترتيبات أرسلها لك زملاؤك'), shares.map((m) => h('div', { class: 'row sp', style: { marginTop: '8px' } }, h('span', {}, `${m.col.emoji} «${m.col.name}» من ${SP.user(m.from).name} · ${m.col.items.length} عنصر`), h('button', { class: 'btn sm', onclick: () => SP.importCol(m) }, 'أضف إلى دراستي')))) : null,
      h('div', { class: 'grid', style: { marginTop: '14px' } }, list.map((c) => {
        const done = c.items.filter((i) => i.done).length;
        return h('div', { class: 'card click colcard' + (c.tray ? ' tray' : ''), onclick: () => SP.go('space/' + c.id) },
          h('div', { class: 'row sp' }, h('span', { class: 'col-emo' }, c.emoji || '📚'), c.from ? h('span', { class: 'chip' }, 'من ' + SP.user(c.from).name) : null),
          h('h3', {}, c.name), h('div', { class: 'sub', style: { margin: '0 0 8px' } }, `${c.items.filter((i) => i.kind !== 'heading').length} عنصر` + (c.tray ? '' : ` · أنجزت ${done}`)),
          c.items.length && !c.tray ? h('div', { class: 'bar' }, h('i', { style: { width: Math.round((100 * done) / Math.max(1, c.items.filter((i) => i.kind !== 'heading').length)) + '%' } })) : null,
          h('div', { class: 'col-peek' }, c.items.slice(0, 3).map((i) => h('div', {}, i.kind === 'heading' ? '— ' + i.text : (resolve(i).icon + ' ' + (i.kind === 'note' ? i.text.slice(0, 40) : resolve(i).title))))));
      })));
  }

  /* ---------- صفحة المجموعة: ترتيب بالسحب، ملاحظاتي، وسوم ---------- */
  function colView(c) {
    const root = h('div', {}), list = h('ol', { class: 'col-list', 'aria-label': 'عناصر المجموعة' });
    let dragId = null;
    const move = (from, to) => { if (to < 0 || to >= c.items.length) return; const [x] = c.items.splice(from, 1); c.items.splice(to, 0, x); touch(c); draw(); };
    const row = (i, idx) => {
      const li = h('li', { class: 'col-item k-' + i.kind + (i.done ? ' done' : ''), draggable: 'true', 'data-id': i.id, style: i.tag ? { borderInlineStartColor: i.tag } : null });
      li.addEventListener('dragstart', (e) => { dragId = i.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', i.id); });
      li.addEventListener('dragend', () => { li.classList.remove('dragging'); dragId = null; list.querySelectorAll('.over').forEach((x) => x.classList.remove('over')); });
      li.addEventListener('dragover', (e) => { if (!dragId || dragId === i.id) return; e.preventDefault(); li.classList.add('over'); });
      li.addEventListener('dragleave', () => li.classList.remove('over'));
      li.addEventListener('drop', (e) => { e.preventDefault(); const from = c.items.findIndex((x) => x.id === dragId); if (from > -1) move(from, idx); });
      const ctrls = h('div', { class: 'col-ctrl' },
        h('span', { class: 'grip-h', 'aria-hidden': 'true', title: 'اسحب لإعادة الترتيب' }, '⠿'),
        h('button', { class: 'btn ghost sm', 'aria-label': 'أعلى', disabled: idx === 0, onclick: () => move(idx, idx - 1) }, '▲'), h('button', { class: 'btn ghost sm', 'aria-label': 'أسفل', disabled: idx === c.items.length - 1, onclick: () => move(idx, idx + 1) }, '▼'));
      const tail = h('div', { class: 'col-tail' },
        i.kind !== 'heading' ? h('span', { class: 'tags' }, TAGS.map((t) => h('button', { class: 'tagdot' + (i.tag === t ? ' on' : ''), style: { background: t || 'var(--card)' }, 'aria-label': t ? 'وسم لون' : 'بدون وسم', onclick: () => { i.tag = t; touch(c); draw(); } }))) : null,
        mine().length > 1 ? h('select', { class: 'inp sm-sel', 'aria-label': 'انقل إلى مجموعة', onchange: (e) => { const to = mine().find((x) => x.id === e.target.value); if (!to) return; c.items.splice(idx, 1); to.items.push(i); touch(c); touch(to); SP.toast('نُقل إلى «' + to.name + '»'); draw(); } }, h('option', { value: '' }, 'انقل إلى…'), mine().filter((x) => x.id !== c.id).map((x) => h('option', { value: x.id }, (x.emoji || '') + ' ' + x.name))) : null,
        h('button', { class: 'btn ghost sm', 'aria-label': 'إزالة من المجموعة', onclick: () => { c.items.splice(idx, 1); touch(c); draw(); } }, '✕'));
      if (i.kind === 'heading') {
        const t = h('input', { class: 'inp col-head', value: i.text, 'aria-label': 'عنوان القسم', onchange: (e) => { i.text = e.target.value; touch(c); } });
        li.append(ctrls, t, tail); return li;
      }
      if (i.kind === 'note') {
        const ta = h('textarea', { class: 'inp col-note', 'aria-label': 'ملاحظة', placeholder: 'اكتب ملاحظتك…' }); ta.value = i.text || '';
        ta.addEventListener('input', () => { i.text = ta.value; touch(c); });
        li.append(ctrls, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: i.done, 'aria-label': 'تم', onchange: (e) => { i.done = e.target.checked; touch(c); li.classList.toggle('done', i.done); } })), h('div', { class: 'col-body' }, h('div', { class: 'col-title' }, '🗒️ ملاحظة'), ta), tail); return li;
      }
      const r = resolve(i), mynote = h('textarea', { class: 'inp col-mynote', rows: 1, placeholder: 'ملاحظتي على هذا…', 'aria-label': 'ملاحظتي' }); mynote.value = i.note || '';
      mynote.addEventListener('input', () => { i.note = mynote.value; touch(c); });
      li.append(ctrls, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: i.done, 'aria-label': 'تم', onchange: (e) => { i.done = e.target.checked; touch(c); li.classList.toggle('done', i.done); } })),
        h('div', { class: 'col-body' }, h('div', { class: 'col-title' }, h('span', {}, r.icon + ' '), r.go ? h('a', { href: '#/' + r.go }, r.title) : r.file ? h('button', { class: 'linkish', onclick: () => SP.openInDesk(r.file) }, r.title) : r.title, r.cls ? h('span', { class: 'chip' }, r.cls) : null),
          r.sub ? h('div', { class: 'col-sub' }, r.sub) : null, mynote), tail);
      return li;
    };
    const draw = () => {
      list.replaceChildren(...(c.items.length ? c.items.map(row) : [h('li', { class: 'empty' }, c.tray ? 'اضغط «احفظ في دراستي» على أي منشور في الصفوف ليظهر هنا.' : 'أضف عناوين أقسام وملاحظات وعناصر من صفوفك وملفاتك، ثم رتّبها بالسحب.')]));
      prog.textContent = c.tray ? '' : `أنجزت ${c.items.filter((i) => i.done).length} من ${c.items.filter((i) => i.kind !== 'heading').length}`;
    };
    const prog = h('span', { class: 'sub', style: { margin: 0 } });
    const title = h('input', { class: 'inp wtitle', id: 'col-title', value: c.name, 'aria-label': 'اسم المجموعة', onchange: (e) => { c.name = e.target.value.trim() || c.name; touch(c); } });
    root.append(h('div', { class: 'row sp', style: { marginBottom: '12px' } }, h('div', { class: 'row', style: { flex: 1 } }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('space') }, 'رجوع'), h('span', { class: 'col-emo' }, c.emoji || '📚'), title), prog),
      h('div', { class: 'col-tools' },
        h('button', { class: 'btn', onclick: () => pickModal(c, draw) }, 'أضف من الصفوف والملفات'),
        h('button', { class: 'btn ghost', onclick: () => { c.items.push({ id: SP.uid(), kind: 'heading', text: 'قسم جديد' }); touch(c); draw(); list.lastChild.querySelector('input').select(); } }, 'عنوان قسم'),
        h('button', { class: 'btn ghost', onclick: () => { c.items.push({ id: SP.uid(), kind: 'note', text: '', done: false }); touch(c); draw(); list.lastChild.querySelector('textarea').focus(); } }, 'ملاحظة'),
        SP.more([['📤 أرسل الترتيب لزملائي', () => shareCol(c)], SP.flowItem ? SP.flowItem('col', c.id, c.name) : null, !c.tray ? ['🗑 حذف المجموعة', async () => { if (await SP.confirm('حذف المجموعة «' + c.name + '»؟ (لا تُحذف الملفات نفسها)')) { S().cols = cols().filter((x) => x.id !== c.id); SP.save(); SP.go('space'); } } , true] : null])),
      list);
    draw(); return root;
  }

  /* ---------- إرسال الترتيب واستقباله ---------- */
  function shareCol(c) {
    if (!c.items.length) return SP.toast('المجموعة فارغة', 'err');
    const mates = [...new Set(SP.myClasses().flatMap((x) => x.memberIds))].filter((u) => u !== SP.state.me), others = S().users.filter((u) => u.id !== SP.state.me && !mates.includes(u.id)), picked = new Set();
    const item = (u) => h('label', { class: 'card row', style: { padding: '10px', cursor: 'pointer' } }, h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? picked.add(u.id) : picked.delete(u.id)) }), SP.avatar(u), u.name);
    const note = h('input', { class: 'inp', id: 'share-note', style: { width: '100%' }, placeholder: 'رسالة قصيرة (اختياري)' });
    SP.modal({ title: 'أرسل «' + c.name + '»', body: h('div', {}, h('p', { class: 'sub' }, 'يصلهم ترتيبك بأقسامه وملاحظاتك، ويقدرون يضيفونه لدراستهم ويعدّلون عليه.'),
      mates.length ? [h('label', { class: 'lbl' }, 'زملاء الصف'), h('div', { class: 'grid s' }, mates.map((id) => item(SP.user(id))))] : null,
      others.length ? [h('label', { class: 'lbl' }, 'آخرون'), h('div', { class: 'grid s' }, others.map(item))] : null, SP.field('رسالة', note)),
      actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إرسال', primary: true, onclick: (x) => {
        if (!picked.size) return SP.toast('اختر زميلاً واحداً على الأقل', 'err');
        const snap = { name: c.name, emoji: c.emoji, items: c.items.map((i) => ({ ...i, title: i.kind === 'heading' || i.kind === 'note' ? i.title : resolve(i).title })) };
        picked.forEach((to) => (S().inbox = S().inbox || []).push({ id: SP.uid(), type: 'col', from: SP.state.me, to, name: '🗂️ ' + c.name, note: note.value.trim(), ts: Date.now(), read: false, col: JSON.parse(JSON.stringify(snap)) }));
        SP.save(); x(); SP.toast(`أُرسل الترتيب إلى ${picked.size} ${picked.size > 1 ? 'زملاء' : 'زميل'}`); SP.emit('react', 'send'); SP.updateBell && SP.updateBell();
      } }] });
  }
  SP.importCol = async (m) => {
    const me = SP.state.me, items = [];
    for (const i of m.col.items) {
      const n = { ...i, id: SP.uid(), done: false };
      if (i.kind === 'wdoc') { const src = (S().wdocs || []).find((x) => x.id === i.ref), html = src ? await SP.idb.get('wdoc:' + src.id) : null; if (html != null && SP.createWriterDoc) { const d = await SP.createWriterDoc(src.name + ' (من ' + SP.user(m.from).name + ')', html); n.ref = d.id; } else { n.kind = 'note'; n.text = '📄 ' + (i.title || 'مستند') + ' (غير متاح)'; } }
      else if (i.kind === 'doc') { const src = (S().docs || []).find((x) => x.id === i.ref); if (src) { const copy = JSON.parse(JSON.stringify(src)); copy.id = SP.uid(); copy.ownerId = me; copy.name += ' (من ' + SP.user(m.from).name + ')'; if (src.fileId) { const b = await SP.idb.get(src.fileId); if (b) { copy.fileId = SP.uid(); await SP.idb.put(copy.fileId, b); } } S().docs.push(copy); n.ref = copy.id; } else { n.kind = 'note'; n.text = '🖍️ ' + (i.title || 'ملف') + ' (غير متاح)'; } }
      else if (i.kind === 'file') { const f = S().files.find((x) => x.id === i.ref); if (f && f.ownerId !== me && !(f.classId && SP.canSeeClass(f.classId))) { const b = await SP.idb.get(f.id); if (b) { const id = SP.uid(); await SP.idb.put(id, b); S().files.push({ ...f, id, ownerId: me, classId: '', tags: [...new Set([...(f.tags || []), 'مستلم'])], added: Date.now() }); n.ref = id; } } }
      else if (i.kind === 'snote') { const src = S().notes.find((x) => x.id === i.ref); n.kind = 'note'; n.text = src ? `${src.title}\n${src.body}` : (i.title || ''); }
      items.push(n);
    }
    const c = { id: SP.uid(), ownerId: me, name: m.col.name, emoji: m.col.emoji, color: '#1F4E99', from: m.from, created: Date.now(), updated: Date.now(), items };
    cols().push(c); m.imported = true; m.read = true; SP.save(); SP.updateBell && SP.updateBell();
    SP.toast('أُضيف ترتيب ' + SP.user(m.from).name + ' إلى دراستك'); SP.go('space/' + c.id);
  };

  SP.reg('space', '', 'مساحتي', (p) => {
    if (!p[0]) return listView();
    const c = mine().find((x) => x.id === p[0]);
    return c ? colView(c) : SP.page('المجموعة غير موجودة', '', h('button', { class: 'btn', onclick: () => SP.go('space') }, 'رجوع'));
  });
})();
