import { useRef, useState, useCallback } from 'react';

interface UseVideoRecordingReturn {
    isRecording: boolean;
    recordingDuration: number;
    startRecording: (stream: MediaStream) => boolean;
    stopRecording: () => Promise<{ blob: Blob; duration: number } | null>;
    error: string | null;
}

/**
 * Custom hook for video recording using MediaRecorder API.
 * Designed to work independently from the WebcamProctor component
 * to avoid React dependency cycles.
 */
export const useVideoRecording = (): UseVideoRecordingReturn => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Use refs instead of state for recorder internals to avoid re-renders
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /**
     * Start recording from the provided MediaStream.
     * Returns true if recording started successfully, false otherwise.
     */
    const startRecording = useCallback((stream: MediaStream): boolean => {
        // Prevent multiple recordings
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.warn('Recording already in progress');
            return false;
        }

        try {
            // Determine supported MIME type
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm';
                }
            }

            const options = { mimeType };
            const recorder = new MediaRecorder(stream, options);

            // Reset state
            recordedChunksRef.current = [];
            startTimeRef.current = Date.now();
            setError(null);

            // Handle data available
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            // Handle recorder errors
            recorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                setError('Recording error occurred');
                setIsRecording(false);
            };

            // Handle recorder stop
            recorder.onstop = () => {
                // Duration interval cleanup handled in stopRecording
            };

            // Start recording with 5-second chunks
            recorder.start(5000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);

            // Start duration tracker
            durationIntervalRef.current = setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);

            console.log('Video recording started with', mimeType);
            return true;
        } catch (err) {
            console.error('Failed to start recording:', err);
            setError(err instanceof Error ? err.message : 'Failed to start recording');
            return false;
        }
    }, []);

    /**
     * Stop recording and return the recorded video blob with duration.
     * Returns null if no recording was in progress.
     */
    const stopRecording = useCallback((): Promise<{ blob: Blob; duration: number } | null> => {
        return new Promise((resolve) => {
            // Clear duration interval
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }

            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                console.warn('No active recording to stop');
                setIsRecording(false);
                resolve(null);
                return;
            }

            // Set up onstop handler to resolve with blob
            recorder.onstop = () => {
                const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
                const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });

                console.log(`Recording stopped: ${duration}s, ${(blob.size / 1024 / 1024).toFixed(2)}MB`);

                setIsRecording(false);
                setRecordingDuration(duration);

                // Clean up
                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];

                resolve({ blob, duration });
            };

            // Stop the recorder
            recorder.stop();
        });
    }, []);

    return {
        isRecording,
        recordingDuration,
        startRecording,
        stopRecording,
        error,
    };
};

export default useVideoRecording;
