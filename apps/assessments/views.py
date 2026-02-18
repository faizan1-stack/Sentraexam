from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import QuerySet
from django.utils import timezone
from datetime import timedelta
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.settings import api_settings

from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminHODOrTeacher, IsAdminOrHOD, IsAdminOrTeacher, IsTeacher
from apps.notifications.services import NotificationService
from .models import Assessment, AssessmentSubmission, ExamAssignment, ExamSession
from .serializers import (
    AssessmentApprovalSerializer,
    AssessmentCreateSerializer,
    AssessmentGradeSerializer,
    AssessmentScheduleSerializer,
    AssessmentScheduleApprovalSerializer,
    AssessmentSerializer,
    AssessmentSubmissionSerializer,
    AssignStudentsSerializer,
    AutoSaveAnswersSerializer,
    ExamAssignmentSerializer,
    ExamSessionSerializer,
    ReportCheatingSerializer,
    StartExamSessionSerializer,
)


class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.select_related(
        "course", "course__department", "created_by", "approved_by"
    )
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("course", "assessment_type", "status")
    search_fields = ("title", "description")
    ordering_fields = ("scheduled_at", "created_at")

    def _sync_time_based_statuses(self, assessments: list[Assessment]) -> None:
        """
        Keep assessment.status in sync with scheduled_at/closes_at.

        We do this on read (list/retrieve) to avoid requiring cron/celery beat,
        and to handle reschedules safely.

        Rules:
        - Only SCHEDULED/IN_PROGRESS are time-driven.
        - If now >= (scheduled_at + duration) -> COMPLETED
        - Else if now >= scheduled_at -> IN_PROGRESS
        - Else -> SCHEDULED
        """
        if not assessments:
            return
        now = timezone.now()
        to_update: list[Assessment] = []
        for a in assessments:
            if a.status not in {Assessment.Status.SCHEDULED, Assessment.Status.IN_PROGRESS}:
                continue

            desired = a.status
            if a.scheduled_at:
                hard_end = a.scheduled_at + timedelta(minutes=int(a.duration_minutes or 0))
                if now >= hard_end:
                    desired = Assessment.Status.COMPLETED
                elif now >= a.scheduled_at:
                    desired = Assessment.Status.IN_PROGRESS
                else:
                    desired = Assessment.Status.SCHEDULED
            elif a.scheduled_at and now >= a.scheduled_at:
                desired = Assessment.Status.IN_PROGRESS
            elif a.scheduled_at and now < a.scheduled_at:
                desired = Assessment.Status.SCHEDULED

            if desired != a.status:
                a.status = desired
                a.updated_at = now
                to_update.append(a)

        if to_update:
            Assessment.objects.bulk_update(to_update, ["status", "updated_at"])

    def get_queryset(self) -> QuerySet[Assessment]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs.distinct()
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(course__department_id=user.department_id).distinct()
        if user.role == User.Role.TEACHER:
            return qs.filter(course__assigned_teacher=user).distinct()
        if user.role == User.Role.STUDENT:
            visible_statuses = [
                Assessment.Status.SCHEDULED,
                Assessment.Status.IN_PROGRESS,
                Assessment.Status.COMPLETED,
            ]
            department_filter = models.Q(status__in=visible_statuses)
            if user.department_id:
                department_filter &= models.Q(course__department_id=user.department_id)
            return qs.filter(
                models.Q(
                    course__enrollments__student=user,
                    status__in=visible_statuses,
                )
                | department_filter
            ).distinct()
        return qs.none()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            # `page` is a list-like slice of model instances.
            self._sync_time_based_statuses(list(page))
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        items = list(queryset)
        self._sync_time_based_statuses(items)
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._sync_time_based_statuses([instance])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return AssessmentCreateSerializer
        return self.serializer_class

    def get_permissions(self):
        if self.action in {"create"}:
            return [IsAuthenticated(), IsTeacher()]
        if self.action in {"update", "partial_update"}:
            return [IsAuthenticated(), IsTeacher()]
        if self.action in {"destroy"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action in {"approve"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action in {"schedule"}:
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        if self.action in {"approve_schedule"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action == "submit_for_approval":
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        assessment = serializer.save()
        request_user = self.request.user
        # Enforce teacher can only create assessments for assigned courses
        if request_user.role == User.Role.TEACHER and assessment.course.assigned_teacher_id != request_user.id:
            raise PermissionDenied("You can only create assessments for your assigned courses.")
        assessment.created_by = request_user
        assessment.save(update_fields=["created_by"])
        # Notify HODs in department and admins about new assessment
        from apps.courses.models import CourseEnrollment

        recipients: set[int] = set(
            User.objects.filter(
                role=User.Role.HOD,
                department_id=assessment.course.department_id,
                is_active=True,
            ).values_list("id", flat=True)
        )
        recipients |= set(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))
        if assessment.course.assigned_teacher_id:
            recipients.add(int(assessment.course.assigned_teacher_id))

        if recipients:
            NotificationService.send_bulk_notification(
                user_ids=recipients,
                subject="Assessment Created",
                body=f"Assessment '{assessment.title}' was created for {assessment.course.code}.",
                metadata={
                    "assessment_id": str(assessment.id),
                    "course_id": str(assessment.course.id),
                    "action": "assessment_created",
                },
            )
        # Notify enrolled students about submission deadline (if available)
        if assessment.course and assessment.closes_at:
            student_ids = set(
                CourseEnrollment.objects.filter(
                    course=assessment.course,
                    status=CourseEnrollment.EnrollmentStatus.ENROLLED,
                ).values_list("student_id", flat=True)
            )
            if student_ids:
                NotificationService.send_bulk_notification(
                    user_ids=student_ids,
                    subject="Assessment Deadline",
                    body=f"'{assessment.title}' deadline is {assessment.closes_at.strftime('%Y-%m-%d %H:%M')}.",
                    metadata={
                        "assessment_id": str(assessment.id),
                        "course_id": str(assessment.course.id),
                        "type": "assessment_deadline",
                    },
                )

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_for_approval(self, request, *args, **kwargs):
        assessment = self.get_object()
        if request.user.role not in {User.Role.TEACHER, User.Role.HOD, User.Role.ADMIN}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        assessment.submit_for_approval()

        # Notify HODs and admins about submission for approval
        recipients = set(
            User.objects.filter(
                role=User.Role.HOD,
                department_id=assessment.course.department_id,
                is_active=True,
            ).values_list("id", flat=True)
        )
        recipients |= set(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))

        if recipients:
            NotificationService.send_bulk_notification(
                user_ids=recipients,
                subject="Assessment Submitted for Approval",
                body=f"Assessment '{assessment.title}' was submitted for approval.",
                metadata={
                    "assessment_id": str(assessment.id),
                    "course_id": str(assessment.course.id),
                    "action": "assessment_submitted",
                },
            )
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        assessment = self.get_object()
        serializer = AssessmentApprovalSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(assessment=assessment)

        # Notify teacher, HOD, and admins about approval
        recipients: set[int] = set()
        if assessment.course.assigned_teacher_id:
            recipients.add(int(assessment.course.assigned_teacher_id))
        recipients |= set(
            User.objects.filter(
                role=User.Role.HOD,
                department_id=assessment.course.department_id,
                is_active=True,
            ).values_list("id", flat=True)
        )
        recipients |= set(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))

        if recipients:
            NotificationService.send_bulk_notification(
                user_ids=recipients,
                subject="Assessment Approved",
                body=f"Assessment '{assessment.title}' has been approved.",
                metadata={
                    "assessment_id": str(assessment.id),
                    "course_id": str(assessment.course.id),
                    "action": "assessment_approved",
                },
            )
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def schedule(self, request, *args, **kwargs):
        """
        Teacher/HOD/Admin propose a schedule; Admin must approve it.

        Schedules must be proposed using structured inputs (no free-text times).
        """
        assessment = self.get_object()

        if assessment.status not in {Assessment.Status.APPROVED, Assessment.Status.SCHEDULED}:
            raise ValidationError({"detail": "This assessment is not eligible for scheduling."})

        # Only Admin/HOD/assigned Teacher can propose scheduling.
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            raise PermissionDenied("Only Admin, HOD, or assigned Teacher can schedule exams.")

        # Role checks (backend-enforced, not just frontend filtering)
        if request.user.role == User.Role.HOD and assessment.course.department_id != request.user.department_id:
            raise PermissionDenied("You can only schedule assessments in your department.")
        if request.user.role == User.Role.TEACHER and assessment.course.assigned_teacher_id != request.user.id:
            raise PermissionDenied("You can only schedule assessments for your assigned courses.")

        serializer = AssessmentScheduleSerializer(
            data=request.data,
            context={"request": request, "assessment": assessment},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(assessment=assessment)

        # Notify HOD(s) + Admin about proposed schedule (and teacher too).
        recipients = list(
            User.objects.filter(
                role=User.Role.HOD,
                department_id=assessment.course.department_id,
                is_active=True,
            ).values_list("id", flat=True)
        )
        recipients += list(
            User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
        )
        if assessment.course.assigned_teacher_id:
            recipients.append(assessment.course.assigned_teacher_id)

        NotificationService.send_bulk_notification(
            user_ids=set(recipients),
            subject="Exam Schedule Proposed",
            body=f"Schedule proposed for '{assessment.title}' ({assessment.course.code}).",
            metadata={
                "assessment_id": str(assessment.id),
                "course_id": str(assessment.course.id),
                "action": "schedule_proposed",
            },
        )

        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="schedule/approve")
    def approve_schedule(self, request, *args, **kwargs):
        """Admin approves; Admin/HOD can reject a proposed schedule (with reason)."""
        from apps.courses.models import CourseEnrollment
        from apps.notifications.tasks import (
            send_exam_reminder,
            send_exam_reminder_24h,
            send_exam_reminder_1h,
            send_exam_start_now,
        )

        assessment = self.get_object()
        # Admin can approve/reject. HOD can reject only (department-scoped).
        if request.user.role == User.Role.HOD and assessment.course.department_id != request.user.department_id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD}:
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = AssessmentScheduleApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approved = serializer.validated_data["approved"]
        reason = serializer.validated_data.get("reason", "")

        if approved and request.user.role == User.Role.HOD:
            return Response(
                {"detail": "Only Admin can approve schedules. HOD can reject with a reason."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not approved:
            # Reject proposal
            assessment.schedule_state = Assessment.ScheduleState.DRAFT
            assessment.schedule_approved_by = request.user
            assessment.schedule_approved_at = timezone.now()
            assessment.status = Assessment.Status.APPROVED
            # Clear times so the next proposal starts fresh.
            assessment.scheduled_at = None
            assessment.closes_at = None
            assessment.save(
                update_fields=[
                    "schedule_state",
                    "schedule_approved_by",
                    "schedule_approved_at",
                    "status",
                    "scheduled_at",
                    "closes_at",
                    "updated_at",
                ]
            )

            # Notify the assigned teacher (primary) and proposer (secondary) with the rejection reason.
            to_notify: set[int] = set()
            if assessment.course.assigned_teacher_id:
                to_notify.add(int(assessment.course.assigned_teacher_id))
            if assessment.schedule_proposed_by_id:
                to_notify.add(int(assessment.schedule_proposed_by_id))

            body_reason = reason.strip() or "No reason provided."
            for uid in to_notify:
                NotificationService.send_notification(
                    user_id=uid,
                    subject="Exam Schedule Rejected",
                    body=(
                        f"Schedule proposal was rejected for '{assessment.title}' ({assessment.course.code}).\n"
                        f"Reason: {body_reason}"
                    ),
                    metadata={
                        "assessment_id": str(assessment.id),
                        "course_id": str(assessment.course.id),
                        "action": "schedule_rejected",
                        "reason": body_reason,
                        "rejected_by": str(request.user.id),
                    },
                )
            return Response(AssessmentSerializer(assessment, context={"request": request}).data)

        if assessment.schedule_state != Assessment.ScheduleState.PROPOSED:
            return Response(
                {"detail": "No proposed schedule to approve."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not assessment.scheduled_at:
            return Response(
                {"detail": "Proposed schedule is missing a start time."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assessment.schedule_state = Assessment.ScheduleState.APPROVED
        assessment.schedule_approved_by = request.user
        assessment.schedule_approved_at = timezone.now()
        assessment.status = Assessment.Status.SCHEDULED
        assessment.save(
            update_fields=[
                "schedule_state",
                "schedule_approved_by",
                "schedule_approved_at",
                "status",
                "updated_at",
            ]
        )

        # Notify students about the approved schedule
        student_ids: set[int] = set()
        if assessment.assign_to_all and assessment.course:
            student_ids = set(
                CourseEnrollment.objects.filter(
                    course=assessment.course,
                    status=CourseEnrollment.EnrollmentStatus.ENROLLED,
                ).values_list("student_id", flat=True)
            )
        else:
            student_ids = set(assessment.assignments.values_list("student_id", flat=True))

        if student_ids:
            NotificationService.send_bulk_notification(
                user_ids=student_ids,
                subject="Exam Scheduled",
                body=f"'{assessment.title}' is scheduled for {assessment.scheduled_at.strftime('%Y-%m-%d %H:%M')}.",
                metadata={
                    "assessment_id": str(assessment.id),
                    "course_id": str(assessment.course.id),
                    "type": "exam_scheduled",
                },
            )

        # Notify HOD/teacher/admin
        recipients = list(
            User.objects.filter(
                role=User.Role.HOD,
                department_id=assessment.course.department_id,
                is_active=True,
            ).values_list("id", flat=True)
        )
        recipients += list(
            User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
        )
        if assessment.course.assigned_teacher_id:
            recipients.append(assessment.course.assigned_teacher_id)

        NotificationService.send_bulk_notification(
            user_ids=set(recipients),
            subject="Exam Schedule Approved",
            body=f"Schedule approved for '{assessment.title}' ({assessment.course.code}).",
            metadata={
                "assessment_id": str(assessment.id),
                "course_id": str(assessment.course.id),
                "action": "schedule_approved",
            },
        )

        # Reminders: configurable offsets (default 24h + 1h) and at start.
        if assessment.scheduled_at:
            now = timezone.now()
            eta_start = assessment.scheduled_at

            offsets = getattr(settings, "EXAM_REMINDER_OFFSETS_HOURS", ["24", "2", "1"])
            offsets_set = {str(o).strip() for o in offsets}

            if "24" in offsets_set:
                eta_24h = assessment.scheduled_at - timedelta(hours=24)
                try:
                    if eta_24h > now:
                        send_exam_reminder_24h.apply_async(args=[str(assessment.id)], eta=eta_24h)
                    else:
                        send_exam_reminder_24h.delay(str(assessment.id))
                except Exception:
                    # Dev-friendly: don't fail schedule approval if Celery/Redis isn't configured.
                    pass

            if "2" in offsets_set:
                eta_2h = assessment.scheduled_at - timedelta(hours=2)
                try:
                    if eta_2h > now:
                        send_exam_reminder.apply_async(args=[str(assessment.id)], eta=eta_2h)
                    else:
                        send_exam_reminder.delay(str(assessment.id))
                except Exception:
                    pass

            if "1" in offsets_set:
                eta_1h = assessment.scheduled_at - timedelta(hours=1)
                try:
                    if eta_1h > now:
                        send_exam_reminder_1h.apply_async(args=[str(assessment.id)], eta=eta_1h)
                    else:
                        send_exam_reminder_1h.delay(str(assessment.id))
                except Exception:
                    pass

            try:
                if eta_start > now:
                    send_exam_start_now.apply_async(args=[str(assessment.id)], eta=eta_start)
                else:
                    send_exam_start_now.delay(str(assessment.id))
            except Exception:
                pass

        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    # =========================================================================
    # Student Assignment Endpoints
    # =========================================================================

    @action(detail=True, methods=["post"], url_path="assign")
    def assign_students(self, request, *args, **kwargs):
        """Assign specific students to take this exam."""
        assessment = self.get_object()
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        serializer = AssignStudentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.save(assessment=assessment)
        
        # Notify assigned students
        assigned_student_ids = {a.student_id for a in created}
        if assigned_student_ids:
            when = assessment.scheduled_at.strftime('%Y-%m-%d %H:%M') if assessment.scheduled_at else "TBD"
            NotificationService.send_bulk_notification(
                user_ids=assigned_student_ids,
                subject="New Exam Assigned",
                body=f"You have been assigned to take the exam '{assessment.title}'. Scheduled: {when}.",
                metadata={
                    "assessment_id": str(assessment.id),
                    "course_id": str(assessment.course.id),
                    "type": "exam_assigned",
                },
            )
        # Notify HODs, assigned teacher, and admins about assignment
        recipients = []
        if assessment.course.assigned_teacher_id:
            recipients.append(assessment.course.assigned_teacher_id)
        recipients += list(User.objects.filter(
            role=User.Role.HOD,
            department_id=assessment.course.department_id,
            is_active=True,
        ).values_list("id", flat=True))
        recipients += list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))
        NotificationService.send_bulk_notification(
            user_ids=set(recipients),
            subject="Exam Assigned",
            body=f"Exam '{assessment.title}' assigned to {len(created)} students.",
            metadata={
                "assessment_id": str(assessment.id),
                "course_id": str(assessment.course.id),
                "action": "exam_assigned",
            },
        )
        
        return Response({
            "message": f"Assigned {len(created)} new students to the exam.",
            "total_assigned": assessment.assignments.count(),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="assignments")
    def list_assignments(self, request, *args, **kwargs):
        """List all students assigned to this exam."""
        assessment = self.get_object()
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        assignments = assessment.assignments.select_related("student")
        serializer = ExamAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"], url_path="assignments/(?P<student_id>[^/.]+)")
    def remove_assignment(self, request, student_id=None, *args, **kwargs):
        """Remove a student from the exam assignment list."""
        assessment = self.get_object()
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        deleted, _ = ExamAssignment.objects.filter(
            assessment=assessment, student_id=student_id
        ).delete()
        
        if deleted:
            return Response({"message": "Student removed from assignment."})
        return Response({"error": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # Exam Session Endpoints
    # =========================================================================

    @action(detail=True, methods=["post"], url_path="start-session")
    def start_session(self, request, *args, **kwargs):
        """Start or resume an exam session for the current student."""
        assessment = self.get_object()
        if request.user.role != User.Role.STUDENT:
            return Response(
                {"error": "Only students can start exam sessions."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = StartExamSessionSerializer(
            data={},
            context={"request": request, "assessment": assessment}
        )
        serializer.is_valid(raise_exception=True)
        session = serializer.save(assessment=assessment)
        
        return Response(ExamSessionSerializer(session).data)


class AssessmentSubmissionViewSet(viewsets.ModelViewSet):
    queryset = AssessmentSubmission.objects.select_related(
        "assessment", "assessment__course", "student", "session"
    )
    serializer_class = AssessmentSubmissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("assessment", "student", "status")
    parser_classes = [MultiPartParser, FormParser, *api_settings.DEFAULT_PARSER_CLASSES]

    def get_queryset(self) -> QuerySet[AssessmentSubmission]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD:
            if not user.department_id:
                return qs.none()
            return qs.filter(assessment__course__department_id=user.department_id)
        if user.role == User.Role.TEACHER:
            return qs.filter(assessment__course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != User.Role.STUDENT:
            raise PermissionDenied("Only students can submit assessments.")
        assessment = serializer.validated_data["assessment"]
        now = timezone.now()
        
        # Check if already submitted
        existing_submission = AssessmentSubmission.objects.filter(
            assessment=assessment, student=user
        ).first()
        if existing_submission:
            raise ValidationError("You have already submitted this assessment.")
        
        if assessment.scheduled_at and now < assessment.scheduled_at:
            raise ValidationError("Submissions are not open yet for this assessment.")
        if assessment.closes_at and now > assessment.closes_at:
            raise ValidationError("Submission window has closed for this assessment.")
        
        # Check if student is assigned (for targeted exams)
        if not assessment.assign_to_all:
            if not ExamAssignment.objects.filter(assessment=assessment, student=user).exists():
                raise PermissionDenied("You are not assigned to take this exam.")
        
        # Attach the (single) session for this student+assessment even if it was terminated,
        # so teachers/HODs can review proctoring evidence on the submission.
        session = ExamSession.objects.filter(assessment=assessment, student=user).first()
        
        # Create submission
        submission = serializer.save(student=user, created_by=user, updated_by=user, session=session)
        
        # Mark session as submitted (if exists and still in progress)
        if session and session.status == ExamSession.SessionStatus.IN_PROGRESS:
            session.status = ExamSession.SessionStatus.SUBMITTED
            session.ended_at = timezone.now()
            session.save(update_fields=["status", "ended_at", "updated_at"])
            
            # Mark assignment as completed
            ExamAssignment.objects.filter(
                assessment=assessment, student=user
            ).update(is_completed=True)
        
        if assessment.submission_format == Assessment.SubmissionFormat.ONLINE:
            questions = assessment.questions or []
            answers = submission.answers or []
            score = 0
            has_subjective = False
            
            for idx, question in enumerate(questions):
                q_type = question.get("type", "MCQ")
                q_marks = question.get("marks", 1) # Default to 1 if not specified
                
                if q_type == "SUBJECTIVE":
                    has_subjective = True
                    continue
                
                # Handle MCQ
                if idx < len(answers):
                    selected = answers[idx]
                    options = question.get("options", [])
                    if isinstance(selected, int) and 0 <= selected < len(options):
                        if options[selected].get("is_correct"):
                            score += q_marks

            submission.score = score
            # If there are subjective questions, it needs manual grading. 
            # Otherwise, it's fully graded.
            if not has_subjective:
                submission.status = AssessmentSubmission.SubmissionStatus.GRADED
            
            submission.save(update_fields=["score", "status", "updated_at"])
            
            # Create notification for student about submission
            if has_subjective:
                body = f"Your exam '{assessment.title}' has been submitted successfully. It's pending manual grading for subjective questions."
            else:
                total_marks = sum(q.get("marks", 1) for q in questions)
                body = f"Your exam '{assessment.title}' has been auto-graded. Score: {score}/{total_marks}"
            
            NotificationService.send_notification(
                user_id=user.id,
                subject="Exam Submitted",
                body=body,
                metadata={
                    "submission_id": str(submission.id),
                    "assessment_id": str(assessment.id),
                    "score": score,
                    "type": "exam_submitted",
                }
            )
        # Notify assigned teacher, HOD, and admins about submission
        recipients = []
        if assessment.course.assigned_teacher_id:
            recipients.append(assessment.course.assigned_teacher_id)
        recipients += list(User.objects.filter(
            role=User.Role.HOD,
            department_id=assessment.course.department_id,
            is_active=True,
        ).values_list("id", flat=True))
        recipients += list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))
        NotificationService.send_bulk_notification(
            user_ids=set(recipients),
            subject="Assessment Submitted",
            body=f"{user.email} submitted '{assessment.title}' ({assessment.course.code}).",
            metadata={
                "submission_id": str(submission.id),
                "assessment_id": str(assessment.id),
                "course_id": str(assessment.course.id),
                "action": "submission_created",
            },
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminHODOrTeacher])
    def grade(self, request, *args, **kwargs):
        submission = self.get_object()
        serializer = AssessmentGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(submission=submission)
        # Notify student about grading
        NotificationService.send_notification(
            user_id=submission.student_id,
            subject="Assessment Graded",
            body=f"Your submission for '{submission.assessment.title}' has been graded.",
            metadata={
                "submission_id": str(submission.id),
                "assessment_id": str(submission.assessment.id),
                "action": "submission_graded",
            },
        )
        return Response(
            AssessmentSubmissionSerializer(submission, context={"request": request}).data
        )


class ExamSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing exam sessions (read-only for listing, actions for updates)."""
    queryset = ExamSession.objects.select_related("assessment", "student").prefetch_related("cheating_logs")
    serializer_class = ExamSessionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("assessment", "student", "status")

    def get_queryset(self) -> QuerySet[ExamSession]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD:
            if not user.department_id:
                return qs.none()
            return qs.filter(assessment__course__department_id=user.department_id)
        if user.role == User.Role.TEACHER:
            return qs.filter(assessment__course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    @action(detail=True, methods=["post"], url_path="report-cheating")
    def report_cheating(self, request, *args, **kwargs):
        """Report a cheating incident during the exam."""
        session = self.get_object()
        
        # Only the student in the session can report (frontend reports)
        if request.user != session.student:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        if session.status != ExamSession.SessionStatus.IN_PROGRESS:
            return Response(
                {"error": "Session is no longer active."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ReportCheatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        
        # Return updated session
        session.refresh_from_db()
        return Response(ExamSessionSerializer(session).data)

    @action(detail=True, methods=["post"], url_path="autosave")
    def autosave(self, request, *args, **kwargs):
        """Auto-save exam answers periodically."""
        session = self.get_object()
        
        if request.user != session.student:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        if session.status != ExamSession.SessionStatus.IN_PROGRESS:
            return Response(
                {"error": "Session is no longer active."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AutoSaveAnswersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        
        return Response({"message": "Answers saved successfully."})

    @action(detail=True, methods=["get"], url_path="saved-answers")
    def get_saved_answers(self, request, *args, **kwargs):
        """Retrieve auto-saved answers for resuming an exam."""
        session = self.get_object()
        
        if request.user != session.student:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        return Response({
            "answers": session.saved_answers,
            "time_remaining_seconds": ExamSessionSerializer().get_time_remaining_seconds(session),
        })

