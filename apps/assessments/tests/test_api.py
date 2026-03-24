import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from datetime import timedelta

from apps.assessments.models import Assessment
from apps.notifications.models import Notification
from apps.users.models import User
from tests.factories import (
    AssessmentFactory,
    CourseEnrollmentFactory,
    CourseFactory,
    DepartmentFactory,
    UserFactory,
)


@pytest.mark.django_db
def test_student_can_submit_assessment():
    enrollment = CourseEnrollmentFactory()
    assessment = AssessmentFactory(
        course=enrollment.course,
        assessment_type=Assessment.AssessmentType.ASSIGNMENT,
        submission_format=Assessment.SubmissionFormat.TEXT,
        questions=[],
    )
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    student = enrollment.student
    client = APIClient()
    client.force_authenticate(user=student)

    payload = {"assessment": str(assessment.id), "text_response": "My assignment response"}
    response = client.post("/api/assessments/submissions/", payload, format="json")
    assert response.status_code == 201


@pytest.mark.django_db
def test_student_sees_department_assessments_without_enrollment():
    department = DepartmentFactory()
    student = UserFactory(role=User.Role.STUDENT, department=department)
    course = CourseFactory(department=department)
    assessment = AssessmentFactory(course=course)
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    client = APIClient()
    client.force_authenticate(user=student)

    response = client.get("/api/assessments/")
    assert response.status_code == 200
    data = response.json()
    payload = data["results"] if isinstance(data, dict) and "results" in data else data
    assessment_ids = [item["id"] for item in payload]
    assert str(assessment.id) in assessment_ids


