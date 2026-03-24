import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notification as antdNotification } from 'antd';
import { BellOutlined, CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';

import { getTokens } from '../api/client';
import type { Notification } from '../types';

type SoundType = 'none' | 'notification' | 'success' | 'warning' | 'alert' | 'urgent';

type SocketPayload =
  | { type: 'connection_established'; unread_count?: number; unreadCount?: number }
  | { type: 'notification'; notification: Notification; unread_count?: number; unreadCount?: number }
  | { type: 'unread_count'; unread_count: number }
  | { type: 'pong' }
  | { type: 'error'; message?: string };

const isBrowser = typeof window !== 'undefined';

const deriveWsUrl = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const wsBase = apiBase.replace(/^http/i, 'ws').replace(/\/api\/?$/i, '');
  return `${wsBase}/ws/notifications/`;
};

const soundFromNotification = (n: Notification): SoundType => {
  const action = String(n.metadata?.action || n.metadata?.type || '').toLowerCase();
  const text = `${n.subject} ${n.body}`.toLowerCase();

  if (action.includes('proctoring') || action.includes('cheating') || text.includes('violation')) return 'urgent';
  if (action.includes('exam_start') || text.includes('exam started')) return 'alert';
  if (action.includes('reminder') || text.includes('reminder') || text.includes('deadline')) return 'warning';
  if (action.includes('approved') || text.includes('approved') || action.includes('submitted')) return 'success';
  return 'notification';
};

const iconFromSound = (sound: SoundType) => {
  if (sound === 'success') return <CheckCircleOutlined style={{ color: '#16a34a' }} />;
  if (sound === 'warning') return <WarningOutlined style={{ color: '#f59e0b' }} />;
  if (sound === 'alert' || sound === 'urgent') return <ExclamationCircleOutlined style={{ color: '#ef4444' }} />;
  return <BellOutlined style={{ color: '#3b82f6' }} />;
};

const playBeep = async (frequency: number, ms: number, volume: number) => {
  if (!isBrowser) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
    osc.onended = () => {
      ctx.close().catch(() => undefined);
    };
  } catch {
    // Ignore sound failures (autoplay policies, unsupported APIs, etc.)
  }
};

const makeSoundPlayer = () => {
  const volume = 0.7;
  const sounds: Record<SoundType, HTMLAudioElement | null> = {
    none: null,
    notification: isBrowser ? new Audio('/sounds/notification.mp3') : null,
    success: isBrowser ? new Audio('/sounds/success.mp3') : null,
    warning: isBrowser ? new Audio('/sounds/warning.mp3') : null,
    alert: isBrowser ? new Audio('/sounds/alert.mp3') : null,
    urgent: isBrowser ? new Audio('/sounds/urgent.mp3') : null,
  };

  Object.values(sounds).forEach((a) => {
    if (!a) return;
    a.preload = 'auto';
    a.volume = volume;
  });

  return async (sound: SoundType) => {
    if (!isBrowser) return;
    if (sound === 'none') return;

    const audio = sounds[sound];
    if (!audio) return;

    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // Fallback: tiny beeps if mp3 can't autoplay or files are missing
      if (sound === 'success') await playBeep(660, 140, 0.35);
      else if (sound === 'warning') await playBeep(440, 160, 0.35);
      else if (sound === 'alert') await playBeep(520, 220, 0.45);
      else if (sound === 'urgent') {
        await playBeep(520, 240, 0.5);
        await playBeep(520, 240, 0.5);
      } else await playBeep(520, 120, 0.25);
    }
  };
};

export const useNotificationSocket = (opts?: { enabled?: boolean; showToasts?: boolean }) => {
  const enabled = opts?.enabled ?? true;
  const showToasts = opts?.showToasts ?? true;
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  const playSound = useMemo(() => makeSoundPlayer(), []);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tokens = getTokens();
    if (!tokens?.access) return;

    const wsUrl = `${deriveWsUrl()}?token=${encodeURIComponent(tokens.access)}`;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          reconnectRef.current = 0;
        };

        ws.onclose = () => {
          setIsConnected(false);

          // Exponential backoff reconnect (max ~30s)
          const attempts = reconnectRef.current + 1;
          reconnectRef.current = attempts;
          const delay = Math.min(30000, 500 * Math.pow(2, attempts));
          if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };

        ws.onmessage = async (event) => {
          let payload: SocketPayload | null = null;
          try {
            payload = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (!payload) return;

          if (payload.type === 'notification') {
            // Refresh cached notifications & unread badge
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });

            const n = payload.notification;
            const sound = soundFromNotification(n);
            await playSound(sound);

            if (showToasts) {
              antdNotification.open({
                message: n.subject,
                description: n.body,
                icon: iconFromSound(sound),
                placement: 'topRight',
                duration: sound === 'urgent' ? 6 : 4,
              });
            }
          }
        };
      } catch {
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };
  }, [enabled, playSound, queryClient, showToasts]);

  return { isConnected };
};
