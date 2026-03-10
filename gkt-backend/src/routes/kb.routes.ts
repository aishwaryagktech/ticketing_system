import { Router } from 'express';
import * as kbController from '../controllers/kb.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.get('/search', kbController.search);
router.get('/suggest', kbController.suggest);

router.use(auth);

router.get('/articles', kbController.listArticles);
router.get('/articles/:id', kbController.getArticle);
router.post('/articles', kbController.createArticle);
router.patch('/articles/:id', kbController.updateArticle);
router.delete('/articles/:id', kbController.deleteArticle);

export default router;
