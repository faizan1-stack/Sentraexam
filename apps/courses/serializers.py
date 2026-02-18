from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.users.models import User
from .models import Course, CourseEnrollment


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    assigned_teacher_email = serializers.EmailField(
        source="assigned_teacher.email", read_only=True
    )

    class Meta:
        model = Course
        fields = (
            "id",
            "department",
            "department_name",
            "code",
            "title",
            "description",
            "credits",
            "status",
            "assigned_teacher",
            "assigned_teacher_email",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("approved_by", "approved_at", "created_at", "updated_at")


class CourseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            "department",
            "code",
            "title",
            "description",
            "credits",
            "status",
            "assigned_teacher",
        )

    def validate_assigned_teacher(self, value):
        request = self.context.get("request")
        # Teachers can only create/edit courses assigned to themselves.
        if request and request.user.role == User.Role.TEACHER and value and value.id != request.user.id:
            raise serializers.ValidationError("You can only assign yourself as the course teacher.")
        if value and value.role not in {User.Role.TEACHER, User.Role.HOD}:
            raise serializers.ValidationError("Assigned teacher must have teacher or HOD role.")
        return value

    def validate_department(self, value):
        """Restrict HOD/Teacher to only create courses for their own department."""
        request = self.context.get("request")
        if request and request.user.role == User.Role.HOD:
            # Compare department IDs, not objects
            user_dept_id = getattr(request.user, 'department_id', None)
            if not user_dept_id:
                raise serializers.ValidationError(
                    "Your account is not assigned to a department."
                )
            if value.id != user_dept_id:
                raise serializers.ValidationError(
                    "You can only create courses for your own department."
                )
        if request and request.user.role == User.Role.TEACHER:
            user_dept_id = getattr(request.user, "department_id", None)
            if not user_dept_id:
                raise serializers.ValidationError(
                    "Your account is not assigned to a department."
                )
            if value.id != user_dept_id:
                raise serializers.ValidationError(
                    "You can only create courses for your own department."
                )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        # Enforce safe teacher workflow:
        # - Teachers can only create courses in their department
        # - Assigned teacher is always themselves
        # - Status defaults to ACTIVE (admin/HOD can still create DRAFT courses if desired)
        if user and user.is_authenticated and user.role == User.Role.TEACHER:
            if not user.department_id:
                raise serializers.ValidationError(
                    {"department": "Your account is not assigned to a department."}
                )

            # On create, force department/teacher/status.
            if not self.instance:
                attrs["department"] = user.department
                attrs["assigned_teacher"] = user
                attrs["status"] = Course.Status.ACTIVE

            # On update, teachers may not change sensitive fields.
            if self.instance:
                if "department" in attrs and attrs["department"].id != self.instance.department_id:
                    raise serializers.ValidationError(
                        {"department": "You can't change the course department."}
                    )
                if "assigned_teacher" in attrs and (
                    attrs["assigned_teacher"] is None
                    or attrs["assigned_teacher"].id != self.instance.assigned_teacher_id
                ):
                    raise serializers.ValidationError(
                        {"assigned_teacher": "You can't change the assigned teacher."}
                    )
                if "status" in attrs and attrs["status"] != self.instance.status:
                    raise serializers.ValidationError(
                        {"status": "You can't change the course status."}
                    )

        department = attrs.get("department") or getattr(self.instance, "department", None)
        teacher = attrs.get("assigned_teacher") or getattr(self.instance, "assigned_teacher", None)
        if department and teacher and teacher.department_id and teacher.department_id != department.id:
            raise serializers.ValidationError("Assigned teacher must belong to the selected department.")
        return attrs


class CourseApprovalSerializer(serializers.ModelSerializer):
    approved = serializers.BooleanField(write_only=True)

    class Meta:
        model = Course
        fields = ("approved",)

    def update(self, instance, validated_data):
        request = self.context["request"]
        approved = validated_data["approved"]
        if approved:
            instance.status = Course.Status.ACTIVE
            instance.approved_by = request.user
            instance.approved_at = timezone.now()
        else:
            instance.status = Course.Status.DRAFT
            instance.approved_by = None
            instance.approved_at = None
        instance.save(
            update_fields=["status", "approved_by", "approved_at", "updated_at"]
        )
        return instance

class CourseEnrollmentSerializer(serializers.ModelSerializer):
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_first_name = serializers.CharField(source="student.first_name", read_only=True)
    student_last_name = serializers.CharField(source="student.last_name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    department_name = serializers.CharField(source="course.department.name", read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = (
            "id",
            "course",
            "course_code",
            "course_title",
            "department_name",
            "student",
            "student_email",
            "student_first_name",
            "student_last_name",
            "status",
            "enrolled_at",
            "completed_at",
        )
        read_only_fields = ("student", "enrolled_at", "completed_at")

    def validate_course(self, value):
        """Validate that students can only enroll in courses from their department."""
        request = self.context.get("request")
        if request and request.user.role == User.Role.STUDENT:
            # Check if student has a department assigned
            student_dept_id = getattr(request.user, 'department_id', None)
            if not student_dept_id:
                raise serializers.ValidationError(
                    "Your account is not assigned to a department. Please contact an administrator."
                )

            # Only ACTIVE courses are enrollable via self-service.
            if value.status != Course.Status.ACTIVE:
                raise serializers.ValidationError(
                    "You can only enroll in active courses."
                )
            
            # Check department match
            if value.department_id != student_dept_id:
                raise serializers.ValidationError(
                    "You can only enroll in courses from your department."
                )
            
            # Check if student is already enrolled
            existing = CourseEnrollment.objects.filter(
                course=value, student=request.user
            ).exclude(status=CourseEnrollment.EnrollmentStatus.DROPPED).exists()
            if existing:
                raise serializers.ValidationError(
                    "You are already enrolled in this course."
                )
        return value

    def update(self, instance, validated_data):
        status = validated_data.get("status")
        if status and status == CourseEnrollment.EnrollmentStatus.COMPLETED:
            instance.completed_at = timezone.now()
        return super().update(instance, validated_data)

