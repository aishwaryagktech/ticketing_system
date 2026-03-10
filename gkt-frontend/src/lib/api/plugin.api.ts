import apiClient from './client';

export const pluginApi = {
  getEmbedCodes: () => apiClient.get('/api/plugin/codes'),
  getConfig: () => apiClient.get('/api/plugin/config'),
  updateConfig: (data: any) => apiClient.patch('/api/plugin/config', data),
};
