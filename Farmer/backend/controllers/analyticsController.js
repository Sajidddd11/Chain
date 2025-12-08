const { analyzeData } = require('../services/openaiService');
const { sendSMS, formatMobileNumber, isValidBangladeshiMobile } = require('../services/smsService');
const { createCriticalAlertCall } = require('../services/retellService');
const supabase = require('../config/database');
const axios = require('axios');

const CALL_ALERT_ENDPOINT = process.env.CALL_ALERT_ENDPOINT || 'https://speech-assistant-openai-realtime-api-defi.onrender.com/make-call';

/**
 * Get comprehensive farm analysis using OpenAI
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFarmAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user/farmer information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        full_name,
        mobile_number,
        crop_name,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        wants_call_alert,
        districts(name)
      `)
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.error('User query error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const farmer = {
      full_name: userData.full_name,
      crop_name: userData.crop_name,
      land_size_acres: userData.land_size_acres,
      latitude: userData.latitude,
      longitude: userData.longitude,
      location_address: userData.location_address,
      district_name: userData.districts?.name
    };
    
    // Get device information for this user
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    if (deviceError || !deviceData || deviceData.length === 0) {
      console.error('Device query error:', deviceError);
      return res.status(404).json({ error: 'No active device found for this user' });
    }
    
    const deviceId = deviceData[0].id;
    
    // Get latest sensor data
    const { data: sensorData, error: sensorError } = await supabase
      .from('current_sensor_data')
      .select(`
        moisture_level,
        ph_level,
        temperature,
        humidity,
        light_intensity,
        soil_conductivity,
        nitrogen_level,
        phosphorus_level,
        potassium_level,
        last_updated
      `)
      .eq('device_id', deviceId)
      .single();
    
    if (sensorError || !sensorData) {
      console.error('Sensor query error:', sensorError);
      return res.status(404).json({ error: 'No sensor data found for this device' });
    }
    
    // Get latest weather data from cache (specifically current weather)
    // Use same 30-minute cache expiration as weather controller
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('type', 'current')
      .eq('latitude', parseFloat(farmer.latitude).toFixed(4))
      .eq('longitude', parseFloat(farmer.longitude).toFixed(4))
      .gt('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let weatherInfo = {};
    
    if (weatherError || !weatherData) {
      console.warn('Weather data not found or expired, attempting to fetch fresh data');
      console.warn('Weather error:', weatherError);
      console.warn('Coordinates being searched:', parseFloat(farmer.latitude).toFixed(4), parseFloat(farmer.longitude).toFixed(4));
      console.warn('Cache expiration time:', thirtyMinutesAgo);
      
      // Try to fetch fresh weather data if cache is expired
      try {
        const axios = require('axios');
        const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
        const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';
        
        const response = await axios.get(`${WEATHER_API_URL}/weather`, {
          params: {
            lat: farmer.latitude,
            lon: farmer.longitude,
            appid: WEATHER_API_KEY,
            units: 'metric'
          }
        });
        
        // Cache the fresh response
        await supabase.from('weather_cache').insert({
          type: 'current',
          latitude: parseFloat(farmer.latitude).toFixed(4),
          longitude: parseFloat(farmer.longitude).toFixed(4),
          data: JSON.stringify(response.data)
        });
        
        // Extract the correct fields from fresh OpenWeatherMap data
        weatherInfo = {
          temperature: response.data.main?.temp || 25,
          humidity: response.data.main?.humidity || 60,
          rainfall: response.data.rain?.['1h'] || response.data.rain?.['3h'] || 0,
          forecast: response.data.weather?.[0]?.description || 'Based on current conditions'
        };
        
        console.log('Fresh weather data fetched and cached:', weatherInfo);
      } catch (fetchError) {
        console.error('Failed to fetch fresh weather data:', fetchError.message);
        weatherInfo = {
          temperature: 25,
          humidity: 60,
          rainfall: 0,
          forecast: 'No weather data available'
        };
      }
    } else {
      // Parse the cached weather data (it's stored as JSON string)
      const parsedWeatherData = typeof weatherData.data === 'string' 
        ? JSON.parse(weatherData.data) 
        : weatherData.data;
      
      console.log('Parsed weather data for OpenAI:', {
        original: parsedWeatherData.main,
        rainfall: parsedWeatherData.rain,
        weather: parsedWeatherData.weather?.[0]
      });
      
      // Extract the correct fields from OpenWeatherMap data structure
      weatherInfo = {
        temperature: parsedWeatherData.main?.temp || 25,
        humidity: parsedWeatherData.main?.humidity || 60,
        rainfall: parsedWeatherData.rain?.['1h'] || parsedWeatherData.rain?.['3h'] || 0,
        forecast: parsedWeatherData.weather?.[0]?.description || 'Based on current conditions'
      };
      
      console.log('Final weather info for OpenAI:', weatherInfo);
    }

    // Get saved optimal ranges for this farmer (if available)
    let optimalSettings = null;
    try {
      const { data: optimalData } = await supabase
        .from('farmer_optimal_settings')
        .select('optimal_json')
        .eq('user_id', userId)
        .single();
      optimalSettings = optimalData?.optimal_json || null;
    } catch (optimalErr) {
      console.warn('Optimal settings fetch error (analysis):', optimalErr.message);
    }

    // Get latest field analysis data (satellite/map analysis)
    let fieldAnalysis = null;
    try {
      const { data: fieldData, error: fieldError } = await supabase
        .from('field_analyses')
        .select(`
          health_status,
          ndvi_mean,
          ndvi_std,
          ndmi_mean,
          evi_mean,
          water_stress_level,
          soil_moisture_status,
          irrigation_recommendation,
          recommendations,
          last_analysis_at,
          imagery_date
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_analysis_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!fieldError && fieldData) {
        fieldAnalysis = {
          health_status: fieldData.health_status,
          vegetation_health: {
            ndvi_mean: fieldData.ndvi_mean,
            ndvi_std: fieldData.ndvi_std,
            evi_mean: fieldData.evi_mean
          },
          water_status: {
            water_stress_level: fieldData.water_stress_level,
            soil_moisture_status: fieldData.soil_moisture_status,
            ndmi_mean: fieldData.ndmi_mean
          },
          irrigation_recommendation: fieldData.irrigation_recommendation,
          recommendations: fieldData.recommendations,
          last_analysis_at: fieldData.last_analysis_at,
          imagery_date: fieldData.imagery_date
        };
        console.log('✅ Field analysis data retrieved for analytics');
      }
    } catch (fieldErr) {
      console.warn('Field analysis fetch error (analytics):', fieldErr.message);
    }

    // Prepare data for OpenAI analysis
    const analysisData = {
      farmer: {
        name: farmer.full_name,
        location: farmer.location_address || farmer.district_name || 'Unknown',
        landSize: farmer.land_size_acres || 'Unknown',
        coordinates: {
          latitude: farmer.latitude,
          longitude: farmer.longitude
        }
      },
      crop: {
        type: farmer.crop_name || 'Unknown',
        plantingDate: 'Unknown' // Could be added to user schema in future
      },
      weather: {
        temperature: weatherInfo.temperature,
        humidity: weatherInfo.humidity,
        rainfall: weatherInfo.rainfall,
        forecast: weatherInfo.forecast
      },
      disasterRisks: null,
      sensors: {
        soilMoisture: sensorData.moisture_level,
        soilPH: sensorData.ph_level,
        soilTemperature: sensorData.temperature,
        lightIntensity: sensorData.light_intensity,
        soilConductivity: sensorData.soil_conductivity,
        nutrients: {
          nitrogen: sensorData.nitrogen_level,
          phosphorus: sensorData.phosphorus_level,
          potassium: sensorData.potassium_level
        }
      },
      fieldAnalysis: fieldAnalysis,
      optimalRanges: optimalSettings,
      meta: {
        userId: userId
      }
    };
    
    console.log('===== ANALYTICS REQUEST =====');
    console.log(`User: ${farmer.full_name} (${userId})`);
    console.log(`Device: ${deviceId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('============================');
    
    // Send to OpenAI for analysis
    const analysis = await analyzeData(analysisData);
    
    // Handle critical alerts if action is required
    let alertRecord = null;
    if (analysis.actionRequired && analysis.message) {
      console.log('\n🚨 CRITICAL ALERT DETECTED! 🚨');
      console.log('Alert Message:', analysis.message);
      console.log('Farmer:', farmer.full_name);
      console.log('Mobile:', userData.mobile_number);
      
      try {
        // Determine alert type based on sensor data
        const alertType = determineAlertType(sensorData);
        
        // Store alert in database
        const { data: newAlert, error: alertError } = await supabase
          .from('farm_alerts')
          .insert([{
            user_id: userId,
            device_id: deviceId,
            alert_type: alertType,
            message_bangla: analysis.message,
            message_english: analysis.analysis,
            sensor_data: {
              moisture_level: sensorData.moisture_level,
              ph_level: sensorData.ph_level,
              temperature: sensorData.temperature,
              humidity: sensorData.humidity,
              timestamp: sensorData.last_updated
            }
          }])
          .select()
          .single();

        if (alertError) {
          console.error('Failed to store alert:', alertError);
        } else {
          alertRecord = newAlert;
          console.log('✅ Alert stored in database with ID:', newAlert.id);
        }

        // Send SMS if mobile number is valid
        if (isValidBangladeshiMobile(userData.mobile_number)) {
          const formattedNumber = formatMobileNumber(userData.mobile_number);
          console.log('📱 Sending SMS to:', formattedNumber);
          
          const smsResult = await sendSMS(formattedNumber, analysis.message);
          
          // Update alert record with SMS status
          if (alertRecord) {
            await supabase
              .from('farm_alerts')
              .update({
                is_sms_sent: smsResult.success,
                sms_sent_at: smsResult.success ? new Date().toISOString() : null,
                sms_response: smsResult
              })
              .eq('id', alertRecord.id);
          }

          if (smsResult.success) {
            console.log('✅ SMS sent successfully!');

            if (userData.wants_call_alert) {
              console.log('🔔 Call alerts enabled. Triggering phone call...');

              const completeFarmData = {
                farmer: {
                  id: userId,
                  name: userData.full_name,
                  location: userData.location_address || userData.districts?.name || 'Unknown',
                  landSize: userData.land_size_acres,
                  mobile: userData.mobile_number
                },
                crop: {
                  type: userData.crop_name || 'Unknown'
                },
                sensors: {
                  soilMoisture: sensorData.moisture_level,
                  soilPH: sensorData.ph_level,
                  soilTemperature: sensorData.temperature,
                  humidity: sensorData.humidity,
                  lightIntensity: sensorData.light_intensity,
                  soilConductivity: sensorData.soil_conductivity,
                  nutrients: {
                    nitrogen: sensorData.nitrogen_level,
                    phosphorus: sensorData.phosphorus_level,
                  potassium: sensorData.potassium_level
                  }
                },
                weather: {
                  temperature: weatherInfo.temperature || 25,
                  humidity: weatherInfo.humidity || 60,
                  rainfall: weatherInfo.rainfall || 0
                },
                alert: {
                  type: alertType
                },
                device: {
                  id: deviceId
                }
              };

              const callResponses = {};
              let callInitiated = false;

              // Existing Retell call flow (kept for backward compatibility)
              try {
                const voiceResult = await createCriticalAlertCall(
                  completeFarmData,
                  formattedNumber,
                  analysis.message
                );
                callResponses.retell = voiceResult;
                callInitiated = callInitiated || Boolean(voiceResult?.success);

                if (voiceResult?.success) {
                  console.log('✅ Voice call (Retell) initiated successfully!');
                  console.log('📞 Call ID:', voiceResult.callId);
                } else {
                  console.error('❌ Voice call (Retell) failed:', voiceResult?.error);
                }
              } catch (voiceErr) {
                console.error('❌ Voice call (Retell) error:', voiceErr.message);
                callResponses.retell = {
                  success: false,
                  error: voiceErr.message
                };
              }

              // New external call endpoint
              try {
                const externalResponse = await axios.post(
                  CALL_ALERT_ENDPOINT,
                  {
                    phone_number: formattedNumber,
                    reason: analysis.message
                  },
                  { timeout: 10000 }
                );
                callResponses.external = {
                  success: true,
                  status: externalResponse.status,
                  data: externalResponse.data
                };
                callInitiated = true;
                console.log('✅ External call alert triggered successfully!');
              } catch (externalErr) {
                const errorPayload = externalErr.response?.data || externalErr.message;
                callResponses.external = {
                  success: false,
                  error: errorPayload
                };
                console.error('❌ External call alert failed:', errorPayload);
              }

              if (alertRecord) {
                await supabase
                  .from('farm_alerts')
                  .update({
                    voice_call_initiated: callInitiated,
                    voice_call_status: callInitiated ? 'initiated' : 'failed',
                    voice_call_id: callResponses.retell?.callId || null,
                    voice_call_response: callResponses,
                    voice_call_completed_at: callInitiated ? new Date().toISOString() : null
                  })
                  .eq('id', alertRecord.id);
              }
            } else {
              console.log('🔕 Call alerts disabled for this farmer. Skipping phone call.');
            }
          } else {
            console.error('❌ SMS sending failed:', smsResult.error);
          }
        } else {
          console.warn('⚠️ Invalid mobile number format:', userData.mobile_number);
        }

      } catch (alertError) {
        console.error('Error handling alert:', alertError);
      }
    }
    
    // Return the analysis results
    return res.status(200).json({
      success: true,
      data: {
        analysis: analysis,
        alert: alertRecord,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Farm analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze farm data',
      message: error.message 
    });
  }
};

/**
 * Get comprehensive farm data for chatbot with OpenAI analysis
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getChatbotFarmData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get user/farmer information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        full_name,
        mobile_number,
        crop_name,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        districts(name)
      `)
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.error('User query error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const farmer = {
      full_name: userData.full_name,
      crop_name: userData.crop_name,
      land_size_acres: userData.land_size_acres,
      latitude: userData.latitude,
      longitude: userData.longitude,
      location_address: userData.location_address,
      district_name: userData.districts?.name
    };
    
    // Get device information for this user
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    let sensorData = null;
    if (deviceData && deviceData.length > 0) {
      const deviceId = deviceData[0].id;
      
      // Get latest sensor data
      const { data: sensors, error: sensorError } = await supabase
        .from('current_sensor_data')
        .select(`
          moisture_level,
          ph_level,
          temperature,
          humidity,
          light_intensity,
          soil_conductivity,
          nitrogen_level,
          phosphorus_level,
          potassium_level,
          last_updated
        `)
        .eq('device_id', deviceId)
        .single();
      
      if (!sensorError && sensors) {
        sensorData = sensors;
      }
    }
    
    // Get latest weather data from cache (specifically current weather)
    // Use same 30-minute cache expiration as weather controller
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('type', 'current')
      .eq('latitude', parseFloat(farmer.latitude).toFixed(4))
      .eq('longitude', parseFloat(farmer.longitude).toFixed(4))
      .gt('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let weatherInfo = {};
    if (weatherError || !weatherData) {
      console.warn('Chatbot: Weather data not found or expired, attempting to fetch fresh data');
      
      // Try to fetch fresh weather data if cache is expired
      try {
        const axios = require('axios');
        const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
        const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';
        
        const response = await axios.get(`${WEATHER_API_URL}/weather`, {
          params: {
            lat: farmer.latitude,
            lon: farmer.longitude,
            appid: WEATHER_API_KEY,
            units: 'metric'
          }
        });
        
        // Cache the fresh response
        await supabase.from('weather_cache').insert({
          type: 'current',
          latitude: parseFloat(farmer.latitude).toFixed(4),
          longitude: parseFloat(farmer.longitude).toFixed(4),
          data: JSON.stringify(response.data)
        });
        
        // Extract the correct fields from fresh OpenWeatherMap data
        weatherInfo = {
          temperature: response.data.main?.temp || 25,
          humidity: response.data.main?.humidity || 60,
          rainfall: response.data.rain?.['1h'] || response.data.rain?.['3h'] || 0,
          forecast: response.data.weather?.[0]?.description || 'Based on current conditions'
        };
        
        console.log('Chatbot: Fresh weather data fetched and cached:', weatherInfo);
      } catch (fetchError) {
        console.error('Chatbot: Failed to fetch fresh weather data:', fetchError.message);
        weatherInfo = {
          temperature: 25,
          humidity: 60,
          rainfall: 0,
          forecast: 'No weather data available'
        };
      }
    } else {
      // Parse the cached weather data (it's stored as JSON string)
      const parsedWeatherData = typeof weatherData.data === 'string' 
        ? JSON.parse(weatherData.data) 
        : weatherData.data;
      
      console.log('Chatbot: Parsed weather data:', {
        original: parsedWeatherData.main,
        rainfall: parsedWeatherData.rain,
        weather: parsedWeatherData.weather?.[0]
      });
      
      // Extract the correct fields from OpenWeatherMap data structure
      weatherInfo = {
        temperature: parsedWeatherData.main?.temp || 25,
        humidity: parsedWeatherData.main?.humidity || 60,
        rainfall: parsedWeatherData.rain?.['1h'] || parsedWeatherData.rain?.['3h'] || 0,
        forecast: parsedWeatherData.weather?.[0]?.description || 'Based on current conditions'
      };
      
      console.log('Chatbot: Final weather info:', weatherInfo);
    }

    // Get saved optimal ranges for chatbot context
    let optimalSettings = null;
    try {
      const { data: optimalData } = await supabase
        .from('farmer_optimal_settings')
        .select('optimal_json')
        .eq('user_id', userId)
        .single();
      optimalSettings = optimalData?.optimal_json || null;
    } catch (optimalErr) {
      console.warn('Optimal settings fetch error (chatbot):', optimalErr.message);
    }

    // Get latest field analysis data (satellite/map analysis)
    let fieldAnalysis = null;
    try {
      const { data: fieldData, error: fieldError } = await supabase
        .from('field_analyses')
        .select(`
          health_status,
          ndvi_mean,
          ndvi_std,
          ndmi_mean,
          evi_mean,
          water_stress_level,
          soil_moisture_status,
          irrigation_recommendation,
          recommendations,
          last_analysis_at,
          imagery_date
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_analysis_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!fieldError && fieldData) {
        fieldAnalysis = {
          health_status: fieldData.health_status,
          vegetation_health: {
            ndvi_mean: fieldData.ndvi_mean,
            ndvi_std: fieldData.ndvi_std,
            evi_mean: fieldData.evi_mean
          },
          water_status: {
            water_stress_level: fieldData.water_stress_level,
            soil_moisture_status: fieldData.soil_moisture_status,
            ndmi_mean: fieldData.ndmi_mean
          },
          irrigation_recommendation: fieldData.irrigation_recommendation,
          recommendations: fieldData.recommendations,
          last_analysis_at: fieldData.last_analysis_at,
          imagery_date: fieldData.imagery_date
        };
        console.log('✅ Field analysis data retrieved for chatbot');
      }
    } catch (fieldErr) {
      console.warn('Field analysis fetch error (chatbot):', fieldErr.message);
    }

    // Fetch waste data if stock_waste is enabled
    let waste = [];
    try {
      const { data: userWithWaste } = await supabase
        .from('users')
        .select('stock_waste')
        .eq('id', userId)
        .single();
      
      if (userWithWaste?.stock_waste) {
        const { data: wasteRows } = await supabase
          .from('farmer_waste')
          .select('waste_name, amount, unit')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        waste = Array.isArray(wasteRows) ? wasteRows : [];
        console.log('✅ Waste data retrieved for chatbot:', waste.length, 'items');
      }
    } catch (wasteErr) {
      console.warn('Failed to fetch waste data for chatbot:', wasteErr.message);
      waste = [];
    }

    // Fetch crop price for user's crop (if available) and all crop prices
    let allPricesList = [];
    try {
      // All crop prices
      const { data: allPriceRows } = await supabase
        .from('crop_prices')
        .select('crop_name, unit, price, updated_at')
        .order('crop_name', { ascending: true });
      if (Array.isArray(allPriceRows)) {
        allPricesList = allPriceRows.map(p => ({
          cropName: p.crop_name,
          unit: p.unit,
          price: p.price,
          updatedAt: p.updated_at
        }));
      }
    } catch (e) {
      console.warn('Chatbot: Failed to fetch crop prices:', e.message);
    }

    // Prepare comprehensive farm context for chatbot
    const farmContext = {
      farmer: {
        name: farmer.full_name,
        location: farmer.location_address || farmer.district_name || 'Unknown',
        landSize: farmer.land_size_acres || 'Unknown',
        coordinates: {
          latitude: farmer.latitude,
          longitude: farmer.longitude
        }
      },
      crop: {
        type: farmer.crop_name || 'Unknown',
        plantingDate: 'Unknown'
      },
      prices: allPricesList,
      weather: {
        temperature: weatherInfo.temperature,
        humidity: weatherInfo.humidity,
        rainfall: weatherInfo.rainfall,
        forecast: weatherInfo.forecast
      },
      sensors: sensorData ? {
        soilMoisture: sensorData.moisture_level,
        soilPH: sensorData.ph_level,
        soilTemperature: sensorData.temperature,
        lightIntensity: sensorData.light_intensity,
        soilConductivity: sensorData.soil_conductivity,
        nutrients: {
          nitrogen: sensorData.nitrogen_level,
          phosphorus: sensorData.phosphorus_level,
          potassium: sensorData.potassium_level
        },
        lastUpdated: sensorData.last_updated
      } : null,
      fieldAnalysis: fieldAnalysis,
      disasterRisks: null,
      optimal: optimalSettings,
      waste: waste
    };
    
    console.log('\n===== CHATBOT REQUEST =====');
    console.log(`User: ${farmer.full_name} (${userId})`);
    console.log(`Message: ${message}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('============================');
    
    // Send to OpenAI for personalized response
    const { chatResponse } = require('../services/openaiService');
    const response = await chatResponse(farmContext, message);
    
    return res.status(200).json({
      success: true,
      data: {
        response: response,
        farmContext: farmContext,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Chatbot farm data error:', error);
    return res.status(500).json({ 
      error: 'Failed to process chatbot request',
      message: error.message 
    });
  }
};

/**
 * Determine alert type based on sensor readings
 * @param {Object} sensorData - Current sensor readings
 * @returns {string} Alert type for categorization
 */
function determineAlertType(sensorData) {
  const moisture = parseFloat(sensorData.moisture_level);
  const ph = parseFloat(sensorData.ph_level);
  const temperature = parseFloat(sensorData.temperature);

  // Check for critical moisture levels
  if (moisture < 20) {
    return 'critical_drought';
  } else if (moisture > 90) {
    return 'critical_waterlogging';
  }

  // Check for pH problems
  if (ph < 5.5) {
    return 'ph_too_acidic';
  } else if (ph > 8.5) {
    return 'ph_too_alkaline';
  }

  // Check for temperature extremes
  if (temperature < 10) {
    return 'temperature_too_cold';
  } else if (temperature > 40) {
    return 'temperature_too_hot';
  }

  // Default for other critical conditions
  return 'critical_condition';
}