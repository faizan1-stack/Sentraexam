from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from django.conf import settings
from rest_framework import serializers

from apps.users.models import User
from .models import Assessment, AssessmentSubmission, ExamAssignment, ExamSession, CheatingLog


class AssessmentContentSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    content_type = serializers.ChoiceField(
        choices=("INSTRUCTION", "QUESTION", "RESOURCE"),
    )


class AssessmentQuestionOptionSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=512)
    is_correct = serializers.BooleanField()


class AssessmentQuestionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=("MCQ", "SUBJECTIVE"), required=False, default="MCQ")
    prompt = serializers.CharField(max_length=1024)
    options = AssessmentQuestionOptionSerializer(many=True, required=False)
    marks = serializers.IntegerField(min_value=1, required=False, default=1)


class AssessmentSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    approved_by_email = serializers.EmailField(source="approved_by.email", read_only=True)
    schedule_proposed_by_email = serializers.EmailField(
        source="schedule_proposed_by.email", read_only=True
    )
    schedule_approved_by_email = serializers.EmailField(
        source="schedule_approved_by.email", read_only=True
    )
    content = AssessmentContentSerializer(many=True, read_only=True)
    questions = AssessmentQuestionSerializer(many=True, read_only=True)
    # Computed statistics fields
    total_submissions = serializers.SerializerMethodField()
    average_score = serializers.SerializerMethodField()
    submission_rate = serializers.SerializerMethodField()
    # Student-specific status field
    student_submission_status = serializers.SerializerMethodField()
    ends_at = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = (
            "id",
            "course",
            "course_code",
            "title",
            "assessment_type",
            "description",
            "instructions",
            "content",
            "questions",
            "duration_minutes",
            "instructions_open_minutes",
            "late_entry_minutes",
            "grace_minutes",
            "total_marks",
            "status",
            "submission_format",
            "scheduled_at",
            "ends_at",
            "closes_at",
            "schedule_state",
            "schedule_proposed_by",
            "schedule_proposed_by_email",
            "schedule_proposed_at",
            "schedule_approved_by",
            "schedule_approved_by_email",
            "schedule_approved_at",
            "created_by",
            "created_by_email",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "created_at",
            "updated_at",
            "total_submissions",
            "average_score",
            "submission_rate",
            "student_submission_status",
        )
        read_only_fields = (
            "created_by",
            "created_by_email",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "schedule_proposed_by",
            "schedule_proposed_by_email",
            "schedule_proposed_at",
            "schedule_approved_by",
            "schedule_approved_by_email",
            "schedule_approved_at",
            "created_at",
            "updated_at",
            "total_submissions",
            "average_score",
            "submission_rate",
            "student_submission_status",
            "ends_at",
        )

    def get_ends_at(self, obj):
        if not obj.scheduled_at:
            return None
        return obj.scheduled_at + timedelta(minutes=int(obj.duration_minutes or 0))

    def get_student_submission_status(self, obj) -> str | None:
        """
        Return submission status for the current student:
        - 'SUBMITTED': Student has submitted this assessment
        - 'IN_PROGRESS': Student has started but not submitted
        - 'NOT_STARTED': Student has not started yet
        - None: For non-student users or unauthenticated requests
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        user = request.user
        if user.role != User.Role.STUDENT:
            return None
        
        # Check if student has submitted (and whether results are published via grading)
        submission_status = (
            AssessmentSubmission.objects.filter(assessment=obj, student=user)
            .values_list("status", flat=True)
            .first()
        )
        if submission_status:
            if submission_status == AssessmentSubmission.SubmissionStatus.GRADED:
                return "GRADED"
            return "SUBMITTED"
        
        # Check if student has an in-progress session
        session = ExamSession.objects.filter(assessment=obj, student=user).first()
        if session:
            if session.status == ExamSession.SessionStatus.IN_PROGRESS:
                return 'IN_PROGRESS'
            elif session.status == ExamSession.SessionStatus.TERMINATED:
                return 'TERMINATED'
        
        return 'NOT_STARTED'

    def get_total_submissions(self, obj) -> int:
        return obj.submissions.count()

    def get_average_score(self, obj) -> float | None:
        from django.db.models import Avg
        avg = obj.submissions.aggregate(Avg("score"))["score__avg"]
        return round(avg, 2) if avg is not None else None

    def get_submission_rate(self, obj) -> float:
        total_submissions = obj.submissions.count()
        if obj.assign_to_all:
            # Count all students enrolled in the course
            total_students = obj.course.enrollments.count()
        else:
            # Count only assigned students
            total_students = obj.assignments.count()
        
        if total_students == 0:
            return 0.0
        
        return round((total_submissions / total_students) * 100, 1)

    def to_representation(self, instance):
        """
        Prevent answer-key leakage to students.

        Students should not receive correct-answer flags or staff-only aggregate stats until results are published.
        (Front-end must also hide these, but backend enforcement is required.)
        """
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not getattr(user, "is_authenticated", False):
            return data

        if user.role != User.Role.STUDENT:
            return data

        # Hide staff-only aggregate statistics from students.
        data.pop("total_submissions", None)
        data.pop("average_score", None)
        data.pop("submission_rate", None)

        # Hide answer key (is_correct) from students.
        # Also lock question content until the student actually starts an online session.
        student_state = data.get("student_submission_status")
        if (
            instance.submission_format == Assessment.SubmissionFormat.ONLINE
            and student_state == "NOT_STARTED"
        ):
            data["questions"] = []

        questions = data.get("questions") or []
        if isinstance(questions, list):
            for q in questions:
                if not isinstance(q, dict):
                    continue
                options = q.get("options") or []
                if not isinstance(options, list):
                    continue
                for opt in options:
                    if isinstance(opt, dict):
                        opt.pop("is_correct", None)

        return data


class AssessmentCreateSerializer(serializers.ModelSerializer):
    content = AssessmentContentSerializer(many=True, required=True)
    questions = AssessmentQuestionSerializer(many=True, required=False)

    class Meta:
        model = Assessment
        fields = (
            "course",
            "title",
            "assessment_type",
            "description",
            "instructions",
            "content",
            "questions",
            "duration_minutes",
            "total_marks",
            "status",
            "submission_format",
            "scheduled_at",
            "closes_at",
        )

    def validate(self, attrs):
        scheduled_at = attrs.get("scheduled_at")
        closes_at = attrs.get("closes_at")
        if scheduled_at and closes_at and scheduled_at >= closes_at:
            raise serializers.ValidationError("Close time must be after scheduled time.")
        if not attrs.get("content"):
            raise serializers.ValidationError("At least one content block is required.")

        assessment_type = attrs.get("assessment_type") or getattr(
            self.instance, "assessment_type", None
        )
        submission_format = attrs.get("submission_format") or getattr(
            self.instance, "submission_format", Assessment.SubmissionFormat.TEXT
        )
        questions = attrs.get("questions")
        if assessment_type == Assessment.AssessmentType.EXAM:
            if submission_format != Assessment.SubmissionFormat.ONLINE:
                raise serializers.ValidationError(
                    {"submission_format": "Exams must use the online exam submission format."}
                )
            questions = questions or getattr(self.instance, "questions", [])
            if not questions:
                raise serializers.ValidationError({"questions": "Exams must include questions."})
            
            for idx, question in enumerate(questions):
                q_type = question.get("type")
                if q_type == "MCQ":
                    options = question.get("options") or []
                    if len(options) < 2:
                        raise serializers.ValidationError(
                            {"questions": f"Question {idx + 1} (MCQ) must have at least two options."}
                        )
                    correct_options = [opt for opt in options if opt.get("is_correct")]
                    if len(correct_options) != 1:
                        raise serializers.ValidationError(
                            {"questions": f"Question {idx + 1} (MCQ) must have exactly one correct option."}
                        )
                elif q_type == "SUBJECTIVE":
                    # Subjective questions don't need options validation
                    pass
        else:
            if submission_format == Assessment.SubmissionFormat.ONLINE:
                raise serializers.ValidationError(
                    {"submission_format": "Only exams can use the online exam submission format."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        content = validated_data.pop("content", [])
        questions = validated_data.pop("questions", [])
        if validated_data.get("assessment_type") != Assessment.AssessmentType.EXAM:
            questions = []
        assessment = super().create(validated_data)
        assessment.content = content
        assessment.questions = questions
        assessment.save(update_fields=["content", "questions"])
        if request and request.user.is_authenticated:
            assessment.created_by = request.user
            assessment.save(update_fields=["created_by"])
        return assessment

    def update(self, instance, validated_data):
        content = validated_data.pop("content", None)
        questions = validated_data.pop("questions", None)
        assessment = super().update(instance, validated_data)
        update_fields = ["updated_at"]
        if content is not None:
            assessment.content = content
            update_fields.append("content")
        if questions is not None:
            if (
                validated_data.get("assessment_type", instance.assessment_type)
                != Assessment.AssessmentType.EXAM
            ):
                questions = []
            assessment.questions = questions
            update_fields.append("questions")
        if len(update_fields) > 1:
            assessment.save(update_fields=update_fields)
        return assessment


class AssessmentApprovalSerializer(serializers.Serializer):
    approve = serializers.BooleanField()

    def save(self, assessment: Assessment):
        user = self.context["request"].user
        if self.validated_data["approve"]:
            assessment.approve(user)
        else:
            assessment.status = Assessment.Status.DRAFT
            assessment.approved_by = None
            assessment.approved_at = None
            assessment.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        return assessment


class AssessmentScheduleSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()
    duration_minutes = serializers.IntegerField(required=False, min_value=5, max_value=24 * 60)
    instructions_open_minutes = serializers.IntegerField(required=False, min_value=0, max_value=24 * 60)
    late_entry_minutes = serializers.IntegerField(required=False, min_value=0, max_value=24 * 60)
    grace_minutes = serializers.IntegerField(required=False, min_value=0, max_value=24 * 60)

    def validate(self, attrs):
        if attrs["scheduled_at"] < timezone.now():
            raise serializers.ValidationError("Scheduled time must be in the future.")
        assessment: Assessment = self.context.get("assessment")
        if not assessment:
            raise serializers.ValidationError("Invalid scheduling context.")

        duration = int(attrs.get("duration_minutes") or assessment.duration_minutes or 0)
        if duration <= 0:
            raise serializers.ValidationError({"duration_minutes": "Duration must be greater than 0."})

        grace = int(attrs.get("grace_minutes") if "grace_minutes" in attrs else (assessment.grace_minutes or 0))
        late_entry = int(
            attrs.get("late_entry_minutes")
            if "late_entry_minutes" in attrs
            else (assessment.late_entry_minutes or 0)
        )
        instructions_open = int(
            attrs.get("instructions_open_minutes")
            if "instructions_open_minutes" in attrs
            else (assessment.instructions_open_minutes or 0)
        )

        start_at = attrs["scheduled_at"]
        end_at = start_at + timedelta(minutes=duration)
        closes_at = end_at + timedelta(minutes=grace)

        # Conflict detection (department + teacher, and targeted students if small).
        buffer_minutes = int(getattr(settings, "EXAM_SCHEDULE_BUFFER_MINUTES", 10))
        buffer_delta = timedelta(minutes=buffer_minutes)

        def overlaps(other_start, other_close) -> bool:
            return (start_at < (other_close + buffer_delta)) and ((closes_at + buffer_delta) > other_start)

        conflicts: list[dict] = []

        base_qs = (
            Assessment.objects.select_related("course")
            .filter(scheduled_at__isnull=False)
            .exclude(id=assessment.id)
            .exclude(status__in=[Assessment.Status.CANCELLED])
            .exclude(schedule_state=Assessment.ScheduleState.DRAFT)
        )

        # Department conflicts
        dept_qs = base_qs.filter(course__department_id=assessment.course.department_id)
        for other in dept_qs[:200]:
            other_start = other.scheduled_at
            other_close = other.closes_at or (other.scheduled_at + timedelta(minutes=int(other.duration_minutes or 0)))
            if other_start and other_close and overlaps(other_start, other_close):
                conflicts.append(
                    {
                        "scope": "department",
                        "assessment_id": str(other.id),
                        "title": other.title,
                        "course_code": other.course.code if other.course else None,
                        "scheduled_at": other_start,
                        "closes_at": other_close,
                    }
                )
                if len(conflicts) >= 10:
                    break

        # Teacher conflicts (only if the course has an assigned teacher)
        if assessment.course.assigned_teacher_id:
            teacher_qs = base_qs.filter(course__assigned_teacher_id=assessment.course.assigned_teacher_id)
            for other in teacher_qs[:200]:
                other_start = other.scheduled_at
                other_close = other.closes_at or (
                    other.scheduled_at + timedelta(minutes=int(other.duration_minutes or 0))
                )
                if other_start and other_close and overlaps(other_start, other_close):
                    conflicts.append(
                        {
                            "scope": "teacher",
                            "assessment_id": str(other.id),
                            "title": other.title,
                            "course_code": other.course.code if other.course else None,
                            "scheduled_at": other_start,
                            "closes_at": other_close,
                        }
                    )
                    if len(conflicts) >= 10:
                        break

        # Targeted-student conflicts (only when not assign_to_all to keep it scalable).
        if not assessment.assign_to_all:
            student_ids = list(assessment.assignments.values_list("student_id", flat=True)[:200])
            if student_ids:
                other_ids = (
                    ExamAssignment.objects.filter(student_id__in=student_ids)
                    .exclude(assessment_id=assessment.id)
                    .values_list("assessment_id", flat=True)
                    .distinct()
                )
                student_qs = base_qs.filter(id__in=list(other_ids)[:500])
                for other in student_qs[:200]:
                    other_start = other.scheduled_at
                    other_close = other.closes_at or (
                        other.scheduled_at + timedelta(minutes=int(other.duration_minutes or 0))
                    )
                    if other_start and other_close and overlaps(other_start, other_close):
                        conflicts.append(
                            {
                                "scope": "students",
                                "assessment_id": str(other.id),
                                "title": other.title,
                                "course_code": other.course.code if other.course else None,
                                "scheduled_at": other_start,
                                "closes_at": other_close,
                            }
                        )
                        if len(conflicts) >= 10:
                            break

        if conflicts:
            raise serializers.ValidationError(
                {
                    "detail": "Scheduling conflict detected. Please choose a different time.",
                    "conflicts": conflicts,
                    "buffer_minutes": buffer_minutes,
                }
            )

        attrs["_computed"] = {
            "duration_minutes": duration,
            "instructions_open_minutes": instructions_open,
            "late_entry_minutes": late_entry,
            "grace_minutes": grace,
            "end_at": end_at,
            "closes_at": closes_at,
        }
        return attrs

    def save(self, assessment: Assessment):
        request = self.context["request"]
        computed = self.validated_data["_computed"]

        assessment.scheduled_at = self.validated_data["scheduled_at"]
        assessment.duration_minutes = int(computed["duration_minutes"])
        assessment.instructions_open_minutes = int(computed["instructions_open_minutes"])
        assessment.late_entry_minutes = int(computed["late_entry_minutes"])
        assessment.grace_minutes = int(computed["grace_minutes"])
        assessment.closes_at = computed["closes_at"]

        # Proposal workflow: proposing a schedule requires admin approval to become SCHEDULED.
        assessment.schedule_state = Assessment.ScheduleState.PROPOSED
        assessment.schedule_proposed_by = request.user
        assessment.schedule_proposed_at = timezone.now()
        assessment.schedule_approved_by = None
        assessment.schedule_approved_at = None
        assessment.status = Assessment.Status.APPROVED

        assessment.save(
            update_fields=[
                "scheduled_at",
                "closes_at",
                "duration_minutes",
                "instructions_open_minutes",
                "late_entry_minutes",
                "grace_minutes",
                "schedule_state",
                "schedule_proposed_by",
                "schedule_proposed_at",
                "schedule_approved_by",
                "schedule_approved_at",
                "status",
                "updated_at",
            ]
        )
        return assessment


class AssessmentScheduleApprovalSerializer(serializers.Serializer):
    approved = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        approved = bool(attrs.get("approved"))
        reason = (attrs.get("reason") or "").strip()
        if not approved and len(reason) < 5:
            raise serializers.ValidationError({"reason": "Rejection reason is required."})
        attrs["reason"] = reason
        return attrs


class AssessmentSubmissionSerializer(serializers.ModelSerializer):
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    text_response = serializers.CharField(required=False, allow_blank=True)
    file_response = serializers.FileField(required=False, allow_null=True)
    answers = serializers.ListField(
        child=serializers.JSONField(),  # Allow mixed types (int for MCQ, str for Subjective)
        required=False,
        allow_empty=True,
    )
    
    # Session ID for video recording access
    session_id = serializers.UUIDField(source="session.id", read_only=True, allow_null=True)
    
    # Proctoring statistics for teachers
    total_violations = serializers.SerializerMethodField()
    violations_by_type = serializers.SerializerMethodField()
    proctoring_snapshots = serializers.SerializerMethodField()
    cheating_count = serializers.SerializerMethodField()
    cheating_logs = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentSubmission
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "student",
            "student_email",
            "status",
            "score",
            "feedback",
            "text_response",
            "file_response",
            "answers",
            "submitted_at",
            "created_at",
            "updated_at",
            # Session and proctoring fields
            "session_id",
            "cheating_count",
            "cheating_logs",
            "total_violations",
            "violations_by_type",
            "proctoring_snapshots",
        )
        read_only_fields = (
            "student",
            "student_email",
            "status",
            "submitted_at",
            "created_at",
            "updated_at",
            "session_id",
            "cheating_count",
            "cheating_logs",
            "total_violations",
            "violations_by_type",
            "proctoring_snapshots",
        )
    
    def get_total_violations(self, obj):
        """Get total number of proctoring violations for this submission's session."""
        if not obj.session:
            return 0
        from apps.proctoring.models import ProctoringViolation
        return ProctoringViolation.objects.filter(session=obj.session).count()

    def get_cheating_count(self, obj) -> int:
        """Tab switching / blur / fullscreen exit incidents (from ExamSession.cheating_count)."""
        if not obj.session:
            return 0
        return int(getattr(obj.session, "cheating_count", 0) or 0)

    def get_cheating_logs(self, obj):
        if not obj.session:
            return []
        logs = obj.session.cheating_logs.all().order_by("-occurred_at")[:20]
        return [
            {
                "id": str(l.id),
                "incident_type": l.incident_type,
                "occurred_at": l.occurred_at,
                "details": l.details,
            }
            for l in logs
        ]
    
    def get_violations_by_type(self, obj):
        """Get breakdown of violations by type."""
        if not obj.session:
            return {}
        from apps.proctoring.models import ProctoringViolation
        from django.db.models import Count
        violations = ProctoringViolation.objects.filter(
            session=obj.session
        ).values('violation_type').annotate(count=Count('id'))
        return {v['violation_type']: v['count'] for v in violations}
    
    def get_proctoring_snapshots(self, obj):
        """Get list of proctoring snapshots with timestamps."""
        if not obj.session:
            return []
        from apps.proctoring.models import ProctoringSnapshot
        snapshots = ProctoringSnapshot.objects.filter(
            session=obj.session
        ).order_by('captured_at')[:50]  # Limit to 50 snapshots
        
        request = self.context.get('request')
        return [{
            'id': str(snap.id),
            'captured_at': snap.captured_at,
            'image_url': (
                snap.image_url
                or (
                    request.build_absolute_uri(snap.image.url)
                    if (request and getattr(snap, "image", None))
                    else (snap.image.url if getattr(snap, "image", None) else "")
                )
            ),
            'is_violation': snap.is_violation,
            'faces_detected': snap.faces_detected,
        } for snap in snapshots]

    def validate(self, attrs):
        assessment = attrs.get("assessment") or getattr(self.instance, "assessment", None)
        if not assessment:
            return attrs
        submission_format = assessment.submission_format
        text_response = attrs.get("text_response", "")
        file_response = attrs.get("file_response")

        if submission_format == Assessment.SubmissionFormat.ONLINE:
            questions = assessment.questions or []
            answers = attrs.get("answers")
            if not isinstance(answers, list):
                raise serializers.ValidationError(
                    {"answers": "Answers must be a list."}
                )
            # Allow partial submissions - pad with nulls if needed
            while len(answers) < len(questions):
                answers.append(None)
            
            for idx, selected in enumerate(answers):
                if idx >= len(questions):
                    break
                question = questions[idx]
                q_type = question.get("type", "MCQ")  # Default to MCQ for backward compatibility
                
                if q_type == "MCQ":
                    options = question.get("options", [])
                    # Allow None, -1, or valid index
                    if selected is not None and selected != -1:
                        if not isinstance(selected, int) or selected < 0 or selected >= len(options):
                            raise serializers.ValidationError(
                                {"answers": f"Question {idx + 1} contains an invalid selection."}
                            )
                elif q_type == "SUBJECTIVE":
                    # Allow blank/None for subjective
                    pass
            attrs["answers"] = answers
            attrs["text_response"] = ""
            attrs["file_response"] = None
        if submission_format == Assessment.SubmissionFormat.TEXT and not text_response.strip():
            raise serializers.ValidationError({"text_response": "Text response is required."})
        if submission_format == Assessment.SubmissionFormat.FILE and not file_response:
            raise serializers.ValidationError({"file_response": "File upload is required."})
        if submission_format == Assessment.SubmissionFormat.TEXT_AND_FILE:
            errors = {}
            if not text_response.strip():
                errors["text_response"] = "Text response is required."
            if not file_response:
                errors["file_response"] = "File upload is required."
            if errors:
                raise serializers.ValidationError(errors)
        if submission_format != Assessment.SubmissionFormat.ONLINE:
            attrs["answers"] = []
        return attrs

    def to_representation(self, instance):
        """
        Students should not see proctoring evidence or scoring before results are published.

        Results are treated as "published" when a submission is graded (status=GRADED).
        """
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not getattr(user, "is_authenticated", False):
            return data

        if user.role != User.Role.STUDENT:
            return data

        # Evidence is staff-only (teacher/HOD/admin).
        data.pop("cheating_count", None)
        data.pop("cheating_logs", None)
        data.pop("total_violations", None)
        data.pop("violations_by_type", None)
        data.pop("proctoring_snapshots", None)

        # Hide score/feedback until graded (published).
        if data.get("status") != AssessmentSubmission.SubmissionStatus.GRADED:
            data["score"] = None
            data["feedback"] = ""

        return data


