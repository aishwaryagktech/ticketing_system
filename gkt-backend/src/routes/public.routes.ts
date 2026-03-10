import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import { apiKeyAuth } from '../middleware/apiKey';

const router = Router();

router.use(apiKeyAuth);

router.post('/tickets', ticketController.createTicket);
router.get('/tickets/:id', ticketController.getTicket);
router.patch('/tickets/:id/status', ticketController.updateStatus);

export default router;
