import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicket);
router.get('/:id/conversation', ticketController.getTicketConversation);
router.get('/:id/conversation-summary', ticketController.getConversationSummary);
router.get('/:id/escalation-history', ticketController.getTicketEscalationHistory);
router.get('/:id/ai-suggestions', ticketController.suggestReplies);
router.post('/', ticketController.createTicket);
router.patch('/:id', ticketController.updateTicket);
router.patch('/:id/assign', ticketController.assignTicket);
router.patch('/:id/status', ticketController.updateStatus);
router.patch('/:id/csat', ticketController.submitCSAT);

export default router;
