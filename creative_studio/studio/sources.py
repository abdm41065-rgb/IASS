"""مصادر التفاعل العالمية (500+ حساب/صفحة عبر Instagram / TikTok / Facebook / YouTube).

ملاحظة قانونية مهمة: لا نسحب المنصات بالـ scraping المباشر (يخالف الشروط ويُحظر).
الموصلات المدعومة: ملفات CSV/JSON مصدّرة، أو واجهات رسمية/وسطاء (Meta Graph/Content Library،
TikTok Research API، YouTube Data API، أو Apify/Data365 بمفتاحك) عبر HttpConnector.
"""
from __future__ import annotations
import csv, json, math, os, urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Post:
    platform: str
    url: str = ""
    caption: str = ""
    format: str = ""           # reel, carousel, story, short ...
    hook: str = ""
    tags: list[str] = field(default_factory=list)
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0
    followers: int = 0
    posted_at: str = ""        # ISO
    engagement: float = 0.0    # يُحسب لاحقاً (0-1 percentile داخل المنصة)

    def raw_rate(self) -> float:
        base = self.views or self.followers or 1
        return (self.likes + 2 * self.comments + 3 * self.shares) / base


def _post(d: dict, platform: str = "") -> Post:
    tags = d.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.replace("#", " ").replace("|", ",").split(",") if t.strip()]
    return Post(platform=d.get("platform") or platform, url=d.get("url", ""), caption=d.get("caption", ""),
                format=d.get("format", ""), hook=d.get("hook", ""), tags=tags,
                likes=int(d.get("likes") or 0), comments=int(d.get("comments") or 0),
                shares=int(d.get("shares") or 0), views=int(d.get("views") or 0),
                followers=int(d.get("followers") or 0), posted_at=d.get("posted_at", ""))


class FileConnector:
    def __init__(self, path: str, platform: str = ""):
        self.path, self.platform = path, platform

    def fetch(self) -> list[Post]:
        if self.path.endswith(".csv"):
            with open(self.path, newline="", encoding="utf-8") as f:
                return [_post(r, self.platform) for r in csv.DictReader(f)]
        return [_post(r, self.platform) for r in json.load(open(self.path, encoding="utf-8"))]


class HttpConnector:
    """أي API يرجع قائمة JSON بحقول مشابهة؛ المفتاح من متغير بيئة (لا يُخزَّن بالكود)."""
    def __init__(self, url: str, platform: str, token_env: str = "", items_key: str = "items"):
        self.url, self.platform, self.token_env, self.items_key = url, platform, token_env, items_key

    def fetch(self) -> list[Post]:
        req = urllib.request.Request(self.url)
        if self.token_env:
            req.add_header("Authorization", f"Bearer {os.environ[self.token_env]}")
        data = json.load(urllib.request.urlopen(req, timeout=30))
        return [_post(r, self.platform) for r in (data[self.items_key] if isinstance(data, dict) else data)]


def load_sources(cfg: list[dict]) -> list[Post]:
    posts: list[Post] = []
    for c in cfg:
        conn = FileConnector(c["path"], c.get("platform", "")) if "path" in c else \
            HttpConnector(c["url"], c["platform"], c.get("token_env", ""), c.get("items_key", "items"))
        posts += conn.fetch()
    return normalize(posts)


def normalize(posts: list[Post]) -> list[Post]:
    """تطبيع التفاعل كـ percentile داخل كل منصة (حتى لا يطغى TikTok على Facebook)."""
    by = defaultdict(list)
    for p in posts:
        by[p.platform].append(p)
    for group in by.values():
        rates = sorted(p.raw_rate() for p in group)
        for p in group:
            p.engagement = (sum(r <= p.raw_rate() for r in rates) - 0.5) / len(rates)
    return posts


def _recency(p: Post, half_life_days: float = 45) -> float:
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(p.posted_at.replace("Z", "+00:00"))
               .astimezone(timezone.utc)).days
    except (ValueError, TypeError):
        return 0.5
    return 0.5 ** (max(age, 0) / half_life_days)


def trend_report(posts: list[Post], top: int = 10) -> dict:
    """يستخرج: أنجح الـ formats/tags/hooks، مع كشف التشبّع (كثرة تكرار + هبوط تفاعل)."""
    out = {}
    for dim in ("format", "tag", "hook"):
        agg = defaultdict(lambda: [0.0, 0, 0.0])
        for p in posts:
            keys = p.tags if dim == "tag" else [getattr(p, dim)]
            for k in filter(None, keys):
                a = agg[k]; a[0] += p.engagement * _recency(p); a[1] += 1; a[2] += p.engagement
        rows = []
        for k, (w, n, e) in agg.items():
            avg = e / n
            saturation = min(1.0, math.log1p(n) / math.log1p(max(len(posts) * 0.2, 2)))
            rows.append({"key": k, "count": n, "avg_engagement": round(avg, 3),
                         "momentum": round(w / n, 3), "saturation": round(saturation, 2)})
        out[dim] = sorted(rows, key=lambda r: -(r["momentum"] * (1 - 0.5 * r["saturation"])))[:top]
    out["sample_size"] = len(posts)
    out["platforms"] = sorted({p.platform for p in posts})
    return out
