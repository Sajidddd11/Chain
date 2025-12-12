import express from 'express';
import { authenticate as authMiddleware } from '../middleware/authMiddleware.js';
import { checkUsageLimit } from '../middleware/usageLimitMiddleware.js';
import controller from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/message', authMiddleware, checkUsageLimit('ai_chef', 5), controller.sendMessage);
router.get('/history', authMiddleware, controller.getHistory);

export default router;

