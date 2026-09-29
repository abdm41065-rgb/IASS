"""مكتبة الأفكار: تخزين دائم (SQLite) للرفرنسات والأفكار والأداء الفعلي + منع التكرار."""
from __future__ import annotations
import json, re, sqlite3, statistics
from .models import to_dict


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"\w{3,}", s.lower()))


def similarity(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


class Library:
    def __init__(self, path: str = "library.db"):
        self.db = sqlite3.connect(path)
        self.db.executescript("""
        create table if not exists refs(id text primary key, data text);
        create table if not exists ideas(id text primary key, data text, evaluation text, status text default 'new');
        create table if not exists perf(idea_id text, metrics text, ts default current_timestamp);
        """)

    def _put(self, table, id_, **cols):
        keys = ",".join(["id"] + list(cols)); q = ",".join("?" * (len(cols) + 1))
        self.db.execute(f"insert or replace into {table}({keys}) values({q})",
                        [id_] + [json.dumps(to_dict(v), ensure_ascii=False) if not isinstance(v, str) else v
                                 for v in cols.values()])
        self.db.commit()

    def save_ref(self, ref_id, analysis, decision):
        self._put("refs", ref_id, data={"analysis": to_dict(analysis), "gate": to_dict(decision)})

    def save_idea(self, idea, evaluation=None, status="new"):
        self.db.execute("insert or replace into ideas(id,data,evaluation,status) values(?,?,?,?)",
                        (idea.id, json.dumps(to_dict(idea), ensure_ascii=False),
                         json.dumps(to_dict(evaluation), ensure_ascii=False) if evaluation else None, status))
        self.db.commit()

    def all_ideas(self):
        return [json.loads(r[0]) for r in self.db.execute("select data from ideas")]

    def is_duplicate(self, idea, threshold: float = 0.6) -> bool:
        text = f"{idea.title} {idea.concept} {idea.hook}"
        return any(similarity(text, f"{i['title']} {i['concept']} {i['hook']}") >= threshold
                   for i in self.all_ideas() if i["id"] != idea.id)

    # ---- حلقة التعلّم: الأداء الفعلي يعدّل توقعاتنا ----
    def record_performance(self, idea_id: str, metrics: dict):
        self.db.execute("insert into perf(idea_id,metrics) values(?,?)", (idea_id, json.dumps(metrics)))
        self.db.execute("update ideas set status='published' where id=?", (idea_id,))
        self.db.commit()

    def format_priors(self) -> dict[str, float]:
        """متوسط معدل التفاعل الفعلي لكل format عبر أفكارنا المنشورة."""
        by: dict[str, list[float]] = {}
        for idea_id, m in self.db.execute("select idea_id, metrics from perf"):
            row = self.db.execute("select data from ideas where id=?", (idea_id,)).fetchone()
            if row:
                by.setdefault(json.loads(row[0]).get("format", ""), []).append(
                    json.loads(m).get("engagement_rate", 0))
        return {k: statistics.mean(v) for k, v in by.items() if k and v}
