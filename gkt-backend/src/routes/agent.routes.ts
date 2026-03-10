import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';

const router = Router();

router.use(auth);
router.use(rbac('tenant_admin', 'super_admin'));

router.get('/', agentController.listAgents);
router.post('/invite', agentController.inviteAgent);
router.patch('/:id', agentController.updateAgent);
router.patch('/:id/deactivate', agentController.deactivateAgent);

export default router;
