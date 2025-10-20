# 42 waschingmachine

A mobile-friendly React (Vite + TypeScript) frontend to monitor 4 dishwashers in an establishment and mark when a dishwasher is started or finished. Data is stored locally in the browser (no backend required).

## Features

- Four dishwasher cards with clear status: idle, running (with remaining time), finished
- One-tap start for a 15/30/45-minute cycle
- Mark a machine as finished, then "Empty it" to reset
- Leaderboard based on points (start = +1, empty = +5)
- First-visit username prompt stored in localStorage
- Local state persistence using `localStorage`
- Mobile-first UI with accessible labels

## Tech Stack

- Frontend: React 18 + TypeScript (Vite)
- Backend: Django 5 + SQLite, Gunicorn
- Nginx serving frontend; proxy `/api` to backend

## Development

```bash
# Start dev stack (Vite + Django runserver)
npm run dev
# Frontend: http://localhost:5173  (proxy /api -> http://localhost:8000)
# Backend:  http://localhost:8000/api
```

## Production

```bash
# Build and start production stack (Nginx + Gunicorn)
npm run start
# App on http://localhost:8080
```

## API Endpoints

- POST `/api/start` body: `{ machine_id: number|string, cycle_minutes: number, user_name: string }`
- POST `/api/empty` body: `{ machine_id: number|string, user_name: string }`
- GET `/api/leaderboard` -> `{ leaderboard: [{ user, starts, points }] }`

## Project Structure

```
backend/
  Dockerfile
  manage.py
  requirements.txt
  server/
    __init__.py
    asgi.py
    settings.py
    urls.py
    wsgi.py
  laundry/
    __init__.py
    admin.py
    apps.py
    models.py
    urls.py
    views.py
    migrations/
      0001_initial.py
      0002_seed_machines.py
frontend/
  Dockerfile
  nginx.conf
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    api.ts
    App.tsx
    main.tsx
    index.css
    components/
      DishwasherDashboard.tsx
```

## Notes

- The application stores UI machine states and username in `localStorage`.
- Backend persistence uses SQLite (mounted inside container).

## License

MIT
