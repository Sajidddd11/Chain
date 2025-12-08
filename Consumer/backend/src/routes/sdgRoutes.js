import express from 'express';
import { calculateSDGScore, getSDGHistory } from '../controllers/sdgController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Calculate current SDG score
router.get('/score', authenticate, calculateSDGScore);

// Get SDG score history
router.get('/history', authenticate, getSDGHistory);

export default router;
