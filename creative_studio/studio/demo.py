"""وضع تجريبي بدون مفتاح API: ردود ثابتة لتجربة الواجهة والتدفق فقط (ليست تحليلاً حقيقياً)."""
from .agents.researcher import make_id
from .llm import MockLLM


def demo_llm(brand: dict) -> MockLLM:
    ideas = [{"title": f"فكرة تجريبية {i}", "concept": f"مفهوم تجريبي مختلف رقم{i} " * 3, "format": f,
              "platform": "instagram", "hook": f"hook{i}", "visual_direction": "اتجاه بصري", "cta": "تواصل معنا",
              "tags": ["luxury"], "variants": ["نسخة A", "نسخة B"]}
             for i, f in enumerate(["reel", "carousel", "story", "reel"])]
    ids = [make_id(i["title"], i["concept"]) for i in ideas]
    sc = [88, 82, 70, 30]
    return MockLLM({
        "analyst": lambda p, im: {"summary": "تحليل تجريبي", "palette": brand["palette"][:2], "hook": "لقطة افتتاحية", "mood": "فخم"},
        "gatekeeper": lambda p, im: {"score": 85, "reasons": ["تجريبي"], "adaptations": ["توحيد الألوان"]},
        "researcher": lambda p, im: {"ideas": ideas} if "عدد الأفكار" in p else {**ideas[2], "concept": ideas[2]["concept"] + " (محسّنة)"},
        "evaluator": lambda p, im: {"evaluations": [
            {"idea_id": i, "scores": {k: s for k in brand["weights"]}, "risks": ["مخاطرة تجريبية"], "improvements": ["تحسين"]}
            for i, s in zip(ids, sc)]},
        "strategist": lambda p, im: {"objective": "هدف تجريبي", "pillars": [], "kpis": [{"metric": "Engagement", "target": "5%"}],
                                     "calendar": [{"week": 1, "day": "الأحد", "platform": "instagram", "idea_id": ids[0], "goal": "وعي"}],
                                     "ab_tests": [], "risks": []}})
