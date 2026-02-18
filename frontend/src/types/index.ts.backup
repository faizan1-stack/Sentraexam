// User Types
export enum UserRole {
  ADMIN = 'ADMIN',
  HOD = 'HOD',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export interface User {
  id: number;
  external_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department: number | null;
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
  department?: number | null;
  phone_number?: string;
  password: string;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  department?: number | null;
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
  id: number;
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
  id: number;
  department: number;
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
export enum CourseStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface Course {
  id: number;
  department: number;
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
  department: number;
  code: string;
  title: string;
  description?: string;
  credits?: number;
  status?: CourseStatus;
  assigned_teacher?: number | null;
}

export enum EnrollmentStatus {
  ENROLLED = 'ENROLLED',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export interface CourseEnrollment {
  id: number;
  course: number;
  course_code: string;
  student: number;
  student_email: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
}

// Assessment Types
export enum AssessmentType {
  EXAM = 'EXAM',
  QUIZ = 'QUIZ',
  ASSIGNMENT = 'ASSIGNMENT',
  PROJECT = 'PROJECT',
}

export enum AssessmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Assessment {
  id: number;
  course: number;
  course_code: string;
  title: string;
  assessment_type: AssessmentType;
  description: string;
  duration_minutes: number;
  total_marks: number;
  status: AssessmentStatus;
  scheduled_at: string | null;
  closes_at: string | null;
  created_by: number;
  created_by_email: string;
  approved_by: number | null;
  approved_by_email: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssessmentPayload {
  course: number;
  title: string;
  assessment_type: AssessmentType;
  description?: string;
  duration_minutes?: number;
  total_marks?: number;
  status?: AssessmentStatus;
  scheduled_at?: string | null;
  closes_at?: string | null;
}

export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  GRADED = 'GRADED',
  LATE = 'LATE',
}

export interface AssessmentSubmission {
  id: number;
  assessment: number;
  assessment_title: string;
  student: number;
  student_email: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

// Notification Types
export enum AnnouncementAudience {
  ALL = 'ALL',
  DEPARTMENT = 'DEPARTMENT',
  COURSE = 'COURSE',
  CUSTOM = 'CUSTOM',
}

export enum AnnouncementStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  department: number | null;
  course: number | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  recipients?: AnnouncementRecipient[];
}

export interface AnnouncementRecipient {
  id: number;
  announcement: number;
  user: number;
  user_email: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface Notification {
  id: number;
  subject: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// Document Types
export enum DocumentAccessLevel {
  INSTITUTION = 'INSTITUTION',
  DEPARTMENT = 'DEPARTMENT',
  PERSONAL = 'PERSONAL',
}

export interface Document {
  id: number;
  title: string;
  description: string;
  file: string;
  owner: number;
  owner_email: string;
  category: number;
  category_name: string;
  department: number | null;
  access_level: DocumentAccessLevel;
  created_at: string;
  updated_at: string;
}

export interface DocumentCategory {
  id: number;
  name: string;
  description: string;
}

// Academic Calendar Types
export interface AcademicYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicTerm {
  id: number;
  academic_year: number;
  academic_year_name: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  event_type: string;
  start_at: string;
  end_at: string;
  academic_term: number;
  department: number | null;
  course: number | null;
  created_at: string;
  updated_at: string;
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
