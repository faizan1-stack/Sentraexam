import React from 'react';
import { Form, Input, Select, Button, Card, message, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCreateDepartment } from '../../../api/departments';
import { useUsers } from '../../../api/users';
import type { CreateDepartmentPayload } from '../../../types/index';
import { UserRole } from '../../../types/index';

const { Title } = Typography;
const { TextArea } = Input;

const DepartmentCreatePage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const createMutation = useCreateDepartment();

  // Fetch HOD users for head selection
  const { data: usersData } = useUsers({ role: UserRole.HOD });

  const handleSubmit = async (values: CreateDepartmentPayload) => {
    try {
      await createMutation.mutateAsync(values);
      message.success('Department created successfully');
      navigate('/dashboard/departments');
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData) {
        Object.keys(errorData).forEach((field) => {
          form.setFields([
            {
              name: field,
              errors: Array.isArray(errorData[field]) ? errorData[field] : [errorData[field]],
            },
          ]);
        });
      } else {
        message.error('Failed to create department');
      }
    }
  };

  return (
    <div>
      <Title level={2}>Create New Department</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Department Name"
            rules={[{ required: true, message: 'Please input department name!' }]}
          >
            <Input placeholder="Computer Science" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Department Code"
            rules={[{ required: true, message: 'Please input department code!' }]}
          >
            <Input placeholder="CS" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Department description..." />
          </Form.Item>

          <Form.Item name="head" label="Head of Department">
            <Select placeholder="Select HOD" allowClear>
              {usersData?.results?.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Create Department
              </Button>
              <Button onClick={() => navigate('/dashboard/departments')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default DepartmentCreatePage;
