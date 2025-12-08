import { Router } from 'express';
import { suggestRecipes } from '../controllers/recipeController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/suggest', authenticate, suggestRecipes);

export default router;