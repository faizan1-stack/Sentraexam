import React from 'react';
import { Layout, Card, Row, Col, Typography, theme, Button, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import educationIllustration from '../assets/education-illustration.svg';
import { useThemeMode } from '../contexts/ThemeContext';

const { Content } = Layout;
const { Title, Text } = Typography;

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const { mode, toggleMode } = useThemeMode();

  return (
    <Layout style={{ minHeight: '100vh' }} className="auth-layout">
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <Button
            type="text"
            shape="circle"
            icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleMode}
          />
        </Tooltip>
      </div>
      <Content>
        <Row style={{ minHeight: '100vh' }}>
          {/* Left Side - Form */}
          <Col xs={24} md={12} lg={10} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
            <div style={{ width: '100%', maxWidth: 420 }} className="auth-panel">
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 72,
                  height: 72,
                  borderRadius: 18,
                  background: `${colorPrimary}1a`,
                  marginBottom: 16,
                  boxShadow: '0 12px 24px rgba(0,0,0,0.12)'
                }}>
                  <img src="/logo.png" alt="Sentraexam logo" className="brand-logo" />
                </div>
                <Title level={2} style={{ margin: '0 0 8px', fontFamily: "'Montserrat', sans-serif" }}>Sentraexam</Title>
                <Text type="secondary" style={{ fontSize: 16 }}>Academic Management Platform</Text>
              </div>

              <Card
                bordered={false}
                style={{
                  boxShadow: 'none',
                  background: 'transparent'
                }}
                bodyStyle={{ padding: 0 }}
              >
                {children}
              </Card>

              <div style={{ marginTop: 40, textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  &copy; {new Date().getFullYear()} Sentraexam. All rights reserved.
                </Text>
              </div>
            </div>
          </Col>

          {/* Right Side - Illustration */}
          <Col xs={0} md={12} lg={14} className="auth-hero" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <div style={{ position: 'relative', textAlign: 'center', padding: 40 }} className="auth-hero-content">
              <img
                src={educationIllustration}
                alt="Education"
                style={{ maxWidth: '80%', maxHeight: '50vh', marginBottom: 40, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.25))' }}
              />
              <Title level={1} style={{ color: '#fff', marginBottom: 16, fontFamily: "'Montserrat', sans-serif" }}>
                Empowering Education
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 18, maxWidth: 500, display: 'block', margin: '0 auto' }}>
                Streamline assessments, manage courses, and track student progress with our comprehensive platform.
              </Text>
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default AuthLayout;
