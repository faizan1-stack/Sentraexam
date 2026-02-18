import React, { useEffect } from 'react';
import { Form, Input, Select, Button, Card, message, Typography, Space, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useUpdateUser } from '../../../api/users';
import { useDepartments } from '../../../api/departments';
import type { UpdateUserPayload } from '../../../types/index';
import { UserRole } from '../../../types/index';

const { Title } = Typography;

const UserEditPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || '0');

  const { data: user, isLoading } = useUser(userId);
  const updateMutation = useUpdateUser();
  const { data: departmentsData } = useDepartments();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        department: user.department,
        phone_number: user.phone_number,
      });
    }
  }, [user, form]);

  const handleSubmit = async (values: UpdateUserPayload) => {
    try {
      await updateMutation.mutateAsync({ id: userId, payload: values });
      message.success('User updated successfully');
      navigate('/dashboard/users');
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
        message.error('Failed to update user');
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>Edit User</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Email">
            <Input value={user?.email} disabled />
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

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Update User
              </Button>
              <Button onClick={() => navigate('/dashboard/users')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UserEditPage;
