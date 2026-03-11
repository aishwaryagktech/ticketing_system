import { Router } from 'express';
import { listUserTickets, listTicketMessages, createTicketMessage } from '../controllers/widgetPublic.controller';

const router = Router();

// Public, widget-facing endpoints (scoped by tenant_id + user identity)
router.get('/tickets', listUserTickets);
router.get('/tickets/:id/messages', listTicketMessages);
router.post('/tickets/:id/messages', createTicketMessage);

export default router;

