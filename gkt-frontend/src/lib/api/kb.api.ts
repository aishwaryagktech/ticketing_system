import apiClient from './client';

export const kbApi = {
  search: (query: string) => apiClient.get('/api/kb/search', { params: { q: query } }),
  suggest: (query: string) => apiClient.get('/api/kb/suggest', { params: { q: query } }),
  listArticles: (params?: any) => apiClient.get('/api/kb/articles', { params }),
  getArticle: (id: string) => apiClient.get(`/api/kb/articles/${id}`),
  createArticle: (data: any) => apiClient.post('/api/kb/articles', data),
  updateArticle: (id: string, data: any) => apiClient.patch(`/api/kb/articles/${id}`, data),
  deleteArticle: (id: string) => apiClient.delete(`/api/kb/articles/${id}`),
};
