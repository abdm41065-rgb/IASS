"""الموظف 2: حارس الجودة والهوية — قواعد صارمة بالكود + حكم LLM."""
import re
from ..config import brand_brief
from ..models import Analysis, GateDecision

SYSTEM = """أنت مدير جودة وهوية بصرية صارم. قيّم هل هذا الرفرنس مناسب لعلامتنا.
أرجع JSON: {"score":0-100,"reasons":[...],"adaptations":["كيف نكيّفه لهويتنا"]}"""


def _rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) if re.fullmatch(r"[0-9a-fA-F]{6}", h) else None


def palette_distance(colors: list[str], brand: list[str]) -> float:
    """متوسط أقرب مسافة RGB من كل لون في الرفرنس إلى ألوان علامتنا."""
    bs = [c for c in map(_rgb, brand) if c]
    cs = [c for c in map(_rgb, colors) if c]
    if not bs or not cs:
        return 0.0
    return sum(min(sum((a - b) ** 2 for a, b in zip(c, x)) ** 0.5 for x in bs) for c in cs) / len(cs)


class BrandGatekeeper:
    name = "gatekeeper"

    def __init__(self, llm, brand: dict):
        self.llm, self.brand = llm, brand

    def run(self, a: Analysis) -> GateDecision:
        b, hard = self.brand, []
        blob = " ".join([a.summary, a.mood, a.hook, *a.tags, *a.formats])
        for w in b["banned_words"] + b["banned_topics"]:
            if w in blob:
                hard.append(f"يحتوي على ممنوع: {w}")
        if a.quality_issues and any("دقة" in q or "blur" in q.lower() or "low" in q.lower() for q in a.quality_issues):
            hard.append("جودة تقنية منخفضة")
        dist = palette_distance(a.palette, b["palette"])
        d = self.llm.json(self.name, SYSTEM + "\n" + brand_brief(b),
                          f"تحليل الرفرنس:\n{a}\nمسافة الألوان عن هويتنا: {dist:.0f} (المسموح {b['palette_tolerance']})")
        score = float(d.get("score", 0))
        reasons = list(d.get("reasons", []))
        adapt = list(d.get("adaptations", []))
        if dist > b["palette_tolerance"]:
            score -= min(20, (dist - b["palette_tolerance"]) / 5)
            adapt.append("إعادة تلوين حسب لوحة العلامة")
        return GateDecision(a.ref_id, approved=not hard and score >= b["min_gate_score"],
                            score=round(score, 1), hard_violations=hard, reasons=reasons, adaptations=adapt)
