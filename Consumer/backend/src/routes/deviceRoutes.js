import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { authenticateApiKey } from '../middleware/apiKeyAuth.js';
import {
  registerDevice,
  listDevices,
  removeDevice,
  checkUsageToday,
} from '../controllers/deviceController.js';

const router = express.Router();

// User-facing routes (require JWT)
router.post('/register', authenticate, registerDevice);
router.get('/', authenticate, listDevices);
router.delete('/:id', authenticate, removeDevice);

// Device-facing routes (require API key)
router.get('/check-usage', authenticateApiKey, checkUsageToday);

export default router;

