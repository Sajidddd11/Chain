import express from 'express';
import { getConsumptionPatterns, getHeatmapData } from '../controllers/analyticsController.js';
import { flexibleAuth } from '../middleware/flexibleAuth.js';
import { checkUsageLimit } from '../middleware/usageLimitMiddleware.js';

const router = express.Router();

// All analytics routes require authentication
router.use(flexibleAuth);

// Get consumption patterns and insights
router.get('/patterns', checkUsageLimit('analytics', 5), getConsumptionPatterns);

// Get heatmap data for visualization
router.get('/heatmap', getHeatmapData);

export default router;