import { Router } from 'express';
import { subscribe, unsubscribe, getSubscriptionStatus, handleSubscriptionNotification, validateWebhook, userSubscription, sendSubscription, getBaseSize, queryBase, getSubscriberChargingInfo, sendNotification } from '../controllers/subscriptionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { checkUsageLimit } from '../middleware/usageLimitMiddleware.js';

const router = Router();

// Public webhook endpoint (no authentication required - AppLink will call this)
// Support GET for validation and POST for notifications
router.get('/notify', validateWebhook);
router.post('/notify', handleSubscriptionNotification);
router.options('/notify', (req, res) => {
  // Handle CORS preflight
  res.status(200).end();
});

// AppLink API endpoints (according to documentation)
router.post('/userSubscription', userSubscription);
router.post('/send', sendSubscription);
router.post('/baseSize', getBaseSize);
router.post('/query-base', queryBase);
router.post('/getSubscriberChargingInfo', getSubscriberChargingInfo);
router.post('/notify-subscriber', authenticate, checkUsageLimit('sms', 5), sendNotification);

// Protected endpoints (require authentication)
router.get('/status', authenticate, getSubscriptionStatus);
router.post('/subscribe', authenticate, subscribe);
router.post('/unsubscribe', authenticate, unsubscribe);

export default router;
