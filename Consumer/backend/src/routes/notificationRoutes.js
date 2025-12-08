import { Router } from 'express';
import { authenticate as authenticateJwt } from '../middleware/authMiddleware.js';
import { flexibleAuth } from '../middleware/flexibleAuth.js';
import {
  createDeviceNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToPushNotifications,
  getVapidPublicKey,
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', authenticateJwt, listNotifications);
router.post('/:id/read', authenticateJwt, markNotificationRead);
router.post('/mark-all-read', authenticateJwt, markAllNotificationsRead);
router.post('/device', flexibleAuth, createDeviceNotification);
router.post('/subscribe', authenticateJwt, subscribeToPushNotifications);
router.get('/vapid-public-key', getVapidPublicKey);

export default router;

