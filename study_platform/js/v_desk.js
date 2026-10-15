/* دراسة: افتح ملفات الدروس (PDF/صور) أو دفتراً فارغاً، وارسم، ظلّل، أشّر، اكتب، وأضف ملصقات وصوراً وفيديوهات */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const A4 = 842 / 595, NS = 'http://www.w3.org/2000/svg';
  const PENS = ['#1F4E99', '#111827', '#C62828', '#2E7D32', '#7B3FA0', '#E07B00'];
  const MARKS = ['#FFE14D', '#7FD3FF', '#9BE58B', '#FF9EC4'];
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const docs = () => (S().docs = S().docs || []);
  const mine = () => docs().filter((d) => d.ownerId === SP.state.me);
  const sv = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const ic = (d) => { const s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; return s; };
  const I = {
    select: '<path d="M5 3l14 8-6 1.5L10 19z"/>', pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
    hl: '<path d="M9 14l-4 4v2h5l4-4"/><path d="M8 11l7-7 5 5-7 7z"/>', mark: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    arrow: '<path d="M5 19L19 5M9 5h10v10"/>', rect: '<rect x="4" y="5" width="16" height="14" rx="1"/>', oval: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', sticker: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    eraser: '<path d="M8 20h12M4 15l9-9 6 6-7 7H8z"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    zin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6M11 8v6"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6"/>',
    page: '<path d="M6 3h9l4 4v14H6z"/><path d="M12 10v6M9 13h6"/>', save: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', back: '<path d="M9 6l6 6-6 6"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17.5h.01"/>',
    texthl: '<path d="M4 20h16"/><path d="M7 16l3-10h4l3 10M8.5 12h7"/>',
    note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8 9h8M8 12h5"/>',
    file: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>', book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0 0 4h13"/>',
  };
  const libs = () => !!window.pdfjsLib;

  /* حفظ الملف: يستخدم قدرة التنزيل في claude.ai إن وُجدت، وإلا تنزيل عادي */
  SP.saveFile = (name, blob) => SP.download(name, blob);

  async function pdfPages(bytes) {
    const pdf = await SP.pdfOpen(bytes);
    const n = pdf.numPages; pdf.destroy(); return n;
  }
  async function addDoc(file) {
    if (SP.writerImport && /\.(docx?|txt|md|markdown|html?|csv|pptx?|xlsx?|odt)$/i.test(file.name)) { await SP.writerImport(file); return null; }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name), isImg = (file.type || '').startsWith('image/');
    if (!isPdf && !isImg) { SP.toast('أضف ملف PDF أو صورة', 'err'); return null; }
    let n = 1;
    if (isPdf) {
      if (!libs()) { SP.toast('قارئ PDF لم يُحمَّل. تأكد من اتصال الإنترنت ثم أعد فتح الصفحة.', 'err'); return null; }
      try { n = await pdfPages(new Uint8Array(await file.arrayBuffer())); } catch (e) { SP.toast('تعذّر فتح ' + file.name + '. قد يكون الملف تالفاً أو محمياً بكلمة مرور.', 'err'); return null; }
    }
    const fileId = SP.uid();
    try { await SP.idb.put(fileId, file); } catch (e) { SP.toast('لا توجد مساحة كافية في المتصفح لحفظ الملف', 'err'); return null; }
    const d = { id: SP.uid(), ownerId: SP.state.me, name: file.name.replace(/\.[^.]+$/, ''), kind: isPdf ? 'pdf' : 'image', fileId, pages: Array.from({ length: n }, () => ({ a: [] })), created: Date.now(), updated: Date.now() };
    docs().push(d); SP.save(); return d;
  }
  SP.openInDesk = async (f) => {
    const blob = await SP.idb.get(f.id);
    if (!blob) return SP.toast('الملف غير موجود في هذا المتصفح', 'err');
    const d = await addDoc(new File([blob], f.name, { type: f.mime || blob.type }));
    if (d) SP.go('desk/' + d.id);
  };
  function newNotebook() {
    const name = h('input', { class: 'inp', id: 'nb-name', style: { width: '100%' }, value: 'دفتر ' + (mine().filter((d) => d.kind === 'blank').length + 1) });
    const n = h('input', { class: 'inp', id: 'nb-pages', type: 'number', min: 1, max: 50, value: 3, style: { width: '100px' } });
    SP.modal({ title: 'دفتر جديد', body: h('div', {}, SP.field('اسم الدفتر', name), SP.field('عدد الصفحات', n)), actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: (c) => {
      const d = { id: SP.uid(), ownerId: SP.state.me, name: name.value.trim() || 'دفتر', kind: 'blank', fileId: '', pages: Array.from({ length: clamp(+n.value || 1, 1, 50) }, () => ({ a: [] })), created: Date.now(), updated: Date.now() };
      docs().push(d); SP.save(); c(); SP.go('desk/' + d.id);
    } }] });
  }
  function fromFiles() {
    const list = S().files.filter((f) => (f.classId ? SP.canSeeClass(f.classId) : f.ownerId === SP.state.me) && /pdf|image/.test(f.mime || ''));
    SP.modal({ title: 'افتح ملفاً من ملفاتك', body: list.length ? h('div', { class: 'grid s' }, list.map((f) => h('button', { class: 'btn ghost', style: { textAlign: 'start' }, onclick: () => { document.querySelector('.ov').remove(); SP.openInDesk(f); } }, f.name))) : SP.empty('لا توجد ملفات PDF أو صور في قسم الملفات'),
      actions: [{ label: 'إغلاق', onclick: (c) => c() }] });
  }

  /* ---------- قائمة الدروس ---------- */
  function listView() {
    const input = h('input', { type: 'file', id: 'desk-upload', accept: 'application/pdf,image/*,.docx,.txt,.md,.html,.csv', multiple: true, hidden: true, onchange: async (e) => {
      let last = null; for (const f of e.target.files) last = (await addDoc(f)) || last;
      if (last) e.target.files.length === 1 ? SP.go('desk/' + last.id) : SP.refresh();
    } });
    const list = mine().sort((a, b) => b.updated - a.updated);
    const label = { pdf: 'PDF', image: 'صورة', blank: 'دفتر' };
    const root = SP.page(h('span', {}, 'دراسة ', h('span', { class: 'sticker sm-stk', 'aria-hidden': 'true' }, '📎')), 'افتح ملفات الدروس واكتب عليها: ارسم، ظلّل، أشّر بالأسهم، أضف نصوصاً وملصقات وصوراً وفيديوهات، ثم صدّرها PDF.',
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => input.click() }, 'أضف ملف درس (PDF، صورة، Word)'), input,
        h('button', { class: 'btn ghost', onclick: newNotebook }, 'دفتر فارغ'), h('button', { class: 'btn ghost', onclick: fromFiles }, 'من قسم الملفات')),
      h('p', { class: 'sub', style: { marginTop: '10px' } }, 'يمكنك أيضاً سحب ملف PDF أو صورة وإفلاته هنا.'),
      h('div', { class: 'grid' }, list.length ? list.map((d) => {
        const marks = d.pages.reduce((n, p) => n + p.a.length, 0);
        return h('div', { class: 'card click doccard', onclick: () => SP.go('desk/' + d.id) }, h('div', { class: 'thumb' }, ic(d.kind === 'blank' ? I.book : I.file)),
          h('h3', {}, d.name), h('div', { class: 'row sp' }, h('span', { class: 'sub', style: { margin: 0 } }, `${label[d.kind]} · ${d.pages.length} صفحة · ${marks} إضافة`),
            h('button', { class: 'btn ghost sm', onclick: async (e) => { e.stopPropagation(); if (await SP.confirm('حذف «' + d.name + '» مع كل ما كتبته عليه؟')) { if (d.fileId) SP.idb.del(d.fileId); d.pages.forEach((p) => p.a.forEach((a) => { a.k && SP.idb.del(a.k); a.th && SP.idb.del(a.th); })); S().docs = docs().filter((x) => x.id !== d.id); SP.save(); SP.refresh(); } } }, 'حذف')));
      }) : SP.empty('لا توجد دروس بعد. أضف ملف PDF أو صورة، أو ابدأ دفتراً فارغاً.')));
    root.addEventListener('dragover', (e) => e.preventDefault());
    root.addEventListener('drop', async (e) => { e.preventDefault(); let last = null; for (const f of e.dataTransfer.files) last = (await addDoc(f)) || last; if (last) SP.go('desk/' + last.id); });
    return root;
  }

  /* ---------- المحرّر ---------- */
  function editor(d) {
    const root = h('div', { class: 'ed t-' + (d.kind === 'pdf' ? 'texthl' : 'text') });
    let tool = d.kind === 'pdf' ? 'texthl' : 'text', color = PENS[0], mark = MARKS[0], width = 3, emoji = '⭐', zoom = 1, pdf = null, bmp = null, sizes = [], pageEls = [];
    let tsize = 18, tbold = false, tbg = '', hlStyle = 'hl', lastText = null, selected = null;
    const TSIZES = [[14, 'صغير'], [18, 'عادي'], [24, 'كبير'], [32, 'عنوان'], [44, 'ضخم']];
    const hist = [], fut = [], urls = new Map();
    const commit = () => { d.updated = Date.now(); SP.save(); drawBar(); };
    const snap = () => { hist.push(JSON.stringify(d.pages)); if (hist.length > 60) hist.shift(); fut.length = 0; };
    const restore = (from, to) => { if (!from.length) return; to.push(JSON.stringify(d.pages)); d.pages = JSON.parse(from.pop()); commit(); pageEls.forEach((el, i) => { el._pg = d.pages[i]; drawOverlay(el); }); };
    const url = async (k) => { if (urls.has(k)) return urls.get(k); const b = await SP.idb.get(k); const u = b ? URL.createObjectURL(b) : ''; urls.set(k, u); return u; };
    SP.cleanups.push(() => { urls.forEach((u) => u && URL.revokeObjectURL(u)); io && io.disconnect(); });

    /* شريط الأدوات */
    const bar = h('div', { class: 'desk-bar', role: 'toolbar', 'aria-label': 'أدوات الكتابة' });
    const picker = h('input', { type: 'file', id: 'desk-media', accept: 'image/*,video/*', hidden: true, onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; const el = visiblePage(); if (f && el) insertMedia(el, f, 0.5, 0.35); } });
    const tb = (key, label, on, fn, dis) => h('button', { class: 'tb' + (on ? ' on' : ''), title: label, 'aria-pressed': on ? 'true' : 'false', disabled: dis, onclick: fn }, ic(I[key]), label);
    const setTool = (t) => { tool = t; root.className = 'ed t-' + t; selected = null; getSelection().removeAllRanges(); drawBar(); pageEls.forEach(drawOverlay); };
    function drawBar() {
      const tools = [['select', 'تحريك'], ['text', 'كتابة'], d.kind === 'pdf' ? ['texthl', 'تأشير النص'] : null, ['note', 'ملاحظة'], ['pen', 'قلم'], ['hl', 'تظليل حر'], ['mark', 'منطقة'], ['arrow', 'سهم'], ['rect', 'مربع'], ['oval', 'دائرة'], ['sticker', 'ملصق'], ['eraser', 'ممحاة']].filter(Boolean);
      const marky = tool === 'hl' || tool === 'mark' || tool === 'note' || (tool === 'texthl' && hlStyle === 'hl');
      const pal = marky ? MARKS : PENS, cur = marky ? mark : color;
      const keep = (e) => e.preventDefault();
      const applyText = (fn) => { if (lastText && lastText.el.isConnected) { snap(); fn(lastText.a); commit(); drawOverlay(lastText.el); const o = lastText.el._layer.querySelector(`[data-id="${lastText.a.id}"]`); if (o && tool === 'text') { o.focus(); } } };
      const textOpts = () => h('span', { class: 'row', style: { gap: '6px' } },
        h('select', { class: 'inp', id: 'desk-tsize', 'aria-label': 'حجم الخط', onchange: (e) => { tsize = +e.target.value; applyText((a) => (a.s = r4(tsize / 800))); } }, TSIZES.map(([v, l]) => h('option', { value: v, selected: v === tsize }, l))),
        h('button', { class: 'wb b' + (tbold ? ' on' : ''), 'aria-pressed': String(tbold), title: 'عريض', onmousedown: keep, onclick: () => { tbold = !tbold; applyText((a) => (a.b = tbold)); drawBar(); } }, 'B'),
        h('span', { class: 'wgroup' }, h('small', {}, 'لون'), PENS.map((c) => h('button', { class: 'pc' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': 'لون النص', onmousedown: keep, onclick: () => { color = c; applyText((a) => (a.c = c)); drawBar(); } }))),
        h('span', { class: 'wgroup' }, h('small', {}, 'خلفية'), h('button', { class: 'pc none' + (!tbg ? ' on' : ''), 'aria-label': 'بدون خلفية', onmousedown: keep, onclick: () => { tbg = ''; applyText((a) => (a.bg = '')); drawBar(); } }, '✕'), MARKS.map((c) => h('button', { class: 'pc' + (c === tbg ? ' on' : ''), style: { background: c }, 'aria-label': 'خلفية', onmousedown: keep, onclick: () => { tbg = c; applyText((a) => (a.bg = c)); drawBar(); } }))));
      bar.replaceChildren(...[
        tb('back', 'رجوع', false, () => SP.go('desk')), h('span', { class: 'sep' }),
        ...tools.map(([k, l]) => tb(k, l, tool === k, () => setTool(k))),
        tb('image', 'صورة', false, () => { picker.accept = 'image/*'; picker.click(); }), tb('video', 'فيديو', false, () => { picker.accept = 'video/*'; picker.click(); }), picker,
        h('span', { class: 'sep' }),
        tool === 'text' || (tool === 'select' && selected && selected.a.t === 'text') ? textOpts()
        : tool === 'texthl' ? h('span', { class: 'row', style: { gap: '6px' } }, h('select', { class: 'inp', id: 'desk-hlstyle', 'aria-label': 'نوع التأشير', onchange: (e) => { hlStyle = e.target.value; drawBar(); } }, [['hl', 'تظليل'], ['ul', 'تسطير'], ['st', 'شطب']].map(([v, l]) => h('option', { value: v, selected: v === hlStyle }, l))),
            pal.map((c) => h('button', { class: 'pc' + (c === cur ? ' on' : ''), style: { background: c }, 'aria-label': 'لون', onclick: () => { hlStyle === 'hl' ? (mark = c) : (color = c); drawBar(); } })), h('small', { class: 'sub', style: { margin: 0 } }, 'حدّد كلمات بالفأرة لتلوينها'))
        : tool === 'sticker' ? h('span', { class: 'row', style: { gap: '2px' } }, SP.EMOJIS.slice(0, 14).map((e) => h('button', { class: 'emo' + (e === emoji ? ' on' : ''), 'aria-label': 'ملصق ' + e, onclick: () => { emoji = e; drawBar(); } }, e)))
          : h('span', { class: 'row', style: { gap: '6px' } }, pal.map((c) => h('button', { class: 'pc' + (c === cur ? ' on' : ''), style: { background: c }, 'aria-label': 'لون', onclick: () => { marky ? (mark = c) : (color = c); drawBar(); } })),
            h('input', { type: 'range', id: 'desk-width', min: 1, max: 14, value: width, 'aria-label': 'سماكة', style: { width: '80px' }, oninput: (e) => (width = +e.target.value) })),
        h('span', { class: 'sep' }),
        tb('undo', 'تراجع', false, () => restore(hist, fut), !hist.length), tb('redo', 'إعادة', false, () => restore(fut, hist), !fut.length),
        tb('zout', 'تصغير', false, () => { zoom = clamp(zoom - 0.15, 0.5, 2.5); layout(); }), tb('zin', 'تكبير', false, () => { zoom = clamp(zoom + 0.15, 0.5, 2.5); layout(); }),
        d.kind === 'blank' ? tb('page', 'صفحة', false, () => { snap(); d.pages.push({ a: [] }); sizes.push(A4); commit(); layout(); }) : null,
        d.kind !== 'blank' ? tb('quiz', 'أسئلة', false, async () => SP.questionsFor({ name: d.name, mime: d.kind === 'pdf' ? 'application/pdf' : ((await SP.idb.get(d.fileId)) || {}).type || 'image/png', blob: await SP.idb.get(d.fileId) })) : null,
        tb('save', 'تصدير PDF', false, exportPdf)].flat().filter(Boolean));
    }

    /* الصفحات */
    const wrap = h('div', { class: 'pages' });
    let io = null;
    function visiblePage() {
      const mid = innerHeight / 2; let best = pageEls[0], dist = Infinity;
      pageEls.forEach((el) => { const r = el.getBoundingClientRect(), c = Math.abs((r.top + r.bottom) / 2 - mid); if (c < dist) { dist = c; best = el; } });
      return best;
    }
    async function build() {
      wrap.replaceChildren(SP.empty('جارٍ فتح الملف…'));
      try {
        if (d.kind === 'pdf') {
          if (!libs()) throw new Error('قارئ PDF لم يُحمَّل. تأكد من اتصال الإنترنت.');
          const b = await SP.idb.get(d.fileId); if (!b) throw new Error('الملف غير موجود في هذا المتصفح.');
          pdf = await SP.pdfOpen(new Uint8Array(await b.arrayBuffer()));
          SP.cleanups.push(() => pdf && pdf.destroy());
          sizes = []; for (let i = 1; i <= pdf.numPages; i++) { const v = (await pdf.getPage(i)).getViewport({ scale: 1 }); sizes.push(v.height / v.width); }
          while (d.pages.length < pdf.numPages) d.pages.push({ a: [] });
        } else if (d.kind === 'image') {
          const b = await SP.idb.get(d.fileId); if (!b) throw new Error('الصورة غير موجودة في هذا المتصفح.');
          bmp = await createImageBitmap(b); sizes = [bmp.height / bmp.width];
        } else sizes = d.pages.map(() => A4);
      } catch (e) { wrap.replaceChildren(SP.empty('تعذّر فتح الملف: ' + e.message)); return; }
      layout();
    }
    function layout() {
      io && io.disconnect();
      io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && !e.target._painted && paintBg(e.target)), { rootMargin: '600px' });
      const W = Math.round(Math.min(Math.max((wrap.clientWidth || 800) - 8, 280), 960) * zoom);
      pageEls = d.pages.map((pg, i) => pageEl(pg, i, W, Math.round(W * (sizes[i] || A4))));
      wrap.replaceChildren(...pageEls); pageEls.forEach((el) => io.observe(el));
    }
    function pageEl(pg, i, W, H) {
      const el = h('div', { class: 'pg', style: { width: W + 'px', height: H + 'px' } });
      const cv = h('canvas', { class: 'bg', dir: 'ltr' }), tl = h('div', { class: 'textLayer' }), svg = sv('svg', { class: 'ink', viewBox: `0 0 ${W} ${H}`, width: W, height: H }), layer = h('div', { class: 'layer' });
      el.append(cv, tl, svg, layer, h('div', { class: 'pgno' }, `${i + 1} / ${d.pages.length}`));
      Object.assign(el, { _W: W, _H: H, _pg: pg, _i: i, _cv: cv, _tl: tl, _svg: svg, _layer: layer });
      drawOverlay(el); bindDraw(el);
      el.addEventListener('pointerdown', (e) => { if (tool === 'select' && !e.target.closest('.obj') && selected) { selected = null; document.querySelectorAll('.obj.sel').forEach((x) => x.classList.remove('sel')); drawBar(); } });
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (!f) return; const r = el.getBoundingClientRect(); insertMedia(el, f, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
      return el;
    }
    async function paintBg(el) {
      el._painted = true;
      const dpr = Math.min(2, devicePixelRatio || 1), cv = el._cv, W = el._W, H = el._H;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const ctx = cv.getContext('2d');
      if (d.kind === 'pdf') {
        const p = await pdf.getPage(el._i + 1), base = p.getViewport({ scale: 1 });
        await p.render({ canvasContext: ctx, viewport: p.getViewport({ scale: (W * dpr) / base.width }) }).promise;
        try { const vp = p.getViewport({ scale: W / base.width }); el._tl.style.setProperty('--scale-factor', vp.scale); await window.pdfjsLib.renderTextLayer({ textContentSource: await p.getTextContent(), container: el._tl, viewport: vp, textDivs: [] }).promise; } catch (e) { /* صفحة بلا نص */ }
      } else if (d.kind === 'image') ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
      else ruled(ctx, cv.width, cv.height);
    }
    function ruled(ctx, w, hh) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh);
      const gap = hh / 32; ctx.strokeStyle = 'rgba(31,78,153,.16)'; ctx.lineWidth = Math.max(1, w / 900);
      for (let y = gap * 3; y < hh - gap; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(198,40,40,.25)'; ctx.beginPath(); ctx.moveTo(w - w * 0.1, 0); ctx.lineTo(w - w * 0.1, hh); ctx.stroke();
    }

    /* رسم الطبقة (عرض) */
    function vec(a, W, H) {
      if (a.t === 'thl') {
        const g = sv('g', { 'data-id': a.id });
        a.r.forEach(([x, y, w, hh]) => {
          if (a.st === 'hl') { const e = sv('rect', { x: x * W, y: y * H, width: w * W, height: hh * H, fill: a.c, 'fill-opacity': '0.45', rx: 2 }); e.style.mixBlendMode = 'multiply'; g.append(e); }
          else { const yy = (a.st === 'ul' ? y + hh * 0.96 : y + hh * 0.55) * H; g.append(sv('line', { x1: x * W, x2: (x + w) * W, y1: yy, y2: yy, stroke: a.c, 'stroke-width': Math.max(1.5, hh * H * 0.09) })); }
        });
        g.append(sv('rect', { x: Math.min(...a.r.map((q) => q[0])) * W, y: Math.min(...a.r.map((q) => q[1])) * H, width: 1, height: 1, fill: 'transparent' }));
        return g;
      }
      const st = { stroke: a.c, 'stroke-width': Math.max(0.5, a.w * W), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-id': a.id };
      if (a.t === 'pen' || a.t === 'hl') {
        const dd = a.p.map((q, i) => (i ? 'L' : 'M') + (q[0] * W).toFixed(1) + ' ' + (q[1] * H).toFixed(1)).join(' ') + (a.p.length === 1 ? ' l0.1 0' : '');
        const e = sv('path', { ...st, d: dd }); if (a.t === 'hl') { e.setAttribute('stroke-opacity', '0.45'); e.setAttribute('stroke-linecap', 'butt'); e.style.mixBlendMode = 'multiply'; } return e;
      }
      const x1 = a.x1 * W, y1 = a.y1 * H, x2 = a.x2 * W, y2 = a.y2 * H;
      if (a.t === 'mark') { const e = sv('rect', { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), fill: a.c, 'fill-opacity': '0.4', stroke: 'none', 'data-id': a.id }); e.style.mixBlendMode = 'multiply'; return e; }
      if (a.t === 'rect') return sv('rect', { ...st, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), rx: 2 });
      if (a.t === 'oval') return sv('ellipse', { ...st, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rx: Math.abs(x2 - x1) / 2, ry: Math.abs(y2 - y1) / 2 });
      const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.max(10, a.w * W * 4);
      const head = `M${x2 - L * Math.cos(ang - 0.45)} ${y2 - L * Math.sin(ang - 0.45)} L${x2} ${y2} L${x2 - L * Math.cos(ang + 0.45)} ${y2 - L * Math.sin(ang + 0.45)}`;
      return sv('path', { ...st, d: `M${x1} ${y1} L${x2} ${y2} ${head}` });
    }
    function drawOverlay(el) {
      const { _W: W, _H: H, _pg: pg, _svg: svg, _layer: layer } = el;
      const HTMLT = ['text', 'stk', 'img', 'vid', 'note'];
      svg.replaceChildren(...pg.a.filter((a) => !HTMLT.includes(a.t)).map((a) => vec(a, W, H)));
      layer.replaceChildren(...pg.a.filter((a) => HTMLT.includes(a.t)).map((a) => obj(el, a)));
    }
    function obj(el, a) {
      const { _W: W, _H: H } = el, o = h('div', { class: 'obj ' + a.t, 'data-id': a.id, style: { left: a.x * W + 'px', top: a.y * H + 'px' } });
      if (a.t === 'text') {
        Object.assign(o.style, { fontSize: a.s * W + 'px', color: a.c, fontWeight: a.b ? '700' : '400', background: a.bg || 'transparent' }); o.setAttribute('dir', 'auto'); o.textContent = a.v; if (a.bg) o.classList.add('has-bg');
        o.contentEditable = tool === 'text' ? 'true' : 'false';
        o.addEventListener('dblclick', () => { o.contentEditable = 'true'; o.focus(); });
        o.addEventListener('focus', () => { snap(); lastText = { a, el }; tsize = Math.round(a.s * 800); tbold = !!a.b; tbg = a.bg || ''; color = a.c; });
        o.addEventListener('input', () => { a.v = o.innerText; d.updated = Date.now(); SP.save(); });
        o.addEventListener('blur', () => { if (tool !== 'text') o.contentEditable = 'false'; if (!a.v.trim()) { hist.pop(); el._pg.a = el._pg.a.filter((x) => x !== a); commit(); drawOverlay(el); } else commit(); });
      } else if (a.t === 'stk') { o.style.fontSize = a.s * W + 'px'; o.textContent = a.e; }
      else if (a.t === 'note') {
        o.style.setProperty('--nc', a.c || '#FFE14D'); o.title = a.v || 'ملاحظة فارغة';
        const btn = h('button', { class: 'note-pin', 'aria-label': 'ملاحظة: ' + (a.v || 'فارغة'), 'aria-expanded': String(!!a.open) }, '📝');
        const ta = h('textarea', { class: 'note-text', placeholder: 'اكتب ملاحظتك…', 'aria-label': 'نص الملاحظة' }); ta.value = a.v || '';
        const pop = h('div', { class: 'note-pop', hidden: !a.open }, ta, h('div', { class: 'row sp' }, h('small', {}, SP.date(a.ts || Date.now())), h('button', { class: 'btn ghost sm', onclick: () => { a.open = false; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); commit(); } }, 'إغلاق')));
        btn.addEventListener('click', () => { if (tool === 'eraser') return; a.open = pop.hidden; pop.hidden = !a.open; btn.setAttribute('aria-expanded', String(a.open)); if (a.open) ta.focus(); });
        ta.addEventListener('focus', () => snap());
        ta.addEventListener('input', () => { a.v = ta.value.slice(0, 2000); o.title = a.v; btn.setAttribute('aria-label', 'ملاحظة: ' + a.v); d.updated = Date.now(); SP.save(); });
        o.append(btn, pop); return withDrag(o, a, el);
      }
      else {
        Object.assign(o.style, { width: a.w * W + 'px', height: a.h * H + 'px' });
        if (a.t === 'img') { const im = h('img', { alt: '', draggable: 'false' }); url(a.k).then((u) => (im.src = u)); o.append(im); }
        else { const v = h('video', { controls: true, playsinline: true, preload: 'metadata' }); url(a.k).then((u) => (v.src = u)); o.append(h('div', { class: 'grip' }, 'اسحب لتحريك الفيديو'), v); }
      }
      o.append(h('span', { class: 'rz', 'aria-hidden': 'true' }));
      return withDrag(o, a, el);
    }
    function withDrag(o, a, el) {
      const { _W: W, _H: H } = el;
      if (selected && selected.a.id === a.id) o.classList.add('sel');
      o.addEventListener('pointerdown', (e) => {
        if (tool === 'eraser') { e.preventDefault(); snap(); el._pg.a = el._pg.a.filter((x) => x !== a); commit(); drawOverlay(el); return; }
        if (tool !== 'select') return;
        if (a.t === 'note' && e.target.closest('.note-pop')) return;
        layerSel(o, a, el);
        const resize = e.target.classList.contains('rz');
        if (a.t === 'vid' && !resize && !e.target.classList.contains('grip')) return;
        if (a.t === 'text' && o.isContentEditable) return;
        e.preventDefault(); o.setPointerCapture(e.pointerId); snap();
        const sx = e.clientX, sy = e.clientY, start = { ...a }; let moved = false;
        const mv = (m) => {
          const dx = (m.clientX - sx) / W, dy = (m.clientY - sy) / H; moved = true;
          if (!resize) { a.x = r4(clamp(start.x + dx, -0.05, 0.98)); a.y = r4(clamp(start.y + dy, -0.05, 0.98)); o.style.left = a.x * W + 'px'; o.style.top = a.y * H + 'px'; return; }
          if (a.t === 'text' || a.t === 'stk') { a.s = r4(clamp(start.s * (1 + dx * 4), 0.01, 0.4)); o.style.fontSize = a.s * W + 'px'; return; }
          const k = Math.max(0.05, start.w + dx) / start.w; a.w = r4(start.w * k); a.h = r4(start.h * k); o.style.width = a.w * W + 'px'; o.style.height = a.h * H + 'px';
        };
        const up = () => { o.removeEventListener('pointermove', mv); o.removeEventListener('pointerup', up); if (moved) commit(); else hist.pop(); };
        o.addEventListener('pointermove', mv); o.addEventListener('pointerup', up);
      });
      return o;
    }
    function layerSel(o, a, el) { document.querySelectorAll('.obj.sel').forEach((x) => x.classList.remove('sel')); o.classList.add('sel'); const was = selected && selected.a.t; selected = { a, el }; if (a.t === 'text') { lastText = { a, el }; tsize = Math.round(a.s * 800); tbold = !!a.b; tbg = a.bg || ''; color = a.c; } if (a.t === 'text' || was === 'text') drawBar(); }

    /* الرسم بالمؤشر */
    function bindDraw(el) {
      const svg = el._svg;
      svg.addEventListener('pointerdown', (e) => {
        if (tool === 'select') return;
        const r = svg.getBoundingClientRect(), P = (ev) => [r4(clamp((ev.clientX - r.left) / r.width)), r4(clamp((ev.clientY - r.top) / r.height))];
        const [x, y] = P(e), W = el._W, H = el._H, pg = el._pg;
        if (tool === 'eraser') { const t = e.target.closest && e.target.closest('[data-id]'); if (t) { snap(); pg.a = pg.a.filter((a) => a.id !== t.getAttribute('data-id')); commit(); drawOverlay(el); } return; }
        if (tool === 'text') {
          e.preventDefault(); snap(); const a = { id: SP.uid(), t: 'text', x, y: r4(y - 0.012), s: r4(tsize / 800), c: color, b: tbold, bg: tbg, v: '' }; pg.a.push(a); drawOverlay(el);
          const o = el._layer.querySelector(`[data-id="${a.id}"]`); o.contentEditable = 'true'; hist.pop(); o.focus(); return;
        }
        if (tool === 'note') { e.preventDefault(); snap(); const a = { id: SP.uid(), t: 'note', x: r4(clamp(x - 0.015, 0, 0.95)), y: r4(clamp(y - 0.015, 0, 0.95)), c: mark, v: '', open: true, ts: Date.now() }; pg.a.push(a); commit(); drawOverlay(el); const ta = el._layer.querySelector(`[data-id="${a.id}"] textarea`); ta && ta.focus(); return; }
        if (tool === 'texthl') return;
        if (tool === 'sticker') { snap(); pg.a.push({ id: SP.uid(), t: 'stk', x: r4(x - 0.03), y: r4(y - 0.025), s: 0.06, e: emoji }); commit(); drawOverlay(el); return; }
        e.preventDefault(); svg.setPointerCapture(e.pointerId); snap();
        const isFree = tool === 'pen' || tool === 'hl', c = tool === 'hl' || tool === 'mark' ? mark : color;
        const a = isFree ? { id: SP.uid(), t: tool, c, w: r4((tool === 'hl' ? width * 5 + 8 : width) / W), p: [[x, y]] } : { id: SP.uid(), t: tool, c, w: r4(width / W), x1: x, y1: y, x2: x, y2: y };
        let live = vec(a, W, H); svg.append(live);
        const mv = (m) => {
          const evs = m.getCoalescedEvents ? m.getCoalescedEvents() : [m];
          if (isFree) evs.forEach((ev) => { const q = P(ev), l = a.p[a.p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.002) a.p.push(q); });
          else [a.x2, a.y2] = P(m);
          const n = vec(a, W, H); live.replaceWith(n); live = n;
        };
        const up = () => {
          svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up);
          if (!isFree && Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 0.008) { live.remove(); hist.pop(); return; }
          pg.a.push(a); commit();
        };
        svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
      });
    }

    /* تأشير النص الحقيقي في PDF: حدّد كلمات بالفأرة */
    const onSelEnd = () => {
      if (tool !== 'texthl') return;
      const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
      const range = sel.getRangeAt(0), el = pageEls.find((p) => p._tl.contains(range.commonAncestorContainer)); if (!el) return;
      const pr = el.getBoundingClientRect(), rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1)
        .map((r) => [r4((r.left - pr.left) / pr.width), r4((r.top - pr.top) / pr.height), r4(r.width / pr.width), r4(r.height / pr.height)]);
      const merged = []; rects.forEach((q) => { const m = merged.find((x) => Math.abs(x[1] - q[1]) < 0.004 && Math.abs(x[3] - q[3]) < 0.006 && q[0] <= x[0] + x[2] + 0.01 && q[0] + q[2] >= x[0] - 0.01); if (m) { const l = Math.min(m[0], q[0]), rr = Math.max(m[0] + m[2], q[0] + q[2]); m[0] = l; m[2] = r4(rr - l); } else merged.push(q.slice()); });
      if (!merged.length) return;
      snap(); el._pg.a.push({ id: SP.uid(), t: 'thl', st: hlStyle, c: hlStyle === 'hl' ? mark : color, r: merged, txt: sel.toString().slice(0, 300) }); sel.removeAllRanges(); commit(); drawOverlay(el);
    };
    document.addEventListener('pointerup', onSelEnd); SP.cleanups.push(() => document.removeEventListener('pointerup', onSelEnd));

    /* اختصارات لوحة المفاتيح */
    const onKey = (e) => {
      const t = e.target, typing = t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName);
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? restore(fut, hist) : restore(hist, fut); }
        else if (e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); restore(fut, hist); }
        return;
      }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); snap(); selected.el._pg.a = selected.el._pg.a.filter((x) => x !== selected.a); const el = selected.el; selected = null; commit(); drawOverlay(el); return; }
      const map = { v: 'select', t: 'text', n: 'note', p: 'pen', e: 'eraser', h: d.kind === 'pdf' ? 'texthl' : 'hl', m: 'mark', a: 'arrow' };
      const k = e.key.toLowerCase(); if (map[k] && !e.altKey) { e.preventDefault(); setTool(map[k]); }
      if (e.key === '+' || e.key === '=') { zoom = clamp(zoom + 0.15, 0.5, 2.5); layout(); } if (e.key === '-') { zoom = clamp(zoom - 0.15, 0.5, 2.5); layout(); }
    };
    document.addEventListener('keydown', onKey); SP.cleanups.push(() => document.removeEventListener('keydown', onKey));

    /* إدراج صور وفيديو (زر، سحب وإفلات، لصق) */
    function videoThumb(file) {
      return new Promise((done) => {
        const v = document.createElement('video'), u = URL.createObjectURL(file); let fin = false;
        const end = (r) => { if (fin) return; fin = true; URL.revokeObjectURL(u); done(r); };
        v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = u;
        v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
        v.onseeked = () => { const w = Math.min(640, v.videoWidth || 640), hh = Math.round(w * (v.videoHeight / v.videoWidth || 0.5625)); const c = h('canvas', {}); c.width = w; c.height = hh; c.getContext('2d').drawImage(v, 0, 0, w, hh); c.toBlob((b) => end({ ar: hh / w, blob: b }), 'image/jpeg', 0.8); };
        v.onerror = () => end({ ar: 0.5625, blob: null }); setTimeout(() => end({ ar: 0.5625, blob: null }), 6000);
      });
    }
    async function insertMedia(el, file, x, y) {
      const isV = (file.type || '').startsWith('video/'), isI = (file.type || '').startsWith('image/');
      if (!isV && !isI) return SP.toast('يمكن إدراج الصور والفيديوهات فقط', 'err');
      const k = SP.uid(); let ar = 0.75, th = '';
      try {
        await SP.idb.put(k, file);
        if (isI) { const b = await createImageBitmap(file); ar = b.height / b.width; b.close && b.close(); }
        else { const t = await videoThumb(file); ar = t.ar; if (t.blob) { th = SP.uid(); await SP.idb.put(th, t.blob); } }
      } catch (e) { return SP.toast('تعذّر إدراج الملف: ' + file.name, 'err'); }
      const w = 0.45, hh = r4((w * ar * el._W) / el._H);
      snap(); el._pg.a.push({ id: SP.uid(), t: isV ? 'vid' : 'img', x: r4(clamp(x - w / 2, 0, 1 - w)), y: r4(clamp(y - hh / 2, 0, Math.max(0, 1 - hh))), w, h: hh, k, th });
      commit(); drawOverlay(el); if (tool !== 'select') setTool('select'); SP.toast(isV ? 'تمت إضافة الفيديو. اسحبه من الشريط فوقه لتحريكه.' : 'تمت إضافة الصورة. اسحبها لتحريكها واسحب الزاوية لتغيير حجمها.');
    }
    const onPaste = (e) => { const f = [...(e.clipboardData || {}).files || []][0]; if (f && pageEls.length && !(document.activeElement && document.activeElement.isContentEditable)) { e.preventDefault(); insertMedia(visiblePage(), f, 0.5, 0.35); } };
    document.addEventListener('paste', onPaste); SP.cleanups.push(() => document.removeEventListener('paste', onPaste));

    /* تصدير PDF: الصفحات الأصلية + كل ما أضفته مدموجاً فوقها */
    async function overlayPng(pg, Wc, Hc) {
      const c = h('canvas', {}); c.width = Wc; c.height = Hc; const ctx = c.getContext('2d');
      for (const a of pg.a) {
        ctx.save(); ctx.strokeStyle = ctx.fillStyle = a.c || '#000'; ctx.lineWidth = Math.max(1, (a.w || 0) * Wc); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (a.t === 'pen' || a.t === 'hl') {
          if (a.t === 'hl') { ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'butt'; }
          ctx.beginPath(); a.p.forEach((q, i) => (i ? ctx.lineTo(q[0] * Wc, q[1] * Hc) : ctx.moveTo(q[0] * Wc, q[1] * Hc))); if (a.p.length === 1) ctx.lineTo(a.p[0][0] * Wc + 0.1, a.p[0][1] * Hc); ctx.stroke();
        } else if (['mark', 'rect', 'oval', 'arrow'].includes(a.t)) {
          const x1 = a.x1 * Wc, y1 = a.y1 * Hc, x2 = a.x2 * Wc, y2 = a.y2 * Hc;
          if (a.t === 'mark') { ctx.globalAlpha = 0.4; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); }
          else if (a.t === 'rect') ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          else if (a.t === 'oval') { ctx.beginPath(); ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
          else { const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.max(10, a.w * Wc * 4); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.moveTo(x2 - L * Math.cos(ang - 0.45), y2 - L * Math.sin(ang - 0.45)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - L * Math.cos(ang + 0.45), y2 - L * Math.sin(ang + 0.45)); ctx.stroke(); }
        } else if (a.t === 'thl') {
          a.r.forEach(([x, y, w, hh]) => { if (a.st === 'hl') { ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(x * Wc, y * Hc, w * Wc, hh * Hc); } else { ctx.lineWidth = Math.max(1.5, hh * Hc * 0.09); const yy = (a.st === 'ul' ? y + hh * 0.96 : y + hh * 0.55) * Hc; ctx.beginPath(); ctx.moveTo(x * Wc, yy); ctx.lineTo((x + w) * Wc, yy); ctx.stroke(); } });
        } else if (a.t === 'note') {
          const x = a.x * Wc, y = a.y * Hc, fs = Wc * 0.016; ctx.font = `${fs * 1.6}px sans-serif`; ctx.textBaseline = 'top'; ctx.fillText('📝', x, y);
          if (a.v) { ctx.font = `${fs}px "IBM Plex Sans Arabic", Tahoma, sans-serif`; const lines = a.v.split('\n').slice(0, 12), bw = Math.min(Wc * 0.4, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.4), bh = lines.length * fs * 1.45 + fs, bx = Math.min(x + fs * 2.2, Wc - bw - 4);
            ctx.fillStyle = a.c || '#FFE14D'; ctx.globalAlpha = 0.92; ctx.fillRect(bx, y, bw, bh); ctx.globalAlpha = 1; ctx.fillStyle = '#14213D'; ctx.direction = 'rtl'; ctx.textAlign = 'right'; lines.forEach((l, i) => ctx.fillText(l, bx + bw - fs * 0.7, y + fs * 0.5 + i * fs * 1.45)); }
        } else if (a.t === 'text' || a.t === 'stk') {
          const fs = a.s * Wc; ctx.font = `${a.b ? '700 ' : ''}${fs}px "IBM Plex Sans Arabic", Tahoma, sans-serif`;
          if (a.t === 'text' && a.bg) { const lines = a.v.split('\n'), w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 0.4; ctx.save(); ctx.fillStyle = a.bg; ctx.globalAlpha = 0.85; ctx.fillRect(a.x * Wc, a.y * Hc, w, lines.length * fs * 1.35 + fs * 0.2); ctx.restore(); } ctx.textBaseline = 'top'; ctx.textAlign = 'left';
          (a.t === 'stk' ? [a.e] : a.v.split('\n')).forEach((ln, i) => { ctx.direction = /[؀-ۿ]/.test(ln) ? 'rtl' : 'ltr'; const w = ctx.measureText(ln).width; ctx.direction === 'rtl' ? (ctx.textAlign = 'right', ctx.fillText(ln, a.x * Wc + fs * 0.15 + w, a.y * Hc + fs * 0.1 + i * fs * 1.35)) : (ctx.textAlign = 'left', ctx.fillText(ln, a.x * Wc + fs * 0.15, a.y * Hc + fs * 0.1 + i * fs * 1.35)); });
        } else {
          const x = a.x * Wc, y = a.y * Hc, w = a.w * Wc, hh = a.h * Hc, b = await SP.idb.get(a.t === 'img' ? a.k : a.th);
          if (b) { try { const bm = await createImageBitmap(b); ctx.drawImage(bm, x, y, w, hh); } catch (e) { /* صورة غير مدعومة */ } } else { ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, hh); }
          if (a.t === 'vid') { const rr = Math.min(w, hh) * 0.14; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(x + w / 2, y + hh / 2, rr, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + w / 2 - rr * 0.35, y + hh / 2 - rr * 0.5); ctx.lineTo(x + w / 2 + rr * 0.55, y + hh / 2); ctx.lineTo(x + w / 2 - rr * 0.35, y + hh / 2 + rr * 0.5); ctx.fill(); }
        }
        ctx.restore();
      }
      return new Promise((res) => c.toBlob((b) => b.arrayBuffer().then(res), 'image/png'));
    }
    async function exportPdf() {
      if (!window.PDFLib) return SP.toast('مكتبة إنشاء PDF لم تُحمَّل. تأكد من اتصال الإنترنت.', 'err');
      SP.toast('جارٍ تجهيز ملف PDF…');
      try {
        const { PDFDocument, rgb } = window.PDFLib; let out;
        if (d.kind === 'pdf') out = await PDFDocument.load(await (await SP.idb.get(d.fileId)).arrayBuffer(), { ignoreEncryption: true });
        else out = await PDFDocument.create();
        for (let i = 0; i < d.pages.length; i++) {
          let page;
          if (d.kind === 'pdf') page = out.getPage(i);
          else {
            const Wp = 595, Hp = Math.round(595 * (sizes[i] || A4)); page = out.addPage([Wp, Hp]);
            if (d.kind === 'image') { const c = h('canvas', {}); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); const png = await new Promise((r) => c.toBlob((b) => b.arrayBuffer().then(r), 'image/png')); page.drawImage(await out.embedPng(png), { x: 0, y: 0, width: Wp, height: Hp }); }
            else { const gap = Hp / 32; for (let y = gap * 3; y < Hp - gap; y += gap) page.drawLine({ start: { x: 0, y: Hp - y }, end: { x: Wp, y: Hp - y }, thickness: 0.6, color: rgb(0.8, 0.85, 0.93) }); }
          }
          if (d.pages[i].a.length) { const { width: Wp, height: Hp } = page.getSize(); page.drawImage(await out.embedPng(await overlayPng(d.pages[i], Math.round(Wp * 2), Math.round(Hp * 2))), { x: 0, y: 0, width: Wp, height: Hp }); }
        }
        const hasVid = d.pages.some((p) => p.a.some((a) => a.t === 'vid'));
        await SP.saveFile(d.name + '.pdf', new Blob([await out.save()], { type: 'application/pdf' }));
        SP.toast(hasVid ? 'تم التصدير. الفيديوهات تظهر في PDF كصورة مصغّرة، وتعمل كاملة داخل المنصة.' : 'تم تصدير ملف PDF');
      } catch (e) { console.error(e); SP.toast('تعذّر التصدير: ' + e.message, 'err'); }
    }

    const title = h('input', { class: 'inp', id: 'desk-title', value: d.name, 'aria-label': 'اسم الدرس', style: { fontSize: '1.3rem', fontWeight: 700, background: 'transparent', flex: 1, maxWidth: '520px' }, onchange: (e) => { d.name = e.target.value.trim() || d.name; commit(); } });
    root.append(h('div', { class: 'row', style: { marginBottom: '12px' } }, title, h('span', { class: 'sub', style: { margin: 0 } }, d.pages.length + ' صفحة')), bar, wrap);
    drawBar(); requestAnimationFrame(build);
    root._api = { insertMedia, exportPdf, overlayPng, pages: () => pageEls, setTool };
    return root;
  }

  SP.reg('desk', '', 'دراسة', (p) => {
    if (!p[0]) return listView();
    const d = docs().find((x) => x.id === p[0] && x.ownerId === SP.state.me);
    return d ? editor(d) : SP.page('الدرس غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('desk') }, 'رجوع إلى دراسة'));
  });
})();
