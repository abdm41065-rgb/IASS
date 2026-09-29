"""الموظف 4: مقيّم الأفكار — الـ LLM يعطي درجات المعايير، والكود يحسب المجموع ويدمج بيانات الترند."""
from ..config import brand_brief
from ..models import Evaluation, Idea

SYSTEM = """أنت ناقد إبداعي وخبير نمو. قيّم كل فكرة 0-100 على المعايير:
brand_fit, engagement_potential, originality, feasibility, timing. كن ناقداً حقيقياً؛ لا تعطِ الجميع نفس الدرجة.
أرجع JSON: {"evaluations":[{"idea_id","scores":{...},"risks":[],"improvements":[]}]}"""


class IdeaEvaluator:
    name = "evaluator"

    def __init__(self, llm, brand: dict, library):
        self.llm, self.brand, self.lib = llm, brand, library

    def _trend_boost(self, idea: Idea, trends: dict) -> float | None:
        """قوة الفكرة حسب البيانات الفعلية (momentum مخصوماً منه التشبّع) 0-100."""
        rows = {r["key"]: r for r in trends.get("format", []) + trends.get("tag", [])}
        hits = [rows[k] for k in [idea.format, *idea.tags] if k in rows]
        if not hits:
            return None
        return 100 * sum(r["momentum"] * (1 - 0.5 * r["saturation"]) for r in hits) / len(hits)

    def run(self, ideas: list[Idea], trends: dict) -> list[Evaluation]:
        d = self.llm.json(self.name, SYSTEM + "\n" + brand_brief(self.brand),
                          f"الأفكار:\n{[i for i in ideas]}\nالترند:\n{trends}")
        by_id = {e["idea_id"]: e for e in d["evaluations"]}
        w, th, priors = self.brand["weights"], self.brand["thresholds"], self.lib.format_priors()
        out = []
        for idea in ideas:
            e = by_id.get(idea.id)
            if not e:
                continue
            s = {k: max(0.0, min(100.0, float(e["scores"].get(k, 0)))) for k in w}
            boost = self._trend_boost(idea, trends)          # ندمج رأي النموذج مع البيانات الحقيقية 50/50
            if boost is not None:
                s["engagement_potential"] = 0.5 * s["engagement_potential"] + 0.5 * min(boost, 100)
            if priors and idea.format in priors and max(priors.values()) > 0:   # ومع أدائنا الفعلي
                s["engagement_potential"] = 0.7 * s["engagement_potential"] + 0.3 * 100 * priors[idea.format] / max(priors.values())
            total = round(sum(s[k] * w[k] for k in w), 1)
            verdict = "approve" if total >= th["approve"] else "revise" if total >= th["revise"] else "reject"
            if s["brand_fit"] < 50:
                verdict = "reject"                            # فيتو الهوية
            out.append(Evaluation(idea.id, {k: round(v, 1) for k, v in s.items()}, total, verdict,
                                  e.get("risks", []), e.get("improvements", [])))
        return sorted(out, key=lambda x: -x.total)
