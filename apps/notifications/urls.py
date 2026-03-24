from rest_framework.routers import DefaultRouter

from .views import AnnouncementViewSet, NotificationViewSet

router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="announcements")
router.register("", NotificationViewSet, basename="notifications")

urlpatterns = router.urls
