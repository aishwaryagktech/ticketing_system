import apiClient from './client';

export const botApi = {
  chat: (args: {
    message: string;
    tenant_id: string;
    tenant_product_id?: string;
    session_id?: string;
    user_id?: string;
    user_email?: string;
  }) =>
    apiClient.post('/api/bot/chat', {
      message: args.message,
      tenant_id: args.tenant_id,
      tenant_product_id: args.tenant_product_id,
      session_id: args.session_id,
      user_id: args.user_id,
      user_email: args.user_email,
    }),
  handoff: (sessionId: string) =>
    apiClient.post('/api/bot/handoff', { session_id: sessionId }),
};
