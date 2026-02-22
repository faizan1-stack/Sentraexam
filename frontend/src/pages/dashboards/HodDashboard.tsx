import React, { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  NotificationOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import educationIllustration from '../../assets/education-illustration.svg';
import { useHodDashboard } from '../../api/dashboard';
import { useNotifications } from '../../api/notifications';

const { Title, Text } = Typography;
const { Search } = Input;

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
  value: number;
  icon: React.ReactNode;
  gradient: string;
  meta?: React.ReactNode;
}> = ({ title, value, icon, gradient, meta }) => (
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
      {meta ? <Text style={{ color: '#475569' }}>{meta}</Text> : null}
    </div>
  </Card>
);

const HodDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isFetching } = useHodDashboard();
  const { data: notifications } = useNotifications({ page: 1 });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load HOD dashboard"
        description="Please refresh the page or login again."
        showIcon
      />
    );
  }

  const teachers = data?.teachers || [];
  const courses = data?.courses || [];
  const unreadNotifications = (notifications?.results || []).filter((item) => !item.is_read).length;
  const unassignedCourses = courses.filter((course) => !course.teacher_name).length;
  const averageClassSize = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + (course.student_count || 0), 0) / courses.length)
    : 0;

  const teacherQuery = teacherSearch.trim().toLowerCase();
  const filteredTeachers = teacherQuery
    ? teachers.filter((teacher) => {
      const haystack = `${teacher.name} ${teacher.email} ${(teacher.assigned_courses || []).join(' ')}`.toLowerCase();
      return haystack.includes(teacherQuery);
    })
    : teachers;

  const courseQuery = courseSearch.trim().toLowerCase();
  const filteredCourses = courseQuery
    ? courses.filter((course) => {
      const haystack = `${course.code} ${course.title} ${course.teacher_name || ''}`.toLowerCase();
      return haystack.includes(courseQuery);
    })
    : courses;

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
      <Card
        style={{
          border: 'none',
          background: 'linear-gradient(135deg, #0f4c81 0%, #1c7ed6 55%, #2ea8ff 100%)',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <Tag color="blue" style={{ borderRadius: 999, marginBottom: 10 }}>
              Head of Department
            </Tag>
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              {data?.department?.name || 'Department Dashboard'}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.88)', display: 'block', marginTop: 6 }}>
              Code: {data?.department?.code || 'N/A'} | Department operations, teachers, and course assignments.
            </Text>
            <Space style={{ marginTop: 16 }} wrap>
              <Button onClick={() => navigate('/dashboard/courses')}>Courses</Button>
              <Button onClick={() => navigate('/dashboard/enrollments')}>Enrollment Requests</Button>
              <Button onClick={() => navigate('/dashboard/notifications')}>Notifications</Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
                Refresh
              </Button>
            </Space>
          </div>
          <img
            src={educationIllustration}
            alt="Department overview"
            style={{ width: 170, maxWidth: '100%', objectFit: 'contain', opacity: 0.95 }}
          />
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Teachers"
            value={data?.total_teachers || 0}
            icon={<UserOutlined />}
            gradient="linear-gradient(135deg, #f5f9ff 0%, #edf4ff 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Students"
            value={data?.total_students || 0}
            icon={<TeamOutlined />}
            gradient="linear-gradient(135deg, #f4fbf7 0%, #ebf7f0 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Courses"
            value={data?.total_courses || 0}
            icon={<BookOutlined />}
            gradient="linear-gradient(135deg, #f8f6ff 0%, #f1ecff 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Unassigned Courses"
            value={unassignedCourses}
            icon={<CalendarOutlined />}
            gradient="linear-gradient(135deg, #fff8f1 0%, #ffefe1 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Avg Class Size"
            value={averageClassSize}
            icon={<TeamOutlined />}
            gradient="linear-gradient(135deg, #f2fbfb 0%, #e8f7f8 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <MetricCard
            title="Unread Alerts"
            value={unreadNotifications}
            icon={<NotificationOutlined />}
            gradient="linear-gradient(135deg, #f7f5ff 0%, #efebff 100%)"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title={
              <SectionHeader
                icon={<UserOutlined />}
                title="Department Teachers"
                subtitle="Assignments and faculty coverage"
                extra={
                  <Search
                    placeholder="Search teacher"
                    allowClear
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    onSearch={setTeacherSearch}
                    style={{ width: 220 }}
                  />
                }
              />
            }
          >
            <Table
              columns={teacherColumns}
              dataSource={filteredTeachers}
              rowKey="id"
              pagination={{ pageSize: 6 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title={<SectionHeader icon={<BellOutlined />} title="Notifications" subtitle="Latest department updates" />}>
            <List
              dataSource={(notifications?.results || []).slice(0, 8)}
              locale={{ emptyText: <Empty description="No notifications yet" /> }}
              renderItem={(item) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <List.Item.Meta
                    title={<Text strong>{item.subject}</Text>}
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
              <Search
                placeholder="Search course"
                allowClear
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                onSearch={setCourseSearch}
                style={{ width: 220 }}
              />
            }
          />
        }
      >
        <Table
          columns={courseColumns}
          dataSource={filteredCourses}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default HodDashboard;
