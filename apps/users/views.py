from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import QuerySet
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdmin, IsAdminHODOrTeacher, IsAdminOrHOD, IsSelfAdminOrDepartmentHead
from .models import ActivationToken, User
from .serializers import (
    ActivationConfirmSerializer,
    ActivationTokenSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetTokenSerializer,
    UserCreateSerializer,
    UserSerializer,
)

UserModel = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for managing users."""

    queryset = UserModel.objects.select_related("department").all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("role", "department")
    search_fields = ("email", "first_name", "last_name")
    ordering_fields = ("created_at", "email", "first_name", "last_name")

    def get_permissions(self):
        if self.action in {"activate", "password_reset", "password_reset_confirm"}:
            return [AllowAny()]
        if self.action == "retrieve":
            return [IsAuthenticated()]  # Teachers can view students (read-only)
        if self.action in {"partial_update", "update"}:
            return [IsAuthenticated(), IsSelfAdminOrDepartmentHead()]
        if self.action == "list":
            return [IsAuthenticated(), IsAdminHODOrTeacher()]  # Teachers can list students in their courses
        if self.action in {"create", "destroy"}:
            return [IsAuthenticated(), IsAdmin()]
        return [permission() for permission in self.permission_classes]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return self.serializer_class

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        output_serializer = UserSerializer(user, context=self.get_serializer_context())
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def get_queryset(self) -> QuerySet[User]:
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return self.queryset
        if user.role == User.Role.HOD:
            return self.queryset.filter(department=user.department)
        if user.role == User.Role.TEACHER:
            # Teachers can view their own profile and students in their courses
            from apps.courses.models import CourseEnrollment
            enrolled_student_ids = CourseEnrollment.objects.filter(
                course__assigned_teacher=user
            ).values_list('student_id', flat=True)
            return self.queryset.filter(
                models.Q(id=user.id)
                | models.Q(id__in=enrolled_student_ids)
                | models.Q(department=user.department, role=User.Role.STUDENT)
            )
        return self.queryset.filter(id=user.id)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(
        detail=False,
        methods=["get"],
        url_path="me",
        permission_classes=[IsAuthenticated],
    )
    def me(self, request, *args, **kwargs):
        """Return the authenticated user's profile regardless of role."""
        serializer = UserSerializer(request.user, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="activate", permission_classes=[AllowAny])
    def activate(self, request, *args, **kwargs):
        serializer = ActivationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        data = UserSerializer(user, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="password-reset",
        permission_classes=[AllowAny],
    )
    def password_reset(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.save()
        return Response(
            PasswordResetTokenSerializer(token).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="password-reset/confirm",
        permission_classes=[AllowAny],
    )
    def password_reset_confirm(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActivationTokenViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """View activation tokens for auditing (admin only)."""

    queryset = ActivationToken.objects.select_related("user")
    serializer_class = ActivationTokenSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("is_used", "user__role")
    search_fields = ("user__email",)
