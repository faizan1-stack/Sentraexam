from django.contrib import admin

from .models import (
    ProctoringSnapshot,
    ProctoringViolation,
    ProctoringSettings,
    StudentFaceReference
)


@admin.register(StudentFaceReference)
class StudentFaceReferenceAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "is_active", "quality_score", "captured_at")
    list_filter = ("is_active",)
    search_fields = ("student__email", "student__first_name", "student__last_name")
    readonly_fields = ("face_encoding", "captured_at")


@admin.register(ProctoringSnapshot)
class ProctoringSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "id", "session", "captured_at", "faces_detected",
        "gaze_direction", "face_verified", "is_violation", "processed"
    )
    list_filter = ("is_violation", "processed", "gaze_direction", "face_verified")
    search_fields = ("session__id",)
    readonly_fields = ("analysis_result",)


@admin.register(ProctoringViolation)
class ProctoringViolationAdmin(admin.ModelAdmin):
    list_display = (
        "id", "session", "violation_type", "severity",
        "confidence_score", "occurred_at", "acknowledged", "is_false_positive"
    )
    list_filter = ("violation_type", "severity", "acknowledged", "is_false_positive")
    search_fields = ("session__id",)
    readonly_fields = ("confidence_breakdown",)
    
    fieldsets = (
        (None, {
            "fields": ("session", "snapshot", "violation_type", "severity", "occurred_at")
        }),
        ("Details", {
            "fields": ("details", "confidence_score", "confidence_breakdown")
        }),
        ("Review", {
            "fields": ("acknowledged", "is_false_positive", "reviewed_by", "review_notes")
        }),
    )


@admin.register(ProctoringSettings)
class ProctoringSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "assessment", "enabled", "snapshot_interval_seconds",
        "require_face_verification", "use_confidence_scoring", "max_violations_before_terminate"
    )
    list_filter = ("enabled", "require_face_verification", "use_confidence_scoring")
    
    fieldsets = (
        (None, {
            "fields": ("assessment", "enabled")
        }),
        ("Capture Settings", {
            "fields": (
                "snapshot_interval_seconds", "use_motion_detection", "motion_threshold"
            )
        }),
        ("Detection Settings", {
            "fields": (
                "detect_no_face", "detect_multiple_faces",
                "detect_looking_away", "detect_objects"
            )
        }),
        ("Face Verification", {
            "fields": ("require_face_verification", "face_verification_interval")
        }),
        ("Confidence & Temporal Analysis", {
            "fields": (
                "use_confidence_scoring", "min_confidence_threshold",
                "enable_temporal_analysis", "temporal_window_size"
            )
        }),
        ("Violation Settings", {
            "fields": ("max_violations_before_terminate",)
        }),
    )
