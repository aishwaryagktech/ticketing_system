import { widgetClient } from './client';

export const botApi = {
  welcome: (tenantId: string | undefined, tenantProductId: string | undefined) => {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    if (tenantProductId) params.set('tenant_product_id', tenantProductId);
    const qs = params.toString();
    return widgetClient.get(`/api/bot/welcome-message${qs ? `?${qs}` : ''}`);
  },
  chat: (args: {
    message: string;
    tenantId: string;
    tenantProductId: string;
    sessionId?: string | null;
    userId?: string;
    userEmail?: string;
    appSessionId?: string | null; // host app session ID for FlowPay log correlation
  }) =>
    widgetClient.post('/api/bot/chat', {
      message: args.message,
      tenant_id: args.tenantId,
      tenant_product_id: args.tenantProductId,
      session_id: args.sessionId,
      user_id: args.userId,
      user_email: args.userEmail,
      app_session_id: args.appSessionId || null,
    }),
  handoff: (sessionId: string) =>
    widgetClient.post('/api/bot/handoff', { session_id: sessionId }),
};
