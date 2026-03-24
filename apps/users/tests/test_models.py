import pytest

from apps.users.models import ActivationToken, User


@pytest.mark.django_db
def test_user_str_representation():
    user = User.objects.create_user(email="test@example.com", password="password123")
    assert "test@example.com" in str(user)


@pytest.mark.django_db
def test_activation_token_lifecycle():
    user = User.objects.create_user(email="user@example.com", password="password")
    token = ActivationToken.create_for_user(user, validity_hours=1)
    assert not token.is_expired
    token.mark_used()
    assert token.is_used
