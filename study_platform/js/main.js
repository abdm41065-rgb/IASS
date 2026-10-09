/* الموجّه والهيكل العام */
(function () {
  const SP = window.SP, h = SP.h;
  const NAV = ['home', 'desk', 'classes', 'teachers', 'students', 'notes', 'files', 'handouts', 'stickers', 'share', 'study', 'cards', 'quizzes', 'tasks', 'progress', 'settings'];
  SP.applyTheme = () => { const r = document.documentElement; if (SP.state.dark == null) r.removeAttribute('data-theme'); else r.setAttribute('data-theme', SP.state.dark ? 'dark' : 'light'); document.documentElement.style.setProperty('--fs', (SP.state.fontSize || 16) + 'px'); };
  SP.isDark = () => (SP.state.dark == null ? matchMedia('(prefers-color-scheme: dark)').matches : SP.state.dark);
  SP.setTheme = (d) => { SP.state.dark = d; SP.save(); SP.applyTheme(); };
  SP.toggleTheme = () => SP.setTheme(!SP.isDark());
  SP.fillWho = () => { const w = document.getElementById('who'); w.replaceChildren(...SP.state.users.map((u) => h('option', { value: u.id, selected: u.id === SP.state.me }, u.name + (u.role === 'teacher' ? ' · معلم' : ' · طالب')))); };
  const P = {
    desk: '<path d="M5 3h9l5 5v13H5z"/><path d="M9 17l5.5-5.5 2 2L11 19H9z"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    classes: '<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5"/>',
    teachers: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 4h6v6h-3"/>',
    students: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    notes: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>',
    files: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    handouts: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0 0 4h13"/>',
    stickers: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    share: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12z"/>',
    study: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    cards: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/>',
    quizzes: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17.5h.01"/>',
    tasks: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/>',
    progress: '<path d="M3 21h18M6 17v-6M11 17V5M16 17v-9M21 17v-3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  };
  const icon = (k) => { const s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`; return s; };
  const navEl = document.getElementById('nav'), main = document.getElementById('main');

  SP.route = () => {
    SP.cleanups.splice(0).forEach((f) => f());
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean), key = SP.views[parts[0]] ? parts[0] : 'home', v = SP.views[key];
    navEl.replaceChildren(...NAV.map((k) => h('a', { href: '#/' + k, class: k === key ? 'on' : '' }, icon(k), SP.views[k].label)));
    document.title = v.label + ' · منصة الدراسة';
    try { main.replaceChildren(v.render(parts.slice(1))); } catch (e) { console.error(e); main.replaceChildren(SP.empty('حدث خطأ غير متوقع في هذه الصفحة.')); }
    document.body.classList.remove('nav-open'); window.scrollTo(0, 0); SP.emit('route');
  };
  window.addEventListener('hashchange', SP.route);
  document.getElementById('who').addEventListener('change', (e) => { SP.state.me = e.target.value; SP.save(); SP.route(); });
  document.getElementById('theme').addEventListener('click', () => SP.toggleTheme());
  document.getElementById('burger').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.getElementById('gsearch').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) SP.go('search/' + encodeURIComponent(e.target.value.trim())); });
  const mini = document.getElementById('mini');
  (SP.listeners.tick = SP.listeners.tick || []).push(() => { mini.textContent = SP.timer.running ? '' + SP.fmtTime(SP.timer.left) : ''; });
  SP.applyTheme(); SP.fillWho(); SP.route();
})();
