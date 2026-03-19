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
    attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
  }) =>
    apiClient.post('/api/bot/chat', {
      message: args.message,
      tenant_id: args.tenant_id,
      tenant_product_id: args.tenant_product_id,
      session_id: args.session_id,
      user_id: args.user_id,
      user_email: args.user_email,
      attachments: args.attachments || [],
    }),
  chatL1: (args: {
    message: string;
    tenant_id: string;
    tenant_product_id?: string;
    session_id?: string;
    l0_session_id?: string;
    user_id?: string;
    user_email?: string;
    attachments?: Array<{ filename: string; mime_type: string; size_bytes: number; base64: string }>;
  }) =>
    apiClient.post('/api/bot/l1/chat', {
      message: args.message,
      tenant_id: args.tenant_id,
      tenant_product_id: args.tenant_product_id,
      session_id: args.session_id,
      l0_session_id: args.l0_session_id,
      user_id: args.user_id,
      user_email: args.user_email,
      attachments: args.attachments || [],
    }),
  handoff: (sessionId: string) =>
    apiClient.post('/api/bot/handoff', { session_id: sessionId }),
  getConversation: async (tenant_id: string, tenant_product_id: string, session_id: string) => {
    const params = new URLSearchParams({ tenant_id, tenant_product_id, session_id });
    const res = await fetch(`${BASE_URL}/api/bot/conversation?${params}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    return { data } as {
      data: {
        is_l1?: boolean;
        messages: Array<{
          id: string;
          from: string;
          text: string;
          author_name?: string;
          created_at: string | Date;
        }>;
      };
    };
  },
};
