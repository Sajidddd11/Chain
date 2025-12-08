import { Router } from 'express';
import { getRecommendedResources, listResources } from '../controllers/resourceController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listResources);
router.get('/recommended', authenticate, getRecommendedResources);

export default router;

