"""Mirrors frontend/src/lib/classifier/__tests__/classifier.test.ts."""
import json
from pathlib import Path

import pytest

from core.classifier import classify, normalize
from core.classifier.classifier import ascii_to_bn_digits, bn_to_ascii_digits, extract_water_level

HERE = Path(__file__).parent
CASES = json.loads((HERE / "classifier_cases.json").read_text(encoding="utf-8"))
REPO = HERE.parents[2]


def test_has_at_least_25_cases():
    assert len(CASES) >= 25


@pytest.mark.parametrize("case", CASES, ids=[c["text"] for c in CASES])
def test_shared_case(case):
    r = classify(case["text"])
    assert r["severity"] == case["severity"], r["signals"]
    if "water_level" in case:
        assert r["water_level"]["label"] == case["water_level"]
        if "feet" in case:
            assert r["water_level"]["feet"] == pytest.approx(case["feet"], abs=0.05)
    for n in case.get("needs", []):
        assert n in r["needs"]
    for n in case.get("needs_exclude", []):
        assert n not in r["needs"]


def test_digits():
    assert bn_to_ascii_digits("০১২৩৪৫৬৭৮৯") == "0123456789"
    assert ascii_to_bn_digits(2026) == "২০২৬"


def test_nukta_and_spelling_variants():
    assert normalize("বাড়ছে") == normalize("বাড়ছে")
    assert normalize("পানী") == "পানি"


def test_danda_stripped():
    assert not normalize("পানি বাড়ছে।").endswith("।")


def test_bangla_digit_measure():
    assert extract_water_level(normalize("উঠোনে ৩ ফুট পানি"))["feet"] == 3


def test_empty():
    r = classify("")
    assert r["severity"] == 0 and r["needs"] == []


@pytest.mark.parametrize("name,frontend_rel", [
    ("rules.json", "frontend/src/lib/classifier/rules.json"),
])
def test_rules_in_sync_with_frontend(name, frontend_rel):
    fe = REPO / frontend_rel
    if not fe.exists():
        pytest.skip("frontend not present (e.g. Docker build context)")
    be = HERE.parent / "classifier" / name
    assert json.loads(be.read_text("utf-8")) == json.loads(fe.read_text("utf-8")), \
        "Run scripts/sync-shared.sh"


def test_cases_in_sync_with_frontend():
    fe = REPO / "frontend/src/lib/classifier/cases.json"
    if not fe.exists():
        pytest.skip("frontend not present")
    assert json.loads(fe.read_text("utf-8")) == CASES
