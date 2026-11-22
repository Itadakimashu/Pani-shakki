"""Pani Shakkhi Bangla flood-report classifier (server side).

Mirrors frontend/src/lib/classifier/classifier.ts exactly. Both read the same
rules.json (kept in sync by scripts/sync-shared.sh and checked by tests).

Severity: 0 normal, 1 rising, 2 flooded, 3 emergency.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

RULES_PATH = Path(__file__).with_name("rules.json")
BN_DIGITS = "০১২৩৪৫৬৭৮৯"
_DIGIT_MAP = {ord(c): str(i) for i, c in enumerate(BN_DIGITS)}
_PUNCT_RE = re.compile(r"[।॥,;:!?\"'“”‘’()\[\]{}\-–—/\\|]+")


def canon(s: str, lower: bool = True) -> str:
    """Unicode clean-up shared by text and rule patterns."""
    out = (
        s.replace("য়", "য়")  # য + nukta -> য়
        .replace("ড়", "ড়")  # ড + nukta -> ড়
        .replace("ঢ়", "ঢ়")  # ঢ + nukta -> ঢ়
        .replace(" ", " ")
        .replace("‌", "")
        .replace("‍", "")
        .replace("﻿", "")
    )
    return out.lower() if lower else out


def bn_to_ascii_digits(s: str) -> str:
    return s.translate(_DIGIT_MAP)


def ascii_to_bn_digits(s: Any) -> str:
    return "".join(BN_DIGITS[int(c)] if c.isascii() and c.isdigit() else c for c in str(s))


@lru_cache(maxsize=1)
def _compiled() -> dict[str, Any]:
    rules = json.loads(RULES_PATH.read_text(encoding="utf-8"))

    def comp(p: str) -> re.Pattern[str]:
        # Patterns are canonicalised but NOT lower-cased (that would turn \S into \s).
        return re.compile(canon(p, lower=False))

    sev = []
    for r in rules["severity_rules"]:
        sev.append({
            **r,
            "re": comp(r["pattern"]),
            "unless_re": comp(r["unless"]) if r.get("unless") else None,
            "requires_re": comp(r["requires"]) if r.get("requires") else None,
        })
    number_words = {canon(k): v for k, v in rules["number_words"].items()}
    units = {canon(k): v for k, v in rules["units"].items()}
    num_alt = "|".join(re.escape(k) for k in sorted(number_words, key=len, reverse=True))
    unit_alt = "|".join(re.escape(k) for k in sorted(units, key=len, reverse=True))
    measure_re = re.compile(canon(
        rf"(^|\s)(সাড়ে\s*)?(\d+(?:\.\d+)?|{num_alt})\s*({unit_alt})(?=\s|$)", lower=False))
    return {
        "rules": rules,
        "replacements": [(canon(a), canon(b)) for a, b in rules["replacements"]],
        "severity": sev,
        "levels": [{**w, "re": comp(w["pattern"])} for w in rules["water_levels"]],
        "needs": [{**n, "re": comp(n["pattern"])} for n in rules["needs"]],
        "number_words": number_words,
        "units": units,
        "measure_re": measure_re,
    }


def normalize(text: str | None) -> str:
    c = _compiled()
    s = canon(text or "")
    s = bn_to_ascii_digits(s)
    s = _PUNCT_RE.sub(" ", s)
    for a, b in c["replacements"]:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def extract_water_level(norm: str) -> dict | None:
    c = _compiled()
    m = c["measure_re"].search(norm)
    if m:
        half = 0.5 if m.group(2) else 0
        tok = m.group(3)
        n = float(tok) if tok[0].isdigit() else c["number_words"][tok]
        feet = math.floor((n + half) * c["units"][m.group(4)] * 10 + 0.5) / 10
        if 0 < feet < 60:
            return {"label": "feet", "feet": feet, "source": "measure"}
    best = None
    for w in c["levels"]:
        if w["re"].search(norm) and (best is None or w["feet"] > best["feet"]):
            best = {"label": w["label"], "feet": w["feet"], "source": "body"}
    return best


def extract_needs(norm: str) -> list[str]:
    out: list[str] = []
    for n in _compiled()["needs"]:
        if n["re"].search(norm) and n["need"] not in out:
            out.append(n["need"])
    return out


def _round2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


def classify(text: str | None) -> dict:
    c = _compiled()
    norm = normalize(text)
    score = {0: 0.0, 1: 0.0, 2: 0.0, 3: 0.0}
    signals: list[str] = []

    for r in c["severity"]:
        if not r["re"].search(norm):
            continue
        if r["requires_re"] is not None and not r["requires_re"].search(norm):
            continue
        if r["unless_re"] is not None and r["unless_re"].search(norm):
            continue
        score[r["level"]] += r["weight"]
        signals.append(r["id"])

    water = extract_water_level(norm)
    if water:
        if water["source"] == "body":
            if water["feet"] >= 4:
                score[3] += 3
            elif water["feet"] >= 1.5:
                score[2] += 2
            else:
                score[2] += 1
            signals.append(f"level_{water['label']}")
        elif "rising" in signals:
            score[1] += 0.5
            signals.append("level_measure_rise")
        else:
            if water["feet"] >= 4:
                score[3] += 2
            elif water["feet"] >= 1.5:
                score[2] += 1.5
            else:
                score[2] += 1
            signals.append("level_measure")

    t = c["rules"]["thresholds"]
    eff3 = score[3]
    eff2 = score[2] + score[3]
    eff1 = score[1] + eff2
    severity = 0
    if eff3 >= t["3"]:
        severity = 3
    elif eff2 >= t["2"]:
        severity = 2
    elif eff1 >= t["1"] and eff1 > score[0]:
        severity = 1

    top = {3: eff3, 2: eff2, 1: eff1}.get(severity, max(score[0], 1))
    thr = 1 if severity == 0 else t[str(severity)]
    if not signals:
        confidence = 0.3
    else:
        confidence = min(1, _round2(0.5 + (top - thr) / (2 * thr) + 0.1 * min(len(signals), 3)))

    return {
        "severity": severity,
        "score": _round2(score[3] * 3 + score[2] * 2 + score[1]),
        "confidence": max(0.3, confidence),
        "water_level": water,
        "needs": extract_needs(norm),
        "signals": signals,
        "normalized": norm,
    }
