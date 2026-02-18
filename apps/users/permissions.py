from __future__ import annotations

from rest_framework import permissions

from .models import User


class RolePermission(permissions.BasePermission):
    """Base permission to allow certain roles."""

    allowed_roles: tuple[User.Role, ...] = ()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in self.allowed_roles


class IsAdmin(RolePermission):
    allowed_roles = (User.Role.ADMIN,)


class IsAdminOrTeacher(RolePermission):
    allowed_roles = (User.Role.ADMIN, User.Role.TEACHER)


class IsAdminOrHOD(RolePermission):
    allowed_roles = (User.Role.ADMIN, User.Role.HOD)


class IsTeacher(RolePermission):
    """Permission to allow only Teachers."""
    allowed_roles = (User.Role.TEACHER,)


class IsAdminHODOrTeacher(RolePermission):
    allowed_roles = (User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER)


class IsSelfOrAdmin(permissions.BasePermission):
    """Allow user to interact with their own record or admins to manage all."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == User.Role.ADMIN:
            return True
        return getattr(obj, "id", None) == request.user.id


class IsSelfAdminOrDepartmentHead(permissions.BasePermission):
    """Allow access to own record, admins, or HODs in the same department."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True
        if user.role == User.Role.HOD and obj.department_id == user.department_id:
            return True
        return getattr(obj, "id", None) == user.id
