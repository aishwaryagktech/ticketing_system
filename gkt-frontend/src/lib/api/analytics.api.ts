import apiClient from './client';

export const analyticsApi = {
  getSummary: () => apiClient.get('/api/analytics/summary'),
  getTickets: (params?: any) => apiClient.get('/api/analytics/tickets', { params }),
  getAgents: (params?: any) => apiClient.get('/api/analytics/agents', { params }),
  getSLA: (params?: any) => apiClient.get('/api/analytics/sla', { params }),
  getAIUsage: (params?: any) => apiClient.get('/api/analytics/ai-usage', { params }),
  getKB: (params?: any) => apiClient.get('/api/analytics/kb', { params }),
  exportReport: (params?: any) => apiClient.get('/api/analytics/export', { params, responseType: 'blob' }),
};
