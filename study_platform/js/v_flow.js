/* مسارات الدراسة: منشئ مسارات بصري (عُقد + روابط) يربط مكتبتي بخطوات الدراسة، ويتتبع التقدّم ويضيء الخطوة التالية */
(function () {
  const SP = window.SP, h = SP.h, S = () => SP.state;
  const NS = 'http://www.w3.org/2000/svg';
  const flows = () => (S().flows = S().flows || []);
  const mine = () => flows().filter((f) => f.ownerId === SP.state.me);
  const sv = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 200;

  /* أنواع العُقد */
  const NT = {
    src_file: { cat: 'lib', icon: '📎', label: 'ملف', pick: 'file' }, src_note: { cat: 'lib', icon: '🗒️', label: 'ملاحظة', pick: 'note' },
    src_doc: { cat: 'lib', icon: '📄', label: 'مستند', pick: 'wdoc' }, src_desk: { cat: 'lib', icon: '🖍️', label: 'ملف بتعليقاتي', pick: 'desk' },
    src_post: { cat: 'lib', icon: '📢', label: 'منشور أستاذ', pick: 'item' }, src_col: { cat: 'lib', icon: '🗂️', label: 'مجموعة', pick: 'col' },
    read: { cat: 'step', icon: '📖', label: 'قراءة ومراجعة', min: 30 }, summary: { cat: 'step', icon: '✍️', label: 'تلخيص', min: 25, pick: 'wdoc' },
    cards: { cat: 'step', icon: '🃏', label: 'بطاقات', min: 15, pick: 'deck' }, quiz: { cat: 'step', icon: '❓', label: 'فويز', min: 10, pick: 'quiz' },
    focus: { cat: 'step', icon: '⏱️', label: 'جلسة تركيز', min: 25 }, ask: { cat: 'step', icon: '🦉', label: 'اسأل المساعد', min: 5 },
    check: { cat: 'logic', icon: '🚦', label: 'نقطة تحقق' }, exam: { cat: 'logic', icon: '🎯', label: 'هدف: امتحان', pick: 'exam' }, sticky: { cat: 'logic', icon: '📝', label: 'ملاحظة على اللوحة' },
  };
  const CATS = [['lib', 'من مكتبتي', '#0F766E'], ['step', 'خطوات الدراسة', '#1F4E99'], ['logic', 'أهداف ومنطق', '#B45F00']];
  const catColor = (t) => (CATS.find((c) => c[0] === (NT[t] || {}).cat) || [])[2] || '#1F4E99';

  /* ما يمكن ربطه من المكتبة والتطبيق */
  const OPTS = {
    file: () => S().files.filter((f) => (f.classId ? SP.canSeeClass(f.classId) : f.ownerId === SP.state.me)).map((f) => [f.id, f.name]),
    note: () => S().notes.filter((n) => n.ownerId === SP.state.me || (n.classId && SP.canSeeClass(n.classId))).map((n) => [n.id, n.title]),
    wdoc: () => (S().wdocs || []).filter((d) => d.ownerId === SP.state.me).map((d) => [d.id, d.name]),
    desk: () => (S().docs || []).filter((d) => d.ownerId === SP.state.me).map((d) => [d.id, d.name]),
    item: () => (S().classItems || []).filter((i) => SP.canSeeClass(i.classId) && i.type !== 'msg' && i.type !== 'poll').map((i) => [i.id, (i.title || i.text || '').slice(0, 50) + ' · ' + SP.className(i.classId)]),
    col: () => (S().cols || []).filter((c) => c.ownerId === SP.state.me).map((c) => [c.id, (c.emoji || '') + ' ' + c.name]),
    deck: () => S().decks.filter((d) => d.ownerId === SP.state.me || (d.classId && SP.canSeeClass(d.classId))).map((d) => [d.id, d.name]),
    quiz: () => S().quizzes.filter((q) => (q.classId ? SP.canSeeClass(q.classId) : q.by === SP.state.me)).map((q) => [q.id, q.title]),
    exam: () => (S().classItems || []).filter((i) => i.type === 'exam' && SP.canSeeClass(i.classId)).map((i) => [i.id, i.title + ' · ' + i.date]),
  };
  const find = (kind, id) => (OPTS[kind] ? OPTS[kind]().find((x) => x[0] === id) : null);
  const refName = (n) => { const p = (NT[n.t] || {}).pick; const f = p && n.ref ? find(p, n.ref) : null; return f ? f[1] : ''; };

  /* الحالة: تلقائية حيث يمكن (فويز، بطاقات، تحقق، امتحان، تلخيص) ويدوية في الباقي */
  const bestPct = (qid) => { const r = SP.bestResults(qid).find((x) => x.userId === SP.state.me); return r ? Math.round((100 * r.score) / r.total) : null; };
  function status(f, n) {
    if (n.t === 'sticky') return 'none';
    if (NT[n.t] && NT[n.t].cat === 'lib') return n.ref ? 'src' : 'todo';
    if (n.status === 'done') return 'done';
    if (n.t === 'quiz' && n.ref) { const p = bestPct(n.ref); return p == null ? (n.status || 'todo') : p >= (n.target || 0) ? 'done' : 'doing'; }
    if (n.t === 'cards' && n.ref) { const d = S().decks.find((x) => x.id === n.ref); if (!d) return n.status || 'todo'; const t = SP.today(); const due = d.cards.filter((c) => (c.due || t) <= t).length; return d.cards.length && !due ? 'done' : d.cards.some((c) => (c.box || 1) > 1) ? 'doing' : n.status || 'todo'; }
    if (n.t === 'check') { const qs = preds(f, n).map((p) => f.nodes.find((x) => x.id === p)).filter((x) => x && x.t === 'quiz' && x.ref); if (!qs.length) return n.status || 'todo'; return qs.every((q) => (bestPct(q.ref) || 0) >= (n.target || 80)) ? 'done' : 'todo'; }
    if (n.t === 'exam' && n.ref) { const e = (S().classItems || []).find((i) => i.id === n.ref); return e && new Date(`${e.date}T${e.time || '08:00'}`) < Date.now() ? 'done' : n.status || 'todo'; }
    if (n.t === 'summary' && n.ref) { const d = (S().wdocs || []).find((x) => x.id === n.ref); return d && d.words >= 60 ? 'done' : d ? 'doing' : n.status || 'todo'; }
    return n.status || 'todo';
  }
  const preds = (f, n) => f.edges.filter((e) => e.to === n.id).map((e) => e.from);
    const ok = (s) => s === 'done' || s === 'src';
  const isStep = (n) => n.t !== 'sticky' && (NT[n.t] || {}).cat !== 'lib';
  const isNext = (f, n) => isStep(n) && status(f, n) !== 'done' && preds(f, n).every((p) => { const pn = f.nodes.find((x) => x.id === p); return !pn || ok(status(f, pn)); });
  const progress = (f) => { const ns = f.nodes.filter(isStep); return ns.length ? Math.round((100 * ns.filter((n) => status(f, n) === 'done').length) / ns.length) : 0; };
  SP.flowProgress = progress;
  SP.flowsUsing = (kind, ref) => mine().filter((f) => f.nodes.some((n) => n.ref === ref && (NT[n.t] || {}).pick === kind));

  /* القوالب (تتدفق من اليمين إلى اليسار) */
  const mk = (t, x, y, extra = {}) => ({ id: SP.uid(), t, x, y, title: extra.title || NT[t].label, min: NT[t].min || 0, ...extra });
  const chain = (nodes) => nodes.slice(1).map((n, i) => ({ id: SP.uid(), from: nodes[i].id, to: n.id }));
  const TEMPLATES = {
    exam: ['تحضير امتحان', 'مصدر ← قراءة ← تلخيص ← بطاقات ← فويز ← تحقق ← الامتحان', () => { const ns = [mk('src_file', 1500, 160, { title: 'ملزمة المادة' }), mk('read', 1230, 160), mk('summary', 960, 160, { title: 'لخّص الفصول' }), mk('cards', 690, 160, { title: 'احفظ بالبطاقات' }), mk('quiz', 420, 160, { title: 'اختبر نفسك', target: 80 }), mk('check', 420, 400, { title: 'هل وصلت 80%؟', target: 80 }), mk('exam', 150, 160)]; const e = chain(ns.slice(0, 5)); e.push({ id: SP.uid(), from: ns[4].id, to: ns[5].id }, { id: SP.uid(), from: ns[5].id, to: ns[6].id }); ns.push(mk('sticky', 960, 420, { title: 'إذا ما وصلت 80% ارجع للبطاقات وأعد الفويز 💪' })); return { nodes: ns, edges: e }; }],
    lecture: ['محاضرة جديدة', 'منشور الأستاذ ← قراءة ← تلخيص ← بطاقات ← فويز', () => { const ns = [mk('src_post', 1230, 180, { title: 'شرح الأستاذ' }), mk('read', 960, 180), mk('summary', 690, 180), mk('cards', 420, 180), mk('quiz', 150, 180, { target: 70 })]; return { nodes: ns, edges: chain(ns) }; }],
    week: ['مراجعة أسبوعية', 'مجموعتي ← تركيز ← بطاقات ← اسأل المساعد', () => { const ns = [mk('src_col', 960, 180, { title: 'مجموعة المراجعة' }), mk('focus', 690, 100, { title: 'تركيز 25 دقيقة' }), mk('cards', 690, 300), mk('ask', 420, 180, { title: 'اسأل عن الصعب' })]; return { nodes: ns, edges: [{ id: SP.uid(), from: ns[0].id, to: ns[1].id }, { id: SP.uid(), from: ns[0].id, to: ns[2].id }, { id: SP.uid(), from: ns[1].id, to: ns[3].id }, { id: SP.uid(), from: ns[2].id, to: ns[3].id }] }; }],
    blank: ['لوحة فارغة', 'ابنِ مسارك بنفسك', () => ({ nodes: [mk('sticky', 400, 160, { title: 'اسحب عُقداً من اليمين، واربطها من النقطة اليسرى لكل عقدة 👈' })], edges: [] })],
  };
  function newFlow(seed) {
    let tpl = 'exam'; const name = h('input', { class: 'inp', id: 'fl-name', style: { width: '100%' }, value: 'مسار تحضير امتحان' }), grid = h('div', { class: 'grid s fl-tpls' });
    const draw = () => grid.replaceChildren(...Object.entries(TEMPLATES).map(([k, [l, d]]) => h('button', { class: 'card tpl' + (k === tpl ? ' on' : ''), 'aria-pressed': String(k === tpl), onclick: () => { tpl = k; name.value = k === 'blank' ? 'مساري' : 'مسار ' + l; draw(); } }, h('b', {}, l), h('small', { class: 'sub', style: { margin: 0 } }, d))));
    draw();
    SP.modal({ title: 'مسار دراسة جديد', wide: true, body: h('div', {}, SP.field('الاسم', name), h('label', { class: 'lbl' }, 'ابدأ من قالب'), grid),
      actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إنشاء', primary: true, onclick: (x) => {
        const g = TEMPLATES[tpl][2](); if (seed) { const src = g.nodes.find((n) => n.t.startsWith('src_')); if (src) Object.assign(src, seed); else g.nodes.unshift(mk(seed.t, 1700, 160, seed)); }
        const f = { id: SP.uid(), ownerId: SP.state.me, name: name.value.trim() || 'مساري', created: Date.now(), updated: Date.now(), view: { x: 0, y: 0, z: 0.8 }, fit: true, ...g };
        flows().push(f); SP.save(); x(); SP.go('flow/' + f.id);
      } }] });
  }

  /* ربط المكتبة بدراسة: أضف أي عنصر من مكتبتي إلى مسار */
  SP.addToFlow = (kind, ref, title) => {
    const t = { file: 'src_file', note: 'src_note', wdoc: 'src_doc', desk: 'src_desk', item: 'src_post', col: 'src_col', deck: 'cards', quiz: 'quiz', exam: 'exam' }[kind];
    const list = mine();
    const add = (f) => { const maxX = Math.max(0, ...f.nodes.map((n) => n.x)); f.nodes.push({ id: SP.uid(), t, x: maxX + 280, y: 160 + (f.nodes.length % 4) * 30, title: title || NT[t].label, ref, min: NT[t].min || 0, fresh: true }); f.updated = Date.now(); SP.save(); SP.toast('أُضيف إلى «' + f.name + '»'); SP.go('flow/' + f.id); };
    if (!list.length) return newFlow({ t, ref, title });
    SP.modal({ title: 'أضف «' + (title || '') + '» إلى مسار', body: h('div', { class: 'grid', style: { gap: '8px' } }, list.map((f) => h('button', { class: 'card tpl', onclick: () => { document.querySelector('.ov').remove(); add(f); } }, h('b', {}, f.name), h('small', { class: 'sub', style: { margin: 0 } }, `${f.nodes.length} عقدة · ${progress(f)}%`))),
      h('button', { class: 'btn ghost', onclick: () => { document.querySelector('.ov').remove(); newFlow({ t, ref, title }); } }, '+ مسار جديد بهذا المصدر')), actions: [{ label: 'إلغاء', onclick: (x) => x() }] });
  };

  /* زر «أضف لمسار» وشارة «في مسار» على عناصر المكتبة */
  SP.flowItem = (kind, ref, title) => ['🧭 أضف لمسار دراسة', () => SP.addToFlow(kind, ref, title)];
  SP.flowChip = (kind, ref) => {
    const used = SP.flowsUsing(kind, ref);
    return used.length ? h('button', { class: 'fl-in-chip', title: 'افتح المسار', onclick: (e) => { e.stopPropagation(); SP.go('flow/' + used[0].id); } }, '🧭 في مسار: ' + used[0].name + (used.length > 1 ? ' +' + (used.length - 1) : '')) : null;
  };

  /* بطاقة المسار النشط في الرئيسية */
  SP.flowHomeCard = () => {
    const f = mine().filter((x) => progress(x) < 100).sort((a, b) => b.updated - a.updated)[0]; if (!f) return null;
    const p = progress(f), nx = f.nodes.filter((n) => isNext(f, n)).slice(0, 2);
    return h('div', { class: 'card click fl-home', onclick: () => SP.go('flow/' + f.id) }, h('div', { class: 'fl-ring', style: { '--p': p } }, h('span', {}, p + '%')),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('small', { class: 'sub', style: { margin: 0 } }, '🧭 مسارك الحالي'), h('b', { style: { display: 'block' } }, f.name),
        nx.length ? h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('small', { class: 'sub', style: { margin: 0 } }, 'التالي:'), nx.map((n) => h('span', { class: 'chip on' }, NT[n.t].icon + ' ' + n.title))) : null),
      h('span', { class: 'fl-home-go', 'aria-hidden': 'true' }, '←'));
  };

  /* ---------- قائمة المسارات ---------- */
  function preview(f) {
    const s = sv('svg', { class: 'fl-mini', viewBox: '0 0 240 100', 'aria-hidden': 'true' }); const ns = f.nodes.filter((n) => n.t !== 'sticky'); if (!ns.length) return s;
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y), x0 = Math.min(...xs), x1 = Math.max(...xs) + W, y0 = Math.min(...ys), y1 = Math.max(...ys) + 90, k = Math.min(220 / (x1 - x0 || 1), 80 / (y1 - y0 || 1));
    const P = (n) => [10 + (n.x - x0) * k, 10 + (n.y - y0) * k];
    f.edges.forEach((e) => { const a = ns.find((n) => n.id === e.from), b = ns.find((n) => n.id === e.to); if (!a || !b) return; const [ax, ay] = P(a), [bx, by] = P(b); s.append(sv('path', { d: `M${ax} ${ay + 45 * k} C${ax - 20} ${ay + 45 * k} ${bx + W * k + 20} ${by + 45 * k} ${bx + W * k} ${by + 45 * k}`, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.35', 'stroke-width': 1.5 })); });
    ns.forEach((n) => { const [x, y] = P(n), st = status(f, n); s.append(sv('rect', { x, y, width: W * k, height: 90 * k, rx: 4, fill: st === 'done' ? '#2E7D32' : isNext(f, n) ? '#E07B00' : catColor(n.t), 'fill-opacity': st === 'done' ? '.85' : '.6' })); });
    return s;
  }
  function listView() {
    const list = mine().sort((a, b) => b.updated - a.updated);
    const shares = (S().inbox || []).filter((m) => m.to === SP.state.me && m.type === 'flow' && !m.imported);
    return SP.page('مسارات الدراسة', 'ابنِ طريقتك في الدراسة كمسار مرئي: اربط ملفات مكتبتك بخطوات القراءة والتلخيص والبطاقات والفويزات، والمسار يتتبع تقدّمك ويضيء خطوتك التالية.',
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => newFlow() }, 'مسار جديد')),
      shares.length ? h('div', { class: 'card share-in' }, h('b', {}, '📨 مسارات أرسلها لك زملاؤك'), shares.map((m) => h('div', { class: 'row sp', style: { marginTop: '8px' } }, h('span', {}, `«${m.flow.name}» من ${SP.user(m.from).name}`), h('button', { class: 'btn sm', onclick: () => SP.importFlow(m) }, 'أضف إلى دراستي')))) : null,
      h('div', { class: 'grid', style: { marginTop: '14px' } }, list.length ? list.map((f) => { const p = progress(f), nx = f.nodes.find((n) => isNext(f, n));
        return h('div', { class: 'card click fl-card', onclick: () => SP.go('flow/' + f.id) }, preview(f), h('h3', {}, f.name),
          h('div', { class: 'bar' }, h('i', { style: { width: p + '%' } })), h('div', { class: 'row sp', style: { marginTop: '6px' } }, h('small', { class: 'sub', style: { margin: 0 } }, `${p}% · ${f.nodes.filter(isStep).length} خطوة`), nx ? h('span', { class: 'chip on' }, 'التالي: ' + nx.title) : p === 100 ? h('span', { class: 'chip' }, 'مكتمل 🎉') : null));
      }) : [h('div', { class: 'empty' }, h('div', { class: 'sticker', style: { fontSize: '2.4rem', marginBottom: '8px' } }, '🧭'), 'لا مسارات بعد. ابدأ بقالب «تحضير امتحان».')]));
  }

  /* ---------- المحرّر: لوحة لا نهائية ---------- */
  function editor(f) {
    const root = h('div', { class: 'fl' }), canvas = h('div', { class: 'fl-canvas', tabindex: '0', 'aria-label': 'لوحة المسار' }), world = h('div', { class: 'fl-world' });
    const edgesSvg = sv('svg', { class: 'fl-edges', width: 6000, height: 4000 }), nodesLayer = h('div', { class: 'fl-nodes' });
    world.append(edgesSvg, nodesLayer); canvas.append(world);
    f.view = f.view || { x: 0, y: 0, z: 0.8 }; let sel = null, selEdge = null, saveT = 0;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { f.updated = Date.now(); SP.save(); }, 250); };
    SP.cleanups.push(() => { clearTimeout(saveT); SP.save(); });
    const applyView = () => { world.style.transform = `translate(${f.view.x}px,${f.view.y}px) scale(${f.view.z})`; canvas.style.backgroundSize = `${22 * f.view.z}px ${22 * f.view.z}px`; canvas.style.backgroundPosition = `${f.view.x}px ${f.view.y}px`; zoomLbl.textContent = Math.round(f.view.z * 100) + '%'; };
    const toWorld = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left - f.view.x) / f.view.z, (cy - r.top - f.view.y) / f.view.z]; };
    const nodeEls = new Map();
    const box = (n) => { const el = nodeEls.get(n.id); return { x: n.x, y: n.y, w: el ? el.offsetWidth : W, hh: el ? el.offsetHeight : 100 }; };
    const curve = (x1, y1, x2, y2) => { const dx = Math.max(50, Math.abs(x1 - x2) / 2); return `M${x1} ${y1} C${x1 - dx} ${y1} ${x2 + dx} ${y2} ${x2} ${y2}`; };
    const portOut = (n) => { const b = box(n); return [b.x, b.y + b.hh / 2]; };
    const portIn = (n) => { const b = box(n); return [b.x + b.w, b.y + b.hh / 2]; };

    function drawEdges() {
      edgesSvg.replaceChildren(sv('defs', {}));
      f.edges.forEach((e) => {
        const a = f.nodes.find((n) => n.id === e.from), b = f.nodes.find((n) => n.id === e.to); if (!a || !b) return;
        const [x1, y1] = portOut(a), [x2, y2] = portIn(b), d = curve(x1, y1, x2, y2), done = ok(status(f, a)), hot = done && isNext(f, b);
        const g = sv('g', { class: 'fl-edge' + (done ? ' done' : '') + (hot ? ' hot' : '') + (selEdge === e.id ? ' sel' : ''), 'data-id': e.id });
        g.append(sv('path', { d, class: 'fl-hit' }), sv('path', { d, class: 'fl-line' + (e.fresh ? ' draw' : '') }));
        if (hot && !reduced) for (let i = 0; i < 3; i++) { const c = sv('circle', { r: 4, class: 'fl-dot' }); const m = sv('animateMotion', { dur: '1.8s', repeatCount: 'indefinite', path: d, begin: (i * 0.6) + 's' }); c.append(m); g.append(c); }
        g.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); selEdge = e.id; sel = null; renderNodes(); drawEdges(); inspector(); });
        edgesSvg.append(g); delete e.fresh;
      });
      if (selEdge) { const e = f.edges.find((x) => x.id === selEdge); if (e) { const a = f.nodes.find((n) => n.id === e.from), b = f.nodes.find((n) => n.id === e.to); if (a && b) { const [x1, y1] = portOut(a), [x2, y2] = portIn(b); const bt = sv('g', { class: 'fl-edel', transform: `translate(${(x1 + x2) / 2},${(y1 + y2) / 2})`, role: 'button', 'aria-label': 'حذف الرابط' }); bt.append(sv('circle', { r: 11 }), sv('text', { 'text-anchor': 'middle', y: 4 }));
        bt.lastChild.textContent = '✕'; bt.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); f.edges = f.edges.filter((x) => x.id !== selEdge); selEdge = null; save(); drawEdges(); refreshMeta(); }); edgesSvg.append(bt); } } }
    }
    function nodeEl(n) {
      const T = NT[n.t] || NT.read, st = status(f, n), next = isNext(f, n);
      const el = h('div', { class: `fl-node c-${T.cat} s-${st}` + (next ? ' next' : '') + (sel === n.id ? ' sel' : '') + (n.fresh ? ' pop' : '') + (n.t === 'sticky' ? ' sticky' : ''), style: { left: n.x + 'px', top: n.y + 'px', '--cc': catColor(n.t) }, 'data-id': n.id, tabindex: '0', role: 'group', 'aria-label': `${T.label}: ${n.title}` });
      delete n.fresh;
      if (n.t === 'sticky') { const ta = h('textarea', { class: 'fl-sticky', 'aria-label': 'ملاحظة على اللوحة' }); ta.value = n.title; ta.addEventListener('input', () => { n.title = ta.value; save(); }); ta.addEventListener('pointerdown', (e) => e.stopPropagation()); el.append(h('div', { class: 'fl-grip' }, '📝'), ta); }
      else {
        const linked = refName(n), e = n.t === 'exam' && n.ref ? (S().classItems || []).find((i) => i.id === n.ref) : null;
        el.append(...[h('div', { class: 'fl-head' }, h('span', { class: 'fl-ic' }, T.icon), h('span', { class: 'fl-kind' }, T.label), h('span', { class: 'fl-st', title: { done: 'مكتمل', doing: 'جارٍ', todo: 'لم يبدأ' }[st] }, st === 'done' ? '✓' : st === 'doing' ? '◐' : '')),
          h('div', { class: 'fl-title' }, n.title), linked ? h('div', { class: 'fl-link' }, '🔗 ' + linked) : T.pick ? h('div', { class: 'fl-link warn' }, 'لم يُربط بعد') : null,
          h('div', { class: 'fl-meta' }, n.min ? h('span', {}, '⏱ ' + n.min + 'د') : null, n.target ? h('span', {}, '🎯 ' + n.target + '%') : null, e && SP.countdown ? h('span', {}, SP.countdown(new Date(`${e.date}T${e.time || '08:00'}`))) : null, n.t === 'quiz' && n.ref && bestPct(n.ref) != null ? h('span', {}, 'أفضل ' + bestPct(n.ref) + '%') : null, next ? h('span', { class: 'fl-nextchip' }, 'التالي') : null),
          h('span', { class: 'fl-port in', 'aria-hidden': 'true' }), h('span', { class: 'fl-port out', title: 'اسحب لربط هذه الخطوة بالتالية', 'aria-hidden': 'true' })].filter(Boolean));
      }
      el.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('fl-port') && e.target.classList.contains('out')) return startLink(e, n);
        if (e.button) return; e.stopPropagation(); canvas.focus({ preventScroll: true });
        const was = sel; sel = n.id; selEdge = null; if (was !== sel) { renderNodes(); drawEdges(); inspector(); }
        const [sx, sy] = toWorld(e.clientX, e.clientY), ox = n.x, oy = n.y; let moved = false; const me = nodeEls.get(n.id); me.setPointerCapture(e.pointerId); me.classList.add('drag');
        const mv = (m) => { const [wx, wy] = toWorld(m.clientX, m.clientY); n.x = Math.round((ox + wx - sx) / 10) * 10; n.y = Math.round((oy + wy - sy) / 10) * 10; me.style.left = n.x + 'px'; me.style.top = n.y + 'px'; moved = true; drawEdges(); };
        const up = () => { me.removeEventListener('pointermove', mv); me.removeEventListener('pointerup', up); me.classList.remove('drag'); if (moved) save(); };
        me.addEventListener('pointermove', mv); me.addEventListener('pointerup', up);
      });
      el.addEventListener('dblclick', () => openNode(n));
      return el;
    }
    function renderNodes() { nodeEls.clear(); nodesLayer.replaceChildren(...f.nodes.map((n) => { const el = nodeEl(n); nodeEls.set(n.id, el); return el; })); }
    const reachable = (from, to) => { const seen = new Set(), st = [from]; while (st.length) { const x = st.pop(); if (x === to) return true; if (seen.has(x)) continue; seen.add(x); f.edges.filter((e) => e.from === x).forEach((e) => st.push(e.to)); } return false; };
    function startLink(e, n) {
      e.stopPropagation(); e.preventDefault(); const tmp = sv('path', { class: 'fl-temp' }); edgesSvg.append(tmp); const [x1, y1] = portOut(n);
      const mv = (m) => { const [wx, wy] = toWorld(m.clientX, m.clientY); tmp.setAttribute('d', curve(x1, y1, wx, wy)); const t = document.elementFromPoint(m.clientX, m.clientY); nodesLayer.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); const tn = t && t.closest('.fl-node'); if (tn && tn.dataset.id !== n.id) tn.classList.add('drop'); };
      const up = (m) => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); tmp.remove(); nodesLayer.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
        const t = document.elementFromPoint(m.clientX, m.clientY), tn = t && t.closest('.fl-node'), to = tn && tn.dataset.id;
        if (!to || to === n.id) return; const tnode = f.nodes.find((x) => x.id === to); if (tnode.t === 'sticky' || n.t === 'sticky') return SP.toast('الملاحظات لا تُربط', 'err');
        if (f.edges.some((x) => x.from === n.id && x.to === to)) return; if (reachable(to, n.id)) return SP.toast('هذا الربط يصنع حلقة، المسار يجب أن يتقدم للأمام', 'err');
        f.edges.push({ id: SP.uid(), from: n.id, to, fresh: true }); save(); renderNodes(); drawEdges(); refreshMeta();
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    }

    /* التحريك والتكبير */
    canvas.addEventListener('pointerdown', (e) => {
      if (e.target !== canvas && !e.target.closest('.fl-world') ) return; if (e.target.closest('.fl-node') || e.target.closest('.fl-edge')) return;
      if (sel || selEdge) { sel = null; selEdge = null; renderNodes(); drawEdges(); inspector(); }
      const sx = e.clientX, sy = e.clientY, vx = f.view.x, vy = f.view.y; canvas.setPointerCapture(e.pointerId); canvas.classList.add('panning');
      const mv = (m) => { f.view.x = vx + m.clientX - sx; f.view.y = vy + m.clientY - sy; applyView(); };
      const up = () => { canvas.removeEventListener('pointermove', mv); canvas.removeEventListener('pointerup', up); canvas.classList.remove('panning'); save(); };
      canvas.addEventListener('pointermove', mv); canvas.addEventListener('pointerup', up);
    });
    const zoomAt = (k, cx, cy) => { const r = canvas.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, z = clamp(f.view.z * k, 0.35, 1.8), wx = (px - f.view.x) / f.view.z, wy = (py - f.view.y) / f.view.z; f.view.z = z; f.view.x = px - wx * z; f.view.y = py - wy * z; applyView(); save(); };
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); else { f.view.x -= e.deltaX; f.view.y -= e.deltaY; applyView(); } }, { passive: false });
    function fit(animate) {
      if (!f.nodes.length) return; const bs = f.nodes.map(box), x0 = Math.min(...bs.map((b) => b.x)) - 60, x1 = Math.max(...bs.map((b) => b.x + b.w)) + 60, y0 = Math.min(...bs.map((b) => b.y)) - 60, y1 = Math.max(...bs.map((b) => b.y + b.hh)) + 60;
      const r = canvas.getBoundingClientRect(), z = clamp(Math.min(r.width / (x1 - x0), r.height / (y1 - y0)), 0.35, 1.2);
      f.view = { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z };
      if (animate && !reduced) { world.classList.add('glide'); setTimeout(() => world.classList.remove('glide'), 420); } applyView(); save();
    }

    /* إضافة عُقد: سحب من اللوحة الجانبية أو نقر */
    function addNode(t, wx, wy, extra = {}) { const n = { id: SP.uid(), t, x: Math.round((wx - W / 2) / 10) * 10, y: Math.round((wy - 40) / 10) * 10, title: extra.title || NT[t].label, min: NT[t].min || 0, fresh: true, ...extra }; if (t === 'quiz') n.target = n.target || 80; if (t === 'check') n.target = 80; f.nodes.push(n); sel = n.id; save(); renderNodes(); requestAnimationFrame(drawEdges); inspector(); refreshMeta(); return n; }
    const center = () => { const r = canvas.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };
    canvas.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-flnode')) { e.preventDefault(); canvas.classList.add('dropping'); } });
    canvas.addEventListener('dragleave', () => canvas.classList.remove('dropping'));
    canvas.addEventListener('drop', (e) => { canvas.classList.remove('dropping'); const d = e.dataTransfer.getData('application/x-flnode'); if (!d) return; e.preventDefault(); const p = JSON.parse(d), [wx, wy] = toWorld(e.clientX, e.clientY); addNode(p.t, wx, wy, p.ref ? { ref: p.ref, title: p.title } : {}); });
    let palTab = 'steps', palQ = '';
    const palette = h('aside', { class: 'fl-pal', 'aria-label': 'عُقد يمكن إضافتها' });
    const palItem = (t, label, extra) => h('button', { class: 'fl-pi', draggable: 'true', style: { '--cc': catColor(t) }, title: 'اسحب إلى اللوحة أو انقر للإضافة',
      ondragstart: (e) => { e.dataTransfer.setData('application/x-flnode', JSON.stringify({ t, ...(extra || {}) })); e.dataTransfer.effectAllowed = 'copy'; },
      onclick: () => { const [cx, cy] = center(); addNode(t, cx + (Math.random() * 60 - 30), cy + (Math.random() * 60 - 30), extra ? { ref: extra.ref, title: extra.title } : {}); } }, h('span', {}, NT[t].icon), label);
    function drawPalette() {
      const tabs = h('div', { class: 'fl-ptabs' }, [['steps', 'الخطوات'], ['lib', 'مكتبتي']].map(([k, l]) => h('button', { class: k === palTab ? 'on' : '', onclick: () => { palTab = k; drawPalette(); } }, l)));
      let body;
      if (palTab === 'steps') body = CATS.filter(([c]) => c !== 'lib').map(([c, l]) => h('div', { class: 'fl-pgroup' }, h('small', {}, l), Object.entries(NT).filter(([, v]) => v.cat === c).map(([t, v]) => palItem(t, v.label))));
      else {
        const q = h('input', { class: 'inp', type: 'search', placeholder: 'ابحث في مكتبتي', value: palQ, 'aria-label': 'بحث في مكتبتي', oninput: (e) => { palQ = e.target.value; drawLib(); } }), libBox = h('div', {});
        const drawLib = () => libBox.replaceChildren(...[['file', 'src_file', 'الملفات'], ['note', 'src_note', 'الملاحظات'], ['wdoc', 'src_doc', 'المستندات'], ['desk', 'src_desk', 'ملفات بتعليقاتي'], ['item', 'src_post', 'منشورات الأساتذة'], ['col', 'src_col', 'مجموعاتي'], ['deck', 'cards', 'البطاقات'], ['quiz', 'quiz', 'الفويزات']].map(([k, t, l]) => {
          const items = OPTS[k]().filter(([, name]) => !palQ || name.includes(palQ)).slice(0, 12);
          return items.length ? h('div', { class: 'fl-pgroup' }, h('small', {}, l), items.map(([id, name]) => palItem(t, name, { ref: id, title: name.split(' · ')[0] }))) : null;
        }).filter(Boolean));
        drawLib(); body = [q, libBox];
      }
      palette.replaceChildren(tabs, h('div', { class: 'fl-pbody' }, body));
    }

    /* لوحة الخصائص */
    const insp = h('aside', { class: 'fl-insp', 'aria-label': 'خصائص العقدة' });
    function openNode(n) {
      const T = NT[n.t];
      const go = (p) => SP.go(p);
      if (n.t === 'focus') { SP.timerSet && SP.timerSet('focus', n.min || 25); SP.timerToggle && SP.timerToggle(); n.status = 'doing'; save(); return go('study'); }
      if (n.t === 'ask') { SP._ai && SP._ai.toggle(true); SP._ai && SP._ai.send('ساعدني أفهم: ' + n.title + (refName(n) ? ' (' + refName(n) + ')' : '')); return; }
      if (n.t === 'summary' && !n.ref && SP.createWriterDoc) return SP.createWriterDoc('ملخص: ' + n.title, '<h1>ملخص: ' + n.title.replace(/[<>&]/g, '') + '</h1><h2>النقاط الرئيسية</h2><ul><li>…</li></ul><h2>مصطلحات</h2><ul><li>…</li></ul>').then((d) => { n.ref = d.id; save(); go('writer/' + d.id); });
      if (n.t === 'cards' && !n.ref) { const d = { id: SP.uid(), ownerId: SP.state.me, classId: '', name: n.title, cards: [] }; S().decks.push(d); n.ref = d.id; save(); return go('cards/' + d.id); }
      if (!n.ref) return SP.toast('اربط هذه العقدة بعنصر من لوحة الخصائص أولاً', 'err');
      const r = n.ref;
      if (T.pick === 'file') { const fl = S().files.find((x) => x.id === r); return fl && /pdf|image/.test(fl.mime || '') ? SP.openInDesk(fl) : go(fl && fl.kind === 'handout' ? 'handouts' : 'files'); }
      ({ note: () => go('notes'), wdoc: () => go('writer/' + r), desk: () => go('desk/' + r), col: () => go('space/' + r), deck: () => go('cards/' + r + '/study'), quiz: () => go('quizzes/take/' + r),
        item: () => { const it = (S().classItems || []).find((x) => x.id === r); it && go('classes/' + it.classId); }, exam: () => { const it = (S().classItems || []).find((x) => x.id === r); it && go('classes/' + it.classId); } })[T.pick]();
    }
    function inspector() {
      const n = f.nodes.find((x) => x.id === sel);
      if (!n) { insp.classList.remove('open'); insp.replaceChildren(); return; }
      const T = NT[n.t], st = status(f, n), auto = ['quiz', 'cards', 'check', 'exam', 'summary'].includes(n.t) && (n.ref || n.t === 'check');
      const title = h('input', { class: 'inp', id: 'fl-title', value: n.title, oninput: (e) => { n.title = e.target.value; save(); const t = nodeEls.get(n.id).querySelector('.fl-title'); if (t) t.textContent = n.title; } });
      const fields = [SP.field('العنوان', title)];
      if (T.pick) fields.push(SP.field('مرتبط بـ', h('select', { class: 'inp', id: 'fl-ref', onchange: (e) => { n.ref = e.target.value; if (n.ref && (!n.title || n.title === T.label)) n.title = (find(T.pick, n.ref) || ['', ''])[1].split(' · ')[0]; save(); renderNodes(); drawEdges(); inspector(); refreshMeta(); } }, h('option', { value: '' }, '— اختر —'), OPTS[T.pick]().map(([id, name]) => h('option', { value: id, selected: id === n.ref }, name)))));
      if (n.t !== 'check' && n.t !== 'exam' && T.cat !== 'lib') fields.push(SP.field('الوقت المتوقع (دقائق)', h('input', { class: 'inp', type: 'number', min: 0, value: n.min || 0, style: { width: '110px' }, onchange: (e) => { n.min = +e.target.value || 0; save(); renderNodes(); drawEdges(); refreshMeta(); } })));
      if (n.t === 'quiz' || n.t === 'check') fields.push(SP.field('الدرجة المطلوبة %', h('input', { class: 'inp', type: 'number', min: 0, max: 100, value: n.target || 0, style: { width: '110px' }, onchange: (e) => { n.target = clamp(+e.target.value || 0, 0, 100); save(); renderNodes(); drawEdges(); refreshMeta(); } })));
      fields.push(SP.field('ملاحظتي', h('textarea', { class: 'inp', id: 'fl-note', placeholder: 'ماذا أركز عليه هنا؟', oninput: (e) => { n.note = e.target.value; save(); } }, n.note || '')));
      const stat = h('div', { class: 'tabs fl-stat', role: 'radiogroup', 'aria-label': 'الحالة' }, [['todo', 'لم يبدأ'], ['doing', 'جارٍ'], ['done', 'تم']].map(([k, l]) => h('button', { class: 'tab' + (st === k ? ' on' : ''), role: 'radio', 'aria-checked': String(st === k), onclick: () => { n.status = k; save(); renderNodes(); drawEdges(); inspector(); refreshMeta(); if (k === 'done') { celebrate(n); } } }, l)));
      insp.replaceChildren(...[h('div', { class: 'row sp' }, h('b', {}, T.icon + ' ' + T.label), h('button', { class: 'btn ghost sm', 'aria-label': 'إغلاق', onclick: () => { sel = null; renderNodes(); drawEdges(); inspector(); } }, '✕')),
        n.t === 'sticky' ? h('p', { class: 'sub' }, 'ملاحظة حرة على اللوحة، اكتب فيها مباشرة.') : [fields, T.cat === 'lib' ? h('p', { class: 'sub', style: { margin: '8px 0 0' } }, 'مصدر من مكتبتك: يغذّي الخطوات المرتبطة به.') : [h('label', { class: 'lbl' }, 'الحالة' + (auto ? ' (تُحدَّث تلقائياً من تقدّمك)' : '')), stat],
          h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn', onclick: () => openNode(n) }, { focus: 'ابدأ الجلسة', ask: 'اسأل الآن', summary: n.ref ? 'افتح الملخص' : 'أنشئ ملخصاً', cards: n.ref ? 'راجع البطاقات' : 'أنشئ بطاقات', quiz: 'حل الفويز' }[n.t] || 'افتح'))],
        h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn ghost sm', onclick: () => { const c = { ...JSON.parse(JSON.stringify(n)), id: SP.uid(), x: n.x + 40, y: n.y + 120, fresh: true, status: '' }; f.nodes.push(c); sel = c.id; save(); renderNodes(); drawEdges(); inspector(); } }, 'تكرار'), h('button', { class: 'btn bad sm', onclick: () => del(n.id) }, 'حذف العقدة'))].flat(Infinity).filter(Boolean));
      insp.classList.add('open');
    }
    const del = (id) => { f.nodes = f.nodes.filter((x) => x.id !== id); f.edges = f.edges.filter((e) => e.from !== id && e.to !== id); sel = null; save(); renderNodes(); drawEdges(); inspector(); refreshMeta(); };
    function celebrate(n) { SP.emit('react', 'celebrate'); if (reduced) return; const el = nodeEls.get(n.id); if (!el) return; for (let i = 0; i < 10; i++) { const s = h('span', { class: 'fl-spark', style: `--a:${i * 36}deg` }); el.append(s); setTimeout(() => s.remove(), 900); } }

    /* ترتيب تلقائي: طبقات حسب الاعتماد (من اليمين لليسار) */
    function arrange() {
      const lvl = {}; const ns = f.nodes.filter((n) => n.t !== 'sticky');
      const L = (n, seen = new Set()) => { if (lvl[n.id] != null) return lvl[n.id]; if (seen.has(n.id)) return 0; seen.add(n.id); const p = preds(f, n).map((id) => f.nodes.find((x) => x.id === id)).filter(Boolean); return (lvl[n.id] = p.length ? Math.max(...p.map((x) => L(x, seen))) + 1 : 0); };
      ns.forEach((n) => L(n)); const max = Math.max(0, ...Object.values(lvl)), cols = {};
      ns.forEach((n) => { const l = lvl[n.id]; cols[l] = (cols[l] || 0) + 1; n.x = (max - l) * 250 + 80; n.y = 80 + (cols[l] - 1) * 150; });
      f.nodes.filter((n) => n.t === 'sticky').forEach((n, i) => { n.x = 80 + i * 260; n.y = 80 + (Math.max(0, ...Object.values(cols)) * 150); });
      if (!reduced) { nodesLayer.classList.add('glide'); setTimeout(() => nodesLayer.classList.remove('glide'), 500); }
      save(); renderNodes(); requestAnimationFrame(() => { drawEdges(); fit(true); });
      const tick = setInterval(drawEdges, 40); setTimeout(() => clearInterval(tick), 520);
    }

    /* الشريط العلوي والتقدّم */
    const zoomLbl = h('span', { class: 'fl-zoom' }), metaBox = h('div', { class: 'fl-meta-bar' });
    function refreshMeta() {
      const p = progress(f), nx = f.nodes.filter((n) => isNext(f, n)), mins = f.nodes.filter((n) => status(f, n) !== 'done').reduce((a, n) => a + (n.min || 0), 0);
      metaBox.replaceChildren(h('div', { class: 'fl-ring', style: { '--p': p }, role: 'img', 'aria-label': `التقدّم ${p}%` }, h('span', {}, p + '%')),
        h('div', { class: 'fl-next' }, h('small', {}, nx.length ? 'خطوتك التالية' : p === 100 ? 'أكملت المسار 🎉' : 'أضف خطوات واربطها'), nx.length ? nx.slice(0, 3).map((n) => h('button', { class: 'chip on', onclick: () => { sel = n.id; renderNodes(); drawEdges(); inspector(); focusNode(n); } }, NT[n.t].icon + ' ' + n.title)) : null),
        h('small', { class: 'sub', style: { margin: 0 } }, mins ? `متبقٍ تقريباً ${mins >= 60 ? Math.floor(mins / 60) + ' ساعة و' : ''}${mins % 60} دقيقة` : ''));
    }
    const focusNode = (n) => { const r = canvas.getBoundingClientRect(), b = box(n); f.view.x = r.width / 2 - (b.x + b.w / 2) * f.view.z; f.view.y = r.height / 2 - (b.y + b.hh / 2) * f.view.z; if (!reduced) { world.classList.add('glide'); setTimeout(() => world.classList.remove('glide'), 420); } applyView(); save(); };
    const name = h('input', { class: 'inp wtitle', id: 'fl-flowname', value: f.name, 'aria-label': 'اسم المسار', onchange: (e) => { f.name = e.target.value.trim() || f.name; save(); } });
    const top = h('div', { class: 'fl-top' }, h('div', { class: 'row', style: { flex: 1, minWidth: 0 } }, h('button', { class: 'btn ghost sm', onclick: () => SP.go('flow') }, 'رجوع'), name), metaBox,
      h('div', { class: 'row fl-tools' }, zoomLbl, h('button', { class: 'btn ghost sm', onclick: () => fit(true) }, 'ملاءمة'), h('button', { class: 'btn sm', onclick: () => shareFlow(f) }, 'شارك المسار'),
        SP.more([['➕ تكبير', () => { const r = canvas.getBoundingClientRect(); zoomAt(1.15, r.left + r.width / 2, r.top + r.height / 2); }], ['➖ تصغير', () => { const r = canvas.getBoundingClientRect(); zoomAt(0.85, r.left + r.width / 2, r.top + r.height / 2); }],
          ['✨ ترتيب تلقائي', arrange], ['🗑 حذف المسار', async () => { if (await SP.confirm('حذف المسار «' + f.name + '»؟ (لا تُحذف ملفاتك)')) { S().flows = flows().filter((x) => x.id !== f.id); SP.save(); SP.go('flow'); } }, true]])));
    canvas.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && (sel || selEdge)) { e.preventDefault(); if (sel) del(sel); else { f.edges = f.edges.filter((x) => x.id !== selEdge); selEdge = null; save(); drawEdges(); refreshMeta(); } }
      if (e.key === 'Escape' && (sel || selEdge)) { sel = null; selEdge = null; renderNodes(); drawEdges(); inspector(); }
      if (e.key === 'Enter' && sel) { const n = f.nodes.find((x) => x.id === sel); n && openNode(n); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && sel) { e.preventDefault(); const n = f.nodes.find((x) => x.id === sel); const c = { ...JSON.parse(JSON.stringify(n)), id: SP.uid(), x: n.x + 40, y: n.y + 120, fresh: true, status: '' }; f.nodes.push(c); sel = c.id; save(); renderNodes(); drawEdges(); inspector(); }
      if (e.key === '+' || e.key === '=') { const r = canvas.getBoundingClientRect(); zoomAt(1.15, r.left + r.width / 2, r.top + r.height / 2); }
      if (e.key === '-') { const r = canvas.getBoundingClientRect(); zoomAt(0.85, r.left + r.width / 2, r.top + r.height / 2); }
      if (e.key === '0') fit(true);
    });
    root.append(top, h('div', { class: 'fl-body' }, palette, canvas, insp));
    drawPalette(); renderNodes(); refreshMeta(); applyView();
    requestAnimationFrame(() => { if (f.fit) { delete f.fit; fit(false); } drawEdges(); });
    root._api = { addNode, arrange, fit, f };
    return root;
  }

  /* مشاركة المسار */
  function shareFlow(f) {
    const users = S().users.filter((u) => u.id !== SP.state.me), picked = new Set();
    SP.modal({ title: 'شارك «' + f.name + '»', body: h('div', {}, h('p', { class: 'sub' }, 'يصلهم المسار بخطواته وروابطه، ويبدأ تقدّمهم من الصفر.'), h('div', { class: 'grid s' }, users.map((u) => h('label', { class: 'card row', style: { padding: '10px', cursor: 'pointer' } }, h('input', { type: 'checkbox', onchange: (e) => (e.target.checked ? picked.add(u.id) : picked.delete(u.id)) }), SP.avatar(u), u.name)))),
      actions: [{ label: 'إلغاء', onclick: (x) => x() }, { label: 'إرسال', primary: true, onclick: (x) => { if (!picked.size) return SP.toast('اختر شخصاً', 'err'); const snap = JSON.parse(JSON.stringify({ name: f.name, nodes: f.nodes.map((n) => ({ ...n, status: '' })), edges: f.edges })); picked.forEach((to) => (S().inbox = S().inbox || []).push({ id: SP.uid(), type: 'flow', from: SP.state.me, to, name: '🧭 ' + f.name, note: '', ts: Date.now(), read: false, flow: snap })); SP.save(); x(); SP.toast('أُرسل المسار'); SP.emit('react', 'send'); SP.updateBell && SP.updateBell(); } }] });
  }
  SP.importFlow = (m) => { const f = { id: SP.uid(), ownerId: SP.state.me, name: m.flow.name + ' (من ' + SP.user(m.from).name + ')', created: Date.now(), updated: Date.now(), view: { x: 0, y: 0, z: 0.8 }, fit: true, from: m.from, nodes: m.flow.nodes, edges: m.flow.edges }; flows().push(f); m.imported = true; m.read = true; SP.save(); SP.updateBell && SP.updateBell(); SP.toast('أُضيف المسار إلى دراستك'); SP.go('flow/' + f.id); };

  SP.reg('flow', '', 'مسارات الدراسة', (p) => {
    if (!p[0]) return listView();
    const f = mine().find((x) => x.id === p[0]);
    return f ? editor(f) : SP.page('المسار غير موجود', '', h('button', { class: 'btn', onclick: () => SP.go('flow') }, 'رجوع'));
  });
  SP._flow = { NT, status, isNext, progress, TEMPLATES };
})();
