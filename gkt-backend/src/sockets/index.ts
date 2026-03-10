import { registerTicketSockets } from './ticket.socket';
import { registerSLASockets } from './sla.socket';
import { registerNotificationSockets } from './notification.socket';
import { Server } from 'socket.io';

export function registerSocketNamespaces(io: Server): void {
  registerTicketSockets(io);
  registerSLASockets(io);
  registerNotificationSockets(io);
  console.log('✅ Socket namespaces registered');
}
