import apiClient from './client';

export const widgetApi = {
  listMyTickets: (tenant_id: string, user_email: string, tenant_product_id?: string) =>
    apiClient.get('/api/widget/tickets', {
      params: { tenant_id, user_email, tenant_product_id },
    }),
  getTicketMessages: (id: string, tenant_id: string, user_email: string, tenant_product_id?: string) =>
    apiClient.get(`/api/widget/tickets/${id}/messages`, {
      params: { tenant_id, user_email, tenant_product_id },
    }),
  sendTicketMessage: (id: string, tenant_id: string, user_email: string, body: string, tenant_product_id?: string) =>
    apiClient.post(`/api/widget/tickets/${id}/messages`, {
      tenant_id,
      user_email,
      body,
    }),
};

