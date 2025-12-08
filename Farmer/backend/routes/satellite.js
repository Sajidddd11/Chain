const express = require('express');
const router = express.Router();
const satelliteController = require('../controllers/satelliteController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   POST /api/satellite/analyze-field
 * @desc    Analyze field based on 4 corner coordinates
 * @access  Protected
 */
router.post('/analyze-field', authenticateToken, satelliteController.analyzeField);

/**
 * @route   GET /api/satellite/saved-analysis
 * @desc    Get saved field analysis for current user
 * @access  Protected
 */
router.get('/saved-analysis', authenticateToken, satelliteController.getSavedFieldAnalysis);

/**
 * @route   POST /api/satellite/save-analysis
 * @desc    Save or update field analysis to database
 * @access  Protected
 */
router.post('/save-analysis', authenticateToken, satelliteController.saveFieldAnalysis);

/**
 * @route   DELETE /api/satellite/clear-analysis
 * @desc    Clear saved field analysis
 * @access  Protected
 */
router.delete('/clear-analysis', authenticateToken, satelliteController.clearFieldAnalysis);

module.exports = router;

