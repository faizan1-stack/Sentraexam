from __future__ import annotations

from rest_framework import serializers

from .models import Document, DocumentAccessLog, DocumentCategory


class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = ("id", "name", "description")


class DocumentSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "description",
            "file",
            "owner",
            "owner_email",
            "category",
            "category_name",
            "department",
            "access_level",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("owner", "created_at", "updated_at")


class DocumentAccessLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = DocumentAccessLog
        fields = ("id", "document", "user", "user_email", "accessed_at", "action")
        read_only_fields = ("accessed_at",)
