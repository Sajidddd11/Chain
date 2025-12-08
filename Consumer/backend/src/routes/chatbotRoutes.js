import express from 'express';
import { authenticate as authMiddleware } from '../middleware/authMiddleware.js';
import controller from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/message', authMiddleware, controller.sendMessage);
router.get('/history', authMiddleware, controller.getHistory);

export default router;

