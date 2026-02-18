import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { UserRole } from '../types';

// Layouts
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import ActivateAccountPage from '../pages/auth/ActivateAccountPage';
import PasswordResetPage from '../pages/auth/PasswordResetPage';

// Dashboard Pages
import DashboardHome from '../pages/DashboardHome';
import WelcomePage from '../pages/WelcomePage';

// User Pages
import UsersListPage from '../features/users/pages/UsersListPage';
import UserCreatePage from '../features/users/pages/UserCreatePage';
import UserEditPage from '../features/users/pages/UserEditPage';

// Department Pages
import DepartmentsListPage from '../features/departments/pages/DepartmentsListPage';
import DepartmentCreatePage from '../features/departments/pages/DepartmentCreatePage';
import DepartmentEditPage from '../features/departments/pages/DepartmentEditPage';

// Protected Route Component
import ProtectedRoute from '../components/ProtectedRoute';
import ComingSoonPage from '../pages/ComingSoonPage';

// Course Pages
import CoursesListPage from '../features/courses/pages/CoursesListPage';
import CourseFormPage from '../features/courses/pages/CourseFormPage';
import CourseDetailPage from '../features/courses/pages/CourseDetailPage';
import EnrollCoursePage from '../features/courses/pages/EnrollCoursePage';
import EnrollmentRequestsPage from '../features/courses/pages/EnrollmentRequestsPage';

// Assessment Pages
import AssessmentsListPage from '../features/assessments/pages/AssessmentsListPage';
import AssessmentFormPage from '../features/assessments/pages/AssessmentFormPage';
import AssessmentDetailPage from '../features/assessments/pages/AssessmentDetailPage';
import AssessmentSchedulePage from '../features/assessments/pages/AssessmentSchedulePage';
import ExamTakingPage from '../features/assessments/pages/ExamTakingPage';

// Notification Pages
import AnnouncementsListPage from '../features/notifications/pages/AnnouncementsListPage';
import AnnouncementFormPage from '../features/notifications/pages/AnnouncementFormPage';
import NotificationsPage from '../features/notifications/pages/NotificationsPage';

// Document Pages
import DocumentsListPage from '../features/documents/pages/DocumentsListPage';
import DocumentFormPage from '../features/documents/pages/DocumentFormPage';

// Calendar Page
import CalendarPage from '../features/calendar/pages/CalendarPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <WelcomePage />,
  },
  {
    path: '/login',
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  {
    path: '/activate/:token',
    element: (
      <AuthLayout>
        <ActivateAccountPage />
      </AuthLayout>
    ),
  },
  {
    path: '/reset-password/:token',
    element: (
      <AuthLayout>
        <PasswordResetPage />
      </AuthLayout>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <AuthLayout>
        <PasswordResetPage />
      </AuthLayout>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardHome />,
      },
      // Users routes (Admin only)
      {
        path: 'users',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <UsersListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <UserCreatePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <UserEditPage />
          </ProtectedRoute>
        ),
      },
      // Departments routes (Admin/HOD)
      {
        path: 'departments',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <DepartmentsListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'departments/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <DepartmentCreatePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'departments/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <DepartmentEditPage />
          </ProtectedRoute>
        ),
      },
      // Courses routes
      {
        path: 'courses',
        element: (
          <ProtectedRoute
            allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}
          >
            <CoursesListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'courses/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <CourseFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'courses/enroll',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
            <EnrollCoursePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'courses/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <CourseFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'courses/:id',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}>
            <CourseDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'enrollments',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER]}>
            <EnrollmentRequestsPage />
          </ProtectedRoute>
        ),
      },
      // Assessments routes
      {
        path: 'assessments',
        element: (
          <ProtectedRoute
            allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}
          >
            <AssessmentsListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assessments/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER]}>
            <AssessmentFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assessments/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER]}>
            <AssessmentFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assessments/:id',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}>
            <AssessmentDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assessments/:id/schedule',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER]}>
            <AssessmentSchedulePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assessments/:id/take',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
            <ExamTakingPage />
          </ProtectedRoute>
        ),
      },
      // Notifications routes (all users can see their notifications)
      {
        path: 'notifications',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <AnnouncementFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <AnnouncementFormPage />
          </ProtectedRoute>
        ),
      },
      // Announcements management (Admin/HOD only)
      {
        path: 'announcements',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <AnnouncementsListPage />
          </ProtectedRoute>
        ),
      },
      // Documents routes
      {
        path: 'documents',
        element: (
          <ProtectedRoute
            allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}
          >
            <DocumentsListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'documents/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER]}>
            <DocumentFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'documents/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER]}>
            <DocumentFormPage />
          </ProtectedRoute>
        ),
      },
      // Calendar route
      {
        path: 'calendar',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD, UserRole.TEACHER, UserRole.STUDENT]}>
            <CalendarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ComingSoonPage
              title="Profile"
              description="Profile settings are coming soon."
              actionLabel="Back to dashboard"
              actionTo="/dashboard"
            />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <ComingSoonPage
              title="Settings"
              description="Application settings will be available shortly."
              actionLabel="Back to dashboard"
              actionTo="/dashboard"
            />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
];
