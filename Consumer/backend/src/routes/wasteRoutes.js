import { Router } from 'express';
import {
  analyzeWaste,
  listWasteItems,
  fetchWasteEstimations,
  fetchAgrisenseStatus,
  updateAgrisenseToggle,
  listUserPickups,
  createPickupRequest,
  adminListPickups,
  adminUpdatePickup,
} from '../controllers/wasteController.js';
import { flexibleAuth } from '../middleware/flexibleAuth.js';
import { authenticate as authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', flexibleAuth, listWasteItems);
router.post('/analyze', flexibleAuth, analyzeWaste);
router.get('/estimations', flexibleAuth, fetchWasteEstimations);
router.get('/agrisense/status', flexibleAuth, fetchAgrisenseStatus);
router.post('/agrisense/toggle', flexibleAuth, updateAgrisenseToggle);
router.get('/pickups', flexibleAuth, listUserPickups);
router.post('/pickups/request', flexibleAuth, createPickupRequest);
router.get('/admin/pickups', authMiddleware, requireAdmin, adminListPickups);
router.post('/admin/pickups/:id/status', authMiddleware, requireAdmin, adminUpdatePickup);

export default router;


