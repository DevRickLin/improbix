import { useAuthStore } from '@/stores/auth-store';

const BASE_URL = '/api';

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { skipAuth = false, ...fetchConfig } = config;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchConfig.headers,
  };

  if (!skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...fetchConfig,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
      throw new ApiError(401, 'Session expired, please login again');
    }

    const error = await response
      .json()
      .catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed');
  }

  const text = await response.text();
  return text ? JSON.parse(text) : (null as T);
}

export const apiClient = {
  get: <T>(url: string, config?: RequestConfig) =>
    request<T>(url, { ...config, method: 'GET' }),

  post: <T>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>(url, { ...config, method: 'POST', body: JSON.stringify(data) }),

  put: <T>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>(url, { ...config, method: 'PUT', body: JSON.stringify(data) }),

  delete: <T>(url: string, config?: RequestConfig) =>
    request<T>(url, { ...config, method: 'DELETE' }),
};
