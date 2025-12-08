import express from 'express';
import { authenticate as authMiddleware } from '../middleware/authMiddleware.js';
import controller from '../controllers/messageController.js';

const router = express.Router();

router.post('/', authMiddleware, controller.createMessage);
router.get('/conversations', authMiddleware, controller.getConversations);
router.get('/conversations/:id/messages', authMiddleware, controller.getMessages);
router.put('/conversations/:conversationId/read', authMiddleware, controller.markMessagesAsRead);

export default router;
