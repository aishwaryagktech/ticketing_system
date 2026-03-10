import { Router } from 'express';
import * as productAdminController from '../controllers/product-admin.controller';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

router.use(auth);
router.use(rbac('tenant_admin', 'super_admin'));

// SLA
router.get('/sla', productAdminController.listSLAPolicies);
router.post('/sla', productAdminController.createSLAPolicy);
router.patch('/sla/:id', productAdminController.updateSLAPolicy);

// Escalation
router.get('/escalation', productAdminController.listEscalationRules);
router.post('/escalation', productAdminController.createEscalationRule);
router.patch('/escalation/:id', productAdminController.updateEscalationRule);

// Branding
router.get('/branding', productAdminController.getBranding);
router.patch('/branding', productAdminController.updateBranding);

// AI providers
router.get('/ai-providers', productAdminController.listAIProviders);
router.post('/ai-providers', productAdminController.createAIProvider);
router.patch('/ai-providers/:id', productAdminController.updateAIProvider);

// Tenants
router.get('/tenants', productAdminController.listTenants);
router.post('/tenants', productAdminController.createTenant);
router.patch('/tenants/:id', productAdminController.updateTenant);

export default router;
