from __future__ import annotations

import uuid
from pathlib import Path

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models

from apps.common.models import BaseModel, OwnedModel

User = settings.AUTH_USER_MODEL


def document_upload_to(instance: "Document", filename: str) -> str:
    extension = Path(filename).suffix
    return f"documents/{instance.owner_id}/{uuid.uuid4()}{extension}"


class DocumentCategory(BaseModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class Document(OwnedModel):
    class AccessLevel(models.TextChoices):
        PRIVATE = "PRIVATE", "Private"
        DEPARTMENT = "DEPARTMENT", "Department"
        INSTITUTION = "INSTITUTION", "Institution"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(
        upload_to=document_upload_to,
        validators=[FileExtensionValidator(allowed_extensions=["pdf", "docx", "xlsx", "png", "jpg"])],
    )
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    category = models.ForeignKey(
        DocumentCategory,
        on_delete=models.SET_NULL,
        related_name="documents",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )
    access_level = models.CharField(
        max_length=20,
        choices=AccessLevel.choices,
        default=AccessLevel.PRIVATE,
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title


class DocumentAccessLog(BaseModel):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="access_logs")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=64)

    class Meta:
        ordering = ("-accessed_at",)
