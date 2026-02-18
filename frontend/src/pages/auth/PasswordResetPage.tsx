import React, { useState } from 'react';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequestPasswordReset, useConfirmPasswordReset } from '../../api/auth';

const { Title, Text, Link } = Typography;

const PasswordResetPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { token } = useParams<{ token?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const requestMutation = useRequestPasswordReset();
  const confirmMutation = useConfirmPasswordReset();

  const handleRequestReset = async (values: { email: string }) => {
    try {
      const data = await requestMutation.mutateAsync(values);
      setSuccess(true);
      setResetToken(data?.token || null);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send reset email');
    }
  };

  const handleConfirmReset = async (values: { password: string; confirmPassword: string }) => {
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await confirmMutation.mutateAsync({
        token,
        password: values.password,
      });
      navigate('/login', {
        state: { message: 'Password reset successfully! Please log in.' },
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  // If token is present, show confirm password form
  if (token) {
    return (
      <>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
          Reset Your Password
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          Enter your new password
        </Text>

        {error && (
          <Alert
            message="Reset Failed"
            description={error}
            type="error"
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} name="confirmReset" onFinish={handleConfirmReset} layout="vertical" size="large">
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: 'Please input your new password!' },
              { min: 8, message: 'Password must be at least 8 characters!' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="New Password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            rules={[{ required: true, message: 'Please confirm your new password!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={confirmMutation.isPending} block>
              Reset Password
            </Button>
          </Form.Item>
        </Form>
      </>
    );
  }

  // Otherwise, show request reset form
  return (
    <>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
        Reset Password
      </Title>
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
        Enter your email and we'll send you a reset link
      </Text>

      {error && (
        <Alert
          message="Request Failed"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {success && (
        <Alert
          message="Email Sent"
          description={
            resetToken
              ? (
                <div>
                  <div>Check your email for the password reset link.</div>
                  <div style={{ marginTop: 6 }}>
                    Dev shortcut: <Link onClick={() => navigate(`/reset-password/${resetToken}`)}>Open reset link</Link>
                  </div>
                </div>
              )
              : 'Check your email for the password reset link'
          }
          type="success"
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} name="requestReset" onFinish={handleRequestReset} layout="vertical" size="large">
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please input your email!' },
            { type: 'email', message: 'Please enter a valid email!' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="email@example.com" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={requestMutation.isPending} block>
            Send Reset Link
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <Link onClick={() => navigate('/login')}>Back to login</Link>
        </div>
      </Form>
    </>
  );
};

export default PasswordResetPage;
