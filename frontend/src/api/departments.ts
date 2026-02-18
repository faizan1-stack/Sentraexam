import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  Department,
  CreateDepartmentPayload,
  DepartmentMembership,
  PaginatedResponse,
} from '../types';

// List departments
export const listDepartments = async (params?: {
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Department>> => {
  const { data } = await apiClient.get<PaginatedResponse<Department>>('/departments/', {
    params,
  });
  return data;
};

export const useDepartments = (params?: { search?: string; page?: number }) => {
  return useQuery({
    queryKey: ['departments', params],
    queryFn: () => listDepartments(params),
  });
};

// Get single department
export const getDepartment = async (id: string): Promise<Department> => {
  const { data } = await apiClient.get<Department>(`/departments/${id}/`);
  return data;
};

export const useDepartment = (id: string) => {
  return useQuery({
    queryKey: ['department', id],
    queryFn: () => getDepartment(id),
    enabled: !!id,
  });
};

// Create department
export const createDepartment = async (
  payload: CreateDepartmentPayload
): Promise<Department> => {
  const { data } = await apiClient.post<Department>('/departments/', payload);
  return data;
};

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
};

// Update department
export const updateDepartment = async (
  id: string,
  payload: Partial<CreateDepartmentPayload>
): Promise<Department> => {
  const { data } = await apiClient.patch<Department>(`/departments/${id}/`, payload);
  return data;
};

export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateDepartmentPayload> }) =>
      updateDepartment(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department', variables.id] });
    },
  });
};

// Delete department
export const deleteDepartment = async (id: string): Promise<void> => {
  await apiClient.delete(`/departments/${id}/`);
};

export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
};

// Department Memberships
export const listDepartmentMemberships = async (params?: {
  department?: string;
  user?: number;
  role?: string;
  search?: string;
}): Promise<PaginatedResponse<DepartmentMembership>> => {
  const { data } = await apiClient.get<PaginatedResponse<DepartmentMembership>>(
    '/departments/memberships/',
    { params }
  );
  return data;
};

export const useDepartmentMemberships = (params?: {
  department?: string;
  user?: number;
  role?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['department-memberships', params],
    queryFn: () => listDepartmentMemberships(params),
  });
};
