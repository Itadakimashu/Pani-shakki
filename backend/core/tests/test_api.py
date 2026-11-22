import pytest
from rest_framework.test import APIClient

from core.messaging import ConsoleSMSAdapter
from core.models import Report

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_list_reports_and_filters(client, seeded):
    all_ = client.get("/api/reports").json()
    assert len(all_) == 60
    assert {"id", "union_id", "severity", "water_level", "needs", "trust_score", "status"} <= set(all_[0])
    gab = client.get("/api/reports", {"union": "gabura"}).json()
    assert gab and all(r["union_id"] == "gabura" for r in gab)
    emerg = client.get("/api/reports", {"min_severity": 3}).json()
    assert emerg and all(r["severity"] == 3 for r in emerg)
    recent = client.get("/api/reports", {"since_hours": 6}).json()
    assert len(recent) < len(all_)
    assert client.get("/api/reports/", {"status": "responded"}).status_code == 200


def test_create_report_classifies_and_is_idempotent(client, seeded):
    body = {"client_id": "t-1", "union_id": "gabura", "text": "আমরা আটকা পড়েছি, নৌকা পাঠান",
            "lat": 22.256, "lng": 89.301, "location_source": "gps", "device_id": "dev-x"}
    r = client.post("/api/reports", body, format="json")
    assert r.status_code == 201
    d = r.json()
    assert d["severity"] == 3 and "boat" in d["needs"] and d["channel"] == "app"
    again = client.post("/api/reports", body, format="json")
    assert again.status_code == 200 and again.json()["id"] == "t-1"
    assert Report.objects.filter(pk="t-1").count() == 1


def test_create_report_validation(client, seeded):
    assert client.post("/api/reports", {"client_id": "x", "union_id": "nope", "text": "a", "device_id": "d"},
                       format="json").status_code == 400
    assert client.post("/api/reports", {"client_id": "x", "union_id": "gabura", "text": "পানি", "device_id": "d",
                                        "lat": 22.2}, format="json").status_code == 400


def test_trust_flags_far_location(client, seeded):
    body = {"client_id": "far-1", "union_id": "gabura", "text": "ঘরে কোমর পানি", "lat": 23.81, "lng": 90.41,
            "location_source": "gps", "device_id": "dev-far"}
    d = client.post("/api/reports", body, format="json").json()
    assert "far_from_union" in d["trust_flags"] and d["trust_score"] < 1


def test_patch_report(client, seeded):
    r = client.patch("/api/reports/seed-001", {"status": "responded"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "responded" and r.json()["responded_at"]
    assert client.patch("/api/reports/seed-001", {"status": "bad"}, format="json").status_code == 400
    assert client.patch("/api/reports/missing", {"status": "open"}, format="json").status_code == 404


def test_forecasts(client, seeded):
    all_ = client.get("/api/forecasts").json()
    assert len(all_) == 8
    f = all_[0]
    assert {"station", "current_m", "danger_m", "delta_24h_m", "peak_m", "trend", "readings"} <= set(f)
    assert len(f["readings"]) == 25
    one = client.get("/api/forecasts", {"union": "ashtamir_char"}).json()
    assert len(one) == 1 and one[0]["station"]["id"] == "chilmari"


def test_alerts(client, seeded):
    assert client.get("/api/alerts").status_code == 400
    a = client.get("/api/alerts", {"union": "ashtamir_char"}).json()
    assert len(a) == 1
    assert a[0]["level"] == 3
    assert "বাড়তে পারে" in a[0]["text_bn"] and a[0]["text_en"]
    calm = client.get("/api/alerts", {"union": "padmapukur"}).json()[0]
    assert calm["level"] <= 1


def test_shelters_nearest(client, seeded):
    r = client.get("/api/shelters/nearest", {"lat": 22.255, "lng": 89.3, "limit": 3}).json()
    assert len(r) == 3 and r[0]["distance_km"] <= r[1]["distance_km"] <= r[2]["distance_km"]
    assert r[0]["union_id"] == "gabura"
    assert client.get("/api/shelters/nearest", {"lat": "x", "lng": 1}).status_code == 400


def test_dashboard_summary(client, seeded):
    s = client.get("/api/dashboard/summary").json()
    assert s["total"] == 60
    assert s["flagged"] >= 4
    assert s["stations_above_danger"] >= 2
    assert sum(s["by_severity"].values()) == 60


def test_unions_stations_shelters(client, seeded):
    assert len(client.get("/api/unions").json()) == 11
    assert client.get("/api/unions").json()[0]["station_id"]
    assert len(client.get("/api/stations").json()) == 8
    assert len(client.get("/api/shelters").json()) == 15


def test_broadcast_and_inbound(client, seeded):
    ConsoleSMSAdapter.outbox.clear()
    r = client.post("/api/alerts/broadcast", {"union": "gabura", "phones": ["+8801700000000"], "channels": ["sms", "ivr"]},
                    format="json")
    assert r.status_code == 200 and len(r.json()["sent"]) == 2
    assert ConsoleSMSAdapter.outbox and "পানি" in ConsoleSMSAdapter.outbox[-1].detail
    r = client.post("/api/inbound/sms", {"union": "gabura", "payload": {"from": "+8801711111111", "text": "উঠোনে হাঁটু পানি"}},
                    format="json")
    assert r.status_code == 201 and r.json()["channel"] == "sms" and r.json()["severity"] == 2
    r = client.post("/api/inbound/ivr", {"union": "gabura", "payload": {"from": "+880", "transcript": "আটকা পড়েছি",
                                                                         "recording_url": "https://example.com/a.mp3"}},
                    format="json")
    assert r.status_code == 201 and r.json()["audio_url"] == "https://example.com/a.mp3"


def test_cors_header(client, seeded):
    r = client.get("/api/unions", HTTP_ORIGIN="https://itadakimashu.github.io")
    assert r.headers.get("access-control-allow-origin") == "https://itadakimashu.github.io"
