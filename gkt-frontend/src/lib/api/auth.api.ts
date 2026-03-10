import apiClient from './client';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),
  register: (data: any) =>
    apiClient.post('/api/auth/register', data),
  refresh: () =>
    apiClient.post('/api/auth/refresh'),
  logout: () =>
    apiClient.post('/api/auth/logout'),
};
