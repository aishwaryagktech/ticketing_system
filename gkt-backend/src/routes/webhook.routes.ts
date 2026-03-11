import { Router } from 'express';
import multer from 'multer';
import * as webhookController from '../controllers/webhook.controller';

const router = Router();
// SendGrid Inbound Parse sends multipart/form-data (text fields + optional file attachments)
const parseInboundForm = multer({ storage: multer.memoryStorage() }).any();

router.post('/email', parseInboundForm, webhookController.handleEmailWebhook);
router.post('/stripe', webhookController.handleStripeWebhook);
router.post('/razorpay', webhookController.handleRazorpayWebhook);

export default router;
