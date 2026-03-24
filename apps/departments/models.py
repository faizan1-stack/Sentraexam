from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel, OwnedModel

User = settings.AUTH_USER_MODEL


class Department(BaseModel):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    head = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name="headed_department",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class DepartmentMembership(OwnedModel):
    class Role(models.TextChoices):
        HOD = "HOD", "Head of Department"
        TEACHER = "TEACHER", "Teacher"
        STUDENT = "STUDENT", "Student"

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="department_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="department_assignments",
        null=True,
        blank=True,
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("department", "user", "role")
        ordering = ("-assigned_at",)

    def __str__(self) -> str:
        return f"{self.user} -> {self.department} ({self.role})"
