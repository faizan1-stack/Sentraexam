import React from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Spin, Alert, Space, Descriptions, List } from 'antd';
import {
    TeamOutlined,
    UserOutlined,
    BookOutlined,
} from '@ant-design/icons';
import { useHodDashboard } from '../../api/dashboard';
import { useNotifications } from '../../api/notifications';

const { Title, Text } = Typography;

const HodDashboard: React.FC = () => {
    const { data, isLoading, error } = useHodDashboard();
    const { data: notifications } = useNotifications({ page: 1 });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Spin size="large" tip="Loading dashboard...">
                    <div style={{ width: 1, height: 1 }} />
                </Spin>
            </div>
        );
    }

    if (error) {
        return (
            <Alert
                type="error"
                message="Failed to load dashboard"
                description="Please try refreshing the page."
                showIcon
            />
        );
    }

    const teacherColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Assigned Courses',
            dataIndex: 'assigned_courses',
            key: 'assigned_courses',
            render: (courses: string[]) => (
                <Space wrap>
                    {courses.length > 0 ? (
                        courses.map((code) => <Tag key={code} color="blue">{code}</Tag>)
                    ) : (
                        <Text type="secondary">No courses assigned</Text>
                    )}
                </Space>
            ),
        },
    ];

    const courseColumns = [
        {
            title: 'Code',
            dataIndex: 'code',
            key: 'code',
            render: (code: string) => <Text strong>{code}</Text>,
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Assigned Teacher',
            dataIndex: 'teacher_name',
            key: 'teacher_name',
            render: (name: string | null) =>
                name ? (
                    <Space>
                        <UserOutlined />
                        {name}
                    </Space>
                ) : (
                    <Tag color="warning">Unassigned</Tag>
                ),
        },
        {
            title: 'Students',
            dataIndex: 'student_count',
            key: 'student_count',
            render: (count: number) => <Tag color="green">{count}</Tag>,
        },
    ];

    return (
        <div>
            <Title level={2}>Head of Department Dashboard</Title>
            <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                Department overview and management
            </Text>

            {/* Department Info Card */}
            <Card style={{ marginBottom: 24 }}>
                <Descriptions title="Department Information" bordered column={3}>
                    <Descriptions.Item label="Department Name">
                        <Text strong>{data?.department?.name || 'N/A'}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Code">
                        {data?.department?.code || 'N/A'}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {/* Stats Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Teachers"
                            value={data?.total_teachers || 0}
                            prefix={<UserOutlined />}
                            valueStyle={{ color: 'var(--primary)' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Students"
                            value={data?.total_students || 0}
                            prefix={<TeamOutlined />}
                            valueStyle={{ color: 'var(--accent)' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Courses"
                            value={data?.total_courses || 0}
                            prefix={<BookOutlined />}
                            valueStyle={{ color: 'var(--mint)' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Teachers Table */}
            <Card
                title={
                    <Space>
                        <UserOutlined />
                        <span>Department Teachers</span>
                    </Space>
                }
                style={{ marginBottom: 24 }}
            >
                <Table
                    columns={teacherColumns}
                    dataSource={data?.teachers || []}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                />
            </Card>

            {/* Courses Table */}
            <Card
                title={
                    <Space>
                        <BookOutlined />
                        <span>Department Courses & Assignments</span>
                    </Space>
                }
            >
                <Table
                    columns={courseColumns}
                    dataSource={data?.courses || []}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                />
            </Card>

            <Card
                title={
                    <Space>
                        <TeamOutlined />
                        <span>Department Notifications</span>
                    </Space>
                }
                style={{ marginTop: 24 }}
            >
                <List
                    dataSource={(notifications?.results || []).slice(0, 8)}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                title={item.subject}
                                description={
                                    <>
                                        <div>{item.body}</div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {new Date(item.created_at).toLocaleString()}
                                        </Text>
                                    </>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
};

export default HodDashboard;
