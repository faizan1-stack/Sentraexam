import React, { useState } from 'react';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type LoginPayload = {
  email: string;
  password: string;
};

const { Link } = Typography;

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginPayload) => {
    setLoading(true);
    setError(null);

    try {
      await login(values);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <Alert
          message="Login Failed"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        name="login"
        onFinish={handleSubmit}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please input your email!' },
            { type: 'email', message: 'Please enter a valid email!' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="email@example.com"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Password"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Log In
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <Link onClick={() => navigate('/reset-password')}>Forgot password?</Link>
        </div>
      </Form>
    </>
  );
};

export default LoginPage;
