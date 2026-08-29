#!/usr/bin/env node
// Driver for the IASS static site. Serves the repo, drives Chromium, and
// reports what a reviewer actually needs: JS errors, layout overflow, the
// animated counters' settled values, and whether the two DOSE pages still
// link to each other.
//
//   NODE_PATH=$(npm root -g) node .claude/skills/run-iass/driver.mjs <cmd>
//
// Commands: check | shot | flow | serve   (run with no args for usage)

import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(process.argv[2] === '--root' ? process.argv[3] : '.');
const OUT = process.env.IASS_OUT || '/tmp/iass-run';
// npm's playwright is newer than the browser build baked into this image, so
// launching without an explicit path looks for a revision that isn't here.
const CHROME = process.env.IASS_CHROME || '/opt/pw-browsers/chromium';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('playwright not resolvable. Run:  npm i -g playwright');
  console.error('then prefix commands with:        NODE_PATH=$(npm root -g)');
  process.exit(2);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

/** Static server over the repo. Returns { origin, close }. */
async function serve(root = ROOT) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    const file = join(root, path === '/' ? '/index.html' : path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** The images/ directory is intentionally absent — every <img data-missing>
 *  404s by design and CSS paints a plate instead. Those are not failures. */
const isExpected404 = t => /images\/\S+\.(jpg|png)/.test(t) || /favicon\.ico/.test(t);
// Google Fonts is unreachable from this container; the Arabic face falls back.
const isFontBlocked = t => /fonts\.(googleapis|gstatic)\.com/.test(t);

async function open(browser, url, { width = 1280, height = 900, mobile = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
  });
  const errors = [], consoleErrors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chromium reports a failed subresource as a bare "Failed to load
    // resource: ..." — the URL only appears in the message's location.
    const where = m.location()?.url || '';
    const t = `${m.text()} ${where}`.trim();
    if (!isExpected404(t) && !isFontBlocked(t)) consoleErrors.push(t);
  });
  await page.goto(url, { waitUntil: 'load' });
  // Smooth scrolling makes Playwright's scroll-then-click race the animation
  // ("<html> intercepts pointer events"). Kill it before touching anything.
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.waitForTimeout(600);
  return { page, errors, consoleErrors };
}

/** Content is gated behind scroll-reveal and the counters animate on the way
 *  past. Walk the whole page, then let the counters land. */
