# 🚌 NavBus — Deployment Guide
## Deploy Globally in 15 Minutes (Free)

---

## Architecture

```
Users (mobile/web)
       │  WebSocket + HTTP
       ▼
  Render.com  ←── Flask + SocketIO (backend + serves built React)
       │
  SQLite DB (persisted disk on Render)
```

---

## Option 1: Render.com (Recommended — Free tier, always-on)

### Step 1 — Push to GitHub

```bash
# In your navbus_prod folder:
git init
git add .
git commit -m "NavBus initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/navbus.git
git push -u origin main
```

### Step 2 — Deploy Backend on Render

1. Go to **https://render.com** → Sign up free
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set these settings:

| Setting | Value |
|---------|-------|
| Name | `navbus-api` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app` |
| Instance Type | **Free** |

5. Add Environment Variables:
   - `SECRET_KEY` → any random string (e.g. `navbus-prod-secret-xyz123`)
   - `PORT` → `10000` (Render sets this automatically)

6. Click **Create Web Service**
7. Wait ~3 minutes → You get a URL like: `https://navbus-api.onrender.com`

### Step 3 — Add Google Maps Key (optional)

In your `.env` file:
```
VITE_GOOGLE_MAPS_KEY=your_key_here
VITE_BACKEND_URL=https://navbus-api.onrender.com
```

Then rebuild:
```bash
cd frontend
npm run build
cp -r dist/. ../backend/static_frontend/
git add -A && git commit -m "Update build" && git push
```

Render auto-redeploys on every push. ✅

---

## Setting up Google Maps

1. Go to https://console.cloud.google.com
2. Create project → Enable **Maps JavaScript API**
3. Create credentials → API Key
4. Restrict key to your domain (e.g. `navbus-api.onrender.com`)
5. Add to `frontend/.env`:
   ```
   VITE_GOOGLE_MAPS_KEY=AIza...your_key
   ```
6. Rebuild: `cd frontend && npm run build && cp -r dist/. ../backend/static_frontend/`
7. Commit and push

---

## Installing NavBus as a Mobile App (PWA)

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap the **⋮ menu → "Add to Home screen"**
3. NavBus installs like a native app

### iPhone (Safari)
1. Open the app URL in Safari
2. Tap the **Share button → "Add to Home Screen"**
3. NavBus installs on your home screen

The app works offline (shows cached routes/schedules when no internet).

---

## Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Passenger | `passenger` | `pass123` |
| Driver | `driver` | `driver123` |

---

## How Real-Time Works

```
Driver opens app → starts trip
       │
       ▼ (every GPS update)
WebSocket: driver_location event
       │
       ▼
Server broadcasts to room "bus_<id>"
       │
       ▼
All passengers watching that bus
receive the update INSTANTLY
       │
       ▼
Map pin moves, ETA updates live
```

**Fallback:** If WebSocket is unavailable (some corporate networks block WS),
the app automatically falls back to REST polling every 15 seconds.

---

## Local Development

```bash
# Backend with hot reload
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:5000

# Frontend with hot reload (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

### Backend (set on Render/Railway)
| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Flask session secret | `random-string-here` |
| `PORT` | Port (auto-set by hosting) | `10000` |

### Frontend (in `frontend/.env`)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend URL for global deploy | `https://navbus-api.onrender.com` |
| `VITE_GOOGLE_MAPS_KEY` | Google Maps API key | `AIza...` |

**Leave `VITE_BACKEND_URL` empty** when Flask serves the frontend (single-server setup).

---

## Upgrading from Polling to Full WebSocket

The current build already uses WebSockets. No action needed.
The driver app sends GPS via `socket.emit('driver_location', {...})` and
passengers receive `socket.on('bus_update', callback)` in real time.

---

## File Structure

```
navbus_prod/
├── backend/
│   ├── app.py              ← Flask + SocketIO server (all APIs)
│   ├── seed_data.py        ← Vellore bus/route/stop data
│   ├── requirements.txt    ← Python deps
│   ├── Procfile            ← For Render/Railway deployment
│   ├── navbus.db           ← SQLite database (auto-created)
│   └── static_frontend/   ← Built React app (served by Flask)
│
└── frontend/
    ├── src/
    │   ├── hooks/useSocket.js     ← WebSocket hook
    │   ├── pages/BusTracking.jsx  ← Live tracking screen
    │   ├── pages/DriverDashboard.jsx ← Driver GPS screen
    │   └── ...
    ├── .env                ← Your keys (never commit this)
    ├── vite.config.js      ← Vite + PWA config
    └── package.json
```
