---
name: run-iass
description: Run, serve, screenshot and smoke-test the IASS static site (dose-agency.html, identities.html, index.html, invoice.html). Use when asked to run/start/preview/open the site, take a screenshot of a page or section, check a page for JS errors or layout overflow, or verify the two DOSE pages still link to each other.
---

# Run the IASS site

Static HTML — no build, no bundler, no package manager. Four independent
self-contained pages sit at the repo root; every stylesheet, script and logo
is inlined, so a page opens straight from disk.

Everything below is driven by **`.claude/skills/run-iass/driver.mjs`**, which
owns its own static server and a headless Chromium. Paths are relative to the
repo root (`/home/user/IASS`).

| Page | What it is |
| --- | --- |
| `dose-agency.html` | DOSE Agency home — Arabic RTL, scroll-driven, links to `identities.html` |
| `identities.html` | Brand-identity gallery — filter chips + a modal sheet per brand |
| `index.html` | A different, unrelated site (IAAS) |
| `invoice.html` | Standalone invoice document |

## Prerequisites

Chromium is already in the image. Only the Playwright bindings are missing —
Node for the driver, Python for the interaction tests:

```bash
npm i -g playwright
pip install playwright
```

Node commands are prefixed with `NODE_PATH=$(npm root -g)` so Node finds that
global install. The driver refuses to start with a usage hint if it can't.

## Run (agent path)

```bash
cd /home/user/IASS
NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs check
```

Loads every page at 1280×900 and 390×844, walks the full scroll height, and
reports per page/viewport. **Exit 1 on any failure**, so it works as a gate:

```
ok    dose-agency.html  desktop
      title="دوز إيجنسي — وكالة التسويق الطبي" dir=rtl hScroll=false brokenImgs=0
      counters: 5+ 150+ 100+ 12M+ 99% 24h 3x 24/7
      links: identities.html
...
all checks passed
```

It catches: uncaught JS errors, console errors, horizontal page overflow,
genuinely broken images, wrong `dir`, wrong settled counter values, and
same-repo links pointing at files that don't exist.

### The end-to-end flow

```bash
NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs flow
```

Home → nav across to `identities.html` → filter to أطباء → back to الكل → open
the صيدلية النور sheet → close with Escape. Prints each step's observed state
and writes `flow-sheet.png` and `flow-end.png`. Verified output:

```
  home loaded, bridge present: true
  nav -> identities.html
  landed on /identities.html
  filter: أطباء ->
  visible plates: 4
  filter: الكل
  open plate: noor
  sheet open: true
  Escape closes sheet
  sheet hidden: true

no JS errors. shots in /tmp/iass-run/
```

### Screenshots

```bash
NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs shot identities.html --section=#identities
NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs shot dose-agency.html --w=390 --h=844 --mobile
```

Each prints the path it wrote. Land in `/tmp/iass-run/` unless `--out=` is
given; `IASS_OUT=<dir>` moves the whole directory. `--full` captures the full
page, `--section=#id` scrolls that section into view first. Section ids on
`dose-agency.html`: `#about #services #work #clients #instagram #contact`,
plus `.bridge`; on `identities.html`: `#identities`.

**Always open the PNG afterwards.** These pages gate content behind
scroll-reveal, so a screenshot is the only way to know a section actually
painted.

### Poking it by hand

```bash
NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs serve
```

Prints `http://127.0.0.1:<random port>`. Ephemeral port on purpose — see
Gotchas.

## Run (human path)

Open `dose-agency.html` in a browser. `file://` is enough: both DOSE pages are
self-contained and link to each other relatively, so they work from a folder
with no server at all. This is also how the files are delivered to the client.

## Test

Two layers, both gates — each exits 1 on failure.

```bash
NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs check   # page health
python3 .claude/skills/run-iass/test_flows.py                            # interactions
```

`test_flows.py` covers what `check` cannot see — the paths a visitor actually
takes. It runs off `file://`, so it needs no server:

