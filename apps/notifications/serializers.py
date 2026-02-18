from __future__ import annotations

from rest_framework import serializers

from .models import Announcement, AnnouncementRecipient, Notification


class AnnouncementRecipientSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = AnnouncementRecipient
        fields = ("id", "announcement", "user", "user_email", "delivered_at", "read_at")
        read_only_fields = ("delivered_at", "read_at")


class AnnouncementSerializer(serializers.ModelSerializer):
    recipients = AnnouncementRecipientSerializer(many=True, read_only=True, source="announcement_recipients")

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "message",
            "audience",
            "status",
            "department",
            "course",
            "scheduled_for",
            "sent_at",
            "created_at",
            "updated_at",
            "recipients",
        )
        read_only_fields = ("status", "sent_at", "created_at", "updated_at", "recipients")


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )

    class Meta:
        model = Announcement
        fields = (
            "title",
            "message",
            "audience",
            "department",
            "course",
            "scheduled_for",
            "recipient_ids",
        )

    def create(self, validated_data):
        recipient_ids = validated_data.pop("recipient_ids", [])
        request = self.context.get("request")
        announcement = super().create(validated_data)
        if request and request.user.is_authenticated:
            announcement.created_by = request.user
            announcement.updated_by = request.user
            announcement.save(update_fields=["created_by", "updated_by"])
        if recipient_ids:
            AnnouncementRecipient.objects.bulk_create(
                [
                    AnnouncementRecipient(
                        announcement=announcement,
                        user_id=recipient_id,
                    )
                    for recipient_id in recipient_ids
                ]
            )
        return announcement


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "subject", "body", "is_read", "read_at", "metadata", "created_at")
        read_only_fields = ("read_at", "created_at")
