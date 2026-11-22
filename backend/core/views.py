from datetime import timedelta

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from . import services
from .geo import nearest
from .messaging import ivr_adapter, sms_adapter
from .models import Report, RiverStation, Shelter, Union
from .serializers import (AlertSerializer, BroadcastSerializer, InboundSerializer, ReportCreateSerializer,
                          ReportPatchSerializer, ReportSerializer, RiverStationSerializer, ShelterSerializer,
                          UnionSerializer)


def _float(request, name, required=True):
    v = request.query_params.get(name)
    if v in (None, ""):
        if required:
            raise ValidationError({name: "required"})
        return None
    try:
        return float(v)
    except ValueError:
        raise ValidationError({name: "must be a number"})


@api_view(["GET"])
def health(request):
    return Response({"ok": True, "service": "pani-shakkhi"})


@api_view(["GET"])
def unions(request):
    return Response(UnionSerializer(Union.objects.select_related("station"), many=True).data)


@api_view(["GET"])
def stations(request):
    return Response(RiverStationSerializer(RiverStation.objects.all(), many=True).data)


@api_view(["GET"])
def shelters(request):
    return Response(ShelterSerializer(Shelter.objects.select_related("union"), many=True).data)


@api_view(["GET"])
def shelters_nearest(request):
    lat, lng = _float(request, "lat"), _float(request, "lng")
    limit = min(int(request.query_params.get("limit", 3)), 20)
    out = []
    for sh, d in nearest(lat, lng, Shelter.objects.select_related("union"), limit):
        row = ShelterSerializer(sh).data
        row["distance_km"] = d
        out.append(row)
    return Response(out)


def _create_report(data, channel_override=None):
    ser = ReportCreateSerializer(data=data)
    ser.is_valid(raise_exception=True)
    v = ser.validated_data
    existing = Report.objects.filter(pk=v["client_id"]).first()
    if existing:  # idempotent replay from an offline queue
        return existing, False
    r = Report(
        id=v["client_id"], union=v["union_id"], text=v["text"], audio_url=v.get("audio_url") or None,
        lat=v.get("lat"), lng=v.get("lng"), location_source=v["location_source"] if v.get("lat") is not None else "manual",
        device_id=v["device_id"], channel=channel_override or v["channel"],
        created_at=min(v.get("created_at") or services.utcnow(), services.utcnow()),
    )
    services.apply_classification(r)
    services.apply_trust(r)
    try:
        r.save(force_insert=True)
    except IntegrityError:
        return Report.objects.get(pk=r.pk), False
    return r, True


