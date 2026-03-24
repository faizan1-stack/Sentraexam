from __future__ import annotations

from django.contrib import admin

from .models import Assessment, AssessmentSubmission


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "course",
        "assessment_type",
        "status",
        "scheduled_at",
        "created_by",
    )
    list_filter = ("assessment_type", "status", "course__department")
    search_fields = ("title", "course__code")


@admin.register(AssessmentSubmission)
class AssessmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ("assessment", "student", "status", "score", "submitted_at")
    list_filter = ("status",)
    search_fields = ("assessment__title", "student__email")
