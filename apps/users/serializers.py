from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import ActivationToken, PasswordResetToken, User


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "external_id",
            "email",
            "first_name",
            "last_name",
            "role",
            "department",
            "department_name",
            "phone_number",
            "is_active",
            "onboarding_completed",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "external_id", "is_active", "created_at", "updated_at", "department")


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "role",
            "department",
            "phone_number",
            "password",
            "is_active",
        )
        extra_kwargs = {"is_active": {"required": False}}

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.is_active = True
            user.save(update_fields=["password", "is_active"])
        token = ActivationToken.create_for_user(user)
        # In production this would trigger an async email task.
        user.email_user(
            "Sentraexam account activation",
            f"Activation token: {token.token}",
        )
        # Notify admins about new user creation
        from apps.notifications.models import Notification
        admin_ids = User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
        notifications = [
            Notification(
                user_id=admin_id,
                subject="New User Created",
                body=f"{user.email} was created with role {user.role}.",
                metadata={
                    "user_id": str(user.id),
                    "action": "user_created",
                },
            )
            for admin_id in admin_ids
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)
        return user


class ActivationTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivationToken
        fields = ("id", "token", "expires_at", "is_used", "created_at")
        read_only_fields = fields


class PasswordResetTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PasswordResetToken
        fields = ("id", "token", "expires_at", "is_used", "created_at")
        read_only_fields = fields


class ActivationConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(write_only=True)

    default_error_messages = {
        "invalid": "Activation token is invalid.",
        "expired": "Activation token has expired.",
        "used": "Activation token has already been used.",
    }

    def validate(self, attrs):
        token_value = attrs["token"]
        try:
            activation = ActivationToken.objects.select_related("user").get(token=token_value)
        except ActivationToken.DoesNotExist as exc:
            raise serializers.ValidationError(self.error_messages["invalid"]) from exc

        if activation.is_used:
            raise serializers.ValidationError(self.error_messages["used"])
        if activation.is_expired:
            raise serializers.ValidationError(self.error_messages["expired"])
        attrs["activation"] = activation
        return attrs

    def save(self, **kwargs):
        activation: ActivationToken = self.validated_data["activation"]
        user = activation.user
        user.set_password(self.validated_data["password"])
        user.is_active = True
        user.onboarding_completed = True
        user.save(update_fields=["password", "is_active", "onboarding_completed"])
        activation.mark_used()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={"input_type": "password"})

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs.get("email"),
            password=attrs.get("password"),
        )
        if not user:
            raise serializers.ValidationError("Unable to log in with provided credentials.")
        if not user.is_active:
            raise serializers.ValidationError("Account is inactive.")
        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("No user with this email found.") from exc
        self.context["user"] = user
        return value

    def save(self, **kwargs):
        user = self.context["user"]
        token = PasswordResetToken.create_for_user(user)
        user.email_user(
            "Password reset request",
            f"Reset token: {token.token}",
        )
        return token


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(write_only=True)

    default_error_messages = {
        "invalid": "Reset token is invalid.",
        "expired": "Reset token has expired.",
        "used": "Reset token has already been used.",
    }

    def validate(self, attrs):
        token_value = attrs["token"]
        try:
            token = PasswordResetToken.objects.select_related("user").get(token=token_value)
        except PasswordResetToken.DoesNotExist as exc:
            raise serializers.ValidationError(self.error_messages["invalid"]) from exc

        if token.is_used:
            raise serializers.ValidationError(self.error_messages["used"])
        if token.is_expired:
            raise serializers.ValidationError(self.error_messages["expired"])
        attrs["reset_token"] = token
        return attrs

    def save(self, **kwargs):
        reset_token: PasswordResetToken = self.validated_data["reset_token"]
        user = reset_token.user
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        reset_token.mark_used()
        return user
