import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Types
export interface GazeResult {
    yaw: number;
    pitch: number;
    is_looking_away: boolean;
    direction: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';
}

export interface ConfidenceBreakdown {
    detection_confidence: number;
    temporal_consistency: number;
    severity_weight: number;
    context_match: number;
}

export interface ConfidenceScore {
    overall_confidence: number;
    breakdown: ConfidenceBreakdown;
    is_reliable: boolean;
}

export interface ProctoringViolation {
    id: string;
    session: string;
    snapshot: string | null;
    violation_type:
    | 'NO_FACE'
    | 'MULTIPLE_FACES'
    | 'LOOKING_AWAY'
    | 'FACE_NOT_MATCHED'
    | 'AUDIO_TALKING'
    | 'CAMERA_OFF'
    | 'OBJECT_DETECTED'
    | 'PHONE_DETECTED'
    | 'BOOK_DETECTED'
    | 'LAPTOP_DETECTED'
    | 'PERSON_LEFT'
    | 'INTERMITTENT_FACE'
    | 'PERSISTENT_GAZE_AWAY'
    | 'MULTIPLE_PERSONS_PATTERN'
    | 'IDENTITY_MISMATCH_PATTERN';
    violation_type_display: string;
    severity: number;
    occurred_at: string;
    details: Record<string, unknown>;
    confidence_score: number;
    confidence_breakdown: ConfidenceBreakdown;
    acknowledged: boolean;
    is_false_positive: boolean;
    created_at: string;
}

export interface SnapshotUploadResponse {
    snapshot_id?: string | null;
    evidence_saved?: boolean;
    faces_detected: number;
    gaze_result: GazeResult | null;
    face_verified: boolean;
    face_verification_confidence: number;
    violations: ProctoringViolation[];
    total_violations: number;
    violations_exceeded: boolean;
    is_terminated: boolean;
}

export interface ProctoringStatus {
    session_id: string;
    total_snapshots: number;
    total_violations: number;
    violation_counts: Record<string, number>;
    is_terminated: boolean;
    face_registered: boolean;
    latest_violation: ProctoringViolation | null;
}

export interface FaceRegistrationResponse {
    message: string;
    face_reference_id: string;
    quality_score: number;
}

export interface FaceStatus {
    face_registered: boolean;
    registered_at: string | null;
    quality_score: number | null;
}

// ============================================================================
// FACE REGISTRATION
// ============================================================================

export const registerFace = async (imageBlob: Blob): Promise<FaceRegistrationResponse> => {
    const formData = new FormData();
    formData.append('image', imageBlob, 'face.jpg');

    const { data } = await apiClient.post<FaceRegistrationResponse>(
        '/proctoring/register-face/',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return data;
};

export const useRegisterFace = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (imageBlob: Blob) => registerFace(imageBlob),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['face-status'] });
        },
    });
};

export const getFaceStatus = async (): Promise<FaceStatus> => {
    const { data } = await apiClient.get<FaceStatus>('/proctoring/face-status/');
    return data;
};

export const useFaceStatus = () => {
    return useQuery({
        queryKey: ['face-status'],
        queryFn: getFaceStatus,
    });
};

// ============================================================================
// SNAPSHOT UPLOAD
// ============================================================================

export const uploadSnapshot = async (
    sessionId: string,
    imageBlob: Blob,
    motionScore?: number
): Promise<SnapshotUploadResponse> => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('image', imageBlob, 'snapshot.jpg');
    if (motionScore !== undefined) {
        formData.append('motion_score', motionScore.toString());
    }

    const { data } = await apiClient.post<SnapshotUploadResponse>(
        '/proctoring/snapshot/',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return data;
};

export const useUploadSnapshot = () => {
    return useMutation({
        mutationFn: ({
            sessionId,
            imageBlob,
            motionScore
        }: {
            sessionId: string;
            imageBlob: Blob;
            motionScore?: number;
        }) => uploadSnapshot(sessionId, imageBlob, motionScore),
    });
};

// ============================================================================
// SESSION STATUS & VIOLATIONS
// ============================================================================

export const getProctoringStatus = async (sessionId: string): Promise<ProctoringStatus> => {
    const { data } = await apiClient.get<ProctoringStatus>(
        `/proctoring/session/${sessionId}/status/`
    );
    return data;
};

export const useProctoringStatus = (sessionId: string) => {
    return useQuery({
        queryKey: ['proctoring-status', sessionId],
        queryFn: () => getProctoringStatus(sessionId),
        enabled: !!sessionId,
        refetchInterval: 30000,
    });
};

export const getSessionViolations = async (
    sessionId: string,
    includeFalsePositives = false
): Promise<ProctoringViolation[]> => {
    const { data } = await apiClient.get<ProctoringViolation[]>(
        `/proctoring/session/${sessionId}/violations/`,
        {
            params: { include_false_positives: includeFalsePositives }
        }
    );
    return data;
};

export const useSessionViolations = (sessionId: string, includeFalsePositives = false) => {
    return useQuery({
        queryKey: ['proctoring-violations', sessionId, includeFalsePositives],
        queryFn: () => getSessionViolations(sessionId, includeFalsePositives),
        enabled: !!sessionId,
    });
};

// ============================================================================
// VIOLATION ACTIONS
// ============================================================================

