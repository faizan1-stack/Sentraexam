from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel, OwnedModel

User = settings.AUTH_USER_MODEL


class Course(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.CASCADE,
        related_name="courses",
    )
    code = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    credits = models.PositiveIntegerField(default=3)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.ACTIVE)
    assigned_teacher = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="assigned_courses",
        null=True,
        blank=True,
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="approved_courses",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("code",)

    def __str__(self) -> str:
        return f"{self.code} - {self.title}"


class CourseEnrollment(OwnedModel):
    class EnrollmentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Approval"
        ENROLLED = "ENROLLED", "Enrolled"
        COMPLETED = "COMPLETED", "Completed"
        DROPPED = "DROPPED", "Dropped"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="course_enrollments",
    )
    status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.ENROLLED,
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("course", "student")
        ordering = ("-enrolled_at",)

    def __str__(self) -> str:
        return f"{self.student} -> {self.course}"
