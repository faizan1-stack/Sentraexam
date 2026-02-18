from __future__ import annotations

import logging
from datetime import timedelta

from django.core.files.base import ContentFile
from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from apps.users.models import User
from apps.assessments.models import ExamSession
from apps.notifications.models import Notification
from django.conf import settings
from imagekitio import ImageKit
from .models import (
    ProctoringSnapshot,
    ProctoringVideoClip,
    ProctoringViolation,
    ProctoringSettings,
    StudentFaceReference
)
from .serializers import (
    ProctoringSnapshotSerializer,
    ProctoringSnapshotUploadSerializer,
    ProctoringVideoClipSerializer,
    ProctoringViolationSerializer,
    ProctoringSettingsSerializer,
    ProctoringStatusSerializer,
    StudentFaceReferenceSerializer,
    FaceRegistrationSerializer,
    ViolationReviewSerializer,
)
from .services import (
    analyze_snapshot,
    analyze_snapshot_with_gemini, # Use for registration check
    detect_violations,
    get_temporal_analyzer,
    clear_temporal_analyzer,
)

logger = logging.getLogger(__name__)


EVIDENCE_MIN_SEVERITY = 4
# Avoid spamming evidence snapshots; keep at most one evidence snapshot per session per window.
EVIDENCE_COOLDOWN_SECONDS = 30
# Avoid spamming duplicate violations (same type) on every upload.
VIOLATION_TYPE_COOLDOWN_SECONDS = 20


def user_can_view_session_proctoring(user: User, session: ExamSession) -> bool:
    """Backend enforcement to prevent cross-department/course leakage."""
    if not user or not user.is_authenticated:
        return False

    if user.role == User.Role.ADMIN:
        return True

    # Student: only their own session
    if user.role == User.Role.STUDENT:
        return session.student_id == user.id

    course = getattr(session.assessment, "course", None)
    if course is None:
        return False

    if user.role == User.Role.TEACHER:
        return course.assigned_teacher_id == user.id

    if user.role == User.Role.HOD:
        # HOD only sees sessions for courses in their own department.
        return bool(user.department_id) and course.department_id == user.department_id

    return False


def violations_require_evidence(violations: list[dict]) -> bool:
    """Return True if the current snapshot should be stored as evidence."""
    if not violations:
        return False

    for v in violations:
        try:
            if int(v.get("severity", 0)) >= EVIDENCE_MIN_SEVERITY:
                return True
        except Exception:
            # If malformed, be conservative and avoid storing evidence.
            continue

    return False


def upload_to_imagekit(image_bytes: bytes, file_name: str, folder: str) -> str | None:
    if not settings.IMAGEKIT_PRIVATE_KEY or not settings.IMAGEKIT_PUBLIC_KEY or not settings.IMAGEKIT_URL_ENDPOINT:
        return None
    imagekit = ImageKit(
        public_key=settings.IMAGEKIT_PUBLIC_KEY,
        private_key=settings.IMAGEKIT_PRIVATE_KEY,
        url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
    )
    try:
        result = imagekit.upload(
            file=image_bytes,
            file_name=file_name,
            options={
                "folder": folder,
                "use_unique_file_name": True,
            },
        )
        return result.url
    except Exception as exc:
        logger.error(f"ImageKit upload failed: {exc}")
        return None


