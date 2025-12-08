import express from 'express';
import { analyzeNutrientGaps } from '../controllers/nutritionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Analyze nutrient gaps
router.get('/analyze', authenticate, analyzeNutrientGaps);

export default router;
