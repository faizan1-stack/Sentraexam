import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  User,
  CreateUserPayload,
  UpdateUserPayload,
  PaginatedResponse,
} from '../types';

// List users
export const listUsers = async (params?: {
  role?: string;
  department?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<User>> => {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/auth/accounts/', {
    params,
  });
  return data;
};

export const useUsers = (params?: {
  role?: string;
  department?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
  });
};

// Get single user
export const getUser = async (id: number): Promise<User> => {
  const { data } = await apiClient.get<User>(`/auth/accounts/${id}/`);
  return data;
};

export const useUser = (id: number) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser(id),
    enabled: !!id,
  });
};

// Create user
export const createUser = async (payload: CreateUserPayload): Promise<User> => {
  const { data } = await apiClient.post<User>('/auth/accounts/', payload);
  return data;
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Update user
export const updateUser = async (
  id: number,
  payload: UpdateUserPayload
): Promise<User> => {
  const { data } = await apiClient.patch<User>(`/auth/accounts/${id}/`, payload);
  return data;
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
    },
  });
};

// Delete user
export const deleteUser = async (id: number): Promise<void> => {
  await apiClient.delete(`/auth/accounts/${id}/`);
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
