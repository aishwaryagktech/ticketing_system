import { widgetClient } from './client';

export const ticketApi = {
  create: (data: any) => widgetClient.post('/api/tickets', data),
};
