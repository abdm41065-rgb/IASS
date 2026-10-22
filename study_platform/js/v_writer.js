/* المستندات: إنشاء ملفات داخل التطبيق والكتابة بالكيبورد، تلوين بألوان التأشير، ملاحظات جانبية، جداول وصور، قوالب، واستيراد Word/نص */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const docs = () => (S().wdocs = S().wdocs || []);
  const KEY = (id) => 'wdoc:' + id;
  const HL = [['#FFE14D', 'أصفر'], ['#9BE58B', 'أخضر'], ['#7FD3FF', 'أزرق'], ['#FF9EC4', 'وردي'], ['#FFB86B', 'برتقالي']];
  const INK = ['#14213D', '#1F4E99', '#C62828', '#2E7D32', '#7B3FA0', '#E07B00'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* تنظيف أي HTML مستورد أو ملصوق: قائمة سماح للوسوم والخصائص */
  const TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'BR', 'HR', 'SPAN', 'MARK', 'IMG', 'A', 'DIV', 'SUB', 'SUP', 'FONT']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'MATH', 'TEMPLATE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'HEAD', 'TITLE']);
  const STYLE_OK = /^(color|background-color|text-align|font-weight|font-style|text-decoration(-line)?)$/;
  SP.sanitizeHTML = (html) => {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html'), root = doc.body.firstChild;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) return;
        if (n.nodeType !== 1 || DROP.has(n.tagName)) return n.remove();
        if (!TAGS.has(n.tagName)) { walk(n); n.replaceWith(...n.childNodes); return; }
        [...n.attributes].forEach((at) => {
          const k = at.name.toLowerCase(), v = at.value;
          if (k === 'style') { const keep = v.split(';').map((x) => x.trim()).filter((x) => { const [p, val] = x.split(':').map((y) => (y || '').trim().toLowerCase()); return p && STYLE_OK.test(p) && val && !/url\(|expression|javascript/.test(val); }); keep.length ? n.setAttribute('style', keep.join(';')) : n.removeAttribute('style'); }
          else if (k === 'href' && n.tagName === 'A' && /^https?:\/\//i.test(v)) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
          else if (k === 'src' && n.tagName === 'IMG' && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) { /* صورة مضمّنة آمنة */ }
          else if ((k === 'class' && /^(cmt|chk|done)( |$)/.test(v)) || k === 'data-note' || k === 'colspan' || k === 'rowspan' || k === 'target' || k === 'rel' || (k === 'color' && n.tagName === 'FONT')) { /* مسموح */ }
          else n.removeAttribute(at.name);
        });
        if (n.tagName === 'IMG' && !n.getAttribute('src')) return n.remove();
        if (n.tagName === 'A' && !n.getAttribute('href')) { n.replaceWith(...n.childNodes); return; }
        walk(n);
      });
    };
    walk(root); return root.innerHTML;
  };

  const TEMPLATES = {
    blank: ['مستند فارغ', '<h1>عنوان المستند</h1><p>ابدأ الكتابة هنا…</p>'],
    lecture: ['ملخص محاضرة', '<h1>عنوان المحاضرة</h1><p><b>المادة:</b> … &nbsp; <b>التاريخ:</b> …</p><h2>النقاط الرئيسية</h2><ul><li>…</li><li>…</li></ul><h2>مصطلحات مهمة</h2><table><thead><tr><th>المصطلح</th><th>المعنى</th></tr></thead><tbody><tr><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td></tr></tbody></table><h2>أسئلة للمراجعة</h2><ol><li>…</li></ol><h2>الخلاصة</h2><p>…</p>'],
    lab: ['تقرير مختبر', '<h1>تقرير مختبر: …</h1><p><b>الاسم:</b> … &nbsp; <b>التاريخ:</b> …</p><h2>الهدف</h2><p>…</p><h2>الأدوات</h2><ul><li>…</li></ul><h2>طريقة العمل</h2><ol><li>…</li></ol><h2>النتائج</h2><table><thead><tr><th>القياس</th><th>قبل</th><th>بعد</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td></tr></tbody></table><h2>المناقشة</h2><p>…</p><h2>الخلاصة</h2><p>…</p>'],
    plan: ['خطة مذاكرة', '<h1>خطة مذاكرة الأسبوع</h1><table><thead><tr><th>اليوم</th><th>المادة</th><th>الموضوع</th><th>تم</th></tr></thead><tbody>' + SP.DAYS.map((d) => `<tr><td>${d}</td><td>…</td><td>…</td><td>☐</td></tr>`).join('') + '</tbody></table><h2>أهدافي</h2><ul class="chk"><li>…</li><li>…</li></ul>'],
    review: ['ورقة مراجعة سريعة', '<h1>مراجعة: …</h1><blockquote>أهم فكرة يجب أن أتذكرها: …</blockquote><h2>تعاريف</h2><ul><li><b>…:</b> …</li></ul><h2>قوانين وأرقام</h2><ul><li>…</li></ul><h2>أخطاء شائعة</h2><ul><li>…</li></ul>'],
  };

  async function create(name, html, extra = {}) {
    const d = { id: SP.uid(), ownerId: SP.state.me, name: name || 'مستند', created: Date.now(), updated: Date.now(), words: 0, ...extra };
    await SP.idb.put(KEY(d.id), html); docs().push(d); SP.save(); return d;
  }
  SP.createWriterDoc = create;

  /* الاستيراد: Word وملفات النص وMarkdown وHTML */
  const fromText = (t) => t.split(/\n{2,}/).map((p) => { const lines = p.split('\n'); return lines.every((l) => /^\s*[-•*]\s+/.test(l)) ? '<ul>' + lines.map((l) => `<li>${esc(l.replace(/^\s*[-•*]\s+/, ''))}</li>`).join('') + '</ul>' : `<p>${lines.map(esc).join('<br>')}</p>`; }).join('');
  const fromMd = (t) => { const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/==(.+?)==/g, '<mark>$1</mark>'); let out = '', list = '';
    t.split('\n').forEach((l) => { const m = l.match(/^(#{1,3})\s+(.*)/), b = l.match(/^\s*[-*]\s+(.*)/), n = l.match(/^\s*\d+[.)]\s+(.*)/);
      const want = b ? 'ul' : n ? 'ol' : ''; if (list && list !== want) { out += `</${list}>`; list = ''; } if (want && !list) { out += `<${want}>`; list = want; }
      if (m) out += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; else if (b || n) out += `<li>${inl((b || n)[1])}</li>`; else if (l.trim()) out += `<p>${inl(l)}</p>`; });
    return out + (list ? `</${list}>` : ''); };
  SP.writerImport = async (file) => {
    const name = file.name.replace(/\.[^.]+$/, ''), ext = (file.name.match(/\.([^.]+)$/) || [])[1] || '';
    let html;
    try {
      if (/docx/i.test(ext)) { if (!window.mammoth) throw new Error('قارئ ملفات Word لم يُحمَّل. تأكد من اتصال الإنترنت.'); html = (await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage: window.mammoth.images.imgElement((img) => img.read('base64').then((b) => ({ src: `data:${img.contentType};base64,${b}` }))) })).value; }
      else if (/^(md|markdown)$/i.test(ext)) html = fromMd(await file.text());
      else if (/^html?$/i.test(ext) || /html/.test(file.type)) html = await file.text();
      else if (/^(txt|csv|text)$/i.test(ext) || (file.type || '').startsWith('text/')) html = fromText(await file.text());
      else if (/^(doc|ppt|pptx|xls|xlsx|odt)$/i.test(ext)) throw new Error('هذا النوع غير مدعوم للتعديل. احفظه بصيغة Word ‏(.docx) أو PDF ثم أضفه.');
      else throw new Error('نوع الملف غير مدعوم');
    } catch (e) { SP.toast(e.message || 'تعذّر قراءة الملف', 'err'); return null; }
    const d = await create(name, SP.sanitizeHTML(html) || '<p></p>', { from: file.name });
    SP.toast('تم فتح «' + name + '» للتعديل'); SP.go('writer/' + d.id); return d;
  };
  SP.isWritable = (f) => /\.(docx|txt|md|markdown|html?|csv)$/i.test(f.name) || /^text\//.test(f.type || '');

  /* ---------- القائمة ---------- */
  function newDocModal() {
    let tpl = 'lecture'; const name = h('input', { class: 'inp', id: 'w-name', style: { width: '100%' }, value: 'مستند جديد' }), grid = h('div', { class: 'grid s' });
    const draw = () => grid.replaceChildren(...Object.entries(TEMPLATES).map(([k, [l]]) => h('button', { class: 'card tpl' + (tpl === k ? ' on' : ''), 'aria-pressed': String(tpl === k), onclick: () => { tpl = k; name.value = k === 'blank' ? 'مستند جديد' : l; draw(); } }, h('b', {}, l))));
    draw();
    SP.modal({ title: 'مستند جديد', body: h('div', {}, SP.field('الاسم', name), h('label', { class: 'lbl' }, 'القالب'), grid),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: async (c) => { const d = await create(name.value.trim() || 'مستند', TEMPLATES[tpl][1]); c(); SP.go('writer/' + d.id); } }] });
  }
  function listView() {
    const input = h('input', { type: 'file', id: 'w-import', accept: '.docx,.txt,.md,.html,.htm,.csv,text/*', hidden: true, onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; f && SP.writerImport(f); } });
    const list = docs().filter((d) => d.ownerId === SP.state.me).sort((a, b) => b.updated - a.updated);
    const root = SP.page('المستندات', 'أنشئ ملفاتك واكتب بالكيبورد: عناوين، تلوين بألوان التأشير، ملاحظات جانبية، جداول وصور. أو افتح ملف Word أو نص وعدّل عليه.',
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: newDocModal }, 'مستند جديد'), h('button', { class: 'btn ghost', onclick: () => input.click() }, 'افتح ملف Word أو نص'), input),
      h('div', { class: 'grid', style: { marginTop: '14px' } }, list.length ? list.map((d) => h('div', { class: 'card click wcard', onclick: () => SP.go('writer/' + d.id) },
        h('div', { class: 'wthumb', 'aria-hidden': 'true' }, h('i'), h('i'), h('i', { class: 'm' }), h('i')), h('h3', {}, d.name),
        h('div', { class: 'row sp' }, h('span', { class: 'sub', style: { margin: 0 } }, `${d.words || 0} كلمة · ${SP.date(d.updated)}`), h('span', { class: 'row', style: { gap: '4px' } }, SP.flowChip ? SP.flowChip('wdoc', d.id) : null, SP.more([SP.flowItem ? SP.flowItem('wdoc', d.id, d.name) : null, ['🗑 حذف', async () => { if (await SP.confirm('حذف «' + d.name + '»؟')) { SP.idb.del(KEY(d.id)); S().wdocs = docs().filter((x) => x.id !== d.id); SP.save(); SP.refresh(); } }, true]]))))) : [h('div', { class: 'empty' }, h('div', { class: 'sticker', style: { fontSize: '2.4rem', marginBottom: '8px' } }, '📝'), 'لا مستندات بعد. ابدأ بقالب «ملخص محاضرة».')]));
    root.addEventListener('dragover', (e) => e.preventDefault());
    root.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; f && SP.writerImport(f); });
    return root;
  }

  /* ---------- المحرّر ---------- */
  function editor(d) {
    const page = h('div', { class: 'wpage', id: 'w-page', contenteditable: 'true', dir: 'auto', spellcheck: 'true', 'aria-label': 'محتوى المستند', role: 'textbox', 'aria-multiline': 'true' });
    const status = h('span', { class: 'sub', style: { margin: 0 }, role: 'status' }), notesBox = h('div', { class: 'wnotes' });
    let saveT = 0, savedRange = null;
    const words = () => (page.innerText.match(/[\p{L}\p{N}]+/gu) || []).length;
    const save = () => { clearTimeout(saveT); SP.idb.put(KEY(d.id), page.innerHTML).then(() => { d.updated = Date.now(); d.words = words(); SP.save(); status.textContent = `${d.words} كلمة · حُفظ`; }); drawNotes(); };
    const dirty = () => { status.textContent = 'جارٍ الحفظ…'; clearTimeout(saveT); saveT = setTimeout(save, 600); };
    SP.cleanups.push(() => { if (saveT) save(); });
    const exec = (cmd, val) => { page.focus(); if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); dirty(); };
    page.addEventListener('keyup', () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); });
    page.addEventListener('mouseup', () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); });
    page.addEventListener('input', dirty);
    page.addEventListener('paste', (e) => {
      const html = e.clipboardData.getData('text/html'), text = e.clipboardData.getData('text/plain'), img = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
      e.preventDefault(); if (img) return insertImage(img);
      document.execCommand('insertHTML', false, html ? SP.sanitizeHTML(html) : fromText(text));
    });
    page.addEventListener('click', (e) => { const li = e.target.closest('ul.chk > li'); if (li && e.offsetX > li.clientWidth - 30) { li.classList.toggle('done'); dirty(); } const c = e.target.closest('.cmt'); if (c) flash(c, true); });
    page.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); SP.toast('حُفظ المستند'); } });

    function insertImage(file) {
      const im = new Image(), u = URL.createObjectURL(file);
      im.onload = () => { const k = Math.min(1, 1100 / im.width), c = h('canvas', {}); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); exec('insertHTML', `<p><img src="${c.toDataURL('image/jpeg', 0.85)}" alt=""></p>`); };
      im.onerror = () => SP.toast('تعذّر قراءة الصورة', 'err'); im.src = u;
    }
    const imgPick = h('input', { type: 'file', id: 'w-img', accept: 'image/*', hidden: true, onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; f && insertImage(f); } });
    function addNote() {
      const s = getSelection(), r = savedRange || (s.rangeCount ? s.getRangeAt(0) : null);
      if (!r || r.collapsed || !page.contains(r.commonAncestorContainer)) return SP.toast('حدّد كلمة أو جملة أولاً ثم اضغط «ملاحظة»', 'err');
      const selected = r.toString(), ta = h('textarea', { class: 'inp', id: 'w-note-text', placeholder: 'اكتب ملاحظتك على: «' + selected.slice(0, 40) + '»' });
      SP.modal({ title: 'ملاحظة على النص', body: ta, actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'أضف', primary: true, onclick: (c) => { if (!ta.value.trim()) return; c(); savedRange = r; exec('insertHTML', `<span class="cmt" data-note="${esc(ta.value.trim().slice(0, 1000))}">${esc(selected)}</span>&#8203;`); } }] });
    }
    const flash = (el, scroll) => { if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); };
    function drawNotes() {
      const cm = [...page.querySelectorAll('.cmt')];
      notesBox.replaceChildren(h('h3', {}, `الملاحظات (${cm.length})`), ...(cm.length ? cm.map((c) => h('div', { class: 'wnote', onclick: () => flash(c, true) }, h('q', {}, c.textContent.slice(0, 50)), h('p', {}, c.dataset.note),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: (e) => { e.stopPropagation(); const t = h('textarea', { class: 'inp' }); t.value = c.dataset.note; SP.modal({ title: 'تعديل الملاحظة', body: t, actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'حفظ', primary: true, onclick: (x) => { c.dataset.note = t.value.trim(); x(); dirty(); drawNotes(); } }] }); } }, 'تعديل'),
          h('button', { class: 'btn ghost sm', onclick: (e) => { e.stopPropagation(); c.replaceWith(...c.childNodes); dirty(); drawNotes(); } }, 'حذف')))) : [h('p', { class: 'sub' }, 'حدّد نصاً واضغط «ملاحظة» لتعليق جانبي يبقى مع المستند.')]));
    }

    /* شريط الأدوات */
    const keep = (e) => e.preventDefault();
    const B = (label, title, fn, cls = '') => h('button', { class: 'wb ' + cls, title, 'aria-label': title, onmousedown: keep, onclick: fn }, label);
    const block = h('select', { class: 'inp', id: 'w-block', 'aria-label': 'نوع الفقرة', onchange: (e) => { exec('formatBlock', e.target.value); e.target.value = ''; } }, h('option', { value: '' }, 'النمط'), [['h1', 'عنوان كبير'], ['h2', 'عنوان'], ['h3', 'عنوان فرعي'], ['p', 'فقرة'], ['blockquote', 'اقتباس']].map(([v, l]) => h('option', { value: v }, l)));
    const tools = h('div', { class: 'wbar', role: 'toolbar', 'aria-label': 'تنسيق' },
      B('↶', 'تراجع', () => exec('undo')), B('↷', 'إعادة', () => exec('redo')), h('span', { class: 'sep' }), block,
      B('B', 'عريض (Ctrl+B)', () => exec('bold'), 'b'), B('I', 'مائل (Ctrl+I)', () => exec('italic'), 'i'), B('U', 'تسطير (Ctrl+U)', () => exec('underline'), 'u'), B('S', 'شطب', () => exec('strikeThrough'), 's'), h('span', { class: 'sep' }),
      h('span', { class: 'wgroup', title: 'ألوان التأشير' }, h('small', {}, 'تأشير'), HL.map(([c, n]) => h('button', { class: 'pc', style: { background: c }, 'aria-label': 'تأشير ' + n, onmousedown: keep, onclick: () => exec('hiliteColor', c) })), h('button', { class: 'pc none', 'aria-label': 'إزالة التأشير', title: 'إزالة التأشير', onmousedown: keep, onclick: () => exec('hiliteColor', 'transparent') }, '✕')),
      h('span', { class: 'wgroup', title: 'لون النص' }, h('small', {}, 'لون'), INK.map((c) => h('button', { class: 'pc', style: { background: c }, 'aria-label': 'لون النص', onmousedown: keep, onclick: () => exec('foreColor', c) }))), h('span', { class: 'sep' }),
      B('•', 'قائمة نقطية', () => exec('insertUnorderedList')), B('1.', 'قائمة مرقمة', () => exec('insertOrderedList')), B('☑', 'قائمة مهام', () => exec('insertHTML', '<ul class="chk"><li>مهمة</li></ul>')),
      B('⇥', 'محاذاة لليمين', () => exec('justifyRight')), B('≡', 'توسيط', () => exec('justifyCenter')), B('⇤', 'محاذاة لليسار', () => exec('justifyLeft')), h('span', { class: 'sep' }),
      B('جدول', 'إدراج جدول', () => exec('insertHTML', '<table><thead><tr><th>عمود 1</th><th>عمود 2</th><th>عمود 3</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td><td>…</td></tr></tbody></table><p></p>')),
      B('صورة', 'إدراج صورة', () => imgPick.click()), imgPick, B('—', 'خط فاصل', () => exec('insertHorizontalRule')), B('ملاحظة', 'ملاحظة على النص المحدد', addNote, 'note'), B('مسح التنسيق', 'إزالة التنسيق', () => exec('removeFormat')));
    const title = h('input', { class: 'inp wtitle', id: 'w-title', value: d.name, 'aria-label': 'اسم المستند', onchange: (e) => { d.name = e.target.value.trim() || d.name; SP.save(); } });
    const exportHtml = () => SP.download(d.name + '.html', `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${esc(d.name)}</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;color:#14213D}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:6px 10px}th{background:#eef2f8}blockquote{border-inline-start:4px solid #1F4E99;margin:0;padding:6px 14px;background:#f3f6fb}.cmt{background:#FFF3B0;border-bottom:2px dotted #E0A800}.cmt::after{content:" [" attr(data-note) "]";color:#B45F00;font-size:.85em}ul.chk li.done{text-decoration:line-through;color:#888}img{max-width:100%}</style><body>${page.innerHTML}</body></html>`, 'text/html');
    const root = h('div', { class: 'writer' },
      h('div', { class: 'row sp', style: { marginBottom: '10px' } }, h('div', { class: 'row', style: { flex: 1 } }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('writer') }, 'رجوع'), title), h('div', { class: 'row' }, status,
        h('button', { class: 'btn ghost sm', onclick: () => SP.questionsFor && SP.questionsFor({ name: d.name, mime: 'text/plain', blob: new Blob([page.innerText], { type: 'text/plain' }) }) }, 'أسئلة من المستند'),
        h('button', { class: 'btn ghost sm', onclick: () => SP.download(d.name + '.txt', page.innerText) }, 'تنزيل نص'), h('button', { class: 'btn sm', onclick: exportHtml }, 'تنزيل HTML'))),
      tools, h('div', { class: 'wlayout' }, h('div', { class: 'wsheet' }, page), notesBox));
    SP.idb.get(KEY(d.id)).then((html) => { page.innerHTML = SP.sanitizeHTML(html || '<p></p>'); status.textContent = `${words()} كلمة`; drawNotes(); });
    return root;
  }

  SP.reg('writer', '', 'المستندات', (p) => {
    if (!p[0]) return listView();
    const d = docs().find((x) => x.id === p[0] && x.ownerId === SP.state.me);
    return d ? editor(d) : SP.page('المستند غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('writer') }, 'رجوع'));
  });
  SP._writer = { fromMd, fromText };
})();
