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



def fake_youtube(url):
    import urllib.parse as up
    path = up.urlparse(url).path.split("/")[-1]
    if path == "search":
        return {"items": [{"id": {"videoId": v}} for v in ("v1", "v2", "v3")]}
    if path == "videos":
        st = lambda l, c, w: {"likeCount": l, "commentCount": c, "viewCount": w}
        mk = lambda i, s: {"id": i, "statistics": s, "snippet": {"title": f"T{i}", "channelId": "c", "publishedAt": "2026-09-01T00:00:00Z", "tags": ["Luxury"]}}
        return {"items": [mk("v1", st(9000, 800, 50000)), mk("v2", st(100, 2, 90000)), mk("v3", st(5000, 300, 40000))]}
    if path == "channels":
        return {"items": [{"id": "c", "statistics": {"subscriberCount": "100000"}}]}
    if path == "commentThreads":
        if "videoId=v3" in url:
            raise RuntimeError("comments disabled")
        return {"items": [{"snippet": {"topLevelComment": {"snippet": {"textDisplay": "تصوير خرافي", "likeCount": 500}}}}]}


class D(unittest.TestCase):
    def test_discovery_ranks_and_downloads(self):
        from studio.discovery import YouTubeDiscovery
        d = tempfile.mkdtemp()
        y = YouTubeDiscovery("k", fake_youtube, lambda u: b"JPG")
        found = y.search(["q"], top=2, out_dir=d)
        self.assertEqual([f.url for f in found][0], "https://youtu.be/v1")      # الأعلى تفاعلاً وتعليقات
        self.assertNotIn("v2", [f.url[-2:] for f in found][0])
        self.assertEqual(len(found[0].ref.frames), 4)
        self.assertIn("تصوير خرافي", found[0].ref.notes)

    def test_pipeline_with_discovered(self):
        from studio.discovery import YouTubeDiscovery
        from studio.web import create_app
        d = tempfile.mkdtemp()
        app = create_app(f"{ROOT}/brand/brand.yaml", f"{d}/w.db",
                         discovery_factory=lambda: YouTubeDiscovery("k", fake_youtube, lambda u: PNG))
        r = app.test_client().post("/run", data={"discover": "عطور", "demo": "on", "ideas": "4"},
                                   content_type="multipart/form-data")
        self.assertEqual(r.status_code, 200, r.get_data(as_text=True)[:300])
        self.assertIn("منشورات محللة: 3", r.get_data(as_text=True))

    def test_missing_key(self):
        from studio.discovery import YouTubeDiscovery
        os.environ.pop("YOUTUBE_API_KEY", None)
        with self.assertRaises(RuntimeError):
            YouTubeDiscovery()



class S(unittest.TestCase):
    ITEMS = [
        {"webVideoUrl": "https://tiktok.com/@a/1", "text": "عطر", "diggCount": 9000, "commentCount": 500, "shareCount": 700,
         "playCount": 40000, "authorMeta": {"fans": 1000}, "createTimeISO": "2026-09-20T00:00:00Z",
         "hashtags": [{"name": "Perfume"}], "videoMeta": {"coverUrl": "http://c/1.jpg"}},
        {"webVideoUrl": "https://tiktok.com/@b/2", "text": "ضعيف", "diggCount": 10, "commentCount": 0, "shareCount": 0,
         "playCount": 90000, "videoMeta": {"coverUrl": "http://c/2.jpg"}},
        {"webVideoUrl": "https://tiktok.com/@c/3", "text": "بلا غلاف", "diggCount": 99999, "playCount": 10},
        "garbage"]

    def test_tiktok_ranking_and_robustness(self):
        from studio.social import ApifyDiscovery
        d = tempfile.mkdtemp()
        calls = []
        a = ApifyDiscovery("T", lambda u, b: calls.append((u, b)) or self.ITEMS, lambda u: b"JPG")
        f = a.search("tiktok", ["#perfume", "luxury"], top=5, out_dir=d)
        self.assertEqual(f[0].url, "https://tiktok.com/@a/1")
        self.assertEqual(len(f), 2)                                   # بلا غلاف يُستبعد، والعنصر غير الصالح لا يكسر
        self.assertEqual(calls[0][1]["hashtags"], ["perfume", "luxury"])
        self.assertIn("clockworks~tiktok-scraper", calls[0][0])
        self.assertTrue(os.path.exists(f[0].ref.frames[0]))

    def test_instagram_mapping(self):
        from studio.social import to_post
        p, c = to_post("instagram", {"url": "u", "caption": "c", "likesCount": 5, "commentsCount": 2,
                                     "videoViewCount": 100, "displayUrl": "d", "type": "Video", "hashtags": ["A"]})
        self.assertEqual((p.likes, p.comments, p.views, p.format, p.tags, c), (5, 2, 100, "reel", ["a"], "d"))

    def test_missing_token(self):
        from studio.social import ApifyDiscovery
        os.environ.pop("APIFY_TOKEN", None)
        with self.assertRaises(RuntimeError):
            ApifyDiscovery()

    def test_web_social(self):
        from studio.social import ApifyDiscovery
        from studio.web import create_app
        d = tempfile.mkdtemp()
        app = create_app(f"{ROOT}/brand/brand.yaml", f"{d}/w.db",
                         social_factory=lambda: ApifyDiscovery("T", lambda u, b: self.ITEMS, lambda u: PNG))
        r = app.test_client().post("/run", data={"tiktok": "perfume", "demo": "on", "ideas": "4"},
                                   content_type="multipart/form-data")
        self.assertEqual(r.status_code, 200, r.get_data(as_text=True)[:300])
        self.assertIn("منشورات محللة: 2", r.get_data(as_text=True))



