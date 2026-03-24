from rest_framework.routers import DefaultRouter

from .views import DepartmentMembershipViewSet, DepartmentViewSet

router = DefaultRouter()
router.register("", DepartmentViewSet, basename="departments")
router.register("memberships", DepartmentMembershipViewSet, basename="department-memberships")

urlpatterns = router.urls
