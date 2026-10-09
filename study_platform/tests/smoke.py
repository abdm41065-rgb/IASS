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
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errors.append(m.text))
    pg.goto(URL)

    routes = ["home", "classes", "classes/c1", "teachers", "students", "notes", "files", "handouts", "stickers", "share",
              "study", "cards", "cards/" + pg.evaluate("SP.state.decks[0].id"), "quizzes", "tasks", "progress", "settings", "search/%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A7%D8%AA"]
    for r in routes:
        pg.evaluate(f"location.hash='#/{r}'"); pg.wait_for_timeout(60)
        check(pg.locator("#main h1").count() >= 1 or pg.locator("#main .card").count() > 0, f"route {r} renders")
    check(len(pg.locator("#nav a").all()) == 15, "15 nav sections")

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
