/* دفتري: دفاتر حقيقية لكل مادة — صفحات مسطّرة تكتب عليها بالكيبورد مباشرة فوق الأسطر، أو بالقلم بخط يدك، مع تقليب الصفحات */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const books = () => (S().nbooks = S().nbooks || []);
  const mine = () => books().filter((b) => b.ownerId === SP.state.me);
  const PW = 600, PH = 848, LINE = 34, TOP = 92; // أبعاد الصفحة المنطقية؛ الأسطر كل 34 بعد الهامش العلوي
  const COVERS = ['#1F4E99', '#B91C1C', '#2E7D32', '#7B3FA0', '#E07B00', '#0F766E', '#334155', '#BE185D'];
  const INKS = [['#1F4E99', 'أزرق'], ['#14213D', 'أسود'], ['#C62828', 'أحمر'], ['#2E7D32', 'أخضر']];
  const HLS = [['#FFE14D', 'أصفر'], ['#9BE58B', 'أخضر'], ['#FF9EC4', 'وردي'], ['#7FD3FF', 'أزرق']];
  const FONTS = { print: ['عادي', 'var(--font)'], hand: ['خط اليد', '"Aref Ruqaa", "IBM Plex Sans Arabic", serif'] };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' });
  const newPage = () => ({ id: SP.uid(), html: '', ink: [], date: today(), updated: Date.now() });
  SP.newNotebook = (name, color, html) => { const b = { id: SP.uid(), ownerId: SP.state.me, name: name || 'دفتري', color: color || COVERS[books().length % COVERS.length], font: 'print', created: Date.now(), updated: Date.now(), pages: [newPage()] }; if (html) b.pages[0].html = SP.sanitizeHTML ? SP.sanitizeHTML(html) : esc(html); books().push(b); SP.save(); return b; };

  /* ---------- الرف: أغلفة الدفاتر ---------- */
  function shelf() {
    const seeded = (S().nbSeed = S().nbSeed || {});
    if (!mine().length && !seeded[SP.state.me]) { seeded[SP.state.me] = true; SP.newNotebook('دفتري الأول', '#1F4E99', '<div>أهلاً! هذا دفترك 📓</div><div>انقر على الصفحة واكتب مباشرة، الكتابة تجلس على الأسطر.</div><div>أو اختر «قلم» من الأعلى واكتب بخط يدك ✍️</div>'); }
    const list = mine().sort((a, b) => b.updated - a.updated);
    const add = () => {
      let color = COVERS[list.length % COVERS.length]; const name = h('input', { class: 'inp', id: 'nb-name', style: { width: '100%' }, placeholder: 'مثال: دفتر التشريح', value: '' });
      SP.modal({ title: 'دفتر جديد', body: h('div', {}, SP.field('اسم الدفتر (المادة)', name), SP.field('لون الغلاف', SP.swatches ? SP.swatches(color, (c) => (color = c)) : h('span'))),
        actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إنشاء', primary: true, onclick: (c) => { const b = SP.newNotebook(name.value.trim() || 'دفتري', color); c(); SP.go('notebook/' + b.id); } }] });
      setTimeout(() => name.focus(), 50);
    };
    return SP.page('دفتري', 'دفتر لكل مادة: اكتب بالكيبورد على الأسطر مباشرة، أو بالقلم بخط يدك، وقلّب الصفحات مثل دفتر حقيقي.',
      h('div', { class: 'nb-shelf' }, list.map((b) => h('a', { class: 'nb-cover', href: '#/notebook/' + b.id, style: { '--cc': b.color }, 'aria-label': 'افتح ' + b.name },
        h('span', { class: 'nb-spine', 'aria-hidden': 'true' }), h('span', { class: 'nb-label' }, h('b', {}, b.name), h('small', {}, b.pages.length + ' صفحة')), h('span', { class: 'nb-rings', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')))),
        h('button', { class: 'nb-cover nb-new', onclick: add }, h('span', { class: 'nb-plus' }, '+'), h('b', {}, 'دفتر جديد'))));
  }

  /* ---------- الدفتر المفتوح ---------- */
  function open(b, pi) {
    let idx = Math.max(0, Math.min(b.pages.length - 1, pi || b.last || 0)), mode = 'type', ink = INKS[0][0], hl = HLS[0][0], hist = [], saveT = 0;
    const root = h('div', { class: 'nb' }), stage = h('div', { class: 'nb-stage' });
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { b.updated = Date.now(); SP.save(); }, 300); };
    SP.cleanups.push(() => { clearTimeout(saveT); flushText(); b.updated = Date.now(); SP.save(); });
    let paper, text, svg, pg;
    const flushText = () => { if (text && pg) { pg.html = SP.sanitizeHTML ? SP.sanitizeHTML(text.innerHTML) : text.innerHTML; pg.updated = Date.now(); } };

    function buildPage(anim) {
      flushText(); pg = b.pages[idx]; b.last = idx;
      text = h('div', { class: 'nb-text', contenteditable: mode === 'type' ? 'true' : 'false', dir: 'auto', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': `صفحة ${idx + 1}: اكتب هنا`, style: { fontFamily: FONTS[b.font || 'print'][1] } });
      text.innerHTML = pg.html || '';
      text.addEventListener('input', () => { overflow(); flushText(); save(); });
      text.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); });
      text.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); } });
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', `0 0 ${PW} ${PH}`); svg.setAttribute('class', 'nb-ink'); svg.setAttribute('preserveAspectRatio', 'none');
      drawInk();
      paper = h('div', { class: 'nb-page m-' + mode, style: { '--line': LINE / PW * 100 + 'cqw', '--top': TOP / PW * 100 + 'cqw' } },
        h('div', { class: 'nb-head' }, h('span', { class: 'nb-date', contenteditable: 'true', 'aria-label': 'التاريخ', oninput: (e) => { pg.date = e.target.textContent.trim(); save(); } }, pg.date || ''), h('span', { class: 'nb-no' }, idx + 1)),
        h('div', { class: 'nb-margin', 'aria-hidden': 'true' }), text, svg);
      stage.replaceChildren(paper);
      if (anim && !matchMedia('(prefers-reduced-motion: reduce)').matches) { paper.classList.add(anim); setTimeout(() => paper.classList.remove(anim), 450); }
      bindPen(); paint();
      if (mode === 'type' && anim !== 'none') requestAnimationFrame(() => { text.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(text); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    }
    /* عندما تمتلئ الصفحة ينتقل آخر سطر للصفحة التالية تلقائياً */
    function overflow() {
      if (text.scrollHeight <= text.clientHeight + 2) return;
      const moved = [];
      while (text.scrollHeight > text.clientHeight + 2 && text.childNodes.length > 1) moved.unshift(text.lastChild), text.lastChild.remove();
      if (!moved.length) return;
      flushText(); if (!b.pages[idx + 1]) b.pages.splice(idx + 1, 0, newPage());
      const tmp = document.createElement('div'); moved.forEach((n) => tmp.append(n)); b.pages[idx + 1].html = tmp.innerHTML + (b.pages[idx + 1].html || '');
      save(); SP.toast('امتلأت الصفحة، أكمل في الصفحة التالية 📄'); go(idx + 1);
    }
    /* ---------- القلم ---------- */
    const P = (e) => { const r = svg.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * PW * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * PH * 10) / 10, e.pressure || 0.5]; };
    const pathD = (pts) => { if (pts.length < 2) { const [x, y] = pts[0]; return `M${x} ${y} L${x + 0.1} ${y}`; } let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`; } const l = pts.at(-1); return d + ` L${l[0]} ${l[1]}`; };
    const strokeEl = (s) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', pathD(s.p)); p.setAttribute('class', 'st ' + s.k); p.setAttribute('stroke', s.c); p.setAttribute('stroke-width', s.w); p.dataset.id = s.id; return p; };
    function drawInk() { svg.replaceChildren(...(pg.ink || []).map(strokeEl)); }
    function bindPen() {
      let cur = null, el = null;
      svg.addEventListener('pointerdown', (e) => {
        if (mode === 'type') return; e.preventDefault(); svg.setPointerCapture(e.pointerId);
        if (mode === 'erase') { eraseAt(e); const mv = (m) => eraseAt(m), up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); }; svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up); return; }
        hist.push(JSON.stringify(pg.ink || [])); const p0 = P(e);
        cur = { id: SP.uid(), k: mode === 'hl' ? 'hl' : 'pen', c: mode === 'hl' ? hl : ink, w: mode === 'hl' ? 16 : Math.round((1.6 + p0[2] * 1.8) * 10) / 10, p: [p0.slice(0, 2)] };
        el = strokeEl(cur); svg.append(el);
        const mv = (m) => { const evs = m.getCoalescedEvents ? m.getCoalescedEvents() : [m]; evs.forEach((ev) => { const q = P(ev), l = cur.p.at(-1); if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.8) cur.p.push(q.slice(0, 2)); }); el.setAttribute('d', pathD(cur.p)); };
        const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); (pg.ink = pg.ink || []).push(cur); pg.updated = Date.now(); cur = null; save(); paint(); };
        svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
      });
    }
    function eraseAt(e) {
      const [x, y] = P(e), near = (pg.ink || []).filter((s) => s.p.some(([a, c]) => Math.hypot(a - x, c - y) < 10 + s.w / 2));
      if (!near.length) return; hist.push(JSON.stringify(pg.ink)); pg.ink = pg.ink.filter((s) => !near.includes(s)); drawInk(); save(); paint();
    }

    /* ---------- التنقل والأدوات ---------- */
    function go(i, dir) { if (i < 0) return; if (i >= b.pages.length) { flushText(); b.pages.push(newPage()); } const d = dir || (i > idx ? 'flip-next' : 'flip-prev'); idx = i; hist = []; buildPage(d); save(); }
    const setMode = (m) => { mode = m; paper.className = 'nb-page m-' + mode; text.contentEditable = mode === 'type' ? 'true' : 'false'; if (mode === 'type') text.focus(); paint(); };
    const pageInfo = h('span', { class: 'nb-pinfo' }), tools = h('div', { class: 'nb-tools', role: 'toolbar', 'aria-label': 'أدوات الدفتر' });
    const exec = (c, v) => { if (mode !== 'type') setMode('type'); text.focus(); document.execCommand(c, false, v); flushText(); save(); };
    function paint() {
      pageInfo.textContent = `صفحة ${idx + 1} من ${b.pages.length}`;
      const M = (k, ic, l) => h('button', { class: 'nb-mode' + (mode === k ? ' on' : ''), 'aria-pressed': String(mode === k), title: l, onclick: () => setMode(k) }, h('span', { 'aria-hidden': 'true' }, ic), l);
      const dot = (c, n, on, fn) => h('button', { class: 'pc' + (on ? ' on' : ''), style: { background: c }, 'aria-label': n, title: n, onclick: fn });
      tools.replaceChildren(h('div', { class: 'nb-modes' }, M('type', '⌨️', 'كتابة'), M('pen', '✍️', 'قلم'), M('hl', '🖍️', 'تظليل'), M('erase', '🧽', 'ممحاة')),
        mode === 'type' ? h('div', { class: 'nb-opts' }, h('button', { class: 'wb b', title: 'عريض', 'aria-label': 'عريض', onmousedown: (e) => e.preventDefault(), onclick: () => exec('bold') }, 'B'),
          h('button', { class: 'wb u', title: 'تسطير', 'aria-label': 'تسطير', onmousedown: (e) => e.preventDefault(), onclick: () => exec('underline') }, 'U'),
          INKS.map(([c, n]) => h('button', { class: 'pc', style: { background: c }, 'aria-label': 'لون ' + n, title: 'لون ' + n, onmousedown: (e) => e.preventDefault(), onclick: () => exec('foreColor', c) })),
          h('button', { class: 'pc', style: { background: '#FFE14D' }, 'aria-label': 'تظليل النص', title: 'تظليل النص المحدد', onmousedown: (e) => e.preventDefault(), onclick: () => exec('hiliteColor', '#FFE14D') }),
          h('button', { class: 'wb', title: 'نقاط', 'aria-label': 'قائمة نقطية', onmousedown: (e) => e.preventDefault(), onclick: () => exec('insertUnorderedList') }, '•'),
          h('button', { class: 'wb', title: 'مربع مهمة', 'aria-label': 'مربع مهمة', onmousedown: (e) => e.preventDefault(), onclick: () => exec('insertText', '☐ ') }, '☐'),
          h('select', { class: 'inp nb-font', 'aria-label': 'شكل الخط', onchange: (e) => { b.font = e.target.value; text.style.fontFamily = FONTS[b.font][1]; save(); } }, Object.entries(FONTS).map(([k, [l]]) => h('option', { value: k, selected: (b.font || 'print') === k }, l))))
        : mode === 'pen' ? h('div', { class: 'nb-opts' }, INKS.map(([c, n]) => dot(c, 'قلم ' + n, ink === c, () => { ink = c; paint(); })))
        : mode === 'hl' ? h('div', { class: 'nb-opts' }, HLS.map(([c, n]) => dot(c, 'تظليل ' + n, hl === c, () => { hl = c; paint(); })))
        : h('div', { class: 'nb-opts' }, h('small', { class: 'sub', style: { margin: 0 } }, 'مرّر على الخط لمسحه')),
        h('div', { class: 'nb-opts' }, h('button', { class: 'wb', title: 'تراجع عن آخر خط', 'aria-label': 'تراجع', disabled: !hist.length && mode !== 'type', onclick: () => { if (mode === 'type') return exec('undo'); if (!hist.length) return; pg.ink = JSON.parse(hist.pop()); drawInk(); save(); paint(); } }, '↶')));
    }
    const addPage = () => { flushText(); b.pages.splice(idx + 1, 0, newPage()); go(idx + 1, 'flip-next'); };
    const delPage = async () => { if (b.pages.length < 2) return SP.toast('هذه آخر صفحة في الدفتر', 'err'); if (!(await SP.confirm('حذف هذه الصفحة؟'))) return; b.pages.splice(idx, 1); idx = Math.min(idx, b.pages.length - 1); buildPage('none'); save(); };
    const printBook = () => { flushText(); SP.save(); const w = h('div', { class: 'nb-print' }, b.pages.map((p, i) => { const s = svgOf(p); const d = h('div', { class: 'nb-page nb-ppage' }, h('div', { class: 'nb-head' }, h('span', { class: 'nb-date' }, p.date || ''), h('span', { class: 'nb-no' }, i + 1)), h('div', { class: 'nb-margin' }), h('div', { class: 'nb-text', style: { fontFamily: FONTS[b.font || 'print'][1] } })); d.querySelector('.nb-text').innerHTML = p.html || ''; d.append(s); return d; }));
      document.body.append(w); document.body.classList.add('printing-nb'); const done = () => { w.remove(); document.body.classList.remove('printing-nb'); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); try { window.print(); } catch (e) { SP.toast('الطباعة غير متاحة هنا', 'err'); } setTimeout(done, 1500); };
    const svgOf = (p) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', `0 0 ${PW} ${PH}`); s.setAttribute('class', 'nb-ink'); s.setAttribute('preserveAspectRatio', 'none'); (p.ink || []).forEach((x) => s.append(strokeEl(x))); return s; };
    const title = h('input', { class: 'inp wtitle', id: 'nb-title', value: b.name, 'aria-label': 'اسم الدفتر', onchange: (e) => { b.name = e.target.value.trim() || b.name; save(); } });
    const prev = h('button', { class: 'nb-turn prev', 'aria-label': 'الصفحة السابقة', title: 'الصفحة السابقة', onclick: () => idx > 0 && go(idx - 1) }, '›');
    const next = h('button', { class: 'nb-turn next', 'aria-label': 'الصفحة التالية', title: 'الصفحة التالية (أو صفحة جديدة)', onclick: () => go(idx + 1) }, '‹');
    root.append(h('div', { class: 'row nb-top' }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('notebook') }, 'دفاتري'), h('span', { class: 'nb-dot', style: { background: b.color }, 'aria-hidden': 'true' }), title,
      SP.more([['➕ صفحة جديدة بعد هذه', addPage], ['🖨 طباعة الدفتر / حفظ PDF', printBook], ['🗑 حذف هذه الصفحة', delPage, true], ['🗑 حذف الدفتر', async () => { if (await SP.confirm('حذف «' + b.name + '» بكل صفحاته؟')) { S().nbooks = books().filter((x) => x !== b); SP.save(); SP.go('notebook'); } }, true]])),
      tools, h('div', { class: 'nb-desk' }, prev, stage, next), h('div', { class: 'nb-foot' }, pageInfo, h('button', { class: 'btn ghost sm', onclick: addPage }, '+ صفحة')));
    root.addEventListener('keydown', (e) => { if (e.target.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === 'ArrowLeft') go(idx + 1); if (e.key === 'ArrowRight' && idx > 0) go(idx - 1); });
    let sx = null; stage.addEventListener('touchstart', (e) => { if (mode === 'type' && e.touches.length === 1) sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 80) dx < 0 ? go(idx + 1) : idx > 0 && go(idx - 1); }, { passive: true });
    buildPage('none'); root._api = { go, setMode, page: () => idx, book: b };
    return root;
  }

  SP.reg('notebook', '', 'دفتري', (p) => {
    if (!p[0]) return shelf();
    const b = mine().find((x) => x.id === p[0]);
    return b ? open(b, p[1] ? +p[1] - 1 : null) : SP.page('الدفتر غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('notebook') }, 'دفاتري'));
  });
})();
