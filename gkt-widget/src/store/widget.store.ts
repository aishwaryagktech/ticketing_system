import { create } from 'zustand';

interface Message { id: string; body: string; authorType: string; authorName: string; timestamp: Date; }

interface WidgetState {
  isOpen: boolean;
  messages: Message[];
  sessionId: string | null;
  toggleOpen: () => void;
  addMessage: (msg: Message) => void;
  setSessionId: (id: string) => void;
  clearChat: () => void;
}

export const useWidgetStore = create<WidgetState>((set) => ({
  isOpen: false,
  messages: [],
  sessionId: null,
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSessionId: (id) => set({ sessionId: id }),
  clearChat: () => set({ messages: [], sessionId: null }),
}));
