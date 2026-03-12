import apiClient from './client';

export const gmailApi = {
  oauthStart: () => apiClient.get('/api/gmail/oauth/start'),
  syncTicketThread: (ticketId: string) => apiClient.post(`/api/gmail/sync/tickets/${ticketId}`),
};

