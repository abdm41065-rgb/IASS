import yaml


def load_brand(path: str = "brand/brand.yaml") -> dict:
    with open(path, encoding="utf-8") as f:
        b = yaml.safe_load(f)
    w = b.get("weights", {})
    if abs(sum(w.values()) - 1) > 0.01:
        raise ValueError("مجموع الأوزان في weights يجب أن = 1")
    return b


def brand_brief(b: dict) -> str:
    return (f"العلامة: {b['name']} | الصوت: {b['voice']} | الجمهور: {b['audience']}\n"
            f"الألوان: {b['palette']} | الخطوط: {b['fonts']}\nمعيار الجودة: {b['quality_bar']}\n"
            f"ممنوع: كلمات {b['banned_words']} ومواضيع {b['banned_topics']}\nإلزامي: {b['must_have']}")
