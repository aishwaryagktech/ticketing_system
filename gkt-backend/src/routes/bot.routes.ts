import { Router } from 'express';
import * as botController from '../controllers/bot.controller';

const router = Router();

router.get('/welcome-message', botController.welcomeMessage);
router.get('/conversation', botController.getBotConversation);
router.post('/chat', botController.chat);
router.post('/l1/chat', botController.chatL1);
router.post('/handoff', botController.handoff);
router.post('/voice-token', botController.getVoiceToken);
router.post('/voice-handoff', botController.voiceHandoff);
router.post('/describe-image', botController.describeImage);

export default router;