export const acknowledgeViolation = async (violationId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(
        `/proctoring/violation/${violationId}/acknowledge/`
    );
    return data;
};

export const useAcknowledgeViolation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: acknowledgeViolation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
        },
    });
};

export const reviewViolation = async (
    violationId: string,
    isFalsePositive: boolean,
    reviewNotes?: string
): Promise<{ message: string; is_false_positive: boolean }> => {
    const { data } = await apiClient.post<{ message: string; is_false_positive: boolean }>(
        `/proctoring/violation/${violationId}/review/`,
        {
            is_false_positive: isFalsePositive,
            review_notes: reviewNotes || '',
        }
    );
    return data;
};

export const useReviewViolation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            violationId,
            isFalsePositive,
            reviewNotes
        }: {
            violationId: string;
            isFalsePositive: boolean;
            reviewNotes?: string;
        }) => reviewViolation(violationId, isFalsePositive, reviewNotes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
        },
    });
};

// ============================================================================
// SESSION END
// ============================================================================

export const endSessionProctoring = async (sessionId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(
        `/proctoring/session/${sessionId}/end/`
    );
    return data;
};

export const useEndSessionProctoring = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: endSessionProctoring,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
        },
    });
};

// ============================================================================
// SESSION RECORDING
// ============================================================================

export interface SessionRecording {
    recording_id: string | null;
    video_url: string | null;
    duration_seconds: number;
    file_size_bytes: number;
    upload_status: 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
    created_at: string;
    message?: string;
}

export interface RecordingUploadResponse {
    recording_id: string;
    status: string;
    file_size: number;
    duration: number;
}

export const uploadRecording = async (
    sessionId: string,
    videoBlob: Blob,
    duration: number
): Promise<RecordingUploadResponse> => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('video', videoBlob, 'recording.webm');
    formData.append('duration', duration.toString());

    const { data } = await apiClient.post<RecordingUploadResponse>(
        '/proctoring/recording/upload/',
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
        }
    );
    return data;
};

export const useUploadRecording = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sessionId, videoBlob, duration }: {
            sessionId: string;
            videoBlob: Blob;
            duration: number;
        }) => uploadRecording(sessionId, videoBlob, duration),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['session-recording'] });
        },
    });
};

export const getSessionRecording = async (sessionId: string): Promise<SessionRecording> => {
    const { data } = await apiClient.get<SessionRecording>(
        `/proctoring/session/${sessionId}/recording/`
    );
    return data;
};

export const useSessionRecording = (sessionId: string | undefined) => {
    return useQuery({
        queryKey: ['session-recording', sessionId],
        queryFn: () => getSessionRecording(sessionId!),
        enabled: !!sessionId,
    });
};

// ============================================================================
// VIDEO CLIPS (EVIDENCE-ONLY, NOT FULL EXAM RECORDING)
// ============================================================================

export interface ProctoringVideoClip {
    id: string;
    session: string;
    video_url: string | null;
    trigger_reason: string;
    trigger_reason_display?: string;
    trigger_description: string;
    duration_seconds: number;
    file_size_bytes: number;
    started_at: string;
    ended_at: string | null;
    severity: number;
    created_at: string;
}

export interface VideoClipsResponse {
    results: ProctoringVideoClip[];
    count: number;
}

export const uploadVideoClip = async ({
    sessionId,
    videoBlob,
    duration,
    triggerReason,
    severity,
    triggerDescription,
}: {
    sessionId: string;
    videoBlob: Blob;
    duration: number;
    triggerReason: string;
    severity?: number;
    triggerDescription?: string;
}): Promise<ProctoringVideoClip> => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('video', videoBlob, 'clip.webm');
    formData.append('duration', duration.toString());
    formData.append('trigger_reason', triggerReason);
    if (severity !== undefined) formData.append('severity', severity.toString());
    if (triggerDescription) formData.append('trigger_description', triggerDescription);

    const { data } = await apiClient.post<ProctoringVideoClip>('/proctoring/video-clip/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
};

export const useUploadVideoClip = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: uploadVideoClip,
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['session-video-clips', vars.sessionId] });
        },
    });
};

export const getSessionVideoClips = async (sessionId: string): Promise<VideoClipsResponse> => {
    const { data } = await apiClient.get<VideoClipsResponse>(`/proctoring/session/${sessionId}/video-clips/`);
    return data;
};

export const useSessionVideoClips = (sessionId: string | undefined) => {
    return useQuery({
        queryKey: ['session-video-clips', sessionId],
        queryFn: () => getSessionVideoClips(sessionId!),
        enabled: !!sessionId,
    });
};

// ============================================================================
// CLIENT-SIDE VIOLATION LOGGING (audio, camera-off, etc.)
// ============================================================================
export const createClientViolation = async ({
    sessionId,
    violationType,
    severity,
    details,
    snapshotId,
}: {
    sessionId: string;
    violationType: ProctoringViolation['violation_type'];
    severity?: number;
    details?: Record<string, unknown>;
    snapshotId?: string;
}) => {
    const { data } = await apiClient.post(`/proctoring/session/${sessionId}/violations/`, {
        violation_type: violationType,
        severity: severity ?? 2,
        details: details || {},
        snapshot_id: snapshotId,
    });
    return data;
};

export const useCreateClientViolation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createClientViolation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
        },
    });
};
