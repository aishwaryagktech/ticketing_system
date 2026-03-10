import { create } from 'zustand';

interface TicketState {
  tickets: any[];
  selectedTicket: any | null;
  filters: Record<string, any>;
  setTickets: (tickets: any[]) => void;
  selectTicket: (ticket: any) => void;
  setFilters: (filters: Record<string, any>) => void;
}

export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  selectedTicket: null,
  filters: {},
  setTickets: (tickets) => set({ tickets }),
  selectTicket: (ticket) => set({ selectedTicket: ticket }),
  setFilters: (filters) => set({ filters }),
}));
