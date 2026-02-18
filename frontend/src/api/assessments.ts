import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  Assessment,
  CreateAssessmentPayload,
  PaginatedResponse,
  AssessmentSubmission,
  SubmitAssessmentPayload,
} from '../types';

// List assessments
export const listAssessments = async (params?: {
  course?: number;
  assessment_type?: string;
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Assessment>> => {
  const { data } = await apiClient.get<PaginatedResponse<Assessment>>('/assessments/', {
    params,
  });
  return data;
};

export const useAssessments = (params?: {
  course?: number;
  assessment_type?: string;
  status?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['assessments', params],
    queryFn: () => listAssessments(params),
  });
};

// Get single assessment
export const getAssessment = async (id: string): Promise<Assessment> => {
  const { data } = await apiClient.get<Assessment>(`/assessments/${id}/`);
  return data;
};

export const useAssessment = (id: string) => {
  return useQuery({
    queryKey: ['assessment', id],
    queryFn: () => getAssessment(id),
    enabled: !!id,
  });
};

// Create assessment
export const createAssessment = async (payload: CreateAssessmentPayload): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>('/assessments/', payload);
  return data;
};

export const useCreateAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};

// Update assessment
export const updateAssessment = async (
  id: string,
  payload: Partial<CreateAssessmentPayload>
): Promise<Assessment> => {
  const { data } = await apiClient.patch<Assessment>(`/assessments/${id}/`, payload);
  return data;
};

export const useUpdateAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateAssessmentPayload> }) =>
      updateAssessment(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.id] });
    },
  });
};

// Delete assessment
export const deleteAssessment = async (id: string): Promise<void> => {
  await apiClient.delete(`/assessments/${id}/`);
};

export const useDeleteAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};

// Submit assessment for approval
export const submitAssessmentForApproval = async (id: string): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/submit/`);
  return data;
};

export const useSubmitAssessmentForApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAssessmentForApproval,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
    },
  });
};

// Approve assessment
export const approveAssessment = async (id: string): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/approve/`, { approve: true });
  return data;
};

export const useApproveAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveAssessment,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
    },
  });
};

// Schedule assessment
export const scheduleAssessment = async (
  id: string,
  scheduledAt: string,
  durationMinutes: number,
  graceMinutes?: number,
  lateEntryMinutes?: number,
  instructionsOpenMinutes?: number
): Promise<Assessment> => {
  const body: Record<string, any> = {
    scheduled_at: scheduledAt,
    duration_minutes: durationMinutes,
  };
  if (typeof graceMinutes === 'number') body.grace_minutes = graceMinutes;
  if (typeof lateEntryMinutes === 'number') body.late_entry_minutes = lateEntryMinutes;
  if (typeof instructionsOpenMinutes === 'number')
    body.instructions_open_minutes = instructionsOpenMinutes;

  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/schedule/`, body);
  return data;
};

export const useScheduleAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      scheduledAt,
      durationMinutes,
      graceMinutes,
      lateEntryMinutes,
      instructionsOpenMinutes,
    }: {
      id: string;
      scheduledAt: string;
      durationMinutes: number;
      graceMinutes?: number;
      lateEntryMinutes?: number;
      instructionsOpenMinutes?: number;
    }) =>
      scheduleAssessment(
        id,
        scheduledAt,
        durationMinutes,
        graceMinutes,
        lateEntryMinutes,
        instructionsOpenMinutes
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.id] });
    },
  });
};

// Approve proposed schedule (Admin only)
export const approveSchedule = async (id: string, approved: boolean, reason?: string): Promise<Assessment> => {
  const body: Record<string, any> = { approved };
  if (typeof reason === 'string') body.reason = reason;

  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/schedule/approve/`, body);
  return data;
};

export const useApproveSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      approveSchedule(id, approved, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.id] });
    },
  });
};

// Assessment submissions
export const listAssessmentSubmissions = async (params?: {
  assessment?: string;
  student?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<AssessmentSubmission>> => {
  const { data } = await apiClient.get<PaginatedResponse<AssessmentSubmission>>(
    '/assessments/submissions/',
    { params }
  );
  return data;
};

export const useAssessmentSubmissions = (params?: {
  assessment?: string;
  student?: number;
  status?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['assessment-submissions', params],
    queryFn: () => listAssessmentSubmissions(params),
  });
};

export const submitAssessmentWork = async (
  payload: SubmitAssessmentPayload
): Promise<AssessmentSubmission> => {
  if (payload.file) {
    const formData = new FormData();
    formData.append('assessment', payload.assessmentId);
    if (payload.textResponse) {
      formData.append('text_response', payload.textResponse);
    }
    formData.append('file_response', payload.file);
    const { data } = await apiClient.post<AssessmentSubmission>(
      '/assessments/submissions/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  }

  const body: Record<string, unknown> = { assessment: payload.assessmentId };
  if (payload.textResponse) {
    body.text_response = payload.textResponse;
  }
  if (payload.answers) {
    body.answers = payload.answers;
  }
  const { data } = await apiClient.post<AssessmentSubmission>('/assessments/submissions/', body);
  return data;
};

export const useSubmitAssessmentWork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAssessmentWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment-submissions'] });
      // Also invalidate assessments list to refresh student_submission_status
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};

// Grade submission
export const gradeSubmission = async (
  submissionId: string,
  score: number,
  feedback?: string
): Promise<AssessmentSubmission> => {
  const { data } = await apiClient.post<AssessmentSubmission>(
    `/assessments/submissions/${submissionId}/grade/`,
    { score, feedback }
  );
  return data;
};

export const useGradeSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback?: string }) =>
      gradeSubmission(submissionId, score, feedback),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};

