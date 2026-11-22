"""Pull readings for every station from the configured FORECAST_SOURCE and store them.
Run on a schedule (e.g. a Render cron job) once a real source is plugged in."""
from django.core.management.base import BaseCommand

from core import services
from core.models import RiverStation


class Command(BaseCommand):
    help = "Refresh ForecastReading rows from settings.FORECAST_SOURCE"

    def handle(self, *args, **opts):
        for st in RiverStation.objects.all():
            n = len(services.station_readings(st))
            self.stdout.write(f"{st.id}: {n} readings")
