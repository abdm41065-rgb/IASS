from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Reference:
    path: str
    kind: str  # image | video
    notes: str = ""
    frames: list[str] = field(default_factory=list)   # إطارات جاهزة (مثلاً من الاكتشاف التلقائي)

    @property
    def id(self) -> str:
        import hashlib
        return hashlib.sha1(self.path.encode()).hexdigest()[:10]


@dataclass
class Analysis:
    ref_id: str
    summary: str = ""
    palette: list[str] = field(default_factory=list)
    typography: str = ""
    composition: str = ""
    motion: str = ""          # للفيديو: الإيقاع، القطعات، الانتقالات
    mood: str = ""
    hook: str = ""            # أول 3 ثواني / نقطة الجذب
    formats: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    quality_issues: list[str] = field(default_factory=list)


@dataclass
class GateDecision:
    ref_id: str
    approved: bool
    score: float
    hard_violations: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    adaptations: list[str] = field(default_factory=list)  # كيف نكيّفه لهويتنا


@dataclass
class Idea:
    id: str
    title: str
    concept: str
    format: str = ""
    platform: str = ""
    hook: str = ""
    visual_direction: str = ""
    cta: str = ""
    tags: list[str] = field(default_factory=list)
    inspired_by: list[str] = field(default_factory=list)
    variants: list[str] = field(default_factory=list)   # نسخ A/B
    revision: int = 0


@dataclass
class Evaluation:
    idea_id: str
    scores: dict[str, float]
    total: float
    verdict: str              # approve | revise | reject
    risks: list[str] = field(default_factory=list)
    improvements: list[str] = field(default_factory=list)


def to_dict(obj: Any) -> Any:
    return asdict(obj) if hasattr(obj, "__dataclass_fields__") else obj
