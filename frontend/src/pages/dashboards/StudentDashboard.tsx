import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Progress,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  ScheduleOutlined,
  SearchOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';
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

import educationIllustration from '../../assets/education-illustration.svg';
import { useStudentDashboard, type StudentExam, type StudentEnrollment } from '../../api/dashboard';
import { useAssessmentSubmissions } from '../../api/assessments';
import { useCourses } from '../../api/courses';
import {
  listNotifications,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useUnreadNotificationCount,
} from '../../api/notifications';
import { useDocuments, useDownloadDocument } from '../../api/documents';
import type { AssessmentSubmission, Course, Document, Notification } from '../../types';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Search } = Input;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const initialsFrom = (nameOrEmail: string) => {
  const cleaned = (nameOrEmail || '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (cleaned.includes('@')) return cleaned[0].toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
};

const countdown = (iso: string) => {
  const target = dayjs(iso);
  const now = dayjs();
  if (!target.isValid()) return '--';
  const diffSec = target.diff(now, 'second');
  if (diffSec <= 0) return 'Now';
  if (diffSec < 3600) return `${Math.ceil(diffSec / 60)} min`;
  if (diffSec < 86400) return `${Math.ceil(diffSec / 3600)} hr`;
  return `${Math.ceil(diffSec / 86400)} days`;
};

const letterFromPercent = (pct: number) => {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
};

const filenameFromUrl = (url: string) => {
  const raw = (url || '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'download';
};

const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escapeCell = (val: string) => {
    const v = (val ?? '').toString().replaceAll('"', '""');
    return `"${v}"`;
  };

  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

type NotificationFilter = 'All' | 'Unread' | 'Important';
type NotificationTone = 'success' | 'warning' | 'error' | 'info';
type NotificationCategory = 'ANNOUNCEMENTS' | 'GRADES' | 'MATERIALS' | 'REMINDERS' | 'APPROVALS' | 'INFO';

const categorizeNotification = (n: Notification): { category: NotificationCategory; tone: NotificationTone } => {
  const action = String(n.metadata?.action || n.metadata?.type || '').toLowerCase();
  const text = `${n.subject} ${n.body}`.toLowerCase();

  if (action.includes('graded') || text.includes('graded') || text.includes('score')) {
    return { category: 'GRADES', tone: 'success' };
  }
  if (action.includes('announcement') || text.includes('announcement') || text.includes('instruction')) {
    return { category: 'ANNOUNCEMENTS', tone: 'info' };
  }
  if (action.includes('document') || text.includes('material') || text.includes('uploaded')) {
    return { category: 'MATERIALS', tone: 'info' };
  }
  if (action.includes('reminder') || text.includes('reminder') || text.includes('deadline')) {
    return { category: 'REMINDERS', tone: 'warning' };
  }
  if (action.includes('enrollment') || text.includes('enrollment') || text.includes('approved') || text.includes('rejected')) {
    return { category: 'APPROVALS', tone: 'info' };
  }
  return { category: 'INFO', tone: 'info' };
};

const toneMeta = (tone: NotificationTone) => {
  switch (tone) {
    case 'success':
      return { border: '#16a34a', dot: '#16a34a' };
    case 'warning':
      return { border: '#f59e0b', dot: '#f59e0b' };
    case 'error':
      return { border: '#ef4444', dot: '#ef4444' };
    default:
      return { border: '#2196f3', dot: '#94a3b8' };
  }
};

const routeFromNotification = (n: Notification) => {
  const assessmentId = n.metadata?.assessment_id as string | undefined;
  const courseId = n.metadata?.course_id as string | undefined;
  if (assessmentId) return `/dashboard/assessments/${assessmentId}`;
  if (courseId) return `/dashboard/courses/${courseId}`;
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
  value: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  meta?: React.ReactNode;
  side?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
}> = ({ title, value, icon, gradient, meta, side, loading, onClick }) => (
  <Card
    className="sentra-hover-lift"
    bodyStyle={{ padding: 18 }}
    style={{ border: 'none', background: gradient, overflow: 'hidden', position: 'relative', height: '100%', cursor: onClick ? 'pointer' : 'default' }}
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

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {loading ? (
          <Skeleton.Input active size="small" style={{ width: 120, background: 'rgba(255,255,255,0.2)' }} />
        ) : (
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>{value}</div>
        )}
        {side ? <div>{side}</div> : null}
      </div>

      {meta ? <Text style={{ display: 'block', marginTop: 10, color: 'rgba(255,255,255,0.86)' }}>{meta}</Text> : null}
    </div>
  </Card>
);

type UpcomingView = 'Cards' | 'Timeline';
type UpcomingFilter = 'All' | 'This Week' | 'This Month';
type UpcomingSort = 'Date' | 'Course' | 'Priority';
type CourseStatusUi = 'Active' | 'Upcoming' | 'Completed';

const courseStatusUi = (raw?: string | null): CourseStatusUi => {
  if (raw === 'ARCHIVED') return 'Completed';
  if (raw === 'DRAFT') return 'Upcoming';
  return 'Active';
};

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useStudentDashboard();
  const { data: coursesPage } = useCourses({ page: 1 });
  const { data: gradedPage, isLoading: gradedLoading } = useAssessmentSubmissions({ status: 'GRADED' });
  const { data: documentsPage, isLoading: documentsLoading } = useDocuments({ page: 1 });
  const downloadDocMutation = useDownloadDocument();

  const { data: unreadCount } = useUnreadNotificationCount();
  const notificationsQuery = useQuery({
    queryKey: ['notifications', { page: 1 }],
    queryFn: () => listNotifications({ page: 1 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  const [upcomingView, setUpcomingView] = useState<UpcomingView>('Cards');
  const [upcomingFilter, setUpcomingFilter] = useState<UpcomingFilter>('All');
  const [upcomingCourse, setUpcomingCourse] = useState<string | undefined>();
  const [upcomingSort, setUpcomingSort] = useState<UpcomingSort>('Date');
  const [coursesSearch, setCoursesSearch] = useState('');
  const [coursesStatus, setCoursesStatus] = useState<CourseStatusUi | 'All'>('All');
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('All');

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load Student Dashboard"
        description="Please refresh the page or login again."
        showIcon
      />
    );
  }

  const enrollments = (data?.enrollments || []) as StudentEnrollment[];
  const upcomingExams = (data?.upcoming_exams || []) as StudentExam[];
  const pastExams = (data?.past_exams || []) as StudentExam[];
  const totalEnrollments = data?.total_enrollments || 0;
  const attendancePct = data?.attendance_percentage ?? null;

  const coursesMetaById = useMemo(() => {
    const map = new Map<string, Course>();
    (coursesPage?.results || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [coursesPage?.results]);

  const creditProgress = useMemo(() => {
    let total = 0;
    let completed = 0;
    let active = 0;

    enrollments.forEach((e) => {
      const course = coursesMetaById.get(e.course_id);
      if (!course) return;
      const credits = Number(course.credits || 0);
      total += credits;
      if (course.status === 'ARCHIVED') completed += credits;
      if (course.status === 'ACTIVE') active += 1;
    });

    return { total, completed, active };
  }, [coursesMetaById, enrollments]);

  const nextExam = useMemo(() => {
    const sorted = [...upcomingExams].sort((a, b) => {
      const aAt = a.scheduled_at ? dayjs(a.scheduled_at).valueOf() : Number.MAX_SAFE_INTEGER;
      const bAt = b.scheduled_at ? dayjs(b.scheduled_at).valueOf() : Number.MAX_SAFE_INTEGER;
      return aAt - bAt;
    });
    return sorted[0] || null;
  }, [upcomingExams]);

  const nextExamStartsIn = nextExam?.scheduled_at ? dayjs(nextExam.scheduled_at).fromNow() : null;
  const nextExamUrgent = nextExam?.scheduled_at ? dayjs(nextExam.scheduled_at).diff(dayjs(), 'day') < 3 : false;

  const courseCodes = useMemo(() => {
    const set = new Set<string>();
    enrollments.forEach((e) => set.add(e.course_code));
    upcomingExams.forEach((e) => set.add(e.course_code));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enrollments, upcomingExams]);

  const filteredUpcomingExams = useMemo(() => {
    const now = dayjs();

    const filtered = upcomingExams
      .filter((e) => !upcomingCourse || e.course_code === upcomingCourse)
      .filter((e) => {
        if (upcomingFilter === 'All') return true;
        if (!e.scheduled_at) return false;
        const at = dayjs(e.scheduled_at);
        if (!at.isValid()) return false;
        if (upcomingFilter === 'This Week') return at.isBefore(now.add(7, 'day'));
        return at.isBefore(now.add(30, 'day'));
      });

    return filtered.sort((a, b) => {
      const aAt = a.scheduled_at ? dayjs(a.scheduled_at).valueOf() : 0;
      const bAt = b.scheduled_at ? dayjs(b.scheduled_at).valueOf() : 0;
      if (upcomingSort === 'Course') return a.course_code.localeCompare(b.course_code);
      if (upcomingSort === 'Priority') return aAt - bAt;
      return aAt - bAt;
    });
  }, [upcomingCourse, upcomingExams, upcomingFilter, upcomingSort]);

  const assessmentMetaById = useMemo(() => {
    const map = new Map<string, { totalMarks: number; courseCode: string; title: string }>();
    [...upcomingExams, ...pastExams].forEach((e) => {
      map.set(e.id, { totalMarks: Number(e.total_marks || 0), courseCode: e.course_code, title: e.title });
    });
    return map;
  }, [pastExams, upcomingExams]);

  const gradedSubmissions = ((gradedPage?.results || []) as AssessmentSubmission[]).filter(
    (s) => s.score !== null && s.score !== undefined
  );

  const gradedWithPct = useMemo(() => {
    const rows = gradedSubmissions
      .map((s) => {
        const meta = assessmentMetaById.get(String(s.assessment));
        const totalMarks = meta?.totalMarks || 0;
        if (!totalMarks) return null;
        const pct = clamp((Number(s.score || 0) / totalMarks) * 100, 0, 100);
        return {
          key: s.id,
          assessmentId: String(s.assessment),
          title: s.assessment_title,
          courseCode: meta?.courseCode || '',
          submittedAt: s.submitted_at,
          score: Number(s.score || 0),
          totalMarks,
          pct: Number(pct.toFixed(1)),
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      assessmentId: string;
      title: string;
      courseCode: string;
      submittedAt: string;
      score: number;
      totalMarks: number;
      pct: number;
    }>;

    return rows.sort((a, b) => dayjs(b.submittedAt).valueOf() - dayjs(a.submittedAt).valueOf());
  }, [assessmentMetaById, gradedSubmissions]);

  const performance = useMemo(() => {
    if (!gradedWithPct.length) return null;
    const recent = gradedWithPct.slice(0, 6).map((r) => r.pct);
    const avgPct = recent.reduce((acc, v) => acc + v, 0) / recent.length;
    const gpa = clamp(avgPct / 25, 0, 4);
    const prev = gradedWithPct.slice(6, 12).map((r) => r.pct);
    const prevAvg = prev.length ? prev.reduce((acc, v) => acc + v, 0) / prev.length : avgPct;
    const deltaGpa = clamp((avgPct - prevAvg) / 25, -4, 4);
    return { avgPct: Number(avgPct.toFixed(1)), gpa: Number(gpa.toFixed(2)), deltaGpa: Number(deltaGpa.toFixed(2)) };
  }, [gradedWithPct]);

  const recentGrade = gradedWithPct[0] || null;

  const chartData = useMemo(() => {
    const trend = gradedWithPct
      .slice(0, 10)
      .map((g) => ({
        key: g.key,
        label: dayjs(g.submittedAt).isValid() ? dayjs(g.submittedAt).format('MMM D') : g.title.slice(0, 8),
        pct: g.pct,
      }))
      .reverse();

    const bars = gradedWithPct
      .slice(0, 8)
      .map((g) => ({
        key: g.key,
        label: g.title.length > 16 ? `${g.title.slice(0, 16)}...` : g.title,
        pct: g.pct,
      }))
      .reverse();

    const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    gradedWithPct.slice(0, 20).forEach((g) => {
      const letter = letterFromPercent(g.pct);
      dist[letter as keyof typeof dist] += 1;
    });
    const pie = (Object.keys(dist) as Array<keyof typeof dist>).map((k) => ({ name: k, value: dist[k] }));

    return { trend, bars, pie };
  }, [gradedWithPct]);

  const pendingAssignments = useMemo(() => {
    const types = new Set(['ASSIGNMENT', 'PROJECT']);
    const list = upcomingExams.filter((e) => types.has(String(e.assessment_type || '').toUpperCase()) && e.student_status !== 'SUBMITTED');
    return list.sort((a, b) => {
      const aAt = a.closes_at ? dayjs(a.closes_at).valueOf() : a.scheduled_at ? dayjs(a.scheduled_at).valueOf() : 0;
      const bAt = b.closes_at ? dayjs(b.closes_at).valueOf() : b.scheduled_at ? dayjs(b.scheduled_at).valueOf() : 0;
      return aAt - bAt;
    });
  }, [upcomingExams]);

  type DeadlineItem = {
    key: string;
    title: string;
    courseCode: string;
    kind: 'Starts' | 'Closes';
    at: string;
    route: string;
  };

  const upcomingDeadlines = useMemo<DeadlineItem[]>(() => {
    const now = dayjs();
    const items: DeadlineItem[] = [];

    upcomingExams.forEach((e) => {
      if (e.scheduled_at && dayjs(e.scheduled_at).isAfter(now)) {
        items.push({
          key: `${e.id}-start`,
          title: e.title,
          courseCode: e.course_code,
          kind: 'Starts',
          at: e.scheduled_at,
          route: `/dashboard/assessments/${e.id}`,
        });
      }
      if (e.closes_at && dayjs(e.closes_at).isAfter(now)) {
        items.push({
          key: `${e.id}-close`,
          title: e.title,
          courseCode: e.course_code,
          kind: 'Closes',
          at: e.closes_at,
          route: `/dashboard/assessments/${e.id}`,
        });
      }
    });

    return items
      .filter((i) => dayjs(i.at).isValid())
      .sort((a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf())
      .slice(0, 6);
  }, [upcomingExams]);

  const attendanceStatus = useMemo(() => {
    if (attendancePct === null) return null;
    if (attendancePct >= 90) return { label: 'Good', color: '#16a34a' };
    if (attendancePct >= 75) return { label: 'Warning', color: '#f59e0b' };
    return { label: 'Critical', color: '#ef4444' };
  }, [attendancePct]);

  const courseRows = useMemo(() => {
    const gradesByCourse: Record<string, number[]> = {};
    gradedWithPct.forEach((g) => {
      if (!g.courseCode) return;
      gradesByCourse[g.courseCode] = gradesByCourse[g.courseCode] || [];
      gradesByCourse[g.courseCode].push(g.pct);
    });

    return enrollments.map((e) => {
      const course = coursesMetaById.get(e.course_id);
      const status = courseStatusUi(course?.status);
      const progress = status === 'Completed' ? 100 : status === 'Upcoming' ? 20 : 60;
      const grades = gradesByCourse[e.course_code] || [];
      const avgPct = grades.length ? grades.reduce((acc, v) => acc + v, 0) / grades.length : null;

      return {
        ...e,
        dept: course?.department_name || course?.department || '',
        updated_at: course?.updated_at || null,
        credits: course?.credits ?? null,
        status,
        progress,
        avgPct: avgPct === null ? null : Number(avgPct.toFixed(1)),
      };
    });
  }, [coursesMetaById, enrollments, gradedWithPct]);

  const filteredCourses = useMemo(() => {
    const s = coursesSearch.trim().toLowerCase();
    return courseRows.filter((c) => {
      const matchesSearch = !s || `${c.course_code} ${c.course_title} ${c.teacher || ''} ${c.dept || ''}`.toLowerCase().includes(s);
      const matchesStatus = coursesStatus === 'All' || c.status === coursesStatus;
      return matchesSearch && matchesStatus;
    });
  }, [courseRows, coursesSearch, coursesStatus]);

  type CourseRow = (typeof courseRows)[number];
  const courseColumns: ColumnsType<CourseRow> = [
    {
      title: 'Course',
      key: 'course',
      sorter: (a, b) => `${a.course_code} ${a.course_title}`.localeCompare(`${b.course_code} ${b.course_title}`),
      render: (_: any, c) => (
        <Space size={12} style={{ minWidth: 0 }}>
          <Avatar style={{ background: 'rgba(33,150,243,0.16)', color: '#2196f3' }} icon={<BookOutlined />} />
          <div style={{ minWidth: 0 }}>
            <Space size={8} wrap>
              <Tag color="geekblue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                {c.course_code}
              </Tag>
              <Text strong>{c.course_title}</Text>
              {c.dept ? (
                <Tag color="cyan" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                  {c.dept}
                </Tag>
              ) : null}
            </Space>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {c.updated_at ? `Last activity ${dayjs(c.updated_at).fromNow()}` : 'Last activity -'}
              </Text>
              {c.credits !== null ? <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{c.credits} credits</Tag> : null}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (s: CourseStatusUi) => {
        const color = s === 'Active' ? 'green' : s === 'Upcoming' ? 'blue' : 'default';
        return (
          <Tag color={color} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {s}
          </Tag>
        );
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      sorter: (a, b) => a.progress - b.progress,
      render: (_: any, c) => (
        <Progress percent={c.progress} size="small" showInfo={false} strokeColor="linear-gradient(135deg, #2196f3 0%, #9c27b0 100%)" />
      ),
    },
    {
      title: 'Grade',
      key: 'grade',
      sorter: (a, b) => (a.avgPct ?? -1) - (b.avgPct ?? -1),
      render: (_: any, c) => {
        if (c.avgPct === null) return <Text type="secondary">--</Text>;
        const letter = letterFromPercent(c.avgPct);
        const color = c.avgPct >= 85 ? 'green' : c.avgPct >= 70 ? 'gold' : 'red';
        return (
          <Tag color={color} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {c.avgPct.toFixed(1)}% ({letter})
          </Tag>
        );
      },
    },
    {
      title: 'Teacher',
      dataIndex: 'teacher',
      key: 'teacher',
      render: (t: string | null, c) => (
        <Space size={10} wrap>
          <Avatar style={{ background: 'linear-gradient(135deg, #4caf50 0%, #2196f3 100%)', fontWeight: 700 }}>
            {initialsFrom(t || 'T')}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong>{t || '-'}</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Enrolled {c.enrolled_at ? dayjs(c.enrolled_at).fromNow() : '--'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, c) => (
        <Space size={6} wrap>
          <Tooltip title="View course details">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/dashboard/courses/${c.course_id}`)} />
          </Tooltip>
          <Tooltip title="Upcoming assignments">
            <Button type="text" icon={<ClockCircleOutlined />} onClick={() => navigate('/dashboard/assessments')} />
          </Tooltip>
          <Tooltip title="My grades">
            <Button type="text" icon={<BarChartOutlined />} onClick={() => navigate('/dashboard/assessments')} />
          </Tooltip>
          <Tooltip title="Course materials">
            <Button type="text" icon={<FileTextOutlined />} onClick={() => navigate('/dashboard/documents')} />
          </Tooltip>
          <Tooltip title={c.teacher ? 'Message teacher' : 'Teacher not assigned yet'}>
            <Button
              type="text"
              icon={<MessageOutlined />}
              disabled={!c.teacher}
              onClick={() => {
                if (!c.teacher) return;
                window.open(`mailto:${c.teacher}?subject=${encodeURIComponent(`Sentraexam: ${c.course_code}`)}`);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const statGradients = {
    courses: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 55%, #90caf9 120%)',
    exams: 'linear-gradient(135deg, #ef4444 0%, #dc2626 60%, #fca5a5 120%)',
    performance: 'linear-gradient(135deg, #4caf50 0%, #22c55e 55%, #86efac 120%)',
    attendance: 'linear-gradient(135deg, #ff9800 0%, #f57c00 60%, #ffd180 120%)',
    assignments: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 55%, #ce93d8 120%)',
    grades: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 60%, #67e8f9 120%)',
  };

  const examReminder = nextExam && nextExam.scheduled_at ? dayjs(nextExam.scheduled_at).diff(dayjs(), 'hour') <= 48 : false;

  const examTypePill = (t: string) => {
    const key = String(t || '').toUpperCase();
    if (key === 'EXAM') return <Tag color="red" style={{ borderRadius: 999, marginInlineEnd: 0 }}>Exam</Tag>;
    if (key === 'QUIZ') return <Tag color="purple" style={{ borderRadius: 999, marginInlineEnd: 0 }}>Quiz</Tag>;
    if (key === 'ASSIGNMENT') return <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>Assignment</Tag>;
    if (key === 'PROJECT') return <Tag color="cyan" style={{ borderRadius: 999, marginInlineEnd: 0 }}>Project</Tag>;
    return <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{key}</Tag>;
  };

  const examStatusTag = (exam: StudentExam) => {
    if (exam.student_status === 'SUBMITTED') {
      return (
        <Tag color="green" style={{ borderRadius: 999, marginInlineEnd: 0 }} icon={<CheckCircleOutlined />}>
          Completed
        </Tag>
      );
    }
    if (exam.student_status === 'IN_PROGRESS') {
      return (
        <Tag color="orange" style={{ borderRadius: 999, marginInlineEnd: 0 }} icon={<PlayCircleOutlined />}>
          In Progress
        </Tag>
      );
    }
    return (
      <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }} icon={<ClockCircleOutlined />}>
        Not Started
      </Tag>
    );
  };

  const pastExamRows = useMemo(() => {
    const gradeByAssessment = new Map<string, typeof gradedWithPct[number]>();
    gradedWithPct.forEach((g) => gradeByAssessment.set(g.assessmentId, g));
    return pastExams.map((e) => ({ ...e, grade: gradeByAssessment.get(e.id) || null }));
  }, [gradedWithPct, pastExams]);

  type PastExamRow = (typeof pastExamRows)[number];
  const pastExamColumns: ColumnsType<PastExamRow> = [
    {
      title: 'Assessment',
      key: 'assessment',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (_: any, e) => (
        <div style={{ minWidth: 0 }}>
          <Button
            type="link"
            onClick={() => navigate(`/dashboard/assessments/${e.id}`)}
            style={{ padding: 0, fontWeight: 600 }}
          >
            {e.title}
          </Button>
          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{e.course_code}</Tag>
            {examTypePill(e.assessment_type)}
            {examStatusTag(e)}
          </div>
        </div>
      ),
    },
    {
      title: 'Completed',
      key: 'completed',
      sorter: (a, b) => {
        const aAt = a.grade?.submittedAt ? dayjs(a.grade.submittedAt).valueOf() : 0;
        const bAt = b.grade?.submittedAt ? dayjs(b.grade.submittedAt).valueOf() : 0;
        return bAt - aAt;
      },
      render: (_: any, e) => <Text>{e.grade?.submittedAt ? dayjs(e.grade.submittedAt).format('MMM D, YYYY') : '-'}</Text>,
    },
    {
      title: 'Score',
      key: 'score',
      sorter: (a, b) => (a.grade?.pct ?? -1) - (b.grade?.pct ?? -1),
      render: (_: any, e) => {
        if (!e.grade) return <Text type="secondary">--</Text>;
        const letter = letterFromPercent(e.grade.pct);
        const color = e.grade.pct >= 85 ? 'green' : e.grade.pct >= 70 ? 'gold' : 'red';
        return (
          <Tag color={color} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {e.grade.score}/{e.grade.totalMarks} ({letter})
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, e) => (
        <Button icon={<EyeOutlined />} onClick={() => navigate(`/dashboard/assessments/${e.id}`)}>
          View Results
        </Button>
      ),
    },
  ];

  const notifications = (notificationsQuery.data?.results || []) as Notification[];
  const filteredNotifications = useMemo(() => {
    const base = notifications.filter((n) => {
      if (notificationFilter === 'Unread') return !n.is_read;
      if (notificationFilter === 'Important') {
        const { category } = categorizeNotification(n);
        return category === 'GRADES' || category === 'REMINDERS';
      }
      return true;
    });
    return base.slice(0, 10);
  }, [notificationFilter, notifications]);

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

  const enrolledCourseIdSet = useMemo(() => new Set(enrollments.map((e) => e.course_id)), [enrollments]);

  const recentDocs = useMemo(() => {
    const docs = ((documentsPage?.results || []) as Document[]).filter((d) => !d.course || enrolledCourseIdSet.has(d.course));
    return docs
      .filter((d) => dayjs(d.updated_at).isValid())
      .sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf())
      .slice(0, 6);
  }, [documentsPage?.results, enrolledCourseIdSet]);

  const handleDownloadDoc = async (doc: Document) => {
    try {
      const blob = await downloadDocMutation.mutateAsync(doc.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromUrl(doc.file) || `${doc.title || 'document'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success('Download started');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Failed to download document');
    }
  };

  const exportTranscript = () => {
    if (!gradedWithPct.length) return;
    downloadCsv(
      `sentraexam-transcript-${dayjs().format('YYYY-MM-DD')}.csv`,
      ['Assessment', 'Course', 'Score', 'Total', 'Percent', 'Submitted At'],
      gradedWithPct.map((g) => [
        g.title,
        g.courseCode,
        String(g.score),
        String(g.totalMarks),
        String(g.pct),
        g.submittedAt,
      ])
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ maxWidth: 780 }}>
          <Title level={2} style={{ marginBottom: 4 }}>
            Student Dashboard
          </Title>
          <Text type="secondary">Your courses, deadlines, and progress - all in one place.</Text>
          {examReminder && nextExam ? (
            <div style={{ marginTop: 12 }}>
              <Alert
                type={nextExamUrgent ? 'warning' : 'info'}
                showIcon
                message={`Study reminder: ${nextExam.title}`}
                description={nextExamStartsIn ? `Starts ${nextExamStartsIn}. Open the details to review instructions.` : 'Open the details to review instructions.'}
              />
            </div>
          ) : null}
        </div>

        <Card bodyStyle={{ padding: 14 }} style={{ border: '1px solid var(--stroke)', minWidth: 320 }}>
          <SectionHeader icon={<RocketOutlined />} title="Quick Actions" subtitle="Jump into your next task" />
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/dashboard/assessments')}>
              Practice / Exams
            </Button>
            <Button icon={<BookOutlined />} onClick={() => navigate('/dashboard/courses/enroll')}>
              Browse Courses
            </Button>
            <Button icon={<TrophyOutlined />} onClick={() => navigate('/dashboard/assessments')}>
              View Grades
            </Button>
            <Button icon={<ScheduleOutlined />} onClick={() => navigate('/dashboard/calendar')}>
              Check Schedule
            </Button>
            <Button icon={<FileTextOutlined />} onClick={() => navigate('/dashboard/documents')}>
              Materials
            </Button>
            <Button icon={<BellOutlined />} onClick={() => navigate('/dashboard/notifications')}>
              Announcements
            </Button>
          </div>
        </Card>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 18 }}>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Enrolled Courses"
            value={totalEnrollments}
            icon={<BookOutlined />}
            gradient={statGradients.courses}
            loading={isLoading}
            meta={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{creditProgress.active || totalEnrollments} active this semester</span>
                <span>{creditProgress.total ? `${creditProgress.completed}/${creditProgress.total} credits completed` : 'Credits tracking coming soon'}</span>
              </div>
            }
            onClick={() => navigate('/dashboard/courses')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Upcoming Exams"
            value={upcomingExams.length}
            icon={<CalendarOutlined />}
            gradient={statGradients.exams}
            loading={isLoading}
            meta={
              nextExam && nextExamStartsIn ? (
                <span>
                  Next: <strong>{nextExam.title}</strong> {nextExamStartsIn}
                </span>
              ) : (
                'No upcoming exams scheduled'
              )
            }
            side={
              nextExam && nextExam.scheduled_at ? (
                <Tag
                  color={nextExamUrgent ? 'red' : 'default'}
                  style={{
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.2)',
                    borderColor: 'rgba(255,255,255,0.28)',
                    color: 'rgba(255,255,255,0.92)',
                  }}
                >
                  {countdown(nextExam.scheduled_at)}
                </Tag>
              ) : null
            }
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Overall Performance"
            value={performance ? `${performance.gpa.toFixed(2)}/4.0` : '--'}
            icon={<TrophyOutlined />}
            gradient={statGradients.performance}
            loading={gradedLoading}
            side={
              performance ? (
                <Progress
                  type="circle"
                  percent={clamp((performance.gpa / 4) * 100, 0, 100)}
                  size={54}
                  strokeColor="#ffffff"
                  trailColor="rgba(255,255,255,0.22)"
                  format={() => ''}
                />
              ) : null
            }
            meta={
              performance
                ? `Average ${performance.avgPct.toFixed(1)}% (dGPA ${performance.deltaGpa >= 0 ? '+' : ''}${performance.deltaGpa.toFixed(2)})`
                : 'No graded results yet'
            }
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Attendance Rate"
            value={attendancePct === null ? '--' : `${attendancePct}%`}
            icon={<CheckCircleOutlined />}
            gradient={statGradients.attendance}
            loading={isLoading}
            side={
              attendancePct !== null ? (
                <Progress
                  type="circle"
                  percent={clamp(attendancePct, 0, 100)}
                  size={54}
                  strokeColor="#ffffff"
                  trailColor="rgba(255,255,255,0.22)"
                  format={() => ''}
                />
              ) : null
            }
            meta={attendanceStatus ? `${attendanceStatus.label} standing` : 'Attendance tracking is not enabled yet'}
            onClick={() => navigate('/dashboard/courses')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Pending Assignments"
            value={pendingAssignments.length}
            icon={<ClockCircleOutlined />}
            gradient={statGradients.assignments}
            loading={isLoading}
            meta={
              pendingAssignments[0]?.closes_at ? (
                <span>
                  Closest due: <strong>{pendingAssignments[0].title}</strong> ({countdown(pendingAssignments[0].closes_at)})
                </span>
              ) : pendingAssignments.length ? (
                'Assignments waiting for you'
              ) : (
                'All caught up'
              )
            }
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Recent Grades"
            value={recentGrade ? `${recentGrade.pct.toFixed(1)}%` : '--'}
            icon={<BarChartOutlined />}
            gradient={statGradients.grades}
            loading={gradedLoading}
            meta={recentGrade ? `${recentGrade.title} (${letterFromPercent(recentGrade.pct)})` : 'No grades posted yet'}
            onClick={() => navigate('/dashboard/assessments')}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<CalendarOutlined />}
              title="Upcoming Exams"
              subtitle="See what's coming up and start on time"
              extra={
                <Space size={10} wrap>
                  <Button type="primary" icon={<EyeOutlined />} onClick={() => navigate('/dashboard/assessments')}>
                    View All
                  </Button>
                  <Button icon={<ScheduleOutlined />} onClick={() => navigate('/dashboard/calendar')}>
                    Calendar
                  </Button>
                </Space>
              }
            />

            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              <Segmented options={['Cards', 'Timeline']} value={upcomingView} onChange={(v) => setUpcomingView(v as UpcomingView)} />
              <Space size={10} wrap>
                <Select
                  placeholder="Course"
                  allowClear
                  value={upcomingCourse}
                  onChange={(v) => setUpcomingCourse(v)}
                  style={{ width: 170 }}
                  options={courseCodes.map((c) => ({ label: c, value: c }))}
                />
                <Select
                  value={upcomingFilter}
                  onChange={(v) => setUpcomingFilter(v as UpcomingFilter)}
                  style={{ width: 150 }}
                  options={[
                    { label: 'All', value: 'All' },
                    { label: 'This Week', value: 'This Week' },
                    { label: 'This Month', value: 'This Month' },
                  ]}
                />
                <Select
                  value={upcomingSort}
                  onChange={(v) => setUpcomingSort(v as UpcomingSort)}
                  style={{ width: 150 }}
                  options={[
                    { label: 'Sort: Date', value: 'Date' },
                    { label: 'Sort: Course', value: 'Course' },
                    { label: 'Sort: Priority', value: 'Priority' },
                  ]}
                />
              </Space>
            </div>

            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : filteredUpcomingExams.length ? (
                upcomingView === 'Timeline' ? (
                  <List
                    dataSource={filteredUpcomingExams.slice(0, 10)}
                    renderItem={(exam) => {
                      const typeKey = String(exam.assessment_type || '').toUpperCase();
                      const prepTip =
                        typeKey === 'EXAM' || typeKey === 'QUIZ'
                          ? 'Review notes and practice questions.'
                          : typeKey === 'ASSIGNMENT'
                            ? 'Start early and outline your answer.'
                            : 'Break the work into small steps.';

                      return (
                        <List.Item
                          actions={[
                            <Button key="details" type="link" onClick={() => navigate(`/dashboard/assessments/${exam.id}`)} style={{ padding: 0 }}>
                              View Details
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={
                              <Avatar style={{ background: 'linear-gradient(135deg, #2196f3 0%, #9c27b0 100%)', fontWeight: 700 }}>
                                {initialsFrom(exam.course_code)}
                              </Avatar>
                            }
                            title={
                              <Space size={10} wrap>
                                <Text strong>{exam.title}</Text>
                                <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{exam.course_code}</Tag>
                                {examTypePill(exam.assessment_type)}
                                {examStatusTag(exam)}
                              </Space>
                            }
                            description={
                              <div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                  {exam.scheduled_at ? `${dayjs(exam.scheduled_at).format('MMM D, h:mm A')} (${dayjs(exam.scheduled_at).fromNow()})` : 'Scheduled time not set'} - Duration {exam.duration_minutes} min
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                                  Tip: {prepTip}
                                </Text>
                              </div>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                    {filteredUpcomingExams.slice(0, 10).map((exam) => {
                      const startsAt = exam.scheduled_at ? dayjs(exam.scheduled_at) : null;

                      const urgent = startsAt && startsAt.isValid() ? startsAt.diff(dayjs(), 'day') < 3 : false;
                      const typeKey = String(exam.assessment_type || '').toUpperCase();
                      const prepTip =
                        typeKey === 'EXAM' || typeKey === 'QUIZ'
                          ? 'Review notes and practice questions.'
                          : typeKey === 'ASSIGNMENT'
                            ? 'Start early and outline your answer.'
                            : 'Break the work into small steps.';

                      return (
                        <Card
                          key={exam.id}
                          className="sentra-hover-lift"
                          bodyStyle={{ padding: 16 }}
                          style={{ border: '1px solid var(--stroke)', background: 'var(--surface)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <Text strong style={{ display: 'block', fontSize: 16 }}>
                                {exam.title}
                              </Text>
                              <Space size={8} wrap style={{ marginTop: 8 }}>
                                <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{exam.course_code}</Tag>
                                {examTypePill(exam.assessment_type)}
                                {examStatusTag(exam)}
                                {urgent ? (
                                  <Tag color="red" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                                    Urgent
                                  </Tag>
                                ) : null}
                              </Space>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                {exam.scheduled_at ? dayjs(exam.scheduled_at).format('MMM D') : '--'}
                              </Text>
                              <Text strong style={{ display: 'block' }}>
                                {exam.scheduled_at ? dayjs(exam.scheduled_at).format('h:mm A') : '--'}
                              </Text>
                              {exam.scheduled_at ? (
                                <Tag color={urgent ? 'red' : 'default'} style={{ borderRadius: 999, marginTop: 8, marginInlineEnd: 0 }}>
                                  {countdown(exam.scheduled_at)}
                                </Tag>
                              ) : null}
                            </div>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Duration: <Text strong>{exam.duration_minutes} min</Text>
                              {exam.closes_at ? (
                                <>
                                  {' '}
                                  - Closes <Text strong>{dayjs(exam.closes_at).fromNow()}</Text>
                                </>
                              ) : null}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                              Tip: {prepTip}
                            </Text>
                          </div>

                          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                            <Button icon={<EyeOutlined />} onClick={() => navigate(`/dashboard/assessments/${exam.id}`)}>
                              View Details
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
                  <Empty
                    image={educationIllustration}
                    imageStyle={{ height: 160 }}
                    description={
                      <div>
                        <Text strong style={{ display: 'block' }}>No upcoming exams scheduled</Text>
                        <Text type="secondary">You're all caught up. Keep learning and check back later.</Text>
                      </div>
                    }
                  >
                    <Button type="primary" onClick={() => navigate('/dashboard/courses/enroll')}>
                      Browse available courses
                    </Button>
                  </Empty>
                </div>
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<BookOutlined />}
              title="My Courses"
              subtitle="Progress, grades, and materials at a glance"
              extra={
                <Space size={10} wrap>
                  <Search
                    placeholder="Search courses"
                    allowClear
                    value={coursesSearch}
                    onChange={(e) => setCoursesSearch(e.target.value)}
                    onSearch={setCoursesSearch}
                    prefix={<SearchOutlined />}
                    style={{ width: 260 }}
                  />
                  <Select
                    value={coursesStatus === 'All' ? undefined : coursesStatus}
                    allowClear
                    placeholder="Status"
                    style={{ width: 150 }}
                    onChange={(v) => setCoursesStatus((v as CourseStatusUi) || 'All')}
                    options={[
                      { label: 'Active', value: 'Active' },
                      { label: 'Upcoming', value: 'Upcoming' },
                      { label: 'Completed', value: 'Completed' },
                    ]}
                  />
                </Space>
              }
            />

            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : filteredCourses.length ? (
                <Table
                  columns={courseColumns}
                  dataSource={filteredCourses}
                  rowKey="id"
                  pagination={{ pageSize: 6, hideOnSinglePage: true }}
                  size="middle"
                  scroll={{ x: 980 }}
                  onRow={(_, index) => ({
                    style: { background: (index ?? 0) % 2 === 0 ? 'transparent' : 'rgba(41, 99, 116, 0.06)' },
                  })}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not enrolled in any courses yet.">
                  <Button type="primary" onClick={() => navigate('/dashboard/courses/enroll')}>
                    Browse courses
                  </Button>
                </Empty>
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader icon={<ClockCircleOutlined />} title="Assignment Tracker" subtitle="Stay ahead of due dates" />
            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : pendingAssignments.length ? (
                <List
                  dataSource={pendingAssignments.slice(0, 6)}
                  renderItem={(a) => (
                    <List.Item
                      actions={[
                        <Button key="view" type="primary" onClick={() => navigate(`/dashboard/assessments/${a.id}`)}>
                          View Details
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'linear-gradient(135deg, #9c27b0 0%, #2196f3 100%)', fontWeight: 700 }}>
                            {initialsFrom(a.course_code)}
                          </Avatar>
                        }
                        title={
                          <Space size={10} wrap>
                            <Text strong>{a.title}</Text>
                            <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{a.course_code}</Tag>
                            {examTypePill(a.assessment_type)}
                            {a.closes_at ? (
                              <Tag color={dayjs(a.closes_at).diff(dayjs(), 'hour') < 24 ? 'red' : 'gold'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                                Due {countdown(a.closes_at)}
                              </Tag>
                            ) : null}
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {a.closes_at ? `Due ${dayjs(a.closes_at).fromNow()}` : a.scheduled_at ? `Starts ${dayjs(a.scheduled_at).fromNow()}` : 'No due date set'}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending assignments. You're doing great!" />
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }}>
            <SectionHeader
              icon={<CheckCircleOutlined />}
              title="Past Exams & Results"
              subtitle="View grades and track improvements"
              extra={
                <Space size={10} wrap>
                  <Button icon={<DownloadOutlined />} onClick={exportTranscript} disabled={!gradedWithPct.length}>
                    Transcript (CSV)
                  </Button>
                  <Button type="link" onClick={() => navigate('/dashboard/assessments')} style={{ padding: 0 }}>
                    View all
                  </Button>
                </Space>
              }
            />
            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : pastExamRows.length ? (
                <Table
                  columns={pastExamColumns}
                  dataSource={pastExamRows.slice(0, 8)}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  scroll={{ x: 820 }}
                  onRow={(_, index) => ({
                    style: { background: (index ?? 0) % 2 === 0 ? 'transparent' : 'rgba(41, 99, 116, 0.06)' },
                  })}
                />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
                  <Empty
                    image={educationIllustration}
                    imageStyle={{ height: 160 }}
                    description={
                      <div>
                        <Text strong style={{ display: 'block' }}>No completed exams yet</Text>
                        <Text type="secondary">Your exam history will appear here after you submit.</Text>
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<BellOutlined />}
              title="Notifications"
              subtitle="Announcements, grades, reminders"
              extra={
                <Space size={10} wrap>
                  <Badge count={unreadCount?.count || 0} color="#ff4d4f" />
                  <Button
                    type="link"
                    onClick={() => markAllReadMutation.mutate()}
                    style={{ padding: 0 }}
                    disabled={markAllReadMutation.isPending}
                  >
                    Mark all read
                  </Button>
                </Space>
              }
            />

            <div
              style={{
                marginTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <Segmented
                options={['All', 'Unread', 'Important']}
                value={notificationFilter}
                onChange={(v) => setNotificationFilter(v as NotificationFilter)}
              />
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
                          {groupedNotifications[bucket].slice(0, 4).map((n) => {
                            const { category, tone } = categorizeNotification(n);
                            const meta = toneMeta(tone);
                            const priorityDot =
                              category === 'REMINDERS' ? '#f59e0b' : category === 'GRADES' ? '#16a34a' : meta.dot;

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
                                      <Text strong style={{ display: 'block' }}>
                                        {n.subject}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                                        {n.body}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                                        {dayjs(n.created_at).isValid() ? dayjs(n.created_at).fromNow() : n.created_at}
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

          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<ClockCircleOutlined />}
              title="Upcoming Deadlines"
              subtitle="Your next important times"
              extra={
                <Button type="link" onClick={() => navigate('/dashboard/calendar')} style={{ padding: 0 }}>
                  Open calendar
                </Button>
              }
            />

            <div style={{ marginTop: 14 }}>
              {isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : upcomingDeadlines.length ? (
                <List
                  dataSource={upcomingDeadlines}
                  renderItem={(d) => (
                    <List.Item
                      actions={[
                        <Tag key="count" color="default" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                          {countdown(d.at)}
                        </Tag>,
                        <Button key="open" type="link" onClick={() => navigate(d.route)} style={{ padding: 0 }}>
                          Open
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'linear-gradient(135deg, #2196f3 0%, #9c27b0 100%)', fontWeight: 700 }}>
                            {initialsFrom(d.courseCode)}
                          </Avatar>
                        }
                        title={
                          <Space size={10} wrap>
                            <Text strong>{d.title}</Text>
                            <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{d.courseCode}</Tag>
                            <Tag color={d.kind === 'Starts' ? 'blue' : 'gold'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                              {d.kind}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(d.at).isValid() ? `${dayjs(d.at).format('MMM D, h:mm A')} (${dayjs(d.at).fromNow()})` : d.at}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No upcoming deadlines yet." />
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<BarChartOutlined />}
              title="Grade Analytics"
              subtitle="Trends and distribution from your latest results"
              extra={
                performance ? (
                  <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    GPA {performance.gpa.toFixed(2)} (dGPA {performance.deltaGpa >= 0 ? '+' : ''}{performance.deltaGpa.toFixed(2)}) / Avg {performance.avgPct.toFixed(1)}%
                  </Tag>
                ) : null
              }
            />

            <div style={{ marginTop: 14 }}>
              {gradedLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
              ) : gradedWithPct.length ? (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div style={{ width: '100%', height: 220 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      Performance Trend
                    </Text>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                        <XAxis dataKey="label" stroke="rgba(148,163,184,0.9)" />
                        <YAxis domain={[0, 100]} stroke="rgba(148,163,184,0.9)" />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="pct" stroke="#2196f3" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ width: '100%', height: 220 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      Recent Scores
                    </Text>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.bars}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                        <XAxis dataKey="label" stroke="rgba(148,163,184,0.9)" />
                        <YAxis domain={[0, 100]} stroke="rgba(148,163,184,0.9)" />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="pct" name="Percent" radius={[10, 10, 0, 0]}>
                          {chartData.bars.map((entry, idx) => (
                            <Cell key={entry.key} fill={idx % 2 === 0 ? '#9c27b0' : '#2196f3'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ width: '100%', height: 260 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      Grade Distribution
                    </Text>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip />
                        <Pie data={chartData.pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                          {chartData.pie.map((entry) => {
                            const color =
                              entry.name === 'A'
                                ? '#16a34a'
                                : entry.name === 'B'
                                  ? '#22c55e'
                                  : entry.name === 'C'
                                    ? '#f59e0b'
                                    : entry.name === 'D'
                                      ? '#fb7185'
                                      : '#ef4444';
                            return <Cell key={entry.name} fill={color} />;
                          })}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Space>
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', padding: 18 }}>
                  <Empty
                    image={educationIllustration}
                    imageStyle={{ height: 140 }}
                    description={
                      <div>
                        <Text strong style={{ display: 'block' }}>No grades yet</Text>
                        <Text type="secondary">Once you complete assessments, your analytics will show here.</Text>
                      </div>
                    }
                  >
                    <Button type="primary" onClick={() => navigate('/dashboard/assessments')}>
                      Explore assessments
                    </Button>
                  </Empty>
                </div>
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }} style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={<FileTextOutlined />}
              title="Course Materials"
              subtitle="Recently added resources"
              extra={
                <Button type="link" onClick={() => navigate('/dashboard/documents')} style={{ padding: 0 }}>
                  Open library
                </Button>
              }
            />

            <div style={{ marginTop: 14 }}>
              {documentsLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : recentDocs.length ? (
                <List
                  dataSource={recentDocs}
                  renderItem={(doc) => (
                    <List.Item
                      actions={[
                        <Button
                          key="download"
                          icon={<DownloadOutlined />}
                          loading={downloadDocMutation.isPending}
                          onClick={() => handleDownloadDoc(doc)}
                        >
                          Download
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'rgba(41, 99, 116, 0.16)', color: 'var(--primary)' }} icon={<FileTextOutlined />} />
                        }
                        title={<Text strong>{doc.title}</Text>}
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Updated {dayjs(doc.updated_at).isValid() ? dayjs(doc.updated_at).fromNow() : doc.updated_at}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No materials found yet." />
              )}
            </div>
          </Card>

          <Card bodyStyle={{ padding: 18 }}>
            <SectionHeader icon={<RocketOutlined />} title="Study Resources" subtitle="Quick tips to stay consistent" />
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <div style={{ border: '1px solid var(--stroke)', borderRadius: 14, padding: 12, background: 'var(--surface-muted)' }}>
                <Text strong style={{ display: 'block' }}>Plan a 25-minute focus sprint</Text>
                <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                  Use a timer, take a 5-minute break, then repeat.
                </Text>
              </div>
              <div style={{ border: '1px solid var(--stroke)', borderRadius: 14, padding: 12, background: 'var(--surface-muted)' }}>
                <Text strong style={{ display: 'block' }}>Review instructions before you start</Text>
                <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                  It helps you focus on what matters most in the assessment.
                </Text>
              </div>
              <div style={{ border: '1px solid var(--stroke)', borderRadius: 14, padding: 12, background: 'var(--surface-muted)' }}>
                <Text strong style={{ display: 'block' }}>Aim for one small win today</Text>
                <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                  A short review is better than no review.
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StudentDashboard;
