"""Mirrors frontend/src/lib/__tests__/domain.test.ts."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from core.alerts import alert_level, feet_phrase_bn, generate_alert, time_phrase
from core.forecast_sources import MockForecastSource, level_at, summarize
from core.geo import haversine_km
from core.trust import TrustInput, trust_score

SEED = json.loads((Path(__file__).resolve().parents[1] / "fixtures" / "seed.json").read_text("utf-8"))
NOW = datetime(2026, 7, 10, 6, 0, tzinfo=timezone.utc)  # 12:00 Dhaka


def station(sid):
    s = next(x for x in SEED["stations"] if x["id"] == sid)
    return SimpleNamespace(**s)


def forecast(sid):
    st = station(sid)
    return st, summarize(st, MockForecastSource().readings(st, NOW), NOW)


def test_haversine():
    assert 90 < haversine_km(23.8103, 90.4125, 24.457, 89.712) < 110


def test_model_continuous_at_zero():
    for s in SEED["stations"]:
        assert abs(level_at(s["model"], 0) - s["model"]["now_m"]) < 1e-9


def test_forecast_shape():
    _, f = forecast("kazipur")
    assert len(f["readings"]) == 25 and f["trend"] == "rising"


def test_feet_phrases():
    assert feet_phrase_bn(1) == "১ ফুট"
    assert feet_phrase_bn(1.4) == "দেড় ফুট"
    assert feet_phrase_bn(0.2) == "আধা ফুট"
    assert feet_phrase_bn(3.6) == "সাড়ে ৩ ফুট"


def test_time_phrase():
    assert time_phrase(datetime(2026, 7, 11, 15, tzinfo=timezone.utc), NOW)[0] == "আগামীকাল রাতের মধ্যে"
    assert time_phrase(datetime(2026, 7, 10, 14, tzinfo=timezone.utc), NOW)[0] == "আজ রাতের মধ্যে"


def test_alert_text():
    st, f = forecast("kazipur")
    union = SimpleNamespace(id="natuarpara")
    a = generate_alert(union, st, f, NOW)
    assert "পানি প্রায়" in a["text_bn"] and "বাড়তে পারে।" in a["text_bn"]
    assert "গবাদিপশু উঁচু জায়গায় সরান।" in a["text_bn"]
    assert a["level"] == alert_level(f)


def test_above_danger_is_level3():
    _, f = forecast("chilmari")
    assert alert_level(f) == 3


def _ti(**kw):
    base = dict(id="a", text="আমরা আটকা পড়েছি, নৌকা পাঠান", lat=22.256, lng=89.301, device_id="d1", severity=3,
                created_at=NOW, union_id="gabura")
    base.update(kw)
    return TrustInput(**base)


def test_trust_clean():
    assert trust_score(_ti(), [], 22.255, 89.3)["trust_score"] == 1


def test_trust_spam():
    others = [_ti(id=f"s{i}", created_at=NOW - timedelta(minutes=5 * i)) for i in (1, 2, 3)]
    r = trust_score(_ti(), others, 22.255, 89.3)
    assert {"device_burst", "duplicate"} <= set(r["trust_flags"]) and r["trust_score"] < 0.5


def test_trust_far():
    assert "far_from_union" in trust_score(_ti(lat=23.81, lng=90.41), [], 22.255, 89.3)["trust_flags"]


def test_trust_contradiction():
    calm = [_ti(id=f"c{i}", device_id=f"x{i}", severity=0) for i in range(3)]
    assert "contradicts_nearby" in trust_score(_ti(), calm, 22.255, 89.3)["trust_flags"]
