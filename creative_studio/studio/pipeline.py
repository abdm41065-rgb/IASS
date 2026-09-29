"""المنسّق: يشغّل الموظفين الخمسة بالترتيب مع حلقة تحسين وحفظ في المكتبة."""
from __future__ import annotations
from typing import Callable
from . import media
from .agents import *
from .library import Library
from .sources import Post, trend_report


class Studio:
    def __init__(self, llm, brand: dict, library: Library, log: Callable[[str], None] = print):
        self.brand, self.lib, self.log = brand, library, log
        self.analyst = VisualAnalyst(llm)
        self.gate = BrandGatekeeper(llm, brand)
        self.researcher = IdeaResearcher(llm, brand, library)
        self.evaluator = IdeaEvaluator(llm, brand, library)
        self.strategist = StrategyBuilder(llm, brand)

    def run(self, ref_paths: list[str], posts: list[Post], n_ideas: int = 20, max_revisions: int = 1) -> dict:
        refs = media.collect(ref_paths)
        if not refs:
            raise ValueError("لم يتم العثور على صور أو فيديوهات في المسارات المعطاة")
        accepted, rejected = [], []
        for r in refs:                                             # 1+2: تحليل ثم بوابة الجودة
            a = self.analyst.run(r)
            g = self.gate.run(a)
            self.lib.save_ref(r.id, a, g)
            self.log(f"[{'✓' if g.approved else '✗'}] {r.path} score={g.score} {g.hard_violations}")
            (accepted if g.approved else rejected).append((a, g))
        if not accepted:
            return {"status": "all_rejected", "rejected": [(a.ref_id, g) for a, g in rejected]}

        trends = trend_report(posts) if posts else {"sample_size": 0}
        ideas = self.researcher.run([(a, g.adaptations) for a, g in accepted], trends, n_ideas)   # 3
        self.log(f"أفكار جديدة بعد إزالة التكرار: {len(ideas)}")
        evals = self.evaluator.run(ideas, trends)                                                 # 4
        for _ in range(max_revisions):                             # حلقة تحسين للأفكار "revise"
            by = {i.id: i for i in ideas}
            redo = [(by[e.idea_id], e) for e in evals if e.verdict == "revise" and e.idea_id in by]
            if not redo:
                break
            new = [self.researcher.revise(i, e.improvements) for i, e in redo]
            old_ids = {i.id for i, _ in redo}
            ideas = [i for i in ideas if i.id not in old_ids] + new
            evals = [e for e in evals if e.idea_id not in old_ids] + self.evaluator.run(new, trends)
            evals.sort(key=lambda e: -e.total)
        for i in ideas:
            ev = next((e for e in evals if e.idea_id == i.id), None)
            self.lib.save_idea(i, ev, ev.verdict if ev else "unscored")
        strategy = self.strategist.run(ideas, evals, trends)                                     # 5
        return {"status": "ok", "accepted": len(accepted), "rejected": len(rejected), "trends": trends,
                "ideas": ideas, "evaluations": evals, "strategy": strategy}
