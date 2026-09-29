import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from studio.config import load_brand
from studio.library import Library
from studio.llm import MockLLM, parse_json
from studio.pipeline import Studio
from studio.agents.researcher import make_id
from studio.agents.gatekeeper import palette_distance
from studio.sources import load_sources, trend_report
from studio.report import to_markdown

ROOT = os.path.dirname(os.path.dirname(__file__))
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")


def handlers(gate_score=85):
    ideas = [{"title": f"فكرة {i}", "concept": f"مفهوم فريد رقم {i} " + "كلمة%d " % i * 4, "format": "reel",
              "platform": "instagram", "hook": f"hook{i}", "visual_direction": "v", "cta": "c",
              "tags": ["luxury"], "variants": ["A", "B"]} for i in range(3)]
    ids = [make_id(i["title"], i["concept"]) for i in ideas]
    scores = [90, 65, 30]
    return {
        "analyst": lambda p, im: {"summary": "s", "palette": ["#0B0B0F", "#D4AF37"], "hook": "h", "mood": "فخم"},
        "gatekeeper": lambda p, im: {"score": gate_score, "reasons": ["ok"], "adaptations": ["x"]},
        "researcher": lambda p, im: {"ideas": ideas} if "عدد الأفكار" in p else
        {**ideas[1], "concept": ideas[1]["concept"] + " محسّن"},
        "evaluator": lambda p, im: {"evaluations": [
            {"idea_id": i, "scores": {k: s for k in load_brand(f"{ROOT}/brand/brand.yaml")["weights"]},
             "risks": ["r"], "improvements": ["imp"]} for i, s in zip(ids, scores)]} if "فكرة 0" in p else
        {"evaluations": [{"idea_id": make_id(ideas[1]["title"], ideas[1]["concept"] + " محسّن"),
                          "scores": {k: 90 for k in load_brand(f"{ROOT}/brand/brand.yaml")["weights"]}}]},
        "strategist": lambda p, im: {"objective": "o", "calendar": [
            {"week": 1, "platform": "instagram", "idea_id": ids[0]}, {"week": 1, "platform": "x", "idea_id": ids[2]}],
            "ab_tests": [], "kpis": [], "pillars": [], "risks": []},
    }, ids


class T(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        open(f"{self.d}/a.png", "wb").write(PNG)
        self.brand = load_brand(f"{ROOT}/brand/brand.yaml")
        self.lib = Library(f"{self.d}/l.db")

    def test_full_pipeline_and_revision(self):
        h, ids = handlers()
        res = Studio(MockLLM(h), self.brand, self.lib, log=lambda s: None).run([self.d], [], 3)
        v = {e.idea_id: e.verdict for e in res["evaluations"]}
        self.assertEqual(v[ids[0]], "approve"); self.assertEqual(v[ids[2]], "reject")
        self.assertEqual(sum(1 for x in v.values() if x == "approve"), 2)   # الأولى + المحسّنة بعد revise
        cal = res["strategy"]["calendar"]
        self.assertEqual([c["idea_id"] for c in cal], [ids[0]])            # المرفوضة تُحذف من التقويم
        self.assertIn("الاستراتيجية", to_markdown(res))

    def test_gate_rejects(self):
        h, _ = handlers(gate_score=40)
        res = Studio(MockLLM(h), self.brand, self.lib, log=lambda s: None).run([self.d], [], 3)
        self.assertEqual(res["status"], "all_rejected")

    def test_banned_word_hard_reject(self):
        h, _ = handlers()
        h["analyst"] = lambda p, im: {"summary": "عرض مضمون 100%", "palette": ["#0B0B0F"]}
        res = Studio(MockLLM(h), self.brand, self.lib, log=lambda s: None).run([self.d], [], 3)
        self.assertEqual(res["status"], "all_rejected")

    def test_palette_distance(self):
        self.assertEqual(palette_distance(["#0B0B0F"], ["#0B0B0F"]), 0)
        self.assertGreater(palette_distance(["#FF0000"], ["#0B0B0F", "#D4AF37"]), 60)

    def test_trends_and_feedback(self):
        posts = load_sources([{"path": f"{ROOT}/samples/posts.csv", "platform": "instagram"}])
        t = trend_report(posts)
        self.assertEqual(t["format"][0]["key"], "reel")
        self.lib.record_performance("x", {"engagement_rate": .1})   # فكرة غير موجودة لا تكسر شيئاً
        self.assertEqual(self.lib.format_priors(), {})

    def test_parse_json(self):
        self.assertEqual(parse_json('نص ```json\n{"a":1}\n``` '), {"a": 1})



class W(unittest.TestCase):
    def test_web_demo_flow(self):
        import io
        from studio.web import create_app
        d = tempfile.mkdtemp()
        app = create_app(f"{ROOT}/brand/brand.yaml", f"{d}/w.db")
        c = app.test_client()
        self.assertEqual(c.get("/").status_code, 200)
        r = c.post("/run", data={"refs": (io.BytesIO(PNG), "x.png"), "demo": "on", "ideas": "4"},
                   content_type="multipart/form-data")
        self.assertEqual(r.status_code, 200)
        body = r.get_data(as_text=True)
        self.assertIn("الاستراتيجية", body)
        job = body.split("/report/")[1].split(">")[0]
        self.assertEqual(c.get(f"/report/{job}").status_code, 200)
        self.assertEqual(c.get("/report/..%2f..%2fetc").status_code, 404)


if __name__ == "__main__":
    unittest.main()
