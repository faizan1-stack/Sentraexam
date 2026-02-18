from __future__ import annotations

from django.contrib import admin

from .models import Department, DepartmentMembership


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "head")
    search_fields = ("name", "code")
    list_filter = ("head",)


@admin.register(DepartmentMembership)
class DepartmentMembershipAdmin(admin.ModelAdmin):
    list_display = ("department", "user", "role", "assigned_by", "assigned_at")
    search_fields = ("department__name", "user__email")
    list_filter = ("role",)
