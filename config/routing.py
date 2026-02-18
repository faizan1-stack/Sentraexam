from __future__ import annotations

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

from config.ws_auth import JwtAuthMiddlewareStack
from apps.notifications.routing import websocket_urlpatterns

# Don't hardcode a settings module here; rely on the environment (manage.py/.env).
# This keeps local/dev/prod consistent and avoids surprising 404s for WS routes.
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.local"),
)

django_asgi_app = get_asgi_application()


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JwtAuthMiddlewareStack(
                URLRouter(
                    websocket_urlpatterns
                )
            )
        ),
    }
)
