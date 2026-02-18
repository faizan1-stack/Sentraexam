from __future__ import annotations

import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel
from apps.assessments.models import ExamSession

User = settings.AUTH_USER_MODEL


def proctoring_snapshot_upload_to(instance: "ProctoringSnapshot", filename: str) -> str:
    extension = Path(filename).suffix
    return f"proctoring/snapshots/{instance.session.assessment_id}/{uuid.uuid4()}{extension}"


def face_reference_upload_to(instance: "StudentFaceReference", filename: str) -> str:
    extension = Path(filename).suffix
    return f"proctoring/face_references/{instance.student_id}/{uuid.uuid4()}{extension}"


class StudentFaceReference(BaseModel):
    """Stores student's reference face image and encoding for verification."""
    
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="face_references",
    )
    image = models.ImageField(upload_to=face_reference_upload_to)
    face_encoding = models.BinaryField(
        null=True,
        blank=True,
        help_text="Serialized numpy array of face encoding (128-dim vector)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this is the active reference for the student"
    )
    captured_at = models.DateTimeField(default=timezone.now)
    quality_score = models.FloatField(
        default=0.0,
        help_text="Quality score of the face image (0-1)"
    )
    
    class Meta:
        ordering = ("-captured_at",)
        indexes = [
            models.Index(fields=["student", "is_active"]),
        ]
    
    def __str__(self) -> str:
        return f"Face reference for {self.student} at {self.captured_at}"
    
    def get_encoding_array(self):
        """Deserialize face encoding to numpy array."""
        if self.face_encoding is None:
            return None
        import numpy as np
        import pickle
        return pickle.loads(self.face_encoding)
    
    def set_encoding_array(self, encoding):
        """Serialize numpy array to binary field."""
        import pickle
        self.face_encoding = pickle.dumps(encoding)


class ProctoringSnapshot(BaseModel):
    """Stores webcam snapshots captured during an exam session."""

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="proctoring_snapshots",
    )
    image = models.ImageField(upload_to=proctoring_snapshot_upload_to)
    image_url = models.URLField(blank=True, default="")
    captured_at = models.DateTimeField(default=timezone.now)
    
    # AI Analysis Results
    analysis_result = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI analysis results: {faces_detected, gaze_result, objects, etc.}"
    )
    faces_detected = models.PositiveIntegerField(default=0)
    
    # Enhanced detection results
    gaze_direction = models.CharField(
        max_length=20,
        default="unknown",
        help_text="Detected gaze direction: center, left, right, up, down"
    )
    gaze_yaw = models.FloatField(
        default=0.0,
        help_text="Horizontal gaze angle in degrees"
    )
    gaze_pitch = models.FloatField(
        default=0.0,
        help_text="Vertical gaze angle in degrees"
    )
    face_verified = models.BooleanField(
        default=True,
        help_text="Whether face matches registered student"
    )
    face_verification_confidence = models.FloatField(
        default=0.0,
        help_text="Face verification confidence (0-1)"
    )
    
    is_violation = models.BooleanField(default=False)
    processed = models.BooleanField(default=False)
    
    # Motion detection
    motion_score = models.FloatField(
        default=0.0,
        help_text="Motion score compared to previous frame (0-100)"
    )

    class Meta:
        ordering = ("-captured_at",)
        indexes = [
            models.Index(fields=["session", "-captured_at"]),
            models.Index(fields=["is_violation"]),
        ]

    def __str__(self) -> str:
        return f"Snapshot for session {self.session_id} at {self.captured_at}"


