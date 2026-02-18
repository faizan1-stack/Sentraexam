from __future__ import annotations

from django.contrib import admin

from .models import Document, DocumentAccessLog, DocumentCategory


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "access_level", "department", "created_at")
    list_filter = ("access_level", "department")
    search_fields = ("title", "owner__email")


@admin.register(DocumentAccessLog)
class DocumentAccessLogAdmin(admin.ModelAdmin):
    list_display = ("document", "user", "action", "accessed_at")
    list_filter = ("action",)
    search_fields = ("document__title", "user__email")
