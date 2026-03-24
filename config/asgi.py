"""
ASGI config for Sentraexam project.

We expose the Channels ProtocolTypeRouter defined in `config.routing` so both:
- Django's `ASGI_APPLICATION` setting, and
- ASGI servers that import `config.asgi:application`
use the same entrypoint.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Always create the default Django ASGI app first (loads settings / .env).
django_asgi_app = get_asgi_application()

# If Channels is enabled, swap to the ProtocolTypeRouter from config.routing.
try:
    from django.conf import settings

    if getattr(settings, "CHANNELS_ENABLED", False):
        from config.routing import application as channels_app  # noqa: E402

        application = channels_app
    else:
        application = django_asgi_app
except Exception:
    # Safety fallback: never block ASGI startup if Channels isn't installed yet.
    application = django_asgi_app
