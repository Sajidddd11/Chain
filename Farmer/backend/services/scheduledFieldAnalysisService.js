const cron = require('node-cron');
const axios = require('axios');
const supabase = require('../config/database');

const SATELLITE_API_URL = process.env.SATELLITE_API_URL || 'http://localhost:8000/api';

class ScheduledFieldAnalysisService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start the scheduled field analysis cron job
   * Runs every day at 2 AM to check for fields that need analysis
   */
  startScheduledAnalysis() {
    if (this.isRunning) {
      console.log('⚠️  Scheduled field analysis is already running');
      return;
    }

    // Schedule to run every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🛰️  Running scheduled field analysis check...');
      await this.checkAndAnalyzeFields();
    });

    this.isRunning = true;
    console.log('✅ Scheduled field analysis service started (runs daily at 2 AM)');
  }

  /**
   * Check for fields that need analysis and process them
   */
  async checkAndAnalyzeFields() {
    try {
      const now = new Date();
      
      // Get all active field analyses that are due for refresh
      const { data: fieldsToAnalyze, error } = await supabase
        .from('field_analyses')
        .select('id, user_id, field_coordinates')
        .eq('is_active', true)
        .lte('next_scheduled_analysis_at', now.toISOString());

      if (error) {
        console.error('❌ Error fetching fields for analysis:', error);
        return;
      }

      if (!fieldsToAnalyze || fieldsToAnalyze.length === 0) {
        console.log('ℹ️  No fields due for scheduled analysis');
        return;
      }

      console.log(`📋 Found ${fieldsToAnalyze.length} field(s) due for analysis`);

      // Process each field
      for (const field of fieldsToAnalyze) {
        await this.analyzeAndUpdateField(field);
      }

      console.log('✅ Scheduled field analysis completed');
    } catch (error) {
      console.error('❌ Error in checkAndAnalyzeFields:', error);
    }
  }

  /**
   * Analyze a single field and update the database
   */
  async analyzeAndUpdateField(field) {
    try {
      console.log(`🔄 Analyzing field ${field.id} for user ${field.user_id}`);

      // Call satellite API to analyze the field
      const response = await axios.post(
        `${SATELLITE_API_URL}/analyze-field`,
        {
          coordinates: field.field_coordinates,
          date_range_type: 'latest',
          num_days: 30
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      if (response.data && response.data.success !== false) {
        const analysisData = response.data;
        
        // Extract all key metrics and raw parameters
        const healthStatus = analysisData.report?.health_assessment?.status || null;
        const ndviValue = analysisData.report?.health_assessment?.ndvi_value || null;
        const waterStressLevel = analysisData.report?.water_status?.water_stress_level || null;
        
        // Extract NDVI statistics from raw_metrics (actual API structure)
        const ndviRaw = analysisData.report?.raw_metrics?.NDVI || {};
        const ndviMean = ndviRaw.mean || null;
        const ndviStd = ndviRaw.stdDev || null;
        
        // Extract NDMI statistics from raw_metrics
        const ndmiRaw = analysisData.report?.raw_metrics?.NDMI || {};
        const ndmiValue = ndmiRaw.mean || null;
        const ndmiMean = ndmiRaw.mean || null;
        const ndmiStd = ndmiRaw.stdDev || null;
        
        // Extract EVI statistics from raw_metrics
        const eviRaw = analysisData.report?.raw_metrics?.EVI || {};
        const eviValue = eviRaw.mean || null;
        const eviMean = eviRaw.mean || null;
        const eviStd = eviRaw.stdDev || null;
        
        // Extract water and irrigation info
        const irrigationRecommendation = analysisData.report?.water_status?.recommended_action || null;
        const soilMoistureStatus = analysisData.report?.water_status?.water_stress_level || null;
        
        // Extract nutrient status as recommendation
        const nutrientCondition = analysisData.report?.nutrient_status?.condition || null;
        const nutrientRecommendation = analysisData.report?.nutrient_status?.recommendation || null;
        
        // Extract visualization URLs
        const visualizations = analysisData.visualizations || {};
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

        // Update field analysis in database with all raw parameters
        const { error: updateError } = await supabase
          .from('field_analyses')
          .update({
            imagery_date: analysisData.imagery_date,
            analysis_result: analysisData, // Complete raw data
            
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
          .eq('id', field.id);

        if (updateError) {
          console.error(`❌ Error updating field ${field.id}:`, updateError);
        } else {
          console.log(`✅ Successfully updated field ${field.id}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error analyzing field ${field.id}:`, error.message);
      
      // If analysis failed, schedule retry in 1 day
      const retryDate = new Date();
      retryDate.setDate(retryDate.getDate() + 1);
      
      await supabase
        .from('field_analyses')
        .update({
          next_scheduled_analysis_at: retryDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', field.id);
    }
  }

  /**
   * Manually trigger analysis for all due fields (for testing)
   */
  async triggerManualAnalysis() {
    console.log('🔧 Manually triggering field analysis...');
    await this.checkAndAnalyzeFields();
  }
}

// Create singleton instance
const scheduledFieldAnalysisService = new ScheduledFieldAnalysisService();

module.exports = scheduledFieldAnalysisService;

