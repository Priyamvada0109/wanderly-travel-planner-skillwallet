# Wanderly: trip itinerary planner

React (Vite) frontend + FastAPI backend. Works with no API keys (offline planner, trips saved in a JSON file).

## Run on Windows (two terminals, both inside this folder)

Terminal 1, backend:
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```
Check http://127.0.0.1:8000/docs

Terminal 2, frontend:
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Turn on AI
Get a free key at console.groq.com, paste it after `GROQ_API_KEY=` in `backend/.env`, restart uvicorn. Never upload `.env` to GitHub.

## Folder map
- backend/main.py: all API routes, planner, storage
- frontend/src/api.js: every call to the backend
- frontend/src/App.jsx: all screens
- frontend/src/styles.css: the whole design
