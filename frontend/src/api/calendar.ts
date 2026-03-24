import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  AcademicYear,
  AcademicTerm,
  CalendarEvent,
  CreateCalendarEventPayload,
  PaginatedResponse
} from '../types';

// Academic Years

// List academic years
export const listAcademicYears = async (params?: {
  is_active?: boolean;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<AcademicYear>> => {
  const { data } = await apiClient.get<PaginatedResponse<AcademicYear>>('/calendar/years/', {
    params,
  });
  return data;
};

export const useAcademicYears = (params?: {
  is_active?: boolean;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['academic-years', params],
    queryFn: () => listAcademicYears(params),
  });
};

// Get single academic year
export const getAcademicYear = async (id: string): Promise<AcademicYear> => {
  const { data } = await apiClient.get<AcademicYear>(`/calendar/years/${id}/`);
  return data;
};

export const useAcademicYear = (id: string) => {
  return useQuery({
    queryKey: ['academic-year', id],
    queryFn: () => getAcademicYear(id),
    enabled: !!id,
  });
};

// Create academic year
export const createAcademicYear = async (payload: {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}): Promise<AcademicYear> => {
  const { data } = await apiClient.post<AcademicYear>('/calendar/years/', payload);
  return data;
};

export const useCreateAcademicYear = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });
};

// Update academic year
export const updateAcademicYear = async (
  id: string,
  payload: Partial<{
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
  }>
): Promise<AcademicYear> => {
  const { data } = await apiClient.patch<AcademicYear>(`/calendar/years/${id}/`, payload);
  return data;
};

export const useUpdateAcademicYear = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<{
      name: string;
      start_date: string;
      end_date: string;
      is_active: boolean;
    }> }) => updateAcademicYear(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['academic-year', variables.id] });
    },
  });
};

// Delete academic year
export const deleteAcademicYear = async (id: string): Promise<void> => {
  await apiClient.delete(`/calendar/years/${id}/`);
};

export const useDeleteAcademicYear = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });
};

// Activate academic year
export const activateAcademicYear = async (id: string): Promise<AcademicYear> => {
  const { data } = await apiClient.post<AcademicYear>(`/calendar/years/${id}/activate/`);
  return data;
};

export const useActivateAcademicYear = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });
};

// Academic Terms

// List academic terms
export const listAcademicTerms = async (params?: {
  academic_year?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<AcademicTerm>> => {
  const { data } = await apiClient.get<PaginatedResponse<AcademicTerm>>('/calendar/terms/', {
    params,
  });
  return data;
};

export const useAcademicTerms = (params?: {
  academic_year?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['academic-terms', params],
    queryFn: () => listAcademicTerms(params),
  });
};

// Get single academic term
export const getAcademicTerm = async (id: string): Promise<AcademicTerm> => {
  const { data } = await apiClient.get<AcademicTerm>(`/calendar/terms/${id}/`);
  return data;
};

export const useAcademicTerm = (id: string) => {
  return useQuery({
    queryKey: ['academic-term', id],
    queryFn: () => getAcademicTerm(id),
    enabled: !!id,
  });
};

// Create academic term
export const createAcademicTerm = async (payload: {
  academic_year: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}): Promise<AcademicTerm> => {
  const { data } = await apiClient.post<AcademicTerm>('/calendar/terms/', payload);
  return data;
};

export const useCreateAcademicTerm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAcademicTerm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-terms'] });
    },
  });
};

// Update academic term
export const updateAcademicTerm = async (
  id: string,
  payload: Partial<{
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
  }>
): Promise<AcademicTerm> => {
  const { data } = await apiClient.patch<AcademicTerm>(`/calendar/terms/${id}/`, payload);
  return data;
};

export const useUpdateAcademicTerm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<{
      name: string;
      start_date: string;
      end_date: string;
      is_active: boolean;
    }> }) => updateAcademicTerm(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['academic-terms'] });
      queryClient.invalidateQueries({ queryKey: ['academic-term', variables.id] });
    },
  });
};

// Delete academic term
export const deleteAcademicTerm = async (id: string): Promise<void> => {
  await apiClient.delete(`/calendar/terms/${id}/`);
};

export const useDeleteAcademicTerm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAcademicTerm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-terms'] });
    },
  });
};

// Activate academic term
export const activateAcademicTerm = async (id: string): Promise<AcademicTerm> => {
  const { data } = await apiClient.post<AcademicTerm>(`/calendar/terms/${id}/activate/`);
  return data;
};

export const useActivateAcademicTerm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateAcademicTerm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-terms'] });
    },
  });
};

// Calendar Events

// List calendar events
export const listCalendarEvents = async (params?: {
  academic_term?: string;
  department?: string;
  course?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<CalendarEvent>> => {
  const { data } = await apiClient.get<PaginatedResponse<CalendarEvent>>('/calendar/events/', {
    params,
  });
  return data;
};

export const useCalendarEvents = (params?: {
  academic_term?: string;
  department?: string;
  course?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['calendar-events', params],
    queryFn: () => listCalendarEvents(params),
  });
};

// Get single calendar event
export const getCalendarEvent = async (id: string): Promise<CalendarEvent> => {
  const { data } = await apiClient.get<CalendarEvent>(`/calendar/events/${id}/`);
  return data;
};

export const useCalendarEvent = (id: string) => {
  return useQuery({
    queryKey: ['calendar-event', id],
    queryFn: () => getCalendarEvent(id),
    enabled: !!id,
  });
};

// Create calendar event
export const createCalendarEvent = async (payload: CreateCalendarEventPayload): Promise<CalendarEvent> => {
  const { data } = await apiClient.post<CalendarEvent>('/calendar/events/', payload);
  return data;
};

export const useCreateCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
};

// Update calendar event
export const updateCalendarEvent = async (
  id: string,
  payload: Partial<CreateCalendarEventPayload>
): Promise<CalendarEvent> => {
  const { data } = await apiClient.patch<CalendarEvent>(`/calendar/events/${id}/`, payload);
  return data;
};

export const useUpdateCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCalendarEventPayload> }) =>
      updateCalendarEvent(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-event', variables.id] });
    },
  });
};

// Delete calendar event
export const deleteCalendarEvent = async (id: string): Promise<void> => {
  await apiClient.delete(`/calendar/events/${id}/`);
};

export const useDeleteCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
};

// Get current academic year
export const getCurrentAcademicYear = async (): Promise<AcademicYear> => {
  const { data } = await apiClient.get<AcademicYear>('/calendar/current-year/');
  return data;
};

export const useCurrentAcademicYear = () => {
  return useQuery({
    queryKey: ['current-academic-year'],
    queryFn: getCurrentAcademicYear,
  });
};

// Get current academic term
export const getCurrentAcademicTerm = async (): Promise<AcademicTerm> => {
  const { data } = await apiClient.get<AcademicTerm>('/calendar/current-term/');
  return data;
};

export const useCurrentAcademicTerm = () => {
  return useQuery({
    queryKey: ['current-academic-term'],
    queryFn: getCurrentAcademicTerm,
  });
};