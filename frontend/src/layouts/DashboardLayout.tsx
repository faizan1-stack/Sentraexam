import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, Drawer, Grid, Tooltip, theme, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
  BellOutlined,
  FolderOutlined,
  CalendarOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { useUnreadNotificationCount } from '../api/notifications';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { NotificationCenter } from '../components/NotificationCenter';
import { UserRole } from '../types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const { data: unreadData } = useUnreadNotificationCount();
  const { isConnected: notificationsConnected } = useNotificationSocket({ enabled: true, showToasts: true });
  const lastUnreadRef = useRef<number | null>(null);
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const {
    token: { colorPrimary },
  } = theme.useToken();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Generate menu items based on user role
  const getMenuItems = () => {
    const items = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      },
    ];

    // Admin-only items
    if (user?.role === UserRole.ADMIN) {
      items.push({
        key: '/dashboard/users',
        icon: <UserOutlined />,
        label: 'Users',
      });
    }

    // Admin and HOD items
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.HOD) {
      items.push({
        key: '/dashboard/departments',
        icon: <TeamOutlined />,
        label: 'Departments',
      });
    }

    // All authenticated users
    items.push(
      {
        key: '/dashboard/courses',
        icon: <BookOutlined />,
        label: 'Courses',
      },
      ...(user?.role === UserRole.ADMIN || user?.role === UserRole.HOD || user?.role === UserRole.TEACHER
        ? [{
            key: '/dashboard/enrollments',
            icon: <TeamOutlined />,
            label: 'Enrollment Requests',
          }]
        : []),
      {
        key: '/dashboard/assessments',
        icon: <FileTextOutlined />,
        label: 'Assessments',
      },
      {
        key: '/dashboard/notifications',
        icon: <BellOutlined />,
        label: 'Notifications',
      },
      {
        key: '/dashboard/documents',
        icon: <FolderOutlined />,
        label: 'Documents',
      },
      {
        key: '/dashboard/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
      }
    );

    return items;
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/dashboard/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/dashboard/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) {
      setMobileNavOpen(false);
    }
  };

  // Fallback sound for new notifications when WebSocket is offline.
  // When WS is connected, `useNotificationSocket` plays sounds/toasts on arrival.
  useEffect(() => {
    const current = unreadData?.count ?? 0;
    if (lastUnreadRef.current === null) {
      lastUnreadRef.current = current;
      return;
    }

    const prev = lastUnreadRef.current;
    lastUnreadRef.current = current;

    if (notificationsConnected) return;
    if (current <= prev) return;

    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 520;
        gain.gain.value = 0.25;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        osc.onended = () => ctx.close().catch(() => undefined);
      } catch {
        // ignore
      }
    });
  }, [notificationsConnected, unreadData?.count]);

  // Get current path for menu highlighting
  const selectedKey = location.pathname;

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={getMenuItems()}
      onClick={handleMenuClick}
      style={{
        background: 'transparent',
        borderRight: 0,
        padding: '0 8px',
      }}
    />
  );

  return (
    <Layout className="app-shell">
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={260}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
            zIndex: 100,
          }}
          className="app-sider"
        >
          <div
            className={`sider-brand ${collapsed ? 'sider-brand--collapsed' : ''}`}
            onClick={() => navigate('/dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard');
            }}
          >
            <span className="sider-badge">
              <img src="/logo.png" alt="Sentraexam logo" className="sider-logo" />
            </span>
            {!collapsed && <span className="sider-title">Sentraexam</span>}
          </div>
          {menu}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={290}
          bodyStyle={{ padding: 0 }}
        >
          <div className="app-sider" style={{ height: '100%' }}>
            <div className="sider-brand" style={{ marginBottom: 8 }} onClick={() => navigate('/dashboard')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard'); }}>
              <span className="sider-badge">
                <img src="/logo.png" alt="Sentraexam logo" className="sider-logo" />
              </span>
              <span className="sider-title">Sentraexam</span>
            </div>
            {menu}
          </div>
        </Drawer>
      )}

      <Layout style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 260, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: isMobile ? '0 16px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            height: isMobile ? 64 : 72,
          }}
          className="app-header"
        >
          <Button
            type="text"
            icon={
              isMobile
                ? <MenuOutlined />
                : collapsed
                  ? <MenuUnfoldOutlined />
                  : <MenuFoldOutlined />
            }
            onClick={() => {
              if (isMobile) {
                setMobileNavOpen(true);
              } else {
                setCollapsed(!collapsed);
              }
            }}
            style={{
              fontSize: '18px',
              width: 48,
              height: 48,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Button
                type="text"
                shape="circle"
                icon={mode === 'dark' ? <SunOutlined style={{ fontSize: 18 }} /> : <MoonOutlined style={{ fontSize: 18 }} />}
                onClick={toggleMode}
              />
            </Tooltip>
            <NotificationCenter connected={notificationsConnected} />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 12, padding: '4px 8px', borderRadius: 8 }} className="user-dropdown">
                <Avatar
                  icon={<UserOutlined />}
                  style={{ backgroundColor: colorPrimary, verticalAlign: 'middle' }}
                  size="large"
                />
                {user && (
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      {user.first_name} {user.last_name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {user.role}
                    </Text>
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content">
          <div className="page-surface">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
