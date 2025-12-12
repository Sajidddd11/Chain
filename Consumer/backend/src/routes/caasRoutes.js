import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
    requestPremiumOTP,
    verifyPremiumOTP,
    handleChargingNotification,
    getSubscriberBalance,
} from '../controllers/caasController.js';

const router = Router();

// Public webhook endpoint (AppLink calls this)
router.post('/charging-notification', handleChargingNotification);
router.options('/charging-notification', (req, res) => res.status(200).end());

// Protected endpoints (require authentication)
router.post('/request-otp', authenticate, requestPremiumOTP);
router.post('/verify-otp', authenticate, verifyPremiumOTP);
router.get('/balance', authenticate, getSubscriberBalance);

export default router;
