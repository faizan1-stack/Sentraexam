from rest_framework.routers import DefaultRouter

from .views import ProctoringViewSet

router = DefaultRouter()
router.register("", ProctoringViewSet, basename="proctoring")

urlpatterns = router.urls
