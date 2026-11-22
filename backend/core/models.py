from django.db import models


class Union(models.Model):
    KINDS = [("char", "Char"), ("haor", "Haor"), ("coastal", "Coastal")]
    id = models.SlugField(primary_key=True, max_length=64)
    name_bn = models.CharField(max_length=128)
    name_en = models.CharField(max_length=128)
    upazila_bn = models.CharField(max_length=128, blank=True)
    upazila_en = models.CharField(max_length=128, blank=True)
    district_bn = models.CharField(max_length=128)
    district_en = models.CharField(max_length=128)
    lat = models.FloatField()
    lng = models.FloatField()
    kind = models.CharField(max_length=16, choices=KINDS, default="char")
    station = models.ForeignKey("RiverStation", null=True, blank=True, on_delete=models.SET_NULL, related_name="unions")

    class Meta:
        ordering = ["district_en", "name_en"]

    def __str__(self):
        return f"{self.name_en} ({self.district_en})"


class RiverStation(models.Model):
    id = models.SlugField(primary_key=True, max_length=64)
    name_bn = models.CharField(max_length=128)
    name_en = models.CharField(max_length=128)
    river_bn = models.CharField(max_length=128)
    river_en = models.CharField(max_length=128)
    lat = models.FloatField()
    lng = models.FloatField()
    danger_m = models.FloatField(help_text="Danger level, metres (PWD datum)")
    model = models.JSONField(default=dict, blank=True, help_text="Mock forecast model params (demo only)")
    ffwc_code = models.CharField(max_length=32, blank=True, help_text="FFWC station id, for the real source")

    def __str__(self):
        return f"{self.river_en} @ {self.name_en}"


class ForecastReading(models.Model):
    station = models.ForeignKey(RiverStation, on_delete=models.CASCADE, related_name="readings")
    timestamp = models.DateTimeField(db_index=True)
    level_m = models.FloatField()
    is_forecast = models.BooleanField(default=False)
    source = models.CharField(max_length=32, default="mock")
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["station", "timestamp"]
        constraints = [models.UniqueConstraint(fields=["station", "timestamp", "source"], name="uniq_reading")]


class Report(models.Model):
    STATUS = [("open", "Open"), ("responded", "Responded")]
    CHANNELS = [("app", "App"), ("sms", "SMS"), ("ivr", "IVR")]
    LOCATION = [("gps", "GPS"), ("manual", "Manual")]

    id = models.CharField(primary_key=True, max_length=64, help_text="Client-generated id (idempotency key)")
    union = models.ForeignKey(Union, on_delete=models.PROTECT, related_name="reports")
    text = models.TextField()
    audio_url = models.URLField(blank=True, null=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    location_source = models.CharField(max_length=8, choices=LOCATION, default="manual")
    device_id = models.CharField(max_length=64, db_index=True)
    channel = models.CharField(max_length=8, choices=CHANNELS, default="app")
    severity = models.PositiveSmallIntegerField(default=0, db_index=True)
    water_level = models.JSONField(null=True, blank=True)
    needs = models.JSONField(default=list, blank=True)
    signals = models.JSONField(default=list, blank=True)
    confidence = models.FloatField(default=0)
    trust_score = models.FloatField(default=1)
    trust_flags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default="open", db_index=True)
    created_at = models.DateTimeField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    is_demo = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.severity}] {self.text[:40]}"


class Shelter(models.Model):
    KINDS = [("school", "School"), ("flood_shelter", "Flood shelter"),
             ("cyclone_shelter", "Cyclone shelter"), ("embankment", "Embankment")]
    id = models.SlugField(primary_key=True, max_length=64)
    union = models.ForeignKey(Union, on_delete=models.CASCADE, related_name="shelters")
    name_bn = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    kind = models.CharField(max_length=24, choices=KINDS)
    capacity = models.PositiveIntegerField()
    occupancy = models.PositiveIntegerField(default=0)
    lat = models.FloatField()
    lng = models.FloatField()

    def __str__(self):
        return self.name_en


class Alert(models.Model):
    LEVELS = [(0, "Normal"), (1, "Watch"), (2, "Warning"), (3, "Danger")]
    id = models.CharField(primary_key=True, max_length=96)
    union = models.ForeignKey(Union, on_delete=models.CASCADE, related_name="alerts")
    station = models.ForeignKey(RiverStation, null=True, on_delete=models.SET_NULL)
    level = models.PositiveSmallIntegerField(choices=LEVELS)
    title_bn = models.CharField(max_length=128)
    title_en = models.CharField(max_length=128)
    text_bn = models.TextField()
    text_en = models.TextField()
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    created_at = models.DateTimeField()
    source = models.CharField(max_length=32, default="mock")
    broadcast_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