class AssessmentGradeSerializer(serializers.Serializer):
    score = serializers.DecimalField(max_digits=5, decimal_places=2)
    feedback = serializers.CharField(required=False, allow_blank=True)

    def save(self, submission: AssessmentSubmission):
        submission.mark_graded(
            score=self.validated_data["score"],
            feedback=self.validated_data.get("feedback", ""),
        )
        return submission


# ============================================================================
# Exam Assignment Serializers
# ============================================================================

class ExamAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for viewing exam assignments."""
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_name = serializers.SerializerMethodField()
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)

    class Meta:
        model = ExamAssignment
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "student",
            "student_email",
            "student_name",
            "assigned_at",
            "is_completed",
            "created_at",
        )
        read_only_fields = ("assigned_at", "is_completed", "created_at")

    def get_student_name(self, obj) -> str:
        return f"{obj.student.first_name} {obj.student.last_name}".strip() or obj.student.email


class AssignStudentsSerializer(serializers.Serializer):
    """Serializer for assigning students to an exam."""
    student_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="List of student IDs to assign to the exam"
    )
    
    def validate_student_ids(self, value):
        students = User.objects.filter(id__in=value, role=User.Role.STUDENT)
        if students.count() != len(value):
            raise serializers.ValidationError("One or more student IDs are invalid.")
        return value

    def save(self, assessment: Assessment):
        student_ids = self.validated_data["student_ids"]
        students = User.objects.filter(id__in=student_ids, role=User.Role.STUDENT)
        
        # Create assignments for students that don't already have one
        created = []
        for student in students:
            obj, is_new = ExamAssignment.objects.get_or_create(
                assessment=assessment,
                student=student,
            )
            if is_new:
                created.append(obj)
        
        # If assigning specific students, set assign_to_all to False
        if not assessment.assign_to_all:
            pass  # Already set
        else:
            assessment.assign_to_all = False
            assessment.save(update_fields=["assign_to_all", "updated_at"])
        
        return created


# ============================================================================
# Exam Session Serializers
# ============================================================================

class CheatingLogSerializer(serializers.ModelSerializer):
    """Serializer for cheating incident logs."""
    
    class Meta:
        model = CheatingLog
        fields = ("id", "incident_type", "occurred_at", "details")
        read_only_fields = ("id", "occurred_at")


class ExamSessionSerializer(serializers.ModelSerializer):
    """Serializer for exam sessions."""
    student_email = serializers.EmailField(source="student.email", read_only=True)
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)
    cheating_logs = CheatingLogSerializer(many=True, read_only=True)
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "student",
            "student_email",
            "started_at",
            "ended_at",
            "server_deadline",
            "cheating_count",
            "status",
            "saved_answers",
            "cheating_logs",
            "time_remaining_seconds",
        )
        read_only_fields = (
            "started_at",
            "ended_at",
            "server_deadline",
            "cheating_count",
            "status",
        )

    def get_time_remaining_seconds(self, obj) -> int:
        if obj.status != ExamSession.SessionStatus.IN_PROGRESS:
            return 0
        remaining = obj.server_deadline - timezone.now()
        return max(0, int(remaining.total_seconds()))


class StartExamSessionSerializer(serializers.Serializer):
    """Serializer for starting an exam session."""
    
    def validate(self, attrs):
        request = self.context.get("request")
        assessment = self.context.get("assessment")
        
        if not request or not assessment:
            raise serializers.ValidationError("Invalid request context.")
        
        user = request.user
        
        # Check if student is allowed to take this exam
        if not assessment.assign_to_all:
            if not ExamAssignment.objects.filter(
                assessment=assessment, student=user
            ).exists():
                raise serializers.ValidationError(
                    "You are not assigned to take this exam."
                )
        
        # Check if exam is in valid status
        valid_statuses = [Assessment.Status.SCHEDULED, Assessment.Status.IN_PROGRESS]
        if assessment.status not in valid_statuses:
            raise serializers.ValidationError("This exam is not currently available.")
        
        # Check timing
        now = timezone.now()
        if assessment.scheduled_at and now < assessment.scheduled_at:
            raise serializers.ValidationError("This exam has not started yet.")

        # Hard end is scheduled_at + duration. Grace affects submissions, not entry.
        if assessment.scheduled_at:
            hard_end = assessment.scheduled_at + timedelta(minutes=int(assessment.duration_minutes or 0))
            latest_entry = assessment.scheduled_at + timedelta(minutes=int(assessment.late_entry_minutes or 0))

            if now > hard_end:
                raise serializers.ValidationError("This exam has ended.")
            if assessment.late_entry_minutes and now > latest_entry:
                raise serializers.ValidationError("Late entry window has closed.")

        # Submission window (includes grace)
        if assessment.closes_at and now > assessment.closes_at:
            raise serializers.ValidationError("This exam has already closed.")
        
        # Check for existing session
        existing = ExamSession.objects.filter(
            assessment=assessment, student=user
        ).first()
        
        if existing:
            if existing.status == ExamSession.SessionStatus.IN_PROGRESS:
                # Resume existing session
                attrs["existing_session"] = existing
            elif existing.status == ExamSession.SessionStatus.SUBMITTED:
                # Already submitted - cannot retake
                raise serializers.ValidationError(
                    "You have already submitted this exam. Retakes are not allowed."
                )
            else:
                # Terminated session
                raise serializers.ValidationError(
                    "This exam session was terminated and cannot be resumed."
                )
        
        return attrs

    def save(self, assessment: Assessment):
        request = self.context["request"]
        user = request.user
        
        # Check for existing session to resume
        if "existing_session" in self.validated_data:
            return self.validated_data["existing_session"]
        
        # Create new session; deadline is fixed to the scheduled end time (not client time),
        # so starting late reduces remaining time.
        now = timezone.now()
        if assessment.scheduled_at:
            hard_end = assessment.scheduled_at + timedelta(minutes=int(assessment.duration_minutes or 0))
            remaining = hard_end - now
            server_deadline = now + timedelta(seconds=max(0, int(remaining.total_seconds())))
        else:
            server_deadline = now + timedelta(minutes=int(assessment.duration_minutes or 0))

        session = ExamSession.objects.create(
            assessment=assessment,
            student=user,
            server_deadline=server_deadline,
        )

        # Move assessment into IN_PROGRESS once a student actually starts it (within the window).
        if assessment.status == Assessment.Status.SCHEDULED:
            assessment.status = Assessment.Status.IN_PROGRESS
            assessment.save(update_fields=["status", "updated_at"])
        
        # Mark assignment as started (if exists)
        ExamAssignment.objects.filter(
            assessment=assessment, student=user
        ).update(is_completed=False)
        
        return session


class ReportCheatingSerializer(serializers.Serializer):
    """Serializer for reporting a cheating incident."""
    incident_type = serializers.ChoiceField(choices=CheatingLog.IncidentType.choices)
    details = serializers.JSONField(required=False, default=dict)

    def save(self, session: ExamSession):
        log = CheatingLog.objects.create(
            session=session,
            incident_type=self.validated_data["incident_type"],
            details=self.validated_data.get("details", {}),
        )
        
        # Increment cheating count
        session.cheating_count += 1
        session.save(update_fields=["cheating_count", "updated_at"])
        
        # Auto-terminate after 3 incidents
        if session.cheating_count >= 3:
            session.status = ExamSession.SessionStatus.TERMINATED
            session.ended_at = timezone.now()
            session.save(update_fields=["status", "ended_at", "updated_at"])

        # Notify assigned teacher, HOD, and admins (low-noise).
        # We notify on the first incident and when the session is terminated.
        try:
            should_notify = session.cheating_count in {1, 3}
            if should_notify:
                from apps.notifications.models import Notification

                recipients: list[int] = []
                course = session.assessment.course
                if course.assigned_teacher_id:
                    recipients.append(course.assigned_teacher_id)
                recipients += list(
                    User.objects.filter(
                        role=User.Role.HOD,
                        department_id=course.department_id,
                        is_active=True,
                    ).values_list("id", flat=True)
                )
                recipients += list(
                    User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True)
                )

                if recipients:
                    Notification.objects.bulk_create(
                        [
                            Notification(
                                user_id=rid,
                                subject="Cheating Incident Reported",
                                body=(
                                    f"{session.student.email}: {log.incident_type} "
                                    f"({session.cheating_count}/3)"
                                ),
                                metadata={
                                    "session_id": str(session.id),
                                    "assessment_id": str(session.assessment_id),
                                    "course_id": str(course.id),
                                    "incident_type": log.incident_type,
                                    "cheating_count": session.cheating_count,
                                    "action": "cheating_incident",
                                    "terminated": session.status == ExamSession.SessionStatus.TERMINATED,
                                },
                            )
                            for rid in set(recipients)
                        ]
                    )
        except Exception:
            # Never block exam flow due to notification errors.
            pass
        
        return log


class AutoSaveAnswersSerializer(serializers.Serializer):
    """Serializer for auto-saving exam answers."""
    answers = serializers.ListField(
        child=serializers.JSONField(),
        allow_empty=True,
    )

    def save(self, session: ExamSession):
        session.saved_answers = self.validated_data["answers"]
        session.save(update_fields=["saved_answers", "updated_at"])
        return session
