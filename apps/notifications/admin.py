from __future__ import annotations

from django.contrib import admin

from .models import Announcement, AnnouncementRecipient, Notification


class AnnouncementRecipientInline(admin.TabularInline):
    model = AnnouncementRecipient
    extra = 0
    readonly_fields = ("user", "delivered_at", "read_at")


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "audience", "status", "department", "scheduled_for", "sent_at")
    list_filter = ("audience", "status")
    search_fields = ("title", "message")
    inlines = [AnnouncementRecipientInline]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "subject", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("subject", "user__email")
