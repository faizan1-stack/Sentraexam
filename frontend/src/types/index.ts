// User Types
export const UserRole = {
  ADMIN: 'ADMIN',
  HOD: 'HOD',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: number;
  external_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department: string | null;
  department_name?: string;
  phone_number: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department?: string | null;
  phone_number?: string;
  password: string;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  department?: string | null;
  phone_number?: string;
}

// Authentication Types
export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ActivationPayload {
  token: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  head: number | null;
  head_email?: string;
  teacher_count?: number;
  student_count?: number;
}

export interface CreateDepartmentPayload {
  name: string;
  code: string;
  description?: string;
  head?: number | null;
}

export interface DepartmentMembership {
  id: string;
  department: string;
  department_name: string;
  user: number;
  user_email: string;
  role: string;
  assigned_by: number | null;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

// Course Types
export const CourseStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export interface Course {
  id: string;
  department: string;
  department_name: string;
  code: string;
  title: string;
  description: string;
  credits: number;
  status: CourseStatus;
  assigned_teacher: number | null;
  assigned_teacher_email?: string;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCoursePayload {
  department: string;
  code: string;
  title: string;
  description?: string;
  credits?: number;
  status?: CourseStatus;
  assigned_teacher?: number | null;
}

export const EnrollmentStatus = {
  PENDING: 'PENDING',
  ENROLLED: 'ENROLLED',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED',
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export interface CourseEnrollment {
  id: string;
  course: string;
  course_code: string;
  course_title: string;
  department_name: string;
  student: number;
  student_email: string;
  student_first_name: string;
  student_last_name: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
}

// Assessment Types
export const AssessmentType = {
  EXAM: 'EXAM',
  QUIZ: 'QUIZ',
  ASSIGNMENT: 'ASSIGNMENT',
  PROJECT: 'PROJECT',
} as const;
export type AssessmentType = (typeof AssessmentType)[keyof typeof AssessmentType];

export const AssessmentStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const AssessmentSubmissionFormat = {
  ONLINE: 'ONLINE',
  TEXT: 'TEXT',
  FILE: 'FILE',
  TEXT_AND_FILE: 'TEXT_AND_FILE',
} as const;
export type AssessmentSubmissionFormat =
  (typeof AssessmentSubmissionFormat)[keyof typeof AssessmentSubmissionFormat];

export interface AssessmentContentBlock {
  title: string;
  body: string;
  content_type: 'INSTRUCTION' | 'QUESTION' | 'RESOURCE';
}

export interface AssessmentQuestionOption {
  text: string;
  // For students, the backend strips answer-key fields until results are published.
  is_correct?: boolean;
}

export interface AssessmentQuestion {
  prompt: string;
  type?: 'MCQ' | 'SUBJECTIVE';
  marks?: number;
  options: AssessmentQuestionOption[];
}

export interface Assessment {
  id: string;
  course: string;
  course_code: string;
  title: string;
  assessment_type: AssessmentType;
  description: string;
  instructions: string;
  content: AssessmentContentBlock[];
  questions: AssessmentQuestion[];
  duration_minutes: number;
  instructions_open_minutes?: number;
  late_entry_minutes?: number;
  grace_minutes?: number;
  total_marks: number;
  status: AssessmentStatus;
  submission_format: AssessmentSubmissionFormat;
  scheduled_at: string | null;
  ends_at?: string | null;
  closes_at: string | null;
  schedule_state?: 'DRAFT' | 'PROPOSED' | 'APPROVED';
  schedule_proposed_by?: string | null;
  schedule_proposed_by_email?: string | null;
  schedule_proposed_at?: string | null;
  schedule_approved_by?: string | null;
  schedule_approved_by_email?: string | null;
  schedule_approved_at?: string | null;
  created_by: string;
  created_by_email: string;
  approved_by: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Statistics fields
  total_submissions?: number;
  average_score?: number | null;
  submission_rate?: number;
}

export interface CreateAssessmentPayload {
  course: string;
  title: string;
  assessment_type: AssessmentType;
  description?: string;
  instructions?: string;
  content: AssessmentContentBlock[];
  questions?: AssessmentQuestion[];
  duration_minutes?: number;
  total_marks?: number;
  status?: AssessmentStatus;
  submission_format: AssessmentSubmissionFormat;
  scheduled_at?: string | null;
  closes_at?: string | null;
}

export const SubmissionStatus = {
  SUBMITTED: 'SUBMITTED',
  GRADED: 'GRADED',
  LATE: 'LATE',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export interface AssessmentSubmission {
  id: string;
  assessment: string;
  assessment_title: string;
  student: string;
  student_email: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string;
  text_response: string;
  file_response: string | null;
  answers: (number | string | null)[];
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitAssessmentPayload {
  assessmentId: string;
  textResponse?: string;
  answers?: (number | string | null)[];
  file?: File;
}

// Notification Types
export const AnnouncementAudience = {
  ALL: 'ALL',
  DEPARTMENT: 'DEPARTMENT',
  COURSE: 'COURSE',
  CUSTOM: 'CUSTOM',
} as const;
export type AnnouncementAudience = (typeof AnnouncementAudience)[keyof typeof AnnouncementAudience];

export const AnnouncementStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
} as const;
export type AnnouncementStatus = (typeof AnnouncementStatus)[keyof typeof AnnouncementStatus];


export interface Notification {
  id: string;
  subject: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// Document Types
export const DocumentAccessLevel = {
  PRIVATE: 'PRIVATE',
  DEPARTMENT: 'DEPARTMENT',
  INSTITUTION: 'INSTITUTION',
} as const;
export type DocumentAccessLevel = (typeof DocumentAccessLevel)[keyof typeof DocumentAccessLevel];


// Academic Calendar Types
export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicTerm {
  id: string;
  academic_year: string;
  academic_year_name: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  start_at: string;
  end_at: string;
  academic_term: string;
  department: string | null;
  course: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventPayload {
  title: string;
  description?: string;
  event_type: string;
  start_at: string;
  end_at: string;
  academic_term: string;
  department?: string | null;
  course?: string | null;
}

// Document Types
export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  file: string;
  category: string;
  access_level: string;
  department: string | null;
  course: string | null;
  uploaded_by: string;
  uploaded_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentPayload {
  title: string;
  description: string;
  file: File;
  category?: string | null;
  access_level: string;
  department?: string | null;
  course?: string | null;
}

// Notification Types
export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: string;
  department: string | null;
  course: string | null;
  created_by: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  content: string;
  audience: string;
  department?: string | null;
  course?: string | null;
}

// Pagination Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// API Error Types
export interface APIError {
  detail?: string;
  [key: string]: any;
}
