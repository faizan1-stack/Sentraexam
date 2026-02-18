"""Development settings."""

from .base import *  # noqa

DEBUG = True

INSTALLED_APPS += ["debug_toolbar"]  # type: ignore[misc]

MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE  # type: ignore[name-defined]

INTERNAL_IPS = ["127.0.0.1"]
