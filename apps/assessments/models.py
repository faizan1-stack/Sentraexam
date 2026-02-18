from __future__ import annotations

import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel, OwnedModel
from apps.courses.models import Course

User = settings.AUTH_USER_MODEL


def submission_upload_to(instance: "AssessmentSubmission", filename: str) -> str:
    extension = Path(filename).suffix
    return f"assessments/submissions/{instance.assessment_id}/{uuid.uuid4()}{extension}"


class Assessment(BaseModel):
    class AssessmentType(models.TextChoices):
        EXAM = "EXAM", "Exam"
        QUIZ = "QUIZ", "Quiz"
        ASSIGNMENT = "ASSIGNMENT", "Assignment"
        PROJECT = "PROJECT", "Project"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted for Approval"
        APPROVED = "APPROVED", "Approved"
        SCHEDULED = "SCHEDULED", "Scheduled"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class ScheduleState(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PROPOSED = "PROPOSED", "Proposed"
        APPROVED = "APPROVED", "Approved"

    class SubmissionFormat(models.TextChoices):
        ONLINE = "ONLINE", "Online exam session"
        TEXT = "TEXT", "Text response"
        FILE = "FILE", "File upload"
        TEXT_AND_FILE = "TEXT_AND_FILE", "Text + File"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assessments")
    title = models.CharField(max_length=255)
    assessment_type = models.CharField(max_length=20, choices=AssessmentType.choices)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    content = models.JSONField(default=list, blank=True)
    questions = models.JSONField(default=list, blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    # Scheduling rules (all values are minutes)
    instructions_open_minutes = models.PositiveIntegerField(
        default=0, help_text="Allow viewing instructions this many minutes before start."
    )
    late_entry_minutes = models.PositiveIntegerField(
        default=0, help_text="Allow starting the exam this many minutes after start."
    )
    grace_minutes = models.PositiveIntegerField(
        default=0, help_text="Allow late submission this many minutes after exam end."
    )
    total_marks = models.PositiveIntegerField(default=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submission_format = models.CharField(
        max_length=20, choices=SubmissionFormat.choices, default=SubmissionFormat.TEXT
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    schedule_state = models.CharField(
        max_length=20, choices=ScheduleState.choices, default=ScheduleState.DRAFT
    )
    schedule_proposed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="assessment_schedules_proposed",
        null=True,
        blank=True,
    )
    schedule_proposed_at = models.DateTimeField(null=True, blank=True)
    schedule_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="assessment_schedules_approved",
        null=True,
        blank=True,
    )
    schedule_approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, related_name="assessments_created", null=True
    )
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, related_name="assessments_approved", null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    assign_to_all = models.BooleanField(
        default=True,
        help_text="If False, only students in ExamAssignment can take the exam."
    )

    class Meta:
        ordering = ("-created_at",)

    def submit_for_approval(self):
        self.status = self.Status.SUBMITTED
        self.save(update_fields=["status", "updated_at"])

    def approve(self, user):
        self.status = self.Status.APPROVED
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    def schedule(self, scheduled_at, closes_at):
        self.status = self.Status.SCHEDULED
        self.scheduled_at = scheduled_at
        self.closes_at = closes_at
        self.save(update_fields=["status", "scheduled_at", "closes_at", "updated_at"])


class ExamAssignment(BaseModel):
    """Tracks which students are assigned to take a specific exam."""

    assessment = models.ForeignKey(
        Assessment, on_delete=models.CASCADE, related_name="assignments"
    )
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="exam_assignments"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        unique_together = ("assessment", "student")
        ordering = ("-assigned_at",)

    def __str__(self) -> str:
        return f"{self.student} assigned to {self.assessment}"


class ExamSession(BaseModel):
    """Tracks a student's exam session for proctoring and timing."""

    class SessionStatus(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        SUBMITTED = "SUBMITTED", "Submitted"
        TERMINATED = "TERMINATED", "Terminated"

    assessment = models.ForeignKey(
        Assessment, on_delete=models.CASCADE, related_name="sessions"
    )
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="exam_sessions"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    server_deadline = models.DateTimeField(
        help_text="Server-calculated deadline based on duration"
    )
    cheating_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.IN_PROGRESS,
    )
    saved_answers = models.JSONField(
        default=list, blank=True, help_text="Auto-saved answers"
    )

    class Meta:
        unique_together = ("assessment", "student")
        ordering = ("-started_at",)

    def __str__(self) -> str:
        return f"{self.student} session for {self.assessment}"

    def is_expired(self) -> bool:
        return timezone.now() > self.server_deadline


class CheatingLog(BaseModel):
    """Logs individual cheating incidents during an exam session."""

    class IncidentType(models.TextChoices):
        TAB_SWITCH = "TAB_SWITCH", "Tab Switch"
        BLUR = "BLUR", "Window Blur"
        FULLSCREEN_EXIT = "FULLSCREEN_EXIT", "Fullscreen Exit"
        COPY_PASTE = "COPY_PASTE", "Copy/Paste Attempt"

    session = models.ForeignKey(
        ExamSession, on_delete=models.CASCADE, related_name="cheating_logs"
    )
    incident_type = models.CharField(max_length=20, choices=IncidentType.choices)
    occurred_at = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-occurred_at",)

    def __str__(self) -> str:
        return f"{self.incident_type} at {self.occurred_at}"


class AssessmentSubmission(OwnedModel):
    class SubmissionStatus(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        GRADED = "GRADED", "Graded"
        LATE = "LATE", "Late Submission"

    assessment = models.ForeignKey(
        Assessment, on_delete=models.CASCADE, related_name="submissions"
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assessment_submissions",
    )
    session = models.OneToOneField(
        ExamSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submission",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.SUBMITTED,
    )
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)
    text_response = models.TextField(blank=True)
    file_response = models.FileField(
        upload_to=submission_upload_to,
        null=True,
        blank=True,
    )
    answers = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ("assessment", "student")
        ordering = ("-submitted_at",)

    def mark_graded(self, score, feedback=None):
        self.score = score
        self.feedback = feedback or ""
        self.status = self.SubmissionStatus.GRADED
        self.updated_at = timezone.now()
        self.save(update_fields=["score", "feedback", "status", "updated_at"])

