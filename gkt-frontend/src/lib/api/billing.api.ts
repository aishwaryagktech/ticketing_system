import apiClient from './client';

export const billingApi = {
  listPlans: () => apiClient.get('/api/billing/plans'),
  getSubscription: () => apiClient.get('/api/billing/subscription'),
  subscribe: (planId: string) => apiClient.post('/api/billing/subscribe', { plan_id: planId }),
  updateSubscription: (data: any) => apiClient.patch('/api/billing/subscription', data),
  listInvoices: () => apiClient.get('/api/billing/invoices'),
};
