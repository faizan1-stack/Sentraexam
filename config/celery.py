"""Celery application instance."""

import os

from celery import Celery

"""
Default Celery to the same settings module as Django local dev.

If you run Django without explicitly setting DJANGO_SETTINGS_MODULE, manage.py defaults
to config.settings.local. Using config.settings.dev here can accidentally enable a Redis
broker on machines that don't have Redis (or the python redis client) installed.
"""

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("sentraexam")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
