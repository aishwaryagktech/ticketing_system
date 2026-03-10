import apiClient from './client';

export const botApi = {
  chat: (message: string, productId: string, tenantId?: string, sessionId?: string) =>
    apiClient.post('/api/bot/chat', { message, product_id: productId, tenant_id: tenantId, session_id: sessionId }),
  handoff: (sessionId: string) =>
    apiClient.post('/api/bot/handoff', { session_id: sessionId }),
};