- **Booking form.** Picks an intent, toggles services, fills name/phone/details,
  then asserts the built message and that `#sendWa`, `#dockWa` and `#waPlain`
  all carry that exact text URL-encoded into their `wa.me` links. Also: intent
  behaves as a radio, deselecting every service falls back to `لم أحدّد بعد`,
  the Instagram button surfaces a note even when the clipboard is unavailable,
  and submitting does not navigate.
- **Mobile drawer** at 390px — burger opens it, `body.locked` is set, a link
  closes it and releases the scroll lock.
- **Identity sheet keyboard** — focus enters the sheet, Tab stays trapped
  inside, Escape closes it, focus returns to the plate that opened it.

Verified with 24 passing assertions, and verified to actually bite: renaming
the message's `الهاتف:` label made it report `FAIL phone in message` and exit 1.

## Gotchas

- **`chromium.launch()` fails with no `executablePath`.** npm ships a newer
  Playwright (1.62.1) than the browser baked into this image (build 1194), so
  it hunts for a revision that isn't there:
  `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/…`.
  The driver always passes `executablePath: '/opt/pw-browsers/chromium'` — a
  symlink to `chromium-1194/chrome-linux/chrome`. Override with `IASS_CHROME`.
- **`images/` does not exist, and that is by design.** Every
  `<img data-missing="images/…">` 404s; the page's own JS then removes the
  element and CSS paints a brand plate in its place. So a broken-image check
  must test `naturalWidth === 0 && has src` (the fallback deletes the node),
  and image 404s in the console must be filtered out — the driver does both.
- **Google Fonts is unreachable from this container** (`net::ERR_CONNECTION_RESET`
  on `fonts.googleapis.com`). Tajawal/Syne fall back to system faces.
  Screenshots stay valid for layout and colour, **not** for exact type metrics.
  The driver filters these from the error report.
- **Counters animate.** `.count` elements tick up from `0` when scrolled past.
  Read them before the animation lands and you get plausible-but-wrong values
  (`94%`, `23h`). `check` walks the whole page then waits 3.5s. Settled truth
  is `5+ 150+ 100+ 12M+ 99% 24h 3x 24/7`.
- **Don't `pkill -f "http.server"`.** Doing that during development killed the
  agent's own shell (exit 144) because the pattern matched the parent process
  tree. The driver starts and stops its own server on an ephemeral port so no
  cleanup command is ever needed.
- **The driver clicks via `page.evaluate(el.click())`, not `page.click()`.**
  During development a `page.click()` on a plate timed out with
  `<html> intercepts pointer events` — the smooth-scroll animation kept moving
  the target after Playwright scrolled to it. It does not reproduce on the
  current page, but the pages carry a fixed nav (z-index 8000) and a fixed dock
  (8500), so driving the element directly stays the safe default. The driver
  also injects `html{scroll-behavior:auto!important}` after load.
- **`node - <<'EOF'` with top-level `await` fails** with
  `ERR_AMBIGUOUS_MODULE_SYNTAX`. Write the scratch script to a `.cjs` file and
  wrap it in an async IIFE.
- **Piping hides the exit code.** `driver.mjs check | tail` reports `0` even
  when checks failed — that's `tail`'s status. Redirect instead:
  `driver.mjs check > /tmp/chk.txt 2>&1; echo $?`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `playwright not resolvable` | `npm i -g playwright`, then prefix with `NODE_PATH=$(npm root -g)` |
| `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-…` | You dropped `executablePath`. Use the driver, or set `IASS_CHROME` |
| Screenshot shows empty sections | You didn't scroll first. `shot` does; hand-rolled scripts must |
| `check` reports a counter like `94%` | Animation hadn't landed — increase the settle wait |
| `<html> intercepts pointer events` | Click through `page.evaluate(() => el.click())` |
| `test_flows.py` times out on `.chip.on` | Each click leaves the `.on` set, so a held list of locators goes stale — re-query between clicks |
