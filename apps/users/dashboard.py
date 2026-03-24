"""Dashboard API views for role-specific data."""
from __future__ import annotations

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.assessments.models import Assessment, AssessmentSubmission, ExamSession
from apps.courses.models import Course, CourseEnrollment
from apps.departments.models import Department
from apps.proctoring.models import ProctoringViolation

User = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    """
    Dashboard data for teachers.
    Returns: assigned courses, upcoming assessments, student counts.
    """
    user = request.user
    if user.role not in [User.Role.TEACHER, User.Role.ADMIN, User.Role.HOD]:
        return Response(
            {"detail": "Only teachers can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get courses assigned to teacher
    courses = Course.objects.filter(assigned_teacher=user).select_related("department")
    
    # Get assessments for those courses
    assessments = Assessment.objects.filter(
        course__assigned_teacher=user
    ).select_related("course").order_by("-scheduled_at")[:10]
    
    # Count students in teacher's courses
    student_ids = CourseEnrollment.objects.filter(
        course__assigned_teacher=user,
        status=CourseEnrollment.EnrollmentStatus.ENROLLED
    ).values_list("student_id", flat=True).distinct()
    
    # Build response
    courses_data = [
        {
            "id": str(c.id),
            "code": c.code,
            "title": c.title,
            "department": c.department.name if c.department else None,
            "student_count": CourseEnrollment.objects.filter(
                course=c, 
                status=CourseEnrollment.EnrollmentStatus.ENROLLED
            ).count(),
        }
        for c in courses
    ]
    
    assessments_data = [
        {
            "id": str(a.id),
            "title": a.title,
            "course_code": a.course.code,
            "assessment_type": a.assessment_type,
            "status": a.status,
            "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
            "total_submissions": AssessmentSubmission.objects.filter(assessment=a).count(),
        }
        for a in assessments
    ]
    
    return Response({
        "courses": courses_data,
        "total_courses": len(courses_data),
        "assessments": assessments_data,
        "total_students": len(set(student_ids)),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_dashboard(request):
    """
    Dashboard data for Heads of Departments.
    Returns: department info, teachers, students, course assignments.
    """
    user = request.user
    if user.role not in [User.Role.HOD, User.Role.ADMIN]:
        return Response(
            {"detail": "Only HODs can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    department = user.department
    if not department and user.role != User.Role.ADMIN:
        return Response(
            {"detail": "You are not assigned to a department."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # For admin, show all data; for HOD, filter by department
    dept_filter = {} if user.role == User.Role.ADMIN else {"department": department}
    
    # Get teachers in department
    teachers = User.objects.filter(
        role=User.Role.TEACHER, **dept_filter
    ).select_related("department")
    
    # Get students in department
    students = User.objects.filter(
        role=User.Role.STUDENT, **dept_filter
    )
    
    # Get courses in department
    course_filter = {} if user.role == User.Role.ADMIN else {"department": department}
    courses = Course.objects.filter(**course_filter).select_related(
        "department", "assigned_teacher"
    )
    
    teachers_data = [
        {
            "id": t.id,
            "email": t.email,
            "name": f"{t.first_name} {t.last_name}".strip() or t.email,
            "assigned_courses": list(
                Course.objects.filter(assigned_teacher=t).values_list("code", flat=True)
            ),
        }
        for t in teachers
    ]
    
    courses_data = [
        {
            "id": str(c.id),
            "code": c.code,
            "title": c.title,
            "assigned_teacher": c.assigned_teacher.email if c.assigned_teacher else None,
            "teacher_name": f"{c.assigned_teacher.first_name} {c.assigned_teacher.last_name}".strip() if c.assigned_teacher else None,
            "student_count": CourseEnrollment.objects.filter(
                course=c,
                status=CourseEnrollment.EnrollmentStatus.ENROLLED
            ).count(),
        }
        for c in courses
    ]
    
    return Response({
        "department": {
            "id": str(department.id) if department else None,
            "name": department.name if department else "All Departments",
            "code": department.code if department else None,
        },
        "teachers": teachers_data,
        "total_teachers": len(teachers_data),
        "total_students": students.count(),
        "courses": courses_data,
        "total_courses": len(courses_data),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    """
    Dashboard data for students.
    Returns: enrolled courses, upcoming exams, attendance data.
    """
    user = request.user
    if user.role not in [User.Role.STUDENT, User.Role.ADMIN]:
        return Response(
            {"detail": "Only students can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    student = user if user.role == User.Role.STUDENT else None
    if not student:
        return Response({
            "enrollments": [],
            "upcoming_exams": [],
            "past_exams": [],
            "attendance_percentage": None,
        })
    
    # Get enrolled courses
    enrollments = CourseEnrollment.objects.filter(
        student=student,
        status=CourseEnrollment.EnrollmentStatus.ENROLLED
    ).select_related("course", "course__department", "course__assigned_teacher")
    
    # Get assessments for enrolled courses
    enrolled_course_ids = enrollments.values_list("course_id", flat=True)
    
    from django.utils import timezone
    now = timezone.now()
    
    # Upcoming exams (scheduled in the future)
    upcoming_exams = Assessment.objects.filter(
        course_id__in=enrolled_course_ids,
        status__in=[Assessment.Status.SCHEDULED, Assessment.Status.APPROVED],
        scheduled_at__gte=now
    ).select_related("course").order_by("scheduled_at")[:10]
    
    # Past exams
    past_exams = Assessment.objects.filter(
        course_id__in=enrolled_course_ids,
    ).exclude(
        status=Assessment.Status.DRAFT
    ).select_related("course").order_by("-scheduled_at")[:10]
    
    # Get student's submissions
    submissions = AssessmentSubmission.objects.filter(student=student).values_list(
        "assessment_id", flat=True
    )
    
    enrollments_data = [
        {
            "id": str(e.id),
            "course_id": str(e.course.id),
            "course_code": e.course.code,
            "course_title": e.course.title,
            "teacher": e.course.assigned_teacher.email if e.course.assigned_teacher else None,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
        }
        for e in enrollments
    ]
    
    def get_exam_data(exam):
        has_submission = str(exam.id) in [str(s) for s in submissions]
        session = ExamSession.objects.filter(
            assessment=exam, student=student
        ).first()
        
        return {
            "id": str(exam.id),
            "title": exam.title,
            "course_code": exam.course.code,
            "assessment_type": exam.assessment_type,
            "scheduled_at": exam.scheduled_at.isoformat() if exam.scheduled_at else None,
            "closes_at": exam.closes_at.isoformat() if exam.closes_at else None,
            "duration_minutes": exam.duration_minutes,
            "total_marks": exam.total_marks,
            "status": exam.status,
            "student_status": (
                "SUBMITTED" if has_submission else
                "IN_PROGRESS" if session and session.status == ExamSession.SessionStatus.IN_PROGRESS else
                "NOT_STARTED"
            ),
        }
    
    return Response({
        "enrollments": enrollments_data,
        "total_enrollments": len(enrollments_data),
        "upcoming_exams": [get_exam_data(e) for e in upcoming_exams],
        "past_exams": [get_exam_data(e) for e in past_exams],
        "attendance_percentage": None,  # Placeholder - implement if attendance model exists
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """
    Dashboard data for administrators.
    Returns: user counts by role, recent registrations, system stats.
    """
    user = request.user
    if user.role != User.Role.ADMIN:
        return Response(
            {"detail": "Only administrators can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # ---------------------------------------------------------------------
    # Date range helpers (for trends + charts)
    # ---------------------------------------------------------------------
    now = timezone.now()
    range_param = (request.query_params.get("range") or "week").lower()

    def _start_end_for_range() -> tuple[datetime, datetime, str]:
        if range_param == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return start, now, "today"
        if range_param == "month":
            return now - timedelta(days=30), now, "this month"
        if range_param == "custom":
            # Expect ISO date/datetime strings. Fall back to 7 days.
            start_raw = request.query_params.get("start")
            end_raw = request.query_params.get("end")
            try:
                start_parsed = datetime.fromisoformat(start_raw) if start_raw else None
                end_parsed = datetime.fromisoformat(end_raw) if end_raw else None
                if start_parsed and timezone.is_naive(start_parsed):
                    start_parsed = timezone.make_aware(start_parsed, timezone.get_current_timezone())
                if end_parsed and timezone.is_naive(end_parsed):
                    end_parsed = timezone.make_aware(end_parsed, timezone.get_current_timezone())
                if start_parsed and end_parsed and start_parsed < end_parsed:
                    return start_parsed, end_parsed, "custom range"
            except Exception:
                pass
            return now - timedelta(days=7), now, "this week"
        # Default: week
        return now - timedelta(days=7), now, "this week"

    start, end, period_label = _start_end_for_range()
    prev_start = start - (end - start)
    prev_end = start

    def _trend(current: int, previous: int) -> dict:
        delta = current - previous
        if delta > 0:
            direction = "up"
        elif delta < 0:
            direction = "down"
        else:
            direction = "flat"
        return {"delta": delta, "direction": direction, "period_label": period_label}

    # ---------------------------------------------------------------------
    # Core counts
    # ---------------------------------------------------------------------
    user_counts = User.objects.values("role").annotate(count=Count("id"))
    role_counts = {item["role"]: item["count"] for item in user_counts}

    total_courses = Course.objects.count()
    total_enrollments = CourseEnrollment.objects.count()
    total_assessments = Assessment.objects.count()
    total_submissions = AssessmentSubmission.objects.count()
    total_departments = Department.objects.count()

    # ---------------------------------------------------------------------
    # Trends (current range vs previous range)
    # ---------------------------------------------------------------------
    new_users_current = User.objects.filter(created_at__gte=start, created_at__lt=end).count()
    new_users_previous = User.objects.filter(created_at__gte=prev_start, created_at__lt=prev_end).count()

    new_courses_current = Course.objects.filter(created_at__gte=start, created_at__lt=end).count()
    new_courses_previous = Course.objects.filter(created_at__gte=prev_start, created_at__lt=prev_end).count()

    new_assessments_current = Assessment.objects.filter(created_at__gte=start, created_at__lt=end).count()
    new_assessments_previous = Assessment.objects.filter(created_at__gte=prev_start, created_at__lt=prev_end).count()

    new_enrollments_current = CourseEnrollment.objects.filter(enrolled_at__gte=start, enrolled_at__lt=end).count()
    new_enrollments_previous = CourseEnrollment.objects.filter(enrolled_at__gte=prev_start, enrolled_at__lt=prev_end).count()

    submissions_current = AssessmentSubmission.objects.filter(submitted_at__gte=start, submitted_at__lt=end).count()
    submissions_previous = AssessmentSubmission.objects.filter(submitted_at__gte=prev_start, submitted_at__lt=prev_end).count()

    # ---------------------------------------------------------------------
    # Recent registrations
    # ---------------------------------------------------------------------
    recent_users = User.objects.order_by("-created_at")[:25].select_related("department")
    
    recent_users_data = [
        {
            "id": u.id,
            "email": u.email,
            "name": f"{u.first_name} {u.last_name}".strip() or u.email,
            "role": u.role,
            "department": u.department.name if u.department else None,
            "department_id": str(u.department_id) if u.department_id else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "is_active": u.is_active,
            "onboarding_completed": getattr(u, "onboarding_completed", False),
        }
        for u in recent_users
    ]

    # ---------------------------------------------------------------------
    # Department overview
    # ---------------------------------------------------------------------
    departments = Department.objects.annotate(
        user_count=Count("users", distinct=True),
        course_count=Count("courses", distinct=True),
        students_count=Count("users", filter=Q(users__role=User.Role.STUDENT), distinct=True),
        teachers_count=Count("users", filter=Q(users__role=User.Role.TEACHER), distinct=True),
        active_course_count=Count("courses", filter=Q(courses__status=Course.Status.ACTIVE), distinct=True),
    )

    enrolled_by_dept = {
        str(row["course__department_id"]): row["count"]
        for row in CourseEnrollment.objects.filter(
            status=CourseEnrollment.EnrollmentStatus.ENROLLED
        )
        .values("course__department_id")
        .annotate(count=Count("id"))
    }

    departments_data = []
    max_users = max((d.user_count for d in departments), default=0) or 1
    for d in departments:
        enrolled_count = enrolled_by_dept.get(str(d.id), 0)
        avg_class_size = (
            round(enrolled_count / d.active_course_count, 1) if d.active_course_count else 0
        )
        load_pct = int(round((d.user_count / max_users) * 100))
        if d.active_course_count == 0 or d.teachers_count == 0:
            health = "CRITICAL"
        elif d.active_course_count < 2 or d.teachers_count < 2:
            health = "NEEDS_ATTENTION"
        else:
            health = "HEALTHY"

        departments_data.append(
            {
                "id": str(d.id),
                "name": d.name,
                "code": d.code,
                "user_count": d.user_count,
                "course_count": d.course_count,
                "students_count": d.students_count,
                "teachers_count": d.teachers_count,
                "active_course_count": d.active_course_count,
                "enrolled_students": enrolled_count,
                "avg_class_size": avg_class_size,
                "load_percent": load_pct,
                "health": health,
            }
        )

    # ---------------------------------------------------------------------
    # Charts
    # ---------------------------------------------------------------------
    growth_start = now - timedelta(days=180)
    monthly_growth_qs = (
        User.objects.filter(created_at__gte=growth_start)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    user_growth = [
        {"month": row["month"].date().isoformat() if row["month"] else None, "count": row["count"]}
        for row in monthly_growth_qs
        if row["month"]
    ]

    dept_distribution_qs = (
        User.objects.filter(role=User.Role.STUDENT, department__isnull=False)
        .values("department__name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    dept_distribution = [
        {"department": row["department__name"], "count": row["count"]}
        for row in dept_distribution_qs
    ]

    enrollments_bar_qs = (
        CourseEnrollment.objects.filter(enrolled_at__gte=start, enrolled_at__lt=end)
        .values("course__department__name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    enrollments_by_department = [
        {"department": row["course__department__name"] or "Unknown", "count": row["count"]}
        for row in enrollments_bar_qs
    ]

    # ---------------------------------------------------------------------
    # Performance snapshot + approvals
    # ---------------------------------------------------------------------
    active_users_now = User.objects.filter(last_login__gte=now - timedelta(minutes=15)).count()
    exams_in_progress = ExamSession.objects.filter(status=ExamSession.SessionStatus.IN_PROGRESS).count()
    pending_enrollments = CourseEnrollment.objects.filter(status=CourseEnrollment.EnrollmentStatus.PENDING).count()
    pending_schedule_approvals = Assessment.objects.filter(schedule_state=Assessment.ScheduleState.PROPOSED).count()

    # ---------------------------------------------------------------------
    # Activity feed (last ~20 events across key models)
    # ---------------------------------------------------------------------
    activities: list[dict] = []

    for u in User.objects.order_by("-created_at")[:8].select_related("department"):
        activities.append(
            {
                "id": f"user:{u.id}",
                "type": "USER",
                "title": "New user registered",
                "message": f"{(f'{u.first_name} {u.last_name}'.strip() or u.email)} joined as {u.role}.",
                "created_at": u.created_at.isoformat(),
                "actor": {
                    "name": f"{u.first_name} {u.last_name}".strip() or u.email,
                    "email": u.email,
                    "role": u.role,
                },
                "route": f"/dashboard/users/{u.id}/edit",
            }
        )

    for c in Course.objects.order_by("-created_at")[:6].select_related("department"):
        activities.append(
            {
                "id": f"course:{c.id}",
                "type": "COURSE",
                "title": "Course created",
                "message": f"{c.code} — {c.title} ({c.department.code if c.department else '—'})",
                "created_at": c.created_at.isoformat(),
                "actor": None,
                "route": f"/dashboard/courses/{c.id}",
            }
        )

    for e in CourseEnrollment.objects.order_by("-enrolled_at")[:6].select_related(
        "student", "course", "course__department"
    ):
        activities.append(
            {
                "id": f"enrollment:{e.id}",
                "type": "ENROLLMENT",
                "title": "Enrollment updated",
                "message": f"{e.student.email} → {e.course.code} ({e.status})",
                "created_at": e.enrolled_at.isoformat(),
                "actor": {"name": e.student.email, "email": e.student.email, "role": getattr(e.student, 'role', None)},
                "route": "/dashboard/enrollments",
            }
        )

    for a in Assessment.objects.order_by("-created_at")[:6].select_related("course", "course__department"):
        activities.append(
            {
                "id": f"assessment:{a.id}",
                "type": "ASSESSMENT",
                "title": "Assessment created",
                "message": f"{a.title} — {a.course.code}",
                "created_at": a.created_at.isoformat(),
                "actor": None,
                "route": f"/dashboard/assessments/{a.id}",
            }
        )

    for v in ProctoringViolation.objects.order_by("-created_at")[:6].select_related(
        "session", "session__assessment", "session__student"
    ):
        activities.append(
            {
                "id": f"violation:{v.id}",
                "type": "VIOLATION",
                "title": "Proctoring flag",
                "message": f"{v.violation_type} — {v.session.student.email if v.session and v.session.student else 'Student'}",
                "created_at": v.created_at.isoformat(),
                "actor": {
                    "name": v.session.student.email if v.session and v.session.student else None,
                    "email": v.session.student.email if v.session and v.session.student else None,
                    "role": getattr(v.session.student, 'role', None) if v.session and v.session.student else None,
                }
                if v.session and v.session.student
                else None,
                "route": f"/dashboard/assessments/{v.session.assessment_id}" if v.session else "/dashboard",
            }
        )

    activities.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    activities = activities[:20]

    return Response(
        {
            "user_counts": {
                "total": sum(role_counts.values()),
                "admins": role_counts.get(User.Role.ADMIN, 0),
                "hods": role_counts.get(User.Role.HOD, 0),
                "teachers": role_counts.get(User.Role.TEACHER, 0),
                "students": role_counts.get(User.Role.STUDENT, 0),
            },
            "totals": {
                "departments": total_departments,
                "courses": total_courses,
                "assessments": total_assessments,
                "enrollments": total_enrollments,
                "submissions": total_submissions,
            },
            "trends": {
                "users": _trend(new_users_current, new_users_previous),
                "courses": _trend(new_courses_current, new_courses_previous),
                "assessments": _trend(new_assessments_current, new_assessments_previous),
                "students": _trend(
                    User.objects.filter(role=User.Role.STUDENT, created_at__gte=start, created_at__lt=end).count(),
                    User.objects.filter(role=User.Role.STUDENT, created_at__gte=prev_start, created_at__lt=prev_end).count(),
                ),
                "enrollments": _trend(new_enrollments_current, new_enrollments_previous),
                "submissions": _trend(submissions_current, submissions_previous),
            },
            "recent_users": recent_users_data,
            "departments": departments_data,
            "total_departments": len(departments_data),
            "total_assessments": total_assessments,
            "total_submissions": total_submissions,
            "charts": {
                "user_growth": user_growth,
                "department_distribution": dept_distribution,
                "enrollments_by_department": enrollments_by_department,
            },
            "performance": {
                "active_users_now": active_users_now,
                "exams_in_progress": exams_in_progress,
                "pending_enrollments": pending_enrollments,
                "pending_schedule_approvals": pending_schedule_approvals,
            },
            "period": {
                "label": period_label,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "new_users": new_users_current,
                "new_courses": new_courses_current,
                "new_assessments": new_assessments_current,
                "new_enrollments": new_enrollments_current,
                "submissions": submissions_current,
            },
            "activity_feed": activities,
            "filters": {
                "range": range_param,
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard_search(request):
    """Global search used by the Admin dashboard."""
    user = request.user
    if user.role != User.Role.ADMIN:
        return Response(
            {"detail": "Only administrators can access this endpoint."},
            status=status.HTTP_403_FORBIDDEN,
        )

    query = (request.query_params.get("q") or "").strip()
    if not query:
        return Response({"results": []})

    results: list[dict] = []

    # Users
    users_qs = (
        User.objects.filter(
            Q(email__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )
        .select_related("department")
        .order_by("-created_at")[:5]
    )
    for u in users_qs:
        results.append(
            {
                "type": "user",
                "id": str(u.id),
                "title": f"{(f'{u.first_name} {u.last_name}'.strip() or u.email)}",
                "subtitle": f"{u.role} • {u.department.code if u.department else 'No department'}",
                "route": f"/dashboard/users/{u.id}/edit",
            }
        )

    # Departments
    depts_qs = (
        Department.objects.filter(Q(name__icontains=query) | Q(code__icontains=query))
        .order_by("name")[:5]
    )
    for d in depts_qs:
        results.append(
            {
                "type": "department",
                "id": str(d.id),
                "title": d.name,
                "subtitle": f"Department • {d.code}",
                "route": "/dashboard/departments",
            }
        )

    # Courses
    courses_qs = (
        Course.objects.filter(Q(code__icontains=query) | Q(title__icontains=query))
        .select_related("department")
        .order_by("code")[:5]
    )
    for c in courses_qs:
        results.append(
            {
                "type": "course",
                "id": str(c.id),
                "title": f"{c.code} — {c.title}",
                "subtitle": f"Course • {c.department.code if c.department else '—'}",
                "route": f"/dashboard/courses/{c.id}",
            }
        )

    # Assessments
    assessments_qs = (
        Assessment.objects.filter(
            Q(title__icontains=query) | Q(course__code__icontains=query)
        )
        .select_related("course", "course__department")
        .order_by("-created_at")[:5]
    )
    for a in assessments_qs:
        results.append(
            {
                "type": "assessment",
                "id": str(a.id),
                "title": a.title,
                "subtitle": f"Assessment • {a.course.code}",
                "route": f"/dashboard/assessments/{a.id}",
            }
        )

    return Response({"results": results})
