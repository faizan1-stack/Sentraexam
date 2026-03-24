"""Local development settings - uses SQLite, no Docker required."""

from .base import *  # noqa: F401, F403

# Override database to use SQLite for local development
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

# Remove django.contrib.postgres from INSTALLED_APPS (not needed for SQLite)
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != "django.contrib.postgres"]  # noqa: F405

# Disable Celery for local development (use synchronous task execution)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Use in-memory channel layer for local development so WebSockets work without Redis.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# Debug mode
DEBUG = True

print("Using LOCAL settings with SQLite database")
