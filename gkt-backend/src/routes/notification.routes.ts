import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.get('/', notificationController.listNotifications);
router.patch('/:id/read', notificationController.markRead);
router.patch('/read-all', notificationController.markAllRead);

export default router;
