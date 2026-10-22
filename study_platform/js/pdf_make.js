/* صناعة PDF من محتوى منسّق (عناوين، فقرات، قوائم، جداول، صناديق، صور) مع دعم كامل للعربية:
   نرسم كل صفحة على لوحة رسم (المتصفح يتكفّل بتشكيل الحروف العربية واتجاهها) ثم نضمّها في ملف PDF */
(function () {
  const SP = window.SP;
  const W = 1240, H = 1754, M = 96, CW = W - 2 * M; // A4 بدقة 150 نقطة/بوصة
  const FONT = '"IBM Plex Sans Arabic", Tahoma, "Segoe UI", Arial, sans-serif';
  const INK = '#14213D', BLUE = '#1F4E99', MUTE = '#64748B';
  const BOX = { 'box-def': ['#1F4E99', '#F3F6FB'], 'box-ex': ['#2E7D32', '#EEF7EE'], 'box-warn': ['#C62828', '#FDEEEE'], 'box-case': ['#7B3FA0', '#F5EEF9'], 'box-sum': ['#E07B00', '#FFF5E8'], box: ['#1F4E99', '#F3F6FB'] };
  const AR = (n) => String(n).replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[x]);
  const rtlOf = (t) => !/^[\s\d\p{P}]*[A-Za-z]/u.test(t) || /[؀-ۿ]/.test(t);

  /* تحويل HTML إلى كتل بسيطة */
  function blocks(html) {
    const root = document.createElement('div'); root.innerHTML = SP.sanitizeHTML ? SP.sanitizeHTML(html) : html; const out = [];
    const txt = (el) => (el.innerText || el.textContent || '').replace(/​/g, '').replace(/[ \t]+/g, ' ').trim();
    const walk = (el, ctx = {}) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { const t = n.data.trim(); if (t) out.push({ t: 'p', text: t, ...ctx }); continue; }
        if (n.nodeType !== 1) continue; const tag = n.tagName, cls = n.className || '';
        if (/^H[1-4]$/.test(tag)) out.push({ t: 'h', lvl: +tag[1], text: txt(n), align: n.style.textAlign });
        else if (tag === 'P') { const t = txt(n); out.push(t ? { t: 'p', text: t, align: n.style.textAlign, bold: !!n.querySelector('b,strong') && t === txt(n.querySelector('b,strong')), ...ctx } : { t: 'gap' }); n.querySelectorAll('img').forEach((im) => out.push({ t: 'img', src: im.src })); }
        else if (tag === 'UL' || tag === 'OL') { const items = [...n.children].filter((c) => c.tagName === 'LI'); items.forEach((li, i) => { const sub = li.querySelector('ul,ol'); const own = sub ? txt(li).replace(txt(sub), '').trim() : txt(li); out.push({ t: 'li', text: own, mark: tag === 'OL' ? (n.getAttribute('type') === 'a' ? 'أبجدهوزحطي'[i] + ')' : AR(i + 1) + '.') : cls.includes('chk') ? (li.className.includes('done') ? '☑' : '☐') : '•', depth: ctx.depth || 0, ...ctx }); if (sub) walk({ childNodes: [sub] }, { ...ctx, depth: (ctx.depth || 0) + 1 }); }); }
        else if (tag === 'TABLE') { const rows = [...n.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => ({ text: txt(c), th: c.tagName === 'TH' }))); if (rows.length) out.push({ t: 'table', rows, lh: cls.includes('lh') }); }
        else if (tag === 'BLOCKQUOTE') out.push({ t: 'box', color: [BLUE, '#F3F6FB'], items: [{ t: 'p', text: txt(n) }] });
        else if (tag === 'HR') out.push({ t: 'hr' });
        else if (tag === 'IMG') out.push({ t: 'img', src: n.src });
        else if (tag === 'DIV' && cls.includes('pgbrk')) out.push({ t: 'break' });
        else if (tag === 'DIV' && cls.includes('lines')) out.push({ t: 'lines' });
        else if (tag === 'DIV' && /\bbox\b/.test(cls)) { const k = Object.keys(BOX).find((x) => cls.split(' ').includes(x) && x !== 'box') || 'box'; const inner = []; const save = out.length; walk(n, ctx); inner.push(...out.splice(save)); out.push({ t: 'box', color: BOX[k], items: inner.length ? inner : [{ t: 'p', text: txt(n) }] }); }
        else if (tag === 'DIV' && cls.includes('sig')) { const save = out.length; walk(n, { ...ctx, align: 'left' }); out.splice(save, 0, { t: 'gap' }, { t: 'gap' }); }
        else walk(n, ctx);
      }
    };
    walk(root); return out;
  }

  async function render(html, opts = {}) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    const pages = []; let c, ctx, y;
    const newPage = () => { c = document.createElement('canvas'); c.width = W; c.height = H; ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); pages.push(c); y = M; ctx.textBaseline = 'top'; };
    const font = (size, bold) => { ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`; };
    const wrap = (text, width) => { const lines = []; for (const para of String(text).split('\n')) { let line = ''; for (const w of para.split(/\s+/)) { const tryL = line ? line + ' ' + w : w; if (ctx.measureText(tryL).width > width && line) { lines.push(line); line = w; } else line = tryL; } lines.push(line); } return lines; };
    const need = (h) => { if (y + h > H - M) newPage(); };
    const drawLines = (lines, x0, width, size, lh, color, align) => { for (const ln of lines) { need(lh); ctx.fillStyle = color; const rtl = rtlOf(ln); ctx.direction = rtl ? 'rtl' : 'ltr';
      if (align === 'center') { ctx.textAlign = 'center'; ctx.fillText(ln, x0 + width / 2, y); } else if (align === 'left' || (!rtl && align !== 'right')) { ctx.textAlign = 'left'; ctx.fillText(ln, x0, y); } else { ctx.textAlign = 'right'; ctx.fillText(ln, x0 + width, y); } y += lh; } };
    const para = (b, x0 = M, width = CW) => {
      if (b.t === 'h') { const size = { 1: 46, 2: 34, 3: 28, 4: 25 }[b.lvl] || 28; font(size, true); y += b.lvl === 1 ? 6 : 16; need(size * 1.5); drawLines(wrap(b.text, width), x0, width, size, size * 1.45, b.lvl === 2 ? BLUE : INK, b.align); if (b.lvl === 1) { ctx.fillStyle = BLUE; ctx.fillRect(x0 + width - 90, y + 2, 90, 5); y += 18; } else y += 6; return; }
      if (b.t === 'p') { font(25, b.bold); drawLines(wrap(b.text, width), x0, width, 25, 42, INK, b.align); y += 12; return; }
      if (b.t === 'li') { font(25); const ind = 36 + (b.depth || 0) * 36, lines = wrap(b.text, width - ind - 10); need(42); ctx.fillStyle = BLUE; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillText(b.mark, x0 + width - (b.depth || 0) * 36, y); drawLines(lines, x0, width - ind, 25, 42, INK); y += 4; return; }
      if (b.t === 'gap') { y += 22; return; }
      if (b.t === 'hr') { need(30); ctx.fillStyle = '#E2E8F0'; ctx.fillRect(x0, y + 12, width, 3); y += 34; return; }
      if (b.t === 'lines') { for (let i = 0; i < 4; i++) { need(46); ctx.fillStyle = '#C9D2DE'; ctx.fillRect(x0, y + 40, width, 2); y += 46; } y += 12; return; }
    };
    const table = async (b) => {
      const cols = Math.max(...b.rows.map((r) => r.length)), cw = CW / cols; y += 6;
      for (const r of b.rows) {
        font(23, r.some((x) => x.th)); const cells = r.map((x) => wrap(x.text, cw - 24)), rh = Math.max(...cells.map((l) => l.length)) * 36 + 22; need(rh);
        r.forEach((cell, i) => { const x = M + CW - (i + 1) * cw; if (!b.lh) { if (cell.th) { ctx.fillStyle = '#EEF2F8'; ctx.fillRect(x, y, cw, rh); } ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 2; ctx.strokeRect(x, y, cw, rh); }
          font(23, cell.th || b.lh && i === 0); const save = y; y += 11; drawLines(cells[i], x + 12, cw - 24, 23, 36, INK, b.lh && i === r.length - 1 && r.length > 1 ? 'left' : undefined); y = save; });
        y += rh;
      }
      if (b.lh) { ctx.fillStyle = BLUE; ctx.fillRect(M, y + 4, CW, 3); ctx.fillRect(M, y + 11, CW, 3); y += 24; } else y += 16;
    };
    const image = async (b) => { try { const im = new Image(); im.src = b.src; await im.decode(); const k = Math.min(1, CW / im.width, (H - 2 * M) / 2 / im.height), w = im.width * k, hh = im.height * k; need(hh + 16); ctx.drawImage(im, M + (CW - w) / 2, y, w, hh); y += hh + 16; } catch (e) { /* صورة غير قابلة للقراءة */ } };
    newPage();
    if (opts.title && !/<h1/i.test(html)) { font(46, true); drawLines(wrap(opts.title, CW), M, CW, 46, 66, INK); ctx.fillStyle = BLUE; ctx.fillRect(M + CW - 90, y + 2, 90, 5); y += 30; }
    for (const b of blocks(html)) {
      if (b.t === 'break') { newPage(); continue; }
      if (b.t === 'table') { await table(b); continue; }
      if (b.t === 'img') { await image(b); continue; }
      if (b.t === 'box') { // نقيس الارتفاع على لوحة مؤقتة ثم نرسم الخلفية
        need(90); const pad = 22, start = y, startPage = pages.length; y += pad; for (const it of b.items) para(it, M + pad + 10, CW - 2 * pad - 10); y += pad - 12;
        if (pages.length === startPage) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = b.color[1]; ctx.fillRect(M, start, CW, y - start); ctx.restore(); }
        ctx.fillStyle = b.color[0]; ctx.fillRect(M + CW - 8, pages.length === startPage ? start : M, 8, y - (pages.length === startPage ? start : M)); y += 16; continue; }
      para(b);
    }
    // ترقيم الصفحات والعنوان الصغير
    pages.forEach((p, i) => { const g = p.getContext('2d'); g.font = `22px ${FONT}`; g.fillStyle = MUTE; g.textBaseline = 'alphabetic'; g.direction = 'rtl'; g.textAlign = 'center'; g.fillText(`${AR(i + 1)} / ${AR(pages.length)}`, W / 2, H - 46); if (opts.title && i > 0) { g.textAlign = 'right'; g.fillText(opts.title, W - M, 60); } });
    return pages;
  }

  SP.makePdf = async (html, opts = {}) => {
    if (!window.PDFLib) throw new Error('مكتبة PDF لم تُحمَّل. تأكد من الاتصال.');
    const pages = await render(html, opts), { PDFDocument } = window.PDFLib, doc = await PDFDocument.create();
    if (opts.title) doc.setTitle(opts.title); doc.setCreator('منصة الدراسة'); doc.setLanguage && doc.setLanguage('ar');
    for (const c of pages) { const jpg = await new Promise((r) => c.toBlob((b) => b.arrayBuffer().then(r), 'image/jpeg', 0.9)); const pg = doc.addPage([595.28, 841.89]); pg.drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: 595.28, height: 841.89 }); }
    return new Blob([await doc.save()], { type: 'application/pdf' });
  };
  SP._pdfBlocks = blocks;
})();
