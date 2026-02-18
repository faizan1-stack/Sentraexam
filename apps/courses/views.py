from __future__ import annotations

from django.db import models
from django.db.models import QuerySet
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminHODOrTeacher, IsAdminOrHOD
from .models import Course, CourseEnrollment
from .serializers import (
    CourseApprovalSerializer,
    CourseCreateSerializer,
    CourseEnrollmentSerializer,
    CourseSerializer,
)


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.select_related("department", "assigned_teacher").all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsAdminHODOrTeacher]
    filterset_fields = ("department", "status", "assigned_teacher")
    search_fields = ("code", "title")
    ordering_fields = ("code", "title", "created_at")

    def get_permissions(self):
        # Only Admin/HOD can create or edit courses. Teachers can view only their assigned courses.
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action == "approve":
            return [IsAuthenticated(), IsAdminOrHOD()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Course]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs.distinct()
        if user.role == User.Role.HOD:
            return qs.filter(department=user.department).distinct()
        if user.role == User.Role.TEACHER:
            # Teachers can only see courses explicitly assigned to them
            return qs.filter(assigned_teacher=user).distinct()
        if user.role == User.Role.STUDENT:
            department_filter = models.Q()
            if user.department_id:
                department_filter = models.Q(
                    department_id=user.department_id, status=Course.Status.ACTIVE
                )
            else:
                department_filter = models.Q(status=Course.Status.ACTIVE)
            return qs.filter(
                models.Q(enrollments__student=user) | department_filter
            ).distinct()
        return qs.none().distinct()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return CourseCreateSerializer
        if self.action == "approve":
            return CourseApprovalSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        from apps.notifications.models import Notification

        course = serializer.save()
        # Notify HOD of department, assigned teacher, and admins (optional)
        recipients = []
        if course.department_id:
            recipients.extend(
                User.objects.filter(
                    role=User.Role.HOD,
                    department_id=course.department_id,
                    is_active=True,
                )
            )
        if course.assigned_teacher_id:
            teacher = course.assigned_teacher
            if teacher and teacher.is_active:
                recipients.append(teacher)

        recipient_ids = {r.id for r in recipients if r}
        notifications = [
            Notification(
                user_id=rid,
                subject="Course Added",
                body=f"Course '{course.title}' ({course.code}) was added.",
                metadata={
                    "course_id": str(course.id),
                    "department_id": str(course.department_id) if course.department_id else None,
                    "action": "course_created",
                },
            )
            for rid in recipient_ids
        ]
        admin_ids = User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
        notifications += [
            Notification(
                user_id=admin_id,
                subject="Course Added",
                body=f"Course '{course.title}' ({course.code}) was added.",
                metadata={
                    "course_id": str(course.id),
                    "department_id": str(course.department_id) if course.department_id else None,
                    "action": "course_created",
                },
            )
            for admin_id in admin_ids
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        course = self.get_object()
        serializer = self.get_serializer(course, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CourseSerializer(course, context={"request": request}).data)


class CourseEnrollmentViewSet(viewsets.ModelViewSet):
    queryset = CourseEnrollment.objects.select_related("course", "student", "created_by", "course__department")
    serializer_class = CourseEnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("course", "student", "status")
    search_fields = ("course__code", "student__email")

    def get_permissions(self):
        if self.action == "create":
            # Allow students to request enrollment
            return [IsAuthenticated()]
        if self.action in {"approve", "reject"}:
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[CourseEnrollment]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD:
            # HOD sees enrollments for courses in their department
            return qs.filter(course__department=user.department)
        if user.role == User.Role.TEACHER:
            return qs.filter(course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        from apps.notifications.models import Notification
        
        user = self.request.user
        if user.role == User.Role.STUDENT:
            # Students request enrollment; approval required by HOD/assigned teacher
            enrollment = serializer.save(
                student=user,
                status=CourseEnrollment.EnrollmentStatus.PENDING,
                created_by=user,
                updated_by=user,
            )
            # Notify the student that the request was submitted
            Notification.objects.create(
                user=user,
                subject="Enrollment Request Submitted",
                body=f"Your enrollment request for '{enrollment.course.title}' ({enrollment.course.code}) has been submitted for approval.",
                metadata={
                    "enrollment_id": str(enrollment.id),
                    "course_id": str(enrollment.course.id),
                    "type": "enrollment_request_submitted",
                }
            )
            # Notify HOD(s) in the course department and the assigned teacher (if any)
            recipients = []
            if enrollment.course.department_id:
                recipients.extend(
                    User.objects.filter(
                        role=User.Role.HOD,
                        department_id=enrollment.course.department_id,
                        is_active=True,
                    )
                )
            if enrollment.course.assigned_teacher_id:
                assigned_teacher = enrollment.course.assigned_teacher
                if assigned_teacher and assigned_teacher.is_active:
                    recipients.append(assigned_teacher)
            # De-dupe recipients
            recipient_ids = {recipient.id for recipient in recipients}
            notifications = [
                Notification(
                    user_id=recipient_id,
                    subject="Enrollment Request Pending",
                    body=f"{user.first_name} {user.last_name} requested enrollment in '{enrollment.course.title}' ({enrollment.course.code}).",
                    metadata={
                        "enrollment_id": str(enrollment.id),
                        "course_id": str(enrollment.course.id),
                        "action": "enrollment_pending",
                    },
                )
                for recipient_id in recipient_ids
            ]
            if notifications:
                Notification.objects.bulk_create(notifications)
            # Notify admins about the enrollment request
            admin_ids = User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
            admin_notifications = [
                Notification(
                    user_id=admin_id,
                    subject="Enrollment Request Created",
                    body=f"{user.first_name} {user.last_name} requested enrollment in '{enrollment.course.title}' ({enrollment.course.code}).",
                    metadata={
                        "enrollment_id": str(enrollment.id),
                        "course_id": str(enrollment.course.id),
                        "action": "enrollment_pending",
                    },
                )
                for admin_id in admin_ids
            ]
            if admin_notifications:
                Notification.objects.bulk_create(admin_notifications)
        else:
            # Admin/HOD/Teacher enrollments
            serializer.save(created_by=user, updated_by=user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        """Approve a pending enrollment request."""
        from apps.notifications.models import Notification
        
        enrollment = self.get_object()
        if enrollment.status != CourseEnrollment.EnrollmentStatus.PENDING:
            return Response(
                {"detail": "Only pending enrollments can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check HOD can only approve for their department
        if request.user.role == User.Role.HOD:
            if enrollment.course.department_id != request.user.department_id:
                return Response(
                    {"detail": "You can only approve enrollments for courses in your department."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        # Check Teacher can only approve for their assigned course
        if request.user.role == User.Role.TEACHER:
            if enrollment.course.assigned_teacher_id != request.user.id:
                return Response(
                    {"detail": "You can only approve enrollments for your assigned courses."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        enrollment.status = CourseEnrollment.EnrollmentStatus.ENROLLED
        enrollment.save(update_fields=["status", "updated_at"])
        
        # Notify the student
        Notification.objects.create(
            user=enrollment.student,
            subject="Enrollment Approved",
            body=f"Your enrollment request for '{enrollment.course.title}' has been approved.",
            metadata={
                "course_id": str(enrollment.course.id),
                "enrollment_id": str(enrollment.id),
                "action": "enrollment_approved",
            },
        )
        # Notify department HODs and assigned teacher (if any)
        recipients = list(User.objects.filter(
            role=User.Role.HOD,
            department_id=enrollment.course.department_id,
            is_active=True,
        ))
        if enrollment.course.assigned_teacher_id:
            recipients.append(enrollment.course.assigned_teacher)
        recipient_ids = {r.id for r in recipients if r}
        if recipient_ids:
            Notification.objects.bulk_create([
                Notification(
                    user_id=rid,
                    subject="Enrollment Approved",
                    body=f"Enrollment approved for {enrollment.student.email} in '{enrollment.course.title}' ({enrollment.course.code}).",
                    metadata={
                        "enrollment_id": str(enrollment.id),
                        "course_id": str(enrollment.course.id),
                        "action": "enrollment_approved",
                    },
                )
                for rid in recipient_ids
            ])
        # Notify admins
        admin_ids = User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
        if admin_ids:
            Notification.objects.bulk_create([
                Notification(
                    user_id=admin_id,
                    subject="Enrollment Approved",
                    body=f"Enrollment approved for {enrollment.student.email} in '{enrollment.course.title}' ({enrollment.course.code}).",
                    metadata={
                        "enrollment_id": str(enrollment.id),
                        "course_id": str(enrollment.course.id),
                        "action": "enrollment_approved",
                    },
                )
                for admin_id in admin_ids
            ])
        
        return Response(self.get_serializer(enrollment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reject(self, request, *args, **kwargs):
        """Reject a pending enrollment request."""
        from apps.notifications.models import Notification
        
        enrollment = self.get_object()
        if enrollment.status != CourseEnrollment.EnrollmentStatus.PENDING:
            return Response(
                {"detail": "Only pending enrollments can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check HOD can only reject for their department
        if request.user.role == User.Role.HOD:
            if enrollment.course.department_id != request.user.department_id:
                return Response(
                    {"detail": "You can only reject enrollments for courses in your department."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        # Check Teacher can only reject for their assigned course
        if request.user.role == User.Role.TEACHER:
            if enrollment.course.assigned_teacher_id != request.user.id:
                return Response(
                    {"detail": "You can only reject enrollments for your assigned courses."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        student = enrollment.student
        course_title = enrollment.course.title
        
        # Delete the enrollment
        enrollment.delete()
        
        # Notify the student
        Notification.objects.create(
            user=student,
            subject="Enrollment Rejected",
            body=f"Your enrollment request for '{course_title}' has been rejected.",
            metadata={
                "action": "enrollment_rejected",
            },
        )
        # Notify department HODs and assigned teacher (if any)
        recipients = list(User.objects.filter(
            role=User.Role.HOD,
            department_id=enrollment.course.department_id,
            is_active=True,
        ))
        if enrollment.course.assigned_teacher_id:
            recipients.append(enrollment.course.assigned_teacher)
        recipient_ids = {r.id for r in recipients if r}
        if recipient_ids:
            Notification.objects.bulk_create([
                Notification(
                    user_id=rid,
                    subject="Enrollment Rejected",
                    body=f"Enrollment rejected for {student.email} in '{course_title}'.",
                    metadata={
                        "course_id": str(enrollment.course.id),
                        "action": "enrollment_rejected",
                    },
                )
                for rid in recipient_ids
            ])
        # Notify admins
        admin_ids = User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
        if admin_ids:
            Notification.objects.bulk_create([
                Notification(
                    user_id=admin_id,
                    subject="Enrollment Rejected",
                    body=f"Enrollment rejected for {student.email} in '{course_title}'.",
                    metadata={
                        "course_id": str(enrollment.course.id),
                        "action": "enrollment_rejected",
                    },
                )
                for admin_id in admin_ids
            ])
        
        return Response({"detail": "Enrollment request rejected."}, status=status.HTTP_200_OK)

