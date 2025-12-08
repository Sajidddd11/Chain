const express = require('express');
const {
  enableWasteCollection,
  updateWasteData,
  getWasteData
} = require('../controllers/wasteController');

const router = express.Router();

/**
 * Enable waste collection for a farmer by phone number
 * POST /api/waste/enable
 * Body: { phone_number: string }
 */
router.post('/enable', enableWasteCollection);

/**
 * Update waste data for a farmer by phone number
 * POST /api/waste/update
 * Body: {
 *   phone_number: string,
 *   waste_name: string,
 *   amount: number,
 *   unit: string (kg|mon|quintal|ton)
 * }
 */
router.post('/update', updateWasteData);

/**
 * Get waste data for a farmer by phone number
 * POST /api/waste/get
 * Body: { phone_number: string }
 */
router.post('/get', getWasteData);

module.exports = router;

