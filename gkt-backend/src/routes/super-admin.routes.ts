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

// Tenant products (all tenants, for dashboard)
router.get('/tenant-products', superAdminController.listTenantProducts);
router.get('/tenant-products/stats', superAdminController.getTenantProductStats);

// Tickets (all tickets, for dashboard)
router.get('/tickets', superAdminController.listTickets);
router.get('/tickets/stats', superAdminController.getTicketStats);

export default router;
