import React, { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, SendOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAnnouncements, useDeleteAnnouncement, useSendAnnouncement, useScheduleAnnouncement } from '../../../api/notifications';
import type { Announcement } from '../../../types/index';
import { AnnouncementStatus, AnnouncementAudience } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;

const AnnouncementsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [audienceFilter, setAudienceFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useAnnouncements({
    search,
    status: statusFilter,
    audience: audienceFilter,
    page,
  });

  const deleteMutation = useDeleteAnnouncement();
  const sendMutation = useSendAnnouncement();
  const scheduleMutation = useScheduleAnnouncement();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Announcements</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load announcements"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  const handleDelete = async (announcement: Announcement) => {
    try {
      await deleteMutation.mutateAsync(announcement.id);
      message.success('Announcement deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete announcement');
    }
  };

  const handleSend = async (announcementId: number) => {
    try {
      await sendMutation.mutateAsync(announcementId);
      message.success('Announcement sent successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to send announcement');
    }
  };

  const handleSchedule = async (announcementId: number) => {
    try {
      // For now, we'll schedule for 1 hour from now
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await scheduleMutation.mutateAsync({ id: announcementId, scheduledFor });
      message.success('Announcement scheduled successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to schedule announcement');
    }
  };

  const statusColors: Record<AnnouncementStatus, string> = {
    [AnnouncementStatus.DRAFT]: 'default',
    [AnnouncementStatus.SCHEDULED]: 'orange',
    [AnnouncementStatus.SENT]: 'green',
    [AnnouncementStatus.CANCELLED]: 'red',
  };

  const statusLabels: Record<AnnouncementStatus, string> = {
    [AnnouncementStatus.DRAFT]: 'Draft',
    [AnnouncementStatus.SCHEDULED]: 'Scheduled',
    [AnnouncementStatus.SENT]: 'Sent',
    [AnnouncementStatus.CANCELLED]: 'Cancelled',
  };

  const audienceLabels: Record<AnnouncementAudience, string> = {
    [AnnouncementAudience.ALL]: 'All Users',
    [AnnouncementAudience.DEPARTMENT]: 'Department',
    [AnnouncementAudience.COURSE]: 'Course',
    [AnnouncementAudience.CUSTOM]: 'Custom',
  };

  const columns: ColumnType<Announcement>[] = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (message) => (
        <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message}
        </div>
      ),
    },
    {
      title: 'Audience',
      dataIndex: 'audience',
      key: 'audience',
      render: (audience: AnnouncementAudience) => (
        <Tag>{audienceLabels[audience]}</Tag>
      ),
      filters: [
        { text: 'All Users', value: AnnouncementAudience.ALL },
        { text: 'Department', value: AnnouncementAudience.DEPARTMENT },
        { text: 'Course', value: AnnouncementAudience.COURSE },
        { text: 'Custom', value: AnnouncementAudience.CUSTOM },
      ],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AnnouncementStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
      filters: [
        { text: 'Draft', value: AnnouncementStatus.DRAFT },
        { text: 'Scheduled', value: AnnouncementStatus.SCHEDULED },
        { text: 'Sent', value: AnnouncementStatus.SENT },
        { text: 'Cancelled', value: AnnouncementStatus.CANCELLED },
      ],
    },
    {
      title: 'Scheduled For',
      dataIndex: 'scheduled_for',
      key: 'scheduled_for',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Sent At',
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/notifications/${record.id}/edit`)}
          >
            Edit
          </Button>
          {record.status === AnnouncementStatus.DRAFT && (
            <>
              <Button
                type="link"
                icon={<SendOutlined />}
                onClick={() => handleSend(record.id)}
                loading={sendMutation.isPending}
              >
                Send
              </Button>
              <Button
                type="link"
                icon={<CalendarOutlined />}
                onClick={() => handleSchedule(record.id)}
                loading={scheduleMutation.isPending}
              >
                Schedule
              </Button>
            </>
          )}
          <Popconfirm
            title="Delete Announcement"
            description={`Are you sure you want to delete "${record.title}"?`}
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
        <Title level={2} style={{ margin: 0 }}>Announcements</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/notifications/new')}
        >
          Create Announcement
        </Button>
      </div>

      <Space style={{ marginBottom: 16, width: '100%' }} size="middle" wrap>
        <Input
          placeholder="Search announcements..."
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
          <Select.Option value={AnnouncementStatus.DRAFT}>Draft</Select.Option>
          <Select.Option value={AnnouncementStatus.SCHEDULED}>Scheduled</Select.Option>
          <Select.Option value={AnnouncementStatus.SENT}>Sent</Select.Option>
          <Select.Option value={AnnouncementStatus.CANCELLED}>Cancelled</Select.Option>
        </Select>
        <Select
          placeholder="Filter by audience"
          style={{ width: 220, maxWidth: '100%' }}
          value={audienceFilter}
          onChange={setAudienceFilter}
          allowClear
        >
          <Select.Option value={AnnouncementAudience.ALL}>All Users</Select.Option>
          <Select.Option value={AnnouncementAudience.DEPARTMENT}>Department</Select.Option>
          <Select.Option value={AnnouncementAudience.COURSE}>Course</Select.Option>
          <Select.Option value={AnnouncementAudience.CUSTOM}>Custom</Select.Option>
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
          showTotal: (total) => `Total ${total} announcements`,
        }}
      />
    </div>
  );
};

export default AnnouncementsListPage;
