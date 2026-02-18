import React, { useState } from 'react';
import { Card, Descriptions, Tag, Typography, Button, Space, Spin, Alert, Table, Modal, Select, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined, ArrowLeftOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons'
import { useCourse, useCourseEnrollments, useCreateCourseEnrollment, useEnrollInCourse } from '../../../api/courses';
import { useUsers } from '../../../api/users';
import { CourseStatus, UserRole } from '../../../types/index';
import { useAuth } from '../../../contexts/AuthContext';

const { Title, Text } = Typography;

const CourseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const courseId = id || undefined;
  const { user } = useAuth();

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<number | undefined>();

  const { data: course, isLoading, error } = useCourse(courseId!);

  const { data: enrollments, isLoading: enrollmentsLoading } = useCourseEnrollments({
    course: courseId,
  });

  const { data: students } = useUsers({
    role: UserRole.STUDENT,
  });

  const createEnrollmentMutation = useCreateCourseEnrollment();
  const enrollInCourseMutation = useEnrollInCourse();

  // Check if current student is enrolled
  const studentEnrollment = enrollments?.results?.find(
    (e: any) => e.student === user?.id
  );
  const isEnrolled = studentEnrollment?.status === 'ENROLLED';

  const handleEnroll = async () => {
    if (!courseId || !selectedStudent) return;

    try {
      await createEnrollmentMutation.mutateAsync({
        course: courseId,
        student: selectedStudent,
      });
      message.success('Student enrolled successfully');
      setIsEnrollModalOpen(false);
      setSelectedStudent(undefined);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to enroll student');
    }
  };

  // Handle student direct enrollment in course
  const handleEnrollInCourse = async () => {
    if (!courseId) return;
    try {
      await enrollInCourseMutation.mutateAsync(courseId);
      message.success('Enrollment request submitted for approval.');
    } catch (error: any) {
      message.error(error.response?.data?.course?.[0] || error.response?.data?.detail || 'Failed to enroll');
    }
  };

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Course Details</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load course"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!course) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Course Details</Title>
        <Alert
          type="warning"
          showIcon
          message="Course not found"
          description="The course you're looking for doesn't exist or you don't have permission to view it."
        />
      </div>
    );
  }

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard/courses')}
          >
            Back to Courses
          </Button>
          <Title level={2} style={{ margin: 0 }}>Course Details</Title>
        </Space>
        <Space>
          {/* Student: Enroll Button (only if not already enrolled) */}
          {user?.role === UserRole.STUDENT && !isEnrolled && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleEnrollInCourse}
              loading={enrollInCourseMutation.isPending}
            >
              Enroll Now
            </Button>
          )}
          {user?.role === UserRole.STUDENT && isEnrolled && (
            <Tag color="green" style={{ padding: '4px 12px', fontSize: 14 }}>
              Enrolled
            </Tag>
          )}
          {/* Admin/HOD: Edit Button */}
          {(user?.role === UserRole.ADMIN || user?.role === UserRole.HOD) && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/dashboard/courses/${course.id}/edit`)}
            >
              Edit Course
            </Button>
          )}
        </Space>
      </div>

      <Card>
        <Descriptions
          title="Basic Information"
          bordered
          column={2}
          size="small"
        >
          <Descriptions.Item label="Course Code">
            <Text strong>{course.code}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Course Title">
            <Text strong>{course.title}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Department">
            {course.department_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Credits">
            {course.credits}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusColors[course.status]}>
              {statusLabels[course.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Assigned Teacher">
            {course.assigned_teacher_email || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>
            {course.description || 'No description provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(course.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {new Date(course.updated_at).toLocaleString()}
          </Descriptions.Item>
          {course.approved_at && (
            <>
              <Descriptions.Item label="Approved By">
                {(course as any).approved_by_email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Approved At">
                {new Date(course.approved_at).toLocaleString()}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Additional sections can be added here for enrollments, assessments, etc. */}


      {user?.role === UserRole.TEACHER && (
        <Card
          title="Enrolled Students"
          style={{ marginTop: 16 }}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsEnrollModalOpen(true)}
            >
              Enroll Student
            </Button>
          }
        >
          <Table
            dataSource={enrollments?.results}
            rowKey="id"
            loading={enrollmentsLoading}
            pagination={false}
            columns={[
              {
                title: 'Name',
                key: 'name',
                render: (_, record) => `${record.student_first_name} ${record.student_last_name}`,
              },
              {
                title: 'Email',
                dataIndex: 'student_email',
                key: 'email',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status) => <Tag color={status === 'ENROLLED' ? 'green' : 'default'}>{status}</Tag>,
              },
              {
                title: 'Enrolled At',
                dataIndex: 'enrolled_at',
                key: 'enrolled_at',
                render: (date) => new Date(date).toLocaleDateString(),
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title="Enroll Student"
        open={isEnrollModalOpen}
        onOk={handleEnroll}
        onCancel={() => {
          setIsEnrollModalOpen(false);
          setSelectedStudent(undefined);
        }}
        confirmLoading={createEnrollmentMutation.isPending}
        okText="Enroll"
        okButtonProps={{ disabled: !selectedStudent }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Select a student to enroll in this course:</Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Select a student"
          showSearch
          optionFilterProp="children"
          onChange={(value) => setSelectedStudent(value)}
          value={selectedStudent}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={students?.results
            ?.filter(s => !enrollments?.results.some(e => e.student === s.id)) // Filter out already enrolled
            .map(student => ({
              value: student.id,
              label: `${student.first_name} ${student.last_name} (${student.email})`,
            }))
          }
        />
      </Modal>
    </div >
  );
};

export default CourseDetailPage;
