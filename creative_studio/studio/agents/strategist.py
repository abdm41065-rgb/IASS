"""الموظف 5: بنّاء الاستراتيجية — يحوّل الأفكار المعتمدة إلى خطة تنفيذ قابلة للقياس."""
from ..config import brand_brief
from ..models import Evaluation, Idea

SYSTEM = """أنت استراتيجي محتوى. ابنِ استراتيجية من الأفكار المعتمدة وبيانات الترند. أرجع JSON:
{"objective","audience_insight","pillars":[{"name","share_pct","ideas":[idea_id]}],
"platform_plan":[{"platform","role","frequency"}],
"calendar":[{"week":1-4,"day","platform","idea_id","variant","goal"}],
"kpis":[{"metric","target","why"}],"ab_tests":[{"idea_id","hypothesis","variants","success_metric"}],
"production":{"priority_order":[idea_id],"needs":[]},"risks":[{"risk","mitigation"}],"review_after_days":14}"""


class StrategyBuilder:
    name = "strategist"

    def __init__(self, llm, brand: dict):
        self.llm, self.brand = llm, brand

    def run(self, ideas: list[Idea], evals: list[Evaluation], trends: dict) -> dict:
        ev = {e.idea_id: e for e in evals}
        chosen = [i for i in ideas if ev.get(i.id) and ev[i.id].verdict == "approve"]
        if not chosen:
            return {"error": "لا توجد أفكار معتمدة — راجع ملاحظات التحسين", "ideas_considered": len(ideas)}
        s = self.llm.json(self.name, SYSTEM + "\n" + brand_brief(self.brand),
                          f"الأفكار المعتمدة:\n{[(i, ev[i.id].total, ev[i.id].risks) for i in chosen]}\nالترند:\n{trends}")
        valid = {i.id for i in chosen}
        s["calendar"] = [c for c in s.get("calendar", []) if c.get("idea_id") in valid]   # لا أفكار غير معتمدة
        s["ab_tests"] = [t for t in s.get("ab_tests", []) if t.get("idea_id") in valid]
        return s
