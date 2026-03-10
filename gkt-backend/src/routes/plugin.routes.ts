import { Router } from 'express';
import * as pluginController from '../controllers/plugin.controller';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

router.use(auth);
router.use(rbac('tenant_admin', 'super_admin'));

router.get('/codes', pluginController.getEmbedCodes);
router.get('/config', pluginController.getPluginConfig);
router.patch('/config', pluginController.updatePluginConfig);

export default router;
