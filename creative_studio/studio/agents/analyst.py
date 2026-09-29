"""الموظف 1: محلل الفيديو والصور — يفكك التصميم لعناصره."""
from ..media import frames_for
from ..models import Analysis, Reference

SYSTEM = """أنت محلل تصميم بصري خبير. حلّل الرفرنس (إطارات فيديو مرتبة زمنياً أو صورة) وأرجع JSON:
{"summary","palette":["#hex"...أهم 3-5 ألوان],"typography","composition","motion","mood",
"hook":"ما الذي يمسك المشاهد بأول 3 ثواني","formats":[...],"tags":[...],"quality_issues":[...]}
كن دقيقاً ولا تخترع ما لا تراه."""


class VisualAnalyst:
    name = "analyst"

    def __init__(self, llm, frames: int = 8):
        self.llm, self.frames = llm, frames

    def run(self, ref: Reference) -> Analysis:
        imgs = frames_for(ref, self.frames)
        d = self.llm.json(self.name, SYSTEM,
                          f"نوع الرفرنس: {ref.kind}. عدد الإطارات: {len(imgs)}. ملاحظات المستخدم: {ref.notes or '-'}", imgs)
        keys = Analysis.__dataclass_fields__.keys() - {"ref_id"}
        return Analysis(ref_id=ref.id, **{k: v for k, v in d.items() if k in keys})