class B(unittest.TestCase):
    def test_num(self):
        from studio.browser import num
        self.assertEqual((num("1,234"), num("1.2K"), num("3M"), num("x")), (1234, 1200, 3000000, 0))

    def test_parse_instagram(self):
        from studio.browser import parse_instagram
        p, img = parse_instagram('12K likes, 340 comments - user on September 1, 2026: "عطر #luxury جديد"', "im", "https://www.instagram.com/reel/abc/")
        self.assertEqual((p.likes, p.comments, p.format, p.tags, img), (12000, 340, "reel", ["luxury"], "im"))
        self.assertEqual(p.caption, "عطر #luxury جديد")

    def test_parse_tiktok(self):
        from studio.browser import parse_tiktok
        j = {"__DEFAULT_SCOPE__": {"webapp.video-detail": {"itemInfo": {"itemStruct": {
            "desc": "d", "createTime": "1790000000", "stats": {"diggCount": 5, "playCount": 90},
            "authorStats": {"followerCount": 7}, "textExtra": [{"hashtagName": "Perfume"}],
            "video": {"cover": "cv"}}}}}}
        p, c = parse_tiktok(j, "u")
        self.assertEqual((p.likes, p.views, p.followers, p.tags, c), (5, 90, 7, ["perfume"], "cv"))
        self.assertEqual(parse_tiktok({}, "u")[0].likes, 0)          # صفحة بهيكل مختلف لا تكسر

    def test_rank_drops_no_cover(self):
        from studio.browser import BrowserDiscovery, parse_instagram
        rows = [parse_instagram("100 likes, 5 comments - u on d: \"a\"", "im", "u1"),
                parse_instagram("1 likes, 0 comments - u on d: \"b\"", "", "u2")]
        f = BrowserDiscovery(lambda u: b"J")._rank("instagram", rows, 5, tempfile.mkdtemp())
        self.assertEqual([x.url for x in f], ["u1"])



class U(unittest.TestCase):
    def test_urls_via_apify_and_read_urls(self):
        from studio.social import ApifyDiscovery, read_urls
        urls = read_urls(f"{ROOT}/refs/instagram_links.txt")
        self.assertEqual(len(urls), 17); self.assertTrue(all("?" not in u for u in urls))
        calls = []
        items = [{"url": "https://instagram.com/reel/x/", "caption": "c", "likesCount": 50, "commentsCount": 2,
                  "displayUrl": "http://d/1.jpg", "type": "Video"}]
        a = ApifyDiscovery("T", lambda u, b: calls.append(b) or items, lambda u: b"J")
        f = a.search_urls(urls, out_dir=tempfile.mkdtemp())
        self.assertEqual(calls[0]["directUrls"], urls); self.assertEqual(len(f), 1)

    def test_screenshot_metrics_load(self):
        posts = load_sources([{"path": f"{ROOT}/refs/screenshots_metrics.csv"}])
        self.assertEqual(len(posts), 4)
        self.assertEqual(max(posts, key=lambda p: p.likes).likes, 799)


if __name__ == "__main__":
    unittest.main()
