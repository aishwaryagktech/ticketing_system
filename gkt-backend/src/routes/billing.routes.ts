import { Router } from 'express';
import * as billingController from '../controllers/billing.controller';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

// Public — no auth required (used by the landing page pricing page)
router.get('/plans/public', billingController.listPlans);

// List active plans — allowed for any authenticated user (e.g. onboarding)
router.get('/plans', auth, billingController.listPlans);

// Rest of billing routes require tenant_admin or super_admin
router.use(auth);
router.use(rbac('tenant_admin', 'super_admin'));
router.get('/subscription', billingController.getSubscription);
router.post('/subscribe', billingController.subscribe);
router.post('/verify-payment', billingController.verifyPayment);
router.patch('/subscription', billingController.updateSubscription);
router.get('/invoices', billingController.listInvoices);
router.get('/invoices/:payment_id', billingController.getInvoice);

export default router;
