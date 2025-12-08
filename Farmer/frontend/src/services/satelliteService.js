import api from './api';

/**
 * Analyze field based on 4 corner coordinates
 * @param {Array} coordinates - Array of 4 [longitude, latitude] pairs
 * @param {string} dateRangeType - Type of date range ('latest' or 'custom')
 * @param {number} numDays - Number of days to look back
 * @returns {Promise} Analysis results
 */
export const analyzeField = async (coordinates, dateRangeType = 'latest', numDays = 30) => {
  try {
    const response = await api.post('/satellite/analyze-field', {
      coordinates,
      date_range_type: dateRangeType,
      num_days: numDays
    });
    return response.data;
  } catch (error) {
    console.error('Field analysis error:', error);
    throw error.response?.data || error;
  }
};

/**
 * Get saved field analysis for current user
 * @returns {Promise} Saved field analysis
 */
export const getSavedFieldAnalysis = async () => {
  try {
    const response = await api.get('/satellite/saved-analysis');
    return response.data;
  } catch (error) {
    console.error('Get saved field analysis error:', error);
    throw error.response?.data || error;
  }
};

/**
 * Save or update field analysis to database
 * @param {Array} coordinates - Array of 4 [longitude, latitude] pairs
 * @param {Object} analysisResult - Complete analysis result from API
 * @param {Object} imageryDate - Imagery date information
 * @returns {Promise} Save confirmation
 */
export const saveFieldAnalysis = async (coordinates, analysisResult, imageryDate) => {
  try {
    const response = await api.post('/satellite/save-analysis', {
      coordinates,
      analysisResult,
      imageryDate
    });
    return response.data;
  } catch (error) {
    console.error('Save field analysis error:', error);
    throw error.response?.data || error;
  }
};

/**
 * Clear saved field analysis
 * @returns {Promise} Clear confirmation
 */
export const clearFieldAnalysis = async () => {
  try {
    const response = await api.delete('/satellite/clear-analysis');
    return response.data;
  } catch (error) {
    console.error('Clear field analysis error:', error);
    throw error.response?.data || error;
  }
};


