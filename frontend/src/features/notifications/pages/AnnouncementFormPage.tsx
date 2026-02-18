import React from 'react';
import { Form, Input, Select, Button, message, Typography, Card, Space, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnnouncement, useCreateAnnouncement, useUpdateAnnouncement } from '../../../api/notifications';
import { useDepartments } from '../../../api/departments';
import { useCourses } from '../../../api/courses';
import type { CreateAnnouncementPayload, AnnouncementStatus, AnnouncementAudience } from '../../../types/index';

const { Title } = Typography;
const { TextArea } = Input;

const AnnouncementFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const announcementId = id ? parseInt(id, 10) : undefined;

  const [form] = Form.useForm();
  const [audience, setAudience] = React.useState<AnnouncementAudience>('ALL');

  const { data: announcement, isLoading: announcementLoading } = useAnnouncement(announcementId!);
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses({ status: 'ACTIVE' });

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();

  React.useEffect(() => {
    if (announcement && isEdit) {
      form.setFieldsValue({
        ...announcement,
        department: announcement.department,
        course: announcement.course,
      });
      setAudience(announcement.audience);
    }
  }, [announcement, isEdit, form]);

  const handleAudienceChange = (value: AnnouncementAudience) => {
    setAudience(value);
    // Clear department and course when audience changes
    form.setFieldsValue({
      department: undefined,
      course: undefined,
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload: CreateAnnouncementPayload = {
        title: values.title,
        message: values.message,
        audience: values.audience,
        status: values.status as AnnouncementStatus,
        department: values.department || null,
        course: values.course || null,
        scheduled_for: values.scheduled_for || null,
      };

      if (isEdit && announcementId) {
        await updateMutation.mutateAsync({ id: announcementId, payload });
        message.success('Announcement updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        message.success('Announcement created successfully');
      }

      navigate('/dashboard/notifications');
    } catch (error: any) {
      message.error(error.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} announcement`);
    }
  };

  if (announcementLoading && isEdit) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        {isEdit ? 'Edit Announcement' : 'Create Announcement'}
      </Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            audience: 'ALL',
            status: 'DRAFT',
          }}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[
              { required: true, message: 'Please enter announcement title' },
              { max: 200, message: 'Title must be less than 200 characters' },
            ]}
          >
            <Input placeholder="Enter announcement title..." />
          </Form.Item>

          <Form.Item
            name="message"
            label="Message"
            rules={[
              { required: true, message: 'Please enter announcement message' },
              { max: 1000, message: 'Message must be less than 1000 characters' },
            ]}
          >
            <TextArea
              rows={6}
              placeholder="Enter announcement message..."
            />
          </Form.Item>

          <Form.Item
            name="audience"
            label="Audience"
            rules={[{ required: true, message: 'Please select audience' }]}
          >
            <Select
              placeholder="Select audience"
              onChange={handleAudienceChange}
            >
              <Select.Option value="ALL">All Users</Select.Option>
              <Select.Option value="DEPARTMENT">Department</Select.Option>
              <Select.Option value="COURSE">Course</Select.Option>
              <Select.Option value="CUSTOM">Custom</Select.Option>
            </Select>
          </Form.Item>

          {audience === 'DEPARTMENT' && (
            <Form.Item
              name="department"
              label="Department"
              rules={[{ required: true, message: 'Please select department' }]}
            >
              <Select
                placeholder="Select department"
                loading={!departments}
              >
                {departments?.results?.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {audience === 'COURSE' && (
            <Form.Item
              name="course"
              label="Course"
              rules={[{ required: true, message: 'Please select course' }]}
            >
              <Select
                placeholder="Select course"
                loading={!courses}
              >
                {courses?.results?.map((course) => (
                  <Select.Option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select placeholder="Select status">
              <Select.Option value="DRAFT">Draft</Select.Option>
              <Select.Option value="SCHEDULED">Scheduled</Select.Option>
              <Select.Option value="SENT">Sent</Select.Option>
              <Select.Option value="CANCELLED">Cancelled</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduled_for"
            label="Scheduled For"
          >
            <Input
              type="datetime-local"
              placeholder="Select date and time"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit ? 'Update Announcement' : 'Create Announcement'}
              </Button>
              <Button onClick={() => navigate('/dashboard/notifications')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AnnouncementFormPage;
