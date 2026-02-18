import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  Announcement,
  CreateAnnouncementPayload,
  PaginatedResponse,
  Notification,
  AnnouncementRecipient
} from '../types';

// List announcements
export const listAnnouncements = async (params?: {
  status?: string;
  audience?: string;
  department?: number;
  course?: number;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Announcement>> => {
  const { data } = await apiClient.get<PaginatedResponse<Announcement>>('/announcements/', {
    params,
  });
  return data;
};

export const useAnnouncements = (params?: {
  status?: string;
  audience?: string;
  department?: number;
  course?: number;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: () => listAnnouncements(params),
  });
};

// Get single announcement
export const getAnnouncement = async (id: number): Promise<Announcement> => {
  const { data } = await apiClient.get<Announcement>(`/announcements/${id}/`);
  return data;
};

export const useAnnouncement = (id: number) => {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: () => getAnnouncement(id),
    enabled: !!id,
  });
};

// Create announcement
export const createAnnouncement = async (payload: CreateAnnouncementPayload): Promise<Announcement> => {
  const { data } = await apiClient.post<Announcement>('/announcements/', payload);
  return data;
};

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
};

// Update announcement
export const updateAnnouncement = async (
  id: number,
  payload: Partial<CreateAnnouncementPayload>
): Promise<Announcement> => {
  const { data } = await apiClient.patch<Announcement>(`/announcements/${id}/`, payload);
  return data;
};

export const useUpdateAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateAnnouncementPayload> }) =>
      updateAnnouncement(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', variables.id] });
    },
  });
};

// Delete announcement
export const deleteAnnouncement = async (id: number): Promise<void> => {
  await apiClient.delete(`/announcements/${id}/`);
};

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
};

// Send announcement
export const sendAnnouncement = async (id: number): Promise<Announcement> => {
  const { data } = await apiClient.post<Announcement>(`/announcements/${id}/send/`);
  return data;
};

export const useSendAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendAnnouncement,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
    },
  });
};

// Schedule announcement
export const scheduleAnnouncement = async (
  id: number,
  scheduledFor: string
): Promise<Announcement> => {
  const { data } = await apiClient.post<Announcement>(`/announcements/${id}/schedule/`, {
    scheduled_for: scheduledFor,
  });
  return data;
};

export const useScheduleAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledFor }: { id: number; scheduledFor: string }) =>
      scheduleAnnouncement(id, scheduledFor),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', variables.id] });
    },
  });
};

// Cancel announcement
export const cancelAnnouncement = async (id: number): Promise<Announcement> => {
  const { data } = await apiClient.post<Announcement>(`/announcements/${id}/cancel/`);
  return data;
};

export const useCancelAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelAnnouncement,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
    },
  });
};

// Get announcement recipients
export const getAnnouncementRecipients = async (id: number): Promise<AnnouncementRecipient[]> => {
  const { data } = await apiClient.get<AnnouncementRecipient[]>(`/announcements/${id}/recipients/`);
  return data;
};

export const useAnnouncementRecipients = (id: number) => {
  return useQuery({
    queryKey: ['announcement-recipients', id],
    queryFn: () => getAnnouncementRecipients(id),
    enabled: !!id,
  });
};

// User notifications
export const listNotifications = async (params?: {
  is_read?: boolean;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Notification>> => {
  const { data } = await apiClient.get<PaginatedResponse<Notification>>('/notifications/', {
    params,
  });
  return data;
};

export const useNotifications = (params?: {
  is_read?: boolean;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => listNotifications(params),
  });
};

// Mark notification as read
export const markNotificationAsRead = async (id: string): Promise<Notification> => {
  const { data } = await apiClient.post<Notification>(`/notifications/${id}/mark_read/`);
  return data;
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<void> => {
  await apiClient.post('/notifications/mark-all-read/');
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// Get unread notification count
export const getUnreadNotificationCount = async (): Promise<{ count: number }> => {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count/');
  return data;
};

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: ['unread-notification-count'],
    queryFn: getUnreadNotificationCount,
  });
};