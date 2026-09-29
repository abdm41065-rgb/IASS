"""الاكتشاف التلقائي للرفرنسات من YouTube Data API (رسمي، مفتاح مجاني YOUTUBE_API_KEY).

يبحث بكلمات مفتاحية، يرتّب حسب: تفاعل المشاهدين (لايك/تعليق/مشاهدات) + جودة التعليقات (تعليقات عليها لايكات
عالية)، ثم يحمّل صور الغلاف والإطارات المصغّرة (بدون تحميل الفيديو نفسه) ويرفق أهم التعليقات كملاحظات للمحلل.
إنستغرام/تيك توك/فيسبوك لا توفر بحثاً عاماً رسمياً؛ لهذه استخدم sources.py (ملفات/API مرخّصة).
"""
from __future__ import annotations
import json, math, os, urllib.parse, urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from .models import Reference
from .sources import Post, normalize

API = "https://www.googleapis.com/youtube/v3"


def http_json(url: str) -> dict:
    return json.load(urllib.request.urlopen(url, timeout=30))


def http_bytes(url: str) -> bytes:
    return urllib.request.urlopen(url, timeout=30).read()


@dataclass
class Found:
    ref: Reference
    post: Post
    score: float
    title: str
    url: str


class YouTubeDiscovery:
    def __init__(self, api_key: str | None = None, get_json=http_json, get_bytes=http_bytes):
        self.key = api_key or os.environ.get("YOUTUBE_API_KEY", "")
        if not self.key:
            raise RuntimeError("ضع YOUTUBE_API_KEY (مفتاح YouTube Data API v3 المجاني من Google Cloud)")
        self.get_json, self.get_bytes = get_json, get_bytes

    def _api(self, path: str, **params) -> dict:
        return self.get_json(f"{API}/{path}?{urllib.parse.urlencode({**params, 'key': self.key})}")

    def _comments(self, vid: str, n: int) -> list[dict]:
        try:
            d = self._api("commentThreads", part="snippet", videoId=vid, order="relevance",
                          maxResults=n, textFormat="plainText")
        except Exception:                      # التعليقات معطّلة أو حصة منتهية: نكمل بدونها
            return []
        return [{"text": i["snippet"]["topLevelComment"]["snippet"]["textDisplay"],
                 "likes": i["snippet"]["topLevelComment"]["snippet"].get("likeCount", 0)} for i in d.get("items", [])]

    def search(self, queries: list[str], per_query: int = 15, top: int = 10, region: str = "",
               days: int = 365, out_dir: str = "discovered") -> list[Found]:
        after = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        ids: dict[str, str] = {}
        for q in queries:
            d = self._api("search", part="snippet", q=q, type="video", order="viewCount",
                          maxResults=min(per_query, 50), publishedAfter=after,
                          **({"regionCode": region} if region else {}))
            for it in d.get("items", []):
                ids.setdefault(it["id"]["videoId"], q)
        if not ids:
            return []
        vids = self._api("videos", part="statistics,snippet", id=",".join(ids))["items"]
        chans = {c["id"]: int(c["statistics"].get("subscriberCount", 0)) for c in self._api(
            "channels", part="statistics", id=",".join({v["snippet"]["channelId"] for v in vids}))["items"]}
        posts = []
        for v in vids:
            st, sn = v["statistics"], v["snippet"]
            posts.append(Post(platform="youtube", url=f"https://youtu.be/{v['id']}", caption=sn["title"],
                              format="short" if "#shorts" in (sn["title"] + sn.get("description", "")).lower() else "video",
                              tags=[t.lower() for t in sn.get("tags", [])[:6]],
                              likes=int(st.get("likeCount", 0)), comments=int(st.get("commentCount", 0)),
                              views=int(st.get("viewCount", 0)), followers=chans.get(sn["channelId"], 0),
                              posted_at=sn["publishedAt"]))
        normalize(posts)
        # جودة التعليقات: نسبة التعليقات للمشاهدات + قوة اللايكات على أفضل التعليقات
        cs = {}
        pre = sorted(zip(vids, posts), key=lambda t: -t[1].engagement)[:top * 2]     # نجلب تعليقات المرشحين فقط (توفير حصة)
        for v, p in pre:
            cs[v["id"]] = self._comments(v["id"], 10)
        cq = {vid: math.log1p(sum(c["likes"] for c in cm)) + 20 * (p.comments / max(p.views, 1))
              for (v, p) in pre for vid, cm in [(v["id"], cs[v["id"]])]}
        mx = max(cq.values(), default=1) or 1
        found = []
        for v, p in pre:
            score = round(0.6 * p.engagement + 0.4 * cq[v["id"]] / mx, 3)
            top_c = sorted(cs[v["id"]], key=lambda c: -c["likes"])[:5]
            notes = (f"مصدر: YouTube «{v['snippet']['title']}» | مشاهدات {p.views:,} | لايكات {p.likes:,} | "
                     f"تعليقات {p.comments:,}\nما يقوله الجمهور: " + " || ".join(f"({c['likes']}👍) {c['text'][:160]}" for c in top_c))
            found.append(Found(Reference(path="", kind="image", notes=notes), p, score, v["snippet"]["title"], p.url))
        found = sorted(found, key=lambda f: -f.score)[:top]
        for f in found:
            self._frames(f, out_dir)
        return [f for f in found if f.ref.frames]

    def _frames(self, f: Found, out_dir: str):
        vid = f.url.rsplit("/", 1)[-1]
        d = Path(out_dir) / vid
        d.mkdir(parents=True, exist_ok=True)
        for name in ("hqdefault", "hq1", "hq2", "hq3"):        # الغلاف + 3 إطارات من داخل الفيديو
            try:
                data = self.get_bytes(f"https://i.ytimg.com/vi/{vid}/{name}.jpg")
            except Exception:
                continue
            (d / f"{name}.jpg").write_bytes(data)
            f.ref.frames.append(str(d / f"{name}.jpg"))
        f.ref.path = str(d)                                    # مسار مميّز يعطي id ثابت للرفرنس
