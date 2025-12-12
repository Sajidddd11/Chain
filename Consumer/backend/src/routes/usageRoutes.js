import { Router } from 'express';
import { getUsageStats } from '../controllers/usageController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/stats', authenticate, getUsageStats);

export default router;