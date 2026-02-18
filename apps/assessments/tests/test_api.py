import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.assessments.models import Assessment
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