@api_view(["GET", "POST"])
def reports(request):
    if request.method == "POST":
        r, created = _create_report(request.data)
        return Response(ReportSerializer(r).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    qs = Report.objects.select_related("union")
    p = request.query_params
    if p.get("union"):
        qs = qs.filter(union_id=p["union"])
    if p.get("min_severity") not in (None, ""):
        qs = qs.filter(severity__gte=int(p["min_severity"]))
    if p.get("severity") not in (None, ""):
        qs = qs.filter(severity=int(p["severity"]))
    if p.get("since_hours") not in (None, ""):
        qs = qs.filter(created_at__gte=services.utcnow() - timedelta(hours=float(p["since_hours"])))
    if p.get("status") in ("open", "responded"):
        qs = qs.filter(status=p["status"])
    if p.get("device_id"):
        qs = qs.filter(device_id=p["device_id"])
    limit = min(int(p.get("limit", 500)), 2000)
    return Response(ReportSerializer(qs[:limit], many=True).data)


@api_view(["GET", "PATCH"])
def report_detail(request, pk):
    r = get_object_or_404(Report.objects.select_related("union"), pk=pk)
    if request.method == "PATCH":
        ser = ReportPatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        r.status = ser.validated_data["status"]
        r.responded_at = services.utcnow() if r.status == "responded" else None
        r.save(update_fields=["status", "responded_at"])
    return Response(ReportSerializer(r).data)


@api_view(["GET"])
def forecasts(request):
    qs = RiverStation.objects.all()
    if request.query_params.get("union"):
        u = get_object_or_404(Union, pk=request.query_params["union"])
        qs = qs.filter(pk=u.station_id)
    now = services.utcnow()
    out = []
    for st in qs:
        f = services.station_forecast(st, now)
        out.append({"station": RiverStationSerializer(st).data, **f})
    return Response(out)


@api_view(["GET"])
def alerts(request):
    union_id = request.query_params.get("union")
    if not union_id:
        raise ValidationError({"union": "required"})
    u = get_object_or_404(Union.objects.select_related("station"), pk=union_id)
    return Response(AlertSerializer(services.alerts_for_union(u), many=True).data)


@api_view(["POST"])
def alerts_broadcast(request):
    """Send the current alert for a union to phone numbers via the SMS/IVR adapters."""
    ser = BroadcastSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    v = ser.validated_data
    alert = services.alerts_for_union(v["union"])[0]
    results = []
    for phone in v["phones"]:
        if "sms" in v["channels"]:
            results.append(sms_adapter().send(phone, alert.text_bn))
        if "ivr" in v["channels"]:
            results.append(ivr_adapter().call(phone, alert.text_bn))
    alert.broadcast_at = services.utcnow()
    alert.save(update_fields=["broadcast_at"])
    return Response({"alert_id": alert.id, "sent": [r.__dict__ | {"at": r.at.isoformat()} for r in results]})


@api_view(["POST"])
def inbound(request, channel):
    """Webhook for an SMS gateway / IVR provider: turns an inbound message into a report."""
    ser = InboundSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    v = ser.validated_data
    adapter = sms_adapter() if channel == "sms" else ivr_adapter()
    msg = adapter.parse_inbound(v["payload"])
    if not msg.get("text"):
        raise ValidationError({"payload": "no text/transcript"})
    import hashlib
    key = hashlib.sha1(f"{channel}:{msg['from']}:{msg['text']}:{v['payload'].get('id', '')}".encode()).hexdigest()[:24]
    r, created = _create_report({
        "client_id": f"{channel}-{key}", "union_id": v["union"].id, "text": msg["text"],
        "audio_url": msg.get("audio_url"), "device_id": f"{channel}:{msg['from']}"[:64], "channel": channel,
    }, channel_override=channel)
    return Response(ReportSerializer(r).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["GET"])
def dashboard_summary(request):
    reports_ = list(Report.objects.all().only("severity", "status", "needs", "trust_score", "union_id"))
    by_sev = {str(i): 0 for i in range(4)}
    needs: dict[str, int] = {}
    by_union: dict[str, dict] = {}
    for r in reports_:
        by_sev[str(r.severity)] += 1
        for n in r.needs or []:
            needs[n] = needs.get(n, 0) + 1
        u = by_union.setdefault(r.union_id, {"union_id": r.union_id, "total": 0, "open": 0, "max_severity": 0})
        u["total"] += 1
        u["open"] += r.status == "open"
        u["max_severity"] = max(u["max_severity"], r.severity)
    now = services.utcnow()
    above = sum(1 for st in RiverStation.objects.all()
                if (f := services.station_forecast(st, now))["current_m"] >= f["danger_m"])
    return Response({
        "total": len(reports_),
        "open": sum(r.status == "open" for r in reports_),
        "responded": sum(r.status == "responded" for r in reports_),
        "emergencies": sum(r.severity == 3 and r.status == "open" for r in reports_),
        "flagged": sum(r.trust_score < 0.5 for r in reports_),
        "by_severity": by_sev,
        "by_union": sorted(by_union.values(), key=lambda u: (-u["max_severity"], -u["open"])),
        "needs": needs,
        "stations_above_danger": above,
        "generated_at": now.isoformat().replace("+00:00", "Z"),
    })
