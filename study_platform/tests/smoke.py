"""اختبار دخان: python tests/smoke.py   (يحتاج playwright + متصفح Chromium)"""
import os, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get("SMOKE_URL") or (ROOT / "index.html").as_uri()
EXE = next((x for x in ("/opt/pw-browsers/chromium",) if os.path.isfile(x)), None)
errors, fails = [], []


def check(cond, msg):
    print(("✓ " if cond else "✗ ") + msg)
    if not cond:
        fails.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type in ("error", "warning") and print("   [console]", m.text[:200]))
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errors.append(m.text))
    pg.goto(URL)

    routes = ["home", "desk", "classes", "classes/c1", "teachers", "students", "notes", "files", "handouts", "stickers", "share",
              "study", "cards", "cards/" + pg.evaluate("SP.state.decks[0].id"), "quizzes", "tasks", "progress", "settings", "search/%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A7%D8%AA"]
    for r in routes:
        pg.evaluate(f"location.hash='#/{r}'"); pg.wait_for_timeout(60)
        check(pg.locator("#main h1").count() >= 1 or pg.locator("#main .card").count() > 0, f"route {r} renders")
    check(len(pg.locator("#nav a").all()) == 16, "16 nav sections")

    # معلم ينشئ صفاً ويضيف فويزاً
    pg.select_option("#who", "t1"); pg.evaluate("location.hash='#/classes'")
    pg.click("text=إنشاء صف"); pg.fill(".md input", "العلوم"); pg.click(".md button:text-is(\"إنشاء\")")
    check(pg.evaluate("SP.state.classes.length") == 2, "teacher creates class")
    pg.evaluate("location.hash='#/quizzes'"); pg.click("#main >> text=فويز جديد")
    pg.fill(".md input[placeholder='عنوان الفويز']", "فويز العلوم"); pg.fill(".md input[placeholder='نص السؤال']", "ما عاصمة العراق؟")
    for i, t in enumerate(["أربيل", "بغداد", "البصرة", "الموصل"]):
        pg.fill(f".md input[placeholder='خيار {i+1}']", t)
    pg.locator(".md input[type=radio]").nth(1).check(); pg.click(".md button:text-is(\"حفظ\")")
    check(pg.evaluate("SP.state.quizzes.length") == 2, "teacher creates quiz")

    # طالب يحل الفويز الأول ويظهر في الترتيب
    pg.select_option("#who", "s1"); pg.evaluate("location.hash='#/quizzes'")
    pg.locator("#main .card", has_text="الأساسيات").locator("text=ابدأ").click()
    pg.locator("label.opt").nth(1).click(); pg.locator("label.opt").nth(5).click(); pg.fill("input[placeholder='إجابتك']", "25")
    pg.click("text=تسليم")
    check(pg.evaluate("SP.state.results[0].score") == 3, "student quiz graded 3/3")

    # ملاحظة + ملف + ملزمة
    pg.evaluate("location.hash='#/notes'"); pg.click("text=ملاحظة جديدة"); pg.fill(".md input >> nth=0", "درس الجبر"); pg.fill(".md textarea", "x + 2 = 5"); pg.click(".md button:text-is(\"حفظ\")")
    check(pg.evaluate("SP.state.notes.length") == 2, "note created")
    tmp = Path(tempfile.mkdtemp()) / "hello.txt"; tmp.write_text("مرحبا")
    pg.evaluate("location.hash='#/files'"); pg.set_input_files("#main input[type=file]", str(tmp)); pg.wait_for_timeout(400)
    check(pg.evaluate("SP.state.files.length") == 1 and pg.locator("#main >> text=hello.txt").count() > 0, "file uploaded + shown")
    blob_ok = pg.evaluate("SP.idb.get(SP.state.files[0].id).then(b=>b.text())")
    check(blob_ok == "مرحبا", "file content stored in IndexedDB")
    pg.evaluate("location.hash='#/handouts'"); pg.click("text=ملزمة من ملاحظاتي"); pg.locator(".md input[type=checkbox]").first.check(); pg.click(".md button:text-is(\"إنشاء\")"); pg.wait_for_timeout(400)
    check(pg.evaluate("SP.state.files.filter(f=>f.kind==='handout').length") == 1, "handout built from notes")

    # ملصقات + مشاركة + بطاقات + بحث
    pg.evaluate("location.hash='#/stickers'"); pg.click("#main button.emo >> nth=0"); pg.click("text=＋ >> nth=0")
    check(pg.evaluate("SP.state.boards.s1.length") == 2, "stickers added")
    pg.evaluate("location.hash='#/share'"); pg.fill("#main textarea", "معلومة: π ≈ 3.14"); pg.click("#main >> text=نشر")
    check(pg.evaluate("SP.state.posts.length") == 2, "post shared")
    pg.evaluate("location.hash='#/cards/" + pg.evaluate("SP.state.decks[0].id") + "/study'"); pg.click(".flash"); pg.click("text=عرفتها")
    check(pg.evaluate("SP.state.decks[0].cards.filter(c=>c.box===2).length") == 1, "flashcard leitner box advanced")
    pg.fill("#gsearch", "الجبر"); pg.press("#gsearch", "Enter"); pg.wait_for_timeout(100)
    check(pg.locator("#main >> text=درس الجبر").count() > 0, "global search finds note")


    # ---------- دراسة ----------
    import base64
    pg.select_option("#who", "s1"); pg.evaluate("location.hash='#/desk'"); pg.wait_for_timeout(100)
    check(pg.locator("#main >> text=دفتر تجريبي").count() > 0, "desk lists sample notebook")
    pg.locator("#main .doccard").first.click(); pg.wait_for_timeout(400)
    check(pg.locator(".pg").count() == 2, "notebook opens with 2 pages")
    n0 = pg.evaluate("SP.state.docs[0].pages[0].a.length")
    box = pg.locator(".pg svg.ink").first.bounding_box()
    pg.mouse.move(box["x"] + 100, box["y"] + 400); pg.mouse.down(); pg.mouse.move(box["x"] + 200, box["y"] + 430, steps=8); pg.mouse.up()
    check(pg.evaluate("SP.state.docs[0].pages[0].a.length") == n0 + 1, "pen stroke saved")
    pg.click(".tb[title='سهم']"); pg.mouse.move(box["x"] + 300, box["y"] + 500); pg.mouse.down(); pg.mouse.move(box["x"] + 380, box["y"] + 560, steps=5); pg.mouse.up()
    check(pg.evaluate("SP.state.docs[0].pages[0].a.at(-1).t") == "arrow", "arrow drawn")
    pg.click(".tb[title='نص']"); pg.mouse.click(box["x"] + 700, box["y"] + 540); pg.keyboard.type("ملاحظة على الدرس"); pg.click(".tb[title='تحريك']")
    check(pg.evaluate("SP.state.docs[0].pages[0].a.some(a=>a.t==='text'&&a.v.includes('ملاحظة على الدرس'))"), "text typed on page")
    pg.click(".tb[title='تراجع']")
    pg.click(".tb[title='ممحاة']"); cnt = pg.evaluate("SP.state.docs[0].pages[0].a.length")
    pg.locator(".pg .obj.stk").first.click()
    check(pg.evaluate("SP.state.docs[0].pages[0].a.length") == cnt - 1, "eraser removes sticker")
    pg.click(".tb[title='تراجع']")
    check(pg.evaluate("SP.state.docs[0].pages[0].a.length") == cnt, "undo restores")
    png = Path(tempfile.mkdtemp()) / "pic.png"
    import zlib, struct
    def _png(w, hh):
        raw = b"".join(b"\x00" + bytes([30, 80, 160]) * w for _ in range(hh))
        ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, hh, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
    png.write_bytes(_png(40, 30))
    pg.set_input_files("#desk-media", str(png)); pg.wait_for_timeout(500)
    check(pg.evaluate("SP.state.docs[0].pages.some(p=>p.a.some(a=>a.t==='img'))") and pg.locator(".pg .obj.img img").count() == 1, "image inserted onto page")
    pg.evaluate("() => { window.__saved=null; SP.saveFile=async(n,b)=>{window.__saved={n, b:new Uint8Array(await b.arrayBuffer())}}; }")
    pg.click(".tb[title='تصدير PDF']"); pg.wait_for_function("window.__saved", timeout=15000)
    info = pg.evaluate("PDFLib.PDFDocument.load(window.__saved.b).then(d=>({pages:d.getPageCount(), head:String.fromCharCode(...window.__saved.b.slice(0,5)), name:window.__saved.n}))")
    check(info["head"] == "%PDF-" and info["pages"] == 2, f"notebook exports to PDF ({info})")
    # PDF حقيقي
    b64 = pg.evaluate("""(async()=>{const d=await PDFLib.PDFDocument.create(); for(let i=0;i<3;i++){const p=d.addPage([595,842]); p.drawText('Page '+(i+1),{x:50,y:780,size:30});} const b=await d.save(); let s=''; b.forEach(c=>s+=String.fromCharCode(c)); return btoa(s);})()""")
    pdf = Path(tempfile.mkdtemp()) / "lesson.pdf"; pdf.write_bytes(base64.b64decode(b64))
    pg.evaluate("location.hash='#/desk'"); pg.wait_for_timeout(100); pg.set_input_files("#desk-upload", str(pdf)); pg.wait_for_timeout(1500)
    check(pg.locator(".pg").count() == 3, "uploaded PDF opens with 3 pages")
    painted = pg.evaluate("(()=>{const c=document.querySelector('.pg canvas.bg');const d=c.getContext('2d').getImageData(0,0,c.width,c.height/6).data;let dark=0;for(let i=0;i<d.length;i+=4)if(d[i]<100)dark++;return dark})()")
    check(painted > 50, "PDF page rendered by pdf.js")
    box = pg.locator(".pg svg.ink").first.bounding_box(); pg.click(".tb[title='تظليل']")
    pg.mouse.move(box["x"] + 40, box["y"] + 60); pg.mouse.down(); pg.mouse.move(box["x"] + 250, box["y"] + 60, steps=6); pg.mouse.up()
    pg.evaluate("window.__saved=null"); pg.click(".tb[title='تصدير PDF']"); pg.wait_for_function("window.__saved", timeout=15000)
    check(pg.evaluate("PDFLib.PDFDocument.load(window.__saved.b).then(d=>d.getPageCount())") == 3, "annotated PDF exports with same page count")
    pg.evaluate("location.hash='#/files'"); pg.set_input_files("#main input[type=file]", str(pdf)); pg.wait_for_timeout(400)
    pg.locator("#main >> text=افتح في دراسة").first.click(); pg.wait_for_timeout(1200)
    check(pg.locator(".pg").count() == 3, "file opens in desk from Files")

    # عزل: مريم لا ترى ملاحظات/ملفات علي الشخصية
    pg.select_option("#who", "s2"); pg.evaluate("location.hash='#/notes'")
    check(pg.locator("#main >> text=درس الجبر").count() == 0, "other student can't see private note")
    pg.evaluate("location.hash='#/files'")
    check(pg.locator("#main >> text=hello.txt").count() == 0, "other student can't see private file")

    # مؤقت + وضع ليلي + جوال
    pg.evaluate("location.hash='#/study'"); pg.click("#main >> text=ابدأ"); pg.wait_for_timeout(1300)
    check(":" in pg.inner_text("#mini"), "mini timer shows while running")
    pg.click("#theme"); check(pg.evaluate("document.documentElement.getAttribute('data-theme')==='dark'"), "dark mode")
    pg.set_viewport_size({"width": 390, "height": 800}); pg.click("#burger")
    check(pg.evaluate("document.body.classList.contains('nav-open')"), "mobile nav opens")
    pg.screenshot(path=str(ROOT / "tests" / "mobile.png"))
    pg.set_viewport_size({"width": 1280, "height": 900}); pg.evaluate("location.hash='#/home'"); pg.screenshot(path=str(ROOT / "tests" / "home.png"))
    b.close()

check(not errors, "no console/page errors" + (": " + "; ".join(errors[:3]) if errors else ""))
print("FAILED" if fails else "ALL PASSED"); sys.exit(1 if fails else 0)