async function settle(page) {
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate(v => scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(3500);
}

async function audit(page) {
  return page.evaluate(() => ({
    title: document.title,
    hScroll: document.body.scrollWidth > document.documentElement.clientWidth,
    dir: getComputedStyle(document.documentElement).direction,
    counters: [...document.querySelectorAll('.count')].map(e => e.textContent),
    // an <img> that still has a src and never decoded is a real broken image;
    // the plate fallback removes the element entirely, so it cannot show here
    brokenImgs: [...document.querySelectorAll('img')]
      .filter(i => i.getAttribute('src') && i.naturalWidth === 0).length,
    localLinks: [...document.querySelectorAll('a[href$=".html"], a[href*=".html#"]')]
      .map(a => a.getAttribute('href')),
  }));
}

const PAGES = ['dose-agency.html', 'identities.html'];

async function cmdCheck(pages) {
  const site = await serve();
  const browser = await chromium.launch({ executablePath: CHROME });
  let bad = 0;
  for (const file of pages.length ? pages : PAGES) {
    for (const vp of [{ width: 1280, height: 900, label: 'desktop' },
                      { width: 390, height: 844, mobile: true, label: 'mobile' }]) {
      const { page, errors, consoleErrors } = await open(browser, `${site.origin}/${file}`, vp);
      await settle(page);
      const a = await audit(page);
      const fail = errors.length || consoleErrors.length || a.hScroll || a.brokenImgs;
      if (fail) bad++;
      console.log(`${fail ? 'FAIL' : 'ok  '}  ${file}  ${vp.label}`);
      console.log(`      title=${JSON.stringify(a.title)} dir=${a.dir} hScroll=${a.hScroll} brokenImgs=${a.brokenImgs}`);
      if (a.counters.length) console.log(`      counters: ${a.counters.join(' ')}`);
      if (a.localLinks.length) console.log(`      links: ${[...new Set(a.localLinks)].join(' ')}`);
      for (const e of errors) console.log(`      pageerror: ${e}`);
      for (const e of consoleErrors) console.log(`      console:   ${e}`);
      await page.close();
    }
    // every same-repo link the page offers must actually resolve
    const { page } = await open(browser, `${site.origin}/${file}`);
    const links = (await audit(page)).localLinks;
    for (const href of [...new Set(links)]) {
      const target = href.split('#')[0];
      try { await stat(join(ROOT, target)); }
      catch { console.log(`FAIL  ${file}: dead link -> ${target}`); bad++; }
    }
    await page.close();
  }
  await browser.close(); site.close();
  console.log(bad ? `\n${bad} failing check(s)` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
}

async function cmdShot(file, opts) {
  await mkdir(OUT, { recursive: true });
  const site = await serve();
  const browser = await chromium.launch({ executablePath: CHROME });
  const { page } = await open(browser, `${site.origin}/${file}`, opts);
  await settle(page);
  if (opts.section) {
    await page.evaluate(s => document.querySelector(s)?.scrollIntoView(), opts.section);
    await page.waitForTimeout(800);
  } else {
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
  }
  const out = opts.out || join(OUT, `${file.replace(/\W+/g, '-')}${opts.section ? opts.section.replace('#', '-') : ''}-${opts.width || 1280}.png`);
  await page.screenshot({ path: out, fullPage: !!opts.full });
  console.log(out);
  await browser.close(); site.close();
}

/** The one flow worth re-running after any change: land on the home page,
 *  cross into the identities page through the nav, filter, open a brand
 *  sheet, close it with Escape. */
async function cmdFlow() {
  await mkdir(OUT, { recursive: true });
  const site = await serve();
  const browser = await chromium.launch({ executablePath: CHROME });
  const { page, errors } = await open(browser, `${site.origin}/dose-agency.html`);
  const step = async (label, fn) => { await fn(); await page.waitForTimeout(700); console.log(`  ${label}`); };

  await settle(page);
  await step('home loaded, bridge present: ' + await page.evaluate(() => !!document.querySelector('.bridge-inner')), async () => {});
  // Clicking through Playwright fights the fixed nav/dock overlays, so drive
  // the anchor directly — same navigation, no hit-testing.
  await step('nav -> identities.html', () =>
    page.evaluate(() => document.querySelector('.nav-links a[href="identities.html"]').click()));
  await page.waitForLoadState('load');
  await settle(page);
  console.log(`  landed on ${new URL(page.url()).pathname}`);
  await step('filter: أطباء -> ' + '', () =>
    page.evaluate(() => document.querySelector('[data-filter="doctor"]').click()));
  console.log(`  visible plates: ${await page.evaluate(() => [...document.querySelectorAll('.plate')].filter(p => !p.hidden).length)}`);
  await step('filter: الكل', () => page.evaluate(() => document.querySelector('[data-filter="all"]').click()));
  await step('open plate: noor', () => page.evaluate(() => document.querySelector('[data-open="noor"]').click()));
  console.log(`  sheet open: ${await page.evaluate(() => document.getElementById('sheetWrap').classList.contains('open'))}`);
  await page.screenshot({ path: join(OUT, 'flow-sheet.png') });
  await step('Escape closes sheet', () => page.keyboard.press('Escape'));
  console.log(`  sheet hidden: ${await page.evaluate(() => document.getElementById('sheetWrap').hasAttribute('hidden'))}`);
  await page.screenshot({ path: join(OUT, 'flow-end.png') });
  console.log(errors.length ? `\npageerrors: ${errors.join(' | ')}` : `\nno JS errors. shots in ${OUT}/`);
  await browser.close(); site.close();
  process.exit(errors.length ? 1 : 0);
}

const [cmd, ...rest] = process.argv.slice(2).filter(a => a !== '--root' && a !== ROOT);
const flag = (n, d) => { const m = rest.find(a => a.startsWith(`--${n}=`)); return m ? m.split('=')[1] : d; };
const positional = rest.filter(a => !a.startsWith('--'));

switch (cmd) {
  case 'check': await cmdCheck(positional); break;
  case 'shot': await cmdShot(positional[0] || 'dose-agency.html', {
      width: +flag('w', 1280), height: +flag('h', 900), mobile: rest.includes('--mobile'),
      section: flag('section'), out: flag('out'), full: rest.includes('--full'),
    }); break;
  case 'flow': await cmdFlow(); break;
  case 'serve': { const s = await serve(); console.log(`${s.origin}  (Ctrl-C to stop)`); break; }
  default:
    console.log(`usage: node driver.mjs <command>

  check [page...]        load every page at desktop + mobile; report JS errors,
                         horizontal overflow, broken images, settled counters,
                         and dead same-repo links. Exit 1 on any failure.
  flow                   home -> nav into identities -> filter -> open a brand
                         sheet -> Escape. Screenshots to ${OUT}/
  shot <page> [--w=] [--h=] [--section=#id] [--out=] [--full] [--mobile]
  serve                  static server on a free port, for poking by hand

pages: ${PAGES.join(', ')}`);
}
