import apiClient from './client';

export const agentApi = {
  list: () => apiClient.get('/api/agents'),
  invite: (data: any) => apiClient.post('/api/agents/invite', data),
  update: (id: string, data: any) => apiClient.patch(`/api/agents/${id}`, data),
  deactivate: (id: string) => apiClient.patch(`/api/agents/${id}/deactivate`),
  myProducts: () => apiClient.get('/api/agents/me/products'),
  getDashboardStats: () => apiClient.get('/api/agents/me/dashboard-stats'),
};
