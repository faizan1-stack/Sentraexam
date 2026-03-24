from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)


@database_sync_to_async
def _get_unread_count(user_id: int) -> int:
    return Notification.objects.filter(user_id=user_id, is_read=False).count()


@database_sync_to_async
def _mark_as_read(user_id: int, notification_id: str) -> bool:
    qs = Notification.objects.filter(id=notification_id, user_id=user_id, is_read=False)
    updated = qs.update(is_read=True, read_at=timezone.now())
    return updated > 0


@database_sync_to_async
def _mark_all_as_read(user_id: int) -> int:
    return Notification.objects.filter(user_id=user_id, is_read=False).update(
        is_read=True, read_at=timezone.now()
    )


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    Real-time in-app notifications consumer.

    Authentication:
    - Supports session auth (AuthMiddlewareStack)
    - Supports JWT access token via query string ?token=...
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        self.user_id = int(user.id)
        self.group_name = f"user_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        unread = await _get_unread_count(self.user_id)
        await self.send_json({"type": "connection_established", "unread_count": unread})

    async def disconnect(self, code):
        try:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        except Exception:
            pass

    async def receive_json(self, content, **kwargs):
        msg_type = content.get("type")

        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        if msg_type == "get_unread_count":
            unread = await _get_unread_count(self.user_id)
            await self.send_json({"type": "unread_count", "unread_count": unread})
            return

        if msg_type == "mark_as_read":
            notification_id = content.get("notification_id")
            if not notification_id:
                await self.send_json({"type": "error", "message": "notification_id is required"})
                return

            ok = await _mark_as_read(self.user_id, str(notification_id))
            unread = await _get_unread_count(self.user_id)
            await self.send_json(
                {
                    "type": "marked_as_read",
                    "ok": ok,
                    "notification_id": str(notification_id),
                    "unread_count": unread,
                }
            )
            return

        if msg_type == "mark_all_as_read":
            updated = await _mark_all_as_read(self.user_id)
            unread = await _get_unread_count(self.user_id)
            await self.send_json(
                {
                    "type": "marked_all_as_read",
                    "count": int(updated),
                    "unread_count": unread,
                }
            )
            return

        await self.send_json({"type": "error", "message": "Unknown message type"})

    async def notification_message(self, event):
        """
        Handler for channel_layer.group_send events.

        Expected event payload:
        {
          "type": "notification.message",
          "payload": {...}
        }
        """
        payload = event.get("payload") or {}
        await self.send_json(payload)

