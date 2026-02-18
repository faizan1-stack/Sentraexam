from rest_framework import serializers

from apps.assessments.models import ExamSession
from .models import (
    ProctoringSnapshot,
    ProctoringVideoClip,
    ProctoringViolation,
    ProctoringSettings,
    StudentFaceReference
)


class StudentFaceReferenceSerializer(serializers.ModelSerializer):
    """Serializer for student face reference."""
    
    class Meta:
        model = StudentFaceReference
        fields = (
            "id",
            "student",
            "image",
            "is_active",
            "captured_at",
            "quality_score",
            "created_at",
        )
        read_only_fields = (
            "student",
            "is_active",
            "captured_at",
            "quality_score",
            "created_at",
        )


class FaceRegistrationSerializer(serializers.Serializer):
    """Serializer for registering student face."""
    
    image = serializers.ImageField()


class ProctoringSnapshotSerializer(serializers.ModelSerializer):
    """Serializer for proctoring snapshots."""
    
    class Meta:
        model = ProctoringSnapshot
        fields = (
            "id",
            "session",
            "image",
            "image_url",
            "captured_at",
            "analysis_result",
            "faces_detected",
            "gaze_direction",
            "gaze_yaw",
            "gaze_pitch",
            "face_verified",
            "face_verification_confidence",
            "is_violation",
            "processed",
            "motion_score",
            "created_at",
        )
        read_only_fields = (
            "analysis_result",
            "faces_detected",
            "gaze_direction",
            "gaze_yaw",
            "gaze_pitch",
            "face_verified",
            "face_verification_confidence",
            "is_violation",
            "processed",
            "motion_score",
            "created_at",
        )


class ProctoringSnapshotUploadSerializer(serializers.Serializer):
    """Serializer for uploading new snapshot."""
    
    session_id = serializers.UUIDField()
    image = serializers.ImageField()
    motion_score = serializers.FloatField(required=False, default=0.0)
    
    def validate_session_id(self, value):
        try:
            session = ExamSession.objects.get(id=value)
            if session.status != ExamSession.SessionStatus.IN_PROGRESS:
                raise serializers.ValidationError("Exam session is not active.")
            return value
        except ExamSession.DoesNotExist:
            raise serializers.ValidationError("Exam session not found.")


class ProctoringViolationSerializer(serializers.ModelSerializer):
    """Serializer for proctoring violations."""
    
    violation_type_display = serializers.CharField(
        source="get_violation_type_display", read_only=True
    )
    
    class Meta:
        model = ProctoringViolation
        fields = (
            "id",
            "session",
            "snapshot",
            "violation_type",
            "violation_type_display",
            "severity",
            "occurred_at",
            "details",
            "confidence_score",
            "confidence_breakdown",
            "acknowledged",
            "is_false_positive",
            "created_at",
        )
        read_only_fields = (
            "session",
            "snapshot",
            "violation_type",
            "severity",
            "occurred_at",
            "details",
            "confidence_score",
            "confidence_breakdown",
            "created_at",
        )


class ProctoringVideoClipSerializer(serializers.ModelSerializer):
    """Serializer for proctoring video clips (evidence-only)."""

    trigger_reason_display = serializers.CharField(source="get_trigger_reason_display", read_only=True)

    class Meta:
        model = ProctoringVideoClip
        fields = (
            "id",
            "session",
            "video_url",
            "trigger_reason",
            "trigger_reason_display",
            "trigger_description",
            "duration_seconds",
            "file_size_bytes",
            "started_at",
            "ended_at",
            "severity",
            "created_at",
        )
        read_only_fields = fields


class ViolationReviewSerializer(serializers.Serializer):
    """Serializer for teacher reviewing violations."""
    
    is_false_positive = serializers.BooleanField(required=True)
    review_notes = serializers.CharField(required=False, allow_blank=True, default="")


class ProctoringSettingsSerializer(serializers.ModelSerializer):
    """Serializer for proctoring settings."""
    
    class Meta:
        model = ProctoringSettings
        fields = (
            "id",
            "assessment",
            "enabled",
            "snapshot_interval_seconds",
            "use_motion_detection",
            "motion_threshold",
            "max_violations_before_terminate",
            "detect_no_face",
            "detect_multiple_faces",
            "detect_looking_away",
            "detect_objects",
            "require_face_verification",
            "face_verification_interval",
            "use_confidence_scoring",
            "min_confidence_threshold",
            "enable_temporal_analysis",
            "temporal_window_size",
        )
        read_only_fields = ("assessment",)


class ProctoringStatusSerializer(serializers.Serializer):
    """Serializer for proctoring status response."""
    
    session_id = serializers.UUIDField()
    total_snapshots = serializers.IntegerField()
    total_violations = serializers.IntegerField()
    violation_counts = serializers.DictField()
    is_terminated = serializers.BooleanField()
    face_registered = serializers.BooleanField()
    latest_violation = ProctoringViolationSerializer(allow_null=True)


class GazeResultSerializer(serializers.Serializer):
    """Serializer for gaze detection result."""
    
    yaw = serializers.FloatField()
    pitch = serializers.FloatField()
    is_looking_away = serializers.BooleanField()
    direction = serializers.CharField()


class SnapshotAnalysisResponseSerializer(serializers.Serializer):
    """Serializer for snapshot analysis response."""
    
    snapshot_id = serializers.UUIDField(allow_null=True, required=False)
    evidence_saved = serializers.BooleanField(required=False)
    faces_detected = serializers.IntegerField()
    gaze_result = GazeResultSerializer(allow_null=True)
    face_verified = serializers.BooleanField()
    face_verification_confidence = serializers.FloatField()
    violations = ProctoringViolationSerializer(many=True)
    total_violations = serializers.IntegerField()
    violations_exceeded = serializers.BooleanField()
    is_terminated = serializers.BooleanField()
