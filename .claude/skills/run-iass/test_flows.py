#!/usr/bin/env python3
"""Interaction tests for the DOSE pages - the paths driver.mjs does not cover.

driver.mjs answers "does the page load clean and look right". This answers
"does the thing a visitor actually does still work": the booking message that
becomes a WhatsApp link, the mobile drawer, and the identity sheet's keyboard
behaviour. Static HTML, so it runs straight off file:// - no server.

    python3 .claude/skills/run-iass/test_flows.py

Exits 1 on the first failed assertion, so it gates an edit like driver.mjs.
"""

import sys
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HOME = (ROOT / "dose-agency.html").as_uri()
IDS = (ROOT / "identities.html").as_uri()
# npm/pip Playwright is newer than this image's browser build, so the bundled
# revision it looks for is absent. Point at the one that is here.
CHROME = "/opt/pw-browsers/chromium"

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'ok  ' if cond else 'FAIL'} {name}" + (f"\n         {detail}" if detail and not cond else ""))


def booking(page):
    """The form builds a WhatsApp message; the send links carry it encoded."""
    print("\nbooking form")
    page.goto(HOME, wait_until="load")
    page.wait_for_load_state("networkidle")
    page.locator("#contact").scroll_into_view_if_needed()

    # default state: one intent on, one service on
    preview = page.locator("#msgPreview")
    check("preview seeded on load", "مرحباً دوز إيجنسي" in preview.inner_text())

    page.locator('#intentChips .chip[data-intent="أطلب عرض سعر"]').click()
    page.locator('#serviceChips .chip[data-service="تصوير درون"]').click()
    page.fill("#fName", "د. سارة")
    page.fill("#fPhone", "0770 123 4567")
    page.fill("#fMsg", "بغداد، الكرادة")
    page.wait_for_timeout(300)

    text = preview.inner_text()
    check("intent is radio (only one on)",
          page.locator("#intentChips .chip.on").count() == 1)
    check("chosen intent in message", "أطلب عرض سعر" in text, text[:120])
    check("both services in message",
          "الهوية البصرية" in text and "تصوير درون" in text, text[:160])
    check("name in message", "الاسم: د. سارة" in text, text[:200])
    check("phone in message", "الهاتف: 0770 123 4567" in text)
    check("details in message", "التفاصيل: بغداد، الكرادة" in text)

    href = page.get_attribute("#sendWa", "href") or ""
    check("send link is a wa.me link", href.startswith("https://wa.me/"), href[:80])
    check("send link carries the same message", unquote(href.split("?text=")[-1]) == text)
    for sel in ("#dockWa", "#waPlain"):
        check(f"{sel} carries the same message",
              unquote((page.get_attribute(sel, "href") or "").split("?text=")[-1]) == text)

    # a service chip toggles back off; with none left the message says so
    # each click removes the element from the ".on" set, so re-query every
    # time instead of holding a stale list of locators
    while page.locator("#serviceChips .chip.on").count():
        page.locator("#serviceChips .chip.on").first.click()
        page.wait_for_timeout(120)
    check("no services -> 'لم أحدّد بعد'", "لم أحدّد بعد" in preview.inner_text())

    # Instagram cannot pre-fill, so it copies instead - and file:// is not a
    # secure context, so this exercises the clipboard failure branch.
    page.locator("#sendIg").click()
    page.wait_for_timeout(400)
    note = page.locator("#formNote")
    check("instagram shows a note either way", note.is_visible(), "note stayed hidden")

    before = page.url
    page.locator("#ctaForm").evaluate("f => f.requestSubmit ? f.requestSubmit() : f.submit()")
    page.wait_for_timeout(300)
    check("submit does not navigate", page.url == before)


def mobile_drawer(page):
    print("\nmobile drawer")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(HOME, wait_until="load")
    page.wait_for_load_state("networkidle")
    check("burger visible at 390px", page.locator("#burger").is_visible())
    page.locator("#burger").click()
    page.wait_for_timeout(600)
    check("drawer opens", page.locator("#menu").evaluate("m => m.classList.contains('open')"))
    check("body scroll locked", page.evaluate("document.body.classList.contains('locked')"))
    page.locator("#menu .menu-inner a[href='#contact']").click()
    page.wait_for_timeout(700)
    check("drawer closes on link", not page.locator("#menu").evaluate("m => m.classList.contains('open')"))
    check("body scroll released", not page.evaluate("document.body.classList.contains('locked')"))
    page.set_viewport_size({"width": 1280, "height": 900})


def sheet_a11y(page):
    print("\nidentity sheet keyboard")
    page.goto(IDS, wait_until="load")
    page.wait_for_load_state("networkidle")
    page.evaluate("document.querySelector('[data-open=\"shifa\"]').click()")
    page.wait_for_timeout(600)
    check("sheet opened", page.evaluate("document.getElementById('sheetWrap').classList.contains('open')"))
    check("focus moved into the sheet",
          page.evaluate("document.getElementById('sheet').contains(document.activeElement)"))
    for _ in range(6):
        page.keyboard.press("Tab")
    check("Tab stays inside the sheet",
          page.evaluate("document.getElementById('sheet').contains(document.activeElement)"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    check("Escape closes it", page.evaluate("document.getElementById('sheetWrap').hasAttribute('hidden')"))
    check("focus returns to the plate that opened it",
          page.evaluate("document.activeElement?.dataset?.open === 'shifa'"),
          page.evaluate("document.activeElement?.tagName"))


def main():
    logs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: m.type == "error" and logs.append(m.text))
        page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
        booking(page)
        mobile_drawer(page)
        sheet_a11y(page)
        browser.close()

    # images/ is intentionally absent; those 404s are the designed fallback
    real = [l for l in logs if "images/" not in l and "favicon" not in l
            and "fonts.g" not in l and "Failed to load resource" not in l]
    print(f"\n{len(passed)} passed, {len(failed)} failed")
    for f in failed:
        print(f"  failed: {f}")
    if real:
        print("unexpected console output:")
        for l in real:
            print(f"  {l}")
    sys.exit(1 if failed or real else 0)


if __name__ == "__main__":
    main()
