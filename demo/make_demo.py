"""Makes app/demo/novafit-demo.json: one semester (16 weeks) of made-up gym, running and yoga sessions.

Run it from the repository folder:   python3 demo/make_demo.py

The file is an ordinary NOVAFit backup marked with "demo": true. When it is loaded
(Settings → Your data → Load backup), the app moves all dates forward by whole weeks so the
last session was in the past few days. All ids start with "demo-", so the app can remove the
demo sessions again (Settings → Your data → Remove demo data) without touching real ones.
Only the history is in the file: no name, plan or settings are overwritten.
"""
import datetime as dt
import json
import pathlib
import random

random.seed(2627)
WEEKS = 16
FIRST_MONDAY = dt.date(2026, 1, 5)   # any Monday works: the app shifts the dates on loading
QUIET_WEEK = 9                       # exam week: only one yoga session
OUT = pathlib.Path(__file__).resolve().parent.parent / "app" / "demo" / "novafit-demo.json"

history = []


def ms(day, hour, minute):
    """Milliseconds since 1970 (UTC), the format the app stores times in."""
    return int(dt.datetime(day.year, day.month, day.day, hour, minute, tzinfo=dt.timezone.utc).timestamp() * 1000)


def add(kind, day, hour, minute, minutes, **data):
    start = ms(day, hour, minute)
    history.append({"id": f"demo-{kind}-{start // 1000}", "start": start, "end": start + minutes * 60000, **data})


# ---------- Gym: upper body on Monday, lower body on Thursday, weights go up every two weeks ----------
UPPER = {"bench": (50, 2.5, [8, 8, 7]), "lat": (45, 2.5, [10, 10, 9]), "dbsp": (12, 1, [10, 9, 8]), "crow": (40, 2.5, [12, 11, 10]),
         "bic": (9, 1, [12, 11]), "pushdown": (20, 2.5, [12, 12]), "facepull": (15, 0, [15, 14])}
LOWER = {"squat": (55, 2.5, [10, 9, 8]), "rdl": (45, 2.5, [12, 11, 10]), "hip": (50, 5, [12, 12, 11]), "bulgarian": (10, 1, [12, 11, 10]),
         "legcurl": (27.5, 2.5, [12, 11]), "calf": (40, 5, [15, 14, 13])}


def gym(day, workout, exercises, week):
    sets = {}
    for ex, (kg, step, reps) in exercises.items():
        weight = round(kg + step * (week // 2), 1)
        sets[ex] = [{"r": r + (1 if week % 2 and i == 0 else 0), "kg": weight} for i, r in enumerate(reps)]
    add("gym", day, 17, random.choice([30, 40, 50]), random.randint(50, 70), type=workout, sets=sets)


# ---------- Running: easy run on Tuesday, long run on Saturday, both get faster ----------
def run(day, hour, km, pace, note=""):
    km = round(km, 2)
    minutes = round(km * pace, 1)
    add("run", day, hour, 15, round(minutes + 2), type="lauf", run={"mode": "out", "km": km, "min": minutes, "note": note})


# ---------- Yoga ----------
def yoga(day, hour, session, minutes):
    add("yoga", day, hour, 0, minutes, type="yoga",
        yoga={"min": minutes, "flow": True, "note": "", "sid": session, "calm": {"b": random.randint(3, 5), "a": random.randint(1, 2)}})


for week in range(WEEKS):
    monday = FIRST_MONDAY + dt.timedelta(weeks=week)
    day = lambda n: monday + dt.timedelta(days=n)
    if week == QUIET_WEEK:
        yoga(day(2), 21, "study", 10)
        continue
    pace = 6.2 - week * 0.07                                  # min per km, a little faster every week
    gym(day(0), "oben", UPPER, week)
    if week != 6:                                             # one missed leg day
        gym(day(3), "po", LOWER, week)
    run(day(1), 7, 5 + random.uniform(-0.2, 0.9), pace + random.uniform(0, 0.15))
    if week == 14:
        run(day(5), 9, 21.1, pace + 0.25, "First half marathon distance")
    elif week != 15:
        long_km = 6 + week * 0.8 if week % 4 != 3 else 6        # every fourth week an easier one
        run(day(5), 9, long_km + random.uniform(-0.3, 0.3), pace + 0.3, "Carcavelos to Cascais" if week in (4, 8) else "")
    if week in (10, 12, 15):
        run(day(4), 18, 5.0, 4.95 if week == 15 else 5.2)     # 5 km time trial
    yoga(day(2), 20, "winddown" if week % 2 else "back", 15)
    if week % 3 == 2:
        yoga(day(6), 10, "vinyasa", 30)

history.sort(key=lambda e: e["start"])
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps({"v": 2, "demo": True, "history": history}, indent=1) + "\n")
count = lambda key: sum(1 for e in history if key in e)
print(f"{OUT.name}: {len(history)} sessions ({count('sets')} gym, {count('run')} runs, {count('yoga')} yoga)")
