import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Collapse,
  Col,
  Empty,
  Input,
  List,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Timeline,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';

import educationIllustration from '../../assets/education-illustration.svg';
import { useTeacherDashboard, type TeacherCourse } from '../../api/dashboard';
import { useAssessments, useAssessmentSubmissions } from '../../api/assessments';
import { useApproveEnrollment, useCourseEnrollments, useCourses, useRejectEnrollment } from '../../api/courses';
import { useDocuments } from '../../api/documents';
import {
  listNotifications,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useUnreadNotificationCount,
} from '../../api/notifications';
import { AssessmentType, type Assessment, type Course, type CourseEnrollment, type Document, type Notification } from '../../types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Search } = Input;

// ---------------------------------------------------------------------------
// Small, dashboard-safe helpers
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const initialsFrom = (nameOrEmail: string) => {
  const cleaned = (nameOrEmail || '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (cleaned.includes('@')) return cleaned[0].toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
};

const timeAgo = (iso: string) => {
  const d = dayjs(iso);
  if (!d.isValid()) return iso;
  return d.fromNow();
};

const statusPill = (status: string) => {
  const map: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: 'Draft' },
    SUBMITTED: { color: 'orange', label: 'Submitted' },
    APPROVED: { color: 'blue', label: 'Approved' },
    SCHEDULED: { color: 'purple', label: 'Scheduled' },
    IN_PROGRESS: { color: 'cyan', label: 'In Progress' },
    COMPLETED: { color: 'green', label: 'Completed' },
    CANCELLED: { color: 'red', label: 'Cancelled' },
  };
  const meta = map[status] || { color: 'default', label: status };
  return (
    <Tag color={meta.color} style={{ borderRadius: 999, paddingInline: 10, marginInlineEnd: 0 }}>
      {meta.label}
    </Tag>
  );
};

type NotificationTone = 'success' | 'warning' | 'error' | 'info';
type NotificationCategory = 'SUBMISSIONS' | 'VIOLATIONS' | 'APPROVALS' | 'SCHEDULES' | 'INFO';

const categorizeNotification = (n: Notification): { category: NotificationCategory; tone: NotificationTone } => {
  const action = String(n.metadata?.action || n.metadata?.type || '').toLowerCase();
  const text = `${n.subject} ${n.body}`.toLowerCase();

  if (action.includes('violation') || text.includes('violation') || text.includes('cheating')) {
    return { category: 'VIOLATIONS', tone: 'error' };
  }
  if (action.includes('submission') || text.includes('submitted')) {
    return { category: 'SUBMISSIONS', tone: 'success' };
  }
  if (action.includes('approved') || text.includes('approved')) {
    return { category: 'APPROVALS', tone: 'success' };
  }
  if (action.includes('schedule') || text.includes('schedule')) {
    return { category: 'SCHEDULES', tone: 'warning' };
  }
  return { category: 'INFO', tone: 'info' };
};

const toneMeta = (tone: NotificationTone) => {
  switch (tone) {
    case 'success':
      return { border: '#16a34a', dot: '#16a34a', icon: <CheckOutlined /> };
    case 'warning':
      return { border: '#f59e0b', dot: '#f59e0b', icon: <ClockCircleOutlined /> };
    case 'error':
      return { border: '#ef4444', dot: '#ef4444', icon: <WarningFilled /> };
    default:
      return { border: '#3b82f6', dot: '#94a3b8', icon: <BellOutlined /> };
  }
};

