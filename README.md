# Laundry Notifier (Prototype)

## Backend (Django)

- Créer et activer l'environnement:
```bash
python3 -m venv .venv && source .venv/bin/activate
```
- Installer:
```bash
pip install -r requirements.txt || pip install django djangorestframework django-cors-headers
```
- Lancer les migrations et le serveur:
```bash
cd backend
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Endpoints:
- GET `/api/machines`
- POST `/api/machines/<id>/start`
- POST `/api/machines/<id>/end`
- GET `/api/sse` (SSE)

## Frontend (Vite React TS)

```bash
cd backend/frontend
npm i
npm run dev
```

L'app écoute sur `http://localhost:5173` et consomme l'API sur `http://localhost:8000`.

## QR Code

Encodez des URLs de type `http://localhost:5173/?machine=<ID>` pour démarrer un cycle automatiquement à l'ouverture.
