import React from 'react';
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Space, Spin, Tooltip, Typography, message } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined } from '@ant-design/icons';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { useApproveSchedule, useAssessment, useScheduleAssessment } from '../../../api/assessments';
import { useAuth } from '../../../contexts/AuthContext';
import { AssessmentStatus, UserRole } from '../../../types/index';

const { Title, Text } = Typography;

const LabeledTip: React.FC<{ label: string; tip: string }> = ({ label, tip }) => (
  <Space size={6}>
    <span>{label}</span>
    <Tooltip title={tip}>
      <InfoCircleOutlined style={{ color: 'var(--muted-ink)' }} />
    </Tooltip>
  </Space>
);

type ScheduleFormValues = {
  scheduled_at: Dayjs;
  duration_minutes: number;
  grace_minutes?: number;
  late_entry_minutes?: number;
  instructions_open_minutes?: number;
};

const AssessmentSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const assessmentId = id || undefined;
  const { user } = useAuth();

  const [form] = Form.useForm<ScheduleFormValues>();
  // Hooks must be called unconditionally (before any early returns).
  const startAt = Form.useWatch('scheduled_at', form);
  const duration = Form.useWatch('duration_minutes', form);
  const grace = Form.useWatch('grace_minutes', form);

  const { data: assessment, isLoading, error } = useAssessment(assessmentId!);
  const scheduleMutation = useScheduleAssessment();
  const approveMutation = useApproveSchedule();
  const [editing, setEditing] = React.useState(true);

  React.useEffect(() => {
    if (!assessment) return;
    form.setFieldsValue({
      scheduled_at: assessment.scheduled_at ? dayjs(assessment.scheduled_at) : undefined,
      duration_minutes: assessment.duration_minutes || 60,
      grace_minutes: assessment.grace_minutes ?? 0,
      late_entry_minutes: assessment.late_entry_minutes ?? 0,
      instructions_open_minutes: assessment.instructions_open_minutes ?? 0,
    } as any);

    // Approved schedules are locked by default; propose change enables editing.
    setEditing(assessment.schedule_state !== 'APPROVED');
  }, [assessment, form]);

  const canSchedule = user?.role === UserRole.ADMIN || user?.role === UserRole.HOD || user?.role === UserRole.TEACHER;

  const extractScheduleError = (data: any): string | null => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) return String(data.non_field_errors[0]);

    // Field-level errors: { scheduled_at: ["..."], duration_minutes: ["..."] }
    const keys = Object.keys(data || {});
    for (const k of keys) {
      const v = (data as any)[k];
      if (Array.isArray(v) && v[0]) return String(v[0]);
    }
    return null;
  };

  const handleSubmit = async (values: ScheduleFormValues) => {
    if (!assessmentId) return;

    // Extra guard (and user-friendly popup) before hitting the API.
    const minFuture = dayjs().add(2, 'minute');
    if (dayjs(values.scheduled_at).isBefore(minFuture)) {
      message.error('Exam start time must be in the future.');
      return;
    }

    try {
      await scheduleMutation.mutateAsync({
        id: assessmentId,
        scheduledAt: values.scheduled_at.toISOString(),
        durationMinutes: values.duration_minutes,
        graceMinutes: values.grace_minutes,
        lateEntryMinutes: values.late_entry_minutes,
        instructionsOpenMinutes: values.instructions_open_minutes,
      });
      message.success('Schedule proposed successfully (pending admin approval)');
      navigate(`/dashboard/assessments/${assessmentId}`);
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = extractScheduleError(data);
      message.error(msg || 'Failed to schedule exam');
      // Conflicts are useful during scheduling; keep them in console for debugging.
      if (data?.conflicts) {
        // eslint-disable-next-line no-console
        console.warn('Scheduling conflicts:', data.conflicts);
      }
    }
  };

  const handleApprove = async (approved: boolean, reason?: string) => {
    if (!assessmentId) return;
    try {
      await approveMutation.mutateAsync({ id: assessmentId, approved, reason });
      message.success(approved ? 'Schedule approved' : 'Schedule rejected');
      navigate(`/dashboard/assessments/${assessmentId}`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Failed to approve schedule');
    }
  };

  const promptRejectReason = () => {
    let reason = '';
    const modal = Modal.confirm({
      title: 'Reject Schedule Proposal',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'var(--muted-ink)' }}>
            Please provide a reason. This will be sent to the course teacher.
          </div>
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder="Reason for rejection (required)"
            onChange={(e) => {
              reason = e.target.value;
              modal.update({ okButtonProps: { disabled: reason.trim().length < 5 } });
            }}
          />
        </div>
      ),
      okText: 'Reject',
      okType: 'danger',
      cancelText: 'Cancel',
      okButtonProps: { disabled: true },
      centered: true,
      onOk: async () => {
        await handleApprove(false, reason.trim());
      },
    });
  };

  if (!canSchedule) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>
          Schedule Exam
        </Title>
        <Alert
          type="error"
          showIcon
          message="Not allowed"
          description="You do not have permission to schedule this exam."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>
          Schedule Exam
        </Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load assessment"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>
          Schedule Exam
        </Title>
        <Alert
          type="warning"
          showIcon
          message="Assessment not found"
          description="The assessment you're looking for doesn't exist or you don't have permission to view it."
        />
      </div>
    );
  }

  const schedulingLocked =
    assessment.status === AssessmentStatus.IN_PROGRESS || assessment.status === AssessmentStatus.COMPLETED;
  const eligibleForScheduling =
    assessment.status === AssessmentStatus.APPROVED || assessment.status === AssessmentStatus.SCHEDULED;
  const canPropose =
    eligibleForScheduling &&
    !schedulingLocked &&
    (user?.role === UserRole.HOD || user?.role === UserRole.TEACHER);
  const canApproveSchedule = user?.role === UserRole.ADMIN && assessment.schedule_state === 'PROPOSED';
  const canRejectSchedule =
    (user?.role === UserRole.ADMIN || user?.role === UserRole.HOD) && assessment.schedule_state === 'PROPOSED';
  const computedEnd =
    startAt && duration ? dayjs(startAt).add(Number(duration || 0), 'minute') : null;
  const computedClose =
    computedEnd && grace !== undefined ? dayjs(computedEnd).add(Number(grace || 0), 'minute') : computedEnd;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/dashboard/assessments/${assessment.id}`)}>
            Back
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Schedule Exam
          </Title>
        </Space>
      </div>

      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text strong>{assessment.title}</Text>
            <div style={{ color: 'var(--muted-ink)' }}>{assessment.course_code || ''}</div>
          </div>

          {assessment.schedule_state === 'APPROVED' && (
            <Alert
              type="info"
              showIcon
              message="Schedule is approved and locked"
              description="To change it, propose a new schedule. Changes require admin re-approval."
            />
          )}
          {assessment.schedule_state === 'PROPOSED' && (
            <Alert
              type="warning"
              showIcon
              message="Schedule proposed"
              description="Admin approval is required before students can access the exam window."
            />
          )}
          {schedulingLocked && (
            <Alert
              type="error"
              showIcon
              message="Scheduling is locked"
              description="This exam is already in progress or completed."
            />
          )}
          {!eligibleForScheduling && (
            <Alert
              type="warning"
              showIcon
              message="Scheduling not available yet"
              description="This assessment must be approved first before you can propose a schedule."
            />
          )}

          <Alert
            type="success"
            showIcon
            message="Centralized exam scheduling"
            description="Use the date picker and duration - no free-text times. The system calculates end/close times and validates access using server time."
          />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="scheduled_at"
              label={
                <LabeledTip
                  label="Start time"
                  tip="The exam becomes available at this time (validated by the server, not your browser clock)."
                />
              }
              rules={[
                { required: true, message: 'Please select schedule time' },
                {
                  validator: async (_, value) => {
                    if (!value) return;
                    // Prevent "just now" selections that fail server-side due to seconds drift.
                    const minFuture = dayjs().add(2, 'minute');
                    if (dayjs(value).isBefore(minFuture)) {
                      throw new Error('Exam start time must be in the future.');
                    }
                  },
                },
              ]}
            >
              <DatePicker
                showTime={{ format: 'HH:mm', minuteStep: 5, showSecond: false }}
                style={{ width: '100%' }}
                disabled={schedulingLocked || !editing}
                placeholder="Select date & time"
                disabledDate={(current) => !!current && current < dayjs().startOf('day')}
                disabledTime={(current) => {
                  if (!current) return {};
                  const now = dayjs();

                  if (!current.isSame(now, 'day')) {
                    return {};
                  }

                  const disabledHours = () =>
                    Array.from({ length: 24 }, (_, i) => i).filter((h) => h < now.hour());

                  const disabledMinutes = (selectedHour: number) => {
                    if (selectedHour > now.hour()) return [];
                    // Force at least the next minute to avoid "future" failing due to seconds.
                    return Array.from({ length: 60 }, (_, i) => i).filter((m) => m <= now.minute());
                  };

                  return {
                    disabledHours,
                    disabledMinutes,
                  };
                }}
              />
            </Form.Item>

            <Form.Item
              name="duration_minutes"
              label={
                <LabeledTip
                  label="Duration (minutes)"
                  tip="Working time for the exam. End time is computed automatically from start time + duration."
                />
              }
              rules={[{ required: true, message: 'Please enter duration' }]}
            >
              <InputNumber min={5} max={24 * 60} style={{ width: '100%' }} disabled={schedulingLocked || !editing} />
            </Form.Item>

            <Form.Item
              name="grace_minutes"
              label={
                <LabeledTip
                  label="Grace (minutes)"
                  tip="Extra time after the exam ends for submission only. Students cannot continue answering during grace."
                />
              }
            >
              <InputNumber min={0} max={24 * 60} style={{ width: '100%' }} disabled={schedulingLocked || !editing} />
            </Form.Item>

            <Form.Item
              name="late_entry_minutes"
              label={
                <LabeledTip
                  label="Late entry (minutes)"
                  tip="How long after start a student can still begin the exam. Starting late reduces remaining time."
                />
              }
            >
              <InputNumber min={0} max={24 * 60} style={{ width: '100%' }} disabled={schedulingLocked || !editing} />
            </Form.Item>

            <Form.Item
              name="instructions_open_minutes"
              label={
                <LabeledTip
                  label="Early instructions access (minutes)"
                  tip="Allows students to read instructions before the exam starts (answers are still locked)."
                />
              }
            >
              <InputNumber min={0} max={24 * 60} style={{ width: '100%' }} disabled={schedulingLocked || !editing} />
            </Form.Item>

            {computedEnd && (
              <Alert
                type="success"
                showIcon
                message="Computed Exam Window"
                description={
                  <div>
                    <div>Ends at: {computedEnd.format('MMM D, YYYY h:mm A')}</div>
                    <div>Closes at (with grace): {computedClose?.format('MMM D, YYYY h:mm A')}</div>
                  </div>
                }
              />
            )}

            <Form.Item>
              <Space>
                {(user?.role === UserRole.ADMIN || canPropose) && assessment.schedule_state === 'APPROVED' && !editing && (
                  <Button type="primary" icon={<CalendarOutlined />} disabled={schedulingLocked} onClick={() => setEditing(true)}>
                    Propose Change
                  </Button>
                )}
                {(user?.role === UserRole.ADMIN || canPropose) && !(assessment.schedule_state === 'APPROVED' && !editing) && (
                  <Button
                    type="primary"
                    icon={<CalendarOutlined />}
                    htmlType="submit"
                    loading={scheduleMutation.isPending}
                    disabled={schedulingLocked || !eligibleForScheduling || !editing}
                  >
                    {assessment.schedule_state === 'APPROVED' ? 'Submit Change Proposal' : 'Propose Schedule'}
                  </Button>
                )}
                {canApproveSchedule && (
                  <>
                    <Button
                      type="primary"
                      onClick={() => handleApprove(true)}
                      loading={approveMutation.isPending}
                      disabled={schedulingLocked}
                    >
                      Approve
                    </Button>
                  </>
                )}
                {canRejectSchedule && (
                  <Button
                    danger
                    onClick={promptRejectReason}
                    loading={approveMutation.isPending}
                    disabled={schedulingLocked}
                  >
                    Reject
                  </Button>
                )}
                <Button onClick={() => navigate(`/dashboard/assessments/${assessment.id}`)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default AssessmentSchedulePage;