const routeFromNotification = (n: Notification) => {
  const assessmentId = n.metadata?.assessment_id as string | undefined;
  const courseId = n.metadata?.course_id as string | undefined;
  const enrollmentId = n.metadata?.enrollment_id as string | undefined;
  if (assessmentId) return `/dashboard/assessments/${assessmentId}`;
  if (courseId) return `/dashboard/courses/${courseId}`;
  if (enrollmentId) return '/dashboard/enrollments';
  return '/dashboard/notifications';
};

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}> = ({ icon, title, subtitle, extra }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'rgba(33, 150, 243, 0.12)',
          display: 'grid',
          placeItems: 'center',
          color: '#2196f3',
          flex: '0 0 auto',
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {subtitle ? (
          <Text type="secondary" style={{ display: 'block' }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
    </div>
    {extra ? <div>{extra}</div> : null}
  </div>
);

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  meta?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}> = ({ title, value, icon, gradient, meta, onClick, loading }) => (
  <Card
    className="sentra-hover-lift"
    bodyStyle={{ padding: 18 }}
    style={{
      border: 'none',
      cursor: onClick ? 'pointer' : 'default',
      background: gradient,
      overflow: 'hidden',
      position: 'relative',
      height: '100%',
    }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={
      onClick
        ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') onClick();
          }
        : undefined
    }
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.28), transparent 46%), radial-gradient(circle at 88% 26%, rgba(255,255,255,0.16), transparent 52%)',
        pointerEvents: 'none',
      }}
    />
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <Text style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>{title}</Text>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.22)',
            color: '#fff',
            flex: '0 0 auto',
          }}
          aria-hidden
        >
          {icon}
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        {loading ? (
          <Skeleton.Input active size="small" style={{ width: 120, background: 'rgba(255,255,255,0.2)' }} />
        ) : (
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>{value}</div>
        )}
        {onClick ? (
          <Tag
            color="default"
            style={{
              borderRadius: 999,
              background: 'rgba(255,255,255,0.2)',
              borderColor: 'rgba(255,255,255,0.28)',
              color: 'rgba(255,255,255,0.92)',
              marginInlineEnd: 0,
            }}
          >
            View <ArrowRightOutlined />
          </Tag>
        ) : null}
      </div>
      {meta ? <Text style={{ display: 'block', marginTop: 10, color: 'rgba(255,255,255,0.86)' }}>{meta}</Text> : null}
    </div>
  </Card>
);

type NotificationFilter = 'All' | 'Unread' | 'Important';
type AssessmentFilter = 'All' | 'Draft' | 'Active' | 'Completed';
type CourseStatusUi = 'Active' | 'Upcoming' | 'Completed';

