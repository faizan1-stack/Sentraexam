import React from 'react';
import { Button, Typography, Space, Tooltip } from 'antd';
import { ArrowRightOutlined, CheckCircleOutlined, MoonOutlined, SafetyOutlined, SunOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();

  return (
    <div className="welcome-shell">
      <header className="welcome-header">
        <Space size="middle" align="center">
          <img src="/logo.png" alt="Sentraexam logo" style={{ width: 44, height: 44 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Sentraexam</Title>
            <Text type="secondary">Smart Examination Platform</Text>
          </div>
        </Space>
        <Space size="middle">
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Button
              type="text"
              shape="circle"
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleMode}
            />
          </Tooltip>
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate('/login')}>
            Login
          </Button>
        </Space>
      </header>

      <main className="welcome-main">
        <section className="welcome-hero">
          <Title level={1} style={{ marginBottom: 12 }}>
            Centralized, Secure, and Smarter Assessments
          </Title>
          <Paragraph style={{ fontSize: 16 }}>
            Manage courses, schedule assessments, and monitor exams with real-time insights.
            Sentraexam keeps everything organized for administrators, teachers, and students.
          </Paragraph>
          <Space size="middle">
            <Button type="primary" size="large" onClick={() => navigate('/login')}>
              Get Started
            </Button>
            <Button size="large" onClick={() => navigate('/login')}>
              Explore Dashboard
            </Button>
          </Space>
        </section>

        <section className="welcome-card">
          <Space direction="vertical" size="large">
            <Space align="start">
              <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
              <div>
                <Text strong>Automated Assessment Flow</Text>
                <div>
                  <Text type="secondary">Create, approve, schedule, and analyze exams with ease.</Text>
                </div>
              </div>
            </Space>
            <Space align="start">
              <SafetyOutlined style={{ fontSize: 22, color: 'var(--accent)' }} />
              <div>
                <Text strong>Secure Monitoring</Text>
                <div>
                  <Text type="secondary">AI-powered proctoring and violation tracking built-in.</Text>
                </div>
              </div>
            </Space>
            <Space align="start">
              <TeamOutlined style={{ fontSize: 22, color: 'var(--mint)' }} />
              <div>
                <Text strong>Role-Based Experiences</Text>
                <div>
                  <Text type="secondary">Tailored dashboards for admins, HODs, teachers, and students.</Text>
                </div>
              </div>
            </Space>
          </Space>
        </section>
      </main>

      <footer className="welcome-footer">
        &copy; {new Date().getFullYear()} Sentraexam. All rights reserved.
      </footer>
    </div>
  );
};

export default WelcomePage;
