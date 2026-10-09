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

  /* ---------- الشخصية «سند» ---------- */
  const OWL = `<svg viewBox="0 0 120 120" aria-hidden="true"><g class="m-body">
    <path class="wing wl" d="M22 70c-10 6-12 22-4 30 6-4 10-14 10-26z" fill="#163A70"/><path class="wing wr" d="M98 70c10 6 12 22 4 30-6-4-10-14-10-26z" fill="#163A70"/>
    <path d="M28 44 33 22 46 38z M92 44 87 22 74 38z" fill="#1F4E99"/>
    <ellipse cx="60" cy="72" rx="38" ry="40" fill="#1F4E99"/><ellipse cx="60" cy="88" rx="22" ry="20" fill="#E4ECF7"/>
    <path d="M50 84h20M48 92h24M52 100h16" stroke="#9DB8E0" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="44" cy="60" r="15" fill="#fff"/><circle cx="76" cy="60" r="15" fill="#fff"/>
    <g class="pupils"><circle cx="45" cy="61" r="6.5" fill="#14213D"/><circle cx="77" cy="61" r="6.5" fill="#14213D"/><circle cx="47" cy="58.5" r="2" fill="#fff"/><circle cx="79" cy="58.5" r="2" fill="#fff"/></g>
    <g class="lids"><rect x="28" y="44" width="32" height="32" rx="16" fill="#1F4E99"/><rect x="60" y="44" width="32" height="32" rx="16" fill="#1F4E99"/></g>
    <circle cx="33" cy="74" r="4" fill="#F7A8B8" opacity=".55"/><circle cx="87" cy="74" r="4" fill="#F7A8B8" opacity=".55"/>
    <path d="M55 71h10l-5 8z" fill="#F2B233"/>
    <path d="M30 30 60 18 90 30 60 42z" fill="#14213D"/><path d="M60 30v-2M84 32v14" stroke="#F2B233" stroke-width="2.5" stroke-linecap="round"/><circle cx="84" cy="47" r="3" fill="#F2B233"/>
  </g></svg>`;
  const MOODS = {
    happy: ['😊', ['تمام!', 'ممتاز 👌', 'أحسنت!']], celebrate: ['🎉', ['رائع جداً! 🏆', 'إنجاز يستحق الاحتفال 🎉', 'نجم! ⭐']], encourage: ['💪', ['لا بأس، نحاول مرة ثانية 💪', 'كل خطأ درس جديد 🌱', 'قريب جداً، استمر!']],
    thinking: ['🤔', ['دعني أفكر…', 'أقرأ الآن… 📖']], write: ['✍️', ['حفظت ملاحظتك ✍️', 'فكرة جميلة 💡']], file: ['📁', ['وصل الملف 📁', 'أضفته لملفاتك ✅']],
    send: ['📨', ['وصلت الأمانة 📨', 'تم الإرسال ✈️']], wave: ['👋', ['أهلاً! أنا سند 🦉', 'مرحباً بعودتك 👋']], inbox: ['📬', ['وصلك ملف جديد 📬']],
  };
  const root = h('div', { class: 'mascot', id: 'sanad' }), bubble = h('div', { class: 'm-bubble', role: 'status', hidden: true });
  const fig = h('button', { class: 'm-fig', 'aria-label': 'افتح المساعد سند', title: 'سند: مساعدك' }); fig.innerHTML = OWL;
  root.append(bubble, fig); document.body.append(root);
  let bubbleT = 0;
  const say = (text, ms = 4200) => { if (panelOpen) return; bubble.textContent = text; bubble.hidden = false; clearTimeout(bubbleT); bubbleT = setTimeout(() => (bubble.hidden = true), ms); };
  const anim = (cls, ms = 1400) => { if (reduced) return; root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls); setTimeout(() => root.classList.remove(cls), ms); };
  const burst = (emo) => { if (reduced) return; for (let i = 0; i < 6; i++) { const e = h('span', { class: 'm-pop', style: `--dx:${Math.round(Math.random() * 120 - 60)}px;--d:${i * 70}ms` }, emo); root.append(e); setTimeout(() => e.remove(), 1600); } };
  SP.react = (mood) => {
    const m = MOODS[mood] || MOODS.happy, line = m[1][Math.floor(Math.random() * m[1].length)];
    root.dataset.mood = mood; say(line);
    if (mood === 'celebrate') { anim('jump'); burst(m[0]); } else if (mood === 'thinking') anim('think', 2600); else if (mood === 'wave' || mood === 'send' || mood === 'inbox') anim('wave'); else anim('nod', 900);
  };
  (SP.listeners.react = SP.listeners.react || []).push(SP.react);
  /* رمش العين وحركات خفيفة كل فترة */
  const blink = () => { root.classList.add('blink'); setTimeout(() => root.classList.remove('blink'), 160); setTimeout(blink, 2500 + Math.random() * 3500); };
  if (!reduced) setTimeout(blink, 1800);
  const tip = () => {
    if (document.hidden || panelOpen) return;
    const uid = SP.state.me, t = SP.today(), due = S().decks.filter((d) => d.ownerId === uid).flatMap((d) => d.cards).filter((c) => (c.due || t) <= t).length;
    const tasks = S().tasks.filter((x) => x.userId === uid && !x.done && x.due && x.due <= t).length, min = SP.studyMin(uid, t), goal = S().goalMin || 60;
    const tips = [due && `عندك ${due} بطاقة للمراجعة اليوم 🃏`, tasks && `${tasks} مهمة موعدها اليوم ✅`, min < goal && `باقي ${goal - min} دقيقة على هدفك اليوم ⏱️`, min >= goal && 'حققت هدف اليوم! 🌟', 'جرّب: افتح درساً في «دراسة» وظلّل المهم 🖍️', 'اسألني أي سؤال عن دروسك 💬', 'استراحة قصيرة تساعد على التركيز ☕', 'أستطيع كتابة أسئلة من أي ملف 📄❓'].filter(Boolean);
    say(tips[Math.floor(Math.random() * tips.length)], 5500); anim(Math.random() < 0.5 ? 'wave' : 'nod');
  };
  setInterval(tip, 75000);
  setTimeout(() => { const n = inbox().filter((m) => m.to === SP.state.me && !m.read).length; n ? SP.react('inbox') : SP.react('wave'); }, 1200);

  /* ---------- المحادثة ---------- */
  let panelOpen = false, ctl = null;
  const chats = () => ((S().chat = S().chat || {})[SP.state.me] = (S().chat[SP.state.me] || []));
  const panel = h('section', { class: 'm-panel', hidden: true, 'aria-label': 'محادثة سند' });
  const list = h('div', { class: 'm-list', 'aria-live': 'polite' }), input = h('textarea', { class: 'inp', id: 'sanad-input', rows: 1, placeholder: 'اكتب لسند…', 'aria-label': 'رسالة إلى سند' });
  const sendBtn = h('button', { class: 'btn', onclick: () => send() }, 'إرسال'), stopBtn = h('button', { class: 'btn ghost', hidden: true, onclick: () => ctl && ctl.abort() }, 'إيقاف');
  const face = h('span', { class: 'm-face' }); face.innerHTML = OWL;
  const SUGG = ['ما مهامي اليوم؟', 'اختبرني بسؤال', 'لخّص آخر ملاحظاتي', 'كيف أنظّم وقتي للمذاكرة؟'];
  panel.append(h('header', {}, face, h('div', {}, h('b', {}, 'سند'), h('div', { class: 'sub', style: { margin: 0, fontSize: '.8rem' } }, 'مساعدك في الدراسة')),
    h('button', { class: 'btn ghost sm', 'aria-label': 'مسح المحادثة', onclick: () => { chats().length = 0; SP.save(); drawChat(); } }, 'مسح'), h('button', { class: 'btn ghost sm', 'aria-label': 'إغلاق', onclick: () => toggle(false) }, '✕')),
    list, h('div', { class: 'm-sugg' }, SUGG.map((s) => h('button', { class: 'chip', onclick: () => send(s) }, s))), h('div', { class: 'm-input' }, input, sendBtn, stopBtn));
  document.body.append(panel);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  const toggle = (on = !panelOpen) => { panelOpen = on; panel.hidden = !on; root.classList.toggle('open', on); bubble.hidden = true; if (on) { drawChat(); input.focus(); } else fig.focus(); };
  fig.addEventListener('click', () => toggle());
  const msgEl = (m) => h('div', { class: 'm-msg ' + (m.role === 'user' ? 'me' : 'bot') }, m.text);
  function drawChat() {
    const c = chats();
    list.replaceChildren(...(c.length ? c.map(msgEl) : [h('div', { class: 'm-msg bot' }, `أهلاً ${SP.me().name}! أنا سند 🦉 مساعدك في الدراسة. اسألني عن دروسك، أو اطلب مني أختبرك، أو أذكّرك بمهامك.`)]));
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
    const RULES = `أنت «سند»، بومة لطيفة ومساعد دراسة داخل منصة دراسة عربية. تكلّم بالعربية بلهجة ودودة وواضحة، بجمل قصيرة، واستخدم إيموجي واحداً أو اثنين في كل رد بشكل طبيعي. ساعد في شرح الدروس، اختبار المستخدم بأسئلة، تنظيم الوقت، والتحفيز. لا تخترع معلومات عن ملفات لم تقرأها. ابدأ ردك دائماً بوسم المزاج بين قوسين مربعين واحد فقط من: [happy] [celebrate] [encourage] [thinking] [wave] ثم الرد. بيانات المستخدم الآن: ${JSON.stringify(brief())}`;
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
  SP.on && (SP.listeners.route = SP.listeners.route || []).push(() => { updateBell(); if (panelOpen) drawChat(); });
  updateBell();
  SP._ai = { offlineQuestions, normalize, offline, toggle, send };
})();
