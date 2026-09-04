/* ── كشف العناصر عند التمرير ───────────────────────────────────────────────
   يقرأ نفس سمات AOS من الـ HTML ويطبّقها عبر IntersectionObserver.

   السمات المدعومة على أي عنصر:
     data-aos            fade-up | fade-down | fade-left | fade-right | zoom-in | fade-in
     data-aos-delay      بالميلي ثانية
     data-aos-duration   بالميلي ثانية
     data-aos-offset     بكسل — كم يدخل العنصر داخل الشاشة قبل التشغيل
     data-aos-once       "false" لإعادة الحركة عند كل دخول (الافتراضي مرة واحدة)

   HMReveal.refresh() تُستدعى بعد إضافة عناصر جديدة إلى الصفحة.
   ------------------------------------------------------------------------ */
(function (window, document) {
  'use strict';

  var DEFAULTS = { duration: 700, delay: 0, offset: 90, once: true };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var observer = null;
  var seen = new WeakSet();

  function settle(el) {
    el.addEventListener('transitionend', function onEnd(ev) {
      if (ev.propertyName !== 'opacity') return;
      el.classList.add('aos-settled');
      el.removeEventListener('transitionend', onEnd);
    });
  }

  function show(el) {
    var delay = parseInt(el.getAttribute('data-aos-delay'), 10);
    var duration = parseInt(el.getAttribute('data-aos-duration'), 10);
    el.style.transitionDelay = (isNaN(delay) ? DEFAULTS.delay : delay) + 'ms';
    el.style.transitionDuration = (isNaN(duration) ? DEFAULTS.duration : duration) + 'ms';
    el.classList.add('aos-animate');
    settle(el);
  }

  function hide(el) {
    el.classList.remove('aos-animate', 'aos-settled');
    el.style.transitionDelay = '0ms';
  }

  function build() {
    if (!('IntersectionObserver' in window)) return null;
    // الهامش السالب من الأسفل يؤخّر التشغيل حتى يدخل العنصر فعلاً داخل الشاشة
    return new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        var once = el.getAttribute('data-aos-once') !== 'false';
        if (entry.isIntersecting) {
          show(el);
          if (once) observer.unobserve(el);
        } else if (!once) {
          hide(el);
        }
      });
    }, { rootMargin: '0px 0px -' + DEFAULTS.offset + 'px 0px', threshold: 0.01 });
  }

  function revealAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-aos]'), show);
  }

  function refresh() {
    if (reduced || !observer) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-aos]'), function (el) {
      if (seen.has(el)) return;
      seen.add(el);
      // العناصر الظاهرة أصلاً في أول شاشة تُكشف فوراً بدون انتظار تمرير
      var box = el.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) { show(el); return; }
      observer.observe(el);
    });
  }

  function init() {
    // الصنف .js-reveal يضعه سكربت مضمّن في <head> لتفادي وميض المحتوى.
    // إذا كان المتصفح لا يدعم IntersectionObserver أو المستخدم يفضّل تقليل
    // الحركة، نرفع الصنف ونُظهر كل شيء فوراً.
    if (reduced || !('IntersectionObserver' in window)) {
      document.documentElement.classList.remove('js-reveal');
      revealAll();
      return;
    }
    document.documentElement.classList.add('js-reveal');
    observer = build();
    refresh();
  }

  window.HMReveal = { init: init, refresh: refresh };
})(window, document);
