import React from 'react';
import { Card, Spin, Alert, Empty, List, Space, Tag, Typography } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { useSessionRecording, useSessionVideoClips } from '../api/proctoring';
import dayjs from 'dayjs';

interface SessionVideoPlayerProps {
    sessionId: string;
    title?: string;
}

/**
 * Video player component for viewing session recordings.
 * Used by teachers to review proctored exam sessions.
 */
const SessionVideoPlayer: React.FC<SessionVideoPlayerProps> = ({
    sessionId,
    title = 'Session Recording',
}) => {
    const { Text } = Typography;
    const { data: clipsResp, isLoading: clipsLoading } = useSessionVideoClips(sessionId);
    const { data: recording, isLoading: recordingLoading, error } = useSessionRecording(sessionId);

    const clips = clipsResp?.results || [];

    if (clipsLoading || recordingLoading) {
        return (
            <Card title={title} size="small">
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin tip="Loading recordings...">
                        <div style={{ width: 1, height: 1 }} />
                    </Spin>
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card title={title} size="small">
                <Alert
                    type="warning"
                    message="Recording not available"
                    description="The session recording could not be loaded."
                    showIcon
                />
            </Card>
        );
    }

    if (clips.length > 0) {
        return (
            <Card title={title} size="small">
                <List
                    dataSource={clips}
                    renderItem={(clip) => (
                        <List.Item style={{ alignItems: 'flex-start' }}>
                            <div style={{ width: '100%' }}>
                                <Space wrap style={{ marginBottom: 8 }}>
                                    <Tag color={clip.severity >= 4 ? 'red' : clip.severity >= 3 ? 'gold' : 'blue'}>
                                        Sev {clip.severity}
                                    </Tag>
                                    <Tag>{clip.trigger_reason_display || clip.trigger_reason}</Tag>
                                    <Text type="secondary">
                                        {dayjs(clip.created_at).isValid() ? dayjs(clip.created_at).format('MMM D, YYYY h:mm A') : clip.created_at}
                                    </Text>
                                </Space>
                                {clip.video_url ? (
                                    <video
                                        controls
                                        style={{ width: '100%', maxHeight: 420, backgroundColor: '#000', borderRadius: 8 }}
                                        src={clip.video_url}
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                ) : (
                                    <Alert type="warning" showIcon message="Clip file not available" />
                                )}
                                <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                                    Duration: {Math.floor((clip.duration_seconds || 0) / 60)}:
                                    {String((clip.duration_seconds || 0) % 60).padStart(2, '0')}
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            </Card>
        );
    }

    // Fallback: legacy single recording (older sessions / deployments).
    if (!recording || !recording.video_url) {
        return (
            <Card title={title} size="small">
                <Empty
                    image={<VideoCameraOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
                    description="No recording available for this session"
                />
            </Card>
        );
    }

    return (
        <Card title={title} size="small">
            <video
                controls
                style={{ width: '100%', maxHeight: 400, backgroundColor: '#000' }}
                src={recording.video_url}
            >
                Your browser does not support the video tag.
            </video>
            {recording.duration_seconds && (
                <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                    Duration: {Math.floor(recording.duration_seconds / 60)}:{String(recording.duration_seconds % 60).padStart(2, '0')}
                </div>
            )}
        </Card>
    );
};

export default SessionVideoPlayer;
