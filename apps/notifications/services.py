from __future__ import annotations

import logging
from typing import Any, Iterable

try:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
except Exception:  # pragma: no cover
    async_to_sync = None  # type: ignore[assignment]
    get_channel_layer = None  # type: ignore[assignment]
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Central helper for creating notifications and (optionally) pushing them in real-time via WebSockets.

    Note:
    - For high-volume fanout, keep using Celery/background jobs.
    - bulk_create relies on DB RETURNING support to get IDs. Postgres supports it.
    """

    @staticmethod
    def _group_name(user_id: int) -> str:
        return f"user_{int(user_id)}"

    @staticmethod
    def _serialize(notification: Notification) -> dict[str, Any]:
        return {
            "id": str(notification.id),
            "subject": notification.subject,
            "body": notification.body,
            "is_read": notification.is_read,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
            "metadata": notification.metadata or {},
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        }

    @staticmethod
    def _safe_group_send(user_id: int, payload: dict[str, Any]) -> None:
        try:
            if get_channel_layer is None or async_to_sync is None:
                return

            channel_layer = get_channel_layer()
            if not channel_layer:
                return
            async_to_sync(channel_layer.group_send)(
                NotificationService._group_name(user_id),
                {"type": "notification.message", "payload": payload},
            )
        except Exception as exc:
            logger.debug("Notification WS send failed", extra={"error": str(exc)})

    @staticmethod
    def send_notification(
        *,
        user_id: int,
        subject: str,
        body: str,
        metadata: dict[str, Any] | None = None,
        ws_push: bool = True,
    ) -> Notification:
        n = Notification.objects.create(
            user_id=user_id,
            subject=subject,
            body=body,
            metadata=metadata or {},
        )

        if ws_push:
            unread = Notification.objects.filter(user_id=user_id, is_read=False).count()
            NotificationService._safe_group_send(
                user_id,
                {"type": "notification", "notification": NotificationService._serialize(n), "unread_count": unread},
            )
        return n

    @staticmethod
    def send_bulk_notification(
        *,
        user_ids: Iterable[int],
        subject: str,
        body: str,
        metadata: dict[str, Any] | None = None,
        ws_push: bool = True,
    ) -> list[Notification]:
        unique_ids = list({int(uid) for uid in user_ids if uid})
        if not unique_ids:
            return []

        notifications = [
            Notification(
                user_id=uid,
                subject=subject,
                body=body,
                metadata=metadata or {},
                # created_at is auto; keep consistent with bulk_create.
            )
            for uid in unique_ids
        ]

        created = Notification.objects.bulk_create(notifications)

        if ws_push:
            # We send per-user payloads. For DBs without RETURNING, ids may be missing;
            # the frontend still receives a usable payload, but "mark read" should use REST API.
            now_iso = timezone.now().isoformat()
            for n in created:
                try:
                    uid = int(getattr(n, "user_id"))
                except Exception:
                    continue

                unread = Notification.objects.filter(user_id=uid, is_read=False).count()
                payload_notification = (
                    NotificationService._serialize(n)
                    if getattr(n, "id", None)
                    else {
                        "id": None,
                        "subject": subject,
                        "body": body,
                        "is_read": False,
                        "read_at": None,
                        "metadata": metadata or {},
                        "created_at": now_iso,
                    }
                )

                NotificationService._safe_group_send(
                    uid,
                    {"type": "notification", "notification": payload_notification, "unread_count": unread},
                )

        return created
