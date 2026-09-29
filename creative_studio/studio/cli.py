import argparse, json, os, sys
from .config import load_brand
from .library import Library
from .llm import ClaudeLLM
from .models import to_dict
from .pipeline import Studio
from .report import to_markdown
from .sources import load_sources


def main(argv=None):
    p = argparse.ArgumentParser("creative-studio")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="تشغيل الفريق كاملاً")
    r.add_argument("refs", nargs="*", help="صور/فيديوهات/مجلدات (اختياري مع --discover)")
    r.add_argument("--discover", help="كلمات بحث مفصولة بفاصلة لجلب أفضل الرفرنسات تلقائياً من YouTube")
    r.add_argument("--tiktok", help="هاشتاغات تيك توك مفصولة بفاصلة (يحتاج APIFY_TOKEN)")
    r.add_argument("--instagram", help="هاشتاغات إنستغرام مفصولة بفاصلة (يحتاج APIFY_TOKEN)")
    r.add_argument("--browser", action="store_true", help="استعمل متصفحك المحلي (بعد login) بدل Apify لتيك توك/إنستغرام")
    r.add_argument("--top", type=int, default=10, help="عدد الرفرنسات المكتشفة")
    r.add_argument("--region", default="", help="مثل SA أو IQ أو US")
    r.add_argument("--sources", help="ملف YAML لمصادر التفاعل")
    r.add_argument("--brand", default="brand/brand.yaml")
    r.add_argument("--db", default="library.db")
    r.add_argument("--ideas", type=int, default=20)
    r.add_argument("--out", default="report.md")
    f = sub.add_parser("feedback", help="سجّل الأداء الفعلي لفكرة منشورة")
    f.add_argument("idea_id"); f.add_argument("--engagement-rate", type=float, required=True)
    f.add_argument("--db", default="library.db")
    a = p.parse_args(argv)

    if a.cmd == "feedback":
        Library(a.db).record_performance(a.idea_id, {"engagement_rate": a.engagement_rate})
        print("تم الحفظ — التقييمات القادمة ستتأثر بأدائك الفعلي.")
        return 0
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ضع ANTHROPIC_API_KEY في متغيرات البيئة")
    import yaml
    posts = load_sources(yaml.safe_load(open(a.sources))["sources"]) if a.sources else []
    extra = []
    if a.discover:
        from .discovery import YouTubeDiscovery
        found = YouTubeDiscovery().search([q.strip() for q in a.discover.split(',')], top=a.top, region=a.region)
        for f in found:
            print(f"  {f.score}  {f.title[:60]}  {f.url}")
        extra = [f.ref for f in found]
        posts += [f.post for f in found]
    for plat in ("tiktok", "instagram"):
        if getattr(a, plat):
            tags = getattr(a, plat).split(",")
            if a.browser:
                from .browser import BrowserDiscovery
                found = BrowserDiscovery().search(plat, tags, top=a.top)
            else:
                from .social import ApifyDiscovery
                found = ApifyDiscovery().search(plat, tags, top=a.top)
            for f in found:
                print(f"  {plat} {f.score}  {f.title[:50]}  {f.url}")
            extra += [f.ref for f in found]
            posts += [f.post for f in found]
    if not a.refs and not extra:
        sys.exit('لا توجد رفرنسات: مرّر ملفات أو استعمل --discover')
    res = Studio(ClaudeLLM(), load_brand(a.brand), Library(a.db)).run(a.refs, posts, a.ideas, extra_refs=extra)
    open(a.out, "w", encoding="utf-8").write(to_markdown(res))
    print(f"تم: {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
