from rest_framework.routers import DefaultRouter

from .views import (
    AcademicTermViewSet,
    AcademicYearViewSet,
    CalendarEventViewSet,
    TimetableEntryViewSet,
)

router = DefaultRouter()
router.register("years", AcademicYearViewSet, basename="academic-years")
router.register("terms", AcademicTermViewSet, basename="academic-terms")
router.register("events", CalendarEventViewSet, basename="calendar-events")
router.register("timetable", TimetableEntryViewSet, basename="timetable-entries")

urlpatterns = router.urls
