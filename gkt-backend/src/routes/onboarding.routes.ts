import { Router } from 'express';
import { auth } from '../middleware/auth';
import * as onboardingController from '../controllers/onboarding.controller';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(auth);

router.get('/', onboardingController.getOnboarding);
router.patch('/plan', onboardingController.setPlan);
router.patch('/step', onboardingController.updateStep);
router.get('/products', onboardingController.listTenantProducts);
router.post('/products', onboardingController.createTenantProduct);
router.get('/agents', onboardingController.listAgents);
router.post('/agents', onboardingController.inviteAgent);
router.put('/ticket-settings', onboardingController.upsertTicketSettings);
router.get('/sla', onboardingController.listSlaPolicies);
router.put('/sla', onboardingController.upsertSlaPolicies);
router.get('/escalation', onboardingController.listEscalationRules);
router.put('/escalation', onboardingController.upsertEscalationRules);
router.get('/channels', onboardingController.getChannelSettings);
router.put('/channels', onboardingController.upsertChannelSettings);
router.get('/branding', onboardingController.getBranding);
router.put('/branding', onboardingController.upsertBranding);
router.post('/kb/seed-rewire-starter', onboardingController.seedRewireStarterKb);
router.get('/kb/sources', onboardingController.listKbSources);
router.post('/kb/crawl', onboardingController.crawlKbSource);
router.get('/kb/sources/:id', onboardingController.getKbSource);
router.post('/kb/sources/:id/convert', onboardingController.convertKbSourceToArticle);
router.get('/kb/articles', onboardingController.listKbArticles);
router.delete('/kb/sources/:id', onboardingController.deleteKbSource);
router.delete('/kb/articles/:id', onboardingController.deleteKbArticle);
router.post('/kb/upload', upload.single('file'), onboardingController.uploadKbDocument);
router.get('/ai/models', onboardingController.listAvailableModels);
router.put('/ai/l0-model', onboardingController.setL0Model);

export default router;
