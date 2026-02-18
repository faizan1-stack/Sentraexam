import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    Modal,
    Button,
    Space,
    Typography,
    Alert,
    Progress,
    Steps,
    message,
} from 'antd';
import {
    CameraOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    UserOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { useRegisterFace, useFaceStatus } from '../api/proctoring';

const { Title, Text, Paragraph } = Typography;

interface FaceRegistrationModalProps {
    open: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
    open,
    onSuccess,
    onCancel,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [step, setStep] = useState<'capture' | 'preview' | 'uploading' | 'success'>('capture');

    const registerFaceMutation = useRegisterFace();
    const { data: faceStatus, refetch: refetchFaceStatus } = useFaceStatus();

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setIsStreaming(true);
                setCameraError(null);
            }
        } catch (error: any) {
            console.error('Camera error:', error);
            setCameraError(
                error.name === 'NotAllowedError'
                    ? 'Camera permission denied. Please allow camera access.'
                    : 'Failed to access camera. Please check your camera settings.'
            );
        }
    }, []);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsStreaming(false);
    }, []);

    // Capture photo
    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !isStreaming) {
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Set canvas size
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw video frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    setCapturedImage(blob);
                    setPreviewUrl(URL.createObjectURL(blob));
                    setStep('preview');
                }
            },
            'image/jpeg',
            0.9
        );
    }, [isStreaming]);

    // Retake photo
    const retakePhoto = useCallback(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setCapturedImage(null);
        setPreviewUrl(null);
        setStep('capture');
    }, [previewUrl]);

    // Submit face registration
    const submitRegistration = useCallback(async () => {
        if (!capturedImage) return;

        setStep('uploading');

        try {
            const result = await registerFaceMutation.mutateAsync(capturedImage);
            message.success('Face registered successfully!');
            setStep('success');

            // Refetch face status
            await refetchFaceStatus();

            // Wait a moment then close
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (error: any) {
            console.error('Registration error:', error);
            const errorMessage = error.response?.data?.error || 'Failed to register face. Please try again.';
            message.error(errorMessage);
            setStep('preview');
        }
    }, [capturedImage, registerFaceMutation, onSuccess, refetchFaceStatus]);

    // Start camera when modal opens
    useEffect(() => {
        if (open && step === 'capture') {
            startCamera();
        }

        return () => {
            stopCamera();
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [open, step, startCamera, stopCamera, previewUrl]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setStep('capture');
            setCapturedImage(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
            stopCamera();
        }
    }, [open, previewUrl, stopCamera]);

    const renderContent = () => {
        if (cameraError) {
            return (
                <Alert
                    type="error"
                    message="Camera Error"
                    description={cameraError}
                    showIcon
                    icon={<CameraOutlined />}
                    style={{ marginBottom: 16 }}
                />
            );
        }

        switch (step) {
            case 'capture':
                return (
                    <div style={{ textAlign: 'center' }}>
                        <Paragraph style={{ marginBottom: 16 }}>
                            Position your face in the center of the frame. Make sure you have good
                            lighting and your face is clearly visible.
                        </Paragraph>

                        <div
                            style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: 480,
                                margin: '0 auto',
                                borderRadius: 12,
                                overflow: 'hidden',
                                background: '#000',
                            }}
                        >
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    display: 'block',
                                    transform: 'scaleX(-1)',
                                }}
                            />

                            {/* Face guide overlay */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 200,
                                    height: 260,
                                    border: '3px dashed rgba(255,255,255,0.6)',
                                    borderRadius: '50%',
                                }}
                            />
                        </div>

                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        <Button
                            type="primary"
                            size="large"
                            icon={<CameraOutlined />}
                            onClick={capturePhoto}
                            disabled={!isStreaming}
                            style={{ marginTop: 24 }}
                        >
                            Capture Photo
                        </Button>
                    </div>
                );

            case 'preview':
                return (
                    <div style={{ textAlign: 'center' }}>
                        <Paragraph style={{ marginBottom: 16 }}>
                            Review your photo. Make sure your face is clearly visible and properly
                            centered.
                        </Paragraph>

                        <div
                            style={{
                                width: '100%',
                                maxWidth: 480,
                                margin: '0 auto',
                                borderRadius: 12,
                                overflow: 'hidden',
                            }}
                        >
                            <img
                                src={previewUrl || ''}
                                alt="Captured face"
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    display: 'block',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                        </div>

                        <Space style={{ marginTop: 24 }}>
                            <Button size="large" onClick={retakePhoto}>
                                Retake Photo
                            </Button>
                            <Button
                                type="primary"
                                size="large"
                                icon={<CheckCircleOutlined />}
                                onClick={submitRegistration}
                            >
                                Confirm & Register
                            </Button>
                        </Space>
                    </div>
                );

            case 'uploading':
                return (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <LoadingOutlined style={{ fontSize: 48, color: 'var(--primary)' }} />
                        <Title level={4} style={{ marginTop: 24 }}>
                            Registering your face...
                        </Title>
                        <Text type="secondary">
                            Please wait while we process your photo.
                        </Text>
                    </div>
                );

            case 'success':
                return (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <CheckCircleOutlined style={{ fontSize: 64, color: 'var(--primary)' }} />
                        <Title level={4} style={{ marginTop: 24 }}>
                            Face Registered Successfully!
                        </Title>
                        <Text type="secondary">
                            Your identity has been verified. You can now start the exam.
                        </Text>
                    </div>
                );
        }
    };

    return (
        <Modal
            open={open}
            title={
                <Space>
                    <UserOutlined />
                    <span>Face Registration for Proctoring</span>
                </Space>
            }
            onCancel={onCancel}
            footer={null}
            width={560}
            centered
            closable={step !== 'uploading'}
            maskClosable={step !== 'uploading'}
        >
            <Steps
                current={step === 'capture' ? 0 : step === 'preview' ? 1 : 2}
                size="small"
                style={{ marginBottom: 24 }}
                items={[
                    { title: 'Capture', icon: <CameraOutlined /> },
                    { title: 'Review', icon: <CheckCircleOutlined /> },
                    { title: 'Register', icon: <UserOutlined /> },
                ]}
            />

            {renderContent()}

            <Alert
                type="info"
                message="Why do we need this?"
                description="Face registration helps verify your identity during the exam. Your face will be periodically checked against this photo to prevent fraud."
                showIcon
                style={{ marginTop: 24 }}
            />
        </Modal>
    );
};

// Hook to check if face registration is required
export const useFaceRegistrationRequired = (requiresFaceVerification: boolean) => {
    const { data: faceStatus, isLoading } = useFaceStatus();

    return {
        isRequired: requiresFaceVerification && !faceStatus?.face_registered,
        isLoading,
        faceStatus,
    };
};

export default FaceRegistrationModal;