class ProctoringViewSet(viewsets.ViewSet):
    """
    ViewSet for proctoring operations during exams.
    Uses YOLOv8 for person/phone detection (free, local).
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @action(detail=False, methods=["post"], url_path="register-face")
    def register_face(self, request):
        """
        Register student's face before exam.
        Validates clarity using Gemini.
        """
        serializer = FaceRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        image = serializer.validated_data["image"]
        user = request.user
        
        if user.role != User.Role.STUDENT:
            return Response(
                {"error": "Only students can register their face"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify face using Gemini (Lightweight check)
        try:
            image.seek(0)
            image_bytes = image.read()
            # Perform quick analysis
            analysis = analyze_snapshot_with_gemini(image_bytes)
            
            if analysis["faces_detected"] == 0:
                return Response(
                    {"error": "No face detected. Please ensure your face is clearly visible."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if analysis["faces_detected"] > 1:
                return Response(
                     {"error": "Multiple faces detected. Please be alone in the frame."},
                     status=status.HTTP_400_BAD_REQUEST
                )

            # Quality score (just basic assumption if recognized)
            quality_score = 0.9 if analysis["faces_detected"] == 1 else 0.0

        except Exception as e:
            logger.error(f"Face registration analysis failed: {e}")
            return Response(
                {"error": "Failed to analyze image quality. Please try again."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Deactivate previous
        StudentFaceReference.objects.filter(student=user, is_active=True).update(is_active=False)
        
        # Save new
        face_ref = StudentFaceReference.objects.create(
            student=user,
            image=image,
            is_active=True,
            quality_score=quality_score,
            # face_encoding remains null as we use GenAI verification now
        )
        
        logger.info(f"Face registered for student {user.id}")
        
        return Response({
            "message": "Face registered successfully",
            "face_reference_id": str(face_ref.id),
            "quality_score": quality_score,
        })

    @action(detail=False, methods=["get"], url_path="face-status")
    def face_status(self, request):
        user = request.user
        face_ref = StudentFaceReference.objects.filter(student=user, is_active=True).first()
        return Response({
            "face_registered": face_ref is not None,
            "registered_at": face_ref.captured_at if face_ref else None,
            "quality_score": face_ref.quality_score if face_ref else None,
        })

    @action(detail=False, methods=["post"], url_path="snapshot")
    def upload_snapshot(self, request):
        serializer = ProctoringSnapshotUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        session_id = serializer.validated_data["session_id"]
        image = serializer.validated_data["image"]
        motion_score = serializer.validated_data.get("motion_score", 0.0)
        
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        # Reject snapshots from terminated/submitted sessions
        if session.status in [ExamSession.SessionStatus.TERMINATED, ExamSession.SessionStatus.SUBMITTED]:
            return Response({
                "error": "Session already ended",
                "is_terminated": True,
                "session_status": session.status
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Settings
        try:
            proctor_settings = session.assessment.proctoring_settings
            if not proctor_settings.enabled:
                return Response({"error": "Proctoring is disabled for this assessment."}, status=status.HTTP_400_BAD_REQUEST)
            settings_dict = {
                "detect_no_face": proctor_settings.detect_no_face,
                "detect_multiple_faces": proctor_settings.detect_multiple_faces,
                "detect_looking_away": proctor_settings.detect_looking_away,
                "detect_objects": proctor_settings.detect_objects,
                "require_face_verification": proctor_settings.require_face_verification,
                "face_verification_interval": proctor_settings.face_verification_interval,
                "use_confidence_scoring": proctor_settings.use_confidence_scoring,
                "min_confidence_threshold": proctor_settings.min_confidence_threshold,
                "enable_temporal_analysis": proctor_settings.enable_temporal_analysis,
                "temporal_window_size": proctor_settings.temporal_window_size,
            }
            max_violations = proctor_settings.max_violations_before_terminate
        except ProctoringSettings.DoesNotExist:
            settings_dict = {}
            max_violations = 10
        
        # Get reference image file if needed
        reference_image_file = None
        if settings_dict.get("require_face_verification"):
            face_ref = StudentFaceReference.objects.filter(student=request.user, is_active=True).first()
            if face_ref and face_ref.image:
                reference_image_file = face_ref.image

        # Read bytes once (used for evidence upload if we decide to store this snapshot)
        image.seek(0)
        image_bytes = image.read()
        
        # Analyze
        # Pass the image and reference (if any)
        analysis_result = analyze_snapshot(
            image,
            session_id=str(session_id),
            settings_config=settings_dict,
            reference_image_file=reference_image_file
        )
        
        # Results are already keyed by 'analysis_result' and 'violations' from analyze_snapshot return
        
        if "error" in analysis_result:
             # Even if error, we might return success but log it, or partial
             logger.error(f"Analysis error: {analysis_result['error']}")
             # We rely on the services.py to handle fallback, so this might be a structural error
             analysis_data = {}
             violations = []
        else:
             analysis_data = analysis_result.get("analysis_result", {})
             violations = analysis_result.get("violations", [])

        # Decide whether to STORE this snapshot as evidence (privacy-friendly):
        # - We always analyze to enforce rules, but only persist an image when the violations are severe.
        now = timezone.now()
        last_snapshot = ProctoringSnapshot.objects.filter(session=session, is_violation=True).order_by("-captured_at").first()
        in_cooldown = bool(
            last_snapshot and (now - last_snapshot.captured_at) < timedelta(seconds=EVIDENCE_COOLDOWN_SECONDS)
        )
        evidence_saved = (not in_cooldown) and violations_require_evidence(violations)

        snapshot = None
        if evidence_saved:
            snapshot = ProctoringSnapshot.objects.create(
                session=session,
                motion_score=motion_score,
            )

            # Upload to ImageKit (cloud storage). If upload fails, fall back to local storage.
            try:
                folder = f"/proctoring/snapshots/{session.assessment_id}"
                image_url = upload_to_imagekit(image_bytes, f"{snapshot.id}.jpg", folder)
                if image_url:
                    snapshot.image_url = image_url
                else:
                    snapshot.image.save(f"{snapshot.id}.jpg", ContentFile(image_bytes), save=False)
            except Exception as exc:
                logger.error(f"Failed to store evidence snapshot: {exc}")
                snapshot.image.save(f"{snapshot.id}.jpg", ContentFile(image_bytes), save=False)

            # Persist analysis summary on the evidence snapshot
            gaze = analysis_data.get("gaze_result") or {}
            face_ver = analysis_data.get("face_verification") or {}

            snapshot.analysis_result = analysis_data
            snapshot.faces_detected = analysis_data.get("faces_detected", 0)
            snapshot.gaze_direction = gaze.get("direction", "unknown")
            snapshot.gaze_yaw = gaze.get("yaw", 0.0)
            snapshot.gaze_pitch = gaze.get("pitch", 0.0)
            snapshot.face_verified = face_ver.get("is_match", True)
            snapshot.face_verification_confidence = face_ver.get("confidence", 0.0)
            snapshot.is_violation = True
            snapshot.processed = True
            snapshot.save()

            logger.info(
                "[Proctoring] Evidence snapshot stored",
                extra={
                    "session_id": str(session_id),
                    "snapshot_id": str(snapshot.id),
                    "faces_detected": snapshot.faces_detected,
                    "gaze_direction": snapshot.gaze_direction,
                    "gaze_yaw": snapshot.gaze_yaw,
                    "gaze_pitch": snapshot.gaze_pitch,
                    "face_verified": snapshot.face_verified,
                    "violations_count": len(violations),
                    "violations": [v.get("type") for v in violations],
                    "motion_score": motion_score,
                },
            )
        else:
            logger.info(
                "[Proctoring] Snapshot analyzed (not stored)",
                extra={
                    "session_id": str(session_id),
                    "faces_detected": analysis_data.get("faces_detected", 0),
                    "violations_count": len(violations),
                    "violations": [v.get("type") for v in violations],
                    "motion_score": motion_score,
                },
            )

        gaze = analysis_data.get("gaze_result") or {}
        face_ver = analysis_data.get("face_verification") or {}
        
        # Save violations
        created_violations = []
        for v in violations:
            conf_data = v.get("confidence_score", {})
            # Handle float vs dict if scorer logic varies (services.py puts float in confidence_score key logic)
            # Actually services.py logic was: v["confidence_score"] = float
            
            # Per-type cooldown: don't create a new DB row for the same violation type every few seconds.
            vio_type = v["type"]
            recent_duplicate = ProctoringViolation.objects.filter(
                session=session,
                violation_type=vio_type,
                occurred_at__gte=now - timedelta(seconds=VIOLATION_TYPE_COOLDOWN_SECONDS),
                is_false_positive=False,
            ).exists()
            if recent_duplicate:
                continue

            vio_obj = ProctoringViolation.objects.create(
                session=session,
                snapshot=snapshot,
                violation_type=vio_type,
                severity=v["severity"],
                details=v["details"],
                confidence_score=v.get("confidence_score", 1.0),
                confidence_breakdown=v.get("confidence_breakdown", {}),
            )
            created_violations.append(vio_obj)

        # Notify teacher, HOD, and admin if violations detected
        # Keep notifications low-noise: only notify on severe violations or when evidence is saved.
        if created_violations and (evidence_saved or any(v.severity >= EVIDENCE_MIN_SEVERITY for v in created_violations)):
            from apps.notifications.services import NotificationService

            recipients = []
            if session.assessment.course.assigned_teacher_id:
                recipients.append(session.assessment.course.assigned_teacher_id)
            recipients += list(User.objects.filter(
                role=User.Role.HOD,
                department_id=session.assessment.course.department_id,
                is_active=True,
            ).values_list("id", flat=True))
            recipients += list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))
            NotificationService.send_bulk_notification(
                user_ids=set(recipients),
                subject="Proctoring Violation Detected",
                body=f"Violation detected for {session.student.email} in '{session.assessment.title}'.",
                metadata={
                    "session_id": str(session.id),
                    "assessment_id": str(session.assessment.id),
                    "course_id": str(session.assessment.course.id),
                    "action": "proctoring_violation",
                },
            )

        total_violations = ProctoringViolation.objects.filter(session=session, is_false_positive=False).count()
        
        # Auto-terminate if violations exceeded threshold
        is_terminated = False
        if total_violations >= max_violations and session.status == ExamSession.SessionStatus.IN_PROGRESS:
            session.status = ExamSession.SessionStatus.TERMINATED
            session.ended_at = timezone.now()
            session.save(update_fields=["status", "ended_at", "updated_at"])
            is_terminated = True
            
            # Create notification for student
            from apps.notifications.services import NotificationService

            NotificationService.send_notification(
                user_id=session.student_id,
                subject="Exam Auto-Terminated",
                body=f"Your exam '{session.assessment.title}' was automatically terminated due to exceeding the allowed violations limit ({max_violations}).",
                metadata={
                    "assessment_id": str(session.assessment.id),
                    "session_id": str(session.id),
                    "reason": "violations_exceeded",
                    "total_violations": total_violations,
                },
            )
            logger.info(f"Session {session.id} auto-terminated due to violations: {total_violations}/{max_violations}")
        
        return Response({
            "snapshot_id": str(snapshot.id) if snapshot else None,
            "evidence_saved": evidence_saved,
            "faces_detected": analysis_data.get("faces_detected", 0),
            "gaze_result": gaze,
            "face_verified": face_ver.get("is_match", True),
            "face_verification_confidence": face_ver.get("confidence", 0.0),
            "violations": ProctoringViolationSerializer(created_violations, many=True).data,
            "total_violations": total_violations,
            "is_terminated": is_terminated,
            "violations_exceeded": total_violations >= max_violations
        })

    # ... Keep other methods (session_status, etc) same or minimal update ...
    # IMPORTANT: Since I am replacing the WHOLE file content, I must ensure I don't lose the other methods.
    # The 'ReplacementContent' below must include the other methods.
    
    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/status")
    def session_status(self, request, session_id=None):
        try: 
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist: 
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if not user_can_view_session_proctoring(request.user, session):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
            
        violations = ProctoringViolation.objects.filter(session=session, is_false_positive=False)
        violation_counts = violations.values("violation_type").annotate(count=Count("id"))
        
        face_registered = StudentFaceReference.objects.filter(student=session.student, is_active=True).exists()
        
        return Response({
            "session_id": str(session_id),
            "total_snapshots": ProctoringSnapshot.objects.filter(session=session).count(),
            "total_violations": violations.count(),
            "violation_counts": {v["violation_type"]: v["count"] for v in violation_counts},
            "is_terminated": session.status == ExamSession.SessionStatus.TERMINATED,
            "face_registered": face_registered,
            "latest_violation": ProctoringViolationSerializer(violations.first()).data if violations.exists() else None
        })

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/violations")
    def session_violations(self, request, session_id=None):
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_view_session_proctoring(request.user, session):
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        include_fp = request.query_params.get("include_false_positives", "false") == "true"
        qs = ProctoringViolation.objects.filter(session=session)
        if not include_fp: qs = qs.filter(is_false_positive=False)
        return Response(ProctoringViolationSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="session/(?P<session_id>[^/.]+)/violations")
    def create_violation(self, request, session_id=None):
        """
        Client-side assist: allow the student's browser to log a detected violation
        (e.g., audio talking, camera off). This records evidence for human review
        without immediately punishing the student beyond normal thresholds.
        """
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        # Only the student in this session can log client-side violations
        if session.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        violation_type = request.data.get("violation_type")
        severity = int(request.data.get("severity", 2))
        details = request.data.get("details") or {}
        snapshot_id = request.data.get("snapshot_id")

        snapshot = None
        if snapshot_id:
            try:
                snapshot = ProctoringSnapshot.objects.get(id=snapshot_id, session=session)
            except ProctoringSnapshot.DoesNotExist:
                snapshot = None

        v = ProctoringViolation.objects.create(
            session=session,
            snapshot=snapshot,
            violation_type=violation_type,
            severity=severity,
            details=details,
            confidence_score=float(details.get("confidence", 1.0)) if isinstance(details, dict) else 1.0,
        )

        return Response(
            {
                "violation_id": str(v.id),
                "violation_type": v.violation_type,
                "severity": v.severity,
                "occurred_at": v.occurred_at,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/snapshots")
    def session_snapshots(self, request, session_id=None):
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        if request.user.role == User.Role.STUDENT:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not user_can_view_session_proctoring(request.user, session):
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        qs = ProctoringSnapshot.objects.filter(session=session)
        if request.query_params.get("violations_only") == "true": qs = qs.filter(is_violation=True)
        return Response(ProctoringSnapshotSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="violation/(?P<violation_id>[^/.]+)/acknowledge")
    def acknowledge_violation(self, request, violation_id=None):
        try:
            v = ProctoringViolation.objects.get(id=violation_id)
        except ProctoringViolation.DoesNotExist:
            return Response({"error": "Violation not found"}, status=status.HTTP_404_NOT_FOUND)
        if v.session.student != request.user: return Response(status=status.HTTP_403_FORBIDDEN)
        v.acknowledged = True
        v.save()
        return Response({"message": "Acknowledged"})

    @action(detail=False, methods=["post"], url_path="violation/(?P<violation_id>[^/.]+)/review")
    def review_violation(self, request, violation_id=None):
        if request.user.role == User.Role.STUDENT:
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            v = ProctoringViolation.objects.get(id=violation_id)
        except ProctoringViolation.DoesNotExist:
            return Response({"error": "Violation not found"}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_view_session_proctoring(request.user, v.session):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = ViolationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v.is_false_positive = serializer.validated_data["is_false_positive"]
        v.review_notes = serializer.validated_data.get("review_notes", "")
        v.reviewed_by = request.user
        v.save()
        return Response({"message": "Reviewed"})

    @action(detail=False, methods=["post"], url_path="session/(?P<session_id>[^/.]+)/end")
    def end_session_proctoring(self, request, session_id=None):
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        if session.student != request.user: return Response(status=status.HTTP_403_FORBIDDEN)
        clear_temporal_analyzer(str(session_id))
        return Response({"message": "Ended"})

    @action(detail=False, methods=["post"], url_path="recording/upload")
    def upload_recording(self, request):
        """Upload video recording for a session."""
        from .models import SessionRecording
        
        session_id = request.data.get("session_id")
        video_file = request.FILES.get("video")
        duration = request.data.get("duration", 0)
        
        if not session_id or not video_file:
            return Response(
                {"error": "session_id and video file are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        if session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        # Create or update recording
        recording, _created = SessionRecording.objects.get_or_create(
            session=session,
            defaults={"upload_status": SessionRecording.UploadStatus.UPLOADING}
        )

        try:
            recording.video_file = video_file
            recording.file_size_bytes = video_file.size
            recording.duration_seconds = int(duration)
            recording.upload_status = SessionRecording.UploadStatus.COMPLETE
            recording.save()

            logger.info(f"Recording uploaded for session {session_id}")

            return Response({
                "recording_id": str(recording.id),
                "status": "complete",
                "file_size": recording.file_size_bytes,
                "duration": recording.duration_seconds,
            })
        except Exception as e:
            recording.mark_failed(str(e))
            logger.error(f"Failed to save recording: {e}")
            return Response(
                {"error": "Failed to save recording"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["post"], url_path="video-clip")
    def upload_video_clip(self, request):
        """
        Upload a short video clip captured only when suspicious activity is detected.

        This intentionally does NOT store a full exam recording.
        """
        session_id = request.data.get("session_id")
        video_file = request.FILES.get("video")
        trigger_reason = (request.data.get("trigger_reason") or ProctoringVideoClip.TriggerReason.OTHER).strip()
        duration = request.data.get("duration", 30)
        severity = request.data.get("severity", 1)
        trigger_description = request.data.get("trigger_description", "")

        if not session_id or not video_file:
            return Response(
                {"error": "session_id and video file are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            session = ExamSession.objects.select_related("assessment", "assessment__course").get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        if session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        # Normalize trigger reason
        allowed_reasons = {c[0] for c in ProctoringVideoClip.TriggerReason.choices}
        if trigger_reason not in allowed_reasons:
            trigger_reason = ProctoringVideoClip.TriggerReason.OTHER

        try:
            duration_int = int(duration)
        except Exception:
            duration_int = 30

        try:
            severity_int = int(severity)
        except Exception:
            severity_int = 1

        clip = ProctoringVideoClip.objects.create(
            session=session,
            trigger_reason=trigger_reason,
            trigger_description=str(trigger_description or ""),
            duration_seconds=max(1, duration_int),
            file_size_bytes=getattr(video_file, "size", 0) or 0,
            severity=max(1, min(5, severity_int)),
        )

        # Upload to ImageKit (cloud) when configured; otherwise store locally.
        try:
            file_bytes = video_file.read()
            folder = f"/proctoring/clips/{session.assessment_id}"
            video_url = upload_to_imagekit(file_bytes, f"{clip.id}.webm", folder)
            if video_url:
                clip.video_url = video_url
            else:
                clip.video_file.save(f"{clip.id}.webm", ContentFile(file_bytes), save=False)
        except Exception as exc:
            logger.error(f"Failed to store video clip: {exc}")
            try:
                # Fall back to file storage directly
                clip.video_file = video_file
            except Exception:
                pass

        clip.save()

        # Notify teacher/HOD/admin (high priority when severe)
        try:
            if session.assessment.course and session.assessment.course.department_id:
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
                recipients += list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("id", flat=True))

                if recipients:
                    from apps.notifications.services import NotificationService

                    NotificationService.send_bulk_notification(
                        user_ids=set(recipients),
                        subject="Proctoring Evidence Clip",
                        body=f"Evidence clip uploaded for {session.student.email} in '{session.assessment.title}'.",
                        metadata={
                            "session_id": str(session.id),
                            "assessment_id": str(session.assessment.id),
                            "course_id": str(course.id),
                            "clip_id": str(clip.id),
                            "trigger_reason": clip.trigger_reason,
                            "severity": clip.severity,
                            "action": "proctoring_clip",
                        },
                    )
        except Exception:
            # Never block the exam session due to notification errors.
            pass

        # Ensure API returns an accessible URL for local storage.
        data = ProctoringVideoClipSerializer(clip, context={"request": request}).data
        if not data.get("video_url") and clip.video_file:
            data["video_url"] = request.build_absolute_uri(clip.video_file.url)
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/video-clips")
    def list_video_clips(self, request, session_id=None):
        """List video clips for a session (teacher/HOD/admin only)."""
        try:
            session = ExamSession.objects.select_related("assessment", "assessment__course").get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == User.Role.STUDENT:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        if not user_can_view_session_proctoring(request.user, session):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        clips = ProctoringVideoClip.objects.filter(session=session).order_by("-created_at")
        serialized = ProctoringVideoClipSerializer(clips, many=True, context={"request": request}).data

        # Fill local URLs when video_url is empty.
        by_id = {str(c.id): c for c in clips}
        for item in serialized:
            cid = str(item.get("id") or "")
            c = by_id.get(cid)
            if c and not item.get("video_url") and c.video_file:
                item["video_url"] = request.build_absolute_uri(c.video_file.url)

        return Response({"results": serialized, "count": clips.count()})

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/recording")
    def get_session_recording(self, request, session_id=None):
        """Get recording info for a session (teachers only)."""
        from .models import SessionRecording
        
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if request.user.role == User.Role.STUDENT:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        # Only allow scoped viewers (assigned teacher, HOD for department, admin).
        if not user_can_view_session_proctoring(request.user, session):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            recording = SessionRecording.objects.get(session=session)
            video_url = None
            if recording.video_file:
                video_url = request.build_absolute_uri(recording.video_file.url)
            
            return Response({
                "recording_id": str(recording.id),
                "video_url": video_url,
                "duration_seconds": recording.duration_seconds,
                "file_size_bytes": recording.file_size_bytes,
                "upload_status": recording.upload_status,
                "created_at": recording.created_at.isoformat(),
            })
        except SessionRecording.DoesNotExist:
            return Response({
                "recording_id": None,
                "video_url": None,
                "message": "No recording available"
            })

