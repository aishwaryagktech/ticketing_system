import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.get('/summary', analyticsController.getSummary);
router.get('/tickets', analyticsController.getTicketAnalytics);
router.get('/agents', analyticsController.getAgentAnalytics);
router.get('/sla', analyticsController.getSLAAnalytics);
router.get('/ai-usage', analyticsController.getAIUsage);
router.get('/kb', analyticsController.getKBAnalytics);
router.get('/export', analyticsController.exportReport);

export default router;
