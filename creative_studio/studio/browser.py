"""جلب رفرنسات تيك توك/إنستغرام من متصفح حقيقي على جهازك، وأنت تسجّل الدخول بنفسك.

تشغيل محلي فقط (يفتح نافذة). لا نطلب ولا نخزّن كلمة المرور: الجلسة تبقى في مجلد الملف الشخصي للمتصفح.
تنبيه: الأتمتة على حسابك تخالف شروط المنصتين وقد تؤدي لتقييد الحساب؛ استخدم حساباً ثانوياً وحدّاً صغيراً
(افتراضياً 15 منشور، وتأخير عشوائي 3-8 ثوان). المحددات وهياكل الصفحات تتغير، وهذا الكود لم يُجرَّب على المواقع الحقيقية.
  pip install playwright && playwright install chromium
  python -m studio.browser login instagram      # سجّل دخولك ثم اضغط Enter
"""
from __future__ import annotations
import json, random, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from .discovery import Found, http_bytes
from .models import Reference
from .sources import Post, normalize

PROFILE = Path.home() / ".creative_studio" / "browser_profile"
URLS = {"instagram": "https://www.instagram.com/explore/tags/{tag}/", "tiktok": "https://www.tiktok.com/tag/{tag}"}
LINK = {"instagram": r"/(?:p|reel)/[\w-]+/", "tiktok": r"/@[\w.]+/video/\d+"}


def num(s: str) -> int:
    """'1,234' / '1.2K' / '3M' -> int"""
    m = re.match(r"([\d.,]+)\s*([KMBkmb]?)", s.strip())
    if not m:
        return 0
    v = float(m.group(1).replace(",", ""))
    return int(v * {"": 1, "k": 1e3, "m": 1e6, "b": 1e9}[m.group(2).lower()])


def parse_instagram(og_desc: str, og_image: str, url: str) -> tuple[Post, str]:
    # "1,234 likes, 56 comments - user on September 1, 2026: "caption""
    likes = re.search(r"([\d.,]+[KMB]?)\s+likes?", og_desc, re.I)
    comments = re.search(r"([\d.,]+[KMB]?)\s+comments?", og_desc, re.I)
    cap = re.search(r':\s*["“](.*)["”]\.?\s*$', og_desc, re.S)
    caption = cap.group(1) if cap else og_desc
    return Post(platform="instagram", url=url, caption=caption[:300],
                format="reel" if "/reel/" in url else "post",
                tags=[t.lower() for t in re.findall(r"#(\w+)", caption)][:6],
                likes=num(likes.group(1)) if likes else 0,
                comments=num(comments.group(1)) if comments else 0), og_image


def parse_tiktok(page_json: dict, url: str) -> tuple[Post, str]:
    scope = page_json.get("__DEFAULT_SCOPE__", {})
    item = scope.get("webapp.video-detail", {}).get("itemInfo", {}).get("itemStruct", {})
    st, au = item.get("stats", {}), item.get("authorStats", {})
    ts = item.get("createTime")
    return Post(platform="tiktok", url=url, caption=(item.get("desc") or "")[:300], format="short_video",
                tags=[t["hashtagName"].lower() for t in item.get("textExtra", []) if t.get("hashtagName")][:6],
                likes=int(st.get("diggCount", 0)), comments=int(st.get("commentCount", 0)),
                shares=int(st.get("shareCount", 0)), views=int(st.get("playCount", 0)),
                followers=int(au.get("followerCount", 0)),
                posted_at=datetime.fromtimestamp(int(ts), timezone.utc).isoformat() if ts else ""), \
        item.get("video", {}).get("cover", "")


class BrowserDiscovery:
    def __init__(self, get_bytes=http_bytes, profile: Path = PROFILE, min_delay=3.0, max_delay=8.0):
        self.get_bytes, self.profile, self.delay = get_bytes, profile, (min_delay, max_delay)

    def _pause(self):
        time.sleep(random.uniform(*self.delay))

    def login(self, platform: str):
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(str(self.profile), headless=False)
            ctx.new_page().goto(URLS[platform].split("/explore")[0].split("/tag")[0])
            input("سجّل دخولك في النافذة (وأكمل أي تحقق)، ثم اضغط Enter هنا لحفظ الجلسة... ")
            ctx.close()

    def search(self, platform: str, hashtags: list[str], limit: int = 15, top: int = 10,
               out_dir: str = "discovered") -> list[Found]:
        from playwright.sync_api import sync_playwright
        rows: list[tuple[Post, str]] = []
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(str(self.profile), headless=False)
            page = ctx.new_page()
            for tag in hashtags:
                page.goto(URLS[platform].format(tag=tag.strip().lstrip("#")))
                self._pause(); page.mouse.wheel(0, 1500); self._pause()
                links = list(dict.fromkeys(re.findall(LINK[platform], page.content())))[:limit]
                base = "https://www." + platform + ".com"
                for l in links:
                    url = base + l
                    try:
                        page.goto(url); self._pause()
                        if platform == "instagram":
                            og = lambda n: page.get_attribute(f'meta[property="og:{n}"]', "content") or ""
                            rows.append(parse_instagram(og("description"), og("image"), url))
                        else:
                            raw = page.inner_text('script#__UNIVERSAL_DATA_FOR_REHYDRATION__') if page.query_selector(
                                'script#__UNIVERSAL_DATA_FOR_REHYDRATION__') else page.evaluate(
                                "document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent||'{}'")
                            rows.append(parse_tiktok(json.loads(raw or "{}"), url))
                    except Exception as e:                       # منشور واحد فاشل لا يوقف الباقي
                        print(f"  تخطي {url}: {e}", file=sys.stderr)
            ctx.close()
        return self._rank(platform, rows, top, out_dir)

    def _rank(self, platform, rows, top, out_dir) -> list[Found]:
        rows = [(p, c) for p, c in rows if p.url and c]
        normalize([p for p, _ in rows])
        found = []
        for p, cover in sorted(rows, key=lambda r: -r[0].engagement)[:top]:
            try:
                data = self.get_bytes(cover)
            except Exception:
                continue
            d = Path(out_dir) / f"{platform}_{abs(hash(p.url)) % 10**8}"
            d.mkdir(parents=True, exist_ok=True)
            (d / "cover.jpg").write_bytes(data)
            notes = (f"مصدر: {platform} {p.url} | مشاهدات {p.views:,} | لايكات {p.likes:,} | تعليقات {p.comments:,}\n"
                     f"الكابشن: {p.caption}")
            found.append(Found(Reference(path=str(d), kind="image", notes=notes, frames=[str(d / "cover.jpg")]),
                               p, round(p.engagement, 3), p.caption[:60], p.url))
        return found


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "login" and sys.argv[2] in URLS:
        BrowserDiscovery().login(sys.argv[2])
    else:
        sys.exit("الاستخدام: python -m studio.browser login instagram|tiktok")