@pytest.mark.django_db
def test_exam_submission_requires_answers():
    enrollment = CourseEnrollmentFactory()
    assessment = AssessmentFactory(course=enrollment.course)
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    student = enrollment.student
    client = APIClient()
    client.force_authenticate(user=student)

    payload = {"assessment": str(assessment.id)}
    response = client.post("/api/assessments/submissions/", payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_exam_submission_auto_grades():
    enrollment = CourseEnrollmentFactory()
    assessment = AssessmentFactory(course=enrollment.course)
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    student = enrollment.student
    client = APIClient()
    client.force_authenticate(user=student)

    payload = {"assessment": str(assessment.id), "answers": [1]}
    response = client.post("/api/assessments/submissions/", payload, format="json")
    assert response.status_code == 201
    submission_data = response.json()
    assert float(submission_data["score"]) == assessment.total_marks


@pytest.mark.django_db
def test_assignment_submission_requires_text():
    enrollment = CourseEnrollmentFactory()
    assessment = AssessmentFactory(
        course=enrollment.course,
        assessment_type=Assessment.AssessmentType.ASSIGNMENT,
        submission_format=Assessment.SubmissionFormat.TEXT,
        questions=[],
    )
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    student = enrollment.student
    client = APIClient()
    client.force_authenticate(user=student)

    payload = {"assessment": str(assessment.id), "text_response": ""}
    response = client.post("/api/assessments/submissions/", payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_assignment_submission_requires_file_for_file_format():
    enrollment = CourseEnrollmentFactory()
    assessment = AssessmentFactory(
        course=enrollment.course,
        assessment_type=Assessment.AssessmentType.ASSIGNMENT,
        submission_format=Assessment.SubmissionFormat.FILE,
        questions=[],
    )
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    student = enrollment.student
    client = APIClient()
    client.force_authenticate(user=student)

    payload = {"assessment": str(assessment.id)}
    response = client.post(
        "/api/assessments/submissions/",
        payload,
        format="multipart",
    )
    assert response.status_code == 400

    file_payload = {
        "assessment": str(assessment.id),
        "file_response": SimpleUploadedFile("assignment.txt", b"assignment content"),
    }
    success_response = client.post(
        "/api/assessments/submissions/",
        file_payload,
        format="multipart",
    )
    assert success_response.status_code == 201


@pytest.mark.django_db
def test_hod_schedule_auto_approved():
    department = DepartmentFactory()
    hod = UserFactory(role=User.Role.HOD, department=department)
    teacher = UserFactory(role=User.Role.TEACHER, department=department)
    course = CourseFactory(department=department, assigned_teacher=teacher)
    assessment = AssessmentFactory(course=course, created_by=teacher)
    assessment.status = Assessment.Status.APPROVED
    assessment.save(update_fields=["status"])

    client = APIClient()
    client.force_authenticate(user=hod)
    start = timezone.now() + timedelta(days=1)
    payload = {"scheduled_at": start.isoformat(), "duration_minutes": 60}

    response = client.post(f"/api/assessments/{assessment.id}/schedule/", payload, format="json")
    assert response.status_code == 200

    assessment.refresh_from_db()
    assert assessment.schedule_state == Assessment.ScheduleState.APPROVED
    assert assessment.status == Assessment.Status.SCHEDULED
    assert assessment.schedule_approved_by_id == hod.id
    assert assessment.scheduled_at is not None


@pytest.mark.django_db
def test_teacher_cannot_schedule_assessment():
    department = DepartmentFactory()
    teacher = UserFactory(role=User.Role.TEACHER, department=department)
    course = CourseFactory(department=department, assigned_teacher=teacher)
    assessment = AssessmentFactory(course=course, created_by=teacher)
    assessment.status = Assessment.Status.APPROVED
    assessment.save(update_fields=["status"])

    client = APIClient()
    client.force_authenticate(user=teacher)
    start = timezone.now() + timedelta(days=1)
    payload = {"scheduled_at": start.isoformat(), "duration_minutes": 45}

    response = client.post(f"/api/assessments/{assessment.id}/schedule/", payload, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_assessment_reject_requires_reason():
    department = DepartmentFactory()
    admin = UserFactory(role=User.Role.ADMIN)
    teacher = UserFactory(role=User.Role.TEACHER, department=department)
    course = CourseFactory(department=department, assigned_teacher=teacher)
    assessment = AssessmentFactory(course=course, created_by=teacher)
    assessment.status = Assessment.Status.SUBMITTED
    assessment.save(update_fields=["status"])

    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.post(
        f"/api/assessments/{assessment.id}/approve/",
        {"approve": False, "reason": "no"},
        format="json",
    )
    assert response.status_code == 400
    assert "reason" in response.json()


@pytest.mark.django_db
def test_assessment_reject_sends_reason_to_teacher():
    department = DepartmentFactory()
    admin = UserFactory(role=User.Role.ADMIN)
    teacher = UserFactory(role=User.Role.TEACHER, department=department)
    course = CourseFactory(department=department, assigned_teacher=teacher)
    assessment = AssessmentFactory(course=course, created_by=teacher)
    assessment.status = Assessment.Status.SUBMITTED
    assessment.save(update_fields=["status"])

    client = APIClient()
    client.force_authenticate(user=admin)
    reason = "Question format is incomplete."

    response = client.post(
        f"/api/assessments/{assessment.id}/approve/",
        {"approve": False, "reason": reason},
        format="json",
    )
    assert response.status_code == 200
    assert response.json().get("rejection_reason") == reason

    assessment.refresh_from_db()
    assert assessment.status == Assessment.Status.DRAFT
    assert assessment.rejection_reason == reason

    note = Notification.objects.filter(user=teacher, subject="Assessment Rejected").first()
    assert note is not None
    assert reason in note.body


@pytest.mark.django_db
def test_teacher_list_shows_only_draft_and_submitted():
    department = DepartmentFactory()
    teacher = UserFactory(role=User.Role.TEACHER, department=department)
    course = CourseFactory(department=department, assigned_teacher=teacher)

    draft = AssessmentFactory(course=course, created_by=teacher)
    draft.status = Assessment.Status.DRAFT
    draft.save(update_fields=["status"])

    submitted = AssessmentFactory(course=course, created_by=teacher)
    submitted.status = Assessment.Status.SUBMITTED
    submitted.save(update_fields=["status"])

    approved = AssessmentFactory(course=course, created_by=teacher)
    approved.status = Assessment.Status.APPROVED
    approved.save(update_fields=["status"])

    scheduled = AssessmentFactory(course=course, created_by=teacher)
    scheduled.status = Assessment.Status.SCHEDULED
    scheduled.save(update_fields=["status"])

    client = APIClient()
    client.force_authenticate(user=teacher)
    response = client.get("/api/assessments/")
    assert response.status_code == 200

    data = response.json()
    payload = data["results"] if isinstance(data, dict) and "results" in data else data
    ids = {item["id"] for item in payload}
    assert str(draft.id) in ids
    assert str(submitted.id) in ids
    assert str(approved.id) not in ids
    assert str(scheduled.id) not in ids
