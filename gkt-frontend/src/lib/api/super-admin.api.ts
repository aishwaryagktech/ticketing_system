import apiClient from './client';

export const superAdminApi = {
  // Products
  getProducts: () => apiClient.get('/api/super-admin/products'),
  getProduct: (id: string) => apiClient.get(`/api/super-admin/products/${id}`),
  createProduct: (data: any) => apiClient.post('/api/super-admin/products', data),
  updateProduct: (id: string, data: any) => apiClient.patch(`/api/super-admin/products/${id}`, data),

  // Feature Flags
  getFlags: (productId: string) => apiClient.get(`/api/super-admin/flags/${productId}`),
  updateFlags: (productId: string, data: any) => apiClient.patch(`/api/super-admin/flags/${productId}`, data),

  // Billing Plans
  getPlans: () => apiClient.get('/api/super-admin/billing/plans'),
  createPlan: (data: any) => apiClient.post('/api/super-admin/billing/plans', data),
  updatePlan: (id: string, data: any) => apiClient.patch(`/api/super-admin/billing/plans/${id}`, data),
  deletePlan: (id: string) => apiClient.delete(`/api/super-admin/billing/plans/${id}`),

  // Platform Analytics
  getPlatformStats: () => apiClient.get('/api/super-admin/stats'),
};
