import React, { useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Typography,
  Button,
  Space,
  Spin,
  Alert,
  Form,
  Input,
  message,
  Table,
  Modal,
  Image,
  Statistic,
  Row,
  Col,
  Tooltip,
  Tabs,
  List,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined, ArrowLeftOutlined, CalendarOutlined, UnorderedListOutlined, WarningOutlined } from '@ant-design/icons';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useAssessment, useSubmitAssessmentWork, useAssessmentSubmissions } from '../../../api/assessments';
import { useSessionViolations, useSessionRecording } from '../../../api/proctoring';
import { useAuth } from '../../../contexts/AuthContext';
import SessionVideoPlayer from '../../../components/SessionVideoPlayer';
import {
  AssessmentStatus,
  AssessmentType,
  AssessmentSubmissionFormat,
  UserRole,
} from '../../../types/index';
import type { Assessment as AssessmentModel } from '../../../types/index';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const AssessmentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const assessmentId = id || undefined;
  const { user } = useAuth();
  const [showSubmissions, setShowSubmissions] = useState(false);

  const { data: assessment, isLoading, error } = useAssessment(assessmentId!);

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Assessment Details</Title>
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
        <Title level={2} style={{ marginBottom: 16 }}>Assessment Details</Title>
        <Alert
          type="warning"
          showIcon
          message="Assessment not found"
          description="The assessment you're looking for doesn't exist or you don't have permission to view it."
        />
      </div>
    );
  }

  const hasInstructions = Boolean(assessment.instructions);
  const hasContent = Boolean(assessment.content && assessment.content.length > 0);
  const hasQuestions = Boolean(assessment.questions && assessment.questions.length > 0);
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.ADMIN || user?.role === UserRole.HOD;
  const isStudent = user?.role === UserRole.STUDENT;
  const isStudentOnlineAssessment =
    isStudent && assessment.submission_format === AssessmentSubmissionFormat.ONLINE;

  const statusColors: Record<AssessmentStatus, string> = {
    [AssessmentStatus.DRAFT]: 'default',
    [AssessmentStatus.SUBMITTED]: 'orange',
    [AssessmentStatus.APPROVED]: 'blue',
    [AssessmentStatus.SCHEDULED]: 'purple',
    [AssessmentStatus.IN_PROGRESS]: 'cyan',
    [AssessmentStatus.COMPLETED]: 'green',
    [AssessmentStatus.CANCELLED]: 'red',
  };

  const statusLabels: Record<AssessmentStatus, string> = {
    [AssessmentStatus.DRAFT]: 'Draft',
    [AssessmentStatus.SUBMITTED]: 'Submitted',
    [AssessmentStatus.APPROVED]: 'Approved',
    [AssessmentStatus.SCHEDULED]: 'Scheduled',
    [AssessmentStatus.IN_PROGRESS]: 'In Progress',
    [AssessmentStatus.COMPLETED]: 'Completed',
    [AssessmentStatus.CANCELLED]: 'Cancelled',
  };

  const typeLabels: Record<AssessmentType, string> = {
    [AssessmentType.EXAM]: 'Exam',
    [AssessmentType.QUIZ]: 'Quiz',
    [AssessmentType.ASSIGNMENT]: 'Assignment',
    [AssessmentType.PROJECT]: 'Project',
  };

  const startAt = assessment.scheduled_at ? dayjs(assessment.scheduled_at) : null;
  const endAt = assessment.ends_at
    ? dayjs(assessment.ends_at)
    : startAt
      ? startAt.add(Number(assessment.duration_minutes || 0), 'minute')
      : null;
  const closesAt = assessment.closes_at ? dayjs(assessment.closes_at) : null;
  const lateEntryCutoff =
    startAt && (assessment as any).late_entry_minutes
      ? startAt.add(Number((assessment as any).late_entry_minutes || 0), 'minute')
      : null;
  const instructionsOpenAt =
    startAt && (assessment as any).instructions_open_minutes
      ? startAt.subtract(Number((assessment as any).instructions_open_minutes || 0), 'minute')
      : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard/assessments')}
          >
            Back to Assessments
          </Button>
          <Title level={2} style={{ margin: 0 }}>Assessment Details</Title>
        </Space>
        <Space>
          {isTeacher && (
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => setShowSubmissions(!showSubmissions)}
              type={showSubmissions ? 'default' : 'primary'}
            >
              {showSubmissions ? 'Hide Submissions' : 'View Submissions'}
            </Button>
          )}
          {(user?.role === UserRole.ADMIN || user?.role === UserRole.HOD || user?.role === UserRole.TEACHER) &&
            (assessment.status === AssessmentStatus.APPROVED ||
              assessment.status === AssessmentStatus.SCHEDULED) && (
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => navigate(`/dashboard/assessments/${assessment.id}/schedule`)}
            >
              Schedule
            </Button>
          )}
          {isTeacher && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/dashboard/assessments/${assessment.id}/edit`)}
            >
              Edit Assessment
            </Button>
          )}
        </Space>
      </div>

      {showSubmissions && isTeacher && (
        <SubmissionsPanel assessmentId={assessment.id} assessment={assessment} />
      )}

      <Card>
        <Descriptions
          title="Basic Information"
          bordered
          column={2}
          size="small"
        >
          <Descriptions.Item label="Title">
            <Text strong>{assessment.title}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Course">
            {assessment.course_code || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag>{typeLabels[assessment.assessment_type]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusColors[assessment.status]}>
              {statusLabels[assessment.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Duration">
            {assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Total Marks">
            {assessment.total_marks || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>
            {assessment.description || 'No description provided'}
          </Descriptions.Item>
          {assessment.scheduled_at && (
            <Descriptions.Item label="Scheduled At">
              {new Date(assessment.scheduled_at).toLocaleString()}
            </Descriptions.Item>
          )}
          {assessment.closes_at && (
            <Descriptions.Item label="Closes At">
              {new Date(assessment.closes_at).toLocaleString()}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Created By">
            {assessment.created_by_email || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(assessment.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {new Date(assessment.updated_at).toLocaleString()}
          </Descriptions.Item>
          {assessment.approved_at && (
            <>
              <Descriptions.Item label="Approved By">
                {assessment.approved_by_email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Approved At">
                {new Date(assessment.approved_at).toLocaleString()}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {(startAt || endAt || closesAt) && (
        <Card title="Exam Timing & Access" style={{ marginTop: 16 }}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item
              label={
                <Space size={6}>
                  <span>Timezone & Validation</span>
                  <Tooltip title="Exam access is validated using server time (not the student's browser clock).">
                    <InfoCircleOutlined style={{ color: 'var(--muted-ink)' }} />
                  </Tooltip>
                </Space>
              }
              span={2}
            >
              Times are saved with timezone awareness and enforced by the server.
            </Descriptions.Item>
            <Descriptions.Item label="Starts">
              {startAt ? startAt.format('MMM D, YYYY h:mm A') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Ends (computed)">
              {endAt ? endAt.format('MMM D, YYYY h:mm A') : '-'}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <Space size={6}>
                  <span>Closes (with grace)</span>
                  <Tooltip title="Grace allows late submission only. Students cannot continue answering during grace.">
                    <InfoCircleOutlined style={{ color: 'var(--muted-ink)' }} />
                  </Tooltip>
                </Space>
              }
            >
              {closesAt ? closesAt.format('MMM D, YYYY h:mm A') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">
              {assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : '-'}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <Space size={6}>
                  <span>Late Entry Cutoff</span>
                  <Tooltip title="After this time, students cannot start the exam session. Starting late reduces remaining time.">
                    <InfoCircleOutlined style={{ color: 'var(--muted-ink)' }} />
                  </Tooltip>
                </Space>
              }
            >
              {lateEntryCutoff ? lateEntryCutoff.format('MMM D, YYYY h:mm A') : '-'}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <Space size={6}>
                  <span>Instructions Open</span>
                  <Tooltip title="Students may read instructions before the exam starts (answers remain locked).">
                    <InfoCircleOutlined style={{ color: 'var(--muted-ink)' }} />
                  </Tooltip>
                </Space>
              }
            >
              {instructionsOpenAt ? instructionsOpenAt.format('MMM D, YYYY h:mm A') : '-'}
            </Descriptions.Item>
            {(assessment as any).schedule_state && (
              <Descriptions.Item label="Schedule State" span={2}>
                {(() => {
                  const s = String((assessment as any).schedule_state || '');
                  if (s === 'PROPOSED') return 'Proposed (Pending Approval)';
                  if (s === 'APPROVED') return 'Approved';
                  if (s === 'DRAFT') return 'Draft';
                  return s;
                })()}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {user?.role === UserRole.STUDENT && assessment.submission_format === AssessmentSubmissionFormat.ONLINE && (
        <Card title="Exam Monitoring & Privacy" style={{ marginTop: 16 }}>
          <Paragraph style={{ marginBottom: 8 }}>
            To protect fairness, the system may log exam security events (for example: tab switching, leaving fullscreen, or repeated violations).
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            If webcam proctoring is enabled for this exam, the webcam may run during the session and limited snapshots may be captured only when suspicious behavior crosses a threshold. Evidence is visible only to authorized staff (teacher/HOD/admin) and stored securely.
          </Paragraph>
        </Card>
      )}

      {hasInstructions && (
        <Card title="Instructions" style={{ marginTop: 16 }}>
          <Paragraph>{assessment.instructions}</Paragraph>
        </Card>
      )}

      {hasContent && (
        <Card title="Content" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {(assessment.content || []).map((block, index) => (
              <Card
                key={`${block.title}-${index}`}
                type="inner"
                title={block.title || `Content ${index + 1}`}
              >
                <Tag style={{ marginBottom: 8 }}>{block.content_type}</Tag>
                <Paragraph style={{ marginBottom: 0 }}>{block.body}</Paragraph>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {hasQuestions && (!isStudentOnlineAssessment || isTeacher) && (
        <Card title="Questions" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {(assessment.questions || []).map((question, index) => (
              <Card key={index} type="inner" title={`Question ${index + 1}`}>
                <Paragraph strong>{question.prompt}</Paragraph>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {(question.options || []).map((option, optIndex) => (
                    <Tag
                      key={optIndex}
                      color={isTeacher && option.is_correct ? 'green' : undefined}
                      style={{ width: '100%' }}
                    >
                      {option.text}
                      {isTeacher && option.is_correct ? ' (Correct)' : ''}
                    </Tag>
                  ))}
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {isTeacher && (
        <Card title="Assessment Statistics" style={{ marginTop: 16 }}>
          <Descriptions column={3}>
            <Descriptions.Item label="Total Submissions">
              <Text strong>{assessment.total_submissions || 0}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Average Score">
              <Text strong>{assessment.average_score !== undefined && assessment.average_score !== null ? assessment.average_score : '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Submission Rate">
              <Text strong>{assessment.submission_rate !== undefined ? `${assessment.submission_rate}%` : '-'}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <StudentSubmissionPanel assessment={assessment} />
    </div>
  );
};

export default AssessmentDetailPage;

const SubmissionsPanel: React.FC<{ assessmentId: string; assessment?: AssessmentModel }> = ({ assessmentId, assessment }) => {
  const { data: submissionsResponse, isLoading } = useAssessmentSubmissions({ assessment: assessmentId });
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  // Helper to ensure image URL is absolute
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Prepend backend URL for relative paths
    const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  if (isLoading) {
    return <Card title="Submissions" style={{ marginBottom: 16 }}><Spin /></Card>;
  }

  const submissions = submissionsResponse?.results || [];

  const columns = [
    {
      title: 'Student',
      dataIndex: 'student_email',
      key: 'student',
    },
    {
      title: 'Submitted At',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score: number | null) => score !== null ? score : 'Not graded',
    },
    {
      title: 'Violations',
      dataIndex: 'total_violations',
      key: 'violations',
      render: (count: number) => (
        <Tag color={count > 0 ? 'red' : 'green'} icon={count > 0 ? <WarningOutlined /> : null}>
          {count} violations
        </Tag>
      ),
    },
    {
      title: 'Cheating',
      dataIndex: 'cheating_count',
      key: 'cheating_count',
      render: (count: number) => (
        <Tag color={count > 0 ? 'orange' : 'default'}>
          {count || 0}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => setSelectedSubmission(record)}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card title="Student Submissions" style={{ marginBottom: 16 }}>
        <Table
          columns={columns}
          dataSource={submissions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`Submission Details - ${selectedSubmission?.student_email}`}
        open={!!selectedSubmission}
        onCancel={() => setSelectedSubmission(null)}
        footer={null}
        width={900}
      >
        {selectedSubmission && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="Total Violations" value={selectedSubmission.total_violations} />
              </Col>
              <Col span={8}>
                <Statistic title="Score" value={selectedSubmission.score || 'N/A'} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Submitted"
                  value={new Date(selectedSubmission.submitted_at).toLocaleDateString()}
                />
              </Col>
            </Row>

            {/* Answers Section */}
            {assessment && assessment.questions && (
              <Card title="Answers" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {assessment.questions.map((question, index) => {
                    const answer = selectedSubmission.answers?.[index];
                    let answerDisplay = <Text type="secondary">No answer</Text>;

                    if (question.type === 'MCQ') {
                      if (answer !== undefined && answer !== null && answer !== -1) {
                        const option = question.options?.[answer];
                        const isCorrect = option?.is_correct;
                        answerDisplay = (
                          <Space>
                            <Text strong>Selected:</Text>
                            <Tag color={isCorrect ? 'green' : 'red'}>
                              {option?.text || `Option ${answer + 1}`}
                            </Tag>
                          </Space>
                        );
                      }
                    } else {
                      // Subjective or other types
                      if (answer) {
                        answerDisplay = (
                          <div>
                            <Text strong>Response:</Text>
                            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{answer}</Paragraph>
                          </div>
                        );
                      }
                    }

                    return (
                      <Card key={index} type="inner" size="small" title={`Q${index + 1}: ${question.prompt}`}>
                        {answerDisplay}
                        {question.type === 'MCQ' && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">Correct Answer: </Text>
                            {question.options?.filter(o => o.is_correct).map((o, i) => (
                              <Tag key={i} color="blue">{o.text}</Tag>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </Space>
              </Card>
            )}

            {selectedSubmission.violations_by_type && Object.keys(selectedSubmission.violations_by_type).length > 0 && (
              <Card title="Violation Breakdown" size="small">
                <Space wrap>
                  {Object.entries(selectedSubmission.violations_by_type).map(([type, count]: [string, any]) => (
                    <Tag key={type} color="red">
                      {type.replace(/_/g, ' ')}: {count}
                    </Tag>
                  ))}
                </Space>
              </Card>
            )}

            {selectedSubmission.cheating_logs && selectedSubmission.cheating_logs.length > 0 && (
              <Card title={`Cheating Incidents (${selectedSubmission.cheating_count || selectedSubmission.cheating_logs.length})`} size="small">
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {selectedSubmission.cheating_logs.map((log: any) => (
                      <Tag key={log.id} color="orange" style={{ width: 'fit-content' }}>
                        {log.incident_type.replace(/_/g, ' ')} • {new Date(log.occurred_at).toLocaleString()}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </Card>
            )}

            {selectedSubmission.proctoring_snapshots && selectedSubmission.proctoring_snapshots.length > 0 && (
              <Card title={`Proctoring Snapshots (${selectedSubmission.proctoring_snapshots.length})`} size="small">
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <Image.PreviewGroup>
                    {selectedSubmission.proctoring_snapshots.map((snap: any) => (
                      <Card
                        key={snap.id}
                        type="inner"
                        size="small"
                        title={new Date(snap.captured_at).toLocaleTimeString()}
                        extra={
                          <Space>
                            {snap.is_violation && <Tag color="red">Violation</Tag>}
                            <Tag>{snap.faces_detected} faces</Tag>
                          </Space>
                        }
                        style={{ marginBottom: 8 }}
                      >
                        <Image
                          src={getImageUrl(snap.image_url)}
                          alt="Proctoring snapshot"
                          width={200}
                          style={{ cursor: 'pointer' }}
                        />
                      </Card>
                    ))}
                  </Image.PreviewGroup>
                </div>
              </Card>
            )}

            {selectedSubmission.session_id && (
              <ProctoringReviewTab sessionId={selectedSubmission.session_id} />
            )}

            {/* Session Recording */}
            {selectedSubmission.session_id && (
              <SessionVideoPlayer
                sessionId={selectedSubmission.session_id}
                title="Session Recording"
              />
            )}
          </Space>
        )}
      </Modal>
    </>
  );
};

const ProctoringReviewTab: React.FC<{ sessionId?: string | null }> = ({ sessionId }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const { data: recording } = useSessionRecording(sessionId || undefined);
  const { data: violations } = useSessionViolations(sessionId || '', true);

  const jumpTo = (seconds?: number) => {
    if (!videoRef.current || typeof seconds !== 'number') return;
    videoRef.current.currentTime = seconds;
    videoRef.current.play().catch(() => undefined);
  };

  if (!sessionId) {
    return (
      <Card title="Proctoring Review" size="small">
        <Alert type="info" message="No session linked to this submission." />
      </Card>
    );
  }

  return (
    <Card title="Proctoring Review" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        {recording?.video_url ? (
          <div>
            <Text strong>Full Recording</Text>
            <video
              ref={videoRef}
              src={recording.video_url}
              controls
              style={{ width: '100%', marginTop: 8, borderRadius: 8 }}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              Duration: {recording.duration_seconds ? `${recording.duration_seconds}s` : 'Unknown'}
            </Text>
          </div>
        ) : (
          <Alert type="warning" message="Recording not available" />
        )}

        <Card type="inner" title="AI Flags & Violations" size="small">
          {violations && violations.length > 0 ? (
            <List
              dataSource={violations}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="jump"
                      type="link"
                      onClick={() => jumpTo((item.details as any)?.timestamp_seconds)}
                      disabled={!recording?.video_url}
                    >
                      Jump
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={`${item.violation_type.replace(/_/g, ' ')} • Sev ${item.severity}`}
                    description={
                      <>
                        <div>{new Date(item.occurred_at).toLocaleString()}</div>
                        {item.details && (
                          <Text type="secondary">
                            {JSON.stringify(item.details)}
                          </Text>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary">No violations logged for this session.</Text>
          )}
        </Card>
      </Space>
    </Card>
  );
};

const StudentSubmissionPanel: React.FC<{ assessment: AssessmentModel }> = ({ assessment }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.role !== UserRole.STUDENT) {
    return null;
  }

  const isOnlineAssessment = assessment.submission_format === AssessmentSubmissionFormat.ONLINE;
  const requiresText =
    assessment.submission_format === AssessmentSubmissionFormat.TEXT ||
    assessment.submission_format === AssessmentSubmissionFormat.TEXT_AND_FILE;
  const requiresFile =
    assessment.submission_format === AssessmentSubmissionFormat.FILE ||
    assessment.submission_format === AssessmentSubmissionFormat.TEXT_AND_FILE;
  const allowedStatuses = [
    AssessmentStatus.APPROVED,
    AssessmentStatus.SCHEDULED,
    AssessmentStatus.IN_PROGRESS,
  ];
  const submissionWindowOpen = allowedStatuses.includes(assessment.status);

  const [form] = Form.useForm();
  const [file, setFile] = React.useState<File | null>(null);

  const submitMutation = useSubmitAssessmentWork();
  const studentStatus = (assessment as any).student_submission_status as
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'TERMINATED'
    | 'GRADED'
    | undefined;

  const handleAssignmentSubmit = async (values: { text_response?: string }) => {
    const trimmedResponse = values.text_response?.trim() ?? '';
    if (requiresText && !trimmedResponse) {
      message.error('Please provide your response.');
      return;
    }
    if (requiresFile && !file) {
      message.error('Please attach a file before submitting.');
      return;
    }

    try {
      await submitMutation.mutateAsync({
        assessmentId: assessment.id,
        textResponse: trimmedResponse || undefined,
        file: file ?? undefined,
      });
      message.success('Submission uploaded successfully.');
      form.resetFields();
      setFile(null);
    } catch (error: any) {
      const data = error.response?.data;
      const detail =
        data?.detail ??
        data?.text_response?.[0] ??
        data?.file_response?.[0] ??
        'Failed to submit assessment.';
      message.error(detail);
    }
  };

  const renderAssignmentForm = () => (
    <>
      {!submissionWindowOpen && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Submissions are not open"
          description="You can only submit work when the assessment is approved or scheduled."
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleAssignmentSubmit}
        disabled={!submissionWindowOpen || submitMutation.isPending}
      >
        {requiresText && (
          <Form.Item
            name="text_response"
            label="Response"
            rules={[{ required: true, message: 'Please enter your response.' }]}
          >
            <TextArea rows={4} placeholder="Share your analysis, answers, or summary..." />
          </Form.Item>
        )}
        {requiresFile && (
          <Form.Item label="Upload Attachment" required={requiresFile}>
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            {file && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {file.name}
              </Text>
            )}
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={submitMutation.isPending}>
          Submit Work
        </Button>
      </Form>
    </>
  );

  if (isOnlineAssessment) {
    const canStartOrContinue =
      studentStatus !== 'SUBMITTED' && studentStatus !== 'GRADED' && studentStatus !== 'TERMINATED';

    let primaryLabel = 'Start Exam';
    if (studentStatus === 'IN_PROGRESS') {
      primaryLabel = 'Continue Exam';
    }

    return (
      <Card title="Exam Access" style={{ marginTop: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Exam is locked until you start"
            description="You can view exam timing and instructions here. Questions and the timer will only appear after you click Start Exam."
          />
          {studentStatus === 'TERMINATED' && (
            <Alert
              type="error"
              showIcon
              message="Session terminated"
              description="This exam session was terminated due to violations. Retakes are not allowed."
            />
          )}
          {(studentStatus === 'SUBMITTED' || studentStatus === 'GRADED') && (
            <Alert
              type="success"
              showIcon
              message="Exam submitted"
              description="Your submission has been recorded. Results will appear once they are published."
            />
          )}
          <Button
            type="primary"
            size="large"
            onClick={() => navigate(`/dashboard/assessments/${assessment.id}/take`)}
            disabled={!canStartOrContinue}
          >
            {primaryLabel}
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card title="Student Actions" style={{ marginTop: 16 }}>
      {renderAssignmentForm()}
    </Card>
  );
};
