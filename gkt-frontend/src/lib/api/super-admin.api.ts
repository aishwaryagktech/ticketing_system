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

  // Tenant products (all tenants, dashboard)
  getTenantProducts: () => apiClient.get('/api/super-admin/tenant-products'),
  getTenantProductStats: () => apiClient.get('/api/super-admin/tenant-products/stats'),

  // Tickets (all tickets, dashboard)
  getTickets: (params?: { status?: string; tenant_product_id?: string; sla_breached?: string; take?: number; skip?: number }) =>
    apiClient.get('/api/super-admin/tickets', { params }),
  getTicketStats: () => apiClient.get('/api/super-admin/tickets/stats'),
};
