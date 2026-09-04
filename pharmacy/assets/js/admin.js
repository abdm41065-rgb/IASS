/* ── لوحة الإدارة ──────────────────────────────────────────────────────────
   تحرير المنتجات والإعدادات، وتوليد ملفات الموقع الجاهزة للرفع.

   البيانات تُحفظ في localStorage على هذا الجهاز فقط (عبر store.js)، لأن
   الموقع ثابت بلا خادم. النشر للجميع يتم بتصدير الملف ورفعه.
   ------------------------------------------------------------------------ */
(function (window, document) {
  'use strict';

  var CFG   = window.HM_CONFIG;
  var STORE = window.HM_STORE;

  /* في النسخة ذات الملف الواحد يعيش الموقع واللوحة في صفحة واحدة، فتُحصر
     استعلامات كلٍّ منهما داخل جذره حتى لا يلتقط أحدهما عناصر الآخر.
     في الصفحات المنفصلة لا وجود للجذر، فيعود المدى إلى المستند كاملاً. */
  var ROOT = document.querySelector('[data-admin]') || document;

  var $  = function (s, r) { return (r || ROOT).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  var FORMS = [
    { id: 'bottle',  name: 'قنينة' },
    { id: 'tube',    name: 'أنبوب' },
    { id: 'pump',    name: 'مضخّة' },
    { id: 'jar',     name: 'علبة' },
    { id: 'dropper', name: 'قطّارة' },
    { id: 'rollon',  name: 'رول أون' },
    { id: 'box',     name: 'كرتون' }
  ];

  /* ── الحالة ─────────────────────────────────────────────────────────── */

  var products   = clone(window.HM_PRODUCTS);
  var categories = clone(window.HM_CATEGORIES);
  var settings   = clone({
    brand:    CFG.brand,
    contact:  CFG.contact,
    hours:    CFG.hours,
    delivery: CFG.delivery,
    order:    { template: CFG.order.template },
    legal:    CFG.legal
  });

  var dirty = false;
  var filter = { q: '', cat: 'all' };
  var editingId = null;

  function markDirty() {
    dirty = true;
    $('[data-save-bar]').classList.add('is-shown');
  }
  function markClean() {
    dirty = false;
    $('[data-save-bar]').classList.remove('is-shown');
  }

  var toastTimer;
  function toast(msg) {
    var el = $('[data-toast]');
    el.textContent = msg;
    el.classList.add('is-shown');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('is-shown'); }, 2600);
  }

  function persist() {
    var okA = STORE.write(STORE.KEY_CATALOG, { products: products, categories: categories });
    var okB = STORE.write(STORE.KEY_CONFIG, settings);
    if (okA && okB) { markClean(); toast('حُفظت التعديلات في هذا المتصفّح'); }
    else toast('تعذّر الحفظ — قد يكون المتصفّح في وضع التصفّح الخاص');
  }

  /* ── البوابة ────────────────────────────────────────────────────────── */

  var SESSION_KEY = 'hm_admin_unlocked';

  function unlock() {
    $('[data-gate]').hidden = true;
    $('[data-shell]').hidden = false;
    render();
  }

  function initGate() {
    var expected = String((CFG.admin && CFG.admin.passcode) || '');

    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') { unlock(); return; }
    } catch (err) { /* لا تخزين متاح، نطلب الرمز في كل مرة */ }

    $('[data-gate-form]').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var given = $('[data-pass]').value;
      if (given && given === expected) {
        try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) { /* لا شيء */ }
        unlock();
      } else {
        $('[data-gate-err]').textContent = 'الرمز غير صحيح.';
        $('[data-pass]').value = '';
        $('[data-pass]').focus();
      }
    });

    $('[data-lock]').addEventListener('click', function () {
      try { window.sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* لا شيء */ }
      window.location.reload();
    });
  }

  /* ── جدول المنتجات ──────────────────────────────────────────────────── */

  function catName(id) {
    var c = categories.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : id;
  }

  function visible() {
    var q = filter.q.trim().toLowerCase();
    return products.filter(function (p) {
      if (filter.cat !== 'all' && p.cat !== filter.cat) return false;
      if (!q) return true;
      return (p.name + ' ' + p.latin + ' ' + p.brand).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderRows() {
    var list = visible();
    $('[data-ad-count]').textContent = list.length + ' من ' + products.length;

    if (!list.length) {
      $('[data-ad-rows]').innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--hm-text-faint)">لا نتائج</td></tr>';
      return;
    }

    $('[data-ad-rows]').innerHTML = list.map(function (p) {
      return '' +
        '<tr>' +
          '<td>' +
            '<div class="ad-cell-name">' + esc(p.name) + '</div>' +
            '<div class="ad-cell-sub"><bdi>' + esc(p.brand) + '</bdi> · <bdi>' + esc(p.latin) + '</bdi></div>' +
          '</td>' +
          '<td>' + esc(catName(p.cat)) + '</td>' +
          '<td class="ad-cell-num">' + esc(p.size) + '</td>' +
          '<td>' +
            '<input class="ad-price-input" type="number" min="0" step="250" ' +
                   'value="' + Number(p.price) + '" data-price="' + esc(p.id) + '" ' +
                   'aria-label="سعر ' + esc(p.name) + '">' +
          '</td>' +
          '<td>' +
            '<input class="ad-price-input" type="number" min="0" step="250" ' +
                   'value="' + (p.was ? Number(p.was) : '') + '" data-was="' + esc(p.id) + '" ' +
                   'placeholder="—" aria-label="سعر ' + esc(p.name) + ' قبل الخصم">' +
          '</td>' +
          '<td>' +
            '<div class="ad-row-actions">' +
              '<button class="ad-mini" type="button" data-edit="' + esc(p.id) + '">تعديل</button>' +
              '<button class="ad-mini is-danger" type="button" data-del="' + esc(p.id) + '">حذف</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
    }).join('');
  }

  /* ── محرّر المنتج ───────────────────────────────────────────────────── */

  function field(label, name, value, opts) {
    opts = opts || {};
    var id = 'f-' + name;
    var input;

    if (opts.type === 'textarea') {
      input = '<textarea class="hm-textarea" id="' + id + '" name="' + name + '">' + esc(value) + '</textarea>';
    } else if (opts.type === 'select') {
      input = '<select class="hm-select" id="' + id + '" name="' + name + '">' +
        opts.options.map(function (o) {
          return '<option value="' + esc(o.id) + '"' + (o.id === value ? ' selected' : '') + '>' + esc(o.name) + '</option>';
        }).join('') + '</select>';
    } else {
      input = '<input class="hm-input" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' +
              (opts.type === 'number' ? ' min="0" step="250"' : '') +
              ' value="' + esc(value) + '"' +
              (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>';
    }

    return '<div class="hm-field"><label for="' + id + '">' + esc(label) + '</label>' + input +
           (opts.hint ? '<p class="ad-hint">' + esc(opts.hint) + '</p>' : '') + '</div>';
  }

  function openEditor(id) {
    var p = id ? products.filter(function (x) { return x.id === id; })[0] : null;
    editingId = id;

    $('[data-editor-title]').textContent = p ? 'تعديل المنتج' : 'منتج جديد';
    $('[data-editor-delete]').hidden = !p;

    var v = p || { name: '', latin: '', brand: '', cat: categories[0].id, size: '', price: '',
                   was: '', form: 'box', tags: [], note: '', who: '', use: '', image: '' };

    $('[data-editor-form]').innerHTML =
      field('اسم المنتج بالعربية', 'name', v.name) +
      field('الاسم على العبوة', 'latin', v.latin, { hint: 'كما هو مكتوب باللاتينية' }) +
      '<div class="ad-row">' +
        field('الماركة', 'brand', v.brand) +
        field('الحجم أو العدد', 'size', v.size, { placeholder: '50 مل' }) +
      '</div>' +
      '<div class="ad-row">' +
        field('القسم', 'cat', v.cat, { type: 'select', options: categories }) +
        field('شكل العبوة', 'form', v.form, { type: 'select', options: FORMS,
              hint: 'يحدّد الرسم التوضيحي عند غياب صورة' }) +
      '</div>' +
      '<div class="ad-row">' +
        field('السعر بالدينار', 'price', v.price, { type: 'number' }) +
        field('السعر قبل الخصم', 'was', v.was || '', { type: 'number', hint: 'اتركه فارغاً إن لا يوجد عرض' }) +
      '</div>' +
      field('الوسوم', 'tags', (v.tags || []).join('، '), { hint: 'افصل بينها بفاصلة' }) +
      field('نبذة قصيرة', 'note', v.note, { type: 'textarea', hint: 'سطر واحد يظهر على البطاقة' }) +
      field('لمن يصلح', 'who', v.who, { type: 'textarea' }) +
      field('كيف يُستعمل', 'use', v.use, { type: 'textarea' }) +
      field('مسار الصورة', 'image', v.image || '', { placeholder: 'assets/img/product.jpg',
            hint: 'اتركه فارغاً لاستعمال الرسم التوضيحي' });

    openPanel($('[data-editor]'));
  }

  function newId(cat) {
    var prefix = cat.slice(0, 2);
    var n = 1, id;
    do { id = prefix + '-' + String(n++).padStart(2, '0'); }
    while (products.some(function (p) { return p.id === id; }));
    return id;
  }

  function saveEditor() {
    var form = $('[data-editor-form]');
    var get = function (n) { return form.elements[n].value.trim(); };

    var price = parseInt(get('price'), 10);
    if (!get('name')) { toast('اكتب اسم المنتج'); form.elements.name.focus(); return; }
    if (!(price > 0)) { toast('السعر يجب أن يكون رقماً أكبر من صفر'); form.elements.price.focus(); return; }

    var wasRaw = get('was');
    var was = wasRaw === '' ? null : parseInt(wasRaw, 10);
    if (was !== null && !(was > price)) { toast('السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي'); return; }

    var data = {
      id:    editingId || newId(get('cat')),
      name:  get('name'),
      latin: get('latin'),
      brand: get('brand'),
      cat:   get('cat'),
      size:  get('size'),
      price: price,
      form:  get('form'),
      note:  get('note'),
      who:   get('who'),
      use:   get('use'),
      tags:  get('tags').split(/[،,]/).map(function (t) { return t.trim(); }).filter(Boolean),
      image: get('image') || null
    };
    if (was !== null) data.was = was;

    if (editingId) {
      var i = products.findIndex(function (p) { return p.id === editingId; });
      products[i] = data;
    } else {
      products.unshift(data);
    }

    closePanel();
    renderRows();
    markDirty();
    toast(editingId ? 'حُدّث المنتج' : 'أُضيف المنتج');
  }

  function deleteProduct(id) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!window.confirm('حذف «' + p.name + '» نهائياً من القائمة؟')) return;
    products = products.filter(function (x) { return x.id !== id; });
    if (editingId === id) closePanel();
    renderRows();
    markDirty();
    toast('حُذف المنتج');
  }

  /* ── اللوحة الجانبية ────────────────────────────────────────────────── */

  var openEl = null, lastFocus = null;

  function openPanel(el) {
    lastFocus = document.activeElement;
    openEl = el;
    el.hidden = false;
    $('[data-backdrop]').hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(function () {
      el.classList.add('is-open');
      $('[data-backdrop]').classList.add('is-open');
      var f = $('[data-panel-close]', el);
      if (f) f.focus();
    });
  }

  function closePanel() {
    if (!openEl) return;
    var el = openEl;
    openEl = null;
    editingId = null;
    el.classList.remove('is-open');
    $('[data-backdrop]').classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(function () {
      el.hidden = true;
      $('[data-backdrop]').hidden = true;
    }, 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ── الإعدادات ──────────────────────────────────────────────────────── */

  function renderSettings() {
    var s = settings;
    $('[data-settings-form]').innerHTML =
      '<div class="ad-fieldset">' +
        '<h3>الصيدلية</h3>' +
        '<div class="ad-row">' +
          field('الاسم', 'brand.name', s.brand.name) +
          field('الاسم المختصر', 'brand.shortName', s.brand.shortName) +
        '</div>' +
        '<div class="ad-row">' +
          field('الاسم باللاتينية', 'brand.latin', s.brand.latin) +
          field('الوصف المختصر', 'brand.tagline', s.brand.tagline) +
        '</div>' +
      '</div>' +

      '<div class="ad-fieldset">' +
        '<h3>التواصل</h3>' +
        '<div class="ad-row">' +
          field('الهاتف كما يُعرض', 'contact.phoneDisplay', s.contact.phoneDisplay) +
          field('الهاتف بالصيغة الدولية', 'contact.phoneIntl', s.contact.phoneIntl,
                { hint: 'أرقام فقط بلا + ولا مسافات — يُستعمل في واتساب والاتصال' }) +
        '</div>' +
        '<div class="ad-row">' +
          field('العنوان', 'contact.addressLine', s.contact.addressLine) +
          field('نقطة دالة', 'contact.addressHint', s.contact.addressHint) +
        '</div>' +
        '<div class="ad-row">' +
          field('حساب إنستغرام', 'contact.instagram', s.contact.instagram) +
          field('رابط إنستغرام', 'contact.instagramUrl', s.contact.instagramUrl) +
        '</div>' +
        field('رابط الخريطة', 'contact.mapUrl', s.contact.mapUrl,
              { hint: 'اتركه فارغاً ليختفي زر الخريطة من الموقع' }) +
      '</div>' +

      '<div class="ad-fieldset">' +
        '<h3>أوقات الدوام</h3>' +
        '<div data-hours-rows></div>' +
        '<div class="hm-btn-row">' +
          '<button class="hm-btn hm-btn-secondary hm-btn-sm" type="button" data-hour-add>أضف سطراً</button>' +
        '</div>' +
      '</div>' +

      '<div class="ad-fieldset">' +
        '<h3>التوصيل</h3>' +
        field('نطاق التوصيل', 'delivery.scope', s.delivery.scope) +
        field('حدود الخدمة', 'delivery.limit', s.delivery.limit) +
        field('داخل المدينة', 'delivery.inCity', s.delivery.inCity) +
        field('ملاحظة الأجور', 'delivery.note', s.delivery.note) +
      '</div>' +

      '<div class="ad-fieldset">' +
        '<h3>نصوص أخرى</h3>' +
        field('نص رسالة الطلب', 'order.template', s.order.template,
              { type: 'textarea', hint: '{{items}} تُستبدل بالمنتجات و{{total}} بالمجموع' }) +
        field('ملاحظة الأسعار', 'legal.priceNote', s.legal.priceNote, { type: 'textarea' }) +
        field('التنويه الطبي', 'legal.advice', s.legal.advice, { type: 'textarea' }) +
      '</div>';

    renderHours();
  }

  function renderHours() {
    $('[data-hours-rows]').innerHTML = settings.hours.map(function (h, i) {
      return '<div class="ad-hours-row">' +
        '<div class="hm-field"><label for="hd' + i + '">اليوم</label>' +
          '<input class="hm-input" id="hd' + i + '" value="' + esc(h.day) + '" data-hour-day="' + i + '"></div>' +
        '<div class="hm-field"><label for="ht' + i + '">الوقت</label>' +
          '<input class="hm-input" id="ht' + i + '" value="' + esc(h.time) + '" data-hour-time="' + i + '"></div>' +
        '<button class="ad-mini is-danger" type="button" data-hour-del="' + i + '" ' +
                'style="min-block-size:46px">حذف</button>' +
      '</div>';
    }).join('');
  }

  function setPath(path, value) {
    var parts = path.split('.');
    var obj = settings;
    for (var i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
  }

  /* ── توليد الملفات ──────────────────────────────────────────────────── */

  function header(extra) {
    return '/* ملفّ مولَّد من لوحة الإدارة — ' + new Date().toISOString().slice(0, 10) + '\n' +
           '   ارفعه بدل الملف القديم على الاستضافة لتصل التعديلات إلى الزبائن.\n' +
           (extra || '') +
           '*/\n\n';
  }

  // شرح الحقول لا ينجو من التوليد لأن JSON لا يحمل تعليقات، فنعيده هنا
  var CATALOG_DOC =
    '\n' +
    '   حقول المنتج:\n' +
    '     id     معرّف فريد لا يتكرّر — تغييره يفصل المنتج عن سلّات الزبائن\n' +
    '     name   الاسم بالعربية      latin  الاسم على العبوة\n' +
    '     brand  الماركة             cat    معرّف القسم من HM_CATEGORIES\n' +
    '     size   الحجم أو العدد      price  السعر بالدينار\n' +
    '     was    السعر قبل الخصم — غائب إذا لا يوجد عرض\n' +
    '     note   نبذة تظهر على البطاقة\n' +
    '     who    لمن يصلح            use    كيف يُستعمل\n' +
    '     form   شكل الرسم: bottle | tube | pump | jar | dropper | rollon | box\n' +
    '     tags   وسوم قصيرة          image  مسار صورة، أو null للرسم التوضيحي\n';

  function genCatalog() {
    return header(CATALOG_DOC) +
      'window.HM_CATEGORIES = ' + JSON.stringify(categories, null, 2) + ';\n\n' +
      'window.HM_PRODUCTS = ' + JSON.stringify(products, null, 2) + ';\n';
  }

  function genConfig() {
    var s = settings;
    return header() +
      'window.HM_CONFIG = {\n' +
      '  brand: '    + JSON.stringify(s.brand, null, 2).replace(/\n/g, '\n  ') + ',\n\n' +
      '  contact: '  + JSON.stringify(s.contact, null, 2).replace(/\n/g, '\n  ') + ',\n\n' +
      '  hours: '    + JSON.stringify(s.hours, null, 2).replace(/\n/g, '\n  ') + ',\n\n' +
      '  delivery: ' + JSON.stringify(s.delivery, null, 2).replace(/\n/g, '\n  ') + ',\n\n' +
      '  currency: {\n' +
      '    code: ' + JSON.stringify(CFG.currency.code) + ',\n' +
      '    format: function (value) {\n' +
      "      return Number(value).toLocaleString('en-US') + ' " + CFG.currency.code + "';\n" +
      '    }\n' +
      '  },\n\n' +
      '  order: { template: ' + JSON.stringify(s.order.template) + ' },\n\n' +
      '  admin: { passcode: ' + JSON.stringify(String((CFG.admin && CFG.admin.passcode) || '')) + ' },\n\n' +
      '  legal: ' + JSON.stringify(s.legal, null, 2).replace(/\n/g, '\n  ') + '\n' +
      '};\n';
  }

  var currentFile = { name: '', text: '' };

  function showFile(kind) {
    currentFile = kind === 'config'
      ? { name: 'config.js', text: genConfig() }
      : { name: 'catalog.js', text: genCatalog() };
    $('[data-code]').value = currentFile.text;
    $('[data-gen-label]').textContent = 'المحتوى أدناه يخصّ الملف: assets/js/' + currentFile.name;
  }

  function download(name, text, type) {
    try {
      var blob = new Blob([text], { type: (type || 'text/javascript') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('بدأ تنزيل ' + name);
    } catch (err) {
      toast('التنزيل ممنوع هنا — استعمل زر النسخ');
    }
  }

  function copyText(text) {
    var area = $('[data-code]');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast('نُسخ المحتوى'); },
        function () { area.select(); toast('حدّد المحتوى وانسخه يدوياً'); }
      );
    } else {
      area.select();
      toast('حدّد المحتوى وانسخه يدوياً');
    }
  }

  /* ── التبويبات ──────────────────────────────────────────────────────── */

  function showTab(name) {
    $$('[data-tab]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name));
    });
    $$('[data-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
    if (name === 'publish' && !currentFile.text) showFile('catalog');
  }

  /* ── التشغيل ────────────────────────────────────────────────────────── */

  function render() {
    $('[data-ad-cat]').innerHTML =
      '<option value="all">كل الأقسام</option>' +
      categories.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
    renderRows();
    renderSettings();
  }

  function init() {
    initGate();

    document.addEventListener('click', function (ev) {
      var t = ev.target;

      var tab = t.closest('[data-tab]');
      if (tab) { showTab(tab.getAttribute('data-tab')); return; }

      var edit = t.closest('[data-edit]');
      if (edit) { openEditor(edit.getAttribute('data-edit')); return; }

      var del = t.closest('[data-del]');
      if (del) { deleteProduct(del.getAttribute('data-del')); return; }

      if (t.closest('[data-add-product]')) { openEditor(null); return; }
      if (t.closest('[data-editor-save]')) { saveEditor(); return; }
      if (t.closest('[data-editor-delete]')) { deleteProduct(editingId); return; }
      if (t.closest('[data-panel-close]') || t.closest('[data-backdrop]')) { closePanel(); return; }
      if (t.closest('[data-save]')) { persist(); return; }

      if (t.closest('[data-discard]')) {
        if (!window.confirm('التراجع عن كل التعديلات غير المحفوظة؟')) return;
        window.location.reload();
        return;
      }

      var gen = t.closest('[data-gen]');
      if (gen) { showFile(gen.getAttribute('data-gen')); return; }

      if (t.closest('[data-copy]'))     { copyText(currentFile.text); return; }
      if (t.closest('[data-download]')) { download(currentFile.name, currentFile.text); return; }

      if (t.closest('[data-backup]')) {
        download('hayat-al-majd-backup.json',
                 JSON.stringify({ products: products, categories: categories, settings: settings }, null, 2),
                 'application/json');
        return;
      }

      if (t.closest('[data-hour-add]')) {
        settings.hours.push({ day: '', time: '' });
        renderHours();
        markDirty();
        return;
      }

      var hdel = t.closest('[data-hour-del]');
      if (hdel) {
        settings.hours.splice(parseInt(hdel.getAttribute('data-hour-del'), 10), 1);
        renderHours();
        markDirty();
        return;
      }

      if (t.closest('[data-reset]')) {
        if (!window.confirm('مسح كل التعديلات المحلية والعودة إلى ملفات الموقع؟ لا يمكن التراجع.')) return;
        STORE.clear();
        window.location.reload();
        return;
      }
    });

    // تعديل السعر مباشرة من الجدول
    document.addEventListener('input', function (ev) {
      var t = ev.target;

      var pid = t.getAttribute('data-price');
      if (pid) {
        var p = products.filter(function (x) { return x.id === pid; })[0];
        var val = parseInt(t.value, 10);
        if (p && val > 0) { p.price = val; markDirty(); }
        return;
      }

      var wid = t.getAttribute('data-was');
      if (wid) {
        var q = products.filter(function (x) { return x.id === wid; })[0];
        if (!q) return;
        var w = parseInt(t.value, 10);
        if (t.value === '' || !(w > 0)) delete q.was;
        else q.was = w;
        markDirty();
        return;
      }

      var day = t.getAttribute('data-hour-day');
      if (day !== null) { settings.hours[+day].day = t.value; markDirty(); return; }

      var time = t.getAttribute('data-hour-time');
      if (time !== null) { settings.hours[+time].time = t.value; markDirty(); return; }

      if (t.hasAttribute('data-ad-search')) { filter.q = t.value; renderRows(); return; }

      // حقول الإعدادات معرّفة بمسار داخل الكائن، مثل contact.phoneIntl
      if (t.name && t.name.indexOf('.') !== -1 && t.closest('[data-settings-form]')) {
        setPath(t.name, t.value);
        markDirty();
      }
    });

    document.addEventListener('change', function (ev) {
      if (ev.target.hasAttribute('data-ad-cat')) { filter.cat = ev.target.value; renderRows(); return; }

      if (ev.target.hasAttribute('data-restore')) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            if (!Array.isArray(data.products)) throw new Error('ملف غير صالح');
            products = data.products;
            if (Array.isArray(data.categories)) categories = data.categories;
            if (data.settings) settings = data.settings;
            render();
            markDirty();
            toast('استُرجعت النسخة — اضغط احفظ لتثبيتها');
          } catch (err) {
            toast('الملف غير صالح');
          }
        };
        reader.readAsText(file);
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && openEl) closePanel();
    });

    window.addEventListener('beforeunload', function (ev) {
      if (!dirty) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  init();
})(window, document);
