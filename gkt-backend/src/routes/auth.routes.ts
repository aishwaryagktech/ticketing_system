import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { strictLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', strictLimiter, authController.register);
router.post('/login', strictLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;
