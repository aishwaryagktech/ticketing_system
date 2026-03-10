'use client';
// TODO: Implement notifications hook using Socket.io events
export function useNotifications() {
  return { notifications: [], unreadCount: 0, markRead: async (_id: string) => {} };
}
