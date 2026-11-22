#!/usr/bin/env python3
"""Generate the DEMO seed data shared by the frontend mock API and the Django
seed command. Deterministic (fixed RNG seed). Writes:
  frontend/src/data/seed.json
  backend/core/fixtures/seed.json

ALL DATA IS ILLUSTRATIVE DEMO DATA. Union names are real; coordinates are
approximate; river levels, reports and shelters are invented.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rng = random.Random(20240817)

UNIONS = [
    # id, bn, en, upazila_bn, upazila_en, district_bn, district_en, lat, lng, kind, station
    ("natuarpara", "নাটুয়ারপাড়া", "Natuarpara", "কাজীপুর", "Kazipur", "সিরাজগঞ্জ", "Sirajganj", 24.700, 89.735, "char", "kazipur"),
    ("sthal", "স্থল", "Sthal", "চৌহালী", "Chauhali", "সিরাজগঞ্জ", "Sirajganj", 24.165, 89.790, "char", "sirajganj"),
    ("khukni", "খুকনী", "Khukni", "শাহজাদপুর", "Shahjadpur", "সিরাজগঞ্জ", "Sirajganj", 24.215, 89.655, "char", "sirajganj"),
    ("jatrapur", "যাত্রাপুর", "Jatrapur", "কুড়িগ্রাম সদর", "Kurigram Sadar", "কুড়িগ্রাম", "Kurigram", 25.790, 89.740, "char", "kurigram"),
    ("ashtamir_char", "অষ্টমীর চর", "Ashtamir Char", "চিলমারী", "Chilmari", "কুড়িগ্রাম", "Kurigram", 25.540, 89.755, "char", "chilmari"),
    ("begumganj", "বেগমগঞ্জ", "Begumganj", "উলিপুর", "Ulipur", "কুড়িগ্রাম", "Kurigram", 25.625, 89.720, "char", "chilmari"),
    ("uttar_sreepur", "উত্তর শ্রীপুর", "Uttar Sreepur", "তাহিরপুর", "Tahirpur", "সুনামগঞ্জ", "Sunamganj", 25.110, 91.120, "haor", "sunamganj"),
    ("fenarbak", "ফেনারবাক", "Fenarbak", "জামালগঞ্জ", "Jamalganj", "সুনামগঞ্জ", "Sunamganj", 24.985, 91.230, "haor", "derai"),
    ("gabura", "গাবুরা", "Gabura", "শ্যামনগর", "Shyamnagar", "সাতক্ষীরা", "Satkhira", 22.255, 89.300, "coastal", "gabura"),
    ("padmapukur", "পদ্মপুকুর", "Padmapukur", "শ্যামনগর", "Shyamnagar", "সাতক্ষীরা", "Satkhira", 22.300, 89.215, "coastal", "gabura"),
    ("pratapnagar", "প্রতাপনগর", "Pratapnagar", "আশাশুনি", "Assasuni", "সাতক্ষীরা", "Satkhira", 22.440, 89.250, "coastal", "assasuni"),
]

# Forecast model params (demo): riverine = smooth rise to a peak then fall; tidal = sinusoid + trend.
STATIONS = [
    dict(id="kazipur", name_bn="কাজীপুর", name_en="Kazipur", river_bn="যমুনা", river_en="Jamuna", lat=24.632, lng=89.660,
         danger_m=15.25, model=dict(kind="riverine", now_m=15.05, past_rate=0.012, peak_delta=0.33, peak_h=30, fall_rate=0.006)),
    dict(id="sirajganj", name_bn="সিরাজগঞ্জ", name_en="Sirajganj", river_bn="যমুনা", river_en="Jamuna", lat=24.457, lng=89.712,
         danger_m=13.35, model=dict(kind="riverine", now_m=13.18, past_rate=0.010, peak_delta=0.30, peak_h=36, fall_rate=0.005)),
    dict(id="chilmari", name_bn="চিলমারী", name_en="Chilmari", river_bn="ব্রহ্মপুত্র", river_en="Brahmaputra", lat=25.567, lng=89.690,
         danger_m=23.70, model=dict(kind="riverine", now_m=23.86, past_rate=0.015, peak_delta=0.26, peak_h=22, fall_rate=0.008)),
    dict(id="kurigram", name_bn="কুড়িগ্রাম", name_en="Kurigram", river_bn="ধরলা", river_en="Dharla", lat=25.808, lng=89.643,
         danger_m=26.50, model=dict(kind="riverine", now_m=26.22, past_rate=0.011, peak_delta=0.31, peak_h=28, fall_rate=0.007)),
    dict(id="sunamganj", name_bn="সুনামগঞ্জ", name_en="Sunamganj", river_bn="সুরমা", river_en="Surma", lat=25.067, lng=91.402,
         danger_m=7.80, model=dict(kind="riverine", now_m=7.96, past_rate=0.020, peak_delta=0.42, peak_h=18, fall_rate=0.010)),
    dict(id="derai", name_bn="দিরাই", name_en="Derai", river_bn="পুরাতন সুরমা", river_en="Old Surma", lat=24.783, lng=91.330,
         danger_m=7.50, model=dict(kind="riverine", now_m=7.12, past_rate=0.014, peak_delta=0.36, peak_h=26, fall_rate=0.006)),
    dict(id="gabura", name_bn="গাবুরা", name_en="Gabura", river_bn="খোলপেটুয়া", river_en="Kholpetua", lat=22.265, lng=89.285,
         danger_m=4.10, model=dict(kind="tidal", now_m=3.62, amp=0.55, period_h=12.42, phase_h=2.0, trend=0.004)),
    dict(id="assasuni", name_bn="আশাশুনি", name_en="Assasuni", river_bn="কপোতাক্ষ", river_en="Kapotakkho", lat=22.555, lng=89.170,
         danger_m=3.80, model=dict(kind="tidal", now_m=3.15, amp=0.45, period_h=12.42, phase_h=5.0, trend=0.002)),
]

SHELTERS = [
    ("natuarpara", "নাটুয়ারপাড়া সরকারি প্রাথমিক বিদ্যালয়", "Natuarpara Govt. Primary School", "school", 450, 210, 0.012, -0.008),
    ("natuarpara", "নাটুয়ারপাড়া বন্যা আশ্রয়কেন্দ্র", "Natuarpara Flood Shelter", "flood_shelter", 800, 520, -0.010, 0.015),
    ("sthal", "স্থল উচ্চ বিদ্যালয়", "Sthal High School", "school", 600, 140, 0.006, 0.010),
    ("khukni", "খুকনী বাঁধ আশ্রয়স্থল", "Khukni Embankment Refuge", "embankment", 1000, 380, -0.012, -0.006),
    ("jatrapur", "যাত্রাপুর বন্যা আশ্রয়কেন্দ্র", "Jatrapur Flood Shelter", "flood_shelter", 700, 650, 0.009, 0.004),
    ("jatrapur", "যাত্রাপুর দাখিল মাদ্রাসা", "Jatrapur Dakhil Madrasa", "school", 350, 90, -0.014, 0.010),
    ("ashtamir_char", "অষ্টমীর চর মুজিব কিল্লা", "Ashtamir Char Mujib Killa", "flood_shelter", 900, 720, 0.008, -0.010),
    ("begumganj", "বেগমগঞ্জ উচ্চ বিদ্যালয়", "Begumganj High School", "school", 500, 260, -0.006, 0.012),
    ("uttar_sreepur", "তাহিরপুর হাওর আশ্রয়কেন্দ্র", "Tahirpur Haor Shelter", "flood_shelter", 650, 300, 0.010, 0.011),
    ("uttar_sreepur", "উত্তর শ্রীপুর সরকারি প্রাথমিক বিদ্যালয়", "Uttar Sreepur Govt. Primary School", "school", 300, 280, -0.012, -0.009),
    ("fenarbak", "ফেনারবাক ইউনিয়ন পরিষদ ভবন", "Fenarbak Union Parishad Building", "flood_shelter", 400, 120, 0.007, -0.012),
    ("gabura", "গাবুরা ঘূর্ণিঝড় আশ্রয়কেন্দ্র", "Gabura Cyclone Shelter", "cyclone_shelter", 1200, 310, 0.010, 0.006),
    ("gabura", "৯ নং সোরা ঘূর্ণিঝড় আশ্রয়কেন্দ্র", "No. 9 Sora Cyclone Shelter", "cyclone_shelter", 900, 150, -0.015, -0.004),
    ("padmapukur", "পদ্মপুকুর ঘূর্ণিঝড় আশ্রয়কেন্দ্র", "Padmapukur Cyclone Shelter", "cyclone_shelter", 1000, 80, 0.006, 0.009),
    ("pratapnagar", "প্রতাপনগর মাধ্যমিক বিদ্যালয়", "Pratapnagar Secondary School", "school", 550, 470, -0.008, 0.007),
]

TEXTS = {
    0: [
        "আমাদের এলাকায় পানি স্বাভাবিক আছে",
        "নদীর পানি কমছে, সবাই ভালো আছি",
        "আজ পানি নেমে যাচ্ছে, সমস্যা নেই",
        "জোয়ারের পানি নেমে গেছে, সব ঠিক আছে",
    ],
    1: [
        "নদীর পানি বাড়ছে, রাতে আরও বাড়তে পারে",
        "গত রাত থেকে পানি ২ ফুট বেড়েছে",
        "চরে ভাঙন শুরু হয়েছে, পানি বাড়তাছে",
        "হাওরে পানি বাড়তেছে, বৃষ্টি থামছে না",
        "নদীর পানি বিপদসীমা ছুঁই ছুঁই",
        "জোয়ারের সময় পানি বাড়ছে, বাঁধের পাশে পানি",
    ],
    2: [
        "উঠোনে হাঁটু পানি, গরু নিয়ে চিন্তায় আছি",
        "ঘরে পানি ঢুকেছে, চৌকির উপর আছি",
        "রাস্তা ডুবে গেছে, বাজারে যাওয়া যাচ্ছে না",
        "উঠোনে এক ফুট পানি, টিউবওয়েল ডুবে গেছে, খাবার পানি নেই",
        "ঘরের ভিতর কোমর পানি, শুকনা খাবার দরকার",
        "ধানক্ষেত সব তলিয়ে গেছে, ঘরে পানি উঠছে",
        "আমরা আশ্রয়কেন্দ্রে যাচ্ছি, ছাগলগুলো রেখে যেতে হচ্ছে",
        "বাড়িতে ২ ফুট পানি, বাচ্চার জ্বর, ওষুধ দরকার",
        "জোয়ারের পানি ঘরে ঢুকছে, রান্না করতে পারছি না",
        "উঠানে কোমর পানি, নৌকা ছাড়া চলা যাচ্ছে না",
    ],
    3: [
        "আমরা আটকা পড়েছি, নৌকা পাঠান",
        "সাহায্য দরকার, ঘর ডুবে যাচ্ছে",
        "পানি বুক সমান, বাচ্চাদের নিয়ে ছাদে উঠেছি",
        "গলা পানি, বৃদ্ধ মা অসুস্থ, ওষুধ লাগবে, উদ্ধার করুন",
        "বাঁধ ভেঙে গ্রাম তলিয়ে গেছে, উদ্ধার করুন",
        "আটকে আছি দুই দিন, খাবার নেই, জরুরি সাহায্য চাই",
        "গরু ছাগল ভেসে যাচ্ছে, সাহায্য দরকার",
        "৫ ফুট পানি ঘরে, টিনের চালে আছি, শিশু আছে",
    ],
}

# Per-union severity weights (scenario: Brahmaputra/Jamuna + Surma flood, Satkhira tidal surge).
WEIGHTS = {
    "natuarpara": [1, 3, 4, 2], "sthal": [1, 4, 3, 1], "khukni": [2, 4, 2, 0],
    "jatrapur": [0, 2, 4, 3], "ashtamir_char": [0, 1, 4, 4], "begumganj": [1, 2, 4, 2],
    "uttar_sreepur": [0, 2, 4, 4], "fenarbak": [1, 3, 4, 1],
    "gabura": [1, 4, 3, 1], "padmapukur": [4, 3, 1, 0], "pratapnagar": [2, 4, 3, 0],
}
COUNTS = {"natuarpara": 6, "sthal": 4, "khukni": 3, "jatrapur": 6, "ashtamir_char": 7, "begumganj": 4,
          "uttar_sreepur": 7, "fenarbak": 4, "gabura": 4, "padmapukur": 3, "pratapnagar": 3}


def jitter(v, km):
    return round(v + rng.uniform(-km, km) / 111.0, 5)


def build():
    unions = [dict(id=u[0], name_bn=u[1], name_en=u[2], upazila_bn=u[3], upazila_en=u[4], district_bn=u[5],
                   district_en=u[6], lat=u[7], lng=u[8], kind=u[9], station_id=u[10]) for u in UNIONS]
    ulook = {u["id"]: u for u in unions}
    shelters = []
    for i, s in enumerate(SHELTERS, 1):
        u = ulook[s[0]]
        shelters.append(dict(id=f"sh-{i:02d}", union_id=s[0], name_bn=s[1], name_en=s[2], kind=s[3], capacity=s[4],
                             occupancy=s[5], lat=round(u["lat"] + s[6], 5), lng=round(u["lng"] + s[7], 5)))
    reports = []
    n = 0
    for uid, count in COUNTS.items():
        u = ulook[uid]
        for _ in range(count):
            n += 1
            sev = rng.choices([0, 1, 2, 3], weights=WEIGHTS[uid])[0]
            text = rng.choice(TEXTS[sev])
            manual = rng.random() < 0.12
            hours = round(rng.uniform(0.2, 40), 2) if sev < 3 else round(rng.uniform(0.1, 14), 2)
            reports.append(dict(
                id=f"seed-{n:03d}", union_id=uid, text=text,
                lat=None if manual else jitter(u["lat"], 4), lng=None if manual else jitter(u["lng"], 4),
                location_source="manual" if manual else "gps",
                device_id=f"dev-{rng.randint(1000, 9999)}", hours_ago=hours,
                status="responded" if (sev >= 2 and rng.random() < 0.2) else "open",
                channel=rng.choices(["app", "sms", "ivr"], weights=[6, 2, 2])[0],
            ))
    # --- Trust-scoring demo cases ---
    g = ulook["gabura"]
    for k in range(4):  # same device spamming the same text
        n += 1
        reports.append(dict(id=f"seed-{n:03d}", union_id="gabura", text="আমরা আটকা পড়েছি, নৌকা পাঠান",
                            lat=round(g["lat"] + 0.002, 5), lng=round(g["lng"] + 0.002, 5), location_source="gps",
                            device_id="dev-spam-01", hours_ago=round(1.0 + k * 0.08, 2), status="open", channel="app"))
    n += 1  # GPS far from the claimed union (Dhaka)
    reports.append(dict(id=f"seed-{n:03d}", union_id="jatrapur", text="সাহায্য দরকার, ঘর ডুবে যাচ্ছে",
                        lat=23.8103, lng=90.4125, location_source="gps", device_id="dev-7777", hours_ago=2.5,
                        status="open", channel="app"))
    p = ulook["padmapukur"]
    n += 1  # emergency claim contradicting calm neighbours
    reports.append(dict(id=f"seed-{n:03d}", union_id="padmapukur", text="বাঁধ ভেঙে গ্রাম তলিয়ে গেছে, উদ্ধার করুন",
                        lat=round(p["lat"] + 0.004, 5), lng=round(p["lng"] - 0.003, 5), location_source="gps",
                        device_id="dev-8181", hours_ago=3.0, status="open", channel="sms"))
    for k, txt in enumerate(["নদীর পানি কমছে, সবাই ভালো আছি", "আমাদের এলাকায় পানি স্বাভাবিক আছে",
                             "জোয়ারের পানি নেমে গেছে, সব ঠিক আছে"]):
        n += 1
        reports.append(dict(id=f"seed-{n:03d}", union_id="padmapukur", text=txt, lat=round(p["lat"] + 0.006 * (k - 1), 5),
                            lng=round(p["lng"] + 0.005, 5), location_source="gps", device_id=f"dev-82{k}0",
                            hours_ago=round(2 + k * 0.7, 2), status="open", channel="app"))
    return dict(
        _notice="DEMO DATA — illustrative only. Union names are real; coordinates are approximate; "
                "river levels, reports and shelter figures are invented for demonstration.",
        version=1, unions=unions, stations=STATIONS, shelters=shelters, reports=reports,
    )


if __name__ == "__main__":
    data = build()
    for rel in ("frontend/src/data/seed.json", "backend/core/fixtures/seed.json"):
        path = ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("wrote", rel, len(data["reports"]), "reports")
