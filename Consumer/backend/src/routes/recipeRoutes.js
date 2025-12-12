import { Router } from 'express';
import { suggestRecipes } from '../controllers/recipeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { checkUsageLimit } from '../middleware/usageLimitMiddleware.js';

const router = Router();

router.post('/suggest', authenticate, checkUsageLimit('recipes', 5), suggestRecipes);

export default router;