/* أدوات المساعد: يقرأ كل أعمال المستخدم ويعدّل عليها حسب طلبه، مع سجل لما فعله وتراجع بنقرة */
(function () {
  const SP = window.SP, S = () => SP.state, me = () => SP.state.me;
  const str = (v, n = 8000) => String(v == null ? '' : v).slice(0, n);
  const fail = (m) => { throw new Error(m); };
  const KINDS = ['note', 'document', 'file', 'deck', 'quiz', 'task', 'collection', 'flow', 'annotated', 'class'];

  /* ---------- ما يخص المستخدم ---------- */
  const mine = {
    note: () => S().notes.filter((n) => n.ownerId === me()),
    document: () => (S().wdocs || []).filter((d) => d.ownerId === me()),
    file: () => S().files.filter((f) => (f.classId ? SP.canSeeClass(f.classId) : f.ownerId === me())),
    deck: () => S().decks.filter((d) => d.ownerId === me() || (d.classId && SP.canSeeClass(d.classId))),
    quiz: () => S().quizzes.filter((q) => (q.classId ? SP.canSeeClass(q.classId) : q.by === me())),
    task: () => S().tasks.filter((t) => t.userId === me()),
    collection: () => (S().cols || []).filter((c) => c.ownerId === me()),
    flow: () => (S().flows || []).filter((f) => f.ownerId === me()),
    annotated: () => (S().docs || []).filter((d) => d.ownerId === me()),
    class: () => SP.myClasses(),
  };
  const canEdit = { deck: (d) => d.ownerId === me(), quiz: (q) => q.by === me(), file: (f) => f.ownerId === me() };
  const get = (kind, id) => { if (!mine[kind]) fail('نوع غير معروف: ' + kind); const x = mine[kind]().find((i) => i.id === id); if (!x) fail(`لم أجد ${kind} بالمعرّف ${id}. استخدم list_my_work أولاً.`); return x; };
  const title = (kind, x) => x.title || x.name || x.text || '';

  /* ---------- السجل والتراجع ---------- */
  let turn = null; const undo = [];
  SP.aiBeginTurn = () => { turn = { acts: [], snap: null }; };
  SP.aiTurnCount = () => (turn ? turn.acts.length : 0);
  SP.aiEndTurn = () => { const t = turn; turn = null; if (t && t.snap) { undo.push(t.snap); while (undo.length > 10) undo.shift(); } return t ? t.acts : []; };
  const snapshot = async (idbKey) => {
    if (!turn) SP.aiBeginTurn();
    if (!turn.snap) turn.snap = { id: SP.uid(), state: JSON.stringify(SP.state), idb: {} };
    if (idbKey && !(idbKey in turn.snap.idb)) turn.snap.idb[idbKey] = (await SP.idb.get(idbKey)) ?? null;
    return turn.snap.id;
  };
  const log = (icon, text, route) => { if (turn) turn.acts.push({ icon, text, route, undo: turn.snap && turn.snap.id }); };
  SP.aiCanUndo = (id) => undo.length > 0 && undo[undo.length - 1].id === id; // التراجع لآخر تغييرات فقط حتى لا يمحو ما فعلته بعدها
  SP.aiUndo = async (id) => {
    const i = undo.findIndex((u) => u.id === id); if (i < 0) return false;
    const [u] = undo.splice(i); const keepMe = SP.state.me, keepChat = SP.state.chat, keepMascot = SP.state.mascot, st = JSON.parse(u.state);
    Object.keys(SP.state).forEach((k) => delete SP.state[k]); Object.assign(SP.state, st, { me: keepMe, chat: keepChat, mascot: keepMascot });
    for (const [k, v] of Object.entries(u.idb)) await (v == null ? SP.idb.del(k) : SP.idb.put(k, v));
    SP.save(); SP.refresh(); return true;
  };
  const done = () => { SP.save(); setTimeout(() => SP.refresh(), 0); };
  const ask = (q) => (SP.confirm ? SP.confirm(q) : Promise.resolve(confirm(q)));

  /* ---------- قراءة ---------- */
  const htmlText = (html) => { const d = document.createElement('div'); d.innerHTML = SP.sanitizeHTML ? SP.sanitizeHTML(html || '') : ''; return d.innerText || d.textContent || ''; };
  const md = (t) => (SP._writer ? SP._writer.fromMd(str(t, 60000)) : `<p>${str(t, 60000)}</p>`);
  async function read(kind, id) {
    const x = get(kind, id);
    switch (kind) {
      case 'note': return { id, title: x.title, body: x.body, tags: x.tags, pinned: x.pinned, images: (x.images || []).length };
      case 'document': { const html = await SP.idb.get('wdoc:' + id); return { id, name: x.name, words: x.words, text: htmlText(html).slice(0, 12000) }; }
      case 'file': { const b = await SP.idb.get(id); return { id, name: x.name, kind: x.kind, class: x.classId ? SP.className(x.classId) : '', text: b && SP.fileText ? (await SP.fileText(b, x.mime, x.name)).slice(0, 12000) : '(لا يمكن قراءة نص هذا الملف)' }; }
      case 'deck': return { id, name: x.name, cards: x.cards.map((c) => ({ id: c.id, q: c.q, a: c.a, box: c.box || 1 })) };
      case 'quiz': return { id, title: x.title, class: x.classId ? SP.className(x.classId) : '', questions: x.questions.map((q) => ({ type: q.type, q: q.q, options: q.options, answer: q.answer })), myBest: (SP.bestResults(id).find((r) => r.userId === me()) || {}).score };
      case 'task': return x;
      case 'collection': return { id, name: x.name, items: x.items.map((i) => ({ id: i.id, kind: i.kind, text: i.text || i.title || '', note: i.note || '', done: !!i.done })) };
      case 'flow': return { id, name: x.name, progress: SP.flowProgress ? SP.flowProgress(x) : null, steps: x.nodes.map((n) => ({ id: n.id, type: n.t, title: n.title, status: SP._flow ? SP._flow.status(x, n) : n.status })), links: x.edges.map((e) => [e.from, e.to]) };
      case 'annotated': return { id, name: x.name, pages: x.pages.length, texts: x.pages.flatMap((p, i) => p.a.filter((a) => a.v).map((a) => `ص${i + 1}: ${a.v}`)).slice(0, 80) };
      case 'class': return { id, name: x.name, subject: x.subject, teacher: SP.user(x.teacherId).name, iAmTeacher: x.teacherId === me(), posts: (S().classItems || []).filter((i) => i.classId === id && i.type !== 'msg').slice(-25).map((i) => ({ id: i.id, type: i.type, title: i.title || '', text: str(i.text || i.desc || '', 600), date: i.date || i.due || '' })) };
    }
  }
  const overview = (kind) => {
    const ks = kind ? [kind] : KINDS, out = {};
    ks.forEach((k) => { if (!mine[k]) return; out[k] = mine[k]().slice(0, 60).map((x) => ({ id: x.id, title: str(title(k, x), 80), ...(k === 'task' ? { done: x.done, due: x.due } : {}), ...(k === 'note' && x.pinned ? { pinned: true } : {}), ...(k === 'deck' ? { cards: x.cards.length } : {}), ...(k === 'class' ? { mode: chatOf(x).students ? 'مجموعة' : 'قناة', i_can_post: canPost(x), i_am_teacher: x.teacherId === me() } : {}), ...(k === 'file' ? { type: (x.mime || '').split('/').pop(), editable_pdf: x.src != null } : {}), ...(k === 'quiz' ? { questions: x.questions.length } : {}), ...(k === 'flow' && SP.flowProgress ? { progress: SP.flowProgress(x) + '%' } : {}) })); });
    return out;
  };
  async function search(query) {
    const q = str(query, 200).toLowerCase(); if (!q) fail('اكتب كلمة للبحث'); const hit = (s) => String(s || '').toLowerCase().includes(q), out = [];
    mine.note().forEach((n) => hit(n.title + ' ' + n.body + ' ' + n.tags.join(' ')) && out.push({ kind: 'note', id: n.id, title: n.title }));
    for (const d of mine.document()) { const t = htmlText(await SP.idb.get('wdoc:' + d.id)); if (hit(d.name + ' ' + t)) out.push({ kind: 'document', id: d.id, title: d.name }); }
    mine.file().forEach((f) => hit(f.name + ' ' + (f.desc || '') + ' ' + f.tags.join(' ')) && out.push({ kind: 'file', id: f.id, title: f.name }));
    mine.deck().forEach((d) => (hit(d.name) || d.cards.some((c) => hit(c.q + ' ' + c.a))) && out.push({ kind: 'deck', id: d.id, title: d.name }));
    mine.quiz().forEach((x) => (hit(x.title) || x.questions.some((y) => hit(y.q))) && out.push({ kind: 'quiz', id: x.id, title: x.title }));
    mine.task().forEach((t) => hit(t.text) && out.push({ kind: 'task', id: t.id, title: t.text }));
    mine.collection().forEach((c) => (hit(c.name) || c.items.some((i) => hit((i.text || '') + (i.title || '') + (i.note || '')))) && out.push({ kind: 'collection', id: c.id, title: c.name }));
    (S().classItems || []).filter((i) => SP.canSeeClass(i.classId) && hit((i.title || '') + ' ' + (i.text || ''))).slice(0, 10).forEach((i) => out.push({ kind: 'class_post', id: i.id, class: SP.className(i.classId), title: i.title || str(i.text, 60) }));
    return out.slice(0, 30);
  }

  /* ---------- تحويل الأسئلة ---------- */
  const toQ = (x) => {
    const type = ['mcq', 'tf', 'short'].includes(x.type) ? x.type : Array.isArray(x.options) && x.options.length ? 'mcq' : 'short';
    if (type === 'tf') return { id: SP.uid(), type, q: str(x.q, 500), options: ['صح', 'خطأ'], answer: x.answer === true || x.answer === 0 || x.answer === 'صح' ? 0 : 1 };
    if (type === 'short') return { id: SP.uid(), type, q: str(x.q, 500), options: [], answer: str(x.answer, 200) };
    const options = (x.options || []).map((o) => str(o, 200)).slice(0, 6); if (options.length < 2) fail('سؤال الاختيار يحتاج خيارين على الأقل');
    const a = Number.isInteger(x.answer) ? x.answer : options.indexOf(String(x.answer)); return { id: SP.uid(), type, q: str(x.q, 500), options, answer: a >= 0 && a < options.length ? a : 0 };
  };

  /* ---------- مساعدات PDF ---------- */
  const pdfHtml = (src) => { const tbl = (block) => { const rows = block.trim().split('\n').filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map((l) => l.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => c.trim())); return '<table>' + rows.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + c.replace(/[<>&]/g, '') + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>'; };
    return src.split(/\n{2,}/).map((b) => (/^\s*\|.*\|\s*$/m.test(b) && b.trim().split('\n').every((l) => l.trim().startsWith('|')) ? tbl(b) : md(b))).join(''); };
  const pageCount = async (blob) => { try { return (await window.PDFLib.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })).getPageCount(); } catch (e) { return 1; } };
  async function deskFor(id) {
    let d = (S().docs || []).find((y) => y.id === id && y.ownerId === me()); if (d) return d;
    const f = mine.file().find((y) => y.id === id); if (!f) fail('لم أجد الملف. استخدم list_my_work.');
    if (!/pdf|image/.test(f.mime || '')) fail('يمكن الكتابة على ملفات PDF والصور فقط');
    d = f.deskId && (S().docs || []).find((y) => y.id === f.deskId && y.ownerId === me()); if (d) return d;
    const b = await SP.idb.get(f.id); if (!b) fail('الملف غير موجود في هذا المتصفح');
    d = await SP.deskAdd(new File([b], f.name, { type: f.mime || b.type })); if (!d) fail('تعذّر فتح الملف'); turn.snap.idb[d.fileId] = null; if (f.ownerId === me()) f.deskId = d.id; return d;
  }
  async function fileBlob(id) {
    const d = (S().docs || []).find((y) => y.id === id && y.ownerId === me());
    if (d) return { blob: await SP.deskFlatten(d), name: d.name + '.pdf' };
    const f = get('file', id), dd = f.deskId && (S().docs || []).find((y) => y.id === f.deskId);
    if (dd && dd.pages.some((p) => p.a.length)) return { blob: await SP.deskFlatten(dd), name: f.name.replace(/\.[^.]+$/, '') + '.pdf' };
    const b = await SP.idb.get(f.id); if (!b) fail('الملف غير موجود'); return { blob: b, name: f.name };
  }

  /* النشر في القنوات (محادثات الصفوف) أو للأشخاص */
  const chatOf = (c) => Object.assign({ students: true }, c.chat || {});
  const canPost = (c) => c.teacherId === me() || (c.memberIds.includes(me()) && chatOf(c).students);
  const findClass = (q) => { const k = String(q).trim(); return SP.myClasses().find((c) => c.id === k || c.name === k) || SP.myClasses().find((c) => c.name.includes(k) || k.includes(c.name) || (c.subject || '').includes(k)); };
  async function publish(blob, name, x) {
    const want = [...(x.channels || []), ...(x.class_id ? [x.class_id] : [])].map(String), all = want.some((w) => /^(all|الكل|كل)/i.test(w.trim()));
    const chans = all ? SP.myClasses().filter(canPost) : want.map(findClass).filter(Boolean);
    const blocked = (all ? [] : chans.filter((c) => !canPost(c))), ok = chans.filter(canPost);
    const missing = all ? [] : want.filter((w) => !findClass(w));
    const people = (x.to || []).map((nm) => S().users.find((u) => u.id !== me() && (u.name === nm || u.name.includes(String(nm)) || String(nm).includes(u.name.replace(/^د\.\s*/, ''))))).filter(Boolean);
    if (!ok.length && !people.length) fail([missing.length && 'لم أجد هذه الصفوف: ' + missing.join('، '), blocked.length && 'هذه قنوات ينشر فيها الأستاذ فقط: ' + blocked.map((c) => c.name).join('، '), !want.length && !people.length && 'حدد القنوات أو الأشخاص'].filter(Boolean).join('. ') || 'لا يوجد مكان يمكن النشر فيه');
    const where = [...ok.map((c) => '📣 ' + c.name), ...people.map((u) => u.name)].join('، ');
    if (!(await ask(`المساعد يريد نشر «${name}» في: ${where}. موافق؟`))) return 'رفض المستخدم النشر';
    await snapshot(); const msg = str(x.message, 600), mime = blob.type || 'application/pdf';
    for (const c of ok) {
      const fid = SP.uid(); await SP.idb.put(fid, blob); turn.snap.idb[fid] = null;
      if (c.teacherId === me()) { S().files.push({ id: fid, ownerId: me(), name, mime, size: blob.size, tags: [], color: '', star: false, stickers: [], kind: 'handout', classId: c.id, added: Date.now(), desc: msg });
        (S().classItems = S().classItems || []).push({ id: SP.uid(), classId: c.id, by: me(), type: 'explain', title: name.replace(/\.pdf$/i, ''), ts: Date.now(), images: [], fileId: fid, fname: name, fmime: mime, text: msg || 'ملف جديد 📕' }); }
      else (S().classItems = S().classItems || []).push({ id: SP.uid(), classId: c.id, by: me(), type: 'msg', title: '', text: msg || '📕 ' + name, ts: Date.now(), fileId: fid, fname: name, fmime: mime });
    }
    for (const u of people) { const fid = SP.uid(); await SP.idb.put(fid, blob); turn.snap.idb[fid] = null; S().files.push({ id: fid, ownerId: u.id, name, mime, size: blob.size, tags: ['مستلم'], color: '', star: false, stickers: [], kind: 'file', classId: '', added: Date.now(), desc: ('من ' + SP.me().name + (msg ? ': ' + msg : '')).slice(0, 500) });
      (S().inbox = S().inbox || []).push({ id: SP.uid(), from: me(), to: u.id, fileId: fid, name, mime, note: msg, ts: Date.now(), read: false }); }
    done(); SP.updateBell && SP.updateBell(); log('📤', `نشرت «${name}» في ${where}`, ok.length === 1 ? 'classes/' + ok[0].id : '');
    return { ok: true, published_to: where, skipped: [...blocked.map((c) => c.name + ' (قناة للأستاذ فقط)'), ...missing.map((m) => m + ' (غير موجود)')] };
  }

  /* ---------- الأدوات ---------- */
  const T = (name, description, properties, required, execute) => ({ name, description, inputSchema: { type: 'object', properties, required }, execute: async (a) => { try { const r = await execute(a || {}); const js = typeof r === 'string' ? r : JSON.stringify(r); return new Blob([js]).size > 30000 ? js.slice(0, 13000) + ' …(اقتُطع لطوله، اطلب جزءاً محدداً)' : r; } catch (e) { return 'خطأ: ' + (e.message || e); } } });
  const S_ = { type: 'string' }, N_ = { type: 'number' }, B_ = { type: 'boolean' }, KIND = { type: 'string', enum: KINDS };

  SP.aiTools = () => [
    T('list_my_work', 'يعرض كل أعمال المستخدم مع معرّفاتها: الملاحظات، المستندات، الملفات، البطاقات، الفويزات، المهام، المجموعات، مسارات الدراسة، الملفات المعلّق عليها، والصفوف. مرّر kind لنوع واحد.', { kind: KIND }, [], ({ kind }) => overview(kind)),
    T('search_my_work', 'يبحث بكلمة في كل أعمال المستخدم (حتى داخل نص المستندات والبطاقات والأسئلة ومنشورات الصفوف).', { query: S_ }, ['query'], ({ query }) => search(query)),
    T('read_item', 'يقرأ محتوى عنصر كاملاً. اقرأ العنصر دائماً قبل تعديله.', { kind: KIND, id: S_ }, ['kind', 'id'], ({ kind, id }) => read(kind, id)),

    T('create_note', 'ينشئ ملاحظة جديدة.', { title: S_, body: S_, tags: { type: 'array', items: S_ }, pinned: B_ }, ['title', 'body'], async ({ title: t, body, tags, pinned }) => {
      await snapshot(); const n = { id: SP.uid(), ownerId: me(), title: str(t, 120) || 'ملاحظة', body: str(body), color: SP.COLORS[0], pinned: !!pinned, tags: (tags || ['من المساعد']).map((x) => str(x, 30)), classId: '', stickers: [], images: [], updated: Date.now() };
      S().notes.push(n); done(); log('📝', `أنشأت ملاحظة «${n.title}»`, 'notes'); return { ok: true, id: n.id }; }),
    T('update_note', 'يعدّل ملاحظة: العنوان أو النص (استبدال كامل) أو إضافة نص في آخرها أو الوسوم أو التثبيت.', { id: S_, title: S_, body: S_, append: S_, tags: { type: 'array', items: S_ }, pinned: B_ }, ['id'], async (a) => {
      const n = get('note', a.id); await snapshot();
      if (a.title != null) n.title = str(a.title, 120); if (a.body != null) n.body = str(a.body); if (a.append) n.body = (n.body ? n.body + '\n' : '') + str(a.append); if (a.tags) n.tags = a.tags.map((x) => str(x, 30)); if (a.pinned != null) n.pinned = !!a.pinned;
      n.updated = Date.now(); done(); log('✏️', `عدّلت ملاحظة «${n.title}»`, 'notes'); return { ok: true }; }),

    T('create_document', 'ينشئ مستنداً جديداً في «المستندات» من نص Markdown (عناوين ## ونقاط - و **عريض**).', { name: S_, markdown: S_ }, ['name', 'markdown'], async ({ name, markdown }) => {
      await snapshot(); const d = await SP.createWriterDoc(str(name, 120) || 'مستند', SP.sanitizeHTML(md(markdown))); d.words = (str(markdown, 60000).match(/[\p{L}\p{N}]+/gu) || []).length; turn.snap.idb['wdoc:' + d.id] = null; done(); log('📄', `أنشأت مستند «${d.name}»`, 'writer/' + d.id); return { ok: true, id: d.id }; }),
    T('edit_document', 'يعدّل مستنداً: mode=replace_all يستبدل المحتوى كله، append يضيف في الآخر، prepend في الأول، replace_text يستبدل نصاً محدداً (find) بنص جديد (content كنص عادي). يقبل content بصيغة Markdown، وrename لتغيير الاسم.', { id: S_, mode: { type: 'string', enum: ['replace_all', 'append', 'prepend', 'replace_text'] }, content: S_, find: S_, rename: S_ }, ['id'], async (a) => {
      const d = get('document', a.id), key = 'wdoc:' + d.id; await snapshot(key); let html = (await SP.idb.get(key)) || '';
      if (a.mode === 'replace_all') html = md(a.content); else if (a.mode === 'append') html += md(a.content); else if (a.mode === 'prepend') html = md(a.content) + html;
      else if (a.mode === 'replace_text') { if (!a.find) fail('حدد النص المطلوب استبداله في find'); const box = document.createElement('div'); box.innerHTML = SP.sanitizeHTML(html); let n = 0; const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); const ns = []; while (w.nextNode()) ns.push(w.currentNode); ns.forEach((t) => { const p = t.data.split(a.find); if (p.length > 1) { n += p.length - 1; t.data = p.join(str(a.content)); } }); if (!n) fail('لم أجد النص المطلوب'); html = box.innerHTML; }
      if (a.mode) { html = SP.sanitizeHTML(html); await SP.idb.put(key, html); d.words = (htmlText(html).match(/[\p{L}\p{N}]+/gu) || []).length; }
      if (a.rename) d.name = str(a.rename, 120); d.updated = Date.now(); done(); log('✏️', `عدّلت مستند «${d.name}»`, 'writer/' + d.id); return { ok: true }; }),

    T('add_task', 'يضيف مهمة.', { text: S_, due: { type: 'string', description: 'YYYY-MM-DD اختياري' } }, ['text'], async ({ text, due }) => {
      await snapshot(); const t = { id: SP.uid(), userId: me(), text: str(text, 200), done: false, due: /^\d{4}-\d{2}-\d{2}$/.test(String(due)) ? String(due) : '', classId: '', prio: 1 }; if (!t.text) fail('نص فارغ');
      S().tasks.push(t); done(); log('✅', `أضفت مهمة «${t.text}»`, 'tasks'); return { ok: true, id: t.id }; }),
    T('update_task', 'يعدّل مهمة: النص أو الموعد أو يعلّمها منجزة.', { id: S_, text: S_, due: S_, done: B_ }, ['id'], async (a) => {
      const t = get('task', a.id); await snapshot(); if (a.text != null) t.text = str(a.text, 200); if (a.due != null) t.due = /^\d{4}-\d{2}-\d{2}$/.test(String(a.due)) ? String(a.due) : ''; if (a.done != null) t.done = !!a.done;
      done(); log(t.done ? '☑️' : '✏️', `${a.done ? 'أنجزت' : 'عدّلت'} مهمة «${t.text}»`, 'tasks'); return { ok: true }; }),

    T('create_deck', 'ينشئ مجموعة بطاقات مراجعة.', { name: S_, cards: { type: 'array', items: { type: 'object', properties: { q: S_, a: S_ }, required: ['q', 'a'] } } }, ['name', 'cards'], async ({ name, cards }) => {
      await snapshot(); const d = { id: SP.uid(), ownerId: me(), classId: '', name: str(name, 120), cards: (cards || []).slice(0, 200).map((c) => ({ id: SP.uid(), q: str(c.q, 500), a: str(c.a, 500), box: 1, due: SP.today() })) };
      S().decks.push(d); done(); log('🃏', `أنشأت بطاقات «${d.name}» (${d.cards.length})`, 'cards/' + d.id); return { ok: true, id: d.id }; }),
    T('edit_deck', 'يضيف بطاقات لمجموعة، أو يعدّل بطاقة (card_id مع q/a)، أو يحذف بطاقة (remove_card_id)، أو يغيّر الاسم.', { id: S_, add: { type: 'array', items: { type: 'object', properties: { q: S_, a: S_ } } }, card_id: S_, q: S_, a: S_, remove_card_id: S_, rename: S_ }, ['id'], async (x) => {
      const d = get('deck', x.id); if (!canEdit.deck(d)) fail('هذه البطاقات ليست لك'); await snapshot();
      (x.add || []).forEach((c) => d.cards.push({ id: SP.uid(), q: str(c.q, 500), a: str(c.a, 500), box: 1, due: SP.today() }));
      if (x.card_id) { const c = d.cards.find((y) => y.id === x.card_id); if (!c) fail('لم أجد البطاقة'); if (x.q != null) c.q = str(x.q, 500); if (x.a != null) c.a = str(x.a, 500); }
      if (x.remove_card_id) d.cards = d.cards.filter((c) => c.id !== x.remove_card_id); if (x.rename) d.name = str(x.rename, 120);
      done(); log('🃏', `عدّلت بطاقات «${d.name}»`, 'cards/' + d.id); return { ok: true, cards: d.cards.length }; }),

    T('create_quiz', 'ينشئ فويزاً. لكل سؤال: type (mcq|tf|short)، q، options للاختيار، answer (رقم الخيار الصحيح من 0، أو true/false لصح وخطأ، أو نص للقصير). للأستاذ: class_id لينشره لصفه.', { title: S_, class_id: S_, questions: { type: 'array', items: { type: 'object', properties: { type: S_, q: S_, options: { type: 'array', items: S_ }, answer: {} } } } }, ['title', 'questions'], async ({ title: t, class_id, questions }) => {
      if (class_id) { const c = SP.classById(class_id); if (!c || c.teacherId !== me()) fail('لا يمكنك النشر في هذا الصف'); }
      const qs = (questions || []).slice(0, 60).map(toQ); if (!qs.length) fail('لا أسئلة'); await snapshot();
      const z = { id: SP.uid(), classId: class_id || '', by: me(), title: str(t, 120), order: S().quizzes.length, timeLimit: 0, created: Date.now(), questions: qs }; S().quizzes.push(z);
      done(); log('❓', `أنشأت فويز «${z.title}» (${qs.length} سؤال)`, 'quizzes'); return { ok: true, id: z.id }; }),
    T('edit_quiz', 'يضيف أسئلة لفويز أنشأه المستخدم، أو يحذف سؤالاً بترتيبه (remove_index من 0)، أو يغيّر العنوان.', { id: S_, add: { type: 'array', items: { type: 'object' } }, remove_index: N_, rename: S_ }, ['id'], async (x) => {
      const z = get('quiz', x.id); if (!canEdit.quiz(z)) fail('هذا الفويز ليس لك'); await snapshot();
      (x.add || []).forEach((q) => z.questions.push(toQ(q))); if (Number.isInteger(x.remove_index)) z.questions.splice(x.remove_index, 1); if (x.rename) z.title = str(x.rename, 120);
      done(); log('❓', `عدّلت فويز «${z.title}»`, 'quizzes'); return { ok: true, questions: z.questions.length }; }),

    T('edit_collection', 'يعدّل مجموعة في «مساحتي»: يضيف ملاحظة أو عنواناً (add_note / add_heading)، أو يعلّم عنصراً منجزاً (item_id + done)، أو يضيف ملاحظة شخصية لعنصر (item_id + note). أو ينشئ مجموعة جديدة إن لم تمرر id (مع name).', { id: S_, name: S_, add_note: S_, add_heading: S_, item_id: S_, done: B_, note: S_ }, [], async (x) => {
      await snapshot(); let c;
      if (!x.id) { c = { id: SP.uid(), ownerId: me(), name: str(x.name, 80) || 'مجموعتي', emoji: '📚', color: '#1F4E99', created: Date.now(), updated: Date.now(), items: [] }; (S().cols = S().cols || []).push(c); } else c = get('collection', x.id);
      if (x.add_heading) c.items.push({ id: SP.uid(), kind: 'heading', text: str(x.add_heading, 120) }); if (x.add_note) c.items.push({ id: SP.uid(), kind: 'note', text: str(x.add_note, 2000), done: false });
      if (x.item_id) { const i = c.items.find((y) => y.id === x.item_id); if (!i) fail('لم أجد العنصر'); if (x.done != null) i.done = !!x.done; if (x.note != null) i.note = str(x.note, 1000); }
      c.updated = Date.now(); done(); log('🗂️', `${x.id ? 'عدّلت' : 'أنشأت'} مجموعة «${c.name}»`, 'space/' + c.id); return { ok: true, id: c.id }; }),

    T('edit_flow', 'يعدّل مسار دراسة: يضيف خطوة (add_step بنوع read|summary|cards|quiz|focus|ask|check|exam|sticky مع title، وafter_step_id لربطها بعد خطوة)، أو يغيّر حالة خطوة (step_id + status todo|doing|done). بدون id ينشئ مساراً جديداً بالاسم name.', { id: S_, name: S_, add_step: S_, title: S_, after_step_id: S_, step_id: S_, status: { type: 'string', enum: ['todo', 'doing', 'done'] } }, [], async (x) => {
      await snapshot(); let f;
      if (!x.id) { f = { id: SP.uid(), ownerId: me(), name: str(x.name, 80) || 'مساري', created: Date.now(), updated: Date.now(), view: { x: 0, y: 0, z: 0.8 }, fit: true, nodes: [], edges: [] }; (S().flows = S().flows || []).push(f); } else f = get('flow', x.id);
      if (x.add_step) { const NT = SP._flow ? SP._flow.NT : {}; if (!NT[x.add_step]) fail('نوع خطوة غير معروف'); const prev = x.after_step_id && f.nodes.find((n) => n.id === x.after_step_id); const maxX = Math.max(0, ...f.nodes.map((n) => n.x));
        const n = { id: SP.uid(), t: x.add_step, x: prev ? prev.x - 260 : maxX + 260, y: prev ? prev.y : 160, title: str(x.title, 80) || NT[x.add_step].label, min: NT[x.add_step].min || 0, fresh: true }; f.nodes.push(n); if (prev) f.edges.push({ id: SP.uid(), from: prev.id, to: n.id }); }
      if (x.step_id) { const n = f.nodes.find((y) => y.id === x.step_id); if (!n) fail('لم أجد الخطوة'); if (x.status) n.status = x.status; if (x.title) n.title = str(x.title, 80); }
      f.updated = Date.now(); done(); log('🧭', `${x.id ? 'عدّلت' : 'أنشأت'} مسار «${f.name}»`, 'flow/' + f.id); return { ok: true, id: f.id }; }),

    T('post_to_class', 'للأستاذ فقط: ينشر في صفه تبليغاً (notice) أو شرحاً (explain) أو موعد امتحان (exam مع date YYYY-MM-DD وtime) أو واجباً (homework مع due).', { class_id: S_, type: { type: 'string', enum: ['notice', 'explain', 'exam', 'homework'] }, title: S_, text: S_, date: S_, time: S_, due: S_, important: B_ }, ['class_id', 'type', 'title'], async (x) => {
      const c = SP.classById(x.class_id); if (!c || c.teacherId !== me()) fail('لست أستاذ هذا الصف'); await snapshot();
      const it = { id: SP.uid(), classId: c.id, by: me(), type: x.type, title: str(x.title, 120), ts: Date.now(), text: str(x.text, 4000), important: !!x.important, images: [], fileId: '' };
      if (x.type === 'exam') { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date))) fail('اكتب تاريخ الامتحان YYYY-MM-DD'); Object.assign(it, { date: x.date, time: /^\d{2}:\d{2}$/.test(String(x.time)) ? x.time : '09:00', kind: 'امتحان', place: '' }); }
      if (x.type === 'homework') Object.assign(it, { due: /^\d{4}-\d{2}-\d{2}$/.test(String(x.due)) ? x.due : '', max: 10, desc: str(x.text, 4000) });
      (S().classItems = S().classItems || []).push(it); done(); log('📢', `نشرت في «${c.name}»: ${it.title}`, 'classes/' + c.id); return { ok: true, id: it.id }; }),

    T('create_pdf', 'ينشئ ملف PDF جديداً (يدعم العربية) من نص Markdown: عناوين #/##، نقاط -، جداول |، و**عريض**. يُحفظ في «الملفات» ويُفتح في «ملفات للتعليق». اكتب محتوى كاملاً ومنظماً. لنشره مباشرة في قنوات الصفوف مرّر channels (أسماء الصفوف أو "all") وmessage.', { title: S_, markdown: S_, open: B_, channels: { type: 'array', items: S_ }, message: S_ }, ['title', 'markdown'], async ({ title: t, markdown, open, channels, message }) => {
      const name = str(t, 100) || 'ملف'; await snapshot(); const src = str(markdown, 60000), blob = await SP.makePdf(pdfHtml(src), { title: name }), fid = SP.uid();
      await SP.idb.put(fid, blob); turn.snap.idb[fid] = null;
      const f = { id: fid, ownerId: me(), name: name + '.pdf', mime: 'application/pdf', size: blob.size, tags: ['من المساعد'], color: '', star: false, stickers: [], kind: 'file', classId: '', added: Date.now(), desc: '', src, title: name };
      S().files.push(f); const d = SP.deskAdd ? await SP.deskAdd(new File([blob], f.name, { type: 'application/pdf' })) : null; if (d) { f.deskId = d.id; turn.snap.idb[d.fileId] = null; }
      done(); log('📕', `أنشأت PDF «${f.name}» (${await pageCount(blob)} صفحة)`, d ? 'desk/' + d.id : 'files'); if (open && d && !(channels || []).length) setTimeout(() => SP.go('desk/' + d.id), 300); const pub = (channels || []).length ? await publish(blob, f.name, { channels, message }) : null; return { ok: true, file_id: fid, annotated_id: d && d.id, published: pub }; }),
    T('edit_pdf', 'يعدّل محتوى PDF أنشأه المساعد ويعيد بناءه: mode=replace_all أو append أو prepend (content بصيغة Markdown) أو replace_text (find ← content). لملف PDF مرفوع من الخارج استخدم annotate_pdf.', { file_id: S_, mode: { type: 'string', enum: ['replace_all', 'append', 'prepend', 'replace_text'] }, content: S_, find: S_, rename: S_ }, ['file_id', 'mode'], async (x) => {
      const f = get('file', x.file_id); if (f.ownerId !== me()) fail('هذا الملف ليس لك'); if (f.src == null) fail('هذا PDF مرفوع وليس له مصدر قابل للتعديل؛ استخدم annotate_pdf للكتابة عليه');
      let src = f.src; const c = str(x.content, 60000);
      if (x.mode === 'replace_all') src = c; else if (x.mode === 'append') src += '\n\n' + c; else if (x.mode === 'prepend') src = c + '\n\n' + src; else { if (!x.find || !src.includes(x.find)) fail('لم أجد النص المطلوب'); src = src.split(String(x.find)).join(c); }
      if (x.rename) { f.title = str(x.rename, 100); f.name = f.title + '.pdf'; }
      await snapshot(f.id); const blob = await SP.makePdf(pdfHtml(src), { title: f.title || f.name.replace(/\.pdf$/i, '') }); await SP.idb.put(f.id, blob); f.src = src; f.size = blob.size; f.added = Date.now();
      const d = f.deskId && (S().docs || []).find((y) => y.id === f.deskId); const n = await pageCount(blob);
      if (d) { await snapshot(d.fileId); await SP.idb.put(d.fileId, blob); while (d.pages.length < n) d.pages.push({ a: [] }); d.pages.length = n; d.name = f.name.replace(/\.pdf$/i, ''); d.updated = Date.now(); }
      done(); log('✏️', `عدّلت PDF «${f.name}» (${n} صفحة)`, d ? 'desk/' + d.id : 'files'); return { ok: true, pages: n }; }),
    T('annotate_pdf', 'يكتب على أي PDF (حتى المرفوع من الخارج) دون تغيير أصله: نص ظاهر على الصفحة (style=text) أو ملاحظة لاصقة (style=note). target_id معرّف ملف أو ملف معلّق عليه. page من 1. position: top أو middle أو bottom.', { target_id: S_, page: N_, text: S_, style: { type: 'string', enum: ['text', 'note'] }, position: { type: 'string', enum: ['top', 'middle', 'bottom'] }, color: S_ }, ['target_id', 'text'], async (x) => {
      await snapshot(); const d = await deskFor(x.target_id), pi = Math.max(1, Math.round(+x.page || 1)) - 1; if (!d.pages[pi]) fail(`الملف فيه ${d.pages.length} صفحة فقط`);
      const pg = d.pages[pi], base = { top: 0.05, middle: 0.47, bottom: 0.88 }[x.position] || 0.05, k = pg.a.filter((a) => a.ai && a.pos === (x.position || 'top')).length, y = Math.min(0.95, base + k * 0.045), c = /^#[0-9a-f]{6}$/i.test(String(x.color)) ? x.color : null;
      pg.a.push(x.style === 'note' ? { id: SP.uid(), t: 'note', x: 0.9, y, c: c || '#FFE14D', v: str(x.text, 1000), open: false, ts: Date.now(), ai: true, pos: x.position || 'top' } : { id: SP.uid(), t: 'text', x: 0.06, y, s: 0.022, c: c || '#C62828', v: str(x.text, 600), b: true, ai: true, pos: x.position || 'top' });
      d.updated = Date.now(); done(); log('🖍️', `كتبت على «${d.name}» ص${pi + 1}`, 'desk/' + d.id); return { ok: true, annotated_id: d.id }; }),
    T('publish_file', 'ينشر ملفاً (مع تعليقاته مدموجة) في قنوات/صفوف المحادثة (channels: أسماء الصفوف أو معرّفاتها، أو "all" لكل ما يمكنه النشر فيه)، و/أو يرسله لأشخاص بالاسم (to). الأستاذ ينشر في صفوفه كشرح مع مرفق؛ الطالب ينشر رسالة مع الملف في المجموعات المفتوحة فقط. يسأل للتأكيد.', { target_id: S_, channels: { type: 'array', items: S_ }, to: { type: 'array', items: S_ }, message: S_ }, ['target_id'], async (x) => {
      const { blob, name } = await fileBlob(x.target_id); return publish(blob, name, x); }),
    T('delete_item', 'يحذف عنصراً (ملاحظة، مستند، مهمة، بطاقات، فويز، مجموعة، مسار). يسأل المستخدم للتأكيد قبل الحذف.', { kind: { type: 'string', enum: ['note', 'document', 'task', 'deck', 'quiz', 'collection', 'flow'] }, id: S_ }, ['kind', 'id'], async ({ kind, id }) => {
      const x = get(kind, id); if ((kind === 'deck' || kind === 'quiz') && !canEdit[kind](x)) fail('هذا ليس لك');
      if (!(await ask(`المساعد يريد حذف «${title(kind, x)}». موافق؟`))) return 'رفض المستخدم الحذف';
      await snapshot(kind === 'document' ? 'wdoc:' + id : null);
      const key = { note: 'notes', document: 'wdocs', task: 'tasks', deck: 'decks', quiz: 'quizzes', collection: 'cols', flow: 'flows' }[kind]; S()[key] = S()[key].filter((y) => y.id !== id);
      if (kind === 'document') SP.idb.del('wdoc:' + id); done(); log('🗑', `حذفت «${title(kind, x)}»`, ''); return { ok: true }; }),

    T('open_page', 'يفتح صفحة أو عنصراً للمستخدم، مثل notes أو writer/<id> أو cards/<id> أو flow/<id> أو classes/<id> أو quizzes أو tasks أو home.', { route: S_ }, ['route'], ({ route }) => { const r = str(route, 120).replace(/^#?\/?/, ''); if (!SP.views[r.split('/')[0]]) fail('صفحة غير معروفة'); setTimeout(() => SP.go(r), 300); return { ok: true }; }),
    T('start_focus', 'يبدأ جلسة تركيز بعدد دقائق.', { minutes: N_ }, [], ({ minutes }) => { SP.timerSet('focus', Math.max(1, Math.min(120, +minutes || 25))); if (!SP.timer.running) SP.timerToggle(); log('⏱️', `بدأت جلسة تركيز ${Math.round(+minutes || 25)} دقيقة`, 'study'); return { ok: true }; }),
  ];
})();
