from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel, OwnedModel

User = settings.AUTH_USER_MODEL


class AcademicYear(BaseModel):
    name = models.CharField(max_length=64, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ("-start_date",)

    def __str__(self) -> str:
        return self.name

    def activate(self):
        AcademicYear.objects.filter(is_active=True).update(is_active=False)
        self.is_active = True
        self.save(update_fields=["is_active"])


class AcademicTerm(BaseModel):
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="terms"
    )
    name = models.CharField(max_length=64)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        unique_together = ("academic_year", "name")
        ordering = ("start_date",)

    def __str__(self) -> str:
        return f"{self.academic_year.name} - {self.name}"

    def activate(self):
        AcademicTerm.objects.filter(academic_year=self.academic_year, is_active=True).update(
            is_active=False
        )
        self.is_active = True
        self.save(update_fields=["is_active"])


class CalendarEvent(OwnedModel):
    class EventType(models.TextChoices):
        EXAM = "EXAM", "Exam"
        CLASS = "CLASS", "Class"
        HOLIDAY = "HOLIDAY", "Holiday"
        MEETING = "MEETING", "Meeting"
        DEADLINE = "DEADLINE", "Deadline"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    academic_term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.CASCADE,
        related_name="events",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )

    class Meta:
        ordering = ("start_at",)

    def clean(self):
        if self.start_at >= self.end_at:
            raise ValueError("Event end time must be after start time.")


class TimetableEntry(OwnedModel):
    class EntryType(models.TextChoices):
        LECTURE = "LECTURE", "Lecture"
        LAB = "LAB", "Laboratory"
        TUTORIAL = "TUTORIAL", "Tutorial"
        EXAM = "EXAM", "Exam"
        OTHER = "OTHER", "Other"

    academic_term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.CASCADE,
        related_name="timetable_entries",
    )
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name="timetable_entries")
    room = models.CharField(max_length=128)
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()

    class Meta:
        ordering = ("start_at",)
        indexes = [
            models.Index(fields=("teacher", "start_at")),
            models.Index(fields=("course", "start_at")),
        ]

    def overlaps(self) -> bool:
        return TimetableEntry.objects.filter(
            teacher=self.teacher,
            start_at__lt=self.end_at,
            end_at__gt=self.start_at,
        ).exclude(id=self.id).exists()

    def save(self, *args, **kwargs):
        if self.start_at >= self.end_at:
            raise ValueError("Timetable entry end time must be after start time.")
        if self.overlaps():
            raise ValueError("Timetable entry overlaps with existing schedule.")
        super().save(*args, **kwargs)
