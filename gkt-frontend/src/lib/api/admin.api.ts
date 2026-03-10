import apiClient from './client';

export const adminApi = {
  // SLA
  listSLA: () => apiClient.get('/api/admin/sla'),
  createSLA: (data: any) => apiClient.post('/api/admin/sla', data),
  updateSLA: (id: string, data: any) => apiClient.patch(`/api/admin/sla/${id}`, data),
  // Escalation
  listEscalation: () => apiClient.get('/api/admin/escalation'),
  createEscalation: (data: any) => apiClient.post('/api/admin/escalation', data),
  updateEscalation: (id: string, data: any) => apiClient.patch(`/api/admin/escalation/${id}`, data),
  // Branding
  getBranding: () => apiClient.get('/api/admin/branding'),
  updateBranding: (data: any) => apiClient.patch('/api/admin/branding', data),
  // AI Providers
  listAIProviders: () => apiClient.get('/api/admin/ai-providers'),
  createAIProvider: (data: any) => apiClient.post('/api/admin/ai-providers', data),
  updateAIProvider: (id: string, data: any) => apiClient.patch(`/api/admin/ai-providers/${id}`, data),
  // Tenants
  listTenants: () => apiClient.get('/api/admin/tenants'),
  createTenant: (data: any) => apiClient.post('/api/admin/tenants', data),
  updateTenant: (id: string, data: any) => apiClient.patch(`/api/admin/tenants/${id}`, data),
};
