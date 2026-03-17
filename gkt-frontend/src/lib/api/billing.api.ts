import apiClient from './client';

export const billingApi = {
  listPlans: () => apiClient.get('/api/billing/plans'),
  getSubscription: () => apiClient.get('/api/billing/subscription'),
  activateFreeTrial: (planId: string) =>
    apiClient.post('/api/billing/activate-trial', { plan_id: planId }),
  createOrder: (planId: string) =>
    apiClient.post('/api/billing/subscribe', { plan_id: planId }),
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan_id: string;
  }) => apiClient.post('/api/billing/verify-payment', data),
  listInvoices: (limit?: number) =>
    apiClient.get('/api/billing/invoices', { params: limit ? { limit } : {} }),
  getInvoice: (paymentId: string) =>
    apiClient.get(`/api/billing/invoices/${paymentId}`),
  updateSubscription: (data: any) => apiClient.patch('/api/billing/subscription', data),
};
