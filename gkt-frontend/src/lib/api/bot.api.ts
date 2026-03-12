import apiClient from './client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const botApi = {
  welcomeMessage: async (tenant_id: string, tenant_product_id?: string) => {
    const params = new URLSearchParams({ tenant_id });
    if (tenant_product_id) params.set('tenant_product_id', tenant_product_id);
    const res = await fetch(`${BASE_URL}/api/bot/welcome-message?${params}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    return { data } as { data: { message: string } };
  },
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
