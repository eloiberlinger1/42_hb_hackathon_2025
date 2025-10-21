# 42 waschingmachine

A mobile-friendly React (Vite + TypeScript) frontend to monitor 4 dishwashers in an establishment and mark when a dishwasher is started or finished. Data is stored locally in the browser (no backend required).

## Features

- Four dishwasher cards with clear status: idle, running (with remaining time), finished
- One-tap start for a 15/30/45-minute cycle
- Mark a machine as finished, then "Empty it" to reset
- Leaderboard based on points (start = +1, empty = +5) with trophies (🥇🥈🥉)
- First-visit login via 42 OAuth (mandatory to interact)
- Shared machine state persisted in SQLite
- Mobile-first UI

## Environment Configuration (.env)

Create a `.env` file next to `docker-compose.yml` with:

```
FORTYTWO_CLIENT_ID=your_client_id
FORTYTWO_CLIENT_SECRET=your_client_secret
# Example: http://91.98.148.3:8080/api/auth/callback/
FORTYTWO_REDIRECT_URI=http://localhost:8080/api/auth/callback/

DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=*
SESSION_COOKIE_SECURE=false
CSRF_COOKIE_SECURE=false
```

- Do not commit secrets.
- In production, set `DJANGO_DEBUG=false` and consider `SESSION_COOKIE_SECURE=true` and `CSRF_COOKIE_SECURE=true` behind HTTPS.

## Development

```bash
# Ensure .env is set
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# App (via Nginx in prod-like): not used in dev; Vite serves frontend
```

## Production

```bash
# Ensure .env is set
npm run start
# App: http://localhost:8080
```

## OAuth 42 Flow

- The frontend sends users to `/api/auth/login/`.
- After successful login on 42, the user returns to `/api/auth/callback/` and a session is created.
- The frontend polls `/api/auth/me/` to check if the user is authenticated and gates actions accordingly.

## API Endpoints

- POST `/api/start` body: `{ machine_id, cycle_minutes }` (requires session)
- POST `/api/empty` body: `{ machine_id }` (requires session)
- GET `/api/leaderboard` -> `{ leaderboard: [{ user, starts, points }] }`
- GET `/api/state` -> `{ machines: [{ id, name, status, remaining_minutes, floor, started_by }] }`
- Auth: `/api/auth/login/`, `/api/auth/callback/`, `/api/auth/me/`, `/api/auth/logout/`

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
