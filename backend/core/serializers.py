from rest_framework import serializers

from .models import Alert, Report, RiverStation, Shelter, Union


class UnionSerializer(serializers.ModelSerializer):
    station_id = serializers.CharField(source="station.id", allow_null=True, read_only=True)

    class Meta:
        model = Union
        fields = ["id", "name_bn", "name_en", "upazila_bn", "upazila_en", "district_bn", "district_en",
                  "lat", "lng", "kind", "station_id"]


class RiverStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiverStation
        fields = ["id", "name_bn", "name_en", "river_bn", "river_en", "lat", "lng", "danger_m", "model"]


class ShelterSerializer(serializers.ModelSerializer):
    union_id = serializers.CharField(source="union.id", read_only=True)

    class Meta:
        model = Shelter
        fields = ["id", "union_id", "name_bn", "name_en", "kind", "capacity", "occupancy", "lat", "lng"]


class ReportSerializer(serializers.ModelSerializer):
    union_id = serializers.CharField(source="union.id", read_only=True)

    class Meta:
        model = Report
        fields = ["id", "union_id", "text", "audio_url", "lat", "lng", "location_source", "device_id", "channel",
                  "severity", "water_level", "needs", "signals", "confidence", "trust_score", "trust_flags",
                  "status", "created_at", "responded_at", "is_demo"]
        read_only_fields = fields


class ReportCreateSerializer(serializers.Serializer):
    client_id = serializers.CharField(max_length=64)
    union_id = serializers.SlugRelatedField(slug_field="id", queryset=Union.objects.all())
    text = serializers.CharField(max_length=2000, trim_whitespace=True)
    audio_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)
    location_source = serializers.ChoiceField(choices=["gps", "manual"], default="manual")
    device_id = serializers.CharField(max_length=64)
    channel = serializers.ChoiceField(choices=["app", "sms", "ivr"], default="app")
    created_at = serializers.DateTimeField(required=False)

    def validate(self, attrs):
        if (attrs.get("lat") is None) != (attrs.get("lng") is None):
            raise serializers.ValidationError("lat and lng must be given together")
        return attrs


class ReportPatchSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["open", "responded"])


class AlertSerializer(serializers.ModelSerializer):
    union_id = serializers.CharField(source="union.id", read_only=True)
    station_id = serializers.CharField(source="station.id", allow_null=True, read_only=True)

    class Meta:
        model = Alert
        fields = ["id", "union_id", "station_id", "level", "title_bn", "title_en", "text_bn", "text_en",
                  "valid_from", "valid_until", "created_at", "source"]


class BroadcastSerializer(serializers.Serializer):
    union = serializers.SlugRelatedField(slug_field="id", queryset=Union.objects.all())
    phones = serializers.ListField(child=serializers.CharField(max_length=20), min_length=1, max_length=500)
    channels = serializers.ListField(child=serializers.ChoiceField(choices=["sms", "ivr"]), default=["sms"])


class InboundSerializer(serializers.Serializer):
    union = serializers.SlugRelatedField(slug_field="id", queryset=Union.objects.all())
    payload = serializers.DictField()
