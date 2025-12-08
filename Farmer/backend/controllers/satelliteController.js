const axios = require('axios');
const supabase = require('../config/database');

const SATELLITE_API_URL = process.env.SATELLITE_API_URL || 'http://localhost:8000/api';

/**
 * Analyze field based on 4 corner coordinates
 * Acts as a proxy to the satellite analysis API
 */
exports.analyzeField = async (req, res) => {
  try {
    const { coordinates, date_range_type = 'latest', num_days = 30 } = req.body;

    // Validate coordinates
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 4) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Please provide exactly 4 coordinate pairs [longitude, latitude]'
      });
    }

    // Validate each coordinate pair
    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i];
      if (!Array.isArray(coord) || coord.length !== 2) {
        return res.status(400).json({
          error: 'Invalid coordinate format',
          message: `Coordinate ${i + 1} must be an array of [longitude, latitude]`
        });
      }

      const [lng, lat] = coord;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        return res.status(400).json({
          error: 'Invalid coordinate values',
          message: `Coordinate ${i + 1} must contain numeric values`
        });
      }

      // Basic range validation
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return res.status(400).json({
          error: 'Coordinate out of range',
          message: `Coordinate ${i + 1} is out of valid range (lng: -180 to 180, lat: -90 to 90)`
        });
      }
    }

    console.log('Analyzing field with coordinates:', coordinates);

    // Forward request to satellite analysis API
    const response = await axios.post(
      `${SATELLITE_API_URL}/analyze-field`,
      {
        coordinates,
        date_range_type,
        num_days
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout for satellite data processing
      }
    );

    // Return the analysis results
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Field analysis error:', error.message);

    if (error.response) {
      // Error from satellite API
      return res.status(error.response.status).json({
        error: 'Satellite API Error',
        message: error.response.data.detail || error.response.data.message || 'Failed to analyze field',
        details: error.response.data
      });
    } else if (error.request) {
      // Network error
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Unable to connect to satellite analysis service. Please try again later.'
      });
    } else {
      // Other errors
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }
};

/**
 * Get saved field analysis for the current user
 */
exports.getSavedFieldAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the most recent active field analysis for this user
    const { data: fieldAnalysis, error } = await supabase
      .from('field_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve saved field analysis'
      });
    }

    if (!fieldAnalysis) {
      return res.json({
        success: true,
        data: null,
        message: 'No saved field analysis found'
      });
    }

    res.json({
      success: true,
      data: fieldAnalysis
    });

  } catch (error) {
    console.error('Get saved field analysis error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to retrieve saved field analysis'
    });
  }
};

/**
 * Save or update field analysis to database
 */
