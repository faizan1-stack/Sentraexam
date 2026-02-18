import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

// ============================================================================
// Dashboard Types
// ============================================================================

export interface TeacherCourse {
    id: string;
    code: string;
    title: string;
    department: string | null;
    student_count: number;
}

export interface TeacherAssessment {
    id: string;
    title: string;
    course_code: string;
    assessment_type: string;
    status: string;
    scheduled_at: string | null;
    total_submissions: number;
}

export interface TeacherDashboardData {
    courses: TeacherCourse[];
    total_courses: number;
    assessments: TeacherAssessment[];
    total_students: number;
}

export interface HodTeacher {
    id: number;
    email: string;
    name: string;
    assigned_courses: string[];
}

export interface HodCourse {
    id: string;
    code: string;
    title: string;
    assigned_teacher: string | null;
    teacher_name: string | null;
    student_count: number;
}

export interface HodDashboardData {
    department: {
        id: string | null;
        name: string;
        code: string | null;
    };
    teachers: HodTeacher[];
    total_teachers: number;
    total_students: number;
    courses: HodCourse[];
    total_courses: number;
}

export interface StudentEnrollment {
    id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    teacher: string | null;
    enrolled_at: string | null;
}

export interface StudentExam {
    id: string;
    title: string;
    course_code: string;
    assessment_type: string;
    scheduled_at: string | null;
    closes_at: string | null;
    duration_minutes: number;
    total_marks: number;
    status: string;
    student_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
}

export interface StudentDashboardData {
    enrollments: StudentEnrollment[];
    total_enrollments: number;
    upcoming_exams: StudentExam[];
    past_exams: StudentExam[];
    attendance_percentage: number | null;
}

export interface AdminUserCounts {
    total: number;
    admins: number;
    hods: number;
    teachers: number;
    students: number;
}

export interface AdminUser {
    id: number;
    email: string;
    name: string;
    role: string;
    department: string | null;
    department_id?: string | null;
    created_at: string | null;
    is_active: boolean;
    onboarding_completed?: boolean;
}

export interface AdminDepartment {
    id: string;
    name: string;
    code: string;
    user_count: number;
    course_count: number;
}

export interface AdminTrend {
    delta: number;
    direction: 'up' | 'down' | 'flat';
    period_label: string;
}

export interface AdminTotals {
    departments: number;
    courses: number;
    assessments: number;
    enrollments: number;
    submissions: number;
}

export interface AdminDepartmentEnhanced extends AdminDepartment {
    students_count?: number;
    teachers_count?: number;
    active_course_count?: number;
    enrolled_students?: number;
    avg_class_size?: number;
    load_percent?: number;
    health?: 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
}

export interface AdminChartUserGrowthPoint {
    month: string; // ISO date (first of month)
    count: number;
}

export interface AdminChartDepartmentDistributionPoint {
    department: string;
    count: number;
}

export interface AdminChartEnrollmentsPoint {
    department: string;
    count: number;
}

export interface AdminCharts {
    user_growth: AdminChartUserGrowthPoint[];
    department_distribution: AdminChartDepartmentDistributionPoint[];
    enrollments_by_department: AdminChartEnrollmentsPoint[];
}

export interface AdminPerformance {
    active_users_now: number;
    exams_in_progress: number;
    pending_enrollments: number;
    pending_schedule_approvals: number;
}

export interface AdminActivityActor {
    name: string;
    email: string;
    role: string | null;
}

export interface AdminActivityItem {
    id: string;
    type: 'USER' | 'COURSE' | 'ENROLLMENT' | 'ASSESSMENT' | 'VIOLATION';
    title: string;
    message: string;
    created_at: string;
    actor: AdminActivityActor | null;
    route: string;
}

export interface AdminFilters {
    range: string;
    start: string;
    end: string;
}

export interface AdminPeriodSummary {
    label: string;
    start: string;
    end: string;
    new_users: number;
    new_courses: number;
    new_assessments: number;
    new_enrollments: number;
    submissions: number;
}

export interface AdminDashboardData {
    user_counts: AdminUserCounts;
    recent_users: AdminUser[];
    departments: Array<AdminDepartment | AdminDepartmentEnhanced>;
    total_departments: number;
    total_assessments: number;
    total_submissions: number;

    totals?: AdminTotals;
    trends?: Record<string, AdminTrend>;
    charts?: AdminCharts;
    performance?: AdminPerformance;
    activity_feed?: AdminActivityItem[];
    filters?: AdminFilters;
    period?: AdminPeriodSummary;
}

export interface AdminSearchResult {
    type: 'user' | 'course' | 'department' | 'assessment';
    id: string;
    title: string;
    subtitle: string;
    route: string;
}

// ============================================================================
// Dashboard API Functions
// ============================================================================

export const getTeacherDashboard = async (): Promise<TeacherDashboardData> => {
    const { data } = await apiClient.get<TeacherDashboardData>('/auth/dashboard/teacher/');
    return data;
};

export const useTeacherDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'teacher'],
        queryFn: getTeacherDashboard,
    });
};

export const getHodDashboard = async (): Promise<HodDashboardData> => {
    const { data } = await apiClient.get<HodDashboardData>('/auth/dashboard/hod/');
    return data;
};

export const useHodDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'hod'],
        queryFn: getHodDashboard,
    });
};

export const getStudentDashboard = async (): Promise<StudentDashboardData> => {
    const { data } = await apiClient.get<StudentDashboardData>('/auth/dashboard/student/');
    return data;
};

export const useStudentDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'student'],
        queryFn: getStudentDashboard,
    });
};

export const getAdminDashboard = async (params?: {
    range?: 'today' | 'week' | 'month' | 'custom';
    start?: string;
    end?: string;
}): Promise<AdminDashboardData> => {
    const { data } = await apiClient.get<AdminDashboardData>('/auth/dashboard/admin/', { params });
    return data;
};

export const useAdminDashboard = (params?: {
    range?: 'today' | 'week' | 'month' | 'custom';
    start?: string;
    end?: string;
}) => {
    return useQuery({
        queryKey: ['dashboard', 'admin', params],
        queryFn: () => getAdminDashboard(params),
    });
};

export const adminDashboardSearch = async (q: string): Promise<{ results: AdminSearchResult[] }> => {
    const { data } = await apiClient.get<{ results: AdminSearchResult[] }>(
        '/auth/dashboard/admin/search/',
        { params: { q } }
    );
    return data;
};

export const useAdminDashboardSearch = (q: string) => {
    return useQuery({
        queryKey: ['dashboard', 'admin', 'search', q],
        queryFn: () => adminDashboardSearch(q),
        enabled: (q || '').trim().length >= 2,
    });
};
