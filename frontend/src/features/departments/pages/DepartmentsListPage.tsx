import React, { useState } from 'react';
import { Table, Button, Space, Input, message, Typography, Tag, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDepartments, useDeleteDepartment } from '../../../api/departments';
import { useAuth } from '../../../contexts/AuthContext';
import { UserRole } from '../../../types/index';
import type { Department } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;
const DepartmentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useDepartments({ search, page });
  const deleteMutation = useDeleteDepartment();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Departments</Title>
        <Alert type="error" showIcon message="Failed to load departments" description={(error as any)?.message || 'Please check your connection or login again.'} />
      </div>
    );
  }

  const handleDelete = async (department: Department) => {
    try {
      await deleteMutation.mutateAsync(department.id);
      message.success('Department deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete department');
    }
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  const columns: ColumnType<Department>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Head of Department',
      dataIndex: 'head_email',
      key: 'head',
      render: (email) => email || '-',
    },
    {
      title: 'Teachers',
      dataIndex: 'teacher_count',
      key: 'teachers',
      render: (count) => (
        <Space>
          <TeamOutlined />
          {count || 0}
        </Space>
      ),
      align: 'center',
    },
    {
      title: 'Students',
      dataIndex: 'student_count',
      key: 'students',
      render: (count) => (
        <Space>
          <TeamOutlined />
          {count || 0}
        </Space>
      ),
      align: 'center',
    },
    ...(isAdmin ? [{
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Department) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/departments/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Department"
            description={`Are you sure you want to delete ${record.name}?`}
            okText="Delete"
            okType="danger"
            okButtonProps={{ loading: deleteMutation.isPending }}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Departments</Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/dashboard/departments/new')}
          >
            Add Department
          </Button>
        )}
      </div>

      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        <Input
          placeholder="Search departments..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320, maxWidth: '100%' }}
          allowClear
        />
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
          showTotal: (total) => `Total ${total} departments`,
        }}
      />
    </div>
  );
};

export default DepartmentsListPage;
