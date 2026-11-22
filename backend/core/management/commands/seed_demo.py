"""Load the DEMO seed data (shared with the frontend mock API).

    python manage.py seed_demo            # wipe demo rows and reload
    python manage.py seed_demo --if-empty # only when there are no unions yet (used on Render start)
"""
import json
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from core import services
from core.models import Report, RiverStation, Shelter, Union

SEED = Path(__file__).resolve().parents[2] / "fixtures" / "seed.json"


class Command(BaseCommand):
    help = "Seed demo unions, river stations, shelters and ~60 Bangla reports (DEMO DATA)."

    def add_arguments(self, parser):
        parser.add_argument("--if-empty", action="store_true")

    @transaction.atomic
    def handle(self, *args, if_empty=False, **opts):
        if if_empty and Union.objects.exists():
            self.stdout.write("Data present — skipping seed.")
            return
        data = json.loads(SEED.read_text(encoding="utf-8"))
        Report.objects.filter(is_demo=True).delete()
        for s in data["stations"]:
            RiverStation.objects.update_or_create(id=s["id"], defaults={k: v for k, v in s.items() if k != "id"})
        for u in data["unions"]:
            d = {k: v for k, v in u.items() if k not in ("id", "station_id")}
            Union.objects.update_or_create(id=u["id"], defaults={**d, "station_id": u["station_id"]})
        for s in data["shelters"]:
            d = {k: v for k, v in s.items() if k not in ("id", "union_id")}
            Shelter.objects.update_or_create(id=s["id"], defaults={**d, "union_id": s["union_id"]})
        now = services.utcnow()
        unions = {u.id: u for u in Union.objects.all()}
        objs = []
        for s in data["reports"]:
            created = now - timedelta(hours=s["hours_ago"])
            r = Report(id=s["id"], union=unions[s["union_id"]], text=s["text"], lat=s["lat"], lng=s["lng"],
                       location_source=s["location_source"], device_id=s["device_id"], channel=s["channel"],
                       status=s["status"], created_at=created, is_demo=True,
                       responded_at=now - timedelta(hours=s["hours_ago"] / 2) if s["status"] == "responded" else None)
            services.apply_classification(r)
            objs.append(r)
        Report.objects.bulk_create(objs)
        services.recompute_all_trust()
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(data['unions'])} unions, {len(data['stations'])} stations, "
            f"{len(data['shelters'])} shelters, {len(objs)} reports (DEMO DATA)."))
