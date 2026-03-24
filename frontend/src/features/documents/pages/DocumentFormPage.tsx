import React from 'react';
import { Form, Input, Select, Button, message, Typography, Card, Space, Spin, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocument, useCreateDocument, useUpdateDocument } from '../../../api/documents';
import { useDocumentCategories } from '../../../api/documents';
import { useDepartments } from '../../../api/departments';
import type { CreateDocumentPayload, DocumentAccessLevel } from '../../../types/index';

const { Title } = Typography;
const { TextArea } = Input;

const DocumentFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const documentId = id || undefined;

  const [form] = Form.useForm();
  const [file, setFile] = React.useState<File | null>(null);

  const { data: document, isLoading: documentLoading } = useDocument(documentId!);
  const { data: categories } = useDocumentCategories();
  const { data: departments } = useDepartments();

  const createMutation = useCreateDocument();
  const updateMutation = useUpdateDocument();

  React.useEffect(() => {
    if (document && isEdit) {
      form.setFieldsValue({
        ...document,
        category: document.category,
        department: document.department,
      });
    }
  }, [document, isEdit, form]);

  const handleFileChange = (info: any) => {
    if (info.file.status === 'done') {
      setFile(info.file.originFileObj);
      message.success(`${info.file.name} file uploaded successfully`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} file upload failed.`);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (!isEdit && !file) {
        message.error('Please select a file to upload');
        return;
      }

      console.log('File object:', file);
      console.log('File type:', file?.type);
      console.log('File size:', file?.size);

      const payload: CreateDocumentPayload = {
        title: values.title,
        description: values.description,
        category: values.category || null,
        department: values.department || null,
        access_level: values.access_level,
        file: file!,
      };

      if (isEdit && documentId) {
        await updateMutation.mutateAsync({ id: documentId, payload });
        message.success('Document updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        message.success('Document created successfully');
      }

      navigate('/dashboard/documents');
    } catch (error: any) {
      message.error(error.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} document`);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: true,
    beforeUpload: (file: File) => {
      setFile(file);
      return false; // Prevent automatic upload
    },
    onChange: handleFileChange,
  };

  if (documentLoading && isEdit) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        {isEdit ? 'Edit Document' : 'Upload Document'}
      </Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            access_level: 'PRIVATE',
          }}
        >
          <Form.Item
            name="title"
            label="Document Title"
            rules={[
              { required: true, message: 'Please enter document title' },
              { max: 200, message: 'Title must be less than 200 characters' },
            ]}
          >
            <Input placeholder="Enter document title..." />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ max: 1000, message: 'Description must be less than 1000 characters' }]}
          >
            <TextArea
              rows={4}
              placeholder="Enter document description..."
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
          >
            <Select
              placeholder="Select category (optional)"
              allowClear
              loading={!categories}
            >
              {categories?.results?.map((category) => (
                <Select.Option key={category.id} value={category.id}>
                  {category.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="access_level"
            label="Access Level"
            rules={[{ required: true, message: 'Please select access level' }]}
          >
            <Select placeholder="Select access level">
              <Select.Option value="PRIVATE">Private</Select.Option>
              <Select.Option value="DEPARTMENT">Department</Select.Option>
              <Select.Option value="INSTITUTION">Institution</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="department"
            label="Department"
          >
            <Select
              placeholder="Select department (optional)"
              allowClear
              loading={!departments}
            >
              {departments?.results?.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Document File"
            required={!isEdit}
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
            {isEdit && document?.file && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                Current file: {document.file.split('/').pop()}
              </div>
            )}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit ? 'Update Document' : 'Upload Document'}
              </Button>
              <Button onClick={() => navigate('/dashboard/documents')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default DocumentFormPage;