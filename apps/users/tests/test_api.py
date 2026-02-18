import pytest
from rest_framework.test import APIClient

from apps.users.models import User


@pytest.mark.django_db
def test_admin_can_create_user():
    admin = User.objects.create_superuser(email="admin@example.com", password="adminpass")
    client = APIClient()
    client.force_authenticate(user=admin)

    payload = {
        "email": "student@example.com",
        "first_name": "Student",
        "last_name": "User",
        "role": User.Role.STUDENT,
    }

    response = client.post("/api/auth/accounts/", payload, format="json")
    assert response.status_code == 201
    assert User.objects.filter(email="student@example.com").exists()
