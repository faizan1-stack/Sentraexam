from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import ActivationTokenViewSet, UserViewSet
from .dashboard import (
    teacher_dashboard,
    hod_dashboard,
    student_dashboard,
    admin_dashboard,
    admin_dashboard_search,
)

router = DefaultRouter()
router.register("accounts", UserViewSet, basename="accounts")
router.register("activation-tokens", ActivationTokenViewSet, basename="activation-tokens")

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Dashboard endpoints
    path("dashboard/teacher/", teacher_dashboard, name="teacher_dashboard"),
    path("dashboard/hod/", hod_dashboard, name="hod_dashboard"),
    path("dashboard/student/", student_dashboard, name="student_dashboard"),
    path("dashboard/admin/", admin_dashboard, name="admin_dashboard"),
    path("dashboard/admin/search/", admin_dashboard_search, name="admin_dashboard_search"),
]

urlpatterns += router.urls