exports.saveFieldAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coordinates, analysisResult, imageryDate } = req.body;

    // Validate coordinates
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 4) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Please provide exactly 4 coordinate pairs'
      });
    }

    // Extract key metrics from analysis result for easy querying
    const healthStatus = analysisResult?.report?.health_assessment?.status || null;
    const ndviValue = analysisResult?.report?.health_assessment?.ndvi_value || null;
    const waterStressLevel = analysisResult?.report?.water_status?.water_stress_level || null;
    
    // Extract NDVI statistics from raw_metrics (actual API structure)
    const ndviRaw = analysisResult?.report?.raw_metrics?.NDVI || {};
    const ndviMean = ndviRaw.mean || null;
    const ndviStd = ndviRaw.stdDev || null;
    
    // Extract NDMI statistics from raw_metrics
    const ndmiRaw = analysisResult?.report?.raw_metrics?.NDMI || {};
    const ndmiValue = ndmiRaw.mean || null;
    const ndmiMean = ndmiRaw.mean || null;
    const ndmiStd = ndmiRaw.stdDev || null;
    
    // Extract EVI statistics from raw_metrics
    const eviRaw = analysisResult?.report?.raw_metrics?.EVI || {};
    const eviValue = eviRaw.mean || null;
    const eviMean = eviRaw.mean || null;
    const eviStd = eviRaw.stdDev || null;
    
    // Extract water and irrigation info
    const irrigationRecommendation = analysisResult?.report?.water_status?.recommended_action || null;
    const soilMoistureStatus = analysisResult?.report?.water_status?.water_stress_level || null;
    
    // Extract nutrient status as recommendation
    const nutrientCondition = analysisResult?.report?.nutrient_status?.condition || null;
    const nutrientRecommendation = analysisResult?.report?.nutrient_status?.recommendation || null;
    
    // Extract visualization URLs
    const visualizations = analysisResult?.visualizations || {};
    const rgbImageUrl = visualizations.rgb || null;
    const ndviImageUrl = visualizations.ndvi || null;
    const ndmiImageUrl = visualizations.ndmi || null;
    const ndwiImageUrl = visualizations.ndwi || null;
    const ndreImageUrl = visualizations.ndre || null;
    const eviImageUrl = visualizations.evi || null;
    
    // Build recommendations array from various parts of the response
    const recommendations = [];
    if (irrigationRecommendation) recommendations.push(irrigationRecommendation);
    if (nutrientRecommendation) recommendations.push(nutrientRecommendation);
    if (nutrientCondition) recommendations.push(`Nutrient Status: ${nutrientCondition}`);
    
    const recommendationsJson = recommendations.length > 0 ? recommendations : null;

    // Calculate next scheduled analysis (5 days from now)
    const nextScheduledAnalysis = new Date();
    nextScheduledAnalysis.setDate(nextScheduledAnalysis.getDate() + 5);

    // Check if user already has an active field analysis
    const { data: existingAnalysis } = await supabase
      .from('field_analyses')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    let result;
    
    if (existingAnalysis) {
      // Update existing analysis
      const { data, error } = await supabase
        .from('field_analyses')
        .update({
          field_coordinates: coordinates,
          imagery_date: imageryDate,
          analysis_result: analysisResult, // Complete raw data
          
          // Key metrics
          health_status: healthStatus,
          ndvi_value: ndviValue,
          ndvi_mean: ndviMean,
          ndvi_std: ndviStd,
          
          ndmi_value: ndmiValue,
          ndmi_mean: ndmiMean,
          
          evi_value: eviValue,
          evi_mean: eviMean,
          
          water_stress_level: waterStressLevel,
          irrigation_recommendation: irrigationRecommendation,
          soil_moisture_status: soilMoistureStatus,
          
          // Visualization URLs
          rgb_image_url: rgbImageUrl,
          ndvi_image_url: ndviImageUrl,
          ndmi_image_url: ndmiImageUrl,
          ndwi_image_url: ndwiImageUrl,
          ndre_image_url: ndreImageUrl,
          evi_image_url: eviImageUrl,
          
          recommendations: recommendationsJson,
          
          last_analysis_at: new Date().toISOString(),
          next_scheduled_analysis_at: nextScheduledAnalysis.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAnalysis.id)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to update field analysis'
        });
      }

      result = data;
    } else {
      // Insert new analysis
      const { data, error } = await supabase
        .from('field_analyses')
        .insert([{
          user_id: userId,
          field_coordinates: coordinates,
          imagery_date: imageryDate,
          analysis_result: analysisResult, // Complete raw data
          
          // Key metrics
          health_status: healthStatus,
          ndvi_value: ndviValue,
          ndvi_mean: ndviMean,
          ndvi_std: ndviStd,
          
          ndmi_value: ndmiValue,
          ndmi_mean: ndmiMean,
          
          evi_value: eviValue,
          evi_mean: eviMean,
          
          water_stress_level: waterStressLevel,
          irrigation_recommendation: irrigationRecommendation,
          soil_moisture_status: soilMoistureStatus,
          
          // Visualization URLs
          rgb_image_url: rgbImageUrl,
          ndvi_image_url: ndviImageUrl,
          ndmi_image_url: ndmiImageUrl,
          ndwi_image_url: ndwiImageUrl,
          ndre_image_url: ndreImageUrl,
          evi_image_url: eviImageUrl,
          
          recommendations: recommendationsJson,
          
          last_analysis_at: new Date().toISOString(),
          next_scheduled_analysis_at: nextScheduledAnalysis.toISOString(),
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to save field analysis'
        });
      }

      result = data;
    }

    res.json({
      success: true,
      message: 'Field analysis saved successfully',
      data: result
    });

  } catch (error) {
    console.error('Save field analysis error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to save field analysis'
    });
  }
};

/**
 * Clear/delete saved field analysis
 */
exports.clearFieldAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;

    // Mark all field analyses as inactive for this user
    const { error } = await supabase
      .from('field_analyses')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to clear field analysis'
      });
    }

    res.json({
      success: true,
      message: 'Field analysis cleared successfully'
    });

  } catch (error) {
    console.error('Clear field analysis error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to clear field analysis'
    });
  }
};


