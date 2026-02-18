from __future__ import annotations

from django.db.models import Count, Q, QuerySet
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminOrHOD
from .models import Department, DepartmentMembership
from .serializers import (
    DepartmentCreateSerializer,
    DepartmentMembershipSerializer,
    DepartmentSerializer,
)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("code",)
    search_fields = ("name", "code")

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self) -> QuerySet[Department]:
        user = self.request.user
        qs = (
            Department.objects.select_related("head")
            .annotate(
                teacher_count=Count("users", filter=Q(users__role=User.Role.TEACHER)),
                student_count=Count("users", filter=Q(users__role=User.Role.STUDENT)),
            )
            .order_by("name")
        )
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(id=user.department_id)
        return qs.none()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return DepartmentCreateSerializer
        return self.serializer_class


class DepartmentMembershipViewSet(viewsets.ModelViewSet):
    queryset = DepartmentMembership.objects.select_related(
        "department", "user", "assigned_by"
    )
    serializer_class = DepartmentMembershipSerializer
    permission_classes = [IsAuthenticated, IsAdminOrHOD]
    filterset_fields = ("department", "role", "user")
    search_fields = ("user__email", "department__name")

    def get_queryset(self) -> QuerySet[DepartmentMembership]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(department_id=user.department_id)
        if user.role == User.Role.TEACHER:
            return qs.filter(user=user)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save()
