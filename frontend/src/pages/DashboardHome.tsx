import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Role-specific dashboards
import TeacherDashboard from './dashboards/TeacherDashboard';
import HodDashboard from './dashboards/HodDashboard';
import StudentDashboard from './dashboards/StudentDashboard';
import AdminDashboard from './dashboards/AdminDashboard';

const DashboardHome: React.FC = () => {
  const { user } = useAuth();

  // Render role-specific dashboard
  switch (user?.role) {
    case UserRole.ADMIN:
      return <AdminDashboard />;
    case UserRole.HOD:
      return <HodDashboard />;
    case UserRole.TEACHER:
      return <TeacherDashboard />;
    case UserRole.STUDENT:
      return <StudentDashboard />;
    default:
      return <StudentDashboard />;
  }
};

export default DashboardHome;

