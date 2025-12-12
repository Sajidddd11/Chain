const { OpenAI } = require('openai');
const axios = require('axios');
require('dotenv').config();

function formatOptimalRanges(optimal) {
  if (!optimal || typeof optimal !== 'object') {
    return 'Not available.';
  }

  const entries = [
    ['Soil Moisture', optimal.moisture, '%'],
    ['Soil pH', optimal.ph, ''],
    ['Soil Temperature', optimal.temperature, '°C'],
    ['Air Humidity', optimal.humidity, '%'],
    ['Light Intensity', optimal.light, ' lux'],
    ['Soil Conductivity', optimal.conductivity, ' μS/cm'],
    ['Nitrogen (N)', optimal.n, ' ppm'],
    ['Phosphorus (P)', optimal.p, ' ppm'],
    ['Potassium (K)', optimal.k, ' ppm']
  ];

  const lines = entries
    .map(([label, value, unit]) => {
      if (!value || typeof value !== 'object') return null;
      const { optimalMin, optimalMax } = value;
      if (optimalMin === undefined || optimalMax === undefined) return null;
      return `- ${label}: ${optimalMin} to ${optimalMax}${unit}`;
    })
    .filter(Boolean);

  return lines.length ? lines.join('\n') : 'Not available.';
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze receipt image using OpenAI Vision API
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<Object>} Receipt analysis results
 */
async function analyzeReceipt(base64Image) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "This is a receipt image. Please extract the following information in JSON format: date, vendor name, items purchased (with prices if available), total amount, and payment method." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    return {
      success: true,
      data: response.choices[0].message.content
    };
  } catch (error) {
    console.error("OpenAI receipt analysis error:", error);
    throw new Error(`Failed to analyze receipt: ${error.message}`);
  }
}

/**
 * Analyze farm data using OpenAI
 * @param {Object} data - Combined data for analysis
 * @param {Object} data.weather - Weather data
 * @param {Object} data.farmer - Farmer information
 * @param {Object} data.sensors - Sensor readings
 * @param {Object} data.crop - Crop information
 * @returns {Promise<Object>} Analysis results and recommendations
 */
