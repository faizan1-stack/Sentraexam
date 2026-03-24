import React, { useState } from 'react';
import { Table, Button, Typography, Input, Space, message, Alert } from 'antd';
import { ArrowLeftOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCourses, useCourseEnrollments, useEnrollInCourse } from '../../../api/courses';
import { useAuth } from '../../../contexts/AuthContext';
import type { Course } from '../../../types/index';
import { CourseStatus } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;

const getEnrollmentErrorMessage = (error: any): string => {
    const data = error?.response?.data;
    if (!data) return 'Failed to enroll';
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.course) && data.course[0]) return data.course[0];
    if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) return data.non_field_errors[0];
    const firstString = Object.values(data).find((value) => Array.isArray(value) && value[0]) as
        | string[]
        | undefined;
    if (firstString?.[0]) return firstString[0];
    return 'Failed to enroll';
};

const EnrollCoursePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    // Get all courses (filtered to student's department by backend)
    const { data: coursesData, isLoading: coursesLoading, error } = useCourses({
        search,
        status: CourseStatus.ACTIVE, // Only show active courses
        page,
    });

    // Get student's current enrollments
    const { data: enrollmentsData, refetch: refetchEnrollments } = useCourseEnrollments({});

    const enrollMutation = useEnrollInCourse();

    // Get list of course IDs student is already enrolled in
    const enrolledCourseIds = new Set(
        enrollmentsData?.results?.map((e: any) => e.course) || []
    );

    // Filter courses to only show ones not enrolled in and from the student's department
    const availableCourses = (coursesData?.results || []).filter((course: Course) => {
        // Only show courses not already enrolled
        if (enrolledCourseIds.has(course.id)) return false;
        // Only show courses from student's department
        if (user?.department && course.department !== user.department) return false;
        return true;
    });

    const handleEnroll = async (courseId: string) => {
        try {
            await enrollMutation.mutateAsync(courseId);
            await refetchEnrollments();
            message.success('Enrollment request submitted for approval.');
        } catch (error: any) {
            message.error(getEnrollmentErrorMessage(error));
        }
    };

    if (error) {
        return (
            <div>
                <Title level={2} style={{ marginBottom: 16 }}>Enroll in Course</Title>
                <Alert
                    type="error"
                    showIcon
                    message="Failed to load courses"
                    description={(error as any)?.message || 'Please check your connection or login again.'}
                />
            </div>
        );
    }

    const columns: ColumnType<Course>[] = [
        {
            title: 'Code',
            dataIndex: 'code',
            key: 'code',
            sorter: (a, b) => a.code.localeCompare(b.code),
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            sorter: (a, b) => a.title.localeCompare(b.title),
            render: (text, record) => (
                <a onClick={() => navigate(`/dashboard/courses/${record.id}`)}>{text}</a>
            ),
        },
        {
            title: 'Department',
            dataIndex: 'department_name',
            key: 'department',
            render: (name) => name || '-',
        },
        {
            title: 'Credits',
            dataIndex: 'credits',
            key: 'credits',
            align: 'center',
        },
        {
            title: 'Teacher',
            dataIndex: 'assigned_teacher_email',
            key: 'teacher',
            render: (email) => email || '-',
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => handleEnroll(record.id)}
                    loading={enrollMutation.isPending}
                    disabled={!user?.department}
                    size="small"
                >
                    Enroll
                </Button>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <Space>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/dashboard/courses')}
                    >
                        Back to My Courses
                    </Button>
                    <Title level={2} style={{ margin: 0 }}>Enroll in Course</Title>
                </Space>
            </div>

            <Alert
                type="info"
                message="Available Courses"
                description="Browse and enroll in courses from your department. Click 'Enroll' to add a course to your enrolled courses."
                showIcon
                style={{ marginBottom: 16 }}
            />
            {!user?.department && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="No department assigned"
                    description="Your account is not assigned to a department, so enrollment requests will fail. Contact your administrator."
                />
            )}

            <Space style={{ marginBottom: 16, width: '100%' }} size="middle" wrap>
                <Input
                    placeholder="Search courses..."
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 320, maxWidth: '100%' }}
                    allowClear
                />
            </Space>

            <Table
                columns={columns}
                dataSource={availableCourses}
                loading={coursesLoading}
                rowKey="id"
                pagination={{
                    current: page,
                    pageSize: 10,
                    total: availableCourses.length,
                    onChange: (newPage) => setPage(newPage),
                    showSizeChanger: false,
                    showTotal: (total) => `${total} available courses`,
                }}
                locale={{
                    emptyText: user?.department
                        ? 'No courses available for enrollment. You may already be enrolled in all courses from your department.'
                        : 'Assign a department to your student account to enroll in courses.',
                }}
            />
        </div>
    );
};

export default EnrollCoursePage;
