from .models import to_dict


def to_markdown(res: dict) -> str:
    if res["status"] != "ok":
        return "# كل الرفرنسات مرفوضة\n" + "\n".join(f"- {r}" for r in res["rejected"])
    ideas = {i.id: i for i in res["ideas"]}
    L = [f"# تقرير الاستوديو الإبداعي\n\nرفرنسات مقبولة: {res['accepted']} | مرفوضة: {res['rejected']} | "
         f"منشورات محللة: {res['trends'].get('sample_size', 0)}\n", "## الأفكار مرتبة بالتقييم\n",
         "| # | الفكرة | Format | المنصة | الدرجة | القرار |", "|---|---|---|---|---|---|"]
    for n, e in enumerate(res["evaluations"], 1):
        i = ideas[e.idea_id]
        L.append(f"| {n} | {i.title} | {i.format} | {i.platform} | {e.total} | {e.verdict} |")
    for e in res["evaluations"][:5]:
        i = ideas[e.idea_id]
        L += [f"\n### {i.title}\n{i.concept}\n- **Hook:** {i.hook}\n- **الاتجاه البصري:** {i.visual_direction}\n"
              f"- **CTA:** {i.cta}\n- **نسخ A/B:** {' | '.join(i.variants)}\n- **مخاطر:** {'; '.join(e.risks)}\n"
              f"- **تحسينات:** {'; '.join(e.improvements)}"]
    s = res["strategy"]
    L.append("\n## الاستراتيجية")
    if "error" in s:
        L.append(s["error"])
    else:
        L += [f"**الهدف:** {s.get('objective', '')}\n", f"**Insight:** {s.get('audience_insight', '')}\n", "### الأعمدة"]
        L += [f"- {p['name']} ({p.get('share_pct', '')}%)" for p in s.get("pillars", [])]
        L += ["### التقويم"] + [f"- أسبوع {c['week']} {c.get('day', '')} — {c['platform']} — "
                                f"{ideas[c['idea_id']].title} ({c.get('variant', '')}): {c.get('goal', '')}"
                                for c in s.get("calendar", [])]
        L += ["### KPIs"] + [f"- {k['metric']}: {k['target']}" for k in s.get("kpis", [])]
        L += ["### اختبارات A/B"] + [f"- {t['hypothesis']} → {t['success_metric']}" for t in s.get("ab_tests", [])]
        L += ["### المخاطر"] + [f"- {r['risk']} ← {r['mitigation']}" for r in s.get("risks", [])]
        L.append(f"\nمراجعة الأداء بعد {s.get('review_after_days', 14)} يوم — سجّل النتائج بـ `feedback` ليتعلم النظام.")
    return "\n".join(L)
