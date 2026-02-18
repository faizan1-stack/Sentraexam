from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Department, DepartmentMembership

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    head_email = serializers.EmailField(source="head.email", read_only=True)
    teacher_count = serializers.IntegerField(read_only=True)
    student_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = (
            "id",
            "name",
            "code",
            "description",
            "head",
            "head_email",
            "teacher_count",
            "student_count",
        )


class DepartmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("name", "code", "description", "head")


class DepartmentMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = DepartmentMembership
        fields = (
            "id",
            "department",
            "department_name",
            "user",
            "user_email",
            "role",
            "assigned_by",
            "assigned_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("assigned_by", "assigned_at", "created_at", "updated_at")

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["assigned_by"] = request.user
            validated_data["created_by"] = request.user
            validated_data["updated_by"] = request.user
        return super().create(validated_data)
