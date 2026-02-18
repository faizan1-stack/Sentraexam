import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { setTokens, clearTokens } from './client';
import type {
  LoginPayload,
  AuthTokens,
  User,
  ActivationPayload,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '../types';

// Login
export const login = async (credentials: LoginPayload): Promise<AuthTokens> => {
  const { data } = await apiClient.post<AuthTokens>('/auth/token/', credentials);
  setTokens(data);
  return data;
};

export const useLogin = () => {
  return useMutation({
    mutationFn: login,
  });
};

// Logout
export const logout = (): void => {
  clearTokens();
};

// Get current user profile
export const getCurrentUser = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/auth/accounts/me/');
  return data;
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });
};

// Activate account
export const activateAccount = async (payload: ActivationPayload): Promise<User> => {
  const { data } = await apiClient.post<User>('/auth/accounts/activate/', payload);
  return data;
};

export const useActivateAccount = () => {
  return useMutation({
    mutationFn: activateAccount,
  });
};

// Request password reset
export const requestPasswordReset = async (
  payload: PasswordResetRequest
): Promise<{ token: string }> => {
  const { data } = await apiClient.post<{ token: string }>('/auth/accounts/password-reset/', payload);
  return data;
};

export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: requestPasswordReset,
  });
};

// Confirm password reset
export const confirmPasswordReset = async (
  payload: PasswordResetConfirm
): Promise<void> => {
  await apiClient.post('/auth/accounts/password-reset/confirm/', payload);
};

export const useConfirmPasswordReset = () => {
  return useMutation({
    mutationFn: confirmPasswordReset,
  });
};

// Refresh token
export const refreshToken = async (refresh: string): Promise<AuthTokens> => {
  const { data } = await apiClient.post<{ access: string }>('/auth/token/refresh/', {
    refresh,
  });
  return { access: data.access, refresh };
};
