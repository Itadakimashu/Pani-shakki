"""Plain-language Bangla/English alert generator — mirrors frontend/src/lib/alerts.ts."""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from .classifier.classifier import ascii_to_bn_digits

DHAKA = timezone(timedelta(hours=6))  # Bangladesh Standard Time, no DST
FT_PER_M = 3.28084

TITLES = {
    0: ("স্বাভাবিক", "Normal"),
    1: ("সতর্ক থাকুন", "Watch"),
    2: ("বন্যা সতর্কতা", "Flood warning"),
    3: ("বিপদ! এখনই ব্যবস্থা নিন", "Danger — act now"),
}


def _half(ft: float) -> float:
    return max(0.5, math.floor(ft * 2 + 0.5) / 2)


def _num(v: float) -> str:
    return str(int(v)) if v == int(v) else str(v)


def feet_phrase_bn(ft: float) -> str:
    v = _half(ft)
    if v == 0.5:
        return "আধা ফুট"
    if v == 1.5:
        return "দেড় ফুট"
    if v == 2.5:
        return "আড়াই ফুট"
    if v % 1 == 0.5:
        return f"সাড়ে {ascii_to_bn_digits(int(v))} ফুট"
    return f"{ascii_to_bn_digits(_num(v))} ফুট"


def feet_phrase_en(ft: float) -> str:
    v = _half(ft)
    return f"{_num(v)} {'foot' if v == 1 else 'feet'}"


def _part_of_day(hour: int) -> tuple[str, str]:
    if 4 <= hour < 6:
        return "ভোরের", "dawn"
    if 6 <= hour < 12:
        return "সকালের", "morning"
    if 12 <= hour < 15:
        return "দুপুরের", "midday"
    if 15 <= hour < 18:
        return "বিকেলের", "afternoon"
    if 18 <= hour < 20:
        return "সন্ধ্যার", "evening"
    return "রাতের", "night"


def time_phrase(target: datetime, now: datetime) -> tuple[str, str]:
    t, n = target.astimezone(DHAKA), now.astimezone(DHAKA)
    dd = (t.date() - n.date()).days
    hour = t.hour
    if hour < 4 and dd > 0:  # 1am "tomorrow" is still "tonight"
        dd -= 1
        hour = 23
    p_bn, p_en = _part_of_day(hour)
    if dd <= 0:
        return f"আজ {p_bn} মধ্যে", ("by tonight" if p_en == "night" else f"by this {p_en}")
    if dd == 1:
        return f"আগামীকাল {p_bn} মধ্যে", f"by tomorrow {p_en}"
    return "আগামী দুই দিনের মধ্যে", "within the next two days"


def alert_level(f: dict) -> int:
    if f["current_m"] >= f["danger_m"] and f["trend"] != "falling":
        return 3
    if f["peak_m"] >= f["danger_m"]:
        return 2
    if f["peak_m"] >= f["danger_m"] - 0.3 and f["trend"] == "rising":
        return 1
    return 0


def _parse(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def generate_alert(union, station, f: dict, now: datetime, shelter=None) -> dict:
    """f: forecast summary dict (forecast_sources.summarize). Returns Alert field dict."""
    level = alert_level(f)
    tidal = (station.model or {}).get("kind") == "tidal"
    rise_m = f["peak_m"] - f["current_m"]
    bn: list[str] = []
    en: list[str] = []

    if f["trend"] == "falling" and rise_m < 0.05:
        bn.append("পানি কমতে শুরু করেছে।")
        en.append("Water has started to fall.")
    elif rise_m >= 0.05:
        t_bn, t_en = time_phrase(_parse(f["peak_at"]), now)
        ft = rise_m * FT_PER_M
        bn.append(f"{t_bn} {'জোয়ারে ' if tidal else ''}পানি প্রায় {feet_phrase_bn(ft)} বাড়তে পারে।")
        en.append(f"Water may rise about {feet_phrase_en(ft)} {t_en}{' with the tide' if tidal else ''}.")
    else:
        bn.append("পানি এখন স্থির আছে।")
        en.append("Water is steady now.")

    if f["current_m"] >= f["danger_m"]:
        bn.append(f"{station.river_bn} নদীর পানি বিপদসীমার উপরে।")
        en.append(f"The {station.river_en} is above danger level.")
    elif f["peak_m"] >= f["danger_m"]:
        bn.append(f"{station.river_bn} নদীর পানি বিপদসীমা ছাড়াতে পারে।")
        en.append(f"The {station.river_en} may cross danger level.")

    if level == 3:
        bn.append("শিশু, বয়স্ক ও গর্ভবতীদের নিয়ে এখনই আশ্রয়কেন্দ্রে যান।")
        en.append("Take children, elders and pregnant women to a shelter now.")
        if shelter is not None:
            bn.append(f"নিকটতম: {shelter.name_bn}।")
            en.append(f"Nearest: {shelter.name_en}.")
    elif level == 2:
        bn.append("গবাদিপশু উঁচু জায়গায় সরান। শুকনা খাবার, খাবার পানি ও জরুরি কাগজ প্লাস্টিকে ভরে রাখুন।")
        en.append("Move livestock to higher ground. Pack dry food, drinking water and documents in plastic.")
    elif level == 1:
        bn.append("গবাদিপশু উঁচু জায়গায় সরান।")
        en.append("Move livestock to higher ground.")
    elif f["trend"] == "falling" and rise_m < 0.05:
        bn.append("তবুও সাবধানে থাকুন, ফুটানো পানি পান করুন।")
        en.append("Stay careful and drink boiled water.")
    else:
        bn.append("এখন ভয়ের কিছু নেই। খবর শুনতে থাকুন।")
        en.append("No danger now. Keep listening for updates.")

    t0 = now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return {
        "id": f"alert-{union.id}-{int(t0.timestamp() * 1000)}",
        "union_id": union.id,
        "station_id": station.id,
        "level": level,
        "title_bn": TITLES[level][0],
        "title_en": TITLES[level][1],
        "text_bn": " ".join(bn),
        "text_en": " ".join(en),
        "valid_from": t0,
        "valid_until": t0 + timedelta(hours=12),
        "created_at": t0,
    }
