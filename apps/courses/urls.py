from rest_framework.routers import DefaultRouter

from .views import CourseEnrollmentViewSet, CourseViewSet

router = DefaultRouter()
router.register("enrollments", CourseEnrollmentViewSet, basename="course-enrollments")
router.register("", CourseViewSet, basename="courses")

urlpatterns = router.urls
