import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from './env';

let io: Server;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, env.WIDGET_URL],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join rooms based on auth payload
    socket.on('join:product', (productId: string) => {
      socket.join(`product:${productId}`);
    });

    socket.on('join:agent', (agentId: string) => {
      socket.join(`agent:${agentId}`);
    });

    socket.on('join:ticket', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('join:admin', (productId: string) => {
      socket.join(`admin:${productId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialised — call initSocketServer first');
  }
  return io;
}
