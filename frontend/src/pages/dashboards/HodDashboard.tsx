import React, { useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
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
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  NotificationOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useHodDashboard } from '../../api/dashboard';
import { useNotifications } from '../../api/notifications';

const { Title, Text } = Typography;

const initialsFrom = (nameOrEmail: string) => {
  const cleaned = (nameOrEmail || '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (cleaned.includes('@')) return cleaned[0].toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
};

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}> = ({ icon, title, subtitle, extra }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'rgba(102, 126, 234, 0.14)',
          display: 'grid',
          placeItems: 'center',
          color: '#4f46e5',
          flex: '0 0 auto',
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
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
    {extra ? <div style={{ flexShrink: 0 }}>{extra}</div> : null}
  </div>
);

type TrendDirection = 'up' | 'down' | 'flat';

const trendMeta = (dir: TrendDirection, label: string) => {
  if (dir === 'up') return { icon: <ArrowUpOutlined />, color: '#16a34a', label };
  if (dir === 'down') return { icon: <ArrowDownOutlined />, color: '#dc2626', label };
  return { icon: <ArrowRightOutlined />, color: '#64748b', label };
};

const MetricCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  meta?: React.ReactNode;
  trend?: { direction: TrendDirection; label: string };
}> = ({ title, value, icon, gradient, meta, trend }) => {
  const t = trend ? trendMeta(trend.direction, trend.label) : null;
  return (
    <Card
      className="sentra-hover-lift"
      bodyStyle={{ padding: 18 }}
    style={{
      border: '1px solid #e2e8f0',
      background: gradient,
      overflow: 'hidden',
      position: 'relative',
      height: '100%',
      boxShadow: 'none',
      minHeight: 158,
    }}
  >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: '#334155', fontWeight: 600 }}>{title}</Text>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#475569',
            }}
          >
            {icon}
          </div>
        </div>
        <Title level={2} style={{ color: '#0f172a', margin: '10px 0 0' }}>
          {value}
        </Title>
        {meta ? <Text style={{ color: '#475569', display: 'block' }}>{meta}</Text> : null}
        {t ? (
          <Text style={{ color: t.color, display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
            {t.icon}
            {t.label}
          </Text>
        ) : null}
      </div>
    </Card>
  );
};

const HodDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isFetching } = useHodDashboard();
  const { data: notifications } = useNotifications({ page: 1 });

  const [teacherSearch, setTeacherSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [alertsFilter, setAlertsFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const teachers = useMemo(() => data?.teachers || [], [data?.teachers]);
  const courses = useMemo(() => data?.courses || [], [data?.courses]);
  const notificationsList = useMemo(() => notifications?.results || [], [notifications?.results]);

  const unreadNotifications = notificationsList.filter((item) => !item.is_read).length;
  const unassignedCourses = courses.filter((course) => !course.teacher_name).length;
  const averageClassSize = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + (course.student_count || 0), 0) / courses.length)
    : 0;
  const assignedCourses = Math.max(courses.length - unassignedCourses, 0);
  const coveragePct = courses.length ? Math.round((assignedCourses / courses.length) * 100) : 0;
  const pendingLoad = Math.max((data?.total_students || 0) - assignedCourses * Math.max(averageClassSize, 1), 0);

  const searchableOptions = useMemo(() => {
    const teacherOptions = teachers.map((teacher) => ({
      value: `teacher:${teacher.id}`,
      label: `Teacher: ${teacher.name} (${teacher.email})`,
      route: '/dashboard/departments',
    }));
    const courseOptions = courses.map((course) => ({
      value: `course:${course.id}`,
      label: `Course: ${course.code} - ${course.title}`,
      route: '/dashboard/courses',
    }));
    return [...teacherOptions, ...courseOptions];
  }, [teachers, courses]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    const g = globalSearch.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const haystack = `${teacher.name} ${teacher.email} ${(teacher.assigned_courses || []).join(' ')}`.toLowerCase();
      return (!q || haystack.includes(q)) && (!g || haystack.includes(g));
    });
  }, [teachers, teacherSearch, globalSearch]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    const g = globalSearch.trim().toLowerCase();
    return courses.filter((course) => {
      const haystack = `${course.code} ${course.title} ${course.teacher_name || ''}`.toLowerCase();
      const assignmentPass =
        assignmentFilter === 'ALL' ||
        (assignmentFilter === 'ASSIGNED' && !!course.teacher_name) ||
        (assignmentFilter === 'UNASSIGNED' && !course.teacher_name);
      return assignmentPass && (!q || haystack.includes(q)) && (!g || haystack.includes(g));
    });
  }, [courses, courseSearch, globalSearch, assignmentFilter]);

  const filteredNotifications = useMemo(
    () => notificationsList.filter((n) => alertsFilter === 'ALL' || !n.is_read),
    [notificationsList, alertsFilter],
  );

  const activityFeed = useMemo(() => {
    const items = [];
    for (const n of notificationsList.slice(0, 4)) {
      items.push({
        color: n.is_read ? 'gray' : 'blue',
        children: (
          <div>
            <Text strong>{n.subject}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(n.created_at).toLocaleString()}
              </Text>
            </div>
          </div>
        ),
      });
    }
    if (unassignedCourses > 0) {
      items.unshift({
        color: 'orange',
        children: (
          <div>
            <Text strong>Unassigned courses pending</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {unassignedCourses} courses require teacher assignment
              </Text>
            </div>
          </div>
        ),
      });
    }
    return items;
  }, [notificationsList, unassignedCourses]);

  const teacherColumns = [
    {
      title: 'Teacher',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: (typeof teachers)[number]) => (
        <Space size={12}>
          <Avatar style={{ background: '#1f8efa' }}>{initialsFrom(record.name || record.email)}</Avatar>
          <div>
            <Text strong style={{ display: 'block' }}>
              {record.name}
            </Text>
            <Text type="secondary">{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Assigned Courses',
      dataIndex: 'assigned_courses',
      key: 'assigned_courses',
      render: (assignedCourses: string[]) => (
        <Space wrap>
          {assignedCourses.length ? (
            assignedCourses.map((code) => (
              <Tag key={code} color="blue" style={{ borderRadius: 999 }}>
                {code}
              </Tag>
            ))
          ) : (
            <Tag style={{ borderRadius: 999 }}>No assignments</Tag>
          )}
        </Space>
      ),
    },
  ];

  const courseColumns = [
    {
      title: 'Course',
      key: 'course',
      render: (_: string, course: (typeof courses)[number]) => (
        <div>
          <Text strong style={{ display: 'block' }}>
            {course.code}
          </Text>
          <Text type="secondary">{course.title}</Text>
        </div>
      ),
    },
    {
      title: 'Assigned Teacher',
      dataIndex: 'teacher_name',
      key: 'teacher_name',
      render: (name: string | null) =>
        name ? (
          <Text>{name}</Text>
        ) : (
          <Tag color="gold" style={{ borderRadius: 999 }}>
            Unassigned
          </Tag>
        ),
    },
    {
      title: 'Students',
      dataIndex: 'student_count',
      key: 'student_count',
      width: 120,
      render: (count: number) => (
        <Tag color="green" style={{ borderRadius: 999 }}>
          {count}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin size="large" tip="Loading dashboard..." />
        </div>
      ) : null}
      {error ? (
        <Alert
          type="error"
          message="Failed to load HOD dashboard"
          description="Please refresh the page or login again."
          showIcon
        />
      ) : null}
      {!isLoading && !error ? (
        <>
      <div>
        <Title level={2} style={{ marginBottom: 2 }}>
          Head of Department Dashboard
        </Title>
        <Text type="secondary" style={{ display: 'block' }}>
          Department overview, teacher assignments, and course operations.
        </Text>
        <Text type="secondary" style={{ display: 'block' }}>
          {data?.department?.name || 'Department'} ({data?.department?.code || 'N/A'})
        </Text>
      </div>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={16}>
          <Card bodyStyle={{ padding: 16 }} style={{ height: '100%' }}>
            <SectionHeader
              icon={<SearchOutlined />}
              title="Search & Filters"
              subtitle="Quickly find teachers, courses, and alerts."
            />
            <Row gutter={[12, 12]} align="middle" style={{ marginTop: 14 }}>
              <Col xs={24} xl={10}>
                <AutoComplete
                  style={{ width: '100%' }}
                  value={globalSearch}
                  onChange={setGlobalSearch}
                  options={searchableOptions.map((option) => ({
                    value: option.label,
                  }))}
                >
                  <Input size="large" allowClear prefix={<SearchOutlined />} placeholder="Search teacher or course..." />
                </AutoComplete>
              </Col>
              <Col xs={24} xl={6}>
                <Select
                  size="large"
                  value={assignmentFilter}
                  onChange={setAssignmentFilter}
                  style={{ width: '100%' }}
                  options={[
                    { label: 'All Courses', value: 'ALL' },
                    { label: 'Assigned', value: 'ASSIGNED' },
                    { label: 'Unassigned', value: 'UNASSIGNED' },
                  ]}
                />
              </Col>
              <Col xs={24} xl={5}>
                <Select
                  size="large"
                  value={alertsFilter}
                  onChange={setAlertsFilter}
                  style={{ width: '100%' }}
                  options={[
                    { label: 'All Alerts', value: 'ALL' },
                    { label: 'Unread Only', value: 'UNREAD' },
                  ]}
                />
              </Col>
              <Col xs={24} xl={3}>
                <Button size="large" block onClick={() => refetch()} loading={isFetching}>
                  Refresh
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            bodyStyle={{ padding: 16 }}
            style={{
              border: 'none',
              background: 'linear-gradient(135deg, rgba(102,126,234,0.12) 0%, rgba(118,75,162,0.10) 100%)',
              height: '100%',
            }}
          >
            <SectionHeader icon={<PlusOutlined />} title="Quick Actions" subtitle="Create and manage faster." />
            <div style={{ marginTop: 14 }}>
              <Space wrap>
                <Button icon={<BookOutlined />} onClick={() => navigate('/dashboard/courses/new')}>
                  Create Course
                </Button>
                <Button icon={<TeamOutlined />} onClick={() => navigate('/dashboard/enrollments')}>
                  Enrollment Requests
                </Button>
                <Button icon={<CalendarOutlined />} onClick={() => navigate('/dashboard/assessments')}>
                  Assessments
                </Button>
                <Button icon={<BellOutlined />} onClick={() => navigate('/dashboard/notifications/new')}>
                  Send Announcement
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} md={12} lg={8}>
          <MetricCard
            title="Teachers"
            value={data?.total_teachers || 0}
            icon={<UserOutlined />}
            gradient="linear-gradient(135deg, #f5f9ff 0%, #edf4ff 100%)"
            trend={{ direction: assignedCourses > 0 ? 'up' : 'flat', label: `${assignedCourses} active assignments` }}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <MetricCard
            title="Students"
            value={data?.total_students || 0}
            icon={<TeamOutlined />}
            gradient="linear-gradient(135deg, #f4fbf7 0%, #ebf7f0 100%)"
            trend={{ direction: averageClassSize > 0 ? 'up' : 'flat', label: `Avg class size ${averageClassSize}` }}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <MetricCard
            title="Courses"
            value={data?.total_courses || 0}
            icon={<BookOutlined />}
            gradient="linear-gradient(135deg, #f8f6ff 0%, #f1ecff 100%)"
            trend={{ direction: coveragePct >= 80 ? 'up' : coveragePct > 40 ? 'flat' : 'down', label: `${coveragePct}% coverage` }}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <MetricCard
            title="Unassigned Courses"
            value={unassignedCourses}
            icon={<CalendarOutlined />}
            gradient="linear-gradient(135deg, #fff8f1 0%, #ffefe1 100%)"
            trend={{ direction: unassignedCourses > 0 ? 'down' : 'up', label: unassignedCourses > 0 ? 'Needs attention' : 'All assigned' }}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <MetricCard
            title="Avg Class Size"
            value={averageClassSize}
            icon={<TeamOutlined />}
            gradient="linear-gradient(135deg, #f2fbfb 0%, #e8f7f8 100%)"
            trend={{ direction: averageClassSize > 0 ? 'up' : 'flat', label: pendingLoad > 0 ? `${pendingLoad} load gap` : 'Balanced load' }}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <MetricCard
            title="Unread Alerts"
            value={unreadNotifications}
            icon={<NotificationOutlined />}
            gradient="linear-gradient(135deg, #f7f5ff 0%, #efebff 100%)"
            trend={{ direction: unreadNotifications > 0 ? 'down' : 'up', label: unreadNotifications > 0 ? 'Review queue' : 'All clear' }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={8}>
          <Card
            style={{ height: '100%' }}
            title={
              <SectionHeader
                icon={<CalendarOutlined />}
                title="Operations Pulse"
                subtitle="Department command indicators"
              />
            }
          >
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong>Teacher Assignment Coverage</Text>
                  <Text>{coveragePct}%</Text>
                </Space>
                <Progress percent={coveragePct} showInfo={false} strokeColor="#64748b" trailColor="#e2e8f0" />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong>Unassigned Courses</Text>
                  <Tag color={unassignedCourses > 0 ? 'gold' : 'green'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    {unassignedCourses}
                  </Tag>
                </Space>
                <Text type="secondary">Courses without assigned teacher</Text>
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong>Alert Queue</Text>
                  <Badge count={unreadNotifications} color="#ef4444" />
                </Space>
                <Text type="secondary">Unread operational notifications</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card style={{ height: '100%' }} title={<SectionHeader icon={<BellOutlined />} title="Activity Feed" subtitle="Recent department events" />}>
            {activityFeed.length ? (
              <Timeline items={activityFeed} />
            ) : (
              <Empty description="No recent activity" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={16}>
          <Card
            style={{ height: '100%' }}
            title={
              <SectionHeader
                icon={<UserOutlined />}
                title="Department Teachers"
                subtitle="Assignments and faculty coverage"
                extra={
                  <Input
                    placeholder="Search teacher"
                    allowClear
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    style={{ width: 220 }}
                  />
                }
              />
            }
          >
            <Table columns={teacherColumns} dataSource={filteredTeachers} rowKey="id" pagination={{ pageSize: 6 }} size="small" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card style={{ height: '100%' }} title={<SectionHeader icon={<BellOutlined />} title="Notifications" subtitle="Latest department updates" />}>
            <List
              dataSource={filteredNotifications.slice(0, 8)}
              locale={{ emptyText: <Empty description="No notifications yet" /> }}
              style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}
              renderItem={(item) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.subject}</Text>
                        {!item.is_read ? <Tag color="red">Unread</Tag> : null}
                      </Space>
                    }
                    description={
                      <>
                        <Text style={{ display: 'block' }}>{item.body}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <SectionHeader
            icon={<BookOutlined />}
            title="Department Courses & Assignments"
            subtitle="Track course ownership and class size"
            extra={
              <Input
                placeholder="Search course"
                allowClear
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                style={{ width: 220 }}
              />
            }
          />
        }
      >
        <Table columns={courseColumns} dataSource={filteredCourses} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
      </Card>
        </>
      ) : null}
    </div>
  );
};

export default HodDashboard;
