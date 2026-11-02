# Wanderly: AI Trip Itinerary Planner

Wanderly turns a destination, number of days, budget and interests into a day-by-day travel plan. You can edit the plan, track the budget, tick off a packing list, save trips and print the itinerary.

Built for the **Skill Wallet Gen AI and Vibe Coding** program.

**Live website:** https://wanderly-travel-planner-skillwallet.vercel.app
**Backend API docs:** https://wanderly-api-p2l2.onrender.com/docs
**GitHub:** https://github.com/Priyamvada0109/wanderly-travel-planner-skillwallet

> The backend runs on a free Render plan and goes to sleep after about 15 minutes of no use. The first request after that can take 30 to 60 seconds. Open the API link once to wake it up before using the website.

## Features

- AI-generated itinerary (morning, afternoon, evening for every day) using Groq
- Offline backup planner: if the AI is unavailable, the app still returns a plan
- Edit time, title and cost of any stop; add or remove stops
- Live budget meter that warns when the plan goes over budget
- Packing checklist
- Save, open and delete trips
- Print-friendly itinerary
- Dark and light mode
- Works on mobile and desktop

## How it works

```
Browser (React, Vercel)
        |  POST /api/plan
        v
FastAPI backend (Render)  --->  Groq AI (openai/gpt-oss-120b)
        |                               |
        |  <-----  JSON itinerary  -----+
        v
Saved trips (trips.json)
```

1. The user fills in the trip form on the website.
2. The frontend sends the form to the backend.
3. The backend asks the Groq model for a JSON itinerary. If that fails, it builds one with the offline planner.
4. The backend cleans the result and returns it, and the frontend shows it as editable cards.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS |
| Backend | Python, FastAPI, Pydantic, httpx |
| AI | Groq API (`openai/gpt-oss-120b`) |
| Storage | JSON file (`backend/data/trips.json`) |
| Hosting | Vercel (frontend), Render (backend), GitHub (code) |

## API routes

| Method | Route | What it does |
|---|---|---|
| GET | `/api/health` | Shows which planner is active (groq or offline) |
| POST | `/api/plan` | Creates an itinerary from the trip form |
| GET | `/api/trips` | Lists saved trips |
| POST | `/api/trips` | Saves or updates a trip |
| DELETE | `/api/trips/{id}` | Deletes a saved trip |

## Run it on your computer (Windows)

You need Python 3.11 or newer and Node.js (LTS). Use two terminals.

**Terminal 1: backend** (open it inside the `backend` folder)
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload
```

**Terminal 2: frontend** (open it inside the `frontend` folder)
```
npm install
npm run dev
```

Open http://localhost:5173. The app works without any key, using the offline planner. To turn on AI, put a free Groq key in `backend/.env`:

```
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-120b
FRONTEND_ORIGIN=http://localhost:5173
```

Never upload `.env` to GitHub. It is already listed in `.gitignore`.

## Deployment

- **Backend (Render):** root directory `backend`, build command `pip install -r requirements.txt`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`. Environment variables: `GROQ_API_KEY`, `GROQ_MODEL`, and `FRONTEND_ORIGIN` (the Vercel website address, so the backend accepts its requests).
- **Frontend (Vercel):** root directory `frontend`. The backend address is set in `frontend/.env.production` as `VITE_API_URL`.

## Project structure

```
backend/
  main.py            API routes, AI planner, offline planner, storage
  requirements.txt
  .env.example
frontend/
  src/App.jsx        all screens (plan form, trip view, saved trips)
  src/api.js         every call to the backend
  src/styles.css     the whole design
  .env.production    backend address for the live site
```

## Known limitations

- Saved trips are stored in a JSON file. On the free Render plan this file can be lost when the server restarts.
- There is no login, so all visitors share the same saved-trips list.
- The free backend sleeps when idle, so the first request can be slow.

## Future improvements

- Move saved trips to a real database such as Supabase
- User accounts, so each person sees only their own trips
- Destination photos
- Map view of each day's stops
- Share a trip with a link
