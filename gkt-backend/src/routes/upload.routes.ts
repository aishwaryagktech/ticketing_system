import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.use(auth);

router.post('/', uploadController.uploadFile);

export default router;
