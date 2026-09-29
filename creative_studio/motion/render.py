"""يسجّل motion.html إلى MP4 عمودي:  python motion/render.py"""
import shutil, subprocess, sys, tempfile, time
from pathlib import Path
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
DUR = 12.5
tmp = Path(tempfile.mkdtemp())
with sync_playwright() as p:
    import os
    exe = next((x for x in ("/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome") if os.path.isfile(x)), None)
    b = p.chromium.launch(executable_path=exe, args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 720, "height": 1280}, record_video_dir=str(tmp),
                        record_video_size={"width": 720, "height": 1280})
    t0 = time.time()
    pg = ctx.new_page()
    pg.goto((HERE / "motion.html").as_uri())
    pg.wait_for_function("window.__go===true", timeout=30000)
    lead = time.time() - t0                       # ما قبل بدء الحركة (تحميل الخطوط) يُقصّ لاحقاً
    if len(sys.argv) > 1 and sys.argv[1] == "shots":
        for t in (2.0, 4.0, 5.5, 8.0, 10.0, 12.0):
            pg.wait_for_timeout(int(t * 1000) - int(getattr(pg, "_last", 0)))
            pg._last = t * 1000
            pg.screenshot(path=str(HERE / f"shot_{t:04.1f}.png"))
    else:
        pg.wait_for_timeout(int(DUR * 1000))
    ctx.close(); b.close()
webm = next(tmp.glob("*.webm"))
out = HERE / "jewelry_motion.mp4"
subprocess.check_call([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-ss", f"{lead:.2f}", "-i", str(webm),
                       "-t", str(DUR), "-vf", "scale=1080:1920:flags=lanczos", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                       "-crf", "18", "-r", "30", str(out)])
print("done", out, f"lead={lead:.2f}s")
