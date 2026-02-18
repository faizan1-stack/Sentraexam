from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.notifications.services import NotificationService
from apps.assessments.models import Assessment
from apps.courses.models import CourseEnrollment


@shared_task
def send_exam_reminder(assessment_id: str) -> None:
    """Send exam reminder to assigned or enrolled students 2 hours before."""
    try:
        assessment = Assessment.objects.select_related("course").get(id=assessment_id)
    except Assessment.DoesNotExist:
        return

    if not assessment.scheduled_at:
        return

    # Only send reminders close to scheduled time
    now = timezone.now()
    if assessment.scheduled_at - now > timedelta(hours=2, minutes=5):
        return

    recipients = []
    if assessment.assign_to_all and assessment.course:
        recipients = CourseEnrollment.objects.filter(
            course=assessment.course,
            status=CourseEnrollment.EnrollmentStatus.ENROLLED,
        ).select_related("student")
        student_ids = {e.student_id for e in recipients}
    else:
        student_ids = set(
            assessment.assignments.values_list("student_id", flat=True)
        )

    if not student_ids:
        return

    NotificationService.send_bulk_notification(
        user_ids=student_ids,
        subject="Exam Reminder",
        body=f"Reminder: '{assessment.title}' starts in 2 hours.",
        metadata={
            "assessment_id": str(assessment.id),
            "course_id": str(assessment.course.id) if assessment.course else None,
            "type": "exam_reminder_2h",
        },
    )


def _student_ids_for_assessment(assessment: Assessment) -> set[int]:
    if assessment.assign_to_all and assessment.course:
        return set(
            CourseEnrollment.objects.filter(
                course=assessment.course,
                status=CourseEnrollment.EnrollmentStatus.ENROLLED,
            ).values_list("student_id", flat=True)
        )
    return set(assessment.assignments.values_list("student_id", flat=True))


@shared_task
def send_exam_reminder_24h(assessment_id: str) -> None:
    """Send exam reminder to students 24 hours before."""
    try:
        assessment = Assessment.objects.select_related("course").get(id=assessment_id)
    except Assessment.DoesNotExist:
        return
    if not assessment.scheduled_at:
        return

    student_ids = _student_ids_for_assessment(assessment)
    if not student_ids:
        return

    NotificationService.send_bulk_notification(
        user_ids=student_ids,
        subject="Exam Reminder (24h)",
        body=f"Reminder: '{assessment.title}' is scheduled in 24 hours.",
        metadata={
            "assessment_id": str(assessment.id),
            "course_id": str(assessment.course.id) if assessment.course else None,
            "type": "exam_reminder_24h",
        },
    )


@shared_task
def send_exam_reminder_1h(assessment_id: str) -> None:
    """Send exam reminder to students 1 hour before."""
    try:
        assessment = Assessment.objects.select_related("course").get(id=assessment_id)
    except Assessment.DoesNotExist:
        return
    if not assessment.scheduled_at:
        return

    student_ids = _student_ids_for_assessment(assessment)
    if not student_ids:
        return

    NotificationService.send_bulk_notification(
        user_ids=student_ids,
        subject="Exam Reminder (1h)",
        body=f"Reminder: '{assessment.title}' starts in 1 hour.",
        metadata={
            "assessment_id": str(assessment.id),
            "course_id": str(assessment.course.id) if assessment.course else None,
            "type": "exam_reminder_1h",
        },
    )


@shared_task
def send_exam_start_now(assessment_id: str) -> None:
    """Notify students at exam start time."""
    try:
        assessment = Assessment.objects.select_related("course").get(id=assessment_id)
    except Assessment.DoesNotExist:
        return
    if not assessment.scheduled_at:
        return

    student_ids = _student_ids_for_assessment(assessment)
    if not student_ids:
        return

    NotificationService.send_bulk_notification(
        user_ids=student_ids,
        subject="Exam Started",
        body=f"'{assessment.title}' has started. You can now enter the exam.",
        metadata={
            "assessment_id": str(assessment.id),
            "course_id": str(assessment.course.id) if assessment.course else None,
            "type": "exam_start",
        },
    )
