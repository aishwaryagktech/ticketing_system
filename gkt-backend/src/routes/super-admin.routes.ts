import { Router } from 'express';
import * as superAdminController from '../controllers/super-admin.controller';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

router.use(auth);
router.use(rbac('super_admin'));

// Products
router.get('/products', superAdminController.listProducts);
router.post('/products', superAdminController.createProduct);
router.get('/products/:id', superAdminController.getProduct);
router.patch('/products/:id', superAdminController.updateProduct);

// Feature flags
router.get('/flags/:productId', superAdminController.getFeatureFlags);
router.patch('/flags/:productId', superAdminController.updateFeatureFlags);

// Billing
router.get('/billing/plans', superAdminController.listPlans);
router.post('/billing/plans', superAdminController.createPlan);
router.patch('/billing/plans/:id', superAdminController.updatePlan);
router.delete('/billing/plans/:id', superAdminController.deletePlan);

// Platform Analytics
router.get('/stats', superAdminController.getPlatformStats);

export default router;
