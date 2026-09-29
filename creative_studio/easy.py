"""تشغيل بضغطة واحدة على جهازك:  python easy.py   (يحتاج بايثون 3.10+)"""
import getpass, importlib.util, os, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
os.chdir(HERE)


def need(mod, pip_name=None):
    if importlib.util.find_spec(mod) is None:
        print(f"تثبيت {pip_name or mod} ...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pip_name or mod])


def main():
    for m, p in [("anthropic", "anthropic"), ("yaml", "PyYAML"), ("flask", "flask"), ("playwright", "playwright")]:
        need(m, p)
    if not (Path.home() / ".cache/ms-playwright").exists():
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    if not os.environ.get("ANTHROPIC_API_KEY"):
        os.environ["ANTHROPIC_API_KEY"] = getpass.getpass("الصق ANTHROPIC_API_KEY (لن يظهر أثناء الكتابة): ").strip()

    from studio.browser import PROFILE, BrowserDiscovery
    from studio.config import load_brand
    from studio.library import Library
    from studio.llm import ClaudeLLM
    from studio.pipeline import Studio
    from studio.report import to_markdown
    from studio.social import read_urls
    from studio.sources import load_sources

    b = BrowserDiscovery()
    if not PROFILE.exists():
        b.login("instagram")                       # مرة واحدة فقط: تسجّل دخولك بنفسك
    top = int(input("كم منشوراً تريد كحد أقصى؟ [30] ") or 30)
    found = b.crawl("instagram", read_urls("refs/instagram_links.txt"), top=top)
    print(f"تم جلب {len(found)} رفرنس")
    posts = load_sources([{"path": "refs/screenshots_metrics.csv"}]) + [f.post for f in found]
    res = Studio(ClaudeLLM(), load_brand(), Library("library.db")).run(
        ["refs"], posts, 20, extra_refs=[f.ref for f in found])
    Path("report.md").write_text(to_markdown(res), encoding="utf-8")
    print(f"\nجاهز: {HERE / 'report.md'}")


if __name__ == "__main__":
    main()
