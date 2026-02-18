import React from 'react';
import { Card, List, Typography, Button, Tag, Space, Empty, Skeleton, message } from 'antd';
import {
    BellOutlined,
    CheckOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '../../../api/notifications';
import { useQueryClient } from '@tanstack/react-query';
import type { Notification } from '../../../types/index';

const { Title, Text, Paragraph } = Typography;

const NotificationsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const { data: notificationsData, isLoading } = useNotifications();
    const markAsReadMutation = useMarkNotificationAsRead();
    const markAllAsReadMutation = useMarkAllNotificationsAsRead();

    // Handle paginated response - notifications are in results array
    const notifications = notificationsData?.results || [];

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markAsReadMutation.mutateAsync(notificationId);
            // Invalidate queries to refresh the list and count
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
        } catch (error) {
            message.error('Failed to mark notification as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsReadMutation.mutateAsync();
            message.success('All notifications marked as read');
            // Invalidate queries to refresh the list and count
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
        } catch (error) {
            message.error('Failed to mark all notifications as read');
        }
    };

    const unreadCount = notifications.filter((n: Notification) => !n.is_read).length || 0;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (isLoading) {
        return (
            <div style={{ padding: 24 }}>
                <Card>
                    <Skeleton active paragraph={{ rows: 4 }} />
                </Card>
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <Card
                title={
                    <Space>
                        <BellOutlined style={{ fontSize: 20 }} />
                        <Title level={4} style={{ margin: 0 }}>Notifications</Title>
                        {unreadCount > 0 && (
                            <Tag color="blue">{unreadCount} unread</Tag>
                        )}
                    </Space>
                }
                extra={
                    unreadCount > 0 && (
                        <Button
                            icon={<CheckCircleOutlined />}
                            onClick={handleMarkAllAsRead}
                            loading={markAllAsReadMutation.isPending}
                        >
                            Mark All as Read
                        </Button>
                    )
                }
            >
                {notifications.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No notifications yet"
                    />
                ) : (
                    <List
                        itemLayout="horizontal"
                        dataSource={notifications}
                        renderItem={(item: Notification) => (
                            <List.Item
                                style={{
                                    background: item.is_read ? 'transparent' : 'rgba(24, 144, 255, 0.05)',
                                    padding: '16px',
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    cursor: item.is_read ? 'default' : 'pointer',
                                }}
                                onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                                actions={!item.is_read ? [
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<CheckOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAsRead(item.id);
                                        }}
                                        loading={markAsReadMutation.isPending}
                                    >
                                        Mark as Read
                                    </Button>
                                ] : undefined}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '50%',
                                            background: item.is_read ? 'var(--surface-muted)' : 'var(--primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <BellOutlined style={{
                                                color: item.is_read ? 'var(--muted-ink)' : '#fff',
                                                fontSize: 18,
                                            }} />
                                        </div>
                                    }
                                    title={
                                        <Space>
                                            <Text strong={!item.is_read}>{item.subject}</Text>
                                            {!item.is_read && <Tag color="blue" style={{ fontSize: 10 }}>NEW</Tag>}
                                        </Space>
                                    }
                                    description={
                                        <div>
                                            <Paragraph
                                                ellipsis={{ rows: 2 }}
                                                style={{ margin: 0, color: item.is_read ? 'var(--muted-ink)' : 'var(--ink)' }}
                                            >
                                                {item.body}
                                            </Paragraph>
                                            <Space style={{ marginTop: 8 }}>
                                                <ClockCircleOutlined style={{ color: 'var(--muted-ink)', fontSize: 12 }} />
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {formatDate(item.created_at)}
                                                </Text>
                                            </Space>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Card>
        </div>
    );
};

export default NotificationsPage;
