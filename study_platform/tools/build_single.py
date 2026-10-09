"""يجمع المنصة في ملف HTML واحد جاهز للنشر كـ Artifact:  python tools/build_single.py OUT.html"""
import re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
src = (R / "index.html").read_text(encoding="utf-8")
css = (R / "css/style.css").read_text(encoding="utf-8")
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
body = re.sub(r'<script src="js/[^"]+"></script>\s*', "", body)
js = "\n".join((R / "js" / n).read_text(encoding="utf-8") for n in ["store", "ui", "v_home", "v_content", "v_learn", "v_share", "main"] for n in [n + ".js"])
js = js.replace("</script", "<\\/script")
out = f"<title>منصة الدراسة</title>\n<style>{css}</style>\n{body}\n<script>\n{js}\n</script>\n"
Path(sys.argv[1]).write_text(out, encoding="utf-8"); print("built", len(out) // 1024, "KB")
