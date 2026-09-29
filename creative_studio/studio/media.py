"""استلام الرفرنسات: صور، فيديو (يُستخرج منه إطارات عبر ffmpeg)، أو مجلد إطارات جاهزة."""
from __future__ import annotations
import shutil, subprocess, tempfile
from pathlib import Path
from .models import Reference

IMG = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VID = {".mp4", ".mov", ".webm", ".mkv", ".avi"}


def collect(paths: list[str]) -> list[Reference]:
    refs = []
    for p in map(Path, paths):
        files = sorted(p.rglob("*")) if p.is_dir() else [p]
        for f in files:
            ext = f.suffix.lower()
            if ext in IMG:
                refs.append(Reference(str(f), "image"))
            elif ext in VID:
                refs.append(Reference(str(f), "video"))
    return refs


def frames_for(ref: Reference, n: int = 8, workdir: str | None = None) -> list[str]:
    """يرجع مسارات الصور التي يراها المحلل. للفيديو: n إطار موزعة بالتساوي."""
    if ref.kind == "image":
        return [ref.path]
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg غير مثبت: ثبّته أو مرّر إطارات الفيديو كصور في مجلد.")
    out = Path(workdir or tempfile.mkdtemp(prefix="frames_")) / ref.id
    out.mkdir(parents=True, exist_ok=True)
    dur = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", ref.path]).decode().strip() or 0)
    fps = max(n / dur, 0.01) if dur else 1
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", ref.path,
                    "-vf", f"fps={fps},scale=768:-2", "-frames:v", str(n),
                    str(out / "f_%02d.jpg")], check=True)
    return sorted(str(p) for p in out.glob("f_*.jpg"))