async function analyzeData(data) {
  try {
    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
    if (provider === 'smythos') {
      // Forward request to Smythos external agent and expect compatible response
      const url = process.env.SMYTHOS_OUTBOUND_ANALYSIS_URL || 'https://cmfwuqtpo168o23qufoye75r8.agent.pa.smyth.ai/api/analyze_farmer_data';
      if (!url) {
        throw new Error('SMYTHOS_OUTBOUND_ANALYSIS_URL is not set');
      }

      const response = await axios.post(url, {
        farmerData: data,
        userId: data?.meta?.userId || null
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': 'smythos',
          'x-webhook-callback': process.env.SMYTHOS_ANALYSIS_CALLBACK_URL || ''
        },
        timeout: 20000
      });

      // Support two shapes:
      // 1) { analysis, actionRequired, message }
      // 2) { id, name, result: { Output: { analysis, actionRequired, message } } }
      const raw = response.data || {};
      const output = raw?.result?.Output || raw;
      if (!output || typeof output.actionRequired === 'undefined' || !('analysis' in output)) {
        throw new Error('Smythos response missing required fields (analysis/actionRequired)');
      }

      return {
        timestamp: new Date().toISOString(),
        analysis: output.analysis,
        actionRequired: Boolean(output.actionRequired),
        message: output.message ?? null,
        userId: output.userId || data?.meta?.userId || null,
        provider: 'smythos'
      };
    }

    const { weather, farmer, sensors, crop, optimalRanges, fieldAnalysis } = data;
    const optimalSummary = formatOptimalRanges(optimalRanges);
    
    // Enhanced logging for OpenAI requests
    console.log('\n===== DATA BEING SENT TO OPENAI =====');
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('SOURCE TYPE:', data.analysisType || 'on-demand');
    console.log('FARMER INFO:', JSON.stringify(farmer, null, 2));
    console.log('CROP INFO:', JSON.stringify(crop, null, 2));
    console.log('WEATHER DATA:', JSON.stringify(weather, null, 2));
    console.log('SENSOR READINGS:', JSON.stringify(sensors, null, 2));
    console.log('OPTIMAL RANGES:', optimalSummary);
    console.log('=====================================\n');
    
    // Prepare the prompt with all relevant data including NPK values
    const prompt = `
    Analyze this agricultural data and provide recommendations in STRICT JSON format:
    
    CRITICAL: You MUST consider ALL available data comprehensively - farmer profile, crop type, sensor readings, weather conditions, field analysis (satellite/map data), and optimal ranges. Do NOT focus on just one aspect - integrate everything for holistic analysis.
    
    FARMER PROFILE:
    - Farmer Name: ${farmer.name || 'Unknown'}
    - Location: ${farmer.location || 'Unknown'}
    - Land Size: ${farmer.landSize || 'Unknown'} acres
    - Crop Type: ${crop.type || 'Unknown'} (CRITICAL - all recommendations must be crop-specific)
    
    WEATHER CONDITIONS (MUST CONSIDER):
    - Temperature: ${weather.temperature || 'Unknown'}°C
    - Humidity: ${weather.humidity || 'Unknown'}%
    - Rainfall: ${weather.rainfall || 'Unknown'} mm
    - Forecast: ${weather.forecast || 'Unknown'}
    - Weather impact: Adjust ALL recommendations based on current and forecasted weather
    
    ${data.disasterRisks ? `
    NATURAL DISASTER RISK ASSESSMENT (NASA POWER DATA - LAST ${data.disasterRisks.assessmentPeriod || '30 DAYS'}):
    - Overall Risk Level: ${data.disasterRisks.overallRisk.toUpperCase()}
    - Drought Risk: ${data.disasterRisks.drought.level.toUpperCase()} - ${data.disasterRisks.drought.reasons.join(', ')}
    - Flood Risk: ${data.disasterRisks.flood.level.toUpperCase()} - ${data.disasterRisks.flood.reasons.join(', ')}
    - Heat Stress Risk: ${data.disasterRisks.heatStress.level.toUpperCase()} - ${data.disasterRisks.heatStress.reasons.join(', ')}
    - Cold Stress Risk: ${data.disasterRisks.coldStress.level.toUpperCase()} - ${data.disasterRisks.coldStress.reasons.join(', ')}
    - Wind Damage Risk: ${data.disasterRisks.windDamage.level.toUpperCase()} - ${data.disasterRisks.windDamage.reasons.join(', ')}
    - Data Source: ${data.disasterRisks.dataSource || 'NASA POWER'}
    
    CRITICAL: If any disaster risk is HIGH or SEVERE, prioritize preventive measures and warnings in your recommendations!
    ` : ''}
    
    SENSOR READINGS (GROUND TRUTH DATA):
    - Soil Moisture (Critical parameter and most important): ${sensors.soilMoisture !== undefined && sensors.soilMoisture !== null ? sensors.soilMoisture : 'Unknown'}%
    - Soil pH: ${sensors.soilPH !== undefined && sensors.soilPH !== null ? sensors.soilPH : 'Unknown'}
    - Soil Temperature: ${sensors.soilTemperature !== undefined && sensors.soilTemperature !== null ? sensors.soilTemperature : 'Unknown'}°C
    - Light Intensity: ${sensors.lightIntensity !== undefined && sensors.lightIntensity !== null ? sensors.lightIntensity : 'Unknown'} lux
    - Soil Conductivity: ${sensors.soilConductivity !== undefined && sensors.soilConductivity !== null ? sensors.soilConductivity : 'Unknown'} μS/cm
    
    SOIL NUTRIENTS (NPK):
    - Nitrogen (N): ${sensors.nutrients?.nitrogen !== undefined && sensors.nutrients?.nitrogen !== null ? sensors.nutrients.nitrogen : 'Unknown'} ppm
    - Phosphorus (P): ${sensors.nutrients?.phosphorus !== undefined && sensors.nutrients?.phosphorus !== null ? sensors.nutrients.phosphorus : 'Unknown'} ppm
    - Potassium (K): ${sensors.nutrients?.potassium !== undefined && sensors.nutrients?.potassium !== null ? sensors.nutrients.potassium : 'Unknown'} ppm
    
    FIELD ANALYSIS (SATELLITE/MAP DATA) - MUST CONSIDER:
    ${data.fieldAnalysis ? `
    - Overall Health Status: ${data.fieldAnalysis.health_status || 'N/A'}
    - NDVI (Vegetation Index): ${data.fieldAnalysis.vegetation_health?.ndvi_mean?.toFixed(3) || 'N/A'} - indicates crop health from space
    - NDMI (Moisture Index): ${data.fieldAnalysis.water_status?.ndmi_mean?.toFixed(3) || 'N/A'} - satellite-based moisture detection
    - Water Stress Level: ${data.fieldAnalysis.water_status?.water_stress_level || 'N/A'}
    - Soil Moisture Status: ${data.fieldAnalysis.water_status?.soil_moisture_status || 'N/A'}
    - Irrigation Recommendation: ${data.fieldAnalysis.irrigation_recommendation || 'N/A'}
    - Recommendations: ${data.fieldAnalysis.recommendations ? JSON.stringify(data.fieldAnalysis.recommendations) : 'N/A'}
    ` : 'No satellite/field analysis data available'}
    
    OPTIMAL TARGET RANGES (CROP-SPECIFIC):
    ${optimalSummary}
    
    DATA INTEGRATION REQUIREMENTS:
    - Compare sensor data with satellite/field analysis - if they conflict, mention both perspectives
    - Cross-reference farmer profile (location, crop type) with all data sources
    - Combine weather forecast with sensor readings for predictive recommendations
    - Use crop type to validate all recommendations are appropriate for ${crop.type || 'this crop'}
    - Consider land size when suggesting quantities/amounts

    RETURN RESPONSE IN THIS EXACT JSON FORMAT:
    {
      "analysis": "Detailed analysis and recommendations in Bengali (Bangla) language for the farmer dashboard. Use simple Bengali that farmers can understand easily. Use 4-5 points on analytics. MUST integrate ALL data sources: mention sensor readings, weather conditions, field analysis (satellite data), crop type, and farmer profile. Show how different data sources support or complement each other.",
      "actionRequired": true/false,
      "message": "Very short 2-3 sentence instruction in Bangla for SMS if actionRequired is true, null if false"
    }
    
    CRITICAL CONDITIONS for actionRequired=true:
    - Soil moisture below 20% (drought stress) - MOST CRITICAL! 0% moisture = SEVERE DROUGHT
    - Soil moisture above 90% (waterlogging risk)
    - pH below 5.5 or above 8.5 (nutrient lockout)
    - Temperature below 10°C or above 40°C (extreme temperature)
    - Any combination that poses immediate crop risk
    
    IMPORTANT: 0% soil moisture is NOT missing data - it means IMMEDIATE irrigation needed!
    
    COMPREHENSIVE DATA ANALYSIS (MANDATORY):
    - You MUST consider ALL available data sources together, not individually:
      1. SENSOR DATA: Real-time ground measurements (moisture, pH, NPK, temperature)
      2. FIELD ANALYSIS: Satellite/map data (NDVI, NDMI, water stress, health status)
      3. WEATHER: Current conditions and forecast (temperature, humidity, rainfall)
      4. DISASTER RISKS: NASA POWER data showing drought, flood, heat/cold stress, wind risks
      5. FARMER PROFILE: Location, crop type, land size
      6. OPTIMAL RANGES: Crop-specific target values
    - Cross-validate: If sensors show low moisture but satellite shows good health, explain both
    - Integrate: Combine sensor readings with satellite data for complete picture
    - Crop-specific: All recommendations MUST be appropriate for ${crop.type || 'the specific crop type'}
    - Location-aware: Consider ${farmer.location || 'the location'} climate and soil conditions
    
    DISASTER RISK CONSIDERATION (CRITICAL):
    - If disaster risks are HIGH or SEVERE, prioritize warnings and preventive measures
    - Drought risk HIGH/SEVERE: Emphasize water conservation, irrigation scheduling, drought-resistant practices
    - Flood risk HIGH/SEVERE: Warn about waterlogging, suggest drainage, protect crops from excess water
    - Heat stress HIGH/SEVERE: Suggest shade, increased irrigation, heat-tolerant varieties, timing adjustments
    - Cold stress HIGH/SEVERE: Suggest frost protection, cover crops, delayed planting, cold protection measures
    - Wind damage HIGH/SEVERE: Suggest windbreaks, staking, securing structures, wind-resistant varieties
    - Combine disaster risk data with sensor readings and weather for comprehensive protection strategies
    
    WEATHER-BASED RECOMMENDATIONS (CRITICAL):
    - ALWAYS consider current weather conditions when making recommendations
    - If rainfall is forecasted or recent, adjust irrigation recommendations accordingly
    - High temperature (>30°C) + low humidity (<50%) = increased water needs
    - High humidity (>80%) + rainfall = reduce irrigation, watch for fungal diseases
    - Low temperature (<15°C) = slower growth, adjust fertilizer timing
    - Combine weather data with sensor readings AND satellite data AND disaster risks for accurate recommendations
    - Example: If rainfall is expected tomorrow, delay irrigation even if soil moisture is low
    
    NATURAL REMEDIES PRIORITY:
    - ALWAYS suggest natural/organic remedies FIRST before chemical solutions
    - For pest control: neem oil, garlic spray, companion planting, beneficial insects
    - For soil health: compost, organic manure, crop rotation, green manure
    - For nutrient deficiency: organic fertilizers (compost, vermicompost, bone meal, fish meal)
    - For disease: neem extract, copper-based organic fungicides, proper spacing for air circulation
    - Only suggest chemical fertilizers/pesticides if natural remedies are insufficient or urgent action needed
    - Explain benefits of natural remedies: cost-effective, sustainable, safe for environment
    
    when action is required provide your suggestion in bangla messege in 1-2 sentence. first priority to moisture. Always mention weather conditions and prefer natural remedies.
    `;

    // Call OpenAI API
    console.log('Sending request to OpenAI API...');
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are an agricultural expert AI that analyzes farm data and provides structured JSON responses. You MUST respond with valid JSON only - no additional text before or after. CRITICAL: You MUST consider ALL available data comprehensively - sensor readings, weather conditions, field analysis (satellite/map data), farmer profile (location, crop type, land size), and optimal ranges. Integrate everything for holistic analysis. ALWAYS consider weather conditions when making recommendations. ALWAYS prioritize natural/organic remedies before chemical solutions. Focus on practical advice and identify critical conditions requiring immediate farmer action. Always write your analysis in Bengali (Bangla) language using proper Unicode Bengali script as this is for farmers in Bangladesh who prefer Bengali."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`OpenAI API response received in ${duration} seconds`);
    console.log('Response tokens:', response.usage);

    // Parse the JSON response from OpenAI
    const rawResponse = response.choices[0].message.content;
    console.log('Raw OpenAI Response:', rawResponse);
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.error('Raw response:', rawResponse);
      throw new Error('OpenAI returned invalid JSON format');
    }

    // Validate response structure
    if (!parsedResponse.analysis || typeof parsedResponse.actionRequired !== 'boolean') {
      console.error('Invalid response structure:', parsedResponse);
      throw new Error('OpenAI response missing required fields');
    }

    // Extract and structure the response
    const analysis = {
      timestamp: new Date().toISOString(),
      analysis: parsedResponse.analysis,
      actionRequired: parsedResponse.actionRequired,
      message: parsedResponse.message,
      usage: response.usage,
      processingTime: `${duration} seconds`
    };

    // Log a summary of the analysis
    console.log('\n===== ANALYSIS RESULTS =====');
    console.log('Analysis completed at:', analysis.timestamp);
    console.log('Processing time:', analysis.processingTime);
    console.log('Token usage:', analysis.usage.total_tokens);
    console.log('Action Required:', analysis.actionRequired);
    if (analysis.actionRequired) {
      console.log('Alert Message (Bangla):', analysis.message);
    }
    console.log('============================\n');

    return analysis;
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    throw new Error(`Failed to analyze farm data: ${error.message}`);
  }
}

