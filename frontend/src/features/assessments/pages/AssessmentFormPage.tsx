import React from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  message,
  Typography,
  Card,
  Space,
  Spin,
  Divider,
  Row,
  Col,
  Steps,
  theme,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { MinusCircleOutlined, PlusOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAssessment, useCreateAssessment, useUpdateAssessment } from '../../../api/assessments';
import { useCourses } from '../../../api/courses';
import type { CreateAssessmentPayload, AssessmentStatus } from '../../../types/index';
import { AssessmentSubmissionFormat, AssessmentType } from '../../../types/index';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const AssessmentFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const assessmentId = id || undefined;
  const { token } = theme.useToken();

  const [form] = Form.useForm();
  const assessmentType = Form.useWatch('assessment_type', form);
  const submissionFormat = Form.useWatch('submission_format', form);
  const questionsValue = Form.useWatch('questions', form);

  const { data: assessment, isLoading: assessmentLoading } = useAssessment(assessmentId!);
  const { data: courses } = useCourses({ status: 'ACTIVE' });

  const createMutation = useCreateAssessment();
  const updateMutation = useUpdateAssessment();

  React.useEffect(() => {
    if (assessment && isEdit) {
      form.setFieldsValue({
        ...assessment,
        course: assessment.course,
        content: assessment.content?.length ? assessment.content : undefined,
        questions: assessment.questions?.length
          ? assessment.questions.map((question) => ({
            prompt: question.prompt,
            type: question.type || 'MCQ',
            marks: question.marks || 1,
            options: question.options?.map((option) => ({ text: option.text })),
            correct_option: question.options?.findIndex((option) => option.is_correct),
          }))
          : undefined,
      });
    }
  }, [assessment, isEdit, form]);

  React.useEffect(() => {
    if (assessmentType === AssessmentType.EXAM) {
      form.setFieldsValue({
        submission_format: AssessmentSubmissionFormat.ONLINE,
      });
    } else if (submissionFormat === AssessmentSubmissionFormat.ONLINE) {
      form.setFieldsValue({
        submission_format: AssessmentSubmissionFormat.TEXT,
      });
    }
  }, [assessmentType, submissionFormat, form]);

  const handleSubmit = async (values: any) => {
    try {
      const payload: CreateAssessmentPayload = {
        course: values.course,
        title: values.title,
        assessment_type: values.assessment_type,
        description: values.description,
        instructions: values.instructions,
        content: values.content,
        duration_minutes: values.duration_minutes,
        total_marks: values.total_marks,
        status: values.status as AssessmentStatus,
        submission_format: values.submission_format,
      };
      if (values.assessment_type === AssessmentType.EXAM) {
        payload.questions = (values.questions || []).map((question: any) => {
          const qType = question.type || 'MCQ';
          const baseQuestion = {
            prompt: question.prompt,
            type: qType,
            marks: question.marks,
          };

          if (qType === 'MCQ') {
            const options = (question.options || []).map((option: { text: string }) => option.text || '');
            const correctIndex =
              typeof question.correct_option === 'number' ? question.correct_option : 0;
            return {
              ...baseQuestion,
              options: options.map((text: string, idx: number) => ({
                text,
                is_correct: idx === correctIndex,
              })),
            };
          }

          return baseQuestion;
        });
      } else {
        payload.questions = [];
      }

      if (isEdit && assessmentId) {
        await updateMutation.mutateAsync({ id: assessmentId, payload });
        message.success('Assessment updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        message.success('Assessment created successfully');
      }

      navigate('/dashboard/assessments');
    } catch (error: any) {
      message.error(error.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} assessment`);
    }
  };

  if (assessmentLoading && isEdit) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" tip="Loading assessment details...">
          <div style={{ width: 1, height: 1 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard/assessments')}
            style={{ padding: 0, marginBottom: 8 }}
          >
            Back to Assessments
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {isEdit ? 'Edit Assessment' : 'Create New Assessment'}
          </Title>
          <Text type="secondary">
            {isEdit ? 'Update the details below to modify the assessment.' : 'Fill in the details below to create a new assessment.'}
          </Text>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          assessment_type: AssessmentType.EXAM,
          duration_minutes: 60,
          total_marks: 100,
          status: 'DRAFT',
          submission_format: AssessmentSubmissionFormat.ONLINE,
          content: [
            {
              title: 'Overview',
              body: '',
              content_type: 'INSTRUCTION',
            },
          ],
          questions: [
            {
              prompt: '',
              type: 'MCQ',
              marks: 1,
              correct_option: 0,
              options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
            },
          ],
        }}
      >
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card title="General Information" bordered={false} style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="title"
                    label="Assessment Title"
                    rules={[
                      { required: true, message: 'Please enter assessment title' },
                      { max: 200, message: 'Title must be less than 200 characters' },
                    ]}
                  >
                    <Input size="large" placeholder="e.g., Midterm Exam - Spring 2024" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="course"
                    label="Course"
                    rules={[{ required: true, message: 'Please select a course' }]}
                  >
                    <Select
                      placeholder="Select course"
                      loading={!courses}
                      size="large"
                    >
                      {courses?.results?.map((course) => (
                        <Option key={course.id} value={course.id}>
                          {course.code} - {course.title}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="assessment_type"
                    label="Assessment Type"
                    rules={[{ required: true, message: 'Please select assessment type' }]}
                  >
                    <Select placeholder="Select type" size="large">
                      <Option value="EXAM">Exam</Option>
                      <Option value="QUIZ">Quiz</Option>
                      <Option value="ASSIGNMENT">Assignment</Option>
                      <Option value="PROJECT">Project</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="description"
                label="Description"
                rules={[{ max: 1000, message: 'Description must be less than 1000 characters' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Enter assessment description..."
                  showCount
                  maxLength={1000}
                />
              </Form.Item>

              <Form.Item
                name="instructions"
                label="Instructions"
                rules={[{ max: 2000, message: 'Instructions must be less than 2000 characters' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Provide general instructions for students..."
                  showCount
                  maxLength={2000}
                />
              </Form.Item>
            </Card>

            <Card title="Assessment Content" bordered={false} style={{ marginBottom: 24 }}>
              <Form.List
                name="content"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (!value || !value.length) {
                        return Promise.reject(new Error('Add at least one content block.'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        type="inner"
                        title={`Block ${index + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button
                              type="text"
                              danger
                              onClick={() => remove(field.name)}
                              icon={<MinusCircleOutlined />}
                            >
                              Remove
                            </Button>
                          ) : null
                        }
                        style={{ background: 'var(--surface-muted)' }}
                      >
                        <Form.Item
                          {...field}
                          label="Content Type"
                          name={[field.name, 'content_type']}
                          fieldKey={[field.fieldKey, 'content_type']}
                          rules={[{ required: true, message: 'Select content type' }]}
                        >
                          <Select placeholder="Select content type">
                            <Option value="INSTRUCTION">Instruction</Option>
                            <Option value="QUESTION">Question</Option>
                            <Option value="RESOURCE">Resource</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item
                          {...field}
                          label="Title"
                          name={[field.name, 'title']}
                          fieldKey={[field.fieldKey, 'title']}
                          rules={[{ required: true, message: 'Enter block title' }]}
                        >
                          <Input placeholder="e.g., Question 1" />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          label="Body"
                          name={[field.name, 'body']}
                          fieldKey={[field.fieldKey, 'body']}
                          rules={[{ required: true, message: 'Enter block content' }]}
                        >
                          <TextArea rows={4} placeholder="Provide details, prompts, or resources..." />
                        </Form.Item>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          title: '',
                          body: '',
                          content_type: 'QUESTION',
                        })
                      }
                      icon={<PlusOutlined />}
                      block
                      style={{ height: 48 }}
                    >
                      Add Content Block
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Card>

            {assessmentType === AssessmentType.EXAM && (
              <Card title="Exam Questions" bordered={false} style={{ marginBottom: 24 }}>
                <Form.List
                  name="questions"
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (!value || !value.length) {
                          return Promise.reject(new Error('Add at least one MCQ question.'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  {(fields, { add, remove }) => (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      {fields.map((field, index) => {
                        const questionType = questionsValue?.[field.name]?.type;
                        const optionValues = questionsValue?.[field.name]?.options || [];

                        return (
                          <Card
                            key={field.key}
                            type="inner"
                            title={`Question ${index + 1}`}
                            extra={
                              fields.length > 1 ? (
                                <Button
                                  type="text"
                                  danger
                                  icon={<MinusCircleOutlined />}
                                  onClick={() => remove(field.name)}
                                >
                                  Remove
                                </Button>
                              ) : null
                            }
                            style={{ background: 'var(--surface-muted)' }}
                          >
                            <Row gutter={16}>
                              <Col span={16}>
                                <Form.Item
                                  {...field}
                                  name={[field.name, 'type']}
                                  fieldKey={[field.fieldKey, 'type']}
                                  label="Type"
                                  rules={[{ required: true, message: 'Select type' }]}
                                >
                                  <Select>
                                    <Option value="MCQ">Multiple Choice (MCQ)</Option>
                                    <Option value="SUBJECTIVE">Subjective / Essay</Option>
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item
                                  {...field}
                                  name={[field.name, 'marks']}
                                  fieldKey={[field.fieldKey, 'marks']}
                                  label="Marks"
                                  rules={[{ required: true, message: 'Enter marks' }]}
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            <Form.Item
                              {...field}
                              name={[field.name, 'prompt']}
                              fieldKey={[field.fieldKey, 'prompt']}
                              label="Question Prompt"
                              rules={[{ required: true, message: 'Enter the question prompt' }]}
                            >
                              <Input.TextArea rows={2} placeholder="Enter question prompt..." />
                            </Form.Item>

                            {questionType === 'MCQ' && (
                              <div style={{ background: 'var(--surface-muted)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)' }}>
                                <Form.List
                                  name={[field.name, 'options']}
                                  rules={[
                                    {
                                      validator: async (_, optionList) => {
                                        if (!optionList || optionList.length < 2) {
                                          return Promise.reject(
                                            new Error('Each question needs at least two options.')
                                          );
                                        }
                                        return Promise.resolve();
                                      },
                                    },
                                  ]}
                                >
                                  {(optionFields, { add: addOption, remove: removeOption }) => (
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text strong>Options</Text>
                                      </div>
                                      {optionFields.map((optField, optIndex) => (
                                        <Space
                                          key={optField.key}
                                          style={{ display: 'flex', width: '100%' }}
                                          align="baseline"
                                        >
                                          <Form.Item
                                            {...optField}
                                            name={[optField.name, 'text']}
                                            fieldKey={[optField.fieldKey, 'text']}
                                            style={{ flex: 1, marginBottom: 0 }}
                                            rules={[{ required: true, message: 'Enter option text' }]}
                                          >
                                            <Input prefix={<span style={{ color: '#bfbfbf', marginRight: 4 }}>{String.fromCharCode(65 + optIndex)}.</span>} placeholder={`Option ${optIndex + 1}`} />
                                          </Form.Item>
                                          {optionFields.length > 2 && (
                                            <Button
                                              type="text"
                                              danger
                                              icon={<MinusCircleOutlined />}
                                              onClick={() => removeOption(optField.name)}
                                            />
                                          )}
                                        </Space>
                                      ))}
                                      <Button
                                        type="dashed"
                                        size="small"
                                        onClick={() => addOption({ text: '' })}
                                        icon={<PlusOutlined />}
                                        style={{ marginTop: 8 }}
                                      >
                                        Add Option
                                      </Button>
                                    </Space>
                                  )}
                                </Form.List>
                                <Divider style={{ margin: '16px 0' }} />
                                <Form.Item
                                  label="Correct Answer"
                                  name={[field.name, 'correct_option']}
                                  rules={[{ required: true, message: 'Select the correct option' }]}
                                  style={{ marginBottom: 0 }}
                                >
                                  <Select placeholder="Choose correct option">
                                    {optionValues.map((_: any, optIdx: number) => (
                                      <Option key={`${field.key}-${optIdx}`} value={optIdx}>
                                        Option {String.fromCharCode(65 + optIdx)}
                                      </Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                      <Button
                        type="dashed"
                        onClick={() =>
                          add({
                            prompt: '',
                            type: 'MCQ',
                            marks: 1,
                            correct_option: 0,
                            options: [{ text: '' }, { text: '' }],
                          })
                        }
                        icon={<PlusOutlined />}
                        block
                        style={{ height: 48 }}
                      >
                        Add Question
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Settings" bordered={false} style={{ marginBottom: 24 }}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status">
                  <Option value="DRAFT">Draft</Option>
                  <Option value="SUBMITTED">Submitted</Option>
                  <Option value="APPROVED">Approved</Option>
                  <Option value="SCHEDULED">Scheduled</Option>
                  <Option value="IN_PROGRESS">In Progress</Option>
                  <Option value="COMPLETED">Completed</Option>
                  <Option value="CANCELLED">Cancelled</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="submission_format"
                label="Submission Format"
                rules={[{ required: true, message: 'Please select submission format' }]}
              >
                <Select
                  placeholder="Select submission format"
                  disabled={assessmentType === AssessmentType.EXAM}
                >
                  <Option value={AssessmentSubmissionFormat.ONLINE}>Online exam</Option>
                  <Option value={AssessmentSubmissionFormat.TEXT}>Text response</Option>
                  <Option value={AssessmentSubmissionFormat.FILE}>File upload</Option>
                  <Option value={AssessmentSubmissionFormat.TEXT_AND_FILE}>
                    Text + File
                  </Option>
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="duration_minutes"
                    label="Duration (mins)"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber
                      min={1}
                      max={480}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="total_marks"
                    label="Total Marks"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber
                      min={1}
                      max={1000}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={createMutation.isPending || updateMutation.isPending}
                  block
                  size="large"
                >
                  {isEdit ? 'Update Assessment' : 'Create Assessment'}
                </Button>
                <Button
                  onClick={() => navigate('/dashboard/assessments')}
                  block
                  size="large"
                >
                  Cancel
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default AssessmentFormPage;
