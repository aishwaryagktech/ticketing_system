import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.get('/:id/comments', commentController.listComments);
router.post('/:id/comments', commentController.createComment);

export default router;
