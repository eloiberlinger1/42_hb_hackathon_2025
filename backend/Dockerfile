FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV DJANGO_SETTINGS_MODULE=server.settings

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn server.wsgi:application --bind 0.0.0.0:8000 --workers 2"]
