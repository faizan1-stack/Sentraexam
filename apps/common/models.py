from __future__ import annotations

import uuid
from typing import Any

from django.contrib.auth import get_user_model
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model with created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ("-created_at",)


class UUIDModel(models.Model):
    """Abstract base that uses UUID primary keys."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """Combines UUID primary keys with timestamp auditing."""

    class Meta:
        abstract = True


class OwnedModel(BaseModel):
    """Abstract base that adds creator/owner references."""

    created_by = models.ForeignKey(
        get_user_model(),
        on_delete=models.SET_NULL,
        related_name="%(class)s_created",
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        get_user_model(),
        on_delete=models.SET_NULL,
        related_name="%(class)s_updated",
        null=True,
        blank=True,
    )

    class Meta:
        abstract = True

    def set_audit_users(self, user: Any) -> None:
        if not user or not getattr(user, "is_authenticated", False):
            return
        if not self.created_by:
            self.created_by = user
        self.updated_by = user
