import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicket);
router.post('/', ticketController.createTicket);
router.patch('/:id', ticketController.updateTicket);
router.patch('/:id/assign', ticketController.assignTicket);
router.patch('/:id/status', ticketController.updateStatus);
router.patch('/:id/csat', ticketController.submitCSAT);

export default router;
