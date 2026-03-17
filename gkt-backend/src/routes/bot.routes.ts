import { Router } from 'express';
import * as botController from '../controllers/bot.controller';

const router = Router();

router.get('/welcome-message', botController.welcomeMessage);
router.get('/conversation', botController.getBotConversation);
router.post('/chat', botController.chat);
router.post('/handoff', botController.handoff);
router.post('/voice-token', botController.getVoiceToken);
router.post('/voice-handoff', botController.voiceHandoff);

export default router;
