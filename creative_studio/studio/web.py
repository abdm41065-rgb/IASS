"""واجهة ويب: ارفع الرفرنسات، شغّل الفريق، شاهد/نزّل التقرير.  python -m studio.web"""
import html, os, tempfile
from pathlib import Path
from flask import Flask, request, Response
from .config import load_brand
from .demo import demo_llm
from .library import Library
from .pipeline import Studio
from .report import to_markdown
from .sources import load_sources

PAGE = """<!doctype html><html lang=ar dir=rtl><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Creative Studio</title><style>body{{font:16px system-ui;max-width:820px;margin:2rem auto;padding:0 1rem;background:#0B0B0F;color:#F5F0E6}}
input,button{{font:inherit;padding:.5rem;margin:.3rem 0}}button{{background:#D4AF37;border:0;border-radius:6px;cursor:pointer}}
pre{{white-space:pre-wrap;background:#17171d;padding:1rem;border-radius:8px}}a{{color:#D4AF37}}label{{display:block;margin-top:.8rem}}</style>
<h1>Creative Studio</h1>{body}</html>"""

FORM = """<form method=post action=/run enctype=multipart/form-data>
<label>الرفرنسات (صور/فيديو)<br><input type=file name=refs multiple></label>
<label>أو دعه يجلبها تلقائياً من YouTube: كلمات بحث مفصولة بفاصلة<br><input name=discover placeholder="luxury perfume ad, عطور فاخرة اعلان" style="width:100%"></label>
<label>هاشتاغات تيك توك<br><input name=tiktok placeholder="perfume, luxury" style="width:100%"></label>
<label>هاشتاغات إنستغرام<br><input name=instagram placeholder="perfume, luxury" style="width:100%"></label>
<label>الدولة <input name=region placeholder="SA / IQ / US" size=6></label>
<label>بيانات المنصات (CSV أو JSON) — اختياري<br><input type=file name=posts></label>
<label>المنصة لملف البيانات <input name=platform value=instagram></label>
<label>عدد الأفكار <input type=number name=ideas value=20 min=1 max=60></label>
<label><input type=checkbox name=demo {demo}> وضع تجريبي (بدون مفتاح API)</label>
<button>شغّل الفريق</button></form>"""


def create_app(brand_path="brand/brand.yaml", db="library.db", llm_factory=None, discovery_factory=None, social_factory=None):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
    if discovery_factory is None:
        from .discovery import YouTubeDiscovery as discovery_factory
    if social_factory is None:
        from .social import ApifyDiscovery as social_factory
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY"))

    @app.get("/")
    def index():
        note = "" if has_key else "<p>⚠ لا يوجد ANTHROPIC_API_KEY — سيعمل الوضع التجريبي فقط.</p>"
        return PAGE.format(body=note + FORM.format(demo="" if has_key else "checked disabled"))

    @app.post("/run")
    def run():
        brand = load_brand(brand_path)
        tmp = Path(tempfile.mkdtemp(prefix="cs_"))
        for i, f in enumerate(request.files.getlist("refs")):
            if f.filename:
                f.save(tmp / f"{i}_{Path(f.filename).name}")      # اسم آمن: نأخذ الـ basename فقط
        posts = []
        pf = request.files.get("posts")
        if pf and pf.filename:
            path = tmp / ("posts" + Path(pf.filename).suffix.lower())
            pf.save(path)
            posts = load_sources([{"path": str(path), "platform": request.form.get("platform", "")}])
        demo = "demo" in request.form or not has_key
        extra, q = [], request.form.get("discover", "").strip()
        for plat in ("tiktok", "instagram"):
            tags = [x for x in request.form.get(plat, "").split(",") if x.strip()]
            if tags:
                try:
                    fs = social_factory().search(plat, tags, out_dir=str(tmp / "discovered"))
                except Exception as e:
                    return PAGE.format(body=f"<p>❌ فشل {plat}: {html.escape(str(e))}</p><a href=/>رجوع</a>"), 400
                extra += [f.ref for f in fs]; posts = posts + [f.post for f in fs]
        if q:
            try:
                from .discovery import YouTubeDiscovery
                found = discovery_factory().search([x.strip() for x in q.split(",") if x.strip()],
                                                   region=request.form.get("region", "").strip().upper(),
                                                   out_dir=str(tmp / "discovered"))
            except Exception as e:
                return PAGE.format(body=f"<p>❌ فشل الاكتشاف: {html.escape(str(e))}</p><a href=/>رجوع</a>"), 400
            extra, posts = [f.ref for f in found], posts + [f.post for f in found]
        if llm_factory:
            llm = llm_factory(brand)
        elif demo:
            llm = demo_llm(brand)
        else:
            from .llm import ClaudeLLM
            llm = ClaudeLLM()
        try:
            res = Studio(llm, brand, Library(db), log=lambda s: None).run(
                [str(tmp)], posts, int(request.form.get("ideas", 20)), extra_refs=extra)
            md = to_markdown(res)
        except Exception as e:                                     # نعرض السبب للمستخدم بدل صفحة 500
            return PAGE.format(body=f"<p>❌ {html.escape(str(e))}</p><a href=/>رجوع</a>"), 500
        (tmp / "report.md").write_text(md, encoding="utf-8")
        return PAGE.format(body=f"<p>{'(نتائج تجريبية) ' if demo else ''}<a href=/report/{tmp.name}>تنزيل report.md</a> · <a href=/>تشغيل جديد</a></p>"
                                f"<pre>{html.escape(md)}</pre>")

    @app.get("/report/<job>")
    def report(job):
        p = Path(tempfile.gettempdir()) / Path(job).name / "report.md"   # basename يمنع ../
        if not p.is_file():
            return "غير موجود", 404
        return Response(p.read_text(encoding="utf-8"), mimetype="text/markdown",
                        headers={"Content-Disposition": "attachment; filename=report.md"})
    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", 8000)))
