"""Wanderly API: plans trips (Groq AI or offline planner) and stores saved trips."""
import json, os, re, uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()
GROQ_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")]
DB_FILE = Path(__file__).parent / "data" / "trips.json"

app = FastAPI(title="Wanderly API")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])


class Plan(BaseModel):
    destination: str = Field(min_length=2, max_length=80)
    days: int = Field(3, ge=1, le=10)
    budget: float = Field(30000, ge=0)
    travelers: int = Field(1, ge=1, le=20)
    pace: str = "balanced"          # slow | balanced | packed
    interests: list[str] = []


class TripIn(BaseModel):
    id: str | None = None
    plan: Plan
    itinerary: dict


# ---------- offline planner ----------
IDEAS = {  # interest -> (morning idea, afternoon idea, evening idea)
    "food": (("Local breakfast spot", "Start with the regional breakfast everyone queues for."),
             ("Street-food crawl", "Graze through stalls and note your favourites."),
             ("Signature dinner", "Book a table for the dish this place is known for.")),
    "culture": (("Old town walk", "Cover the historic centre before it gets busy."),
                ("Museum or heritage site", "Pick one big site and give it time."),
                ("Live music or cultural show", "Check what's on tonight.")),
    "nature": (("Sunrise viewpoint", "Go early for the best light and fewer people."),
               ("Park, lake or trail", "An easy outdoor loop with time to sit."),
               ("Sunset spot", "Pick somewhere open with a view and golden light.")),
    "adventure": (("Guided activity", "Trek, ride or paddle with a local operator."),
                  ("Active afternoon", "Try the area's signature adventure sport."),
                  ("Recovery dinner", "Hearty food after a big day.")),
    "relax": (("Slow morning", "Long breakfast, no alarm."),
              ("Spa or beach time", "Unplug for a few hours."),
              ("Quiet sunset dinner", "Somewhere calm with a view.")),
    "shopping": (("Local market", "Go early for the best picks and prices."),
                 ("Craft and souvenir lanes", "Look for items made locally."),
                 ("Night bazaar", "Browse and snack as the lights come on.")),
    "nightlife": (("Late start brunch", "Ease into the day."),
                  ("Neighbourhood wander", "Scout where you'll go tonight."),
                  ("Bars and live music", "Start early, stay flexible.")),
}
PACE_MULT = {"slow": 0.85, "balanced": 1.0, "packed": 1.1}
TIMES = {"morning": "09:00", "afternoon": "14:00", "evening": "19:30"}
SHARES = {"morning": 0.3, "afternoon": 0.3, "evening": 0.4}


def offline_plan(p: Plan) -> dict:
    dest = p.destination.strip().title()
    picks = [i for i in (x.lower() for x in p.interests) if i in IDEAS] or ["culture", "food"]
    per_day = p.budget * PACE_MULT.get(p.pace, 1.0) * 0.8 / p.days  # keep 20% as buffer
    days = []
    for d in range(p.days):
        slots = []
        for n, period in enumerate(("morning", "afternoon", "evening")):
            key = picks[(d + n) % len(picks)]
            title, note = IDEAS[key][n]
            slots.append({"period": period, "time": TIMES[period], "title": f"{title} in {dest}",
                          "note": note, "cost": round(per_day * SHARES[period], -1)})
        days.append({"theme": f"{picks[d % len(picks)].title()} day", "slots": slots})
    return {
        "title": f"{p.days} days in {dest}",
        "summary": f"A {p.pace} {p.days}-day plan for {p.travelers} traveller(s), built around {', '.join(picks)}.",
        "days": days,
        "packing": ["Phone charger and power bank", "Comfortable walking shoes", "Reusable water bottle",
                    "ID and travel documents", "Light rain jacket"],
    }


# ---------- AI planner ----------
SYSTEM = ("You are a travel planner. Reply with ONLY valid JSON: "
          '{"title":str,"summary":str,"days":[{"theme":str,"slots":[{"period":"morning|afternoon|evening",'
          '"time":"HH:MM","title":str,"note":str,"cost":number}]}],"packing":[str]}. '
          "Exactly three slots per day (morning, afternoon, evening). Costs are for the whole group "
          "in Indian rupees (INR) and must keep the total within budget. Group places by area.")


async def groq_plan(p: Plan) -> dict:
    brief = (f"Destination: {p.destination}\nDays: {p.days}\nTravellers: {p.travelers}\n"
             f"Total budget: {p.budget} INR\nPace: {p.pace}\nInterests: {', '.join(p.interests) or 'general'}")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://api.groq.com/openai/v1/chat/completions",
                         headers={"Authorization": f"Bearer {GROQ_KEY}"},
                         json={"model": GROQ_MODEL, "temperature": 0.7,
                               "response_format": {"type": "json_object"},
                               "messages": [{"role": "system", "content": SYSTEM},
                                            {"role": "user", "content": brief}]})
        r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"]
    return json.loads(re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M))


def clean(it: dict) -> dict:
    """Give every slot an id and make sure the shape is what the UI expects."""
    it.setdefault("title", "Your trip")
    it.setdefault("summary", "")
    for d in it.get("days", []):
        d.setdefault("theme", "Explore")
        for s in d.get("slots", []):
            s["id"] = uuid.uuid4().hex[:8]
            s.setdefault("period", "morning")
            s.setdefault("time", "09:00")
            s.setdefault("note", "")
            try:
                s["cost"] = float(s.get("cost") or 0)
            except (TypeError, ValueError):
                s["cost"] = 0.0
    it["packing"] = [{"text": str(t), "done": False} for t in it.get("packing", [])]
    return it


# ---------- storage (JSON file; swap for Supabase later) ----------
def load() -> list:
    return json.loads(DB_FILE.read_text()) if DB_FILE.exists() else []


def save_all(rows: list):
    DB_FILE.parent.mkdir(exist_ok=True)
    DB_FILE.write_text(json.dumps(rows, indent=2))


# ---------- routes ----------
@app.get("/api/health")
def health():
    return {"ok": True, "planner": "groq" if GROQ_KEY else "offline", "storage": "json-file"}


@app.post("/api/plan")
async def make_plan(p: Plan):
    source, it = "offline", None
    if GROQ_KEY:
        try:
            it, source = await groq_plan(p), "groq"
        except Exception as e:
            print("Groq failed, using offline planner:", e)
    return {"itinerary": clean(it or offline_plan(p)), "source": source}


@app.get("/api/trips")
def list_trips():
    return sorted(load(), key=lambda t: t["saved_at"], reverse=True)


@app.post("/api/trips")
def save_trip(t: TripIn):
    rows, now = load(), datetime.now(timezone.utc).isoformat()
    row = {"id": t.id or uuid.uuid4().hex, "destination": t.plan.destination,
           "title": t.itinerary.get("title"), "plan": t.plan.model_dump(),
           "itinerary": t.itinerary, "saved_at": now}
    rows = [r for r in rows if r["id"] != row["id"]] + [row]
    save_all(rows)
    return row


@app.delete("/api/trips/{trip_id}")
def delete_trip(trip_id: str):
    rows = load()
    if not any(r["id"] == trip_id for r in rows):
        raise HTTPException(404, "Trip not found")
    save_all([r for r in rows if r["id"] != trip_id])
    return {"deleted": trip_id}
