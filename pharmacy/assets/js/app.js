/* ── منطق الموقع ───────────────────────────────────────────────────────────
   عرض المنتجات، التصفية والبحث، السلة، وإرسال الطلب عبر واتساب.
   لا يوجد خادم: السلة محفوظة في متصفّح الزبون، والطلب يصل كرسالة جاهزة.
   ------------------------------------------------------------------------ */
(function (window, document) {
  'use strict';

  var CFG = window.HM_CONFIG;
  var CATS = window.HM_CATEGORIES;
  var ITEMS = window.HM_PRODUCTS;
  var STORE_KEY = 'hm_cart_v1';

  var byId = {};
  ITEMS.forEach(function (p) { byId[p.id] = p; });

  var money = CFG.currency.format;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ── الرسوم التوضيحية للعبوات ───────────────────────────────────────────
     رسم خطّي موحّد لكل شكل عبوة، يُستعمل ما دام حقل image فارغاً.
     عند إضافة صور حقيقية للمنتجات تحلّ محلّه تلقائياً.                     */

  var SHAPES = {
    bottle: '<path d="M66 30h28v16c0 6 3 8 8 12 8 6 12 14 12 24v42c0 10-7 16-17 16H63c-10 0-17-6-17-16v-42c0-10 4-18 12-24 5-4 8-6 8-12V30Z"/>' +
            '<path d="M62 22h36v8H62z"/><path d="M50 96h60"/><path d="M58 112h30"/>',
    tube:   '<path d="M56 46h48l-6 84c-1 8-6 12-14 12H76c-8 0-13-4-14-12l-6-84Z"/>' +
            '<path d="M52 34h56v12H52z"/><path d="M66 26h32v8H66z"/><path d="M62 74h36"/><path d="M62 90h24"/>',
    pump:   '<path d="M52 56h56v78c0 8-5 12-13 12H65c-8 0-13-4-13-12V56Z"/>' +
            '<path d="M70 40h20v16H70z"/><path d="M78 40V26h22c4 0 6 3 6 6v4"/><path d="M52 88h56"/><path d="M62 106h28"/>',
    jar:    '<path d="M44 66h72v56c0 10-6 16-16 16H60c-10 0-16-6-16-16V66Z"/>' +
            '<path d="M38 46h84v20H38z"/><path d="M52 100h54"/><path d="M62 118h26"/>',
    dropper:'<path d="M60 56h40v78c0 8-5 12-12 12H72c-7 0-12-4-12-12V56Z"/>' +
            '<path d="M68 40h24v16H68z"/><path d="M74 40V22h12v18"/><path d="M80 66v52"/><path d="M60 92h40"/>',
    rollon: '<path d="M56 62c0-14 11-24 24-24s24 10 24 24v66c0 9-6 14-15 14H71c-9 0-15-5-15-14V62Z"/>' +
            '<path d="M64 62c0-9 7-16 16-16s16 7 16 16"/><path d="M56 104h48"/>',
    box:    '<path d="M48 40h64v104H48z"/><path d="M48 62h64"/><path d="M62 40v22"/>' +
            '<path d="M62 84h36"/><path d="M62 100h36"/><path d="M62 116h22"/>'
  };

  function illustration(product) {
    if (product.image) {
      return '<img src="' + esc(product.image) + '" alt="' + esc(product.name) + '" loading="lazy" decoding="async">';
    }
    var shape = SHAPES[product.form] || SHAPES.box;
    return '<svg class="hm-shot-art" viewBox="0 0 160 180" aria-hidden="true" focusable="false">' +
             '<g fill="none" stroke="currentColor" stroke-width="2.1" ' +
                'stroke-linecap="round" stroke-linejoin="round">' + shape + '</g>' +
           '</svg>';
  }

  /* ── السلة ──────────────────────────────────────────────────────────── */

  var cart = {};

  function loadCart() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      Object.keys(parsed).forEach(function (id) {
        // نتجاهل أي منتج حُذف من الكتالوج منذ آخر زيارة
        var qty = parseInt(parsed[id], 10);
        if (byId[id] && qty > 0) cart[id] = Math.min(qty, 99);
      });
    } catch (err) { cart = {}; }
  }

  function saveCart() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (err) { /* وضع التصفّح الخاص */ }
  }

  function cartCount() {
    return Object.keys(cart).reduce(function (sum, id) { return sum + cart[id]; }, 0);
  }

  function cartTotal() {
    return Object.keys(cart).reduce(function (sum, id) { return sum + byId[id].price * cart[id]; }, 0);
  }

  function setQty(id, qty) {
    if (!byId[id]) return;
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(qty, 99);
    saveCart();
    renderCart();
    syncCardStates();
    if (openPanelEl === prodPanel) renderDetail();
  }

  /* ── بطاقة المنتج ───────────────────────────────────────────────────── */

  function card(product) {
    var off = product.was && product.was > product.price
      ? Math.round((1 - product.price / product.was) * 100) : 0;

    var tags = (product.tags || []).map(function (t) {
      return '<span class="hm-tag">' + esc(t) + '</span>';
    }).join('');

    return '' +
      '<article class="hm-prod" data-prod="' + esc(product.id) + '" data-aos="fade-up">' +
        '<button class="hm-prod-open" type="button" data-open="' + esc(product.id) + '">' +
          '<span class="hm-sr">تفاصيل ' + esc(product.name) + '</span>' +
        '</button>' +
        '<div class="hm-shot">' +
          (off ? '<span class="hm-shot-off">خصم ' + off + '%</span>' : '') +
          illustration(product) +
        '</div>' +
        '<div class="hm-prod-body">' +
          '<p class="hm-prod-brand"><bdi>' + esc(product.brand) + '</bdi></p>' +
          '<h3 class="hm-prod-name">' + esc(product.name) + '</h3>' +
          '<p class="hm-prod-latin">' +
            '<bdi class="hm-latin-name">' + esc(product.latin) + '</bdi>' +
            '<span class="hm-latin-sep"> &middot; </span>' +
            '<bdi>' + esc(product.size) + '</bdi>' +
          '</p>' +
          '<p class="hm-prod-note">' + esc(product.note) + '</p>' +
          '<div class="hm-tag-row">' + tags + '</div>' +
        '</div>' +
        '<div class="hm-prod-foot">' +
          '<p class="hm-price">' +
            '<span class="hm-price-now">' + esc(money(product.price)) + '</span>' +
            (off ? '<s class="hm-price-was">' + esc(money(product.was)) + '</s>' : '') +
          '</p>' +
          '<button class="hm-btn hm-btn-primary hm-btn-sm" type="button" data-add="' + esc(product.id) + '">' +
            '<svg class="hm-icon hm-icon-sm" viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M12 5v14M5 12h14"/></svg>' +
            '<span data-add-label>أضف للسلة</span>' +
          '</button>' +
        '</div>' +
      '</article>';
  }

  /* ── الشبكة والتصفية ────────────────────────────────────────────────── */

  var state = { cat: 'all', query: '', sort: 'default', offersOnly: false };

  function visibleItems() {
    var q = state.query.trim().toLowerCase();
    var list = ITEMS.filter(function (p) {
      if (state.cat !== 'all' && p.cat !== state.cat) return false;
      if (state.offersOnly && !(p.was && p.was > p.price)) return false;
      if (!q) return true;
      var hay = (p.name + ' ' + p.latin + ' ' + p.brand + ' ' + p.note + ' ' + (p.tags || []).join(' ')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    if (state.sort === 'price-asc')  list.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });
    if (state.sort === 'name')       list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });
    return list;
  }

  function renderGrid() {
    var grid = $('[data-grid]');
    var countEl = $('[data-result-count]');
    if (!grid) return;

    var list = visibleItems();
    countEl.textContent = list.length === 0 ? 'لا نتائج'
                        : list.length === 1 ? 'منتج واحد'
                        : list.length === 2 ? 'منتجان'
                        : list.length + ' منتجاً';

    if (list.length === 0) {
      grid.innerHTML =
        '<div class="hm-empty hm-empty--grid">' +
          '<svg class="hm-icon hm-icon-lg" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>' +
          '<p>لم نجد منتجاً مطابقاً لبحثك.</p>' +
          '<p class="hm-empty-hint">جرّب اسم الماركة، أو اسألنا مباشرة وسنوفّره لك.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = list.map(card).join('');
    syncCardStates();
    if (window.HMReveal) window.HMReveal.refresh();
  }

  function syncCardStates() {
    $$('[data-add]').forEach(function (btn) {
      var qty = cart[btn.getAttribute('data-add')] || 0;
      var label = $('[data-add-label]', btn);
      btn.classList.toggle('is-in-cart', qty > 0);
      if (label) label.textContent = qty > 0 ? 'في السلة (' + qty + ')' : 'أضف للسلة';
    });
  }

  /* ── اللوحات الجانبية ───────────────────────────────────────────────── */

  var drawer, prodPanel, backdrop, openPanelEl = null, lastFocus = null;

  function openPanel(el) {
    // فتح لوحة بينما أخرى مفتوحة: نبدّل المحتوى دون إغلاق الخلفية
    var switching = openPanelEl && openPanelEl !== el;
    if (switching) {
      openPanelEl.classList.remove('is-open');
      openPanelEl.hidden = true;
    } else {
      lastFocus = document.activeElement;
      document.body.classList.add('is-locked');
    }

    openPanelEl = el;
    el.hidden = false;
    backdrop.hidden = false;

    // الإطار التالي حتى تلتقط المتصفّحات انتقال الفتح
    requestAnimationFrame(function () {
      el.classList.add('is-open');
      backdrop.classList.add('is-open');
      var close = $('[data-panel-close]', el);
      if (close) close.focus();
    });
  }

  function closePanel() {
    if (!openPanelEl) return;
    var el = openPanelEl;
    openPanelEl = null;
    el.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(function () {
      el.hidden = true;
      if (!openPanelEl) backdrop.hidden = true;
    }, 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function renderCart() {
    var list = $('[data-cart-list]');
    var totalEl = $('[data-cart-total]');
    var countEl = $('[data-cart-count]');
    var sendBtn = $('[data-send-order]');
    var ids = Object.keys(cart);

    var count = cartCount();
    countEl.textContent = count;
    countEl.hidden = count === 0;
    $('[data-cart-open]').setAttribute('aria-label', 'السلة، ' + count + ' منتج');

    if (ids.length === 0) {
      list.innerHTML =
        '<div class="hm-empty">' +
          '<svg class="hm-icon hm-icon-lg" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M6 7h12l-1 12H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>' +
          '<p>السلة فارغة.</p>' +
          '<p class="hm-empty-hint">أضف ما تحتاجه، ثم أرسل الطلب برسالة واحدة.</p>' +
        '</div>';
      totalEl.textContent = money(0);
      sendBtn.disabled = true;
      return;
    }

    sendBtn.disabled = false;
    list.innerHTML = ids.map(function (id) {
      var p = byId[id], qty = cart[id];
      return '' +
        '<li class="hm-line">' +
          '<div class="hm-line-shot">' + illustration(p) + '</div>' +
          '<div class="hm-line-main">' +
            '<p class="hm-line-name">' + esc(p.name) + '</p>' +
            '<p class="hm-line-meta"><bdi>' + esc(p.brand) + '</bdi> &middot; <bdi>' + esc(p.size) + '</bdi></p>' +
            '<p class="hm-line-price">' + esc(money(p.price * qty)) + '</p>' +
          '</div>' +
          '<div class="hm-step">' +
            '<button type="button" class="hm-step-btn" data-dec="' + esc(id) + '" aria-label="إنقاص كمية ' + esc(p.name) + '">' +
              '<svg class="hm-icon hm-icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>' +
            '</button>' +
            '<span class="hm-step-qty">' + qty + '</span>' +
            '<button type="button" class="hm-step-btn" data-inc="' + esc(id) + '" aria-label="زيادة كمية ' + esc(p.name) + '">' +
              '<svg class="hm-icon hm-icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
            '</button>' +
          '</div>' +
        '</li>';
    }).join('');

    totalEl.textContent = money(cartTotal());
  }

  function openCart() { openPanel(drawer); }

  /* ── لوحة تفاصيل المنتج ─────────────────────────────────────────────── */

  function detailHTML(p) {
    var off = p.was && p.was > p.price ? Math.round((1 - p.price / p.was) * 100) : 0;
    var tags = (p.tags || []).map(function (t) {
      return '<span class="hm-tag">' + esc(t) + '</span>';
    }).join('');

    return '' +
      '<div class="hm-detail-shot">' +
        (off ? '<span class="hm-shot-off">خصم ' + off + '%</span>' : '') +
        illustration(p) +
      '</div>' +
      '<div class="hm-detail-head">' +
        '<p class="hm-prod-brand"><bdi>' + esc(p.brand) + '</bdi></p>' +
        '<h3 id="hm-detail-title">' + esc(p.name) + '</h3>' +
        '<p class="hm-prod-latin"><bdi>' + esc(p.latin) + '</bdi> &middot; <bdi>' + esc(p.size) + '</bdi></p>' +
      '</div>' +
      '<div class="hm-tag-row">' + tags + '</div>' +
      '<p class="hm-detail-note">' + esc(p.note) + '</p>' +
      '<dl class="hm-detail-facts">' +
        '<div><dt>لمن يصلح</dt><dd>' + esc(p.who) + '</dd></div>' +
        '<div><dt>كيف يُستعمل</dt><dd>' + esc(p.use) + '</dd></div>' +
        '<div><dt>الحجم</dt><dd><bdi>' + esc(p.size) + '</bdi></dd></div>' +
      '</dl>' +
      '<p class="hm-detail-fine">' + esc(CFG.legal.advice) + '</p>';
  }

  function detailFootHTML(p) {
    var qty = cart[p.id] || 0;
    var off = p.was && p.was > p.price;

    return '' +
      '<div class="hm-detail-price">' +
        '<span class="hm-price-now">' + esc(money(p.price)) + '</span>' +
        (off ? '<s class="hm-price-was">' + esc(money(p.was)) + '</s>' : '') +
      '</div>' +
      (qty > 0
        ? '<div class="hm-detail-step">' +
            '<span>الكمية في السلة</span>' +
            '<div class="hm-step">' +
              '<button type="button" class="hm-step-btn" data-dec="' + esc(p.id) + '" aria-label="إنقاص الكمية">' +
                '<svg class="hm-icon hm-icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>' +
              '</button>' +
              '<span class="hm-step-qty">' + qty + '</span>' +
              '<button type="button" class="hm-step-btn" data-inc="' + esc(p.id) + '" aria-label="زيادة الكمية">' +
                '<svg class="hm-icon hm-icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<button class="hm-btn hm-btn-primary hm-detail-cta" type="button" data-cart-open>عرض السلة وإرسال الطلب</button>'
        : '<button class="hm-btn hm-btn-primary hm-detail-cta" type="button" data-add="' + esc(p.id) + '">' +
            '<svg class="hm-icon hm-icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
            '<span data-add-label>أضف للسلة</span>' +
          '</button>') +
      '<a class="hm-btn hm-btn-ghost hm-detail-ask" ' +
         'href="https://wa.me/' + CFG.contact.phoneIntl + '?text=' +
         encodeURIComponent('السلام عليكم، أريد الاستفسار عن: ' + p.name + ' (' + p.brand + ' — ' + p.size + ')') +
         '" target="_blank" rel="noopener">اسأل عن هذا المنتج</a>';
  }

  var openDetailId = null;

  function renderDetail() {
    if (!openDetailId) return;
    var p = byId[openDetailId];
    if (!p) return;
    $('[data-detail-body]').innerHTML = detailHTML(p);
    $('[data-detail-foot]').innerHTML = detailFootHTML(p);
  }

  function openDetail(id) {
    if (!byId[id]) return;
    openDetailId = id;
    renderDetail();
    $('[data-detail-body]').scrollTop = 0;
    openPanel(prodPanel);
  }

  function trapFocus(ev) {
    if (ev.key !== 'Tab' || !openPanelEl) return;
    var focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', openPanelEl)
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (focusables.length === 0) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }

  /* ── إرسال الطلب ────────────────────────────────────────────────────── */

  function orderText() {
    var lines = Object.keys(cart).map(function (id) {
      var p = byId[id];
      return '• ' + p.name + ' (' + p.brand + ' — ' + p.size + ') × ' + cart[id] + ' = ' + money(p.price * cart[id]);
    }).join('\n');

    return CFG.order.template
      .replace('{{items}}', lines)
      .replace('{{total}}', money(cartTotal()));
  }

  function sendOrder() {
    if (cartCount() === 0) return;
    var url = 'https://wa.me/' + CFG.contact.phoneIntl + '?text=' + encodeURIComponent(orderText());
    window.open(url, '_blank', 'noopener');
  }

  /* ── ربط بيانات الإعدادات بالصفحة ───────────────────────────────────── */

  function bindConfig() {
    $$('[data-cfg]').forEach(function (el) {
      var path = el.getAttribute('data-cfg').split('.');
      var value = path.reduce(function (obj, key) { return obj == null ? obj : obj[key]; }, CFG);
      if (value != null) el.textContent = value;
    });

    var tel = 'tel:+' + CFG.contact.phoneIntl;
    var wa = 'https://wa.me/' + CFG.contact.phoneIntl;
    $$('[data-link="tel"]').forEach(function (el) { el.href = tel; });
    $$('[data-link="whatsapp"]').forEach(function (el) { el.href = wa; });
    $$('[data-link="instagram"]').forEach(function (el) { el.href = CFG.contact.instagramUrl; });

    $$('[data-link="map"]').forEach(function (el) {
      if (CFG.contact.mapUrl) el.href = CFG.contact.mapUrl;
      else el.remove();   // لا نعرض زراً يقود إلى لا شيء
    });

    var hours = $('[data-hours]');
    if (hours) {
      hours.innerHTML = CFG.hours.map(function (row) {
        return '<div class="hm-hour"><span>' + esc(row.day) + '</span><span>' + esc(row.time) + '</span></div>';
      }).join('');
    }

    var year = $('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ── التصفية: عناصر التحكّم ─────────────────────────────────────────── */

  function buildChips() {
    var host = $('[data-chips]');
    if (!host) return;
    var all = [{ id: 'all', name: 'كل المنتجات' }].concat(CATS);
    host.innerHTML = all.map(function (c) {
      return '<button type="button" class="hm-chip" data-cat="' + esc(c.id) + '" ' +
             'aria-pressed="' + (c.id === state.cat) + '">' + esc(c.name) + '</button>';
    }).join('');
  }

  function setCat(id) {
    state.cat = id;
    $$('[data-cat]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-cat') === id));
    });
    renderGrid();
  }

  /* ── رأس الصفحة ─────────────────────────────────────────────────────── */

  function initHeader() {
    var header = $('[data-header]');
    var nav = $('[data-nav]');
    var toggle = $('[data-nav-toggle]');

    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    $$('a', nav).forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── التشغيل ────────────────────────────────────────────────────────── */

  function init() {
    drawer = $('[data-cart]');
    prodPanel = $('[data-detail]');
    backdrop = $('[data-backdrop]');

    bindConfig();
    loadCart();
    buildChips();
    renderGrid();
    renderCart();
    initHeader();

    document.addEventListener('click', function (ev) {
      var add = ev.target.closest('[data-add]');
      if (add) { var id = add.getAttribute('data-add'); setQty(id, (cart[id] || 0) + 1); return; }

      var inc = ev.target.closest('[data-inc]');
      if (inc) { var i = inc.getAttribute('data-inc'); setQty(i, (cart[i] || 0) + 1); return; }

      var dec = ev.target.closest('[data-dec]');
      if (dec) { var d = dec.getAttribute('data-dec'); setQty(d, (cart[d] || 0) - 1); return; }

      var open = ev.target.closest('[data-open]');
      if (open) { openDetail(open.getAttribute('data-open')); return; }

      var chip = ev.target.closest('[data-cat]');
      if (chip) { setCat(chip.getAttribute('data-cat')); return; }

      if (ev.target.closest('[data-cart-open]')) { openCart(); return; }
      if (ev.target.closest('[data-panel-close]') || ev.target.closest('[data-backdrop]')) { closePanel(); return; }
      if (ev.target.closest('[data-send-order]')) { sendOrder(); return; }

      var clear = ev.target.closest('[data-cart-clear]');
      if (clear) { cart = {}; saveCart(); renderCart(); syncCardStates(); return; }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && openPanelEl) closePanel();
      trapFocus(ev);
    });

    var search = $('[data-search]');
    var timer;
    search.addEventListener('input', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { state.query = search.value; renderGrid(); }, 160);
    });

    $('[data-sort]').addEventListener('change', function (ev) {
      state.sort = ev.target.value;
      renderGrid();
    });

    $('[data-offers-only]').addEventListener('change', function (ev) {
      state.offersOnly = ev.target.checked;
      renderGrid();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
