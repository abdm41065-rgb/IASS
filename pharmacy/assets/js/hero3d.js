/* ── مشهد الواجهة ثلاثي الأبعاد ────────────────────────────────────────────
   قطرة العناية: كرة وقمع بلون العلامة، تدور ببطء داخل حلقة فيروزية،
   مبنية بمحرّك PlayCanvas.

   قواعد التشغيل — المشهد كماليّ لا وظيفي، فلا يُسمح له بإفساد الصفحة:
     • لا يُحمَّل إطلاقاً على الشاشات الصغيرة أو عند تفضيل تقليل الحركة.
     • إذا تعذّر تحميل المحرّك أو فشل الإنشاء، يبقى الرسم الثابت ظاهراً.
     • يتوقّف الرسم كلياً حين يخرج المشهد من الشاشة أو تُخفى اللسان.
   ------------------------------------------------------------------------ */
(function (window, document) {
  'use strict';

  var ENGINE_URL = 'https://cdn.jsdelivr.net/npm/playcanvas@1.74.0/build/playcanvas.min.js';
  var LOAD_TIMEOUT = 4000;

  function canRun() {
    if (!window.matchMedia) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!window.matchMedia('(min-width: 900px)').matches) return false;
    // بلا WebGL لا فائدة من تحميل المحرّك أصلاً
    try {
      var probe = document.createElement('canvas');
      return !!(probe.getContext('webgl') || probe.getContext('experimental-webgl'));
    } catch (err) { return false; }
  }

  function loadEngine() {
    return new Promise(function (resolve, reject) {
      if (window.pc && window.pc.Application) { resolve(); return; }
      var tag = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('انتهت مهلة تحميل المحرّك'));
      }, LOAD_TIMEOUT);

      tag.src = ENGINE_URL;
      tag.async = true;
      tag.onload = function () {
        if (settled) return;
        settled = true; clearTimeout(timer);
        window.pc && window.pc.Application ? resolve() : reject(new Error('المحرّك غير متاح'));
      };
      tag.onerror = function () {
        if (settled) return;
        settled = true; clearTimeout(timer);
        reject(new Error('تعذّر تحميل المحرّك'));
      };
      document.head.appendChild(tag);
    });
  }

  function material(pc, r, g, b, gloss) {
    var m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(r, g, b);
    m.specular = new pc.Color(1, 1, 1);
    // الاسمان يغطّيان اختلاف الإصدارات في تسمية اللمعان
    m.shininess = gloss;
    m.gloss = gloss / 100;
    m.update();
    return m;
  }

  function build(host, canvas) {
    var pc = window.pc;

    var app = new pc.Application(canvas, {
      graphicsDeviceOptions: { alpha: true, antialias: true, preserveDrawingBuffer: false }
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.scene.ambientLight = new pc.Color(0.62, 0.70, 0.82);

    var camera = new pc.Entity('camera');
    camera.addComponent('camera', { clearColor: new pc.Color(0, 0, 0, 0), fov: 34 });
    camera.setPosition(0, 0, 8.4);
    app.root.addChild(camera);

    var key = new pc.Entity('key-light');
    key.addComponent('light', { type: 'directional', color: new pc.Color(1, 1, 1), intensity: 1.15 });
    key.setEulerAngles(38, 22, 0);
    app.root.addChild(key);

    var rim = new pc.Entity('rim-light');
    rim.addComponent('light', { type: 'directional', color: new pc.Color(0.55, 0.80, 0.95), intensity: 0.75 });
    rim.setEulerAngles(-24, -140, 0);
    app.root.addChild(rim);

    var blue = material(pc, 0.22, 0.41, 0.86, 82);
    var aqua = material(pc, 0.32, 0.72, 0.82, 68);

    // الحامل: كل شيء يدور معه، والميل يُطبَّق عليه أيضاً
    var pivot = new pc.Entity('pivot');
    app.root.addChild(pivot);

    var drop = new pc.Entity('drop');
    pivot.addChild(drop);

    var bulb = new pc.Entity('bulb');
    bulb.addComponent('render', { type: 'sphere', material: blue });
    bulb.setLocalPosition(0, -0.45, 0);
    bulb.setLocalScale(2.05, 2.05, 2.05);
    drop.addChild(bulb);

    var tip = new pc.Entity('tip');
    tip.addComponent('render', { type: 'cone', material: blue });
    tip.setLocalPosition(0, 1.02, 0);
    tip.setLocalScale(1.5, 1.62, 1.5);
    drop.addChild(tip);

    var ring = new pc.Entity('ring');
    ring.addComponent('render', { type: 'torus', material: aqua });
    ring.setLocalScale(3.5, 3.5, 3.5);
    ring.setLocalEulerAngles(74, 0, 16);
    pivot.addChild(ring);

    // الميل يتبع المؤشّر بلطف، ويعود إلى الوضع المحايد عند مغادرته
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0, spin = 0;

    function onPointer(ev) {
      var box = host.getBoundingClientRect();
      targetY = ((ev.clientX - box.left) / box.width - 0.5) * 16;
      targetX = ((ev.clientY - box.top) / box.height - 0.5) * 10;
    }
    function onLeave() { targetX = 0; targetY = 0; }

    host.addEventListener('pointermove', onPointer);
    host.addEventListener('pointerleave', onLeave);

    app.on('update', function (dt) {
      var step = Math.min(dt * 3.2, 1);
      currentX += (targetX - currentX) * step;
      currentY += (targetY - currentY) * step;
      spin += dt * 13;
      pivot.setEulerAngles(currentX, spin + currentY, 0);
      ring.rotateLocal(0, dt * 9, 0);
    });

    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (w > 0 && h > 0) app.resizeCanvas(w, h);
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
    else window.addEventListener('resize', resize);

    app.start();

    // إيقاف الرسم حين يغيب المشهد عن العين — لا دورة رسم بلا مشاهد
    var visible = true, onScreen = true;
    function sync() { app.autoRender = visible && onScreen; }

    document.addEventListener('visibilitychange', function () {
      visible = document.visibilityState === 'visible';
      sync();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        sync();
      }, { threshold: 0.05 }).observe(host);
    }

    return app;
  }

  function init() {
    var host = document.querySelector('[data-hero-3d]');
    if (!host) return;
    var canvas = host.querySelector('canvas');
    if (!canvas || !canRun()) return;

    loadEngine()
      .then(function () {
        build(host, canvas);
        host.setAttribute('data-hero-3d', 'live');   // يخفي الرسم الثابت عبر CSS
      })
      .catch(function () {
        // الرسم الثابت هو الحالة الافتراضية، فلا حاجة لأي إجراء
      });
  }

  window.HMHero3D = { init: init };
})(window, document);
