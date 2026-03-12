import { Router } from 'express';
import { auth } from '../middleware/auth';
import * as gmailController from '../controllers/gmail.controller';

const router = Router();

// Public routes — no JWT required (Google redirects here directly)
router.get('/oauth/connect', gmailController.oauthConnect);
router.get('/oauth/callback', gmailController.oauthCallback);

router.use(auth);
router.get('/oauth/start', gmailController.oauthStart);
router.post('/sync/tickets/:id', gmailController.syncTicketThread);

export default router;