class ProctoringViolation(BaseModel):
    """Records detected proctoring violations during an exam."""

    class ViolationType(models.TextChoices):
        NO_FACE = "NO_FACE", "No face detected"
        MULTIPLE_FACES = "MULTIPLE_FACES", "Multiple faces detected"
        LOOKING_AWAY = "LOOKING_AWAY", "Looking away from screen"
        FACE_NOT_MATCHED = "FACE_NOT_MATCHED", "Face does not match registered student"
        AUDIO_TALKING = "AUDIO_TALKING", "Background talking detected"
        CAMERA_OFF = "CAMERA_OFF", "Camera turned off or unavailable"
        OBJECT_DETECTED = "OBJECT_DETECTED", "Suspicious object detected"
        PHONE_DETECTED = "PHONE_DETECTED", "Phone detected in frame"
        BOOK_DETECTED = "BOOK_DETECTED", "Book or notes detected in frame"
        LAPTOP_DETECTED = "LAPTOP_DETECTED", "Secondary device detected"
        PERSON_LEFT = "PERSON_LEFT", "Person left the frame"
        # New pattern-based violations
        INTERMITTENT_FACE = "INTERMITTENT_FACE", "Face frequently disappearing"
        PERSISTENT_GAZE_AWAY = "PERSISTENT_GAZE_AWAY", "Consistently looking away"
        MULTIPLE_PERSONS_PATTERN = "MULTIPLE_PERSONS_PATTERN", "Multiple people detected over time"
        IDENTITY_MISMATCH_PATTERN = "IDENTITY_MISMATCH_PATTERN", "Repeated face verification failures"

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="proctoring_violations",
    )
    snapshot = models.ForeignKey(
        ProctoringSnapshot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="violations",
    )
    violation_type = models.CharField(
        max_length=30,
        choices=ViolationType.choices,
    )
    severity = models.PositiveIntegerField(
        default=1,
        help_text="Severity level 1-5"
    )
    occurred_at = models.DateTimeField(default=timezone.now)
    details = models.JSONField(default=dict, blank=True)
    
    # Enhanced confidence tracking
    confidence_score = models.FloatField(
        default=1.0,
        help_text="AI confidence in this violation (0-1)"
    )
    confidence_breakdown = models.JSONField(
        default=dict,
        blank=True,
        help_text="Breakdown of confidence factors"
    )
    
    acknowledged = models.BooleanField(
        default=False,
        help_text="Whether the student acknowledged this violation"
    )
    
    # Teacher review
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_violations",
    )
    review_notes = models.TextField(blank=True, default="")
    is_false_positive = models.BooleanField(
        default=False,
        help_text="Marked as false positive after teacher review"
    )

    class Meta:
        ordering = ("-occurred_at",)
        indexes = [
            models.Index(fields=["session", "-occurred_at"]),
            models.Index(fields=["violation_type"]),
            models.Index(fields=["is_false_positive"]),
        ]

    def __str__(self) -> str:
        return f"{self.violation_type} at {self.occurred_at}"


class ProctoringSettings(BaseModel):
    """Per-assessment proctoring configuration."""

    assessment = models.OneToOneField(
        "assessments.Assessment",
        on_delete=models.CASCADE,
        related_name="proctoring_settings",
    )
    enabled = models.BooleanField(default=True)
    
    # Capture settings
    snapshot_interval_seconds = models.PositiveIntegerField(
        default=10,
        help_text="How often to capture snapshots (in seconds)"
    )
    use_motion_detection = models.BooleanField(
        default=True,
        help_text="Capture extra snapshots on significant motion"
    )
    motion_threshold = models.PositiveIntegerField(
        default=30,
        help_text="Motion threshold to trigger extra capture (0-100)"
    )
    
    # Violation settings
    max_violations_before_terminate = models.PositiveIntegerField(
        default=10,  # Increased since we have better detection now
        help_text="Auto-terminate exam after this many violations"
    )
    
    # Detection toggles
    detect_no_face = models.BooleanField(default=True)
    detect_multiple_faces = models.BooleanField(default=True)
    detect_looking_away = models.BooleanField(default=True)
    detect_objects = models.BooleanField(
        default=True,
        help_text="Detect phones, books, and other prohibited objects"
    )
    
    # Face verification
    require_face_verification = models.BooleanField(
        default=True,  # Now enabled by default
        help_text="Verify face matches student's registered photo"
    )
    face_verification_interval = models.PositiveIntegerField(
        default=30,
        help_text="How often to verify face (in seconds, 0 = every snapshot)"
    )
    
    # Confidence thresholds
    use_confidence_scoring = models.BooleanField(
        default=True,
        help_text="Filter low-confidence violations to reduce false positives"
    )
    min_confidence_threshold = models.FloatField(
        default=0.6,
        help_text="Minimum confidence to flag a violation (0-1)"
    )
    
    # Temporal analysis
    enable_temporal_analysis = models.BooleanField(
        default=True,
        help_text="Detect patterns across multiple snapshots"
    )
    temporal_window_size = models.PositiveIntegerField(
        default=10,
        help_text="Number of snapshots to analyze for patterns"
    )

    def __str__(self) -> str:
        return f"Proctoring settings for {self.assessment}"


