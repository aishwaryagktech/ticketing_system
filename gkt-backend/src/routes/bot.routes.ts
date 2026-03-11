import { Router } from 'express';
import * as botController from '../controllers/bot.controller';

const router = Router();

router.get('/welcome-message', botController.welcomeMessage);
router.post('/chat', botController.chat);
router.post('/handoff', botController.handoff);

export default router;
