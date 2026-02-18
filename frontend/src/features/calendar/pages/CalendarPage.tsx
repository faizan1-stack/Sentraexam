import React, { useState } from 'react';
import { Calendar, Button, Space, Select, Typography, Card, List, Tag, Modal, Form, Input, DatePicker, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useCalendarEvents, useCreateCalendarEvent } from '../../../api/calendar';
import { useAcademicYears } from '../../../api/calendar';
import { useAcademicTerms } from '../../../api/calendar';
import { useDepartments } from '../../../api/departments';
import { useCourses } from '../../../api/courses';
import type { CalendarEvent } from '../../../types/index';

const { Title } = Typography;
const { TextArea } = Input;

const CalendarPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [yearFilter, setYearFilter] = useState<string | undefined>();
  const [termFilter, setTermFilter] = useState<string | undefined>();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const { data: events, isLoading } = useCalendarEvents({
    academic_term: termFilter,
    start_date: selectedDate.startOf('month').format('YYYY-MM-DD'),
    end_date: selectedDate.endOf('month').format('YYYY-MM-DD'),
  });

  const { data: academicYears } = useAcademicYears();
  const { data: academicTerms } = useAcademicTerms({ academic_year: yearFilter });
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses({ status: 'ACTIVE' });

  const createEventMutation = useCreateCalendarEvent();

  const handleDateSelect = (value: Dayjs) => {
    setSelectedDate(value);
  };

  const handleYearChange = (yearId: string) => {
    setYearFilter(yearId);
    setTermFilter(undefined); // Reset term when year changes
  };

  const handleTermChange = (termId: string) => {
    setTermFilter(termId);
  };

  const handleCreateEvent = () => {
    if (!termFilter) {
      message.error('Please select an academic term first');
      return;
    }
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        title: values.title,
        description: values.description,
        event_type: values.event_type,
        start_at: values.start_at.format('YYYY-MM-DDTHH:mm:ss'),
        end_at: values.end_at.format('YYYY-MM-DDTHH:mm:ss'),
        academic_term: termFilter,
        department: values.department || undefined,
        course: values.course || undefined,
      };

      console.log('Creating calendar event with payload:', payload);

      await createEventMutation.mutateAsync(payload);
      message.success('Event created successfully');
      setIsModalVisible(false);
      form.resetFields();
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      if (error.response?.data) {
        console.error('Backend validation errors:', error.response.data);
      }
      message.error(error.response?.data?.detail || 'Failed to create event');
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const getListData = (value: Dayjs) => {
    if (!events?.results) return [];

    return events.results.filter(event => {
      const eventDate = dayjs(event.start_at);
      return eventDate.isSame(value, 'day');
    });
  };

  const dateCellRender = (value: Dayjs) => {
    const listData = getListData(value);

    return (
      <div style={{ minHeight: 80 }}>
        {listData.map((event) => (
          <div
            key={event.id}
            style={{
              background: 'var(--primary)',
              color: 'white',
              padding: '2px 4px',
              margin: '1px 0',
              borderRadius: '2px',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={event.title}
          >
            {event.title}
          </div>
        ))}
      </div>
    );
  };

  const getMonthData = (value: Dayjs) => {
    if (!events?.results) return null;

    const monthEvents = events.results.filter(event => {
      const eventDate = dayjs(event.start_at);
      return eventDate.isSame(value, 'month');
    });

    return monthEvents.length > 0 ? (
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Tag color="blue">{monthEvents.length} events</Tag>
      </div>
    ) : null;
  };

  const monthCellRender = (value: Dayjs) => {
    return getMonthData(value);
  };

  const upcomingEvents = events?.results
    ?.filter(event => dayjs(event.start_at).isAfter(dayjs()))
    .slice(0, 5) || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Academic Calendar</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateEvent}
          disabled={!termFilter}
          title={!termFilter ? 'Please select an academic term first' : undefined}
        >
          Add Event
        </Button>
      </div>

      <Space style={{ marginBottom: 16, width: '100%' }} size="middle" wrap>
        <Select
          placeholder="Select Academic Year"
          style={{ width: 220, maxWidth: '100%' }}
          value={yearFilter}
          onChange={handleYearChange}
          allowClear
        >
          {academicYears?.results?.map((year) => (
            <Select.Option key={year.id} value={year.id}>
              {year.name}
            </Select.Option>
          ))}
        </Select>

        <Select
          placeholder="Select Academic Term"
          style={{ width: 220, maxWidth: '100%' }}
          value={termFilter}
          onChange={handleTermChange}
          allowClear
          disabled={!yearFilter}
        >
          {academicTerms?.results?.map((term) => (
            <Select.Option key={term.id} value={term.id}>
              {term.name}
            </Select.Option>
          ))}
        </Select>
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <Card>
          <Calendar
            value={selectedDate}
            onSelect={handleDateSelect}
            dateCellRender={dateCellRender}
            monthCellRender={monthCellRender}
            loading={isLoading}
          />
        </Card>

        <div>
          <Card title="Upcoming Events" style={{ marginBottom: 16 }}>
            <List
              dataSource={upcomingEvents}
              loading={isLoading}
              renderItem={(event) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {event.title}
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--muted-ink)' }}>
                          {dayjs(event.start_at).format('MMM D, YYYY h:mm A')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted-ink)', marginTop: 4 }}>
                          {event.description || 'No description'}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="Selected Date Events">
            <List
              dataSource={getListData(selectedDate)}
              loading={isLoading}
              renderItem={(event) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {event.title}
                      </div>
                    }
                    description={
                      <div>
                        <Tag size="small" color="blue">
                          {event.event_type}
                        </Tag>
                        <div style={{ fontSize: '12px', color: 'var(--muted-ink)', marginTop: 4 }}>
                          {dayjs(event.start_at).format('h:mm A')} - {dayjs(event.end_at).format('h:mm A')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted-ink)', marginTop: 4 }}>
                          {event.description || 'No description'}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>
      </div>

      <Modal
        title="Create Calendar Event"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={createEventMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="Event Title"
            rules={[{ required: true, message: 'Please enter event title' }]}
          >
            <Input placeholder="Enter event title..." />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={3}
              placeholder="Enter event description..."
            />
          </Form.Item>

          <Form.Item
            name="event_type"
            label="Event Type"
            rules={[{ required: true, message: 'Please select event type' }]}
          >
            <Select placeholder="Select event type">
              <Select.Option value="MEETING">Meeting</Select.Option>
              <Select.Option value="EXAM">Exam</Select.Option>
              <Select.Option value="HOLIDAY">Holiday</Select.Option>
              <Select.Option value="DEADLINE">Deadline</Select.Option>
              <Select.Option value="CLASS">Class</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="start_at"
            label="Start Date & Time"
            rules={[{ required: true, message: 'Please select start date and time' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="end_at"
            label="End Date & Time"
            rules={[{ required: true, message: 'Please select end date and time' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="department"
            label="Department"
          >
            <Select
              placeholder="Select department (optional)"
              allowClear
              loading={!departments}
            >
              {departments?.results?.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="course"
            label="Course"
          >
            <Select
              placeholder="Select course (optional)"
              allowClear
              loading={!courses}
            >
              {courses?.results?.map((course) => (
                <Select.Option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CalendarPage;