def session_recording_upload_to(instance: "SessionRecording", filename: str) -> str:
    extension = Path(filename).suffix
    return f"proctoring/recordings/{instance.session.assessment_id}/{uuid.uuid4()}{extension}"


def proctoring_clip_upload_to(instance: "ProctoringVideoClip", filename: str) -> str:
    extension = Path(filename).suffix
    return f"proctoring/clips/{instance.session.assessment_id}/{uuid.uuid4()}{extension}"


class ProctoringVideoClip(BaseModel):
    """Stores short video clips captured only when suspicious activity is detected."""

    class TriggerReason(models.TextChoices):
        MULTIPLE_FACES = "MULTIPLE_FACES", "Multiple faces detected"
        NO_FACE = "NO_FACE", "No face detected"
        LOOKING_AWAY = "LOOKING_AWAY", "Looking away"
        PHONE_DETECTED = "PHONE_DETECTED", "Phone detected"
        BOOK_DETECTED = "BOOK_DETECTED", "Book/notes detected"
        AUDIO_TALKING = "AUDIO_TALKING", "Background talking detected"
        TAB_SWITCH = "TAB_SWITCH", "Tab switch"
        FULLSCREEN_EXIT = "FULLSCREEN_EXIT", "Fullscreen exited"
        OTHER = "OTHER", "Other"

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="video_clips",
    )
    video_file = models.FileField(
        upload_to=proctoring_clip_upload_to,
        null=True,
        blank=True,
    )
    video_url = models.URLField(blank=True, default="")
    trigger_reason = models.CharField(
        max_length=40,
        choices=TriggerReason.choices,
        default=TriggerReason.OTHER,
    )
    trigger_description = models.TextField(blank=True, default="")
    duration_seconds = models.PositiveIntegerField(default=30)
    file_size_bytes = models.BigIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    severity = models.PositiveIntegerField(default=1, help_text="Severity level 1-5")

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["session", "-created_at"]),
            models.Index(fields=["trigger_reason", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Clip for session {self.session_id} ({self.trigger_reason})"


class SessionRecording(BaseModel):
    """Stores session video recording for proctoring review."""
    
    class UploadStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        UPLOADING = "UPLOADING", "Uploading"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETE = "COMPLETE", "Complete"
        FAILED = "FAILED", "Failed"
    
    session = models.OneToOneField(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="recording",
    )
    video_file = models.FileField(
        upload_to=session_recording_upload_to,
        null=True,
        blank=True,
    )
    duration_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Duration of the recording in seconds"
    )
    file_size_bytes = models.BigIntegerField(
        default=0,
        help_text="File size in bytes"
    )
    upload_status = models.CharField(
        max_length=20,
        choices=UploadStatus.choices,
        default=UploadStatus.PENDING,
    )
    is_encrypted = models.BooleanField(
        default=True,
        help_text="Indicates recording is stored with server-side encryption at rest"
    )
    chunks_received = models.PositiveIntegerField(
        default=0,
        help_text="Number of video chunks received"
    )
    total_chunks = models.PositiveIntegerField(
        default=0,
        help_text="Expected total number of chunks"
    )
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="Error message if upload failed"
    )
    
    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["session"]),
            models.Index(fields=["upload_status"]),
        ]
    
    def __str__(self) -> str:
        return f"Recording for session {self.session_id}"
    
    def mark_uploading(self):
        self.upload_status = self.UploadStatus.UPLOADING
        self.save(update_fields=["upload_status", "updated_at"])
    
    def mark_complete(self, file_size: int, duration: int):
        self.upload_status = self.UploadStatus.COMPLETE
        self.file_size_bytes = file_size
        self.duration_seconds = duration
        self.save(update_fields=["upload_status", "file_size_bytes", "duration_seconds", "updated_at"])
    
    def mark_failed(self, error: str):
        self.upload_status = self.UploadStatus.FAILED
        self.error_message = error
        self.save(update_fields=["upload_status", "error_message", "updated_at"])

