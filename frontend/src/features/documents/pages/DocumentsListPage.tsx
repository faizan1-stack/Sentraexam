import React, { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDocuments, useDeleteDocument, useDownloadDocument } from '../../../api/documents';
import type { Document } from '../../../types/index';
import { DocumentAccessLevel } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;

const DocumentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [accessLevelFilter, setAccessLevelFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useDocuments({
    search,
    access_level: accessLevelFilter,
    category: categoryFilter,
    page,
  });

  const deleteMutation = useDeleteDocument();
  const downloadMutation = useDownloadDocument();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Documents</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load documents"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  const handleDelete = async (document: Document) => {
    try {
      await deleteMutation.mutateAsync(document.id);
      message.success('Document deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete document');
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const blob = await downloadMutation.mutateAsync(document.id);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from response or use document title
      const filename = document.title + '.pdf'; // Assuming PDF, adjust as needed
      link.setAttribute('download', filename);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Document downloaded successfully');
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to download document');
    }
  };

  const accessLevelColors: Record<DocumentAccessLevel, string> = {
    [DocumentAccessLevel.PRIVATE]: 'orange',
    [DocumentAccessLevel.DEPARTMENT]: 'blue',
    [DocumentAccessLevel.INSTITUTION]: 'green',
  };

  const accessLevelLabels: Record<DocumentAccessLevel, string> = {
    [DocumentAccessLevel.PRIVATE]: 'Private',
    [DocumentAccessLevel.DEPARTMENT]: 'Department',
    [DocumentAccessLevel.INSTITUTION]: 'Institution',
  };

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  const columns: ColumnType<Document>[] = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description) => (
        <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {description || 'No description'}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category_name',
      key: 'category',
      render: (name) => name || '-',
    },
    {
      title: 'Access Level',
      dataIndex: 'access_level',
      key: 'access_level',
      render: (level: DocumentAccessLevel) => (
        <Tag color={accessLevelColors[level]}>{accessLevelLabels[level]}</Tag>
      ),
      filters: [
        { text: 'Institution', value: DocumentAccessLevel.INSTITUTION },
        { text: 'Department', value: DocumentAccessLevel.DEPARTMENT },
        { text: 'Personal', value: DocumentAccessLevel.PERSONAL },
      ],
    },
    {
      title: 'File Type',
      dataIndex: 'file',
      key: 'file_type',
      render: (file) => (
        <Tag>{getFileExtension(file)}</Tag>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'owner_email',
      key: 'owner',
      render: (email) => email || '-',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            loading={downloadMutation.isPending}
          >
            Download
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/documents/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Document"
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
        <Title level={2} style={{ margin: 0 }}>Documents</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/documents/new')}
        >
          Upload Document
        </Button>
      </div>

      <Space style={{ marginBottom: 16, width: '100%' }} size="middle" wrap>
        <Input
          placeholder="Search documents..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, maxWidth: '100%' }}
          allowClear
        />
        <Select
          placeholder="Filter by access level"
          style={{ width: 240, maxWidth: '100%' }}
          value={accessLevelFilter}
          onChange={setAccessLevelFilter}
          allowClear
        >
          <Select.Option value={DocumentAccessLevel.PRIVATE}>Private</Select.Option>
          <Select.Option value={DocumentAccessLevel.DEPARTMENT}>Department</Select.Option>
          <Select.Option value={DocumentAccessLevel.INSTITUTION}>Institution</Select.Option>
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
          showTotal: (total) => `Total ${total} documents`,
        }}
      />
    </div>
  );
};

export default DocumentsListPage;