const courseStatusUi = (raw?: string | null): CourseStatusUi => {
  if (raw === 'ARCHIVED') return 'Completed';
  if (raw === 'DRAFT') return 'Upcoming';
  return 'Active';
};

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useTeacherDashboard();
  const { data: coursesPage } = useCourses({ page: 1 });
  const { data: pendingEnrollments, isLoading: pendingLoading } = useCourseEnrollments({ status: 'PENDING' });

  const { data: assessmentsPage, isLoading: assessmentsLoading } = useAssessments({ page: 1 });
  const { data: inProgressAssessmentsPage } = useAssessments({ status: 'IN_PROGRESS', page: 1 });
  const { data: gradingQueuePage } = useAssessmentSubmissions({ status: 'SUBMITTED' });
  const { data: documentsPage, isLoading: documentsLoading } = useDocuments({ page: 1 });

  const { data: unreadCount } = useUnreadNotificationCount();
  const notificationsQuery = useQuery({
    queryKey: ['notifications', { page: 1 }],
    queryFn: () => listNotifications({ page: 1 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  const approveEnrollmentMutation = useApproveEnrollment();
  const rejectEnrollmentMutation = useRejectEnrollment();

  const [courseSearch, setCourseSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>();
  const [courseStatusFilter, setCourseStatusFilter] = useState<CourseStatusUi | 'All'>('All');
  const [assessmentFilter, setAssessmentFilter] = useState<AssessmentFilter>('All');
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('All');
  const [enrollmentSort, setEnrollmentSort] = useState<'Recent' | 'Oldest'>('Recent');

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load Teacher Dashboard"
        description="Please refresh the page or login again."
        showIcon
      />
    );
  }

  const coursesTotal = data?.total_courses || 0;
  const studentsTotal = data?.total_students || 0;
  const pendingEnrollmentsList = (pendingEnrollments?.results || []) as CourseEnrollment[];
  const pendingEnrollmentsCount = pendingEnrollments?.count || pendingEnrollmentsList.length || 0;
  const activeAssessmentsCount = inProgressAssessmentsPage?.count || 0;
  const gradingQueueCount = gradingQueuePage?.count || 0;

  const enrollmentsGrouped = useMemo(() => {
    const sorted = [...pendingEnrollmentsList].sort((a, b) => {
      const aTs = dayjs(a.enrolled_at).valueOf();
      const bTs = dayjs(b.enrolled_at).valueOf();
      return enrollmentSort === 'Oldest' ? aTs - bTs : bTs - aTs;
    });

    const groups = new Map<
      string,
      { courseId: string; courseCode: string; courseTitle: string; items: CourseEnrollment[] }
    >();

    sorted.forEach((e) => {
      const group =
        groups.get(e.course) || {
          courseId: e.course,
          courseCode: e.course_code,
          courseTitle: e.course_title,
          items: [],
        };
      group.items.push(e);
      groups.set(e.course, group);
    });

    return Array.from(groups.values()).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [pendingEnrollmentsList, enrollmentSort]);

  const assessmentsAll = (assessmentsPage?.results || []) as Assessment[];
  const filteredAssessments = useMemo(() => {
    if (assessmentFilter === 'All') return assessmentsAll;
    if (assessmentFilter === 'Draft') return assessmentsAll.filter((a) => a.status === 'DRAFT');
    if (assessmentFilter === 'Completed') return assessmentsAll.filter((a) => a.status === 'COMPLETED');
    return assessmentsAll.filter((a) => a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS');
  }, [assessmentsAll, assessmentFilter]);

  const avgPerformance = useMemo(() => {
    const graded = assessmentsAll.filter((a) => a.average_score !== null && a.average_score !== undefined && a.total_marks);
    if (!graded.length) return null;
    const percents = graded.map((a) => (Number(a.average_score) / Number(a.total_marks)) * 100);
    const avg = percents.reduce((acc, v) => acc + v, 0) / percents.length;
    return clamp(avg, 0, 100);
  }, [assessmentsAll]);

  const coursesMetaById = useMemo(() => {
    const map = new Map<string, Course>();
    (coursesPage?.results || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [coursesPage?.results]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.courses || []).forEach((c) => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data?.courses]);

  const filteredCourses = useMemo(() => {
    const s = courseSearch.trim().toLowerCase();
    return (data?.courses || []).filter((c) => {
      const meta = coursesMetaById.get(c.id);
      const statusUi = courseStatusUi(meta?.status);

      const matchesSearch = !s || `${c.code} ${c.title} ${c.department || ''}`.toLowerCase().includes(s);
      const matchesDept = !departmentFilter || (c.department || '') === departmentFilter;
      const matchesStatus = courseStatusFilter === 'All' || statusUi === courseStatusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [courseSearch, data?.courses, coursesMetaById, departmentFilter, courseStatusFilter]);

  const notifications = (notificationsQuery.data?.results || []) as Notification[];
  const filteredNotifications = useMemo(() => {
    const base = notifications.filter((n) => {
      if (notificationFilter === 'Unread') return !n.is_read;
      if (notificationFilter === 'Important') {
        const { category } = categorizeNotification(n);
        return category === 'VIOLATIONS' || category === 'SCHEDULES';
      }
      return true;
    });
    return base.slice(0, 10);
  }, [notifications, notificationFilter]);

  const groupedNotifications = useMemo(() => {
    const buckets: Record<string, Notification[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] };
    const now = dayjs();
    filteredNotifications.forEach((n) => {
      const d = dayjs(n.created_at);
      if (!d.isValid()) {
        buckets.Older.push(n);
        return;
      }
      if (d.isSame(now, 'day')) buckets.Today.push(n);
      else if (d.isSame(now.subtract(1, 'day'), 'day')) buckets.Yesterday.push(n);
      else if (d.isAfter(now.subtract(7, 'day'))) buckets['This Week'].push(n);
      else buckets.Older.push(n);
    });
    return buckets;
  }, [filteredNotifications]);

  type UpcomingEvent = {
    key: string;
    assessmentId: string;
    title: string;
    courseCode: string;
    kind: 'Starts' | 'Closes';
    at: string;
  };

  const upcomingEvents = useMemo<UpcomingEvent[]>(() => {
    const now = dayjs();
    const events: UpcomingEvent[] = [];

    assessmentsAll.forEach((a) => {
      if (a.scheduled_at && dayjs(a.scheduled_at).isAfter(now)) {
        events.push({
          key: `${a.id}-start`,
          assessmentId: a.id,
          title: a.title,
          courseCode: a.course_code,
          kind: 'Starts',
          at: a.scheduled_at,
        });
      }

      const closesIso = a.closes_at || a.ends_at || null;
      if (closesIso && dayjs(closesIso).isAfter(now)) {
        events.push({
          key: `${a.id}-close`,
          assessmentId: a.id,
          title: a.title,
          courseCode: a.course_code,
          kind: 'Closes',
          at: closesIso,
        });
      }
    });

    return events
      .filter((e) => dayjs(e.at).isValid())
      .sort((a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf())
      .slice(0, 6);
  }, [assessmentsAll]);

  const teacherCourseIdSet = useMemo(() => new Set((data?.courses || []).map((c) => c.id)), [data?.courses]);

  const recentDocuments = useMemo<Document[]>(() => {
    const docs = ((documentsPage?.results || []) as Document[]).filter((d) => !d.course || teacherCourseIdSet.has(d.course));
    return docs
      .filter((d) => dayjs(d.updated_at).isValid())
      .sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf())
      .slice(0, 5);
  }, [documentsPage?.results, teacherCourseIdSet]);

  const analytics = useMemo(() => {
    const typeLabels: Record<string, string> = {
      [AssessmentType.EXAM]: 'Exam',
      [AssessmentType.QUIZ]: 'Quiz',
      [AssessmentType.ASSIGNMENT]: 'Assignment',
      [AssessmentType.PROJECT]: 'Project',
    };

    const trend = assessmentsAll
      .filter((a) => a.average_score !== null && a.average_score !== undefined && a.total_marks)
      .map((a) => {
        const dateIso = a.scheduled_at || a.created_at;
        const pct = clamp((Number(a.average_score) / Number(a.total_marks || 100)) * 100, 0, 100);
        return {
          key: a.id,
          label: dayjs(dateIso).isValid() ? dayjs(dateIso).format('MMM D') : a.title.slice(0, 8),
          at: dateIso,
          avg: Number(pct.toFixed(1)),
        };
      })
      .filter((d) => dayjs(d.at).isValid())
      .sort((a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf())
      .slice(-14);

    const bars = assessmentsAll
      .map((a) => ({
        key: a.id,
        label: a.title.length > 14 ? `${a.title.slice(0, 14)}…` : a.title,
        at: a.scheduled_at || a.created_at,
        submissions: Number(a.total_submissions || 0),
        submissionRate: Number(a.submission_rate || 0),
      }))
      .filter((d) => dayjs(d.at).isValid())
      .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())
      .slice(0, 8)
      .reverse();

    const typeCounts: Record<string, number> = {};
    assessmentsAll.forEach((a) => {
      const t = a.assessment_type || 'UNKNOWN';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typePie = Object.entries(typeCounts)
      .map(([key, value]) => ({ name: typeLabels[key] || key, value }))
      .sort((a, b) => b.value - a.value);

    return { trend, bars, typePie };
  }, [assessmentsAll]);

  type ActivityFeedItem = {
    key: string;
    at: string;
    icon: React.ReactNode;
    title: string;
    description?: string;
    route?: string;
  };

  const activityFeed = useMemo<ActivityFeedItem[]>(() => {
    const items: ActivityFeedItem[] = [];

    (gradingQueuePage?.results as any[] | undefined)?.slice(0, 10).forEach((s) => {
      if (!s?.submitted_at) return;
      items.push({
        key: `sub-${s.id}`,
        at: String(s.submitted_at),
        icon: <FileTextOutlined />,
        title: `Submission received`,
        description: `${s.student_email} submitted ${s.assessment_title}`,
        route: `/dashboard/assessments/${s.assessment}`,
      });
    });

    pendingEnrollmentsList.slice(0, 10).forEach((e) => {
      items.push({
        key: `enr-${e.id}`,
        at: e.enrolled_at,
        icon: <TeamOutlined />,
        title: `Enrollment request`,
        description: `${e.student_email} requested ${e.course_code}`,
        route: '/dashboard/enrollments',
      });
    });

    assessmentsAll.slice(0, 10).forEach((a) => {
      items.push({
        key: `asm-${a.id}`,
        at: a.created_at,
        icon: <PlusOutlined />,
        title: `Assessment created`,
        description: `${a.title} (${a.course_code})`,
        route: `/dashboard/assessments/${a.id}`,
      });
    });

    return items
      .filter((i) => dayjs(i.at).isValid())
      .sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf())
      .slice(0, 10);
  }, [assessmentsAll, gradingQueuePage?.results, pendingEnrollmentsList]);

  const statGradients = {
    courses: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 55%, #90caf9 120%)',
    students: 'linear-gradient(135deg, #10b981 0%, #22c55e 60%, #86efac 120%)',
    assessments: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 55%, #ce93d8 120%)',
    approvals: 'linear-gradient(135deg, #ff9800 0%, #f57c00 55%, #ffd180 120%)',
    grading: 'linear-gradient(135deg, #ef4444 0%, #dc2626 60%, #fca5a5 120%)',
    performance: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 60%, #67e8f9 120%)',
  };

  const handleApprove = async (enrollmentId: string) => {
    try {
      await approveEnrollmentMutation.mutateAsync(enrollmentId);
      message.success('Enrollment approved');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Failed to approve enrollment');
    }
  };

  const handleReject = async (enrollmentId: string) => {
    try {
      await rejectEnrollmentMutation.mutateAsync(enrollmentId);
      message.success('Enrollment rejected');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Failed to reject enrollment');
    }
  };

  const bulkApproveAll = async () => {
    if (!pendingEnrollmentsList.length) return;
    for (const e of pendingEnrollmentsList) {
      // sequential to avoid request spikes
      // eslint-disable-next-line no-await-in-loop
      await handleApprove(e.id);
    }
  };

  const bulkRejectAll = async () => {
    if (!pendingEnrollmentsList.length) return;
    for (const e of pendingEnrollmentsList) {
      // eslint-disable-next-line no-await-in-loop
      await handleReject(e.id);
    }
  };

  const courseColumns: ColumnsType<TeacherCourse> = [
    {
      title: 'Course',
      key: 'course',
      sorter: (a, b) => `${a.code} ${a.title}`.localeCompare(`${b.code} ${b.title}`),
      render: (_: any, c: TeacherCourse) => (
        <Space size={12} style={{ minWidth: 0 }}>
          <Avatar style={{ background: 'rgba(33,150,243,0.16)', color: '#2196f3' }} icon={<BookOutlined />} />
          <div style={{ minWidth: 0 }}>
            <Space size={8} wrap>
              <Tag color="geekblue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                {c.code}
              </Tag>
              <Text strong>{c.title}</Text>
              {c.department ? (
                <Tag color="cyan" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                  {c.department}
                </Tag>
              ) : null}
            </Space>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {(() => {
                  const meta = coursesMetaById.get(c.id);
                  return meta?.updated_at ? `Last updated ${timeAgo(meta.updated_at)}` : 'Last updated —';
                })()}
              </Text>
              <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{c.student_count} enrolled</Tag>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'course_status',
      sorter: (a, b) => {
        const aUi = courseStatusUi(coursesMetaById.get(a.id)?.status);
        const bUi = courseStatusUi(coursesMetaById.get(b.id)?.status);
        const order: Record<CourseStatusUi, number> = { Upcoming: 0, Active: 1, Completed: 2 };
        return order[aUi] - order[bUi];
      },
      render: (_: any, c) => {
        const ui = courseStatusUi(coursesMetaById.get(c.id)?.status);
        const color = ui === 'Active' ? 'green' : ui === 'Upcoming' ? 'blue' : 'default';
        return (
          <Tag color={color} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {ui}
          </Tag>
        );
      },
    },
    {
      title: 'Students',
      dataIndex: 'student_count',
      key: 'student_count',
      sorter: (a, b) => a.student_count - b.student_count,
      render: (count: number, record: TeacherCourse) => (
        <Button type="link" onClick={() => navigate(`/dashboard/courses/${record.id}`)} style={{ padding: 0 }}>
          <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {count}
          </Tag>
        </Button>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      sorter: (a, b) => {
        const toPct = (id: string) => {
          const ui = courseStatusUi(coursesMetaById.get(id)?.status);
          return ui === 'Completed' ? 100 : ui === 'Upcoming' ? 20 : 60;
        };
        return toPct(a.id) - toPct(b.id);
      },
      render: (_: any, c) => {
        const ui = courseStatusUi(coursesMetaById.get(c.id)?.status);
        const percent = ui === 'Completed' ? 100 : ui === 'Upcoming' ? 20 : 60;
        return (
          <Progress
            percent={percent}
            size="small"
            showInfo={false}
            strokeColor="linear-gradient(135deg, #2196f3 0%, #9c27b0 100%)"
          />
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, c: TeacherCourse) => (
        <Space size={6} wrap>
          <Tooltip title="View course details">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/dashboard/courses/${c.id}`)} />
          </Tooltip>
          <Tooltip title="Create assessment">
            <Button type="text" icon={<PlusOutlined />} onClick={() => navigate('/dashboard/assessments/new', { state: { preselectCourseId: c.id } })} />
          </Tooltip>
          <Tooltip title="Edit course (Admin/HOD only)">
            <Button type="text" icon={<EditOutlined />} disabled />
          </Tooltip>
          <Tooltip title="Attendance (coming soon)">
            <Button type="text" icon={<TeamOutlined />} disabled />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const assessmentColumns: ColumnsType<Assessment> = [
    {
      title: 'Assessment',
      key: 'assessment',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (_: any, a) => (
        <div style={{ minWidth: 0 }}>
          <Button type="link" onClick={() => navigate(`/dashboard/assessments/${a.id}`)} style={{ padding: 0, fontWeight: 600 }}>
            {a.title}
          </Button>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{a.course_code}</Tag>
            {statusPill(a.status)}
          </div>
        </div>
      ),
    },
    {
      title: 'Scheduled',
      key: 'scheduled',
      render: (_: any, a) => <Text>{a.scheduled_at ? dayjs(a.scheduled_at).format('MMM D • h:mm A') : '—'}</Text>,
    },
    {
      title: 'Submissions',
      key: 'submissions',
      render: (_: any, a) => {
        const subs = Number(a.total_submissions || 0);
        const rate = Number(a.submission_rate || 0);
        const expected = rate > 0 ? Math.round((subs * 100) / rate) : null;
        return <Text strong>{expected ? `${subs}/${expected}` : `${subs}`}</Text>;
      },
    },
    {
      title: 'Avg',
      key: 'avg',
      render: (_: any, a) => {
        if (a.average_score === null || a.average_score === undefined) return '—';
        const pct = clamp((Number(a.average_score) / Number(a.total_marks || 100)) * 100, 0, 100);
        return <Text strong>{pct.toFixed(1)}%</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, a) => (
        <Space size={6} wrap>
          <Tooltip title="View">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/dashboard/assessments/${a.id}`)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/dashboard/assessments/${a.id}/edit`)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Teacher Dashboard
          </Title>
          <Text type="secondary">Your courses, students, assessments, and what needs attention today.</Text>
        </div>

        <Card bodyStyle={{ padding: 14 }} style={{ border: '1px solid var(--stroke)', minWidth: 280 }}>
          <SectionHeader
            icon={<PlusOutlined />}
            title="Quick Actions"
            subtitle="Jump into common tasks"
            extra={
              <Button type="link" onClick={() => navigate('/dashboard')} style={{ padding: 0 }}>
                Home
              </Button>
            }
          />
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate('/dashboard/assessments/new')}>
              Create Assessment
            </Button>
            <Tooltip title="Only Admin/HOD can create courses">
              <Button icon={<BookOutlined />} disabled>
                Add Course
              </Button>
            </Tooltip>
            <Button icon={<BarChartOutlined />} onClick={() => navigate('/dashboard/assessments')}>
              View Reports
            </Button>
            <Tooltip title="Scheduling is handled by Admin/HOD">
              <Button icon={<CalendarOutlined />} disabled>
                Schedule Exam
              </Button>
            </Tooltip>
          </div>
        </Card>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 18 }}>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="My Courses"
            value={coursesTotal}
            icon={<BookOutlined />}
            gradient={statGradients.courses}
            meta={coursesTotal ? '↑ 1 new this semester' : '—'}
            loading={isLoading}
            onClick={() => navigate('/dashboard/courses')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Total Students"
            value={studentsTotal}
            icon={<TeamOutlined />}
            gradient={statGradients.students}
            meta={`Across ${coursesTotal || 0} courses`}
            loading={isLoading}
            onClick={() => navigate('/dashboard/enrollments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Active Assessments"
            value={activeAssessmentsCount}
            icon={<FileTextOutlined />}
            gradient={statGradients.assessments}
            meta={gradingQueueCount ? `${gradingQueueCount} pending grading` : 'No grading backlog'}
            loading={assessmentsLoading}
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Pending Approvals"
            value={pendingEnrollmentsCount}
            icon={<ClockCircleOutlined />}
            gradient={statGradients.approvals}
            meta={pendingEnrollmentsCount > 5 ? 'Urgent: 5+ waiting' : 'On track'}
            loading={pendingLoading}
            onClick={() => navigate('/dashboard/enrollments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Grading Queue"
            value={gradingQueueCount}
            icon={<EditOutlined />}
            gradient={statGradients.grading}
            meta={gradingQueueCount ? 'Review submissions' : 'All graded'}
            loading={!gradingQueuePage}
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Average Performance"
            value={avgPerformance === null ? '—' : `${avgPerformance.toFixed(1)}%`}
            icon={<BarChartOutlined />}
            gradient={statGradients.performance}
            meta={avgPerformance === null ? 'No graded data yet' : 'Across recent assessments'}
            loading={assessmentsLoading}
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<BookOutlined />}
              title="My Classes"
              subtitle="Courses you're currently teaching"
              extra={
                <Button type="link" onClick={() => navigate('/dashboard/courses')} style={{ padding: 0 }}>
                  View all
                </Button>
              }
            />

            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              <Search
                placeholder="Search courses (code, title, department)"
                allowClear
                onSearch={setCourseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                value={courseSearch}
                style={{ maxWidth: 420 }}
                prefix={<SearchOutlined />}
              />
              <Space size={10} wrap>
                <Select
                  placeholder="Department"
                  allowClear
                  value={departmentFilter}
                  onChange={(v) => setDepartmentFilter(v)}
                  style={{ width: 200 }}
                  options={departmentOptions.map((d) => ({ label: d, value: d }))}
                />
                <Select
                  placeholder="Status"
                  allowClear
                  value={courseStatusFilter === 'All' ? undefined : courseStatusFilter}
                  onChange={(v) => setCourseStatusFilter((v as CourseStatusUi) || 'All')}
                  style={{ width: 170 }}
                  options={[
                    { label: 'Active', value: 'Active' },
                    { label: 'Upcoming', value: 'Upcoming' },
                    { label: 'Completed', value: 'Completed' },
                  ]}
                />
              </Space>
            </div>

            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <Table
                  columns={courseColumns}
                  dataSource={filteredCourses}
                  rowKey="id"
                  pagination={{ pageSize: 6, hideOnSinglePage: true }}
                  size="middle"
                  scroll={{ x: 820 }}
                  onRow={(_, index) => ({
                    style: {
                      background: index % 2 === 0 ? 'transparent' : 'rgba(41, 99, 116, 0.06)',
                    },
                  })}
                />
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<FileTextOutlined />}
              title="Recent Assessments"
              subtitle="Create, track progress, and review submissions"
              extra={
                <Space size={10} wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dashboard/assessments/new')}>
                    Create Assessment
                  </Button>
                  <Button icon={<BarChartOutlined />} onClick={() => navigate('/dashboard/assessments')}>
                    View all
                  </Button>
                </Space>
              }
            />

            <div style={{ marginTop: 14 }}>
              <Segmented options={['All', 'Draft', 'Active', 'Completed']} value={assessmentFilter} onChange={(v) => setAssessmentFilter(v as AssessmentFilter)} />
            </div>

            <div style={{ marginTop: 14 }}>
              {assessmentsLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : filteredAssessments.length ? (
                <Table
                  columns={assessmentColumns}
                  dataSource={filteredAssessments.slice(0, 8)}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  scroll={{ x: 920 }}
                  onRow={(_, index) => ({
                    style: {
                      background: index % 2 === 0 ? 'transparent' : 'rgba(41, 99, 116, 0.06)',
                    },
                  })}
                />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
                  <Empty
                    image={educationIllustration}
                    imageStyle={{ height: 160 }}
                    description={
                      <div>
                        <Text strong style={{ display: 'block' }}>
                          No assessments yet
                        </Text>
                        <Text type="secondary">Create your first assessment to start evaluating your class.</Text>
                      </div>
                    }
                  >
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dashboard/assessments/new')}>
                      Create your first assessment
                    </Button>
                  </Empty>
                </div>
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }}>
            <SectionHeader
              icon={<TeamOutlined />}
              title="Enrollment Requests"
              subtitle="Approve or reject students requesting access"
              extra={
                <Badge count={pendingEnrollmentsCount} color="#ff4d4f">
                  <Button onClick={() => navigate('/dashboard/enrollments')}>View all</Button>
                </Badge>
              }
            />

            <div style={{ marginTop: 14 }}>
              {pendingLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : pendingEnrollmentsCount ? (
                <List
                  dataSource={pendingEnrollmentsList.slice(0, 8)}
                  renderItem={(e) => (
                    <List.Item
                      actions={[
                        <Button key="approve" type="primary" onClick={() => handleApprove(e.id)}>
                          <CheckOutlined /> Approve
                        </Button>,
                        <Button key="reject" danger onClick={() => handleReject(e.id)}>
                          <CloseOutlined /> Reject
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'linear-gradient(135deg, #2196f3 0%, #9c27b0 100%)', fontWeight: 700 }}>
                            {initialsFrom(`${e.student_first_name} ${e.student_last_name}`.trim() || e.student_email)}
                          </Avatar>
                        }
                        title={
                          <Space size={10} wrap>
                            <Text strong>
                              {e.student_first_name} {e.student_last_name}
                            </Text>
                            <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{e.course_code}</Tag>
                            <Text type="secondary">{e.student_email}</Text>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Requested {timeAgo(e.enrolled_at)}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending enrollment requests." />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<BellOutlined />}
              title="Notifications"
              subtitle="Updates, submissions, schedules, and alerts"
              extra={
                <Space size={10} wrap>
                  <Badge count={unreadCount?.count || 0} color="#ff4d4f" />
                  <Button type="link" onClick={() => markAllReadMutation.mutate()} style={{ padding: 0 }} disabled={markAllReadMutation.isPending}>
                    Mark all read
                  </Button>
                </Space>
              }
            />

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <Segmented options={['All', 'Unread', 'Important']} value={notificationFilter} onChange={(v) => setNotificationFilter(v as NotificationFilter)} />
              <Button type="link" onClick={() => navigate('/dashboard/notifications')} style={{ padding: 0 }}>
                View all
              </Button>
            </div>

            <div style={{ marginTop: 14 }}>
              {notificationsQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : filteredNotifications.length ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {(['Today', 'Yesterday', 'This Week', 'Older'] as const).map((bucket) =>
                    groupedNotifications[bucket].length ? (
                      <div key={bucket}>
                        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          {bucket}
                        </Text>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {groupedNotifications[bucket].slice(0, 3).map((n) => {
                            const { category, tone } = categorizeNotification(n);
                            const meta = toneMeta(tone);
                            const priorityDot = category === 'VIOLATIONS' ? '#ef4444' : category === 'SCHEDULES' ? '#f59e0b' : meta.dot;

                            return (
                              <div
                                key={n.id}
                                className="sentra-hover-lift"
                                style={{
                                  borderRadius: 14,
                                  border: '1px solid var(--stroke)',
                                  borderLeft: `4px solid ${meta.border}`,
                                  padding: 12,
                                  cursor: 'pointer',
                                  background: n.is_read ? 'transparent' : 'rgba(33,150,243,0.06)',
                                }}
                                onClick={() => navigate(routeFromNotification(n))}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') navigate(routeFromNotification(n));
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                  <Space size={10} style={{ minWidth: 0 }} align="start">
                                    <span style={{ width: 10, height: 10, borderRadius: 999, background: priorityDot, marginTop: 6 }} aria-hidden />
                                    <div style={{ minWidth: 0 }}>
                                      <Space size={10} wrap>
                                        <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{meta.icon}</Tag>
                                        <Text strong>{n.subject}</Text>
                                      </Space>
                                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                                        {n.body}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                                        {timeAgo(n.created_at)}
                                      </Text>
                                    </div>
                                  </Space>
                                  {!n.is_read ? (
                                    <Tooltip title="Mark as read">
                                      <Button
                                        type="text"
                                        icon={<CheckOutlined />}
                                        loading={markReadMutation.isPending}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markReadMutation.mutate(n.id);
                                        }}
                                        aria-label="Mark notification as read"
                                      />
                                    </Tooltip>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null
                  )}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You're all caught up." />
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }}>
            <SectionHeader
              icon={<EditOutlined />}
              title="Grading Queue"
              subtitle="Submissions awaiting review"
              extra={
                <Button type="link" onClick={() => navigate('/dashboard/assessments')} style={{ padding: 0 }}>
                  Open assessments <ArrowRightOutlined />
                </Button>
              }
            />
            <div style={{ marginTop: 14 }}>
              {!gradingQueuePage ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : gradingQueueCount ? (
                <List
                  dataSource={(gradingQueuePage.results as any[]).slice(0, 6)}
                  renderItem={(s: any) => (
                    <List.Item
                      actions={[
                        <Button key="grade" type="primary" onClick={() => navigate(`/dashboard/assessments/${s.assessment}`)}>
                          Grade Now
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)', fontWeight: 700 }}>
                            {initialsFrom(String(s.student_email || 'S'))}
                          </Avatar>
                        }
                        title={
                          <Space size={10} wrap>
                            <Text strong>{s.student_email}</Text>
                            <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{s.assessment_title}</Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Submitted {timeAgo(s.submitted_at)}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending submissions." />
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TeacherDashboard;
