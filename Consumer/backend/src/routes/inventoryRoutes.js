import { Router } from 'express';
import {
  addInventoryItem,
  getInventorySummary,
  listInventory,
  removeInventoryItem,
  updateInventoryItem,
  updateMissingExpiryDates,
  getAlternatives,
} from '../controllers/inventoryController.js';
import { flexibleAuth } from '../middleware/flexibleAuth.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', flexibleAuth, listInventory);
router.post('/', authenticate, addInventoryItem);
router.post('/update-expiry-dates', authenticate, updateMissingExpiryDates);
router.get('/summary', flexibleAuth, getInventorySummary);
router.put('/:id', authenticate, updateInventoryItem);
router.delete('/:id', authenticate, removeInventoryItem);
router.get('/alternatives/:itemName', authenticate, getAlternatives);

export default router;

