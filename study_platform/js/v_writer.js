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
  const CLS = new Set(['cmt', 'chk', 'done', 'box', 'box-def', 'box-ex', 'box-warn', 'box-case', 'box-sum', 'pgbrk', 'wq', 'toc', 'lh', 'sig', 'lines', 'obj']);
  const STYLE_OK = /^(color|background-color|text-align|font-weight|font-style|font-size|text-decoration(-line)?)$/;
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
          else if (k === 'class') { const ok = v.split(/\s+/).filter((c) => CLS.has(c)); ok.length ? n.setAttribute('class', ok.join(' ')) : n.removeAttribute('class'); }
          else if (k === 'dir' && /^(ltr|rtl|auto)$/i.test(v)) { /* اتجاه الفقرة */ }
          else if (k === 'type' && n.tagName === 'OL' && /^[aAiI1]$/.test(v)) { /* ترقيم الخيارات */ }
          else if (k === 'data-note' || k === 'colspan' || k === 'rowspan' || k === 'target' || k === 'rel' || (k === 'color' && n.tagName === 'FONT')) { /* مسموح */ }
          else n.removeAttribute(at.name);
        });
        if (n.tagName === 'IMG' && !n.getAttribute('src')) return n.remove();
        if (n.tagName === 'A' && !n.getAttribute('href')) { n.replaceWith(...n.childNodes); return; }
        walk(n);
      });
    };
    walk(root); return root.innerHTML;
  };

  /* القوالب: للأستاذ (محاضرة، امتحان، واجب، كتاب رسمي، تبليغ، خطة مقرر) وللطالب */
  const LH = () => { const l = letterhead(); return `<table class="lh"><tbody><tr><td><b>${esc(l.uni || 'اسم الجامعة')}</b><br>${esc(l.college || 'الكلية')}<br>${esc(l.dept || 'القسم')}</td><td><b>${esc(l.course || 'المادة')}</b><br>${esc(l.name || 'اسم الأستاذ')}<br>${esc(l.stage || 'المرحلة')}</td></tr></tbody></table>`; };
  const SIG = () => { const l = letterhead(); return `<div class="sig"><p>التوقيع: ....................</p><p><b>${esc(l.name || 'الاسم')}</b></p><p>${esc(l.title || 'المنصب')}</p><p>التاريخ: ${new Date().toLocaleDateString('ar')}</p></div>`; };
  const letterhead = () => ((S().letterhead = S().letterhead || {})[SP.state.me] = (S().letterhead || {})[SP.state.me] || { name: SP.me() ? SP.me().name : '' });
  const TEMPLATES = {
    lecture: ['ملخص محاضرة', () => '<h1>عنوان المحاضرة</h1><p><b>المادة:</b> … &nbsp; <b>التاريخ:</b> …</p><h2>النقاط الرئيسية</h2><ul><li>…</li><li>…</li></ul><h2>مصطلحات مهمة</h2><table><thead><tr><th>المصطلح</th><th>المعنى</th></tr></thead><tbody><tr><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td></tr></tbody></table><h2>أسئلة للمراجعة</h2><ol><li>…</li></ol><h2>الخلاصة</h2><p>…</p>', 'st'],
    tlecture: ['محاضرة للطلاب', () => LH() + '<h1>المحاضرة ١: عنوان المحاضرة</h1><div class="box box-sum"><b>🎯 أهداف المحاضرة:</b> في نهاية المحاضرة يستطيع الطالب أن:<ol><li>يعرّف …</li><li>يشرح …</li><li>يميّز بين …</li></ol></div><h2>١. مقدمة</h2><p>…</p><h2>٢. المحتوى الرئيسي</h2><p>…</p><div class="box box-def"><b>📘 تعريف:</b> …</div><div class="box box-ex"><b>✏️ مثال:</b> …</div><h2>٣. الأهمية السريرية / التطبيقية</h2><div class="box box-case"><b>🩺 حالة:</b> …</div><div class="box box-warn"><b>⚠️ تنبيه:</b> خطأ شائع عند الطلاب: …</div><h2>الخلاصة</h2><ul><li>…</li></ul><h2>أسئلة للمناقشة</h2><ol><li>…</li></ol><h2>المراجع</h2><ol><li>…</li></ol>', 't'],
    exam: ['ورقة امتحان', () => LH() + '<h1 style="text-align:center">امتحان: …</h1><table><tbody><tr><td><b>اسم الطالب:</b></td><td></td><td><b>الرقم الجامعي:</b></td><td></td></tr><tr><td><b>الشعبة:</b></td><td></td><td><b>الدرجة:</b></td><td>&nbsp;/ ١٠٠</td></tr></tbody></table><div class="box box-warn"><b>تعليمات:</b> أجب عن جميع الأسئلة. الوقت: ساعتان. ممنوع استخدام الهاتف.</div><h2>السؤال الأول: اختر الإجابة الصحيحة (٢٠ درجة)</h2><div class="wq"><p><b>١.</b> …</p><ol type="a"><li>…</li><li>…</li><li>…</li><li>…</li></ol></div><h2>السؤال الثاني: صح أم خطأ (١٠ درجات)</h2><p><b>١.</b> … &nbsp; ( صح / خطأ )</p><h2>السؤال الثالث: أجب بالتفصيل (٢٠ درجة)</h2><div class="wq"><p><b>١.</b> …</p><div class="lines"></div></div><p style="text-align:center"><b>مع تمنياتي لكم بالنجاح</b></p>', 't'],
    homework: ['واجب للطلاب', () => LH() + '<h1>الواجب: …</h1><p><b>موعد التسليم:</b> … &nbsp; <b>الدرجة:</b> …</p><h2>المطلوب</h2><ol><li>…</li><li>…</li></ol><h2>طريقة التسليم</h2><ul><li>…</li></ul><h2>معايير التقييم</h2><table><thead><tr><th>المعيار</th><th>الدرجة</th></tr></thead><tbody><tr><td>صحة المعلومات</td><td>…</td></tr><tr><td>التنظيم والوضوح</td><td>…</td></tr><tr><td>المراجع</td><td>…</td></tr></tbody></table>', 't'],
    letter: ['كتاب رسمي / طلب', () => LH() + '<p style="text-align:left">العدد: … &nbsp;&nbsp; التاريخ: ' + new Date().toLocaleDateString('ar') + '</p><p><b>إلى / السيد … المحترم</b></p><p style="text-align:center"><b>م / …</b></p><p>تحية طيبة وبعد …</p><p>…</p><p>…</p><p>مع فائق الشكر والتقدير.</p>' + SIG(), 't'],
    notice: ['تبليغ للطلاب', () => LH() + '<h1 style="text-align:center">📢 تبليغ</h1><p>إلى طلبة …</p><p>يُرجى العلم بأن …</p><div class="box box-warn"><b>مهم:</b> …</div><p>مع التقدير.</p>' + SIG(), 't'],
    syllabus: ['خطة مقرر', () => LH() + '<h1>خطة مقرر: …</h1><h2>وصف المقرر</h2><p>…</p><h2>مخرجات التعلم</h2><ol><li>…</li></ol><h2>الجدول الأسبوعي</h2><table><thead><tr><th>الأسبوع</th><th>الموضوع</th><th>النشاط</th></tr></thead><tbody>' + Array.from({ length: 6 }, (_, i) => `<tr><td>${i + 1}</td><td>…</td><td>…</td></tr>`).join('') + '</tbody></table><h2>توزيع الدرجات</h2><table><thead><tr><th>التقييم</th><th>النسبة</th></tr></thead><tbody><tr><td>امتحان نصف السنة</td><td>٣٠٪</td></tr><tr><td>العملي والواجبات</td><td>٢٠٪</td></tr><tr><td>الامتحان النهائي</td><td>٥٠٪</td></tr></tbody></table><h2>المراجع</h2><ol><li>…</li></ol>', 't'],
    lab: ['تقرير مختبر', () => '<h1>تقرير مختبر: …</h1><p><b>الاسم:</b> … &nbsp; <b>التاريخ:</b> …</p><h2>الهدف</h2><p>…</p><h2>الأدوات</h2><ul><li>…</li></ul><h2>طريقة العمل</h2><ol><li>…</li></ol><h2>النتائج</h2><table><thead><tr><th>القياس</th><th>قبل</th><th>بعد</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td></tr></tbody></table><h2>المناقشة</h2><p>…</p><h2>الخلاصة</h2><p>…</p>', 'st'],
    plan: ['خطة مذاكرة', () => '<h1>خطة مذاكرة الأسبوع</h1><table><thead><tr><th>اليوم</th><th>المادة</th><th>الموضوع</th><th>تم</th></tr></thead><tbody>' + SP.DAYS.map((d) => `<tr><td>${d}</td><td>…</td><td>…</td><td>☐</td></tr>`).join('') + '</tbody></table><h2>أهدافي</h2><ul class="chk"><li>…</li><li>…</li></ul>', 'st'],
    review: ['ورقة مراجعة سريعة', () => '<h1>مراجعة: …</h1><blockquote>أهم فكرة يجب أن أتذكرها: …</blockquote><h2>تعاريف</h2><ul><li><b>…:</b> …</li></ul><h2>قوانين وأرقام</h2><ul><li>…</li></ul><h2>أخطاء شائعة</h2><ul><li>…</li></ul>', 'st'],
    blank: ['مستند فارغ', () => '<h1>عنوان المستند</h1><p>ابدأ الكتابة هنا…</p>', ''],
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
    let tpl = SP.isTeacher() ? 'tlecture' : 'lecture'; const name = h('input', { class: 'inp', id: 'w-name', style: { width: '100%' }, value: TEMPLATES[tpl][0] }), box = h('div', {});
    const group = (who, label) => { const ks = Object.keys(TEMPLATES).filter((k) => TEMPLATES[k][2] === who); return ks.length ? [h('label', { class: 'lbl' }, label), h('div', { class: 'grid s' }, ks.map((k) => h('button', { class: 'card tpl' + (tpl === k ? ' on' : ''), 'aria-pressed': String(tpl === k), onclick: () => { tpl = k; name.value = k === 'blank' ? 'مستند جديد' : TEMPLATES[k][0]; draw(); } }, h('b', {}, TEMPLATES[k][0]))))] : []; };
    const draw = () => box.replaceChildren(...(SP.isTeacher() ? [group('t', 'للأستاذ'), group('st', 'للطالب')] : [group('st', 'للطالب'), group('t', 'للأستاذ')]), ...group('', 'أخرى'));
    draw();
    SP.modal({ title: 'مستند جديد', wide: true, body: h('div', {}, SP.field('الاسم', name), box),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: async (c) => { const d = await create(name.value.trim() || 'مستند', TEMPLATES[tpl][1]()); c(); SP.go('writer/' + d.id); } }] });
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

  /* ---------- شرح متحرك قصير: كيف تكتب ملفك ---------- */
  const TUT = [['اكتب بالكيبورد مباشرة', 'انقر على الصفحة وابدأ الكتابة، والحفظ تلقائي.'], ['حدّد كلمة ولوّنها', 'من «تنسيق» اختر لون التأشير أو لون النص.'], ['أضف ملاحظة جانبية', 'حدّد نصاً واضغط «ملاحظة» فتظهر هنا بجانب المستند.'], ['أدوات الأستاذ', 'ترويسة رسمية، أسئلة اختيار وصح وخطأ، فهرس وتوقيع.'], ['اطبع من الأسفل', 'زر «🖨 طباعة» في الشريط السفلي، أو حمّله Word.']];
  function tutorial(onClose) {
    let step = 0, timer = 0, paused = false;
    const stage = h('div', { class: 'tut-stage', 'aria-hidden': 'true' },
      h('div', { class: 'tut-bar' }, h('i', { class: 'tb-b' }, 'B'), h('i', { class: 'tb-c' }), h('i', { class: 'tb-c y' }), h('i', { class: 'tb-n' }, 'ملاحظة'), h('i', { class: 'tb-t' }, 'أدوات الأستاذ')),
      h('div', { class: 'tut-page' }, h('div', { class: 'tut-h' }), h('div', { class: 'tut-type' }, h('span', {}, 'الضفيرة العضدية تتكون من خمسة جذور'), h('b', { class: 'tut-caret' })),
        h('div', { class: 'tut-line' }, h('span', { class: 'tut-word' }, 'الجذور'), ' C5 – T1 تعطي فروعاً'), h('div', { class: 'tut-line s' }),
        h('div', { class: 'tut-q' }, h('b', {}, '١. '), 'أي عصب…', h('i', {}, 'a'), h('i', {}, 'b'), h('i', {}, 'c'))),
      h('div', { class: 'tut-note' }, '📝 مهم للامتحان'),
      h('div', { class: 'tut-print' }, h('div', { class: 'tut-printer' }, '🖨'), h('div', { class: 'tut-sheet' })),
      h('div', { class: 'tut-hand' }, '👆'));
    const cap = h('div', { class: 'tut-cap', 'aria-live': 'polite' }), dots = h('div', { class: 'tut-dots', role: 'tablist', 'aria-label': 'خطوات الشرح' });
    const show = (k) => {
      step = (k + TUT.length) % TUT.length; stage.removeAttribute('data-step'); void stage.offsetWidth; stage.dataset.step = step + 1;
      cap.replaceChildren(h('b', {}, `${step + 1}. ${TUT[step][0]}`), h('span', {}, TUT[step][1]));
      dots.replaceChildren(...TUT.map((t, i) => h('button', { class: 'tut-dot' + (i === step ? ' on' : ''), role: 'tab', 'aria-selected': String(i === step), 'aria-label': t[0], onclick: () => { show(i); loop(); } })));
    };
    const loop = () => { clearTimeout(timer); timer = setTimeout(() => { if (!paused && el.isConnected) show(step + 1); if (el.isConnected) loop(); }, 3600); };
    const el = h('section', { class: 'wtut', 'aria-label': 'شرح: كيف تكتب ملفك' },
      h('div', { class: 'row sp' }, h('b', {}, '🎬 كيف تكتب ملفك؟'), h('span', { class: 'row', style: { gap: '2px' } }, h('button', { class: 'nt-icon tut-btn', title: 'إعادة', 'aria-label': 'إعادة الشرح', onclick: () => { show(0); loop(); } }, '↺'), h('button', { class: 'nt-icon tut-btn', title: 'إخفاء الشرح', 'aria-label': 'إخفاء الشرح', onclick: () => { clearTimeout(timer); onClose(); } }, '✕'))),
      stage, cap, dots);
    el.addEventListener('mouseenter', () => (paused = true)); el.addEventListener('mouseleave', () => (paused = false));
    SP.cleanups.push(() => clearTimeout(timer));
    show(0); loop(); return el;
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

    /* شريط الأدوات: تبويبات (تنسيق، إدراج، أدوات الأستاذ، مراجعة) */
    const keep = (e) => e.preventDefault();
    const B = (label, title, fn, cls = '') => h('button', { class: 'wb ' + cls, title, 'aria-label': title, onmousedown: keep, onclick: fn }, label);
    const sel = (id, label, opts, fn) => h('select', { class: 'inp', id, 'aria-label': label, onmousedown: () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); }, onchange: (e) => { const v = e.target.value; e.target.value = ''; v && fn(v); } }, h('option', { value: '' }, label), opts.map(([v, l]) => h('option', { value: v }, l)));
    const sep = () => h('span', { class: 'sep' });
    const html = (x) => exec('insertHTML', x);
    const curBlock = () => { const s = getSelection(); let n = s.rangeCount ? s.anchorNode : null; while (n && n !== page && !(n.nodeType === 1 && /^(P|H1|H2|H3|H4|LI|BLOCKQUOTE|DIV|TD|TH)$/.test(n.tagName))) n = n.parentNode; return n && n !== page ? n : null; };
    const SYMS = [['رياضيات', '± × ÷ √ ∞ ≈ ≠ ≤ ≥ ∑ ∫ ∆ ° % ‰ ½ ¼ ¾ ² ³ ⁻¹ ₂ ₃'], ['أسهم', '→ ← ↑ ↓ ↔ ⇌ ⇒ ⇐ ↗ ↘'], ['يونانية', 'α β γ δ ε θ λ μ π ρ σ τ φ ω Δ Σ Ω'], ['طبية وعلامات', '℞ ♂ ♀ ✓ ✗ ⚠ ★ • ‣ © ®']];
    function symbols() { const m = SP.modal({ title: 'رموز', wide: true, body: h('div', {}, SYMS.map(([l, set]) => h('div', { style: { marginBottom: '10px' } }, h('small', { class: 'sub' }, l), h('div', { class: 'sym-grid' }, set.split(' ').map((c) => h('button', { class: 'sym', onclick: () => { document.querySelector('.ov').remove(); exec('insertText', c); } }, c)))))), actions: [{ label: 'إغلاق', onclick: (c) => c() }] }); return m; }
    function tableModal() {
      const r = h('input', { class: 'inp', type: 'number', id: 'w-rows', min: 1, max: 30, value: 3, style: { width: '90px' } }), c = h('input', { class: 'inp', type: 'number', id: 'w-cols', min: 1, max: 10, value: 3, style: { width: '90px' } }), hd = h('input', { type: 'checkbox', checked: true });
      SP.modal({ title: 'إدراج جدول', body: h('div', { class: 'row' }, SP.field('الصفوف', r), SP.field('الأعمدة', c), h('label', {}, hd, ' صف عناوين')), actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إدراج', primary: true, onclick: (x) => {
        const R = Math.max(1, Math.min(30, +r.value || 3)), C = Math.max(1, Math.min(10, +c.value || 3)), cell = (t) => Array.from({ length: C }, (_, k) => `<${t}>${t === 'th' ? 'عنوان ' + (k + 1) : '&nbsp;'}</${t}>`).join('');
        x(); html(`<table>${hd.checked ? `<thead><tr>${cell('th')}</tr></thead>` : ''}<tbody>${Array.from({ length: R }, () => `<tr>${cell('td')}</tr>`).join('')}</tbody></table><p></p>`); } }] });
    }
    function linkModal() {
      const u = h('input', { class: 'inp', id: 'w-link', placeholder: 'https://…', style: { width: '100%' }, dir: 'ltr' }), t = h('input', { class: 'inp', placeholder: 'النص الظاهر (اختياري)', style: { width: '100%' } }), r = savedRange;
      SP.modal({ title: 'إدراج رابط', body: h('div', {}, SP.field('الرابط', u), SP.field('النص', t)), actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إدراج', primary: true, onclick: (x) => { if (!/^https?:\/\/\S+$/i.test(u.value.trim())) return SP.toast('اكتب رابطاً يبدأ بـ https://', 'err'); x(); savedRange = r; const txt = t.value.trim() || (r && r.toString()) || u.value.trim(); html(`<a href="${esc(u.value.trim())}" target="_blank" rel="noopener noreferrer">${esc(txt)}</a>&nbsp;`); } }] });
    }
    const BOXES = [['def', '📘 تعريف'], ['ex', '✏️ مثال'], ['warn', '⚠️ تنبيه'], ['case', '🩺 حالة سريرية'], ['sum', '🎯 خلاصة / أهداف']];
    const qn = () => page.querySelectorAll('.wq').length + 1;
    const AR = (n) => String(n).replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[x]);
    function mcqModal() {
      const q = h('textarea', { class: 'inp', id: 'w-q', placeholder: 'نص السؤال', style: { minHeight: '70px' } }), ops = ['أ', 'ب', 'ج', 'د'].map((l) => h('input', { class: 'inp', placeholder: 'الخيار ' + l, style: { width: '100%' } })), ans = h('select', { class: 'inp', id: 'w-ans' }, ['أ', 'ب', 'ج', 'د'].map((l, k) => h('option', { value: k }, l))), mk = h('input', { class: 'inp', type: 'number', min: 0, value: 2, style: { width: '90px' } });
      SP.modal({ title: 'سؤال اختيار من متعدد', wide: true, body: h('div', {}, SP.field('السؤال', q), h('div', { class: 'grid s' }, ops.map((o, k) => SP.field('الخيار ' + 'أبجد'[k], o))), h('div', { class: 'row' }, SP.field('الإجابة الصحيحة', ans), SP.field('الدرجة', mk)), h('p', { class: 'sub' }, 'تُحفظ الإجابة كملاحظة جانبية لك، ولا تظهر عند الطباعة إلا إذا اخترت ذلك.')),
        actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إدراج', primary: true, onclick: (x) => { if (!q.value.trim()) return SP.toast('اكتب السؤال', 'err'); x(); const n = qn(), a = +ans.value;
          html(`<div class="wq"><p><b>${AR(n)}. </b>${esc(q.value.trim())} <span class="cmt" data-note="${esc('الإجابة: ' + 'أبجد'[a] + ') ' + (ops[a].value || ''))}">(${AR(mk.value || 0)} درجة)</span></p><ol type="a">${ops.map((o) => `<li>${esc(o.value || '…')}</li>`).join('')}</ol></div><p></p>`); drawNotes(); } }] });
    }
    function letterheadModal(insert) {
      const l = letterhead(), f = (k, lab) => { const i = h('input', { class: 'inp', value: l[k] || '', style: { width: '100%' }, 'data-k': k }); return [SP.field(lab, i), i]; };
      const fs = [f('uni', 'الجامعة / المدرسة'), f('college', 'الكلية'), f('dept', 'القسم'), f('course', 'المادة'), f('stage', 'المرحلة / الصف'), f('name', 'اسمك'), f('title', 'المنصب (للتوقيع)')];
      SP.modal({ title: 'ترويستي الرسمية', wide: true, body: h('div', {}, h('p', { class: 'sub' }, 'تُحفظ مرة واحدة وتُستخدم في كل القوالب والتوقيع.'), h('div', { class: 'grid s' }, fs.map((x) => x[0]))),
        actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: insert ? 'حفظ وإدراج' : 'حفظ', primary: true, onclick: (x) => { fs.forEach(([, i]) => (l[i.dataset.k] = i.value.trim())); SP.save(); x(); if (insert) { page.focus(); const r = document.createRange(); r.setStart(page, 0); r.collapse(true); savedRange = r; html(LH() + '<p></p>'); } SP.toast('حُفظت الترويسة'); } }] });
    }
    function toc() {
      const hs = [...page.querySelectorAll('h1, h2, h3')].filter((x) => !x.closest('.toc')); if (!hs.length) return SP.toast('أضف عناوين أولاً لبناء الفهرس', 'err');
      const box = `<div class="toc"><p><b>📑 المحتويات</b></p><ol>${hs.map((x) => `<li${x.tagName === 'H3' ? ' style="font-size:.92em"' : ''}>${esc(x.textContent.trim())}</li>`).join('')}</ol></div>`;
      const old = page.querySelector('.toc'); if (old) { old.outerHTML = SP.sanitizeHTML(box); dirty(); SP.toast('حُدّث الفهرس'); } else { const first = page.querySelector('h1'); const r = document.createRange(); first ? r.setStartAfter(first) : r.setStart(page, 0); r.collapse(true); savedRange = r; html(box); }
    }
    function findReplace() {
      const f = h('input', { class: 'inp', id: 'w-find', style: { width: '100%' } }), r = h('input', { class: 'inp', id: 'w-repl', style: { width: '100%' } }), info = h('p', { class: 'sub', role: 'status' });
      const nodes = () => { const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT), out = []; while (w.nextNode()) out.push(w.currentNode); return out; };
      const count = () => { const q = f.value; info.textContent = q ? `وُجد ${nodes().reduce((a, n) => a + n.data.split(q).length - 1, 0)} مرة` : ''; };
      f.addEventListener('input', count);
      SP.modal({ title: 'بحث واستبدال', body: h('div', {}, SP.field('ابحث عن', f), SP.field('استبدل بـ', r), info), actions: [{ label: 'إغلاق', onclick: (x) => x() }, { label: 'استبدال الكل', primary: true, onclick: () => { const q = f.value; if (!q) return; let n = 0; nodes().forEach((t) => { const parts = t.data.split(q); if (parts.length > 1) { n += parts.length - 1; t.data = parts.join(r.value); } }); dirty(); info.textContent = `استُبدل ${n} مرة`; } }] });
      setTimeout(() => f.focus(), 50);
    }
    /* مساعد الكتابة: يعمل على النص المحدد أو المستند كله */
    const AI_ACTS = [['improve', '✨ حسّن الصياغة', 'أعد صياغة النص التالي بعربية فصيحة واضحة وسلسة، دون تغيير المعنى أو حذف المعلومات.'], ['formal', '🏛 صياغة رسمية', 'حوّل النص التالي إلى صياغة رسمية مناسبة لكتاب رسمي أو مخاطبة إدارية، بعربية فصيحة.'], ['simple', '🧒 بسّطه للطلاب', 'اشرح النص التالي بأسلوب مبسّط يفهمه الطالب، مع مثال قصير إن أمكن.'], ['expand', '📝 وسّع النقاط إلى شرح', 'حوّل النقاط أو العناوين التالية إلى شرح متكامل بفقرات منظمة لمحاضرة جامعية.'], ['summary', '📌 لخّص في نقاط', 'لخّص النص التالي في نقاط قصيرة واضحة.'], ['spell', '🔤 صحّح الإملاء والنحو', 'صحّح الأخطاء الإملائية والنحوية وعلامات الترقيم في النص التالي فقط، وأعده كما هو بعد التصحيح.'], ['objectives', '🎯 اقترح أهدافاً للمحاضرة', 'اقترح 4 إلى 6 أهداف تعليمية قابلة للقياس (يستطيع الطالب أن...) لمحاضرة عن النص التالي.'], ['questions', '❓ اقترح أسئلة امتحان', 'اكتب 5 أسئلة امتحان متنوعة (اختيار من متعدد مع الإجابة، وصح وخطأ، ومقالي) عن النص التالي.']];
    async function aiHelp() {
      const r = savedRange && !savedRange.collapsed && page.contains(savedRange.commonAncestorContainer) ? savedRange.cloneRange() : null, src = (r ? r.toString() : page.innerText).trim();
      if (!src) return SP.toast('اكتب شيئاً أولاً', 'err');
      const out = h('div', { class: 'ai-out', 'aria-live': 'polite' }), acts = h('div', { class: 'ai-acts' });
      let result = '';
      const run = async ([, label, ask]) => {
        const sample = SP.aiSample ? await SP.aiSample() : null;
        if (!sample) { out.replaceChildren(h('p', { class: 'sub' }, 'مساعد الكتابة يحتاج تشغيل التطبيق داخل Claude. باقي أدوات المحرّر تعمل بدونه.')); return; }
        out.replaceChildren(h('p', { class: 'sub' }, label + '… جارٍ الكتابة')); result = '';
        try { const { text } = await sample([{ role: 'user', content: ask + ' أجب بالنص الناتج فقط بصيغة Markdown بسيطة (عناوين ## ونقاط - و **عريض**)، بدون مقدمات.\n\n---\n' + src.slice(0, 12000) }], { modelTier: 'quick', cache: false, onText: ({ text: t }) => { out.textContent = t; } }); result = text.trim(); out.innerHTML = SP.sanitizeHTML(fromMd(result)); use.hidden = !r; after.hidden = false; }
        catch (e) { out.replaceChildren(h('p', { class: 'sub' }, 'تعذّر الحصول على رد. حاول مرة أخرى.')); }
      };
      acts.append(...AI_ACTS.map((a) => h('button', { class: 'chip', onclick: () => run(a) }, a[1])));
      const use = h('button', { class: 'btn', hidden: true, onclick: () => { document.querySelector('.ov').remove(); savedRange = r; html(SP.sanitizeHTML(fromMd(result))); } }, 'استبدل النص المحدد');
      const after = h('button', { class: 'btn ghost', hidden: true, onclick: () => { document.querySelector('.ov').remove(); const rr = document.createRange(); if (r) { rr.setStart(r.endContainer, r.endOffset); } else { rr.selectNodeContents(page); rr.collapse(false); } savedRange = rr; html('<p></p>' + SP.sanitizeHTML(fromMd(result))); } }, r ? 'أدرج بعده' : 'أدرج في نهاية المستند');
      SP.modal({ title: 'مساعد الكتابة', wide: true, body: h('div', {}, h('p', { class: 'sub' }, r ? `يعمل على النص المحدد (${src.length} حرف).` : 'لم تحدد نصاً، سيعمل على المستند كله. حدّد فقرة لتعديلها فقط.'), acts, out, h('div', { class: 'row', style: { marginTop: '10px' } }, use, after)), actions: [{ label: 'إغلاق', onclick: (c) => c() }] });
    }

    const TABS = {
      fmt: ['تنسيق', () => [B('↶', 'تراجع', () => exec('undo')), B('↷', 'إعادة', () => exec('redo')), sep(),
        sel('w-block', 'النمط', [['h1', 'عنوان كبير'], ['h2', 'عنوان'], ['h3', 'عنوان فرعي'], ['p', 'فقرة'], ['blockquote', 'اقتباس']], (v) => exec('formatBlock', v)),
        sel('w-size', 'الحجم', [['2', 'صغير'], ['3', 'عادي'], ['5', 'كبير'], ['6', 'كبير جداً']], (v) => exec('fontSize', v)),
        B('B', 'عريض (Ctrl+B)', () => exec('bold'), 'b'), B('I', 'مائل (Ctrl+I)', () => exec('italic'), 'i'), B('U', 'تسطير (Ctrl+U)', () => exec('underline'), 'u'), B('S', 'شطب', () => exec('strikeThrough'), 's'), B('x²', 'أُس', () => exec('superscript')), B('x₂', 'رمز سفلي', () => exec('subscript')), sep(),
        h('span', { class: 'wgroup', title: 'ألوان التأشير' }, h('small', {}, 'تأشير'), HL.map(([c, n]) => h('button', { class: 'pc', style: { background: c }, 'aria-label': 'تأشير ' + n, onmousedown: keep, onclick: () => exec('hiliteColor', c) })), h('button', { class: 'pc none', 'aria-label': 'إزالة التأشير', title: 'إزالة التأشير', onmousedown: keep, onclick: () => exec('hiliteColor', 'transparent') }, '✕')),
        h('span', { class: 'wgroup', title: 'لون النص' }, h('small', {}, 'لون'), INK.map((c) => h('button', { class: 'pc', style: { background: c }, 'aria-label': 'لون النص', onmousedown: keep, onclick: () => exec('foreColor', c) }))), sep(),
        B('•', 'قائمة نقطية', () => exec('insertUnorderedList')), B('1.', 'قائمة مرقمة', () => exec('insertOrderedList')), B('☑', 'قائمة مهام', () => html('<ul class="chk"><li>مهمة</li></ul>')),
        B('⇥', 'محاذاة لليمين', () => exec('justifyRight')), B('≡', 'توسيط', () => exec('justifyCenter')), B('⇤', 'محاذاة لليسار', () => exec('justifyLeft')), B('☰', 'ضبط من الجهتين', () => exec('justifyFull')),
        B('→|', 'زيادة المسافة البادئة', () => exec('indent')), B('|←', 'إنقاص المسافة البادئة', () => exec('outdent')),
        B('A⇄', 'اتجاه الفقرة (عربي/إنجليزي)', () => { const b = curBlock(); if (!b) return; b.setAttribute('dir', b.getAttribute('dir') === 'ltr' ? 'rtl' : 'ltr'); dirty(); }), sep(),
        B('ملاحظة', 'ملاحظة على النص المحدد', addNote, 'note'), B('مسح التنسيق', 'إزالة التنسيق', () => exec('removeFormat'))]],
      ins: ['إدراج', () => [B('▦ جدول', 'إدراج جدول', tableModal), B('🖼 صورة', 'إدراج صورة', () => imgPick.click()), imgPick, B('🔗 رابط', 'إدراج رابط', linkModal), B('Ω رموز', 'رموز رياضية وطبية', symbols),
        sel('w-box', 'صندوق', BOXES.map(([k, l]) => [k, l]), (k) => html(`<div class="box box-${k}"><b>${BOXES.find((b) => b[0] === k)[1]}:</b> …</div><p></p>`)),
        B('📅 التاريخ', 'إدراج تاريخ اليوم', () => exec('insertText', new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
        B('— خط', 'خط فاصل', () => exec('insertHorizontalRule')), B('⤓ فاصل صفحة', 'يبدأ ما بعده في صفحة جديدة عند الطباعة', () => html('<div class="pgbrk"></div><p></p>'))]],
      teach: ['أدوات الأستاذ', () => [B('🏛 ترويسة', 'إدراج الترويسة الرسمية في الأعلى', () => letterheadModal(true)), B('🎯 أهداف', 'صندوق أهداف المحاضرة', () => html('<div class="box box-sum"><b>🎯 أهداف المحاضرة:</b> في نهاية المحاضرة يستطيع الطالب أن:<ol><li>…</li><li>…</li><li>…</li></ol></div><p></p>')),
        B('❓ اختيار من متعدد', 'سؤال اختيار من متعدد مع الإجابة', mcqModal), B('✔✘ صح وخطأ', 'سؤال صح أم خطأ', () => html(`<div class="wq"><p><b>${AR(qn())}. </b>… &nbsp; ( صح / خطأ )</p></div><p></p>`)),
        B('✍ سؤال مقالي', 'سؤال مقالي مع أسطر للإجابة', () => html(`<div class="wq"><p><b>${AR(qn())}. </b>…</p><div class="lines"></div></div><p></p>`)),
        B('🪪 بيانات الطالب', 'خانات الاسم والرقم والدرجة', () => html('<table><tbody><tr><td><b>اسم الطالب:</b></td><td></td><td><b>الرقم الجامعي:</b></td><td></td></tr><tr><td><b>الشعبة:</b></td><td></td><td><b>الدرجة:</b></td><td></td></tr></tbody></table><p></p>')),
        B('📑 فهرس', 'فهرس المحتويات من العناوين', toc), B('📚 مراجع', 'قائمة مراجع مرقمة', () => html('<h2>المراجع</h2><ol><li>المؤلف، عنوان الكتاب، الطبعة، السنة، الصفحات.</li></ol>')),
        B('✒ توقيع', 'كتلة التوقيع بالاسم والتاريخ', () => html(SIG())), B('⚙ بياناتي', 'تعديل بيانات الترويسة', () => letterheadModal(false))]],
      review: ['مراجعة', () => [B('✨ مساعد الكتابة', 'حسّن الصياغة أو لخّص أو اقترح أسئلة', aiHelp, 'ai'), B('🔎 بحث واستبدال', 'بحث واستبدال', findReplace),
        B('❓ أسئلة من المستند', 'ولّد فويز من المستند', () => SP.questionsFor && SP.questionsFor({ name: d.name, mime: 'text/plain', blob: new Blob([page.innerText], { type: 'text/plain' }) })),
        B('ملاحظاتي الجانبية', 'إظهار أو إخفاء الملاحظات الجانبية', () => root.classList.toggle('no-notes')), B('🎬 الشرح', 'شرح متحرك لكتابة الملف', () => { (S().tutHide = S().tutHide || {})[SP.state.me] = false; SP.save(); root.classList.remove('no-notes'); drawSide(); side.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); })]],
    };
    let tab = 'fmt';
    const tabBar = h('div', { class: 'wtabs', role: 'tablist', 'aria-label': 'أدوات المستند' }), tools = h('div', { class: 'wbar', role: 'toolbar', 'aria-label': 'تنسيق' });
    const drawTools = () => { tabBar.replaceChildren(...Object.entries(TABS).map(([k, [l]]) => h('button', { class: 'wtab' + (k === tab ? ' on' : ''), role: 'tab', 'aria-selected': String(k === tab), onmousedown: keep, onclick: () => { tab = k; drawTools(); } }, l))); tools.replaceChildren(...TABS[tab][1]().flat()); };
    drawTools();
    const title = h('input', { class: 'inp wtitle', id: 'w-title', value: d.name, 'aria-label': 'اسم المستند', onchange: (e) => { d.name = e.target.value.trim() || d.name; SP.save(); } });

    /* التصدير والطباعة (الشريط السفلي) */
    const CSS = 'body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;color:#14213D}h2{color:#1F4E99}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #ccd;padding:6px 10px}th{background:#eef2f8}blockquote{border-inline-start:4px solid #1F4E99;margin:0;padding:6px 14px;background:#f3f6fb}img{max-width:100%}.cmt{background:#FFF3B0}.box{border-radius:8px;padding:10px 14px;margin:10px 0;border-inline-start:5px solid #1F4E99;background:#F3F6FB}.box-ex{border-color:#2E7D32;background:#EEF7EE}.box-warn{border-color:#C62828;background:#FDEEEE}.box-case{border-color:#7B3FA0;background:#F5EEF9}.box-sum{border-color:#E07B00;background:#FFF5E8}table.lh td{border:0;vertical-align:top}table.lh td:last-child{text-align:left}table.lh{border-bottom:3px double #1F4E99;margin-bottom:16px}.lines{height:120px;background:repeating-linear-gradient(transparent 0 27px,#bbb 27px 28px)}.sig{margin-top:40px;text-align:left}.sig p{margin:2px 0}.pgbrk{page-break-after:always;break-after:page}.toc{background:#F6F8FB;border-radius:8px;padding:8px 16px}ul.chk{list-style:none}';
    const docHtml = (opts = {}) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(d.name)}</title><style>${CSS}${opts.notes === false ? '.cmt{background:none}' : ''}${opts.wm ? `body::before{content:"${esc(opts.wm)}";position:fixed;top:40%;left:0;right:0;text-align:center;font-size:110px;color:rgba(31,78,153,.08);transform:rotate(-30deg);z-index:-1}` : ''}@page{size:${opts.size || 'A4'};margin:18mm}</style></head><body>${page.innerHTML}${opts.notes ? notesAppendix() : ''}${opts.print ? '<script>window.onload=()=>setTimeout(()=>print(),300)<\/script>' : ''}</body></html>`;
    const notesAppendix = () => { const cm = [...page.querySelectorAll('.cmt')]; return cm.length ? '<hr><h3>الملاحظات</h3><ol>' + cm.map((c) => `<li><b>${esc(c.textContent.slice(0, 60))}</b>: ${esc(c.dataset.note || '')}</li>`).join('') + '</ol>' : ''; };
    const exportHtml = () => SP.download(d.name + '.html', docHtml());
    const exportWord = () => SP.download(d.name + '.doc', new Blob(['﻿' + docHtml().replace('<html lang="ar" dir="rtl">', '<html lang="ar" dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">')], { type: 'application/msword' }));
    async function toPdf(keep) {
      if (!SP.makePdf) return; SP.toast('جارٍ تجهيز PDF…');
      try { const blob = await SP.makePdf(page.innerHTML, { title: d.name }), name = d.name + '.pdf';
        if (!keep) return SP.download(name, blob);
        const fid = SP.uid(); await SP.idb.put(fid, blob); S().files.push({ id: fid, ownerId: SP.state.me, name, mime: 'application/pdf', size: blob.size, tags: ['من مستنداتي'], color: '', star: false, stickers: [], kind: 'file', classId: '', added: Date.now(), desc: '' }); SP.save(); SP.toast('حُفظ «' + name + '» في الملفات 📁');
      } catch (e) { SP.toast('تعذّر إنشاء PDF: ' + e.message, 'err'); }
    }
    function printModal() {
      const size = h('select', { class: 'inp', id: 'pr-size' }, [['A4', 'A4'], ['A5', 'A5 (نصف صفحة)'], ['letter', 'Letter']].map(([v, l]) => h('option', { value: v }, l)));
      const notes = h('input', { type: 'checkbox', id: 'pr-notes' }), wm = h('select', { class: 'inp', id: 'pr-wm' }, [['', 'بدون'], ['مسودة', 'مسودة'], ['سري', 'سري'], ['نسخة الطالب', 'نسخة الطالب']].map(([v, l]) => h('option', { value: v }, l)));
      const pages = Math.max(1, Math.round(page.scrollHeight / 1100));
      SP.modal({ title: '🖨 طباعة', body: h('div', {}, h('p', { class: 'sub' }, `حوالي ${pages} ${pages > 2 ? 'صفحات' : 'صفحة'} · ${words()} كلمة. لحفظه PDF اختر «حفظ كـ PDF» في نافذة الطباعة.`), h('div', { class: 'row' }, SP.field('حجم الورق', size), SP.field('علامة مائية', wm)), h('label', { style: { display: 'block', marginTop: '10px' } }, notes, ' اطبع الملاحظات الجانبية (ومفتاح الإجابات) في آخر المستند')),
        actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'تنزيل نسخة للطباعة', onclick: (c) => { c(); SP.download(d.name + ' - للطباعة.html', docHtml({ size: size.value, notes: notes.checked, wm: wm.value, print: true })); } },
          { label: 'اطبع الآن', primary: true, onclick: (c) => { c(); doPrint({ size: size.value, notes: notes.checked, wm: wm.value }); } }] });
    }
    function doPrint(o) {
      const st = h('style', { id: 'print-css' }); st.textContent = `@page{size:${o.size};margin:16mm}`;
      document.head.append(st); const ap = o.notes ? h('div', { class: 'wprint-notes' }) : null; if (ap) { ap.innerHTML = SP.sanitizeHTML(notesAppendix()); page.after(ap); }
      root.dataset.wm = o.wm || ''; document.body.classList.add('printing-doc'); if (o.notes) document.body.classList.add('print-notes');
      const done = () => { st.remove(); ap && ap.remove(); document.body.classList.remove('printing-doc', 'print-notes'); removeEventListener('afterprint', done); };
      addEventListener('afterprint', done); try { window.print(); } catch (e) { SP.toast('الطباعة غير متاحة هنا، استخدم «تنزيل نسخة للطباعة»', 'err'); } setTimeout(done, 1500);
    }
    function sendToClass() {
      const mine = SP.state.classes.filter((c) => c.teacherId === SP.state.me); if (!mine.length) return SP.toast('ليس لديك صفوف لترسل لها', 'err');
      const cls = h('select', { class: 'inp', id: 'w-class' }, mine.map((c) => h('option', { value: c.id }, c.name))), msg = h('textarea', { class: 'inp', placeholder: 'رسالة قصيرة مع الملف (اختياري)' });
      SP.modal({ title: 'أرسل المستند للصف', body: h('div', {}, SP.field('الصف', cls), SP.field('رسالة', msg), h('p', { class: 'sub' }, 'يظهر في محادثة الصف كشرح مع ملف مرفق، ويُضاف إلى ملفات الصف.')),
        actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إرسال', primary: true, onclick: async (c) => {
          const blob = new Blob([docHtml()], { type: 'text/html' }), fid = SP.uid(), fname = d.name + '.html'; await SP.idb.put(fid, blob);
          S().files.push({ id: fid, ownerId: SP.state.me, name: fname, mime: 'text/html', size: blob.size, tags: [], color: '', star: false, stickers: [], kind: 'handout', classId: cls.value, added: Date.now(), desc: msg.value.trim() });
          (S().classItems = S().classItems || []).push({ id: SP.uid(), classId: cls.value, by: SP.state.me, type: 'explain', title: d.name, ts: Date.now(), images: [], fileId: fid, fname, fmime: 'text/html', text: msg.value.trim() || 'مستند جديد من الأستاذ 📄' });
          SP.save(); c(); SP.toast('أُرسل إلى ' + SP.className(cls.value)); SP.emit('react', 'send');
        } }] });
    }
    const pinfo = h('span', { class: 'sub', style: { margin: 0 } });
    const updInfo = () => { const w = words(); pinfo.textContent = `≈ ${Math.max(1, Math.round(page.scrollHeight / 1100))} صفحة · ${Math.max(1, Math.round(w / 200))} د قراءة`; };
    page.addEventListener('input', () => setTimeout(updInfo, 0));
    const bottom = h('div', { class: 'wfoot noprint', role: 'region', 'aria-label': 'الطباعة والتصدير' }, h('div', { class: 'row', style: { gap: '10px', flex: 1, minWidth: 0 } }, status, pinfo),
      h('div', { class: 'row', style: { gap: '6px' } }, SP.isTeacher() ? h('button', { class: 'btn ghost sm', onclick: sendToClass }, '📤 أرسل للصف') : null, h('button', { class: 'btn ghost sm', onclick: exportWord }, '⬇ Word'),
        SP.more([['📕 تنزيل PDF', () => toPdf(false)], ['📁 احفظ PDF في ملفاتي', () => toPdf(true)], ['⬇ تنزيل HTML', exportHtml], ['⬇ تنزيل نص', () => SP.download(d.name + '.txt', page.innerText)], ['🏛 بيانات الترويسة', () => letterheadModal(false)]]),
        h('button', { class: 'btn wprint', onclick: printModal }, '🖨 طباعة')));
    const hiddenTut = () => ((S().tutHide = S().tutHide || {})[SP.state.me]);
    const side = h('div', { class: 'wside' });
    const drawSide = () => side.replaceChildren(...[hiddenTut() ? null : tutorial(() => { S().tutHide[SP.state.me] = true; SP.save(); drawSide(); SP.toast('تجد الشرح في «مراجعة» ← «🎬 الشرح»'); }), notesBox].filter(Boolean));
    drawSide();
    const root = h('div', { class: 'writer' },
      h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('writer') }, 'رجوع'), title),
      h('div', { class: 'wtools noprint' }, tabBar, tools), h('div', { class: 'wlayout' }, h('div', { class: 'wsheet' }, page), side), bottom);
    SP.idb.get(KEY(d.id)).then((html) => { page.innerHTML = SP.sanitizeHTML(html || '<p></p>'); status.textContent = `${words()} كلمة`; drawNotes(); updInfo(); });
    return root;
  }

  SP.reg('writer', '', 'المستندات', (p) => {
    if (!p[0]) return listView();
    const d = docs().find((x) => x.id === p[0] && x.ownerId === SP.state.me);
    return d ? editor(d) : SP.page('المستند غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('writer') }, 'رجوع'));
  });
  SP._writer = { fromMd, fromText };
})();
