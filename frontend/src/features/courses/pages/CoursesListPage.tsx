import React, { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCourses, useDeleteCourse, useApproveCourse, useCourseEnrollments } from '../../../api/courses';
import { useAuth } from '../../../contexts/AuthContext';
import type { Course, CourseEnrollment } from '../../../types/index';
import { CourseStatus, UserRole } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;

const CoursesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  // Only Admin/HOD can manage (create/edit/delete/approve) courses.
  const canManageCourses = user?.role === UserRole.ADMIN || user?.role === UserRole.HOD;
  const isStudent = user?.role === UserRole.STUDENT;

  // For non-students: fetch all courses
  const { data: coursesData, isLoading: coursesLoading, error: coursesError, refetch: refetchCourses } = useCourses({
    search: isStudent ? undefined : search,
    status: isStudent ? undefined : statusFilter,
    page: isStudent ? undefined : page,
  });

  // For students: fetch their enrollments to get enrolled course data
  const { data: enrollmentsData, isLoading: enrollmentsLoading, error: enrollmentsError } = useCourseEnrollments({
    status: 'ENROLLED',
  });

  // Determine which data to use based on role
  const isLoading = isStudent ? enrollmentsLoading : coursesLoading;
  const error = isStudent ? enrollmentsError : coursesError;
  const refetch = refetchCourses;

  // For students: extract courses from enrollments
  // For others: use courses directly
  const displayCourses = isStudent
    ? (enrollmentsData?.results || [])
      .filter((e: CourseEnrollment) => e.status === 'ENROLLED')
      .map((e: CourseEnrollment) => ({
        id: e.course,
        code: e.course_code || '',
        title: e.course_title || '',
        department: e.course_department,
        department_name: e.department_name || '',
        credits: 0, // Not available in enrollment
        status: CourseStatus.ACTIVE,
        assigned_teacher_email: '',
      } as Course))
      .filter((c: Course) => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
    : (coursesData?.results || []);

  const data = { results: displayCourses, count: displayCourses.length };

  const deleteMutation = useDeleteCourse();
  const approveMutation = useApproveCourse();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Courses</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load courses"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  const handleDelete = async (course: Course) => {
    try {
      await deleteMutation.mutateAsync(course.id);
      message.success('Course deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete course');
    }
  };

  const handleApprove = async (courseId: string) => {
    try {
      await approveMutation.mutateAsync(courseId);
      message.success('Course approved successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to approve course');
    }
  };

  const statusColors: Record<CourseStatus, string> = {
    [CourseStatus.DRAFT]: 'gold',
    [CourseStatus.ACTIVE]: 'green',
    [CourseStatus.ARCHIVED]: 'red',
  };

  const statusLabels: Record<CourseStatus, string> = {
    [CourseStatus.DRAFT]: 'Draft',
    [CourseStatus.ACTIVE]: 'Active',
    [CourseStatus.ARCHIVED]: 'Archived',
  };

  const columns: ColumnType<Course>[] = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (text, record) => (
        <a onClick={() => navigate(`/dashboard/courses/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department',
      render: (name) => name || '-',
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
      align: 'center',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: CourseStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
      filters: [
        { text: 'Draft', value: CourseStatus.DRAFT },
        { text: 'Active', value: CourseStatus.ACTIVE },
        { text: 'Archived', value: CourseStatus.ARCHIVED },
      ],
    },
    {
      title: 'Teacher',
      dataIndex: 'assigned_teacher_email',
      key: 'teacher',
      render: (email) => email || '-',
    },
    // Only show Actions column for admin/HOD/teacher
    ...(canManageCourses ? [{
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Course) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/courses/${record.id}/edit`)}
          >
            Edit
          </Button>

          {(user?.role === UserRole.ADMIN || user?.role === UserRole.HOD) &&
            record.status === CourseStatus.DRAFT && (
              <Button
                type="link"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
                loading={approveMutation.isPending}
              >
                Approve
              </Button>
            )}

          {(user?.role === UserRole.ADMIN || user?.role === UserRole.HOD) && (
            <Popconfirm
              title="Delete Course"
              description={`Are you sure you want to delete ${record.code} - ${record.title}?`}
              okText="Delete"
              okType="danger"
              okButtonProps={{ loading: deleteMutation.isPending }}
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          {user?.role === UserRole.STUDENT ? 'My Courses' : 'Courses'}
        </Title>
        <Space wrap>
          {/* Show Enroll Course button for students */}
          {user?.role === UserRole.STUDENT && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/dashboard/courses/enroll')}
            >
              Enroll Course
            </Button>
          )}

          {(canManageCourses || user?.role === UserRole.TEACHER) && (
            <Button icon={<InboxOutlined />} onClick={() => navigate('/dashboard/enrollments')}>
              Enrollment Requests
            </Button>
          )}

          {canManageCourses && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/dashboard/courses/new')}
            >
              Add Course
            </Button>
          )}
        </Space>
      </div>

      <Space style={{ marginBottom: 16, width: '100%' }} size="middle" wrap>
        <Input
          placeholder="Search courses..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, maxWidth: '100%' }}
          allowClear
        />
        <Select
          placeholder="Filter by status"
          style={{ width: 220, maxWidth: '100%' }}
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
        >
          <Select.Option value={CourseStatus.DRAFT}>Draft</Select.Option>
          <Select.Option value={CourseStatus.ACTIVE}>Active</Select.Option>
          <Select.Option value={CourseStatus.ARCHIVED}>Archived</Select.Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={data?.results || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.count || 0,
          onChange: (newPage) => setPage(newPage),
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} courses`,
        }}
      />
    </div>
  );
};

export default CoursesListPage;
