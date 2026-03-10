import { Router } from 'express';
import * as botController from '../controllers/bot.controller';

const router = Router();

router.post('/chat', botController.chat);
router.post('/handoff', botController.handoff);

export default router;
