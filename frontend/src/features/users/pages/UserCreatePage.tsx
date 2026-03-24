import React from 'react';
import { Form, Input, Select, Button, Card, message, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCreateUser } from '../../../api/users';
import { useDepartments } from '../../../api/departments';
import type { CreateUserPayload } from '../../../types/index';
import { UserRole } from '../../../types/index';

const { Title } = Typography;

const UserCreatePage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const createMutation = useCreateUser();
  const { data: departmentsData } = useDepartments();

  const handleSubmit = async (values: CreateUserPayload) => {
    try {
      await createMutation.mutateAsync(values);
      message.success('User created successfully');
      navigate('/dashboard/users');
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData) {
        // Handle field-specific errors
        Object.keys(errorData).forEach((field) => {
          form.setFields([
            {
              name: field,
              errors: Array.isArray(errorData[field]) ? errorData[field] : [errorData[field]],
            },
          ]);
        });
      } else {
        message.error('Failed to create user');
      }
    }
  };

  return (
    <div>
      <Title level={2}>Create New User</Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            role: UserRole.STUDENT,
            is_active: true,
          }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>

          <Form.Item
            name="first_name"
            label="First Name"
            rules={[{ required: true, message: 'Please input first name!' }]}
          >
            <Input placeholder="John" />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[{ required: true, message: 'Please input last name!' }]}
          >
            <Input placeholder="Doe" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role!' }]}
          >
            <Select>
              <Select.Option value={UserRole.ADMIN}>Administrator</Select.Option>
              <Select.Option value={UserRole.HOD}>Head of Department</Select.Option>
              <Select.Option value={UserRole.TEACHER}>Teacher</Select.Option>
              <Select.Option value={UserRole.STUDENT}>Student</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="department" label="Department">
            <Select placeholder="Select department" allowClear>
              {departmentsData?.results?.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="phone_number" label="Phone Number">
            <Input placeholder="+1234567890" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Initial Password"
            rules={[
              { required: true, message: 'Please input password!' },
              { min: 8, message: 'Password must be at least 8 characters!' },
            ]}
          >
            <Input.Password placeholder="Password" />
          </Form.Item>

          <Form.Item name="is_active" label="Status">
            <Select>
              <Select.Option value={true}>Active</Select.Option>
              <Select.Option value={false}>Inactive</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Create User
              </Button>
              <Button onClick={() => navigate('/dashboard/users')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UserCreatePage;
