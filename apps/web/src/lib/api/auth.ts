import { apiClient } from './client';
import type { LoginCredentials, LoginResponse } from '@/types/auth';

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<LoginResponse>('/auth/login', credentials, {
      skipAuth: true,
    }),
};
