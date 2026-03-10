import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller';

const router = Router();

router.post('/email', webhookController.handleEmailWebhook);
router.post('/stripe', webhookController.handleStripeWebhook);
router.post('/razorpay', webhookController.handleRazorpayWebhook);

export default router;
