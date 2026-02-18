from __future__ import annotations

from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken


User = get_user_model()


@database_sync_to_async
def _get_user_for_token(token: str):
    try:
        access = AccessToken(token)
        user_id = access.get("user_id")
        if not user_id:
            return AnonymousUser()
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()


class JwtQueryStringAuthMiddleware(BaseMiddleware):
    """
    WebSocket auth middleware that accepts a JWT access token via query string:

    `ws://host/ws/notifications/?token=<access_token>`

    This lets the frontend authenticate WebSockets while using JWT for HTTP APIs.
    """

    async def __call__(self, scope, receive, send):
        scope = dict(scope)

        user = scope.get("user")
        if not user or user.is_anonymous:
            try:
                qs = parse_qs(scope.get("query_string", b"").decode())
                token = qs.get("token", [None])[0]
                if token:
                    scope["user"] = await _get_user_for_token(token)
                else:
                    scope["user"] = AnonymousUser()
            except Exception:
                scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtQueryStringAuthMiddleware(AuthMiddlewareStack(inner))

