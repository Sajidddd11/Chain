import express from 'express';
import { authenticate as authMiddleware } from '../middleware/authMiddleware.js';
import controller from '../controllers/donationController.js';

const router = express.Router();

router.post('/', authMiddleware, controller.createDonation);
router.get('/', controller.listDonations);
router.get('/:id', controller.getDonation);
router.delete('/:id', authMiddleware, controller.deleteDonation);
router.post('/:id/request', authMiddleware, controller.createRequest);
router.get('/:id/requests', authMiddleware, controller.listRequestsForDonation);
router.post('/requests/:id/accept', authMiddleware, controller.acceptRequest);
router.get('/requests/my', authMiddleware, controller.getMyRequests);

export default router;
