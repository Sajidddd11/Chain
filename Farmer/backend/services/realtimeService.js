const { WebSocketServer } = require('ws');
const url = require('url');
const conversationalService = require('./conversationalService');
const supabase = require('../config/database');

module.exports = function attachRealtimeServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map(); // ws → session state

  function authenticate(req) {
    // Optional: add token validation here (e.g., from query or headers)
    return true;
  }

  async function getFarmContext(userId) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, crop_name, land_size_acres, latitude, longitude, location_address')
        .eq('id', userId)
        .single();

      const { data: deviceData } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .single();

      let sensorData = null;
      if (deviceData) {
        const { data: sensors } = await supabase
          .from('current_sensor_data')
          .select('*')
          .eq('device_id', deviceData.id)
          .single();
        sensorData = sensors;
      }

      const { data: optimalData } = await supabase
        .from('farmer_optimal_settings')
        .select('optimal_json')
        .eq('user_id', userId)
        .single();

      // Fetch latest field analysis (satellite/map data)
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
          console.log('✅ Field analysis data retrieved for voice WebSocket');
        }
      } catch (fieldErr) {
        console.warn('Failed to fetch field analysis for WebSocket:', fieldErr.message);
      }

      // Fetch weather data from cache if available
      let weatherInfo = { temperature: 'N/A', humidity: 'N/A', rainfall: 'N/A', forecast: 'Unknown' };
      if (userData?.latitude && userData?.longitude) {
        try {
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: weatherRow } = await supabase
            .from('weather_cache')
            .select('data')
            .eq('type', 'current')
            .eq('latitude', parseFloat(userData.latitude).toFixed(4))
            .eq('longitude', parseFloat(userData.longitude).toFixed(4))
            .gt('created_at', thirtyMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (weatherRow?.data) {
            const parsedWeather = typeof weatherRow.data === 'string'
              ? JSON.parse(weatherRow.data)
              : weatherRow.data;

            weatherInfo = {
              temperature: parsedWeather?.main?.temp ?? 'N/A',
              humidity: parsedWeather?.main?.humidity ?? 'N/A',
              rainfall: parsedWeather?.rain?.['1h'] || parsedWeather?.rain?.['3h'] || 0,
              forecast: parsedWeather?.weather?.[0]?.description || 'Unknown'
            };
          }
        } catch (err) {
          console.warn('Weather fetch failed for voice session:', err.message);
        }
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
        }
      } catch (wasteErr) {
        console.warn('Failed to fetch waste data for voice session:', wasteErr.message);
        waste = [];
      }

      return {
        farmer: {
          name: userData?.full_name,
          location: userData?.location_address,
          landSize: userData?.land_size_acres,
          coordinates: { latitude: userData?.latitude, longitude: userData?.longitude }
        },
        crop: { type: userData?.crop_name },
        weather: weatherInfo,
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
          }
        } : null,
        fieldAnalysis: fieldAnalysis,
        optimal: optimalData?.optimal_json || null,
        waste: waste
      };
    } catch (error) {
      console.error('Error fetching farm context:', error);
      return {};
    }
  }

  wss.on('connection', (ws, request) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(ws, { clientId, userId: null });

    ws.send(JSON.stringify({ type: 'connected', clientId }));

      ws.on('message', async (data) => {
        try {
          const session = sessions.get(ws);
          const msg = JSON.parse(data.toString());
        
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (msg.type === 'start_conversation') {
          // Start conversational session
          session.userId = msg.userId;
          const farmContext = await getFarmContext(msg.userId);
          await conversationalService.startSession(ws, session.clientId, farmContext);
          ws.send(JSON.stringify({ type: 'conversation_started' }));
          return;
        }

        if (msg.type === 'audio') {
          // Base64 audio chunk
          if (session.userId) {
            conversationalService.handleClientAudio(session.clientId, msg.data);
          }
          return;
        }

        if (msg.type === 'end_conversation') {
          conversationalService.endSession(session.clientId);
          ws.send(JSON.stringify({ type: 'conversation_ended' }));
          return;
        }

        if (msg.type === 'text') {
          // Echo text for testing
          ws.send(JSON.stringify({ type: 'text', role: 'assistant', chunk: msg.text, final: true }));
          return;
        }

      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });

    ws.on('close', () => {
      const session = sessions.get(ws);
      if (session) {
        conversationalService.endSession(session.clientId);
        sessions.delete(ws);
      }
    });
  });

  // Upgrade HTTP → WS on /ws/voice
  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname } = url.parse(request.url);
    if (pathname !== '/ws/voice') {
      return;
    }
    if (!authenticate(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Heartbeat
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));
};