/**
 * Generate chatbot response using OpenAI with complete farm context
 * @param {Object} farmContext - Complete farm data including sensors, weather, farmer info
 * @param {string} userMessage - User's question/message
 * @returns {Promise<string>} Personalized response
 */
async function chatResponse(farmContext, userMessage) {
  try {
    console.log('\n===== CHATBOT OPENAI REQUEST =====');
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('USER MESSAGE:', userMessage);
    console.log('FARM CONTEXT:', JSON.stringify(farmContext, null, 2));
    console.log('==================================\n');
    
    // Prepare comprehensive prompt with all farm data
    const optimalSummary = formatOptimalRanges(farmContext.optimal);
    const prompt = `
    You are AgriSense AI, a friendly and knowledgeable agricultural assistant specifically helping ${farmContext.farmer.name}. 
    
    CRITICAL: You MUST consider ALL available data comprehensively - farmer profile, crop type, sensor readings, weather conditions, field analysis (satellite/map data), and optimal ranges. Integrate everything for holistic, accurate advice.
    
    FARMER PROFILE (USE THIS FOR CONTEXT):
    - Name: ${farmContext.farmer.name}
    - Location: ${farmContext.farmer.location} (consider local climate and soil conditions)
    - Land Size: ${farmContext.farmer.landSize} acres (use for quantity recommendations)
    - Crop Type: ${farmContext.crop.type} (CRITICAL - all advice must be crop-specific)
    - Coordinates: ${farmContext.farmer.coordinates?.latitude || 'Unknown'}, ${farmContext.farmer.coordinates?.longitude || 'Unknown'}
    
    CURRENT WEATHER (MUST CONSIDER IN ALL RECOMMENDATIONS):
    - Temperature: ${farmContext.weather.temperature}°C
    - Humidity: ${farmContext.weather.humidity}%
    - Rainfall: ${farmContext.weather.rainfall} mm
    - Forecast: ${farmContext.weather.forecast}
    - Weather impact: Adjust ALL recommendations based on weather conditions
    
    ${farmContext.nasaPowerData ? `
    NATURAL DISASTER RISK ASSESSMENT (NASA POWER DATA):
    - Overall Risk: ${farmContext.nasaPowerData.disasterRisks.overallRisk.toUpperCase()}
    - Drought: ${farmContext.nasaPowerData.disasterRisks.drought.level.toUpperCase()} - ${farmContext.nasaPowerData.disasterRisks.drought.reasons.slice(0, 2).join(', ')}
    - Flood: ${farmContext.nasaPowerData.disasterRisks.flood.level.toUpperCase()} - ${farmContext.nasaPowerData.disasterRisks.flood.reasons.slice(0, 2).join(', ')}
    - Heat Stress: ${farmContext.nasaPowerData.disasterRisks.heatStress.level.toUpperCase()} - ${farmContext.nasaPowerData.disasterRisks.heatStress.reasons.slice(0, 2).join(', ')}
    - Cold Stress: ${farmContext.nasaPowerData.disasterRisks.coldStress.level.toUpperCase()} - ${farmContext.nasaPowerData.disasterRisks.coldStress.reasons.slice(0, 2).join(', ')}
    - Wind Damage: ${farmContext.nasaPowerData.disasterRisks.windDamage.level.toUpperCase()} - ${farmContext.nasaPowerData.disasterRisks.windDamage.reasons.slice(0, 2).join(', ')}
    
    CRITICAL: If disaster risk is HIGH or SEVERE, provide urgent warnings and preventive measures!
    ` : ''}
    
    ${Array.isArray(farmContext.prices) && farmContext.prices.length > 0 ? `
    ALL CROP PRICES (Summary):
    ${farmContext.prices.slice(0, 20).map(p => `- ${p.cropName}: ${p.price} per ${p.unit}`).join('\n')}
    ${farmContext.prices.length > 20 ? `...and ${farmContext.prices.length - 20} more` : ''}
    ` : ''}
    
    ${farmContext.sensors ? `
    LIVE SENSOR DATA (Last Updated: ${farmContext.sensors.lastUpdated}):
    - Soil Moisture: ${farmContext.sensors.soilMoisture}% ${farmContext.sensors.soilMoisture < 30 ? '⚠️ LOW' : farmContext.sensors.soilMoisture > 70 ? '✅ GOOD' : '🔵 MODERATE'}
    - Soil pH: ${farmContext.sensors.soilPH} ${farmContext.sensors.soilPH < 6 ? '⚠️ ACIDIC' : farmContext.sensors.soilPH > 8 ? '⚠️ ALKALINE' : '✅ OPTIMAL'}
    - Soil Temperature: ${farmContext.sensors.soilTemperature}°C
    - Light Intensity: ${farmContext.sensors.lightIntensity} lux
    - Soil Conductivity: ${farmContext.sensors.soilConductivity} μS/cm
    - Nitrogen (N): ${farmContext.sensors.nutrients.nitrogen} ppm
    - Phosphorus (P): ${farmContext.sensors.nutrients.phosphorus} ppm
    - Potassium (K): ${farmContext.sensors.nutrients.potassium} ppm
    ` : `
    SENSOR STATUS: No active IoT device connected. Encourage farmer to connect their AgriSense device for real-time monitoring.
    `}

    OPTIMAL TARGET RANGES:
    ${optimalSummary}
    
    ${farmContext.fieldAnalysis ? `
    FIELD ANALYSIS (Satellite Imagery Data):
    - Overall Health Status: ${farmContext.fieldAnalysis.health_status || 'N/A'}
    - NDVI (Vegetation Index): ${farmContext.fieldAnalysis.vegetation_health?.ndvi_mean?.toFixed(3) || 'N/A'} ${farmContext.fieldAnalysis.vegetation_health?.ndvi_std ? `(±${farmContext.fieldAnalysis.vegetation_health.ndvi_std.toFixed(3)})` : ''} (Range: -1 to 1, higher is better)
    - EVI (Enhanced Vegetation Index): ${farmContext.fieldAnalysis.vegetation_health?.evi_mean?.toFixed(3) || 'N/A'}
    - NDMI (Moisture Index): ${farmContext.fieldAnalysis.water_status?.ndmi_mean?.toFixed(3) || 'N/A'}
    - Water Stress Level: ${farmContext.fieldAnalysis.water_status?.water_stress_level || 'N/A'}
    - Soil Moisture Status: ${farmContext.fieldAnalysis.water_status?.soil_moisture_status || 'N/A'}
    - Irrigation Recommendation: ${farmContext.fieldAnalysis.irrigation_recommendation || 'N/A'}
    - Last Satellite Analysis: ${farmContext.fieldAnalysis.last_analysis_at || 'N/A'}
    ` : ''}
    
    ${Array.isArray(farmContext.waste) && farmContext.waste.length > 0 ? `
    AVAILABLE WASTE MATERIALS (for composting/organic fertilizer):
    ${farmContext.waste.map(w => `- ${w.waste_name}: ${w.amount} ${w.unit}`).join('\n')}
    - You can suggest how to use these waste materials for composting, organic fertilizer production, or waste management strategies
    - If farmer asks about waste management, composting, or organic fertilizers, use this data to provide specific advice
    ` : ''}
    
    USER'S QUESTION: "${userMessage}"
    
    INSTRUCTIONS:
    1. Address the farmer by name (${farmContext.farmer.name})
    2. ALWAYS integrate ALL data sources: sensor readings, weather, field analysis (satellite), farmer profile, and crop type
    3. Cross-reference different data sources - if sensors show one thing and satellite shows another, mention both
    4. Use crop type (${farmContext.crop.type}) to ensure all recommendations are crop-specific
    5. Consider location (${farmContext.farmer.location}) for local climate and soil conditions
    6. If asked about conditions, reference ALL relevant data (sensors, weather, satellite analysis)
    7. Provide practical, actionable advice that combines sensor data, weather, and field analysis
    8. ALWAYS respond in Bengali (Bangla) language as farmers in Bangladesh prefer Bengali communication
    9. If the question is about irrigation, fertilization, or crop care, integrate sensor data + weather + satellite data
    10. If sensor readings indicate problems, cross-check with satellite data and weather, then provide solutions
    11. Keep responses concise but informative (2-4 sentences) in simple Bengali that farmers can understand
    12. If relevant, use the market price list to answer price questions directly and to advise on harvest timing/sales decisions
    13. If asked about NDVI, EVI, NDMI, or satellite data, use the Field Analysis section above - this data IS available to you
    14. When mentioning NDVI values, explain briefly in Bengali what it means for their crop health
    15. Show how different data sources complement each other (e.g., "সেন্সর দেখাচ্ছে কম আর্দ্রতা, স্যাটেলাইটও দেখাচ্ছে পানির চাপ")
    
    COMPREHENSIVE DATA INTEGRATION (MANDATORY):
    16. You MUST consider ALL data sources together:
        - SENSOR DATA: Real-time ground measurements (moisture, pH, NPK, temperature)
        - FIELD ANALYSIS: Satellite/map data (NDVI, NDMI, water stress, health status)
        - WEATHER: Current conditions and forecast (temperature, humidity, rainfall)
        - DISASTER RISKS: NASA POWER data (drought, flood, heat/cold stress, wind damage risks)
        - FARMER PROFILE: Location, crop type (${farmContext.crop.type}), land size (${farmContext.farmer.landSize} acres)
        - OPTIMAL RANGES: Crop-specific target values
    17. Cross-validate: Compare sensor readings with satellite data - if they differ, explain both perspectives
    18. Integrate: Combine all data sources for complete picture (e.g., "সেন্সর দেখাচ্ছে X, স্যাটেলাইট দেখাচ্ছে Y, আবহাওয়া Z - তাই সুপারিশ...")
    19. Crop-specific: All recommendations MUST be appropriate for ${farmContext.crop.type}
    20. Location-aware: Consider ${farmContext.farmer.location} climate and soil conditions
    
    DISASTER RISK AWARENESS (MANDATORY):
    21. If disaster risks are HIGH or SEVERE, provide urgent warnings in Bengali
    22. Drought risk: "খরা ঝুঁকি বেশি - পানির সাশ্রয় করুন, সেচের সময়সূচী মেনে চলুন"
    23. Flood risk: "বন্যার ঝুঁকি - জলাবদ্ধতা এড়ান, নিষ্কাশন ব্যবস্থা করুন"
    24. Heat stress: "তাপ চাপ বেশি - ছায়া দিন, বেশি পানি দিন, গরম সহনশীল জাত ব্যবহার করুন"
    25. Cold stress: "ঠান্ডার ঝুঁকি - ফসল রক্ষা করুন, আবরণ ব্যবহার করুন"
    26. Wind damage: "বাতাসের ঝুঁকি - বাতাস প্রতিরোধক ব্যবহার করুন, গাছ বেঁধে দিন"
    
    WEATHER-BASED RECOMMENDATIONS (MANDATORY):
    27. ALWAYS consider current weather conditions (temperature, humidity, rainfall, forecast) when giving any advice
    28. For irrigation: Check if rainfall is expected - if yes, delay irrigation. High temp + low humidity = more water needed
    29. For fertilization: Rainy weather = good for applying fertilizers. Hot dry weather = avoid fertilizer application
    30. For pest/disease: High humidity + rain = risk of fungal diseases, suggest preventive measures
    31. Always mention how weather affects your recommendations (e.g., "আবহাওয়া গরম হওয়ায় বেশি পানি প্রয়োজন")
    32. Combine weather with sensor data AND satellite data AND disaster risks for accurate recommendations
    
    NATURAL REMEDIES PRIORITY (MANDATORY):
    33. ALWAYS suggest natural/organic remedies FIRST before chemical solutions
    34. Natural pest control: নিম তেল, রসুন স্প্রে, সহচর ফসল, উপকারী পোকা
    35. Natural fertilizers: কম্পোস্ট, জৈব সার, সবুজ সার, ভার্মিকম্পোস্ট
    36. Natural disease control: নিম নির্যাস, তামা-ভিত্তিক জৈব ছত্রাকনাশক
    37. Only suggest chemicals if natural remedies won't work or urgent action needed
    38. Explain why natural remedies are better: সাশ্রয়ী, পরিবেশবান্ধব, নিরাপদ
    
    EXPERTISE AREAS:
    - Soil moisture and irrigation scheduling
    - pH management and soil amendments
    - NPK nutrient management
    - Weather-based farming decisions
    - Crop-specific care for ${farmContext.crop.type}
    - Pest and disease prevention
    - Seasonal farming advice
    - Satellite imagery analysis (NDVI, EVI, NDMI indices)
    - Field health monitoring from space
    
    Respond naturally and helpfully to the farmer's question using all available data. Always use Bengali (Bangla) language.
    `;

    console.log('Sending chatbot request to OpenAI API...');
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are AgriSense AI, a helpful agricultural assistant that provides personalized farming advice. CRITICAL: You MUST consider ALL available data comprehensively - sensor readings, weather conditions, field analysis (satellite/map data), farmer profile (location, crop type, land size), and optimal ranges. Integrate everything for holistic analysis. ALWAYS consider weather conditions when making recommendations. ALWAYS prioritize natural/organic remedies (neem oil, compost, organic manure) before suggesting chemical solutions. Always be friendly, practical, and use ALL the specific data provided to give actionable recommendations. You MUST always respond in Bengali (Bangla) language as you are serving farmers in Bangladesh who prefer Bengali communication."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Chatbot OpenAI API response received in ${duration} seconds`);
    console.log('Response tokens:', response.usage);

    const botResponse = response.choices[0].message.content;
    console.log('Chatbot Response:', botResponse);

    return botResponse;
  } catch (error) {
    console.error('Chatbot OpenAI error:', error);
    // Fallback response with available data in Bengali
    if (farmContext.sensors) {
      return `আসসালামু আলাইকুম ${farmContext.farmer.name}! আমি এখন আপনার প্রশ্নটি প্রক্রিয়া করতে সমস্যা হচ্ছে, তবে আমি দেখতে পাচ্ছি আপনার বর্তমান মাটির আর্দ্রতা ${farmContext.sensors.soilMoisture}% এবং pH ${farmContext.sensors.soilPH}। আপনার ${farmContext.crop.type} খামারে কিভাবে সাহায্য করতে পারি?`;
    } else {
      return `আসসালামু আলাইকুম ${farmContext.farmer.name}! আমি কিছু প্রযুক্তিগত সমস্যার সম্মুখীন হচ্ছি, তবে আমি আপনার ${farmContext.crop.type} চাষের প্রশ্নে সাহায্য করতে এখানে আছি। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।`;
    }
  }
}

