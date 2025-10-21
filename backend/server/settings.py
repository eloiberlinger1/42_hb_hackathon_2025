from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-key')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')

# FT settings
FORTYTWO_CLIENT_ID = "u-s4t2ud-ab1542f280bf15b4868de0bff79d1aadca4814da767aa856e89b142ff35482e3"
FORTYTWO_CLIENT_SECRET = "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"
FORTYTWO_REDIRECT_URI = "http://91.98.148.3:8080/api/auth/callback"

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'laundry',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'server.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'server.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# 42 OAuth configuration via environment variables
FORTYTWO_CLIENT_ID = os.environ.get('FORTYTWO_CLIENT_ID', '')
FORTYTWO_CLIENT_SECRET = os.environ.get('FORTYTWO_CLIENT_SECRET', '')
FORTYTWO_REDIRECT_URI = os.environ.get('FORTYTWO_REDIRECT_URI', '')

SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', 'false').lower() == 'true'
SESSION_COOKIE_SAMESITE = 'Lax'
