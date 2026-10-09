/* الملاحظات · الملفات · الملازم · الملصقات */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const tint = (c) => c + '26';

  /* ---------- الملاحظات ---------- */
  const visibleNote = (n) => (n.classId ? SP.canSeeClass(n.classId) : n.ownerId === SP.state.me);
  const canEdit = (item, ownerKey = 'ownerId') => item[ownerKey] === SP.state.me || (item.classId && SP.isTeacher() && (SP.classById(item.classId) || {}).teacherId === SP.state.me);
  function noteEditor(note) {
    const n = note || { id: SP.uid(), ownerId: SP.state.me, title: '', body: '', color: SP.COLORS[2], pinned: false, tags: [], classId: '', stickers: [], updated: Date.now() };
    const title = h('input', { class: 'inp', style: { width: '100%' }, value: n.title, placeholder: 'العنوان' }), body = h('textarea', { class: 'inp', style: { minHeight: '180px' }, placeholder: 'اكتب ملاحظتك…' });
    body.value = n.body; const tags = SP.tagInput(n.tags), cls = SP.classSelect(n.classId, false), st = [...(n.stickers || [])]; let color = n.color, pinned = n.pinned;
    const pin = h('label', {}, h('input', { type: 'checkbox', checked: pinned, onchange: (e) => (pinned = e.target.checked) }), ' 📌 تثبيت');
    SP.modal({ title: note ? 'تعديل الملاحظة' : 'ملاحظة جديدة', wide: true, body: h('div', {}, SP.field('العنوان', title), SP.field('المحتوى', body), SP.field('الوسوم', tags), SP.field('الصف (اختياري: ليراها زملاؤك)', cls), SP.field('اللون', SP.swatches(color, (c) => (color = c))), SP.field('ملصقات', SP.stickerPicker(st)), h('div', { style: { marginTop: '10px' } }, pin)),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'حفظ', primary: true, onclick: (c) => {
        if (!title.value.trim() && !body.value.trim()) return SP.toast('الملاحظة فارغة', 'err');
        Object.assign(n, { title: title.value.trim() || 'بدون عنوان', body: body.value, tags: SP.parseTags(tags.value), classId: cls.value, color, pinned, stickers: st, updated: Date.now() });
        if (!note) S().notes.push(n); SP.save(); c(); SP.refresh();
      } }] });
  }
  SP.reg('notes', '📝', 'الملاحظات', () => {
    let q = '', tag = '', onlyPin = false;
    const root = h('div', {}), grid = h('div', { class: 'grid' }), bar = h('div', {});
    const all = () => S().notes.filter(visibleNote);
    const draw = () => {
      const tags = [...new Set(all().flatMap((n) => n.tags))];
      bar.replaceChildren(SP.filterBar(tags, tag, (t) => { tag = t; draw(); }));
      const list = all().filter((n) => (!tag || n.tags.includes(tag)) && (!onlyPin || n.pinned) && (n.title + n.body + n.tags.join(' ')).toLowerCase().includes(q)).sort((a, b) => b.pinned - a.pinned || b.updated - a.updated);
      grid.replaceChildren(...(list.length ? list.map((n) => h('div', { class: 'note', style: { background: tint(n.color), borderColor: n.color } },
        h('div', { class: 'row sp' }, h('b', {}, (n.pinned ? '📌 ' : '') + n.title), n.classId ? h('span', { class: 'chip' }, SP.className(n.classId)) : null),
        h('p', {}, n.body.length > 220 ? n.body.slice(0, 220) + '…' : n.body),
        h('div', {}, (n.stickers || []).map((e) => h('span', { style: { fontSize: '1.3rem' } }, e)), n.tags.map((t) => h('span', { class: 'chip' }, '#' + t))),
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('small', { class: 'sub', style: { margin: 0 } }, SP.date(n.updated) + (n.ownerId !== SP.state.me ? ' · ' + SP.user(n.ownerId).name : '')),
          h('button', { class: 'btn ghost sm', onclick: () => SP.download((n.title || 'note') + '.txt', n.title + '\n\n' + n.body) }, '⬇️'),
          canEdit(n) ? [h('button', { class: 'btn ghost sm', onclick: () => noteEditor(n) }, '✏️'), h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('حذف الملاحظة؟')) { S().notes = S().notes.filter((x) => x.id !== n.id); SP.save(); draw(); } } }, '🗑️')] : null))) : [SP.empty('لا توجد ملاحظات مطابقة')]));
    };
    root.append(SP.page('الملاحظات', 'دوّن أفكارك ولوّنها ووسمها ودبّسها.', h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => noteEditor() }, '➕ ملاحظة جديدة'), h('input', { class: 'inp', placeholder: 'بحث في الملاحظات…', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } }),
      h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { onlyPin = e.target.checked; draw(); } }), ' المثبّتة فقط')), h('div', { style: { margin: '10px 0' } }, bar), grid)); draw(); return root;
  });

  /* ---------- الملفات والملازم ---------- */
  const icon = (m = '') => (m.startsWith('image') ? '🖼️' : m.includes('pdf') ? '📕' : m.startsWith('video') ? '🎬' : m.startsWith('audio') ? '🎧' : m.includes('word') ? '📘' : m.includes('sheet') || m.includes('excel') ? '📗' : m.includes('presentation') || m.includes('powerpoint') ? '📙' : m.startsWith('text') || m.includes('html') ? '📄' : '📦');
  async function preview(f) {
    const blob = await SP.idb.get(f.id), box = h('div', {});
    if (!blob) box.append(SP.empty('الملف غير موجود في هذا المتصفح (ربما رُفع من جهاز آخر)'));
    else {
      const url = URL.createObjectURL(blob), m = f.mime || '';
      if (m.startsWith('image')) box.append(h('img', { src: url, style: { maxWidth: '100%', borderRadius: '10px' } }));
      else if (m.includes('pdf')) box.append(h('iframe', { src: url, style: { width: '100%', height: '70vh', border: 0 } }));
      else if (m.startsWith('video')) box.append(h('video', { src: url, controls: true, style: { width: '100%' } }));
      else if (m.startsWith('audio')) box.append(h('audio', { src: url, controls: true, style: { width: '100%' } }));
      else if (m.includes('html')) box.append(h('iframe', { src: url, sandbox: '', style: { width: '100%', height: '70vh', border: 0, background: '#fff' } }));
      else if (m.startsWith('text')) { const pre = h('pre', { style: { whiteSpace: 'pre-wrap' } }); blob.text().then((t) => (pre.textContent = t.slice(0, 20000))); box.append(pre); }
      else box.append(SP.empty('لا يمكن معاينة هذا النوع. نزّل الملف لفتحه.'));
      box.append(h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: () => SP.download(f.name, blob) }, '⬇️ تنزيل')));
    }
    SP.modal({ title: f.name, wide: true, body: box, actions: [{ label: 'إغلاق', onclick: (c) => c() }] });
  }
  function fileEditor(f, kind) {
    const tags = SP.tagInput(f.tags), cls = SP.classSelect(f.classId, false), desc = h('textarea', { class: 'inp', placeholder: 'وصف مختصر' }); desc.value = f.desc || '';
    let color = f.color || '', star = !!f.star; const st = [...(f.stickers || [])], pages = h('input', { class: 'inp', type: 'number', min: 0, value: f.pages || 0 });
    const colors = h('span', {}); const drawC = () => colors.replaceChildren(h('span', { class: 'sw' + (!color ? ' on' : ''), style: { background: 'var(--line)' }, onclick: () => { color = ''; drawC(); } }), ...SP.COLORS.map((x) => h('span', { class: 'sw' + (x === color ? ' on' : ''), style: { background: x }, onclick: () => { color = x; drawC(); } }))); drawC();
    SP.modal({ title: 'تمييز وتنظيم: ' + f.name, wide: true, body: h('div', {}, SP.field('الوصف', desc), SP.field('الوسوم', tags), SP.field('الصف', cls), SP.field('لون التمييز', colors), SP.field('ملصقات', SP.stickerPicker(st)),
      kind === 'handout' ? SP.field('عدد صفحات الملزمة', pages) : null, h('label', { style: { display: 'block', marginTop: '10px' } }, h('input', { type: 'checkbox', checked: star, onchange: (e) => (star = e.target.checked) }), ' ⭐ مهم (مميّز)')),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'حفظ', primary: true, onclick: (c) => { Object.assign(f, { desc: desc.value, tags: SP.parseTags(tags.value), classId: cls.value, color, star, stickers: st, pages: +pages.value || 0 }); SP.save(); c(); SP.refresh(); } }] });
  }
  async function addFiles(fileList, kind, classId) {
    let n = 0;
    for (const file of fileList) {
      const id = SP.uid();
      try { await SP.idb.put(id, file); } catch (e) { SP.toast('تعذّر حفظ ' + file.name, 'err'); continue; }
      S().files.push({ id, ownerId: SP.state.me, name: file.name, mime: file.type || '', size: file.size, tags: [], color: '', star: false, stickers: [], kind, classId: classId || '', added: Date.now(), desc: '', pages: 0, readPages: 0 }); n++;
    }
    SP.save(); SP.toast(`تم رفع ${n} ملف`); SP.refresh();
  }
  function handoutFromNotes() {
    const notes = S().notes.filter((n) => visibleNote(n)); const title = h('input', { class: 'inp', style: { width: '100%' }, value: 'ملزمتي' }), picked = new Set();
    SP.modal({ title: 'إنشاء ملزمة من ملاحظاتك', body: h('div', {}, SP.field('عنوان الملزمة', title), h('label', { class: 'lbl' }, 'اختر الملاحظات'),
      notes.length ? notes.map((n) => h('label', { style: { display: 'block' } }, h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? picked.add(n.id) : picked.delete(n.id)) }), ' ' + n.title)) : SP.empty('لا ملاحظات')),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: async (c) => {
        const chosen = notes.filter((n) => picked.has(n.id)); if (!chosen.length) return SP.toast('اختر ملاحظة واحدة على الأقل', 'err');
        const esc = (s) => s.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));
        const html = `<!doctype html><meta charset="utf-8"><html dir="rtl"><body style="font-family:Tahoma,sans-serif;max-width:800px;margin:auto;padding:24px"><h1>${esc(title.value)}</h1>` + chosen.map((n, i) => `<h2>${i + 1}. ${esc(n.title)}</h2><p style="white-space:pre-wrap">${esc(n.body)}</p>`).join('') + '</body></html>';
        c(); await addFiles([new File([html], (title.value || 'ملزمة') + '.html', { type: 'text/html' })], 'handout', '');
      } }] });
  }
  SP.fileGrid = ({ kind, classId } = {}) => {
    const root = h('div', {}), grid = h('div', { class: 'grid' }), bar = h('div', {});
    let q = '', tag = '', onlyStar = false, colorF = '';
    const vis = (f) => (!kind || f.kind === kind) && (!classId || f.classId === classId) && (f.classId ? SP.canSeeClass(f.classId) : f.ownerId === SP.state.me);
    const draw = () => {
      const all = S().files.filter(vis), tags = [...new Set(all.flatMap((f) => f.tags))];
      bar.replaceChildren(SP.filterBar(tags, tag, (t) => { tag = t; draw(); }));
      const list = all.filter((f) => (!tag || f.tags.includes(tag)) && (!onlyStar || f.star) && (!colorF || f.color === colorF) && (f.name + f.desc + f.tags.join(' ')).toLowerCase().includes(q)).sort((a, b) => b.star - a.star || b.added - a.added);
      grid.replaceChildren(...(list.length ? list.map((f) => h('div', { class: 'card', style: { borderInlineStart: `6px solid ${f.color || 'var(--line)'}`, background: f.color ? tint(f.color) : '' } },
        h('div', { class: 'row sp' }, h('span', { style: { fontSize: '2rem' } }, icon(f.mime)), h('span', {}, (f.stickers || []).join(' '), f.star ? ' ⭐' : '')),
        h('b', { style: { wordBreak: 'break-all', cursor: 'pointer' }, onclick: () => preview(f) }, f.name), h('div', { class: 'sub', style: { margin: 0 } }, SP.size(f.size) + ' · ' + SP.date(f.added) + (f.classId ? ' · ' + SP.className(f.classId) : '') + (f.ownerId !== SP.state.me ? ' · ' + SP.user(f.ownerId).name : '')),
        f.desc ? h('p', {}, f.desc) : null, h('div', {}, f.tags.map((t) => h('span', { class: 'chip' }, '#' + t))),
        f.kind === 'handout' && f.pages ? h('div', {}, h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, (100 * f.readPages) / f.pages) + '%' } })), h('div', { class: 'row', style: { marginTop: '6px' } }, h('small', {}, 'قرأت'), h('input', { class: 'inp', type: 'number', min: 0, max: f.pages, value: f.readPages || 0, style: { width: '70px' }, onchange: (e) => { f.readPages = Math.min(f.pages, +e.target.value || 0); SP.save(); draw(); } }), h('small', {}, 'من ' + f.pages))) : null,
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn ghost sm', onclick: () => preview(f) }, '👁️ معاينة'),
          canEdit(f) ? [h('button', { class: 'btn ghost sm', onclick: () => fileEditor(f, f.kind) }, '🏷️ تمييز'), h('button', { class: 'btn ghost sm', onclick: async () => { if (await SP.confirm('حذف الملف؟')) { await SP.idb.del(f.id); S().files = S().files.filter((x) => x.id !== f.id); SP.save(); draw(); } } }, '🗑️')] : null))) : [SP.empty('لا توجد ملفات. ارفع ملفاً أو اسحبه هنا.')]));
    };
    const input = h('input', { type: 'file', multiple: true, style: { display: 'none' }, onchange: (e) => addFiles([...e.target.files], kind || 'file', classId) });
    const colorBtns = h('span', {}, h('span', { class: 'sw', style: { background: 'var(--line)' }, title: 'كل الألوان', onclick: () => { colorF = ''; draw(); } }), SP.COLORS.map((c) => h('span', { class: 'sw', style: { background: c, width: '18px', height: '18px' }, onclick: () => { colorF = c; draw(); } })));
    root.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => input.click() }, kind === 'handout' ? '📚 رفع ملزمة' : '⬆️ رفع ملفات'), input,
      kind === 'handout' ? h('button', { class: 'btn ghost', onclick: handoutFromNotes }, '🪄 ملزمة من ملاحظاتي') : null,
      h('input', { class: 'inp', placeholder: 'بحث…', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } }), colorBtns, h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { onlyStar = e.target.checked; draw(); } }), ' ⭐ المهمة فقط')),
    h('div', { style: { margin: '10px 0' } }, bar), grid);
    root.addEventListener('dragover', (e) => e.preventDefault()); root.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files], kind || 'file', classId); });
    draw(); return root;
  };
  SP.reg('files', '📁', 'الملفات', () => SP.page('الملفات', 'ارفع ملفاتك ومَيّزها بالألوان والوسوم والملصقات والنجوم. يمكنك سحب الملفات وإفلاتها هنا.', SP.fileGrid({ kind: 'file' })));
  SP.reg('handouts', '📚', 'الملازم', () => SP.page('الملازم', 'ملازم PDF أو ملفات مجمّعة مع تتبّع تقدّم القراءة، أو أنشئ ملزمة من ملاحظاتك.', SP.fileGrid({ kind: 'handout' })));

  /* ---------- الملصقات ---------- */
  SP.reg('stickers', '🏷️', 'الملصقات', () => {
    const s = S(); const board = (s.boards[SP.state.me] = s.boards[SP.state.me] || []);
    const el = h('div', { id: 'board' });
    const place = (it) => {
      const n = h('div', { class: 'stk ' + it.kind, style: { left: it.x + 'px', top: it.y + 'px', transform: `rotate(${it.rot || 0}deg)`, background: it.kind === 'note' ? it.color : '' } },
        it.kind === 'note' ? h('div', { contenteditable: 'true', style: { outline: 0, minHeight: '80px' }, oninput: (e) => { it.text = e.target.textContent; SP.save(); } }, it.text) : it.text,
        h('button', { class: 'x', 'aria-label': 'حذف', onclick: () => { const i = board.indexOf(it); if (i > -1) board.splice(i, 1); SP.save(); n.remove(); } }, '×'));
      n.addEventListener('pointerdown', (e) => {
        if (e.target.isContentEditable || e.target.classList.contains('x')) return;
        const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + it.x), dy = e.clientY - (r.top + it.y);
        n.setPointerCapture(e.pointerId); n.style.cursor = 'grabbing';
        const mv = (m) => { it.x = Math.max(0, Math.min(r.width - 50, m.clientX - r.left - dx)); it.y = Math.max(0, Math.min(r.height - 50, m.clientY - r.top - dy)); n.style.left = it.x + 'px'; n.style.top = it.y + 'px'; };
        const up = () => { n.removeEventListener('pointermove', mv); n.removeEventListener('pointerup', up); n.style.cursor = ''; SP.save(); };
        n.addEventListener('pointermove', mv); n.addEventListener('pointerup', up);
      });
      el.append(n);
    };
    board.forEach(place);
    const add = (kind, text, color) => { const it = { id: SP.uid(), kind, text, color, x: 40 + Math.random() * 400, y: 30 + Math.random() * 300, rot: Math.round(Math.random() * 16 - 8) }; board.push(it); SP.save(); place(it); };
    return SP.page('لوح الملصقات', 'اسحب الملصقات والورقات اللاصقة وضعها كما تشاء. تُحفظ تلقائياً.',
      h('div', { class: 'card' }, h('div', {}, SP.EMOJIS.map((e) => h('button', { class: 'emo', onclick: () => add('emoji', e) }, e))),
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('b', {}, 'ورقة لاصقة:'), SP.COLORS.map((c) => h('button', { class: 'btn sm', style: { background: c }, onclick: () => add('note', 'اكتب هنا…', tint(c).length ? c + 'cc' : c) }, '＋')),
          h('button', { class: 'btn ghost sm', onclick: async () => { if (board.length && (await SP.confirm('مسح كل الملصقات؟'))) { board.length = 0; SP.save(); SP.refresh(); } } }, 'مسح الكل'))), h('div', { style: { marginTop: '12px' } }, el));
  });
})();
