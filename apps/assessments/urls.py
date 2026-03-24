from rest_framework.routers import DefaultRouter

from .views import AssessmentSubmissionViewSet, AssessmentViewSet, ExamSessionViewSet

router = DefaultRouter()
router.register("submissions", AssessmentSubmissionViewSet, basename="assessment-submissions")
router.register("sessions", ExamSessionViewSet, basename="exam-sessions")
router.register("", AssessmentViewSet, basename="assessments")

urlpatterns = router.urls
