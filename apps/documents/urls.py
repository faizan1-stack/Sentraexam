from rest_framework.routers import DefaultRouter

from .views import DocumentAccessLogViewSet, DocumentCategoryViewSet, DocumentViewSet

router = DefaultRouter()
router.register("categories", DocumentCategoryViewSet, basename="document-categories")
router.register("logs", DocumentAccessLogViewSet, basename="document-access-logs")
router.register("", DocumentViewSet, basename="documents")

urlpatterns = router.urls
