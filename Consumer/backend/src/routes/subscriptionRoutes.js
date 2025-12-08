import { Router } from 'express';
import { subscribe, unsubscribe, getSubscriptionStatus, handleSubscriptionNotification, validateWebhook } from '../controllers/subscriptionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Public webhook endpoint (no authentication required - AppLink will call this)
// Support GET for validation and POST for notifications
router.get('/notify', validateWebhook);
router.post('/notify', handleSubscriptionNotification);
router.options('/notify', (req, res) => {
  // Handle CORS preflight
  res.status(200).end();
});

// Protected endpoints (require authentication)
router.get('/status', authenticate, getSubscriptionStatus);
router.post('/subscribe', authenticate, subscribe);
router.post('/unsubscribe', authenticate, unsubscribe);

export default router;
