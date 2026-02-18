import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Badge,
  Button,
  Divider,
  Dropdown,
  Empty,
  List,
  Segmented,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../api/notifications';
import type { Notification } from '../types';

dayjs.extend(relativeTime);

type Filter = 'all' | 'unread';

const { Text } = Typography;

const deriveIntent = (n: Notification): { icon: React.ReactNode; border: string } => {
  const action = String(n.metadata?.action || n.metadata?.type || '').toLowerCase();
  const text = `${n.subject} ${n.body}`.toLowerCase();

  const isViolation = action.includes('proctor') || action.includes('cheating') || text.includes('violation');
  const isWarning = action.includes('reminder') || text.includes('deadline') || action.includes('warning');
  const isSuccess = action.includes('approved') || action.includes('submitted') || action.includes('graded');

  if (isViolation) return { icon: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />, border: '#ef4444' };
  if (isWarning) return { icon: <WarningOutlined style={{ color: '#f59e0b' }} />, border: '#f59e0b' };
  if (isSuccess) return { icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />, border: '#16a34a' };
  return { icon: <InfoCircleOutlined style={{ color: '#3b82f6' }} />, border: '#3b82f6' };
};

const pickRoute = (n: Notification): string => {
  const assessmentId = n.metadata?.assessment_id;
  if (assessmentId) return `/dashboard/assessments/${assessmentId}`;
  return '/dashboard/notifications';
};

export const NotificationCenter: React.FC<{
  connected?: boolean;
}> = ({ connected = true }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.count ?? 0;

  const { data, isLoading } = useNotifications({
    is_read: filter === 'unread' ? false : undefined,
    page: 1,
  });

  const notifications = useMemo(() => (data?.results ?? []).slice(0, 5), [data?.results]);

  const markOne = useMarkNotificationAsRead();
  const markAll = useMarkAllNotificationsAsRead();

  const onMarkAll = async () => {
    await markAll.mutateAsync();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
  };

  const onOpenNotification = async (n: Notification) => {
    try {
      if (!n.is_read) {
        await markOne.mutateAsync(n.id);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
      }
    } finally {
      navigate(pickRoute(n));
    }
  };

  const menu = (
    <div
      style={{
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 560,
        overflow: 'hidden',
        borderRadius: 16,
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-strong)',
        border: '1px solid var(--stroke)',
      }}
    >
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Space size={10}>
          <Text strong style={{ fontSize: 14 }}>Notifications</Text>
          {!connected && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Offline
            </Text>
          )}
        </Space>
        <Space size={8}>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={onMarkAll}
              loading={markAll.isPending}
              style={{ borderRadius: 10 }}
            >
              Mark all read
            </Button>
          )}
          <Button size="small" onClick={() => navigate('/dashboard/notifications')} style={{ borderRadius: 10 }}>
            View all
          </Button>
        </Space>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <Segmented
          size="small"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { label: 'All', value: 'all' },
            { label: `Unread (${unreadCount})`, value: 'unread' },
          ]}
          style={{ width: '100%' }}
        />
      </div>

      <Divider style={{ margin: 0 }} />

      <div style={{ maxHeight: 460, overflow: 'auto', padding: 12 }}>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : notifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={notifications}
            renderItem={(n) => {
              const intent = deriveIntent(n);
              return (
                <List.Item
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${n.is_read ? 'transparent' : 'var(--stroke)'}`,
                    background: n.is_read ? 'transparent' : 'rgba(41, 99, 116, 0.08)',
                    cursor: 'pointer',
                    marginBottom: 10,
                    borderLeft: `4px solid ${intent.border}`,
                  }}
                  onClick={() => onOpenNotification(n)}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          display: 'grid',
                          placeItems: 'center',
                          background: 'var(--surface-muted)',
                          border: '1px solid var(--stroke)',
                        }}
                      >
                        {intent.icon}
                      </div>
                    }
                    title={
                      <Space size={8} align="start">
                        <Text strong={!n.is_read} style={{ fontSize: 13 }}>
                          {n.subject}
                        </Text>
                        {!n.is_read && (
                          <span
                            aria-label="Unread"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 99,
                              background: 'var(--accent-soft)',
                              display: 'inline-block',
                              marginTop: 6,
                            }}
                          />
                        )}
                      </Space>
                    }
                    description={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                          {n.body}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {n.created_at ? dayjs(n.created_at).fromNow() : ''}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => menu}
      placement="bottomRight"
    >
      <Tooltip title={connected ? 'Notifications' : 'Notifications (offline: auto-retry)'}>
        <Badge count={unreadCount} offset={[-5, 5]}>
          <Button
            type="text"
            shape="circle"
            icon={<BellOutlined style={{ fontSize: 20, opacity: connected ? 1 : 0.65 }} />}
            aria-label="Open notifications"
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  );
};
