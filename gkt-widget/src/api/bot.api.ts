import { widgetClient } from './client';

export const botApi = {
  chat: (message: string, productId: string, sessionId?: string) =>
    widgetClient.post('/api/bot/chat', { message, product_id: productId, session_id: sessionId }),
  handoff: (sessionId: string) =>
    widgetClient.post('/api/bot/handoff', { session_id: sessionId }),
};
