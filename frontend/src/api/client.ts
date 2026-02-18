import axios, { AxiosError } from 'axios';
import type { AuthTokens } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'sentraexam_tokens';

export const getTokens = (): AuthTokens | null => {
  const tokens = localStorage.getItem(TOKEN_KEY);
  return tokens ? JSON.parse(tokens) : null;
};

export const setTokens = (tokens: AuthTokens): void => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const tokens = getTokens();
    if (tokens?.access && config.headers) {
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const tokens = getTokens();
      if (!tokens?.refresh) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh token
        const response = await axios.post<AuthTokens>(
          `${API_BASE_URL}/auth/token/refresh/`,
          { refresh: tokens.refresh }
        );

        const newTokens: AuthTokens = {
          access: response.data.access,
          refresh: tokens.refresh, // Keep the same refresh token
        };

        setTokens(newTokens);
        processQueue(null);

        // Retry the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(new Error('Token refresh failed'));
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