/**
 * Schedule daily morning analysis
 * @param {Object} farmData - Farm data to analyze
 * @returns {Promise<Object>} Analysis results
 */
async function performDailyAnalysis(farmData) {
  try {
    // Add time context for daily analysis
    const dataWithTimeContext = {
      ...farmData,
      analysisType: 'daily',
      timestamp: new Date().toISOString()
    };
    
    return await analyzeData(dataWithTimeContext);
  } catch (error) {
    console.error('Daily analysis error:', error);
    throw new Error(`Failed to perform daily analysis: ${error.message}`);
  }
}

module.exports = {
  analyzeData,
  performDailyAnalysis,
  chatResponse,
  analyzeReceipt,
  // Export additional functions for image upload functionality
  processImageUpload: analyzeReceipt,
  
  /**
   * Analyze and propose optimal sensor ranges for a specific farm context
   * Returns STRICT JSON only. Shape:
   * {
   *   "moisture": {"min":0,"max":100,"optimalMin":45,"optimalMax":65},
   *   "ph": {"min":0,"max":14,"optimalMin":6.0,"optimalMax":7.5},
   *   "temperature": {"min":0,"max":50,"optimalMin":18,"optimalMax":30},
   *   "humidity": {"min":0,"max":100,"optimalMin":40,"optimalMax":70},
   *   "light": {"min":0,"max":2000,"optimalMin":300,"optimalMax":800},
   *   "conductivity": {"min":0,"max":1000,"optimalMin":200,"optimalMax":400},
   *   "n": {"min":0,"max":100,"optimalMin":30,"optimalMax":50},
   *   "p": {"min":0,"max":80,"optimalMin":15,"optimalMax":35},
   *   "k": {"min":0,"max":100,"optimalMin":30,"optimalMax":60}
   * }
   */
  async analyzeOptimalConditions(farmContext) {
    const { farmer, crop, weather, sensors } = farmContext || {};
    try {
      const prompt = `
You are an expert agronomist optimizing sensor thresholds for precision farming. Using the provided context (farmer region, crop, recent weather, last sensor snapshot), return STRICT JSON ONLY matching this exact schema with no extra keys or text:

{
  "moisture": {"min":0,"max":100,"optimalMin":45,"optimalMax":65},
  "ph": {"min":0,"max":14,"optimalMin":6.0,"optimalMax":7.5},
  "temperature": {"min":0,"max":50,"optimalMin":18,"optimalMax":30},
  "humidity": {"min":0,"max":100,"optimalMin":40,"optimalMax":70},
  "light": {"min":0,"max":2000,"optimalMin":300,"optimalMax":800},
  "conductivity": {"min":0,"max":1000,"optimalMin":200,"optimalMax":400},
  "n": {"min":0,"max":100,"optimalMin":30,"optimalMax":50},
  "p": {"min":0,"max":80,"optimalMin":15,"optimalMax":35},
  "k": {"min":0,"max":100,"optimalMin":30,"optimalMax":60}
}

Rules:
- The min/max are fixed bounds as shown above and MUST be kept exactly.
- Choose optimalMin/optimalMax tailored to crop=${crop?.type || 'Unknown'} and Bangladesh agronomy for the farmer's district.
- Use recent weather and sensor snapshot to slightly shift optimal ranges if justified (e.g., raise optimal moisture in heat).
- Respond with VALID JSON only. No commentary.

Context:
Farmer: ${farmer?.name || 'Unknown'} (${farmer?.location || 'Unknown'})
Crop: ${crop?.type || 'Unknown'}
Weather: ${JSON.stringify(weather || {}, null, 2)}
Sensors: ${JSON.stringify(sensors || {}, null, 2)}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You return only valid JSON. Never include any explanation." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 600
      });

      const raw = response.choices?.[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error('AI returned invalid JSON for optimal settings');
      }

      // Basic shape validation
      const requiredKeys = ["moisture","ph","temperature","humidity","light","conductivity","n","p","k"];
      for (const k of requiredKeys) {
        if (!parsed[k] || typeof parsed[k].optimalMin === 'undefined' || typeof parsed[k].optimalMax === 'undefined') {
          throw new Error(`Missing optimal range for ${k}`);
        }
      }

      return {
        success: true,
        optimal: parsed,
        usage: response.usage
      };
    } catch (error) {
      console.error('Optimal analysis error:', error);
      throw error;
    }
  },
  
  /**
   * Process image in chat using OpenAI Vision API
   * @param {string} base64Image - Base64 encoded image
   * @param {string} userMessage - User's message/question about the image
   * @param {Array} conversationHistory - Previous conversation messages
   * @returns {Promise<Object>} Image analysis results
   */
  async processImageInChat(base64Image, userMessage, conversationHistory = []) {
    try {
      // Format conversation history for OpenAI
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.content
      }));
      
      // Prepare messages array with system message and conversation history
      const messages = [
        {
          role: "system",
          content: "You are AgriSense AI, a helpful agricultural assistant that provides personalized farming advice. Always respond in Bengali (Bangla) language as you are serving farmers in Bangladesh."
        },
        ...formattedHistory,
        {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: messages,
        max_tokens: 1000
      });

      return {
        success: true,
        data: response.choices[0].message.content
      };
    } catch (error) {
      console.error("OpenAI image processing error:", error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
};