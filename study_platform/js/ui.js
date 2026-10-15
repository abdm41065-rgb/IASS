/* أدوات الواجهة المشتركة */
(function () {
  const SP = window.SP;
  const PROP = new Set(['value', 'checked', 'disabled', 'selected', 'multiple', 'src', 'srcdoc']);
  SP.h = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (PROP.has(k)) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  };
  const h = SP.h;
  SP.date = (ts) => new Date(ts).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' });
  SP.size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  SP.toast = (msg, type) => {
    const t = h('div', { class: 'toast ' + (type || '') }, msg);
    document.getElementById('toasts').append(t); setTimeout(() => t.remove(), 3200);
  };
  SP.modal = ({ title, body, actions = [], wide }) => {
    const prev = document.activeElement;
    const ov = h('div', { class: 'ov', role: 'dialog', 'aria-modal': 'true', onmousedown: (e) => e.target === ov && close() });
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); prev && prev.focus && prev.focus(); };
    const esc = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', esc);
    ov.append(h('div', { class: 'md' + (wide ? ' wide' : '') }, h('h2', {}, title), body,
      actions.length ? h('div', { class: 'acts' }, actions.map((a) => h('button', { class: 'btn ' + (a.primary ? '' : 'ghost') + (a.cls ? ' ' + a.cls : ''), onclick: () => a.onclick(close) }, a.label))) : null));
    document.body.append(ov);
    const f = ov.querySelector('input,textarea,select'); f && f.focus();
    return close;
  };
  SP.confirm = (msg) => new Promise((res) => SP.modal({
    title: 'تأكيد', body: h('p', {}, msg),
    actions: [{ label: 'إلغاء', onclick: (c) => { c(); res(false); } }, { label: 'تأكيد', primary: true, cls: 'bad', onclick: (c) => { c(); res(true); } }],
  }));
  SP.field = (label, input) => h('div', {}, h('label', { class: 'lbl' }, label), input);
  const plainDownload = (name, blob) => {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  /* داخل claude.ai: إذن التنزيل الرسمي (يسأل المستخدم)، وخارجه: تنزيل عادي */
  SP.download = async (name, data, type = 'text/plain') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (!dl) return plainDownload(name, blob);
    try { await dl.save({ filename: name, data: blob }); }
    catch (e) { if (e && e.code !== 'declined') SP.toast('تعذّر حفظ الملف: ' + (e.message || e.code), 'err'); }
  };
  SP.refresh = () => SP.route && SP.route();
  SP.go = (p) => { location.hash = '#/' + p; };
  SP.page = (title, sub, ...kids) => h('div', {}, h('h1', {}, title), sub ? h('p', { class: 'sub' }, sub) : null, ...kids);
  SP.empty = (msg) => h('div', { class: 'empty' }, msg);
  SP.avatar = (u, c) => h('span', { class: 'avatar', style: { background: c || SP.COLORS[(u.name.charCodeAt(0) || 0) % 8] } }, (u.name || '؟').replace(/^(المعلم|المعلمة|الطالب|الطالبة|د\.)\s*/, '').slice(0, 1));
  SP.swatches = (cur, onPick) => {
    const box = h('span', {});
    const draw = (c) => { box.replaceChildren(...SP.COLORS.map((x) => h('span', { class: 'sw' + (x === c ? ' on' : ''), style: { background: x }, role: 'button', 'aria-label': 'لون', onclick: () => { onPick(x); draw(x); } }))); };
    draw(cur); return box;
  };
  SP.stickerPicker = (list, onChange) => {
    const box = h('div', {});
    const draw = () => box.replaceChildren(...SP.EMOJIS.map((e) => h('button', { type: 'button', class: 'emo' + (list.includes(e) ? ' on' : ''), onclick: () => { const i = list.indexOf(e); i < 0 ? list.push(e) : list.splice(i, 1); onChange && onChange(list); draw(); } }, e)));
    draw(); return box;
  };
  SP.tagInput = (val) => h('input', { class: 'inp', style: { width: '100%' }, placeholder: 'وسوم مفصولة بفاصلة', value: (val || []).join('، ') });
  SP.parseTags = (s) => [...new Set(s.split(/[,،]/).map((x) => x.trim()).filter(Boolean))];
  SP.classSelect = (cur, all = true) => h('select', { class: 'inp' }, h('option', { value: '' }, 'بدون صف (شخصي)'),
    (all ? SP.state.classes.filter((c) => SP.canSeeClass(c.id)) : SP.myClasses()).map((c) => h('option', { value: c.id, selected: c.id === cur }, c.name)));
  SP.tabs = (names, cur, onPick) => h('div', { class: 'tabs', role: 'tablist' }, names.map(([k, label]) => h('button', { class: 'tab' + (k === cur ? ' on' : ''), role: 'tab', onclick: () => onPick(k) }, label)));
  SP.filterBar = (tags, cur, onPick) => h('div', {}, h('span', { class: 'chip' + (cur ? '' : ' on'), role: 'button', onclick: () => onPick('') }, 'الكل'), tags.map((t) => h('span', { class: 'chip' + (t === cur ? ' on' : ''), role: 'button', onclick: () => onPick(t) }, '#' + t)));
  SP.bars = (vals, labels, color = 'var(--brand)') => { /* مخطط أعمدة SVG بسيط */
    const max = Math.max(1, ...vals), w = 40, ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${vals.length * w} 130`); svg.style.width = '100%'; svg.style.maxWidth = '520px';
    vals.forEach((v, i) => {
      const bh = (v / max) * 90, r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', i * w + 6); r.setAttribute('y', 100 - bh); r.setAttribute('width', w - 12); r.setAttribute('height', bh); r.setAttribute('rx', 4); r.setAttribute('fill', color); svg.append(r);
      const t = document.createElementNS(ns, 'text'); t.setAttribute('x', i * w + w / 2); t.setAttribute('y', 118); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', 'currentColor'); t.textContent = labels[i]; svg.append(t);
      const n = document.createElementNS(ns, 'text'); n.setAttribute('x', i * w + w / 2); n.setAttribute('y', 96 - bh); n.setAttribute('text-anchor', 'middle'); n.setAttribute('font-size', '9'); n.setAttribute('fill', 'currentColor'); n.textContent = v || ''; svg.append(n);
    });
    return svg;
  };
  SP.beep = () => { try { const a = new AudioContext(), o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 880; o.start(); o.stop(a.currentTime + 0.25); } catch (e) {} };
})();
