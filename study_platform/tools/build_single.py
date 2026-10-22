"""يجمع المنصة في ملف HTML واحد جاهز للنشر كـ Artifact:  python tools/build_single.py OUT.html"""
import re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
src = (R / "index.html").read_text(encoding="utf-8")
css = (R / "css/style.css").read_text(encoding="utf-8")
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
body = re.sub(r'<script src="(js|vendor)/[^"]+"></script>\s*', "", body)
CDN = "".join(f'<script src="https://cdn.jsdelivr.net/npm/{x}"></script>\n' for x in ["pdfjs-dist@3.11.174/build/pdf.min.js", "pdfjs-dist@3.11.174/build/pdf.worker.min.js", "pdf-lib@1.17.1/dist/pdf-lib.min.js", "mammoth@1.6.0/mammoth.browser.min.js"])
js = "\n".join((R / "js" / n).read_text(encoding="utf-8") for n in ["store", "ui", "v_home", "v_content", "v_learn", "v_share", "v_desk", "v_writer", "v_space", "v_lectures","v_flow", "v_chat", "sim_med", "ai_tools", "v_ai", "main"] for n in [n + ".js"])
js = (R / "vendor" / "pdf_fonts.js").read_text(encoding="utf-8") + "\n" + js
js = js.replace("</script", "<\\/script")
font = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', src).group(0)
out = f"<title>منصة الدراسة</title>\n{font}\n<style>{css}</style>\n{body}\n{CDN}<script>\n{js}\n</script>\n"
Path(sys.argv[1]).write_text(out, encoding="utf-8"); print("built", len(out) // 1024, "KB")
