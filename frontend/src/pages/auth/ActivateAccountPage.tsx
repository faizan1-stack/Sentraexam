import React, { useState } from 'react';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useActivateAccount } from '../../api/auth';

const { Title, Text } = Typography;

const ActivateAccountPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const activateMutation = useActivateAccount();

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    if (!token) {
      setError('Invalid activation token');
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await activateMutation.mutateAsync({
        token,
        password: values.password,
      });
      navigate('/login', {
        state: { message: 'Account activated successfully! Please log in.' },
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to activate account');
    }
  };

  return (
    <>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
        Activate Your Account
      </Title>
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
        Set your password to activate your account
      </Text>

      {error && (
        <Alert
          message="Activation Failed"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} name="activate" onFinish={handleSubmit} layout="vertical" size="large">
        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: 'Please input your password!' },
            { min: 8, message: 'Password must be at least 8 characters!' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm Password"
          rules={[
            { required: true, message: 'Please confirm your password!' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Confirm Password"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={activateMutation.isPending} block>
            Activate Account
          </Button>
        </Form.Item>
      </Form>
    </>
  );
};

export default ActivateAccountPage;
