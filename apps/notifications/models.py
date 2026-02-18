from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel, OwnedModel

User = settings.AUTH_USER_MODEL


class Announcement(OwnedModel):
    class Audience(models.TextChoices):
        ALL = "ALL", "All Users"
        DEPARTMENT = "DEPARTMENT", "Department"
        COURSE = "COURSE", "Course"
        CUSTOM = "CUSTOM", "Custom selection"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SCHEDULED = "SCHEDULED", "Scheduled"
        SENT = "SENT", "Sent"
        CANCELLED = "CANCELLED", "Cancelled"

    title = models.CharField(max_length=255)
    message = models.TextField()
    audience = models.CharField(max_length=20, choices=Audience.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        related_name="announcements",
        null=True,
        blank=True,
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        related_name="announcements",
        null=True,
        blank=True,
    )
    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    recipients = models.ManyToManyField(User, through="AnnouncementRecipient")

    class Meta:
        ordering = ("-created_at",)

    def mark_sent(self):
        self.status = self.Status.SENT
        self.sent_at = timezone.now()
        self.save(update_fields=["status", "sent_at", "updated_at"])


class AnnouncementRecipient(BaseModel):
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="announcement_recipients"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("announcement", "user")

    def mark_delivered(self):
        self.delivered_at = timezone.now()
        self.save(update_fields=["delivered_at"])

    def mark_read(self):
        self.read_at = timezone.now()
        self.save(update_fields=["read_at"])


class Notification(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    subject = models.CharField(max_length=255)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def mark_read(self):
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])
