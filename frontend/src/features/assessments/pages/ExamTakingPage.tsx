import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Button,
    Typography,
    Radio,
    Input,
    Space,
    Modal,
    message,
    Spin,
    Statistic,
    Alert,
    Divider,
    Result,
    Checkbox,
    Tooltip,
} from 'antd';
import {
    FullscreenOutlined,
    FullscreenExitOutlined,
    StopOutlined,
    CameraOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import { useAssessment, useSubmitAssessmentWork, useStartExamSession, useReportCheating } from '../../../api/assessments';
import type { CheatingLog } from '../../../api/assessments';
import WebcamProctor from '../../../components/WebcamProctor';
import type { WebcamProctorHandle } from '../../../components/WebcamProctor';
import FaceRegistrationModal, { useFaceRegistrationRequired } from '../../../components/FaceRegistrationModal';
import { useVideoRecording } from '../../../hooks/useVideoRecording';
import { useUploadVideoClip, useCreateClientViolation } from '../../../api/proctoring';
import type { ProctoringViolation } from '../../../api/proctoring';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Countdown } = Statistic;

const MAX_WARNINGS = 3;

const ExamTakingPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: assessment, isLoading, refetch: refetchAssessment } = useAssessment(id!);
    const submitMutation = useSubmitAssessmentWork();
    const startSessionMutation = useStartExamSession();
    const uploadVideoClipMutation = useUploadVideoClip();
    const reportCheatingMutation = useReportCheating();
    const createClientViolation = useCreateClientViolation();

    const [answers, setAnswers] = useState<(number | string | null)[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cheatingAttempts, setCheatingAttempts] = useState(0);
    const [examStarted, setExamStarted] = useState(false);
    const [examCancelled, setExamCancelled] = useState(false);
    const [deadline, setDeadline] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [proctoringConsent, setProctoringConsent] = useState(false);
    const [proctoringViolations, setProctoringViolations] = useState(0);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [startingSession, setStartingSession] = useState(false);
    const [showFaceRegistration, setShowFaceRegistration] = useState(false);
    const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
    const [lastViolationReason, setLastViolationReason] = useState<string>('');

    const containerRef = useRef<HTMLDivElement>(null);
    const isSubmittingRef = useRef(false);
    const webcamRef = useRef<WebcamProctorHandle>(null);
    const answersRef = useRef<(number | string | null)[]>([]);

    // Keep answersRef in sync with answers state
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    // Video recording hook
    const { startRecording, stopRecording, isRecording } = useVideoRecording();

    // Evidence-only clip recording (30s) - triggered only on severe violations.
    const clipTriggerRef = useRef<{ reason: string; severity: number } | null>(null);
    const clipStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopAndUploadEvidenceClipIfNeeded = useCallback(async () => {
        if (!isRecording || !sessionId) return;

        if (clipStopTimerRef.current) {
            clearTimeout(clipStopTimerRef.current);
            clipStopTimerRef.current = null;
        }

        const trigger = clipTriggerRef.current || { reason: 'OTHER', severity: 1 };
        clipTriggerRef.current = null;

        try {
            const recordingResult = await stopRecording();
            if (!recordingResult) return;

            try {
                await uploadVideoClipMutation.mutateAsync({
                    sessionId,
                    videoBlob: recordingResult.blob,
                    duration: recordingResult.duration,
                    triggerReason: trigger.reason,
                    severity: trigger.severity,
                });
            } catch (uploadError) {
                console.error('Failed to upload evidence clip:', uploadError);
                // Never block exam submission/termination due to evidence upload failures.
            }
        } catch (err) {
            console.error('Failed to stop evidence clip recording:', err);
        }
    }, [isRecording, sessionId, stopRecording, uploadVideoClipMutation]);

    const startEvidenceClip = useCallback(
        (reason: string, severity: number) => {
            if (!sessionId) return;
            if (isRecording) return; // only one clip at a time

            const stream = webcamRef.current?.getStream();
            if (!stream) return;

            clipTriggerRef.current = { reason, severity };

            const started = startRecording(stream);
            if (!started) {
                clipTriggerRef.current = null;
                return;
            }

            if (clipStopTimerRef.current) clearTimeout(clipStopTimerRef.current);
            clipStopTimerRef.current = setTimeout(() => {
                void stopAndUploadEvidenceClipIfNeeded();
            }, 30000);
        },
        [isRecording, sessionId, startRecording, stopAndUploadEvidenceClipIfNeeded]
    );

    // Check if face registration is required
    const {
        isRequired: isFaceRegistrationRequired,
        isLoading: isLoadingFaceStatus
    } = useFaceRegistrationRequired(
        !!(assessment as any)?.proctoring_settings?.require_face_verification
    );

    // Restore resume state (deadline/session/consent) from localStorage
    useEffect(() => {
        if (!id) return;

        const storedCancelled = localStorage.getItem(`exam_cancelled_${id}`);
        if (storedCancelled === 'true') {
            setExamCancelled(true);
            setExamStarted(true);
            return;
        }

        const storedConsent = localStorage.getItem(`exam_consent_${id}`);
        if (storedConsent === 'true') {
            setProctoringConsent(true);
        }

        const storedSessionId = localStorage.getItem(`exam_session_${id}`);
        if (storedSessionId) {
            setSessionId(storedSessionId);
        }

        const storedEndTime = localStorage.getItem(`exam_end_${id}`);
        if (storedEndTime) {
            const endTimestamp = parseInt(storedEndTime, 10);
            if (!Number.isNaN(endTimestamp) && endTimestamp > Date.now()) {
                setDeadline(endTimestamp);
                setExamStarted(true);
            } else if (!Number.isNaN(endTimestamp)) {
                setDeadline(Date.now());
            }
        }
    }, [id]);

    // Keep answers array aligned with question count without overwriting existing answers
    useEffect(() => {
        const qLen = assessment?.questions?.length ?? 0;
        if (!qLen) return;

        setAnswers((prev) => {
            if (prev.length === qLen) return prev;
            return new Array(qLen).fill(null);
        });
    }, [assessment?.questions?.length]);

    // Anti-cheating: Visibility Change & Blur
    useEffect(() => {
        if (!examStarted || examCancelled || isSubmittingRef.current) return;

        const handleVisibilityChange = () => {
            if (document.hidden && !isSubmittingRef.current) {
                handleCheatingAttempt('TAB_SWITCH', 'Tab switching detected!');
            }
        };

        const handleBlur = () => {
            if (!isSubmittingRef.current) {
                handleCheatingAttempt('BLUR', 'Window focus lost!');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [examStarted, examCancelled]);

    const handleCheatingAttempt = useCallback((incidentType: CheatingLog['incident_type'], reason: string) => {
        if (examCancelled || isSubmittingRef.current || autoSubmitTriggered) return;

        setLastViolationReason(reason);

        if (sessionId) {
            reportCheatingMutation.mutate({
                sessionId,
                incidentType,
                details: { reason },
            });
        }

        setCheatingAttempts((prevCount) => {
            const newCount = prevCount + 1;
            console.log(`[ExamTakingPage] Cheating attempt detected: ${newCount}/${MAX_WARNINGS}`);

            if (newCount >= MAX_WARNINGS) {
                // Trigger auto-submit via useEffect
                setAutoSubmitTriggered(true);
            } else {
                // Escalating UX: toast then modal
                if (newCount === 1) {
                    message.warning(`Warning ${newCount}/${MAX_WARNINGS}: ${reason}`);
                } else {
                    Modal.warning({
                        title: newCount === 2 ? 'Final Warning' : 'Warning',
                        content: (
                            <div>
                                <p>{reason}</p>
                                <p>You must stay in fullscreen, avoid tab switching, window switching, or copy/paste.</p>
                                <p style={{ color: 'red', fontWeight: 'bold' }}>
                                    Warning {newCount} of {MAX_WARNINGS} – at 3 your exam will auto-submit.
                                </p>
                            </div>
                        ),
                        okText: 'I Understand',
                    });
                }
            }

            return newCount;
        });
    }, [examCancelled, autoSubmitTriggered, reportCheatingMutation, sessionId]);

    // Anti-cheating: Fullscreen exit (ESC) detection
    useEffect(() => {
        if (!examStarted || examCancelled || isSubmittingRef.current) return;

        const handleFullscreenChange = () => {
            const nowFullscreen = !!document.fullscreenElement;
            setIsFullscreen(nowFullscreen);
            if (!nowFullscreen && !isSubmittingRef.current) {
                handleCheatingAttempt('FULLSCREEN_EXIT', 'Fullscreen exited! Please return to fullscreen.');
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [examStarted, examCancelled, handleCheatingAttempt]);

    // Anti-cheating: block common shortcuts, right-click, and selection
    useEffect(() => {
        if (!examStarted || examCancelled) return;

        const blockedCombos = [
            { key: 'c', ctrl: true },
            { key: 'v', ctrl: true },
            { key: 'a', ctrl: true },
            { key: 'p', ctrl: true },
            { key: 's', ctrl: true },
            { key: 'u', ctrl: true },
            { key: 'i', ctrl: true, shift: true },
            { key: 'f12' },
            { key: 'escape' },
        ];

        const handleKeyDown = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            const hit = blockedCombos.some(
                combo =>
                    k === combo.key &&
                    (!!combo.ctrl === e.ctrlKey || combo.ctrl === undefined) &&
                    (!!combo.shift === e.shiftKey || combo.shift === undefined)
            );
            if (hit) {
                e.preventDefault();
                handleCheatingAttempt('COPY_PASTE', 'Blocked keyboard shortcut detected');
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            handleCheatingAttempt('COPY_PASTE', 'Right-click/context menu is disabled during the exam');
        };

        const handleSelectStart = (e: Event) => {
            e.preventDefault();
        };

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('contextmenu', handleContextMenu, { capture: true });
        document.addEventListener('selectstart', handleSelectStart, { capture: true });

        return () => {
            document.removeEventListener('keydown', handleKeyDown, { capture: true });
            document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
            document.removeEventListener('selectstart', handleSelectStart, { capture: true });
        };
    }, [examStarted, examCancelled, handleCheatingAttempt]);

    // Effect to handle auto-submit when warnings exceed limit
    useEffect(() => {
        if (!autoSubmitTriggered || isSubmittingRef.current || !assessment) return;

        const performAutoSubmit = async () => {
            isSubmittingRef.current = true;
            setSubmitting(true);

            Modal.error({
                title: 'Exam Auto-Submitted!',
                content: (
                    <div>
                        <p>You have exceeded the maximum number of allowed warnings ({MAX_WARNINGS}).</p>
                        <p style={{ color: 'red', fontWeight: 'bold' }}>
                            Reason: {lastViolationReason}
                        </p>
                        <p>Your exam is being automatically submitted.</p>
                    </div>
                ),
                okText: 'OK',
                centered: true,
            });

            try {
                await stopAndUploadEvidenceClipIfNeeded();

                // Use ref for current answers
                const currentAnswers = answersRef.current;
                const preparedAnswers = currentAnswers.map((answer, idx) => {
                    const question = assessment?.questions?.[idx];
                    if (answer === null) {
                        return question?.type === 'SUBJECTIVE' ? '' : -1;
                    }
                    return answer;
                });

                console.log('[ExamTakingPage] Auto-submitting exam with answers:', preparedAnswers);

                await submitMutation.mutateAsync({
                    assessmentId: assessment.id,
                    answers: preparedAnswers,
                });

                message.warning('Exam auto-submitted due to excessive violations.');
                localStorage.removeItem(`exam_end_${id}`);
                localStorage.removeItem(`exam_cancelled_${id}`);
                localStorage.removeItem(`exam_session_${id}`);
                localStorage.removeItem(`exam_consent_${id}`);

                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
                navigate('/dashboard/assessments');
            } catch (error: any) {
                console.error('[ExamTakingPage] Auto-submit error:', error);
                message.error('Failed to auto-submit: ' + (error.response?.data?.detail || error.message));
                isSubmittingRef.current = false;
                setSubmitting(false);
                setAutoSubmitTriggered(false);
            }
        };

        performAutoSubmit();
    }, [autoSubmitTriggered, assessment, submitMutation, id, navigate, lastViolationReason]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch((err) => {
                message.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    };

    // Handle proctoring violation from webcam
    const handleProctoringViolation = useCallback((violation: ProctoringViolation) => {
        setProctoringViolations((prev) => prev + 1);

        // Record a short evidence clip only when a severe violation is detected.
        if (violation.severity >= 4) {
            startEvidenceClip(violation.violation_type, violation.severity);
        }
    }, [startEvidenceClip]);

    // Client-side AI flag (audio, camera off, etc.)
    const handleClientFlag = useCallback(
        (violationType: ProctoringViolation['violation_type'], details?: Record<string, unknown>) => {
            if (!sessionId) return;
            createClientViolation.mutate({
                sessionId,
                violationType,
                severity: 2,
                details: {
                    ...(details || {}),
                    client_timestamp: new Date().toISOString(),
                },
            });
        },
        [createClientViolation, sessionId]
    );

    // Handle exam termination from proctoring (violations exceeded)
    const handleExamTerminated = useCallback(async () => {
        await stopAndUploadEvidenceClipIfNeeded();

        // Clear local storage and navigate away
        localStorage.removeItem(`exam_end_${id}`);
        localStorage.removeItem(`exam_cancelled_${id}`);
        localStorage.removeItem(`exam_session_${id}`);
        localStorage.removeItem(`exam_consent_${id}`);
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        navigate('/dashboard/assessments');
    }, [id, navigate, stopAndUploadEvidenceClipIfNeeded]);

    // Start exam
    const startExam = async () => {
        if (!proctoringConsent) {
            message.warning('Please consent to webcam proctoring to start the exam.');
            return;
        }

        if (isLoadingFaceStatus) return;

        // Check for face registration
        if (isFaceRegistrationRequired) {
            setShowFaceRegistration(true);
            return;
        }

        // Best-effort: enter fullscreen immediately while we still have a user gesture.
        if (!document.fullscreenElement) {
            document.documentElement
                .requestFullscreen()
                .then(() => setIsFullscreen(true))
                .catch((err) => message.error(`Error attempting to enable fullscreen: ${err.message}`));
        }

        setStartingSession(true);

        try {
            // Call backend to start/resume exam session
            const session = await startSessionMutation.mutateAsync(id!);

            // Set real session ID for proctoring
            setSessionId(session.id);
            localStorage.setItem(`exam_session_${id}`, session.id);
            localStorage.setItem(`exam_consent_${id}`, 'true');

            // Use server-provided deadline for accurate timing
            const serverDeadline = new Date(session.server_deadline).getTime();
            setDeadline(serverDeadline);
            localStorage.setItem(`exam_end_${id}`, serverDeadline.toString());

            // Clear any previous cancelled state
            localStorage.removeItem(`exam_cancelled_${id}`);

            // Pull questions after session starts (backend locks questions until session is active)
            const refreshed = await refetchAssessment();
            const questionCount = refreshed.data?.questions?.length ?? 0;

            // Restore saved answers if resuming session; otherwise initialize answers to match question count
            if (session.saved_answers?.length) {
                setAnswers(session.saved_answers);
            } else if (questionCount > 0) {
                setAnswers(new Array(questionCount).fill(null));
            }

            setExamStarted(true);
        } catch (error: any) {
            console.error('Failed to start exam session:', error);
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.[0] ||
                'Failed to start exam. Please try again.';
            message.error(errorMessage);
        } finally {
            setStartingSession(false);
        }
    };

    const handleAnswerChange = (index: number, value: number | string) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = useCallback(async () => {
        if (!assessment || submitting || isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setSubmitting(true);

        try {
            await stopAndUploadEvidenceClipIfNeeded();

            // Prepare answers - ensure all questions have an answer
            const preparedAnswers = answers.map((answer, idx) => {
                const question = assessment.questions?.[idx];
                if (answer === null) {
                    // For unanswered MCQ, send -1 (will be marked wrong)
                    // For unanswered subjective, send empty string
                    return question?.type === 'SUBJECTIVE' ? '' : -1;
                }
                return answer;
            });

            console.log('Submitting exam with answers:', preparedAnswers);

            await submitMutation.mutateAsync({
                assessmentId: assessment.id,
                answers: preparedAnswers,
            });

            message.success('Exam submitted successfully!');

            // Clear local storage
            localStorage.removeItem(`exam_end_${id}`);
            localStorage.removeItem(`exam_cancelled_${id}`);
            localStorage.removeItem(`exam_session_${id}`);
            localStorage.removeItem(`exam_consent_${id}`);

            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            navigate('/dashboard/assessments');
        } catch (error: any) {
            console.error('Submission error:', error);
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.answers?.[0] ||
                JSON.stringify(error.response?.data) ||
                'Failed to submit exam';
            message.error(errorMessage);
            isSubmittingRef.current = false;
            setSubmitting(false);
        }
    }, [assessment, submitting, answers, submitMutation, id, navigate, stopAndUploadEvidenceClipIfNeeded]);

    if (isLoading || !assessment) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Loading Exam...">
                    <div style={{ width: 1, height: 1 }} />
                </Spin>
            </div>
        );
    }

    // Show cancelled state
    if (examCancelled) {
        const handleResetExam = () => {
            localStorage.removeItem(`exam_cancelled_${id}`);
            localStorage.removeItem(`exam_end_${id}`);
            localStorage.removeItem(`exam_session_${id}`);
            localStorage.removeItem(`exam_consent_${id}`);
            setExamCancelled(false);
            setExamStarted(false);
            setCheatingAttempts(0);
            setProctoringViolations(0);
        };

        return (
            <div style={{ maxWidth: 600, margin: '100px auto' }}>
                <Result
                    status="error"
                    icon={<StopOutlined />}
                    title="Exam Cancelled"
                    subTitle="Your exam has been cancelled due to multiple violations of exam rules."
                    extra={[
                        <Button type="primary" key="back" onClick={() => navigate('/dashboard/assessments')}>
                            Return to Assessments
                        </Button>,
                        <Button key="reset" onClick={handleResetExam}>
                            Reset & Try Again
                        </Button>,
                    ]}
                />
            </div>
        );
    }


    if (!examStarted) {
        const startsAt = assessment.scheduled_at ? new Date(assessment.scheduled_at) : null;
        const endsAt = (assessment as any).ends_at ? new Date((assessment as any).ends_at) : null;
        const closesAt = assessment.closes_at ? new Date(assessment.closes_at) : null;
        const fmt = (d: Date | null) => (d ? d.toLocaleString() : '-');

        return (
            <div style={{ maxWidth: 600, margin: '100px auto', textAlign: 'center' }}>
                <Card>
                    <Title level={2}>{assessment.title}</Title>
                    <Paragraph>{assessment.description}</Paragraph>
                    <Divider />
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        {assessment.instructions && (
                            <Alert
                                message="Instructions"
                                description={
                                    <div style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                                        {assessment.instructions}
                                    </div>
                                }
                                type="info"
                                showIcon
                            />
                        )}
                        <Alert
                            message="Exam Window (Server-validated)"
                            description={
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ marginBottom: 8 }}>
                                        Times are enforced by the server (changing your device clock won't extend the exam).
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                        <li>Starts: {fmt(startsAt)}</li>
                                        <li>Ends: {fmt(endsAt)}</li>
                                        <li>Closes (with grace): {fmt(closesAt)}</li>
                                    </ul>
                                </div>
                            }
                            type="success"
                            showIcon
                        />
                        <Alert
                            message="Exam Rules"
                            description={
                                <ul style={{ textAlign: 'left' }}>
                                    <li>You must stay in fullscreen mode.</li>
                                    <li>Do not switch tabs or open other applications.</li>
                                    <li><strong>After {MAX_WARNINGS} warnings, your exam may be auto-submitted or cancelled.</strong></li>
                                    <li>Duration: {assessment.duration_minutes} minutes.</li>
                                </ul>
                            }
                            type="warning"
                            showIcon
                        />
                        <Alert
                            message={
                                <Space>
                                    <CameraOutlined />
                                    <span>Webcam Proctoring Required</span>
                                </Space>
                            }
                            description={
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ marginBottom: 8 }}>
                                        This exam uses webcam monitoring to help protect academic integrity.
                                        <Tooltip title="We aim to minimize data collection and capture evidence only when thresholds are exceeded.">
                                            <InfoCircleOutlined style={{ marginLeft: 8, color: 'var(--muted-ink)' }} />
                                        </Tooltip>
                                    </p>
                                    <ul>
                                        <li>Your webcam may be active during the session.</li>
                                        <li>The system may detect face presence and basic head movement.</li>
                                        <li>Evidence snapshots are captured only when suspicious behavior crosses a threshold.</li>
                                        <li>Evidence is visible only to authorized staff (teacher/HOD/admin) and stored securely.</li>
                                        {isFaceRegistrationRequired && (
                                            <li><strong>Face registration is required before starting.</strong></li>
                                        )}
                                    </ul>
                                </div>
                            }
                            type="info"
                            showIcon
                        />
                        <div style={{ textAlign: 'left', padding: '12px', background: 'var(--surface-muted)', borderRadius: 8, border: '1px solid var(--stroke)' }}>
                            <Checkbox
                                checked={proctoringConsent}
                                onChange={(e) => setProctoringConsent(e.target.checked)}
                            >
                                I understand and consent to exam monitoring for integrity purposes. I understand that limited evidence (including snapshots) may be captured only when suspicious behavior is detected, and reviewed by authorized staff.
                            </Checkbox>
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            onClick={startExam}
                            block
                            disabled={!proctoringConsent || startingSession || isLoadingFaceStatus}
                            loading={startingSession || isLoadingFaceStatus}
                        >
                            {isFaceRegistrationRequired ? 'Register Face & Start Exam' : 'Start Exam'}
                        </Button>
                    </Space>
                </Card>

                <FaceRegistrationModal
                    open={showFaceRegistration}
                    onCancel={() => setShowFaceRegistration(false)}
                    onSuccess={() => {
                        setShowFaceRegistration(false);
                        startExam(); // Retry start after registration
                    }}
                />
            </div>
        );
    }


    return (
        <div
            ref={containerRef}
            style={{
                padding: 24,
                background: 'var(--surface-muted)',
                minHeight: '100vh',
                userSelect: 'none'
            }}
        >
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header with Timer and Controls */}
                <Card style={{ marginBottom: 24, position: 'sticky', top: 24, zIndex: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>{assessment.title}</Title>
                            <Text type="secondary">Total Marks: {assessment.total_marks}</Text>
                        </div>
                        <Space size="large" wrap>
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Time Remaining</Text>
                                <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                                    <Countdown
                                        value={deadline}
                                        format="HH:mm:ss"
                                        onFinish={handleSubmit}
                                    />
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Warnings</Text>
                                <div style={{
                                    fontSize: 24,
                                    fontWeight: 'bold',
                                    color: cheatingAttempts >= 2 ? 'red' : cheatingAttempts >= 1 ? 'orange' : 'green'
                                }}>
                                    {cheatingAttempts}/{MAX_WARNINGS}
                                </div>
                            </div>
                            {proctoringViolations > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>AI Violations</Text>
                                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                                        {proctoringViolations}
                                    </div>
                                </div>
                            )}
                            <Button
                                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                                onClick={toggleFullscreen}
                            >
                                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            </Button>
                        </Space>
                    </div>
                </Card>

                {/* Questions List */}
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {assessment.questions?.map((question: any, index: number) => (
                        <Card
                            key={index}
                            title={<Space><Text strong>{index + 1}.</Text><Text>{question.prompt}</Text></Space>}
                            extra={<Text type="secondary">({question.marks || 1} marks)</Text>}
                        >
                            {question.type === 'SUBJECTIVE' ? (
                                <TextArea
                                    rows={6}
                                    placeholder="Type your answer here..."
                                    value={answers[index] as string || ''}
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        handleCheatingAttempt('COPY_PASTE', 'Copy/paste attempt detected!');
                                    }}
                                />
                            ) : (
                                <Radio.Group
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    value={answers[index]}
                                >
                                    <Space direction="vertical">
                                        {question.options?.map((option: any, optIndex: number) => (
                                            <Radio key={optIndex} value={optIndex}>
                                                {option.text}
                                            </Radio>
                                        ))}
                                    </Space>
                                </Radio.Group>
                            )}
                        </Card>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, marginBottom: 48 }}>
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={examCancelled}
                        >
                            Submit Exam
                        </Button>
                    </div>
                </Space>
            </div>

            {/* Webcam Proctoring Component */}
            {sessionId && (
                <WebcamProctor
                    ref={webcamRef}
                    sessionId={sessionId}
                    snapshotIntervalSeconds={(assessment as any).proctoring_settings?.snapshot_interval_seconds || 10}
                    motionThreshold={(assessment as any).proctoring_settings?.motion_threshold || 30}
                    requireFaceVerification={!!(assessment as any).proctoring_settings?.require_face_verification}
                    onViolation={handleProctoringViolation}
                    onTerminated={handleExamTerminated}
                    enabled={examStarted && !examCancelled && !submitting}
                    onClientFlag={handleClientFlag}
                />
            )}
        </div>
    );
};

export default ExamTakingPage;
