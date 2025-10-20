# 42 waschingmachine

A mobile-friendly React (Vite + TypeScript) frontend to monitor 4 dishwashers in an establishment and mark when a dishwasher is started or finished. Data is stored locally in the browser (no backend required).

## Features

- Four dishwasher cards with clear status: idle, running (with remaining time), finished
- One-tap start for a 45-minute cycle (modifiable in code)
- Mark a machine as finished
- Reset a machine or reset all machines
- Local state persistence using `localStorage`
- Mobile-first UI with accessible labels

## Tech Stack

- React 18 + TypeScript
- Vite for fast dev server and build

## Getting Started

Prerequisites:
- Node.js 18+

Install and run (development):

```bash
cd frontend
npm install
npm run dev
```

The dev server will start at `http://localhost:5173`.

## Project Structure

```
frontend/
  ├─ index.html
  ├─ package.json
  ├─ tsconfig.json
  ├─ vite.config.ts
  └─ src/
     ├─ main.tsx
     ├─ App.tsx
     ├─ index.css
     └─ components/
        └─ DishwasherDashboard.tsx
```

## Customization

- Default cycle length is set to 45 minutes inside `src/components/DishwasherDashboard.tsx` (`startMachine(m.id, 45)`). Adjust as needed.
- The app title and text can be changed in `index.html` and in the header component.

## Docker Deployment

The repository includes a production-ready multi-stage Dockerfile (`frontend/Dockerfile`) that builds the Vite app and serves it with Nginx.

### Build and run with Docker directly

```bash
# Build image
cd frontend
docker build -t 42-waschingmachine:latest .

# Run container on port 8080
docker run --rm -p 8080:80 42-waschingmachine:latest
```

Open `http://localhost:8080`.

### Using docker-compose

```bash
docker compose up --build -d
```

This maps host port 8080 to container port 80. Adjust in `docker-compose.yml` if needed.

### Files

- `frontend/Dockerfile`: multi-stage build (Node -> Nginx)
- `frontend/nginx.conf`: Nginx config with SPA fallback to `index.html`
- `frontend/.dockerignore`: ignores `node_modules`, `dist`, etc.
- `docker-compose.yml`: single-service static site at port 8080

## Notes

- The application stores machine states in `localStorage` under the key `dishwashers:v1`. Clearing browser storage will reset the machines to idle.
- There is no authentication and no backend.

## License

MIT
