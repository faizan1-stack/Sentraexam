from __future__ import annotations

from django.contrib import admin

from .models import Course, CourseEnrollment


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "department", "status", "assigned_teacher")
    list_filter = ("status", "department")
    search_fields = ("code", "title")


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("course", "student", "status", "enrolled_at")
    list_filter = ("status",)
    search_fields = ("course__code", "student__email")
