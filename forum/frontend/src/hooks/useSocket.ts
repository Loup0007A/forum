import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuth';

let socket: Socket | null = null;

export function useSocket() {
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token || socket?.connected) return;

    socket = io('/', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => console.log('Socket connecté'));
    socket.on('disconnect', () => console.log('Socket déconnecté'));
    socket.on('connect_error', (err) => console.error('Socket erreur:', err.message));

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [token]);

  return socket;
}

export function getSocket() { return socket; }
