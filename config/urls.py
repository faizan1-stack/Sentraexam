"""Project URL configuration."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

api_urlpatterns = [
    path("auth/", include("apps.users.urls")),
    path("departments/", include("apps.departments.urls")),
    path("courses/", include("apps.courses.urls")),
    path("assessments/", include("apps.assessments.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("documents/", include("apps.documents.urls")),
    path("calendar/", include("apps.academic_calendar.urls")),
    path("proctoring/", include("apps.proctoring.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path("api/", include((api_urlpatterns, "api"))),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
