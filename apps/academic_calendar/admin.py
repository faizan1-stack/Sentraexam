from __future__ import annotations

from django.contrib import admin

from .models import AcademicTerm, AcademicYear, CalendarEvent, TimetableEntry


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_year", "start_date", "end_date", "is_active")
    list_filter = ("academic_year", "is_active")
    search_fields = ("name",)


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ("title", "event_type", "academic_term", "start_at", "end_at")
    list_filter = ("event_type", "academic_term")
    search_fields = ("title", "description")


@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ("course", "teacher", "entry_type", "start_at", "end_at", "room")
    list_filter = ("entry_type",)
    search_fields = ("course__code", "teacher__email")
