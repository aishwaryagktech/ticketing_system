'use client';
import { useState, useEffect, useCallback } from 'react';
import { ticketApi } from '@/lib/api/ticket.api';

export function useTickets(params?: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ticketApi.list(params);
      setTickets(data.data || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return { tickets, loading, refetch: fetchTickets };
}