// ============================================================================
// Exam Session Types
// ============================================================================

export interface ExamSession {
  id: string;
  assessment: string;
  assessment_title: string;
  student: number;
  student_email: string;
  started_at: string;
  ended_at: string | null;
  server_deadline: string;
  cheating_count: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED';
  saved_answers: (number | string | null)[];
  cheating_logs: CheatingLog[];
  time_remaining_seconds: number;
}

export interface CheatingLog {
  id: string;
  incident_type: 'TAB_SWITCH' | 'BLUR' | 'FULLSCREEN_EXIT' | 'COPY_PASTE';
  occurred_at: string;
  details: Record<string, unknown>;
}

export interface ExamAssignment {
  id: string;
  assessment: string;
  assessment_title: string;
  student: number;
  student_email: string;
  student_name: string;
  assigned_at: string;
  is_completed: boolean;
  created_at: string;
}

// ============================================================================
// Student Assignment APIs
// ============================================================================

export const assignStudents = async (
  assessmentId: string,
  studentIds: number[]
): Promise<{ message: string; total_assigned: number }> => {
  const { data } = await apiClient.post(`/assessments/${assessmentId}/assign/`, {
    student_ids: studentIds,
  });
  return data;
};

export const useAssignStudents = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, studentIds }: { assessmentId: string; studentIds: number[] }) =>
      assignStudents(assessmentId, studentIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-assignments', variables.assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.assessmentId] });
    },
  });
};

export const listAssignments = async (assessmentId: string): Promise<ExamAssignment[]> => {
  const { data } = await apiClient.get<ExamAssignment[]>(`/assessments/${assessmentId}/assignments/`);
  return data;
};

export const useAssessmentAssignments = (assessmentId: string) => {
  return useQuery({
    queryKey: ['assessment-assignments', assessmentId],
    queryFn: () => listAssignments(assessmentId),
    enabled: !!assessmentId,
  });
};

export const removeAssignment = async (assessmentId: string, studentId: number): Promise<void> => {
  await apiClient.delete(`/assessments/${assessmentId}/assignments/${studentId}/`);
};

export const useRemoveAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, studentId }: { assessmentId: string; studentId: number }) =>
      removeAssignment(assessmentId, studentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-assignments', variables.assessmentId] });
    },
  });
};

// ============================================================================
// Exam Session APIs
// ============================================================================

export const startExamSession = async (assessmentId: string): Promise<ExamSession> => {
  const { data } = await apiClient.post<ExamSession>(`/assessments/${assessmentId}/start-session/`);
  return data;
};

export const useStartExamSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startExamSession,
    onSuccess: (_session, assessmentId) => {
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    },
  });
};

export const reportCheating = async (
  sessionId: string,
  incidentType: CheatingLog['incident_type'],
  details?: Record<string, unknown>
): Promise<ExamSession> => {
  const { data } = await apiClient.post<ExamSession>(
    `/assessments/sessions/${sessionId}/report-cheating/`,
    { incident_type: incidentType, details }
  );
  return data;
};

export const useReportCheating = () => {
  return useMutation({
    mutationFn: ({
      sessionId,
      incidentType,
      details,
    }: {
      sessionId: string;
      incidentType: CheatingLog['incident_type'];
      details?: Record<string, unknown>;
    }) => reportCheating(sessionId, incidentType, details),
  });
};

export const autoSaveAnswers = async (
  sessionId: string,
  answers: (number | string | null)[]
): Promise<{ message: string }> => {
  const { data } = await apiClient.post(`/assessments/sessions/${sessionId}/autosave/`, {
    answers,
  });
  return data;
};

export const useAutoSaveAnswers = () => {
  return useMutation({
    mutationFn: ({ sessionId, answers }: { sessionId: string; answers: (number | string | null)[] }) =>
      autoSaveAnswers(sessionId, answers),
  });
};

export const getSavedAnswers = async (
  sessionId: string
): Promise<{ answers: (number | string | null)[]; time_remaining_seconds: number }> => {
  const { data } = await apiClient.get(`/assessments/sessions/${sessionId}/saved-answers/`);
  return data;
};

export const useSavedAnswers = (sessionId: string) => {
  return useQuery({
    queryKey: ['saved-answers', sessionId],
    queryFn: () => getSavedAnswers(sessionId),
    enabled: !!sessionId,
  });
};

export const getExamSession = async (sessionId: string): Promise<ExamSession> => {
  const { data } = await apiClient.get<ExamSession>(`/assessments/sessions/${sessionId}/`);
  return data;
};

export const useExamSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['exam-session', sessionId],
    queryFn: () => getExamSession(sessionId),
    enabled: !!sessionId,
  });
};

export const listExamSessions = async (params?: {
  assessment?: string;
  status?: string;
}): Promise<PaginatedResponse<ExamSession>> => {
  const { data } = await apiClient.get<PaginatedResponse<ExamSession>>('/assessments/sessions/', {
    params,
  });
  return data;
};

export const useExamSessions = (params?: { assessment?: string; status?: string }) => {
  return useQuery({
    queryKey: ['exam-sessions', params],
    queryFn: () => listExamSessions(params),
  });
};
