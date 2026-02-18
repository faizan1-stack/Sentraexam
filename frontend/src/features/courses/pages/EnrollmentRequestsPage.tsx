import React from 'react';
import { Table, Button, Space, Typography, Alert, Tag, Popconfirm, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePendingEnrollments, useApproveEnrollment, useRejectEnrollment } from '../../../api/courses';
import type { CourseEnrollment } from '../../../types';

const { Title, Text } = Typography;

const EnrollmentRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = usePendingEnrollments();
  const approveMutation = useApproveEnrollment();
  const rejectMutation = useRejectEnrollment();

  const handleApprove = async (enrollmentId: string) => {
    try {
      await approveMutation.mutateAsync(enrollmentId);
      message.success('Enrollment approved');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to approve enrollment');
    }
  };

  const handleReject = async (enrollmentId: string) => {
    try {
      await rejectMutation.mutateAsync(enrollmentId);
      message.success('Enrollment rejected');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to reject enrollment');
    }
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_: any, record: CourseEnrollment) => (
        <div>
          <Text strong>{record.student_first_name} {record.student_last_name}</Text>
          <div style={{ fontSize: 12, color: 'var(--muted-ink)' }}>{record.student_email}</div>
        </div>
      ),
    },
    {
      title: 'Course',
      key: 'course',
      render: (_: any, record: CourseEnrollment) => (
        <div>
          <Text strong>{record.course_code}</Text>
          <div style={{ fontSize: 12, color: 'var(--muted-ink)' }}>{record.course_title}</div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department',
      render: (name: string) => name || '-',
    },
    {
      title: 'Requested At',
      dataIndex: 'enrolled_at',
      key: 'requested_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="gold">{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CourseEnrollment) => (
        <Space>
          <Button
            type="link"
            icon={<CheckOutlined />}
            loading={approveMutation.isPending}
            onClick={() => handleApprove(record.id)}
          >
            Approve
          </Button>
          <Popconfirm
            title="Reject Enrollment"
            description="Are you sure you want to reject this request?"
            okText="Reject"
            okType="danger"
            okButtonProps={{ loading: rejectMutation.isPending }}
            onConfirm={() => handleReject(record.id)}
          >
            <Button type="link" danger icon={<CloseOutlined />}>
              Reject
            </Button>
          </Popconfirm>
          <Button type="link" onClick={() => navigate(`/dashboard/courses/${record.course}`)}>
            View Course
          </Button>
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Enrollment Requests</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load enrollment requests"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Enrollment Requests</Title>
      </div>
      <Table
        columns={columns}
        dataSource={data?.results || []}
        loading={isLoading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />
    </div>
  );
};

export default EnrollmentRequestsPage;
