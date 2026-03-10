'use client';
import { useEffect, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';

export function useSocket(token?: string): Socket | null {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (token) {
      socketRef.current = connectSocket(token);
    }
    return () => { disconnectSocket(); };
  }, [token]);

  return socketRef.current;
}
