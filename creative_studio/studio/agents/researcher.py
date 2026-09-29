"""الموظف 3: باحث الأفكار — يدمج الرفرنسات المقبولة مع بيانات الترند العالمية ويولّد أفكاراً كثيرة."""
import hashlib
from ..config import brand_brief
from ..library import Library
from ..models import Analysis, Idea

SYSTEM = """أنت رئيس فريق أفكار إبداعية. ولّد أفكاراً متنوعة (formats ومنصات مختلفة) مستوحاة من أسلوب
الرفرنسات المقبولة ومن أنماط الأداء العالية في بيانات المنصات، ومكيّفة لهويتنا. لا تنسخ أي رفرنس حرفياً.
لكل فكرة 2-3 نسخ A/B مختلفة فعلاً بالـ hook. أرجع JSON:
{"ideas":[{"title","concept","format","platform","hook","visual_direction","cta","tags":[],"variants":[]}]}"""

REVISE = """حسّن الفكرة حسب الملاحظات مع الحفاظ على روحها. أرجع JSON بنفس حقول فكرة واحدة."""


def make_id(title: str, concept: str) -> str:
    return hashlib.sha1(f"{title}|{concept}".encode()).hexdigest()[:10]


class IdeaResearcher:
    name = "researcher"

    def __init__(self, llm, brand: dict, library: Library):
        self.llm, self.brand, self.lib = llm, brand, library

    def _idea(self, d, refs, revision=0) -> Idea:
        keys = Idea.__dataclass_fields__.keys() - {"id", "inspired_by", "revision"}
        return Idea(id=make_id(d["title"], d["concept"]), inspired_by=refs, revision=revision,
                    **{k: v for k, v in d.items() if k in keys})

    def run(self, accepted: list[tuple[Analysis, list[str]]], trends: dict, n: int = 20) -> list[Idea]:
        refs = [a.ref_id for a, _ in accepted]
        ctx = "\n".join(f"- {a.summary} | hook: {a.hook} | أسلوب: {a.mood} | تكييف: {ad}" for a, ad in accepted)
        d = self.llm.json(self.name, SYSTEM + "\n" + brand_brief(self.brand),
                          f"عدد الأفكار المطلوب: {n}\nالرفرنسات المقبولة:\n{ctx}\nالترند من "
                          f"{trends.get('sample_size', 0)} منشور:\n{trends}\nنسب أداء منشوراتنا السابقة: {self.lib.format_priors()}")
        ideas, seen = [], set()
        for x in d["ideas"]:
            idea = self._idea(x, refs)
            if idea.id in seen or self.lib.is_duplicate(idea):
                continue
            seen.add(idea.id); ideas.append(idea)
        return ideas

    def revise(self, idea: Idea, notes: list[str]) -> Idea:
        d = self.llm.json(self.name, REVISE + "\n" + brand_brief(self.brand),
                          f"الفكرة: {idea}\nالملاحظات: {notes}")
        d.setdefault("title", idea.title); d.setdefault("concept", idea.concept)
        new = self._idea(d, idea.inspired_by, idea.revision + 1)
        return new
