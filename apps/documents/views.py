from __future__ import annotations

from django.db.models import Q, QuerySet
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser

from apps.users.models import User
from apps.users.permissions import IsAdminOrHOD
from .models import Document, DocumentAccessLog, DocumentCategory
from .serializers import (
    DocumentAccessLogSerializer,
    DocumentCategorySerializer,
    DocumentSerializer,
)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    queryset = DocumentCategory.objects.all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrHOD]
    parser_classes = [MultiPartParser, FormParser]
    search_fields = ("name",)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ("department", "access_level", "category")
    search_fields = ("title", "description")

    def get_queryset(self) -> QuerySet[Document]:
        user = self.request.user
        qs = Document.objects.select_related("owner", "category", "department")
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(Q(department_id=user.department_id) | Q(owner=user))
        if user.role == User.Role.TEACHER:
            return qs.filter(
                Q(owner=user)
                | Q(access_level=Document.AccessLevel.INSTITUTION)
                | Q(
                    access_level=Document.AccessLevel.DEPARTMENT,
                    department_id=user.department_id,
                )
            )
        if user.role == User.Role.STUDENT:
            return qs.filter(
                Q(owner=user)
                | Q(access_level=Document.AccessLevel.INSTITUTION)
                | Q(
                    access_level=Document.AccessLevel.DEPARTMENT,
                    department_id=user.department_id,
                )
            )
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(owner=user, created_by=user, updated_by=user)

    def _ensure_owner_or_elevated(self, document: Document):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return
        if user.role == User.Role.HOD and document.department_id == user.department_id:
            return
        if document.owner_id == user.id:
            return
        raise PermissionDenied("You do not have permission to modify this document.")

    def perform_update(self, serializer):
        document = self.get_object()
        self._ensure_owner_or_elevated(document)
        serializer.save(updated_by=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        document = self.get_object()
        serializer = self.get_serializer(document)
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action="view",
        )
        return Response(serializer.data)

    def perform_destroy(self, instance):
        self._ensure_owner_or_elevated(instance)
        instance.delete()


class DocumentAccessLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = DocumentAccessLogSerializer
    permission_classes = [IsAuthenticated, IsAdminOrHOD]
    filterset_fields = ("document", "user")

    def get_queryset(self) -> QuerySet[DocumentAccessLog]:
        user = self.request.user
        qs = DocumentAccessLog.objects.select_related("document", "user")
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(document__department_id=user.department_id)
        return qs.none()
