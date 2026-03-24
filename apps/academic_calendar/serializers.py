from __future__ import annotations

from rest_framework import serializers

from .models import AcademicTerm, AcademicYear, CalendarEvent, TimetableEntry


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ("id", "name", "start_date", "end_date", "is_active", "created_at", "updated_at")


class AcademicTermSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)

    class Meta:
        model = AcademicTerm
        fields = (
            "id",
            "academic_year",
            "academic_year_name",
            "name",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
            "updated_at",
        )


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = (
            "id",
            "title",
            "description",
            "event_type",
            "start_at",
            "end_at",
            "academic_term",
            "department",
            "course",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        if attrs["start_at"] >= attrs["end_at"]:
            raise serializers.ValidationError("Event end time must be after start time.")
        return attrs


class TimetableEntrySerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    teacher_email = serializers.EmailField(source="teacher.email", read_only=True)

    class Meta:
        model = TimetableEntry
        fields = (
            "id",
            "academic_term",
            "course",
            "course_code",
            "teacher",
            "teacher_email",
            "room",
            "entry_type",
            "start_at",
            "end_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        if attrs["start_at"] >= attrs["end_at"]:
            raise serializers.ValidationError("End time must be after start time.")
        return attrs
