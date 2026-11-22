from django.contrib import admin

from .models import Alert, ForecastReading, Report, RiverStation, Shelter, Union


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "union", "severity", "status", "trust_score", "channel", "created_at", "short_text")
    list_filter = ("severity", "status", "channel", "union__district_en", "is_demo")
    search_fields = ("text", "device_id")
    actions = ["mark_responded"]

    @admin.display(description="text")
    def short_text(self, obj):
        return obj.text[:60]

    @admin.action(description="Mark selected as responded")
    def mark_responded(self, request, qs):
        from .services import utcnow
        qs.update(status="responded", responded_at=utcnow())


admin.site.register(Union)
admin.site.register(RiverStation)
admin.site.register(ForecastReading, list_display=("station", "timestamp", "level_m", "is_forecast", "source"))
admin.site.register(Shelter, list_display=("name_en", "union", "kind", "capacity", "occupancy"))
admin.site.register(Alert, list_display=("id", "union", "level", "created_at", "broadcast_at"))
