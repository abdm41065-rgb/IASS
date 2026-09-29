"""اكتشاف رفرنسات تيك توك وإنستغرام عبر Apify (وسيط طرف ثالث بمفتاحك APIFY_TOKEN).

تنبيه: المنصتان لا توفران بحثاً عاماً رسمياً؛ Apify يسحب البيانات العامة نيابةً عنك، وهذا قد يخالف شروط
المنصات والمسؤولية عليك. حقول ناتج الـ actors قد تتغيّر، لذلك الربط متساهل وقابل للتعديل (FIELDS).
البدائل الرسمية: Instagram Graph API (ig_hashtag_search، حساب Business + مراجعة تطبيق) و TikTok Research API.
"""
from __future__ import annotations
import json, os, urllib.request
from pathlib import Path
from .discovery import Found, http_bytes
from .models import Reference
from .sources import Post, normalize

ACTORS = {"tiktok": ("clockworks~tiktok-scraper", lambda tags, n: {"hashtags": tags, "resultsPerPage": n, "shouldDownloadCovers": False}),
          "instagram": ("apify~instagram-hashtag-scraper", lambda tags, n: {"hashtags": tags, "resultsType": "posts", "resultsLimit": n})}


def _get(d: dict, *paths, default=None):
    for p in paths:
        cur = d
        for k in p.split("."):
            cur = cur.get(k) if isinstance(cur, dict) else None
        if cur not in (None, ""):
            return cur
    return default


def to_post(platform: str, d: dict) -> tuple[Post, str]:
    tags = [(t["name"] if isinstance(t, dict) else str(t)).lower().lstrip("#") for t in (d.get("hashtags") or [])][:6]
    p = Post(platform=platform, url=_get(d, "webVideoUrl", "url", default=""),
             caption=(_get(d, "text", "caption", default="") or "")[:300],
             format="reel" if platform == "instagram" and _get(d, "type", default="").lower() == "video" else
             "short_video" if platform == "tiktok" else "post",
             tags=tags, likes=int(_get(d, "diggCount", "likesCount", default=0) or 0),
             comments=int(_get(d, "commentCount", "commentsCount", default=0) or 0),
             shares=int(_get(d, "shareCount", default=0) or 0),
             views=int(_get(d, "playCount", "videoViewCount", "videoPlayCount", default=0) or 0),
             followers=int(_get(d, "authorMeta.fans", "ownerFollowersCount", default=0) or 0),
             posted_at=_get(d, "createTimeISO", "timestamp", default=""))
    cover = _get(d, "videoMeta.coverUrl", "displayUrl", "thumbnailUrl", default="")
    return p, cover


def http_post_json(url: str, body: dict, timeout: int = 300):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


class ApifyDiscovery:
    def __init__(self, token: str | None = None, post=http_post_json, get_bytes=http_bytes, actors: dict | None = None):
        self.token = token or os.environ.get("APIFY_TOKEN", "")
        if not self.token:
            raise RuntimeError("ضع APIFY_TOKEN (حساب apify.com) لجلب تيك توك/إنستغرام")
        self.post, self.get_bytes = post, get_bytes
        self.actors = {**{k: os.environ.get(f"APIFY_{k.upper()}_ACTOR", v[0]) for k, v in ACTORS.items()}, **(actors or {})}

    def search(self, platform: str, hashtags: list[str], per_tag: int = 20, top: int = 10,
               out_dir: str = "discovered") -> list[Found]:
        tags = [h.strip().lstrip("#").replace(" ", "") for h in hashtags if h.strip()]
        url = f"https://api.apify.com/v2/acts/{self.actors[platform]}/run-sync-get-dataset-items?token={self.token}"
        return self._rank_items(platform, self.post(url, ACTORS[platform][1](tags, per_tag)), top, out_dir)

    def _rank_items(self, platform, items, top, out_dir) -> list[Found]:
        rows = [to_post(platform, i) for i in items if isinstance(i, dict)]
        rows = [(p, c) for p, c in rows if p.url]
        normalize([p for p, _ in rows])                            # تطبيع التفاعل داخل المنصة
        found = []
        for p, cover in sorted(rows, key=lambda r: -r[0].engagement)[:top * 2]:
            if not cover:
                continue
            try:
                data = self.get_bytes(cover)                       # روابط الأغلفة تنتهي صلاحيتها: نحمّلها فوراً
            except Exception:
                continue
            d = Path(out_dir) / f"{platform}_{abs(hash(p.url)) % 10**8}"
            d.mkdir(parents=True, exist_ok=True)
            (d / "cover.jpg").write_bytes(data)
            notes = (f"مصدر: {platform} {p.url} | مشاهدات {p.views:,} | لايكات {p.likes:,} | تعليقات {p.comments:,} | "
                     f"مشاركات {p.shares:,}\nالكابشن: {p.caption}")
            found.append(Found(Reference(path=str(d), kind="image", notes=notes, frames=[str(d / "cover.jpg")]),
                               p, round(p.engagement, 3), p.caption[:60], p.url))
        return found[:top]


def read_urls(path: str) -> list[str]:
    return [l.split("?")[0].strip() for l in open(path, encoding="utf-8") if l.strip().startswith("http")]


def search_urls(self, urls: list[str], per_url: int = 30, top: int = 30, out_dir: str = "discovered") -> list[Found]:
    """روابط ريلز أو صفحات حسابات كاملة (يجلب آخر per_url منشور لكل صفحة) عبر actor إنستغرام العام."""
    actor = os.environ.get("APIFY_INSTAGRAM_URLS_ACTOR", "apify~instagram-scraper")
    url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={self.token}"
    items = self.post(url, {"directUrls": urls, "resultsType": "posts", "resultsLimit": per_url})
    return self._rank_items("instagram", items, top, out_dir)


ApifyDiscovery.search_urls = search_urls
