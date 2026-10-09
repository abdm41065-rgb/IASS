/* المساعد «سند» (شخصية متحركة + محادثة) · مولّد الأسئلة من الملفات · إرسال الملفات والوارد */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- الوصول إلى Claude (داخل claude.ai فقط) ---------- */
  let sp = null;
  SP.aiSample = () => sp || (sp = window.claude && window.claude.use ? window.claude.use('sample').catch(() => null) : Promise.resolve(null));
  const aiErr = (e) => ({ not_granted: 'لم تسمح للمساعد باستخدام Claude بعد. اسمح له من نافذة الإذن ثم أعد المحاولة.', sampling_disabled: 'Claude غير متاح لهذا الحساب.', rate_limited: 'طلبات كثيرة الآن، جرّب بعد قليل.', session_expired: 'سجّل دخولك إلى claude.ai من جديد.', refused: 'لم أستطع الرد على هذا الطلب، جرّب صياغة أخرى.', prompt_too_large: 'المحتوى طويل جداً. جرّب ملفاً أصغر.', invalid_json: 'وصل رد غير مكتمل، جرّب مرة أخرى.', image_rejected: 'الصورة غير مدعومة أو كبيرة جداً.' }[e && e.code] || 'حدث خطأ في الاتصال، جرّب مرة أخرى.');

  /* ---------- قراءة نص الملف ---------- */
  SP.fileText = async (blob, mime = '', name = '') => {
    if (/pdf/.test(mime) || /\.pdf$/i.test(name)) {
      if (!window.pdfjsLib) throw new Error('قارئ PDF لم يُحمَّل');
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
      let out = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 40) && out.length < 60000; i++) out += (await (await pdf.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ') + '\n';
      pdf.destroy(); return out.slice(0, 60000);
    }
    if (mime.startsWith('text/') || /\.(txt|md|csv|html?)$/i.test(name)) { const t = await blob.text(); return (/html/.test(mime) || /\.html?$/i.test(name) ? t.replace(/<[^>]+>/g, ' ') : t).slice(0, 60000); }
    return '';
  };

  /* ---------- مولّد الأسئلة ---------- */
  const TEMPLATES = { quick: ['اختبار قصير', { mcq: 5, tf: 3, short: 2 }], full: ['مراجعة شاملة', { mcq: 10, tf: 5, short: 5 }], mcq: ['اختيار من متعدد فقط', { mcq: 10, tf: 0, short: 0 }], tf: ['صح أو خطأ فقط', { mcq: 0, tf: 10, short: 0 }] };
  const SECT = { mcq: 'اختيار من متعدد', tf: 'صح أو خطأ', short: 'إجابة قصيرة' };
  function normalize(raw, counts) {
    const sections = [];
    for (const type of ['mcq', 'tf', 'short']) {
      if (!counts[type]) continue;
      const src = ((raw && raw.sections) || []).find((s) => s && s.type === type);
      const qs = ((src && src.questions) || []).map((q) => {
        if (!q || !String(q.q || '').trim()) return null;
        if (type === 'mcq') { const o = (q.options || []).map(String).filter((x) => x.trim()).slice(0, 6); const a = Math.floor(+q.answer); return o.length >= 2 && a >= 0 && a < o.length ? { q: String(q.q), options: o, answer: a, explain: String(q.explain || '') } : null; }
        if (type === 'tf') return { q: String(q.q), answer: q.answer === true || q.answer === 'true' || q.answer === 'صح', explain: String(q.explain || '') };
        return String(q.answer || '').trim() ? { q: String(q.q), answer: String(q.answer), explain: String(q.explain || '') } : null;
      }).filter(Boolean).slice(0, counts[type]);
      if (qs.length) sections.push({ name: SECT[type], type, questions: qs });
    }
    return { title: String((raw && raw.title) || ''), sections };
  }
  /* بديل بدون اتصال: أسئلة إكمال وصح/خطأ من جمل الدرس نفسها */
  function offlineQuestions(text, counts) {
    const sents = text.replace(/\s+/g, ' ').split(/(?<=[.!?؟。])\s+|\n/).map((s) => s.trim()).filter((s) => s.length > 35 && s.length < 240);
    const pool = [...new Set((text.match(/[\p{L}]{5,}/gu) || []))];
    if (sents.length < 3 || pool.length < 8) return null;
    const rnd = (a) => a[Math.floor(Math.random() * a.length)], used = new Set();
    const pick = () => { for (let i = 0; i < 40; i++) { const s = rnd(sents); if (!used.has(s)) { used.add(s); return s; } } return rnd(sents); };
    const key = (s) => (s.match(/[\p{L}]{5,}/gu) || []).sort((a, b) => b.length - a.length)[0];
    const others = (w, n) => { const o = new Set(); for (let i = 0; i < 80 && o.size < n; i++) { const x = rnd(pool); if (x !== w) o.add(x); } return [...o]; };
    const raw = { title: '', sections: [] };
    raw.sections.push({ type: 'mcq', questions: Array.from({ length: counts.mcq || 0 }, () => { const s = pick(), w = key(s); if (!w) return null; const opts = [w, ...others(w, 3)].sort(() => Math.random() - 0.5); return { q: 'أكمل: ' + s.replace(w, '_____'), options: opts, answer: opts.indexOf(w), explain: 'من الدرس: ' + s }; }) });
    raw.sections.push({ type: 'tf', questions: Array.from({ length: counts.tf || 0 }, (_, i) => { const s = pick(), w = key(s); if (i % 2 || !w) return { q: s, answer: true, explain: 'العبارة كما وردت في الدرس.' }; const x = others(w, 1)[0]; return { q: s.replace(w, x), answer: false, explain: 'الصحيح: ' + s }; }) });
    raw.sections.push({ type: 'short', questions: Array.from({ length: counts.short || 0 }, () => { const s = pick(), w = key(s); return w ? { q: 'املأ الفراغ: ' + s.replace(w, '_____'), answer: w, explain: 'من الدرس: ' + s } : null; }) });
    return normalize(raw, counts);
  }
  function renderQuestions(res, box, source) {
    let reveal = false; const out = h('div', {});
    const draw = () => out.replaceChildren(...res.sections.map((sec, si) => h('div', { class: 'qsec' }, h('h3', {}, `القسم ${['الأول', 'الثاني', 'الثالث'][si] || si + 1}: ${sec.name}`, h('span', { class: 'chip' }, sec.questions.length + ' أسئلة')),
      h('ol', {}, sec.questions.map((q) => h('li', {}, h('div', { class: 'qq' }, q.q),
        sec.type === 'mcq' ? h('ol', { class: 'qopts', type: 'أ' }, q.options.map((o, k) => h('li', { class: reveal && k === q.answer ? 'right' : '' }, o))) : null,
        sec.type === 'tf' ? h('div', { class: 'sub', style: { margin: 0 } }, 'صح / خطأ', reveal ? h('b', { class: 'ans' }, ' ← ' + (q.answer ? 'صح' : 'خطأ')) : null) : null,
        sec.type === 'short' && reveal ? h('b', { class: 'ans' }, 'الإجابة: ' + q.answer) : null,
        reveal && q.explain ? h('div', { class: 'explain' }, q.explain) : null))))));
    const cls = SP.classSelect('', false);
    const toQuiz = () => {
      const questions = res.sections.flatMap((sec) => sec.questions.map((q) => sec.type === 'mcq' ? { id: SP.uid(), type: 'mcq', q: q.q, options: q.options, answer: q.answer } : sec.type === 'tf' ? { id: SP.uid(), type: 'tf', q: q.q, options: ['صح', 'خطأ'], answer: q.answer ? 0 : 1 } : { id: SP.uid(), type: 'short', q: q.q, options: [], answer: q.answer }));
      S().quizzes.push({ id: SP.uid(), classId: SP.isTeacher() ? cls.value : '', by: SP.state.me, title: res.title || 'أسئلة: ' + source, order: S().quizzes.length, timeLimit: 0, created: Date.now(), questions });
      SP.save(); SP.toast('حُفظت كفويز في قسم الفويزات'); SP.emit('react', 'celebrate');
    };
    const toDeck = () => {
      const t = SP.today(), cards = res.sections.flatMap((sec) => sec.questions.map((q) => ({ id: SP.uid(), q: q.q + (sec.type === 'mcq' ? '\n' + q.options.map((o, k) => `${k + 1}) ${o}`).join('\n') : ''), a: sec.type === 'mcq' ? q.options[q.answer] : sec.type === 'tf' ? (q.answer ? 'صح' : 'خطأ') : q.answer, box: 1, due: t })));
      S().decks.push({ id: SP.uid(), ownerId: SP.state.me, classId: '', name: res.title || 'بطاقات: ' + source, cards }); SP.save(); SP.toast('أُضيفت كبطاقات مراجعة');
    };
    box.replaceChildren(h('div', { class: 'row sp' }, h('h3', {}, res.title || 'الأسئلة'), h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { reveal = e.target.checked; draw(); } }), ' إظهار الإجابات')), out,
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: toQuiz }, 'احفظ كفويز'), SP.isTeacher() ? cls : null, h('button', { class: 'btn ghost', onclick: toDeck }, 'أضف كبطاقات مراجعة')));
    draw();
  }
  SP.questionsFor = ({ name, blob, mime }) => {
    if (!blob) return SP.toast('الملف غير موجود في هذا المتصفح', 'err');
    const tpl = h('select', { class: 'inp', id: 'q-tpl' }, Object.entries(TEMPLATES).map(([k, [l, c]]) => h('option', { value: k }, `${l} (${c.mcq} اختيار، ${c.tf} صح/خطأ، ${c.short} قصيرة)`)), h('option', { value: 'custom' }, 'هيكل مخصص'));
    const num = (id, v) => h('input', { class: 'inp', id, type: 'number', min: 0, max: 20, value: v, style: { width: '76px' } });
    const nm = num('q-mcq', 5), nt = num('q-tf', 3), ns = num('q-short', 2);
    const custom = h('div', { class: 'row', hidden: true }, h('label', {}, 'اختيار ', nm), h('label', {}, 'صح/خطأ ', nt), h('label', {}, 'قصيرة ', ns));
    tpl.addEventListener('change', () => (custom.hidden = tpl.value !== 'custom'));
    const diff = h('select', { class: 'inp', id: 'q-diff' }, ['سهل', 'متوسط', 'صعب'].map((d, i) => h('option', { selected: i === 1 }, d)));
    const status = h('div', { class: 'sub', role: 'status' }), result = h('div', {});
    let ctl = null;
    const go = async () => {
      const counts = tpl.value === 'custom' ? { mcq: +nm.value || 0, tf: +nt.value || 0, short: +ns.value || 0 } : TEMPLATES[tpl.value][1];
      if (!counts.mcq && !counts.tf && !counts.short) return SP.toast('اختر عدد الأسئلة', 'err');
      genBtn.disabled = true; status.textContent = 'أقرأ الملف…'; result.replaceChildren(); SP.emit('react', 'thinking');
      try {
        const isImg = (mime || '').startsWith('image/'), text = isImg ? '' : await SP.fileText(blob, mime, name), sample = await SP.aiSample();
        if (!isImg && text.replace(/\s/g, '').length < 80) throw new Error('لم أجد نصاً كافياً في الملف. إذا كان PDF مصوّراً (صور فقط) فارفعه كصورة.');
        let res;
        if (sample) {
          status.textContent = 'سند يكتب الأسئلة… (قد يستغرق دقيقة)'; ctl = new AbortController(); stopBtn.hidden = false;
          const parts = Object.entries(counts).filter(([, n]) => n).map(([t, n], i) => `- القسم ${i + 1}: ${SECT[t]}، عدد ${n} ${t === 'mcq' ? '(4 خيارات وإجابة صحيحة واحدة، answer رقم الخيار من 0)' : t === 'tf' ? '(answer قيمة true أو false، ونصف العبارات تقريباً خاطئة)' : '(answer كلمة أو عبارة قصيرة)'}`).join('\n');
          const prompt = `أنت معلم خبير. اكتب أسئلة اختبار من محتوى الدرس ${isImg ? 'في الصورة المرفقة' : 'أدناه'} فقط، بلغة الدرس (العربية إن كان عربياً).\nالهيكل المطلوب بالضبط وبهذا الترتيب:\n${parts}\nالصعوبة: ${diff.value}. غطِّ أجزاء الدرس المختلفة ولا تكرر فكرة. لكل سؤال شرح قصير في explain.\nأجب بـ JSON فقط بهذا الشكل:\n{"title":"عنوان قصير للاختبار","sections":[{"type":"mcq","questions":[{"q":"...","options":["أ","ب","ج","د"],"answer":0,"explain":"..."}]},{"type":"tf","questions":[{"q":"...","answer":true,"explain":"..."}]},{"type":"short","questions":[{"q":"...","answer":"...","explain":"..."}]}]}\nاحذف القسم الذي عدده صفر.` + (isImg ? '' : `\n\nمحتوى الدرس (${name}):\n<<<\n${text.slice(0, 40000)}\n>>>`);
          res = normalize(await sample.json(prompt, isImg ? { signal: ctl.signal, images: [blob] } : { signal: ctl.signal }), counts);
        } else {
          if (isImg) throw new Error('توليد الأسئلة من الصور يحتاج المساعد الذكي، وهو يعمل عند فتح المنصة من claude.ai.');
          res = offlineQuestions(text, counts);
          if (!res) throw new Error('النص قصير جداً لتوليد أسئلة.');
          status.textContent = 'أسئلة تلقائية من جمل الدرس (بدون المساعد الذكي). داخل claude.ai يكتب سند أسئلة أعمق.';
        }
        if (!res.sections.length) throw new Error('لم تُنتج أسئلة صالحة، جرّب مرة أخرى.');
        if (sample) status.textContent = '';
        renderQuestions(res, result, name); SP.emit('react', 'happy');
      } catch (e) {
        status.textContent = e && e.code ? (e.code === 'cancelled' ? 'أُوقف التوليد.' : aiErr(e)) : (e.message || 'تعذّر توليد الأسئلة');
        SP.emit('react', 'encourage');
      } finally { genBtn.disabled = false; stopBtn.hidden = true; ctl = null; }
    };
    const genBtn = h('button', { class: 'btn', onclick: go }, 'ولّد الأسئلة'), stopBtn = h('button', { class: 'btn ghost', hidden: true, onclick: () => ctl && ctl.abort() }, 'إيقاف');
    SP.modal({ title: 'أسئلة من: ' + name, wide: true, body: h('div', {}, h('p', { class: 'sub' }, 'اختر هيكل الاختبار، وسأكتب الأسئلة مقسّمة على أقسامه من محتوى الملف.'),
      h('div', { class: 'row' }, SP.field('الهيكل', tpl), SP.field('الصعوبة', diff)), custom, h('div', { class: 'row', style: { marginTop: '12px' } }, genBtn, stopBtn), status, result),
      actions: [{ label: 'إغلاق', onclick: (c) => { ctl && ctl.abort(); c(); } }] });
  };

  /* ---------- إرسال الملفات والوارد ---------- */
  const inbox = () => (S().inbox = S().inbox || []);
  SP.sendFile = (f) => {
    const others = S().users.filter((u) => u.id !== SP.state.me), picked = new Set();
    const note = h('textarea', { class: 'inp', id: 'send-note', placeholder: 'رسالة مع الملف (اختياري)', style: { minHeight: '70px' } });
    SP.modal({ title: 'إرسال «' + f.name + '»', body: h('div', {}, h('label', { class: 'lbl' }, 'إلى'),
      others.length ? h('div', { class: 'grid s' }, others.map((u) => h('label', { class: 'card row', style: { padding: '10px', cursor: 'pointer' } }, h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? picked.add(u.id) : picked.delete(u.id)) }), SP.avatar(u), u.name))) : SP.empty('لا يوجد مستخدمون آخرون. أضفهم من الإعدادات.'),
      SP.field('رسالة', note)),
      actions: [{ label: 'إلغاء', onclick: (c) => c() }, { label: 'إرسال', primary: true, onclick: async (c) => {
        if (!picked.size) return SP.toast('اختر شخصاً واحداً على الأقل', 'err');
        const blob = await SP.idb.get(f.id); if (!blob) return SP.toast('الملف غير موجود في هذا المتصفح', 'err');
        const from = SP.me();
        for (const to of picked) {
          const id = SP.uid(); await SP.idb.put(id, blob);
          S().files.push({ ...f, id, ownerId: to, classId: '', star: false, tags: [...new Set([...(f.tags || []), 'مستلم'])], desc: ('من ' + from.name + (note.value.trim() ? ': ' + note.value.trim() : '')).slice(0, 500), added: Date.now() });
          inbox().push({ id: SP.uid(), from: from.id, to, fileId: id, name: f.name, mime: f.mime, note: note.value.trim(), ts: Date.now(), read: false });
        }
        SP.save(); c(); SP.toast(`أُرسل الملف إلى ${picked.size} ${picked.size > 1 ? 'أشخاص' : 'شخص'}`); SP.emit('react', 'send'); updateBell();
      } }] });
  };
  const bell = document.getElementById('inbox');
  function updateBell() {
    if (!bell) return; const n = inbox().filter((m) => m.to === SP.state.me && !m.read).length;
    bell.querySelector('.badge').textContent = n || ''; bell.querySelector('.badge').hidden = !n; bell.setAttribute('aria-label', n ? `الوارد: ${n} جديد` : 'الوارد');
  }
  SP.updateBell = updateBell;
  bell && bell.addEventListener('click', () => {
    const mine = inbox().filter((m) => m.to === SP.state.me).sort((a, b) => b.ts - a.ts);
    SP.modal({ title: 'الوارد', body: mine.length ? h('div', {}, mine.map((m) => { const f = S().files.find((x) => x.id === m.fileId), u = SP.user(m.from);
      return h('div', { class: 'card', style: { marginBottom: '8px', outline: m.read ? '' : '2px solid var(--blue)' } }, h('div', { class: 'row sp' }, h('span', { class: 'row' }, SP.avatar(u), h('div', {}, h('b', {}, u.name), h('div', { class: 'sub', style: { margin: 0 } }, SP.date(m.ts)))), m.read ? null : h('span', { class: 'chip on' }, 'جديد')),
        h('p', { style: { margin: '8px 0' } }, '📎 ' + m.name), m.note ? h('p', { class: 'sub', style: { margin: '0 0 8px' } }, '«' + m.note + '»') : null,
        f ? h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { document.querySelector('.ov').remove(); SP.go('files'); } }, 'اذهب للملفات'), /pdf|image/.test(m.mime || '') ? h('button', { class: 'btn ghost sm', onclick: () => { document.querySelector('.ov').remove(); SP.openInDesk(f); } }, 'افتح في دراسة') : null) : h('small', { class: 'sub' }, 'حُذف الملف'));
    })) : h('div', { class: 'empty' }, h('div', { class: 'sticker', style: { fontSize: '2.4rem', marginBottom: '8px' } }, '📬'), 'لا توجد ملفات واردة بعد'), actions: [{ label: 'إغلاق', onclick: (c) => c() }] });
    mine.forEach((m) => (m.read = true)); SP.save(); updateBell();
  });

  /* ---------- الشخصية: 6 أشكال + ألوان + إكسسوارات ---------- */
  const KINDS = { owl: 'بومة', cat: 'قطة', robot: 'روبوت', bear: 'دب', fox: 'ثعلب', penguin: 'بطريق' };
  const KIND_COLOR = { owl: '#1F4E99', cat: '#6B7280', robot: '#0F766E', bear: '#7C5A3C', fox: '#C2410C', penguin: '#1F2937' };
  const MCOLORS = ['#1F4E99', '#0F766E', '#2E7D32', '#C2410C', '#B91C1C', '#7B3FA0', '#7C5A3C', '#6B7280', '#1F2937', '#D4A017'];
  const ACCS = { cap: 'قبعة تخرّج', crown: 'تاج', headphones: 'سماعات', glasses: 'نظارة', bow: 'فيونكة', none: 'بدون' };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  function svgFor(cfg) {
    const k = KINDS[cfg.kind] ? cfg.kind : 'owl', C = cfg.color || KIND_COLOR[k], D = shade(C, -0.3), L = k === 'fox' || k === 'penguin' ? '#FFFFFF' : shade(C, 0.82), P = '#14213D';
    const arms = (rx = 9, ry = 15, fill = D) => `<ellipse class="wing wl" cx="23" cy="80" rx="${rx}" ry="${ry}" fill="${fill}"/><ellipse class="wing wr" cx="97" cy="80" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
    const eyes = `<circle cx="44" cy="60" r="15" fill="#fff"/><circle cx="76" cy="60" r="15" fill="#fff"/><g class="pupils"><circle cx="45" cy="61" r="6.5" fill="${P}"/><circle cx="77" cy="61" r="6.5" fill="${P}"/><circle cx="47" cy="58.5" r="2" fill="#fff"/><circle cx="79" cy="58.5" r="2" fill="#fff"/></g><g class="lids"><rect x="28" y="44" width="32" height="32" rx="16" fill="${C}"/><rect x="60" y="44" width="32" height="32" rx="16" fill="${C}"/></g>`;
    const cheeks = `<circle cx="33" cy="76" r="4" fill="#F7A8B8" opacity=".6"/><circle cx="87" cy="76" r="4" fill="#F7A8B8" opacity=".6"/>`;
    const B = {
      owl: `<path class="wing wl" d="M22 70c-10 6-12 22-4 30 6-4 10-14 10-26z" fill="${D}"/><path class="wing wr" d="M98 70c10 6 12 22 4 30-6-4-10-14-10-26z" fill="${D}"/><path d="M28 44 33 22 46 38z M92 44 87 22 74 38z" fill="${C}"/><ellipse cx="60" cy="72" rx="38" ry="40" fill="${C}"/><ellipse cx="60" cy="88" rx="22" ry="20" fill="${L}"/><path d="M50 84h20M48 92h24M52 100h16" stroke="${shade(C, 0.5)}" stroke-width="2" stroke-linecap="round" fill="none"/>${eyes}${cheeks}<path d="M55 71h10l-5 8z" fill="#F2B233"/>`,
      cat: `${arms()}<path d="M26 50 30 18 52 36z M94 50 90 18 68 36z" fill="${C}"/><path d="M31 40 33 26 44 36z M89 40 87 26 76 36z" fill="#F7A8B8"/><ellipse cx="60" cy="72" rx="38" ry="40" fill="${C}"/><ellipse cx="60" cy="92" rx="20" ry="16" fill="${L}"/>${eyes}${cheeks}<path d="M56 72h8l-4 5z" fill="#E66A8A"/><path d="M60 77c-2 4-7 4-8 1M60 77c2 4 7 4 8 1" stroke="${P}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M30 74h-14M30 79l-13 3M90 74h14M90 79l13 3" stroke="${P}" stroke-width="1.4" opacity=".55" stroke-linecap="round"/>`,
      robot: `<path d="M60 30V16" stroke="${D}" stroke-width="3"/><circle cx="60" cy="14" r="5" fill="#F2B233"/>${arms(8, 14)}<rect x="22" y="30" width="76" height="80" rx="18" fill="${C}"/><rect x="28" y="42" width="64" height="40" rx="12" fill="${L}"/>${eyes}<rect x="46" y="90" width="28" height="8" rx="3" fill="${D}"/><path d="M52 90v8M60 90v8M68 90v8" stroke="${L}" stroke-width="1.5"/><circle cx="30" cy="100" r="2.5" fill="${D}"/><circle cx="90" cy="100" r="2.5" fill="${D}"/>`,
      bear: `<circle cx="30" cy="36" r="12" fill="${C}"/><circle cx="90" cy="36" r="12" fill="${C}"/><circle cx="30" cy="36" r="6" fill="${L}"/><circle cx="90" cy="36" r="6" fill="${L}"/>${arms(10, 15)}<ellipse cx="60" cy="72" rx="38" ry="40" fill="${C}"/><ellipse cx="60" cy="94" rx="20" ry="15" fill="${L}"/>${eyes}<ellipse cx="60" cy="78" rx="12" ry="9" fill="${L}"/><ellipse cx="60" cy="74" rx="5" ry="3.5" fill="${P}"/><path d="M60 78v4M56 83c2 2 6 2 8 0" stroke="${P}" stroke-width="1.6" fill="none" stroke-linecap="round"/>${cheeks}`,
      fox: `<path d="M24 52 26 14 52 36z M96 52 94 14 68 36z" fill="${C}"/><path d="M30 42 31 26 43 36z M90 42 89 26 77 36z" fill="${P}" opacity=".6"/>${arms()}<ellipse cx="60" cy="72" rx="38" ry="40" fill="${C}"/><path d="M22 72c10 4 22 6 38 22 16-16 28-18 38-22-2 22-18 38-38 38S24 94 22 72z" fill="#fff"/>${eyes}<ellipse cx="60" cy="80" rx="5" ry="3.5" fill="${P}"/>${cheeks}`,
      penguin: `<path class="wing wl" d="M24 66c-10 10-10 26-2 32 6-6 8-18 8-30z" fill="${C}"/><path class="wing wr" d="M96 66c10 10 10 26 2 32-6-6-8-18-8-30z" fill="${C}"/><ellipse cx="60" cy="70" rx="38" ry="42" fill="${C}"/><ellipse cx="60" cy="80" rx="27" ry="32" fill="#fff"/>${eyes}<path d="M54 74h12l-6 8z" fill="#F2A33A"/><ellipse cx="48" cy="111" rx="9" ry="4" fill="#F2A33A"/><ellipse cx="72" cy="111" rx="9" ry="4" fill="#F2A33A"/>${cheeks}`,
    };
    const A = {
      cap: `<path d="M30 30 60 18 90 30 60 42z" fill="${P}"/><path d="M84 32v14" stroke="#F2B233" stroke-width="2.5" stroke-linecap="round"/><circle cx="84" cy="47" r="3" fill="#F2B233"/>`,
      crown: `<path d="M38 34 42 14 52 26 60 10 68 26 78 14 82 34z" fill="#F2B233" stroke="#C98A00" stroke-width="1.5"/><circle cx="60" cy="24" r="2.5" fill="#B91C1C"/>`,
      headphones: `<path d="M26 60c0-26 16-40 34-40s34 14 34 40" stroke="${P}" stroke-width="5" fill="none"/><rect x="16" y="54" width="14" height="22" rx="6" fill="${P}"/><rect x="90" y="54" width="14" height="22" rx="6" fill="${P}"/>`,
      glasses: `<circle cx="44" cy="60" r="16" stroke="${P}" stroke-width="3" fill="none"/><circle cx="76" cy="60" r="16" stroke="${P}" stroke-width="3" fill="none"/><path d="M58 58h4" stroke="${P}" stroke-width="3"/>`,
      bow: `<path d="M78 30 92 22 92 40z M78 30 64 22 64 40z" fill="#E66A8A"/><circle cx="78" cy="31" r="4" fill="#C2185B"/>`, none: '',
    };
    const kind = B[k];
    return `<svg viewBox="0 0 120 120" aria-hidden="true" data-kind="${k}"><g class="m-body">${kind}${A[cfg.acc] != null ? A[cfg.acc] : A.cap}</g></svg>`;
  }
  const cfgs = () => (S().mascot = S().mascot || {});
  const cfg = () => (cfgs()[SP.state.me] = Object.assign({ kind: 'owl', color: '', acc: 'cap', name: 'سند' }, cfgs()[SP.state.me] || {}));
  const mname = () => cfg().name || 'سند';

  const MOODS = {
    happy: ['😊', ['تمام!', 'ممتاز 👌', 'أحسنت!']], celebrate: ['🎉', ['رائع جداً! 🏆', 'إنجاز يستحق الاحتفال 🎉', 'نجم! ⭐']], encourage: ['💪', ['لا بأس، نحاول مرة ثانية 💪', 'كل خطأ درس جديد 🌱', 'قريب جداً، استمر!']],
    thinking: ['🤔', ['دعني أفكر…', 'أقرأ الآن… 📖']], write: ['✍️', ['حفظت ملاحظتك ✍️', 'فكرة جميلة 💡']], file: ['📁', ['وصل الملف 📁', 'أضفته لملفاتك ✅']],
    send: ['📨', ['وصلت الأمانة 📨', 'تم الإرسال ✈️']], wave: ['👋', ['أهلاً! 👋', 'مرحباً بعودتك 👋']], inbox: ['📬', ['وصلك ملف جديد 📬']],
    giggle: ['😆', ['هههه، تدغدغني! 😆', 'نعم؟ أنا هنا 👀', 'هلا! 😄']], love: ['❤️', ['وأنا أحبك كمان ❤️', 'أنت أفضل طالب 🥰']],
    dizzy: ['😵‍💫', ['دوّختني! 😵‍💫', 'الدنيا تلف… 🌀']], angry: ['😤', ['كفى نقراً! 😤', 'خلاص خلاص، أنا صاحي 😠']],
    lifted: ['😮', ['وااو! إلى أين؟ 😮', 'أنا أطير! 🕊️']], landed: ['😌', ['هبوط آمن 🛬', 'مكان جميل هنا 😌']], sleepy: ['💤', ['زززز… 💤']], scroll: ['🎢', ['وااو بسرعة! 🎢']],
  };
  const root = h('div', { class: 'mascot', id: 'sanad' }), bubble = h('div', { class: 'm-bubble', role: 'status', hidden: true });
  const fig = h('button', { class: 'm-fig', title: 'انقر، انقر مرتين أو أكثر، أو اسحبني' });
  const chatBtn = h('button', { class: 'm-chat', 'aria-label': 'افتح المحادثة' }, h('span', { 'aria-hidden': 'true' }, '💬'));
  root.append(bubble, h('div', { class: 'm-row' }, fig, chatBtn)); document.body.append(root);
  let bubbleT = 0, panelOpen = false;
  const say = (text, ms = 4200) => { if (panelOpen) return; bubble.textContent = text; bubble.hidden = false; clearTimeout(bubbleT); bubbleT = setTimeout(() => (bubble.hidden = true), ms); };
  const anim = (cls, ms = 1400) => { if (reduced) return; root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls); setTimeout(() => root.classList.remove(cls), ms); };
  const burst = (emo, n = 6) => { if (reduced) return; for (let i = 0; i < n; i++) { const e = h('span', { class: 'm-pop', style: `--dx:${Math.round(Math.random() * 120 - 60)}px;--d:${i * 70}ms` }, emo); root.append(e); setTimeout(() => e.remove(), 1600); } };
  SP.react = (mood) => {
    const m = MOODS[mood] || MOODS.happy, line = m[1][Math.floor(Math.random() * m[1].length)];
    root.dataset.mood = mood; say(line); wake(false);
    const A = { celebrate: ['jump', 1400], love: ['love', 1200], dizzy: ['spin', 1300], angry: ['shake', 900], thinking: ['think', 2600], landed: ['land', 600], scroll: ['spin', 1300], wave: ['wave', 1400], send: ['wave', 1400], inbox: ['wave', 1400], giggle: ['nod', 900] }[mood] || ['nod', 900];
    anim(A[0], A[1]); if (mood === 'celebrate' || mood === 'love') burst(m[0]); if (mood === 'dizzy' || mood === 'angry') burst(m[0], 3);
  };
  (SP.listeners.react = SP.listeners.react || []).push(SP.react);
  const paint = () => {
    const c = cfg(); fig.innerHTML = svgFor(c);
    fig.setAttribute('aria-label', `${mname()} (${KINDS[c.kind] || 'بومة'}): انقر للتفاعل`); chatBtn.setAttribute('aria-label', 'تكلّم مع ' + mname());
    const p = c.pos; root.style.left = (p ? p.x : 16) + 'px'; root.style.bottom = `calc(${p ? p.y : 16}px + env(safe-area-inset-bottom, 0px))`;
    const f = document.querySelector('.m-panel .m-face'), t = document.querySelector('.m-panel header b'); if (f) f.innerHTML = svgFor(c); if (t) t.textContent = mname();
  };

  /* النقرات: واحدة، اثنتان، ثلاث، خمس فأكثر — والسحب (رفع وإنزال) */
  let taps = 0, tapT = 0, down = null, dragging = false, lastAct = Date.now(), asleep = false;
  const reactTaps = (n) => SP.react(n === 1 ? 'giggle' : n === 2 ? 'love' : n <= 4 ? 'dizzy' : 'angry');
  const clampPos = (x, y) => ({ x: Math.round(Math.max(4, Math.min(innerWidth - 90, x))), y: Math.round(Math.max(4, Math.min(innerHeight - 110, y))) });
  fig.addEventListener('pointerdown', (e) => { if (e.button) return; const p = cfg().pos || { x: 16, y: 16 }; down = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, last: e.clientY }; dragging = false; fig.setPointerCapture(e.pointerId); });
  fig.addEventListener('pointermove', (e) => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragging && Math.hypot(dx, dy) > 8) { dragging = true; root.classList.add('lifted'); SP.react('lifted'); }
    if (!dragging) return;
    const c = cfg(); c.pos = clampPos(down.px + dx, down.py - dy); root.style.left = c.pos.x + 'px'; root.style.bottom = c.pos.y + 'px';
    root.dataset.look = e.clientY < down.last - 2 ? 'up' : e.clientY > down.last + 2 ? 'down' : root.dataset.look; down.last = e.clientY;
  });
  const up = () => {
    if (!down) return; const was = dragging; down = null; dragging = false; delete root.dataset.look;
    if (was) { root.classList.remove('lifted'); SP.save(); SP.react('landed'); return; }
    taps++; clearTimeout(tapT); tapT = setTimeout(() => { reactTaps(taps); taps = 0; }, 360);
  };
  fig.addEventListener('pointerup', up); fig.addEventListener('pointercancel', up);
  fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reactTaps(1); } });
  chatBtn.addEventListener('click', () => toggle());
  addEventListener('resize', () => { const c = cfg(); if (c.pos) { c.pos = clampPos(c.pos.x, c.pos.y); paint(); } });

  /* التمرير لأعلى وأسفل: العينان تتبعان الاتجاه، والتمرير السريع يدوّخه */
  let lastY = scrollY, lastT = performance.now(), lookT = 0, dizzyAt = 0;
  addEventListener('scroll', () => {
    const now = performance.now(), dy = scrollY - lastY, v = Math.abs(dy) / Math.max(1, now - lastT) * 1000; lastY = scrollY; lastT = now;
    if (!dy) return; root.dataset.look = dy < 0 ? 'up' : 'down'; clearTimeout(lookT); lookT = setTimeout(() => delete root.dataset.look, 700);
    if (v > 4000 && now - dizzyAt > 15000) { dizzyAt = now; SP.react('scroll'); }
  }, { passive: true });

  /* رمش، ونوم بعد الخمول، ونصيحة كل فترة */
  const blink = () => { if (!asleep) { root.classList.add('blink'); setTimeout(() => root.classList.remove('blink'), 160); } setTimeout(blink, 2500 + Math.random() * 3500); };
  if (!reduced) setTimeout(blink, 1800);
  const wake = (greet) => { lastAct = Date.now(); if (asleep) { asleep = false; root.classList.remove('sleep'); if (greet) say('صحيت! ☀️'); } };
  ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, () => wake(true), { passive: true }));
  setInterval(() => { if (!asleep && !panelOpen && Date.now() - lastAct > 180000) { asleep = true; root.classList.add('sleep'); root.dataset.mood = 'sleepy'; say('زززز… 💤', 6000); } }, 30000);
  const tip = () => {
    if (document.hidden || panelOpen || asleep) return;
    const uid = SP.state.me, t = SP.today(), due = S().decks.filter((d) => d.ownerId === uid).flatMap((d) => d.cards).filter((c) => (c.due || t) <= t).length;
    const tasks = S().tasks.filter((x) => x.userId === uid && !x.done && x.due && x.due <= t).length, min = SP.studyMin(uid, t), goal = S().goalMin || 60;
    const tips = [due && `عندك ${due} بطاقة للمراجعة اليوم 🃏`, tasks && `${tasks} مهمة موعدها اليوم ✅`, min < goal && `باقي ${goal - min} دقيقة على هدفك اليوم ⏱️`, min >= goal && 'حققت هدف اليوم! 🌟', 'جرّب: افتح درساً في «دراسة» وظلّل المهم 🖍️', 'اسألني أي سؤال عن دروسك 💬', 'استراحة قصيرة تساعد على التركيز ☕', 'أستطيع كتابة أسئلة من أي ملف 📄❓', 'تقدر تغيّر شكلي من زر 💬 ثم «شكلي» 🎨'].filter(Boolean);
    say(tips[Math.floor(Math.random() * tips.length)], 5500); anim(Math.random() < 0.5 ? 'wave' : 'nod');
  };
  setInterval(tip, 75000);
  setTimeout(() => { const n = inbox().filter((m) => m.to === SP.state.me && !m.read).length; n ? SP.react('inbox') : (say(`أهلاً! أنا ${mname()} ${({ owl: '🦉', cat: '🐱', robot: '🤖', bear: '🐻', fox: '🦊', penguin: '🐧' })[cfg().kind] || ''}`), anim('wave')); }, 1200);

  /* تخصيص الشكل */
  SP.customizeMascot = () => {
    const c = { ...cfg() }; const prev = h('div', { class: 'm-preview' }), name = h('input', { class: 'inp', id: 'm-name', value: c.name, maxlength: 20 });
    const kinds = h('div', { class: 'm-kinds' }), colors = h('div', { class: 'row' }), accs = h('div', { class: 'row' });
    const draw = () => {
      prev.innerHTML = svgFor(c);
      kinds.replaceChildren(...Object.entries(KINDS).map(([k, l]) => { const b = h('button', { class: 'm-kind' + (c.kind === k ? ' on' : ''), 'aria-pressed': String(c.kind === k), onclick: () => { c.kind = k; c.color = ''; draw(); } }); b.innerHTML = svgFor({ kind: k, color: '', acc: 'none' }); b.append(h('span', {}, l)); return b; }));
      colors.replaceChildren(...MCOLORS.map((x) => h('button', { class: 'pc' + ((c.color || KIND_COLOR[c.kind]) === x ? ' on' : ''), style: { background: x }, 'aria-label': 'لون', onclick: () => { c.color = x; draw(); } })));
      accs.replaceChildren(...Object.entries(ACCS).map(([k, l]) => h('button', { class: 'chip' + (c.acc === k ? ' on' : ''), onclick: () => { c.acc = k; draw(); } }, l)));
    };
    draw();
    SP.modal({ title: 'شكل مساعدك', wide: true, body: h('div', { class: 'm-custom' }, prev, h('div', {}, SP.field('الاسم', name), h('label', { class: 'lbl' }, 'الشخصية'), kinds, h('label', { class: 'lbl' }, 'اللون'), colors, h('label', { class: 'lbl' }, 'الإكسسوار'), accs)),
      actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'حفظ', primary: true, onclick: (x) => { c.name = name.value.trim() || 'سند'; cfgs()[SP.state.me] = c; SP.save(); paint(); x(); SP.react('celebrate'); } }] });
  };

  /* ---------- المحادثة ---------- */
  let ctl = null;
  const chats = () => ((S().chat = S().chat || {})[SP.state.me] = (S().chat[SP.state.me] || []));
  const panel = h('section', { class: 'm-panel', hidden: true, 'aria-label': 'محادثة سند' });
  const list = h('div', { class: 'm-list', 'aria-live': 'polite' }), input = h('textarea', { class: 'inp', id: 'sanad-input', rows: 1, placeholder: 'اكتب رسالتك…', 'aria-label': 'رسالة إلى المساعد' });
  const sendBtn = h('button', { class: 'btn', onclick: () => send() }, 'إرسال'), stopBtn = h('button', { class: 'btn ghost', hidden: true, onclick: () => ctl && ctl.abort() }, 'إيقاف');
  const face = h('span', { class: 'm-face' }), title = h('b', {}, mname());
  const SUGG = ['ما مهامي اليوم؟', 'اختبرني بسؤال', 'لخّص آخر ملاحظاتي', 'كيف أنظّم وقتي للمذاكرة؟'];
  panel.append(h('header', {}, face, h('div', {}, title, h('div', { class: 'sub', style: { margin: 0, fontSize: '.8rem' } }, 'مساعدك في الدراسة')),
    h('button', { class: 'btn ghost sm', onclick: () => SP.customizeMascot() }, 'شكلي'), h('button', { class: 'btn ghost sm', 'aria-label': 'مسح المحادثة', onclick: () => { chats().length = 0; SP.save(); drawChat(); } }, 'مسح'), h('button', { class: 'btn ghost sm', 'aria-label': 'إغلاق', onclick: () => toggle(false) }, '✕')),
    list, h('div', { class: 'm-sugg' }, SUGG.map((s) => h('button', { class: 'chip', onclick: () => send(s) }, s))), h('div', { class: 'm-input' }, input, sendBtn, stopBtn));
  document.body.append(panel);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  const toggle = (on = !panelOpen) => { panelOpen = on; panel.hidden = !on; root.classList.toggle('open', on); bubble.hidden = true; if (on) { drawChat(); input.focus(); } else chatBtn.focus(); };
  const msgEl = (m) => h('div', { class: 'm-msg ' + (m.role === 'user' ? 'me' : 'bot') }, m.text);
  function drawChat() {
    const c = chats();
    list.replaceChildren(...(c.length ? c.map(msgEl) : [h('div', { class: 'm-msg bot' }, `أهلاً ${SP.me().name}! أنا ${mname()}، مساعدك في الدراسة. اسألني عن دروسك، أو اطلب مني أختبرك، أو أذكّرك بمهامك.`)]));
    list.scrollTop = list.scrollHeight;
  }
  const brief = () => {
    const uid = SP.state.me, s = S(), t = SP.today();
    return { name: SP.me().name, role: SP.isTeacher() ? 'معلم' : 'طالب', today: t, studyMinToday: SP.studyMin(uid, t), goalMin: s.goalMin || 60, streak: SP.streak(uid), avgQuiz: SP.avgScore(uid),
      openTasks: s.tasks.filter((x) => x.userId === uid && !x.done).slice(0, 10).map((x) => ({ text: x.text, due: x.due })), classes: SP.myClasses().map((c) => c.name),
      cardsDue: s.decks.filter((d) => d.ownerId === uid).flatMap((d) => d.cards).filter((c) => (c.due || t) <= t).length };
  };
  const TOOLS = () => [
    { name: 'search_notes', description: 'يبحث في ملاحظات المستخدم ويعيد حتى 5 ملاحظات (العنوان والنص). استخدمه عند السؤال عن ملاحظاته أو دروسه.', inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      execute: ({ query }) => S().notes.filter((n) => n.ownerId === SP.state.me && (!query || (n.title + n.body).includes(String(query)))).slice(0, 5).map((n) => ({ title: n.title, body: n.body.slice(0, 1500) })) },
    { name: 'add_task', description: 'يضيف مهمة إلى قائمة مهام المستخدم. استخدمه فقط عندما يطلب المستخدم صراحة إضافة مهمة أو تذكير.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD اختياري' } }, required: ['text'] },
      execute: ({ text, due }) => { const t = String(text || '').trim().slice(0, 200); if (!t) throw new Error('نص فارغ'); S().tasks.push({ id: SP.uid(), userId: SP.state.me, text: t, done: false, due: /^\d{4}-\d{2}-\d{2}$/.test(String(due)) ? String(due) : '', classId: '', prio: 1 }); SP.save(); return 'تمت إضافة المهمة'; } },
    { name: 'add_note', description: 'ينشئ ملاحظة جديدة للمستخدم (مثلاً تلخيص أو خطة مذاكرة). استخدمه فقط عندما يطلب المستخدم حفظها.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] },
      execute: ({ title, body }) => { S().notes.push({ id: SP.uid(), ownerId: SP.state.me, title: String(title).slice(0, 120), body: String(body).slice(0, 8000), color: SP.COLORS[0], pinned: false, tags: ['من سند'], classId: '', stickers: ['🦉'], updated: Date.now() }); SP.save(); return 'حُفظت الملاحظة'; } },
  ];
  /* ردود بديلة بدون اتصال */
  function offline(q) {
    const b = brief();
    if (/مهام|مهمة|واجب/.test(q)) return b.openTasks.length ? 'مهامك المفتوحة ✅\n' + b.openTasks.map((x) => '• ' + x.text + (x.due ? ' (' + x.due + ')' : '')).join('\n') : 'ما عندك مهام مفتوحة 🎉';
    if (/اختبر|سؤال|فويز/.test(q)) { const qz = S().quizzes.find((x) => x.classId ? SP.canSeeClass(x.classId) : x.by === SP.state.me); return qz ? `جرّب فويز «${qz.title}» من قسم الفويزات ❓ وتقدر من قسم الملفات تضغط «أسئلة» على أي ملف لأكتب منه أسئلة.` : 'من قسم الملفات اضغط «أسئلة» على أي ملف وأكتب لك منه اختباراً ❓'; }
    if (/ملاحظ|لخص|لخّص/.test(q)) { const n = S().notes.filter((x) => x.ownerId === SP.state.me).sort((a, c) => c.updated - a.updated)[0]; return n ? `آخر ملاحظة: «${n.title}» 📝\n${n.body.slice(0, 200)}` : 'ما عندك ملاحظات بعد 📝'; }
    if (/وقت|تنظيم|مذاكرة|ذاكر/.test(q)) return `جرّب هذه الخطة ⏱️\n• 25 دقيقة تركيز ثم 5 راحة (قسم التركيز)\n• ابدأ بالأصعب\n• راجع بطاقاتك يومياً (${b.cardsDue} للمراجعة اليوم)\nدرست اليوم ${b.studyMinToday} من ${b.goalMin} دقيقة 💪`;
    return 'أنا هنا لمساعدتك 🦉 أعرف مهامك وملاحظاتك وأقدر أكتب أسئلة من ملفاتك. للمحادثة الحرة الكاملة افتح المنصة من claude.ai.';
  }
  async function send(text) {
    const q = String(text != null ? text : input.value).trim(); if (!q || ctl) return;
    input.value = ''; const c = chats(); c.push({ role: 'user', text: q }); while (c.length > 40) c.shift(); SP.save(); drawChat();
    const bot = h('div', { class: 'm-msg bot typing' }, 'سند يكتب…'); list.append(bot); list.scrollTop = list.scrollHeight;
    const sample = await SP.aiSample(); root.dataset.mood = 'thinking';
    if (!sample) { setTimeout(() => { const a = offline(q); c.push({ role: 'bot', text: a }); SP.save(); drawChat(); SP.react('happy'); }, 500); return; }
    ctl = new AbortController(); sendBtn.hidden = true; stopBtn.hidden = false;
    const RULES = `أنت «${mname()}»، ${KINDS[cfg().kind] || 'بومة'} لطيف ومساعد دراسة داخل منصة دراسة عربية. تكلّم بالعربية بلهجة ودودة وواضحة، بجمل قصيرة، واستخدم إيموجي واحداً أو اثنين في كل رد بشكل طبيعي. ساعد في شرح الدروس، اختبار المستخدم بأسئلة، تنظيم الوقت، والتحفيز. لا تخترع معلومات عن ملفات لم تقرأها. ابدأ ردك دائماً بوسم المزاج بين قوسين مربعين واحد فقط من: [happy] [celebrate] [encourage] [thinking] [wave] ثم الرد. بيانات المستخدم الآن: ${JSON.stringify(brief())}`;
    const turns = [{ role: 'user', content: RULES }, ...c.slice(-16).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))];
    const clean = (t) => t.replace(/^\s*\[(happy|celebrate|encourage|thinking|wave)\]\s*/i, '');
    try {
      const lim = await sample.limits().catch(() => null);
      const { text: out } = await sample(turns, { signal: ctl.signal, modelTier: 'quick', ...(lim && lim.tools ? { tools: TOOLS() } : { cache: false }), onText: ({ text: t }) => { bot.classList.remove('typing'); bot.textContent = clean(t); list.scrollTop = list.scrollHeight; } });
      const mood = (out.match(/^\s*\[(\w+)\]/) || [])[1]; c.push({ role: 'bot', text: clean(out) }); SP.save(); drawChat(); SP.react(MOODS[mood] ? mood : 'happy');
    } catch (e) {
      bot.classList.remove('typing'); bot.textContent = (e.text ? clean(e.text) + '\n\n' : '') + (e.code === 'cancelled' ? '(أُوقف الرد)' : aiErr(e));
      if (e.text) c.push({ role: 'bot', text: clean(e.text) }); SP.save();
    } finally { ctl = null; sendBtn.hidden = false; stopBtn.hidden = true; }
  }
  (SP.listeners.route = SP.listeners.route || []).push(() => { updateBell(); paint(); if (panelOpen) drawChat(); });
  updateBell(); paint();
  SP._ai = { offlineQuestions, normalize, offline, toggle, send };
})();
