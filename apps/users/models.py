from __future__ import annotations

import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.core.mail import send_mail
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel, TimeStampedModel
from .managers import UserManager


class User(AbstractUser, TimeStampedModel):
    """Custom user model with role based permissions."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", _("Administrator")
        HOD = "HOD", _("Head of Department")
        TEACHER = "TEACHER", _("Teacher")
        STUDENT = "STUDENT", _("Student")

    username = None  # Use email instead
    external_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
    )
    phone_number = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=False)
    onboarding_completed = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    def __str__(self) -> str:
        return f"{self.email} ({self.get_role_display()})"

    def email_user(self, subject: str, message: str, from_email: str | None = None) -> None:
        send_mail(subject, message, from_email, [self.email])


class ActivationToken(BaseModel):
    """Token that allows newly created users to activate their account."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activation_tokens")
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=("token",)),
            models.Index(fields=("expires_at",)),
        ]

    @classmethod
    def create_for_user(cls, user: User, validity_hours: int = 48) -> "ActivationToken":
        instance = cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(hours=validity_hours),
        )
        return instance

    def mark_used(self) -> None:
        self.is_used = True
        self.save(update_fields=["is_used"])

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at


class PasswordResetToken(BaseModel):
    """Token used to reset a user's password."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=("token",)),
            models.Index(fields=("expires_at",)),
        ]

    @classmethod
    def create_for_user(cls, user: User, validity_hours: int = 24) -> "PasswordResetToken":
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(hours=validity_hours),
        )

    def mark_used(self) -> None:
        self.is_used = True
        self.save(update_fields=["is_used"])

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at
