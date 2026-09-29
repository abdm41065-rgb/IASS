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
    r.add_argument("refs", nargs="+", help="صور/فيديوهات/مجلدات")
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
    res = Studio(ClaudeLLM(), load_brand(a.brand), Library(a.db)).run(a.refs, posts, a.ideas)
    open(a.out, "w", encoding="utf-8").write(to_markdown(res))
    print(f"تم: {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
