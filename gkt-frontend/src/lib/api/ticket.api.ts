import apiClient from './client';

export const ticketApi = {
  list: (params?: any) => apiClient.get('/api/tickets', { params }),
  get: (id: string) => apiClient.get(`/api/tickets/${id}`),
  create: (data: any) => apiClient.post('/api/tickets', data),
  update: (id: string, data: any) => apiClient.patch(`/api/tickets/${id}`, data),
  assign: (id: string, agentId: string) => apiClient.patch(`/api/tickets/${id}/assign`, { agent_id: agentId }),
  updateStatus: (id: string, status: string) => apiClient.patch(`/api/tickets/${id}/status`, { status }),
  submitCSAT: (id: string, score: number, comment?: string) => apiClient.patch(`/api/tickets/${id}/csat`, { score, comment }),
  getConversation: (id: string) => apiClient.get(`/api/tickets/${id}/conversation`),
  getBotConversation: (id: string) => apiClient.get(`/api/tickets/${id}/bot-conversation`),
  getConversationSummary: (id: string) => apiClient.get<{ summary: string }>(`/api/tickets/${id}/conversation-summary`),
  getAiSuggestions: (id: string) => apiClient.get<{ replies: string[] }>(`/api/tickets/${id}/ai-suggestions`),
  getEscalationHistory: (id: string) => apiClient.get(`/api/tickets/${id}/escalation-history`),
  addComment: (id: string, body: string, isInternal?: boolean) => apiClient.post(`/api/tickets/${id}/comments`, { body, is_internal: isInternal }),
};
