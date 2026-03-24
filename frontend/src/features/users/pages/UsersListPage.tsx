import React, { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useUsers, useDeleteUser } from '../../../api/users';
import type { User } from '../../../types/index';
import { UserRole } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;
const UsersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useUsers({
    search,
    role: roleFilter,
    page,
  });

  const deleteMutation = useDeleteUser();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Users</Title>
        <Alert type="error" showIcon message="Failed to load users" description={(error as any)?.message || 'Please check your connection or login again.'} />
      </div>
    );
  }

  const handleDelete = async (user: User) => {
    try {
      await deleteMutation.mutateAsync(user.id);
      message.success('User deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const roleColors: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'red',
    [UserRole.HOD]: 'orange',
    [UserRole.TEACHER]: 'blue',
    [UserRole.STUDENT]: 'green',
  };

  const columns: ColumnType<User>[] = [
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.first_name} ${record.last_name}`,
      sorter: (a, b) => a.first_name.localeCompare(b.first_name),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag color={roleColors[role]}>{role}</Tag>
      ),
      filters: [
        { text: 'Admin', value: UserRole.ADMIN },
        { text: 'HOD', value: UserRole.HOD },
        { text: 'Teacher', value: UserRole.TEACHER },
        { text: 'Student', value: UserRole.STUDENT },
      ],
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department',
      render: (name) => name || '-',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/users/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete User"
            description={`Are you sure you want to delete ${record.first_name} ${record.last_name}?`}
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
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Users</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/users/new')}
        >
          Add User
        </Button>
      </div>

      <Space style={{ marginBottom: 16, width: '100%' }} size="middle" wrap>
        <Input
          placeholder="Search users..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, maxWidth: '100%' }}
          allowClear
        />
        <Select
          placeholder="Filter by role"
          style={{ width: 200, maxWidth: '100%' }}
          value={roleFilter}
          onChange={setRoleFilter}
          allowClear
        >
          <Select.Option value={UserRole.ADMIN}>Admin</Select.Option>
          <Select.Option value={UserRole.HOD}>HOD</Select.Option>
          <Select.Option value={UserRole.TEACHER}>Teacher</Select.Option>
          <Select.Option value={UserRole.STUDENT}>Student</Select.Option>
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
          showTotal: (total) => `Total ${total} users`,
        }}
      />
    </div>
  );
};

export default UsersListPage;
