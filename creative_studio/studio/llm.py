"""طبقة LLM: Claude الحقيقي أو Mock للاختبار بدون مفتاح."""
from __future__ import annotations
import base64, json, mimetypes, os, re
from pathlib import Path
from typing import Callable

DEFAULT_MODEL = os.environ.get("CREATIVE_MODEL", "claude-sonnet-5-5")


def parse_json(text: str):
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if not m:
            raise ValueError(f"no JSON in model output: {text[:200]!r}")
        return json.loads(m.group(1))


def image_block(path: str) -> dict:
    mt = mimetypes.guess_type(path)[0] or "image/jpeg"
    data = base64.standard_b64encode(Path(path).read_bytes()).decode()
    return {"type": "image", "source": {"type": "base64", "media_type": mt, "data": data}}


class ClaudeLLM:
    def __init__(self, model: str = DEFAULT_MODEL, retries: int = 2):
        import anthropic  # lazy: غير مطلوب في وضع الاختبار
        self.client = anthropic.Anthropic()
        self.model, self.retries = model, retries

    def json(self, agent: str, system: str, prompt: str, images: list[str] | None = None):
        content = [image_block(p) for p in (images or [])] + [{"type": "text", "text": prompt}]
        system += "\nأجب بـ JSON صالح فقط بدون أي شرح خارجه."
        last = None
        for _ in range(self.retries + 1):
            r = self.client.messages.create(
                model=self.model, max_tokens=8000, system=system,
                messages=[{"role": "user", "content": content}])
            try:
                return parse_json("".join(b.text for b in r.content if b.type == "text"))
            except ValueError as e:
                last = e
        raise last


class MockLLM:
    """يُرجع ردود جاهزة لكل وكيل: handlers[agent](prompt, images) -> obj"""
    def __init__(self, handlers: dict[str, Callable]):
        self.handlers, self.calls = handlers, []

    def json(self, agent, system, prompt, images=None):
        self.calls.append(agent)
        return self.handlers[agent](prompt, images or [])
