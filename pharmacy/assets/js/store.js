/* ── طبقة التعديلات المحلية ────────────────────────────────────────────────
   تُحمَّل بعد config.js وcatalog.js وقبل بقية السكربتات.

   صفحة الإدارة (admin.html) تحفظ تعديلاتها في متصفّح الجهاز نفسه، وهذا
   الملف يطبّقها فوق البيانات الأصلية. لذلك:

     • ما تعدّله في الإدارة تراه فوراً في الموقع على جهازك أنت.
     • الزبائن يرون ما في الملفات المرفوعة على الاستضافة لا غير.
     • لنشر التعديل للجميع: صدّر catalog.js من صفحة الإدارة وارفعه بدله.

   هذا قيد بنية الموقع لا خلل فيه: لا يوجد خادم يحفظ التغييرات مركزياً.
   ------------------------------------------------------------------------ */
(function (window) {
  'use strict';

  var KEY_CATALOG = 'hm_admin_catalog_v1';
  var KEY_CONFIG  = 'hm_admin_config_v1';

  function read(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) { return false; }   // تصفّح خاص أو مساحة ممتلئة
  }

  /* الدمج يتجاهل الدوال ويحافظ عليها: currency.format دالة في الإعدادات
     الأصلية، ولا يمكن أن تصل من JSON، فلا يجوز أن يمحوها الدمج. */
  function merge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    Object.keys(patch).forEach(function (key) {
      var next = patch[key];
      if (next && typeof next === 'object' && !Array.isArray(next) &&
          base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        merge(base[key], next);
      } else if (typeof base[key] !== 'function') {
        base[key] = next;
      }
    });
    return base;
  }

  var overrides = { catalog: false, config: false };

  /* نسخة من بيانات الملفات كما هي قبل أي تعديل محلي — عليها يعتمد زر
     «استرجاع الأصل» في صفحة الإدارة. */
  var defaults = {
    products:   JSON.parse(JSON.stringify(window.HM_PRODUCTS || [])),
    categories: JSON.parse(JSON.stringify(window.HM_CATEGORIES || [])),
    config:     JSON.parse(JSON.stringify(window.HM_CONFIG || {}))   // الدوال تسقط هنا وهذا مقصود
  };

  var catalog = read(KEY_CATALOG);
  if (catalog && Array.isArray(catalog.products) && catalog.products.length) {
    window.HM_PRODUCTS = catalog.products;
    if (Array.isArray(catalog.categories) && catalog.categories.length) {
      window.HM_CATEGORIES = catalog.categories;
    }
    overrides.catalog = true;
  }

  var config = read(KEY_CONFIG);
  if (config) {
    merge(window.HM_CONFIG, config);
    overrides.config = true;
  }

  window.HM_STORE = {
    KEY_CATALOG: KEY_CATALOG,
    KEY_CONFIG: KEY_CONFIG,
    read: read,
    write: write,
    overrides: overrides,
    defaults: defaults,
    clear: function () {
      try {
        window.localStorage.removeItem(KEY_CATALOG);
        window.localStorage.removeItem(KEY_CONFIG);
      } catch (err) { /* لا شيء نفعله */ }
    }
  };
})(window);
