from __future__ import annotations

from django.db.models import Q, QuerySet
from django.contrib.auth import get_user_model
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminOrHOD
from django.utils import timezone
from .models import Announcement, AnnouncementRecipient, Notification

UserModel = get_user_model()
from .serializers import (
    AnnouncementCreateSerializer,
    AnnouncementSerializer,
    AnnouncementRecipientSerializer,
    NotificationSerializer,
)


class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related("department", "course")
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsAdminOrHOD]
    filterset_fields = ("audience", "status", "department", "course")
    search_fields = ("title", "message")

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [permission() for permission in self.permission_classes]

    def get_queryset(self) -> QuerySet[Announcement]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(department_id=user.department_id)
        if user.role == User.Role.TEACHER:
            return qs.filter(
                Q(created_by=user)
                | Q(department_id=user.department_id)
                | Q(announcement_recipients__user=user)
            ).distinct()
        return qs.filter(
            Q(announcement_recipients__user=user) | Q(audience=Announcement.Audience.ALL)
        ).distinct()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return AnnouncementCreateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def _populate_recipients(self, announcement: Announcement):
        existing = AnnouncementRecipient.objects.filter(announcement=announcement)
        if existing.exists():
            return existing
        if announcement.audience == Announcement.Audience.ALL:
            users = UserModel.objects.filter(is_active=True)
        elif announcement.audience == Announcement.Audience.DEPARTMENT and announcement.department_id:
            users = UserModel.objects.filter(
                department_id=announcement.department_id, is_active=True
            )
        elif announcement.audience == Announcement.Audience.COURSE and announcement.course_id:
            users = UserModel.objects.filter(
                course_enrollments__course_id=announcement.course_id, is_active=True
            ).distinct()
        else:
            return existing
        AnnouncementRecipient.objects.bulk_create(
            [
                AnnouncementRecipient(announcement=announcement, user=user)
                for user in users
            ],
            ignore_conflicts=True,
        )
        return AnnouncementRecipient.objects.filter(announcement=announcement)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminOrHOD])
    def send(self, request, *args, **kwargs):
        announcement = self.get_object()
        recipient_qs = self._populate_recipients(announcement)
        notifications = [
            Notification(
                user=recipient.user,
                subject=announcement.title,
                body=announcement.message,
                metadata={"announcement_id": str(announcement.id)},
            )
            for recipient in recipient_qs.select_related("user")
        ]
        Notification.objects.bulk_create(notifications)
        announcement.mark_sent()
        recipient_qs.update(delivered_at=announcement.sent_at)
        return Response(AnnouncementSerializer(announcement, context={"request": request}).data)


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("is_read",)

    def get_queryset(self) -> QuerySet[Notification]:
        # Filter notifications strictly to current user only
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')

    @action(detail=True, methods=["post"])
    def mark_read(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.mark_read()
        return Response(self.get_serializer(notification).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request, *args, **kwargs):
        """Mark all notifications as read for the current user."""
        updated = Notification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True, read_at=timezone.now())
        return Response({"marked_read": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request, *args, **kwargs):
        """Get count of unread notifications for the current user."""
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"count": count}, status=status.HTTP_200_OK)
