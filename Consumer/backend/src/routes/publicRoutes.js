import { Router } from 'express';
import {
  getProfileByPhone,
  addInventoryByPhone,
  logUsageByPhone,
} from '../controllers/publicAccessController.js';

const router = Router();

router.post('/profile', getProfileByPhone);
router.post('/inventory', addInventoryByPhone);
router.post('/inventory/use', logUsageByPhone);

export default router;


