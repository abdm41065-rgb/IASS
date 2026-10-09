/* الموجّه والهيكل العام */
(function () {
  const SP = window.SP, h = SP.h;
  const NAV = ['home', 'classes', 'teachers', 'students', 'notes', 'files', 'handouts', 'stickers', 'share', 'study', 'cards', 'quizzes', 'tasks', 'progress', 'settings'];
  SP.applyTheme = () => { document.body.classList.toggle('dark', !!SP.state.dark); document.documentElement.style.setProperty('--fs', (SP.state.fontSize || 16) + 'px'); };
  SP.setTheme = (d) => { SP.state.dark = d; SP.save(); SP.applyTheme(); };
  SP.fillWho = () => { const w = document.getElementById('who'); w.replaceChildren(...SP.state.users.map((u) => h('option', { value: u.id, selected: u.id === SP.state.me }, (u.role === 'teacher' ? '👨‍🏫 ' : '🎓 ') + u.name))); };
  const navEl = document.getElementById('nav'), main = document.getElementById('main');

  SP.route = () => {
    SP.cleanups.splice(0).forEach((f) => f());
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean), key = SP.views[parts[0]] ? parts[0] : 'home', v = SP.views[key];
    navEl.replaceChildren(...NAV.map((k) => h('a', { href: '#/' + k, class: k === key ? 'on' : '' }, SP.views[k].icon + ' ' + SP.views[k].label)));
    document.title = v.label + ' · منصة الدراسة';
    try { main.replaceChildren(v.render(parts.slice(1))); } catch (e) { console.error(e); main.replaceChildren(SP.empty('حدث خطأ غير متوقع في هذه الصفحة.')); }
    document.body.classList.remove('nav-open'); window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', SP.route);
  document.getElementById('who').addEventListener('change', (e) => { SP.state.me = e.target.value; SP.save(); SP.route(); });
  document.getElementById('theme').addEventListener('click', () => SP.setTheme(!SP.state.dark));
  document.getElementById('burger').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.getElementById('gsearch').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) SP.go('search/' + encodeURIComponent(e.target.value.trim())); });
  const mini = document.getElementById('mini');
  (SP.listeners.tick = SP.listeners.tick || []).push(() => { mini.textContent = SP.timer.running ? '⏱️ ' + SP.fmtTime(SP.timer.left) : ''; });
  SP.applyTheme(); SP.fillWho(); SP.route();
})();
