const WebSocket = require('ws');
const { OpenAI } = require('openai');
const FormData = require('form-data');
const axios = require('axios');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

/**
 * Session Management
 * Each client gets a session with: audio buffer, TTS WebSocket, conversation history
 */
const sessions = new Map();

/**
 * Start a new conversational session
 */
async function startSession(clientWs, clientId, farmContext) {
  console.log(`[ConversationService] Starting session for ${clientId}`);
  
  const session = {
    clientId,
    clientWs,
    farmContext,
    audioBuffer: [],
    audioTimeout: null,
    conversationHistory: [
      {
        role: 'system',
        content: buildSystemPrompt(farmContext)
      }
    ],
    ttsWs: null,
    isProcessing: false,
    isSpeaking: false
  };

  sessions.set(clientId, session);

  // Initialize ElevenLabs TTS WebSocket
  await initializeTTSWebSocket(session);
}

/**
 * Build system prompt with farm context
 */
function buildSystemPrompt(farmContext) {
  const { farmer = {}, crop = {}, weather = {}, sensors = {}, optimal, fieldAnalysis, nasaPowerData, waste = [] } = farmContext || {};
  
  const optimalSummary = optimal ? formatOptimalRanges(optimal) : 'No optimal ranges available.';
  const fieldSummary = fieldAnalysis ? formatFieldAnalysis(fieldAnalysis) : '';
  const disasterSummary = nasaPowerData ? formatDisasterRisks(nasaPowerData.disasterRisks) : '';
  const wasteSummary = waste && waste.length > 0 ? formatWasteData(waste) : '';
  
  return `You are AgriSense AI, a friendly agricultural assistant helping ${farmer.name || 'the farmer'}.

FARMER PROFILE:
- Name: ${farmer.name || 'Unknown'}
- Location: ${farmer.location || 'Unknown'}
- Land Size: ${farmer.landSize || 'Unknown'} acres
- Crop: ${crop.type || 'Unknown'}

CURRENT CONDITIONS:
- Weather: ${weather.temperature || 'N/A'}°C, ${weather.humidity || 'N/A'}% humidity
- Soil Moisture: ${sensors.soilMoisture || 'N/A'}%
- Soil pH: ${sensors.soilPH || 'N/A'}
- NPK: N=${sensors.nutrients?.nitrogen || 'N/A'}, P=${sensors.nutrients?.phosphorus || 'N/A'}, K=${sensors.nutrients?.potassium || 'N/A'} ppm

${fieldAnalysis ? `
DISASTER RISKS (if available from NASA POWER):
- Check for drought, flood, heat/cold stress, wind damage risks
- If HIGH or SEVERE risk detected, provide urgent warnings
` : ''}

OPTIMAL RANGES:
${optimalSummary}
${fieldSummary}
${disasterSummary}
${wasteSummary}
INSTRUCTIONS:
- ALWAYS respond in Bengali (Bangla) language
- Keep responses SHORT (2-3 sentences max) - this is voice conversation
- Be conversational and friendly
- CRITICAL: Consider ALL data sources together - sensor readings, weather, field analysis (satellite), farmer profile, crop type
- Give specific, actionable advice integrating sensor data + weather + satellite data + crop type
- Cross-reference: If sensors show one thing and satellite shows another, mention both
- Crop-specific: All advice must be appropriate for ${crop.type || 'the crop'}
- ALWAYS consider weather (temperature, humidity, rainfall, forecast) when giving recommendations
- For irrigation: Check if rain expected - delay if rain coming. Hot + dry = more water needed. Compare with satellite moisture data
- For fertilizers: Rainy weather = good time. Hot dry = avoid application. Consider crop type and location
- ALWAYS suggest natural remedies FIRST (neem oil, compost, organic manure) before chemicals
- Natural remedies: নিম তেল, কম্পোস্ট, জৈব সার, রসুন স্প্রে
- Only suggest chemicals if natural remedies insufficient or urgent
- If asked about prices, use the market data to give accurate answers
- If farmer has waste data available, you can suggest how to use or manage agricultural waste (composting, organic fertilizer, etc.)
- Address the farmer by name`;
}

function formatOptimalRanges(optimal) {
  if (!optimal) return '';
  return `- Moisture: ${optimal.moisture?.optimalMin ?? 'N/A'}-${optimal.moisture?.optimalMax ?? 'N/A'}%
- pH: ${optimal.ph?.optimalMin ?? 'N/A'}-${optimal.ph?.optimalMax ?? 'N/A'}
- NPK: N=${optimal.n?.optimalMin ?? 'N/A'}-${optimal.n?.optimalMax ?? 'N/A'}, P=${optimal.p?.optimalMin ?? 'N/A'}-${optimal.p?.optimalMax ?? 'N/A'}, K=${optimal.k?.optimalMin ?? 'N/A'}-${optimal.k?.optimalMax ?? 'N/A'} ppm`;
}

function formatFieldAnalysis(fieldAnalysis) {
  if (!fieldAnalysis) return '';
  
  const parts = ['\nFIELD ANALYSIS (Satellite Data):'];
  
  if (fieldAnalysis.health_status) {
    parts.push(`- Overall Health: ${fieldAnalysis.health_status}`);
  }
  
  if (fieldAnalysis.vegetation_health) {
    const veg = fieldAnalysis.vegetation_health;
    if (veg.ndvi_mean != null) {
      parts.push(`- Vegetation Index (NDVI): ${veg.ndvi_mean.toFixed(2)} ${veg.ndvi_std != null ? `(±${veg.ndvi_std.toFixed(2)})` : ''}`);
    }
  }
  
  if (fieldAnalysis.water_status) {
    const water = fieldAnalysis.water_status;
    if (water.water_stress_level) {
      parts.push(`- Water Stress: ${water.water_stress_level}`);
    }
    if (water.soil_moisture_status) {
      parts.push(`- Soil Moisture Status: ${water.soil_moisture_status}`);
    }
  }
  
  if (fieldAnalysis.irrigation_recommendation) {
    parts.push(`- Irrigation: ${fieldAnalysis.irrigation_recommendation}`);
  }
  
  return parts.length > 1 ? parts.join('\n') : '';
}

function formatDisasterRisks(disasterRisks) {
  if (!disasterRisks) return '';
  
  const parts = ['\nDISASTER RISKS (NASA POWER):'];
  
  if (disasterRisks.overallRisk) {
    parts.push(`- Overall Risk: ${disasterRisks.overallRisk.toUpperCase()}`);
  }
  
  const risks = ['drought', 'flood', 'heatStress', 'coldStress', 'windDamage'];
  risks.forEach(risk => {
    if (disasterRisks[risk] && disasterRisks[risk].level !== 'low') {
      const riskName = risk === 'heatStress' ? 'Heat Stress' : 
                      risk === 'coldStress' ? 'Cold Stress' : 
                      risk === 'windDamage' ? 'Wind Damage' : 
                      risk.charAt(0).toUpperCase() + risk.slice(1);
      parts.push(`- ${riskName}: ${disasterRisks[risk].level.toUpperCase()}`);
    }
  });
  
  return parts.length > 1 ? parts.join('\n') : '';
}

function formatWasteData(waste) {
  if (!waste || waste.length === 0) return '';
  
  const parts = ['\nAVAILABLE WASTE MATERIALS:'];
  waste.forEach(item => {
    parts.push(`- ${item.waste_name}: ${item.amount} ${item.unit}`);
  });
  parts.push('- Suggest composting, organic fertilizer production, or waste management strategies');
  
  return parts.join('\n');
}

/**
 * Initialize ElevenLabs TTS WebSocket for streaming audio output
 */
async function initializeTTSWebSocket(session) {
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=${ELEVENLABS_MODEL_ID}&output_format=mp3_44100_128`;
  
  const ttsWs = new WebSocket(wsUrl, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY
    }
  });

  session.ttsWs = ttsWs;

  ttsWs.on('open', () => {
    console.log(`[TTS WebSocket] Connected for ${session.clientId}`);
    
    // Send BOS (Beginning of Stream) message
    ttsWs.send(JSON.stringify({
      text: ' ',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        use_speaker_boost: true
      }
    }));
  });

  ttsWs.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      
      // Audio chunk received
      if (response.audio) {
        session.isSpeaking = true;
        session.clientWs.send(JSON.stringify({
          type: 'audio_chunk',
          audio: response.audio // base64 encoded MP3
        }));
      }

      // Generation complete
      if (response.isFinal) {
        session.isSpeaking = false;
        session.clientWs.send(JSON.stringify({
          type: 'audio_end'
        }));
      }
    } catch (err) {
      console.error('[TTS WebSocket] Parse error:', err.message);
    }
  });

  ttsWs.on('error', (error) => {
    console.error('[TTS WebSocket] Error:', error.message);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      message: 'TTS connection failed'
    }));
  });

  ttsWs.on('close', () => {
    console.log(`[TTS WebSocket] Closed for ${session.clientId}`);
    session.ttsWs = null;
  });
}

/**
 * Handle incoming audio from client
 */
async function handleClientAudio(clientId, audioBase64) {
  const session = sessions.get(clientId);
  if (!session || session.isProcessing || session.isSpeaking) return;

  // Buffer audio chunks
  session.audioBuffer.push(audioBase64);

  // Clear existing timeout
  if (session.audioTimeout) {
    clearTimeout(session.audioTimeout);
  }

  // Set timeout to process after 1.5 seconds of audio
  // This allows for natural pauses in speech
  session.audioTimeout = setTimeout(async () => {
    if (session.audioBuffer.length > 0) {
      await processAudioBuffer(session);
    }
  }, 1500);
}

/**
 * Process buffered audio: STT → OpenAI → TTS
 */
async function processAudioBuffer(session) {
  if (session.isProcessing || session.audioBuffer.length === 0) return;
  
  session.isProcessing = true;
  const audioChunks = session.audioBuffer.splice(0); // Take all buffered audio

  try {
    // Step 1: Transcribe audio using ElevenLabs STT (HTTP)
    const transcript = await transcribeAudioChunks(audioChunks);
    
    if (!transcript || transcript.trim().length === 0) {
      session.isProcessing = false;
      return;
    }

    console.log(`[Conversation] User said: ${transcript}`);
    
    // Send partial transcript to client
    session.clientWs.send(JSON.stringify({
      type: 'transcript_partial',
      text: transcript,
      isFinal: true
    }));

    // Add to conversation history
    session.conversationHistory.push({
      role: 'user',
      content: transcript
    });

    // Step 2: Get AI response from OpenAI (streaming)
    session.clientWs.send(JSON.stringify({
      type: 'llm_processing'
    }));

    const aiResponse = await streamOpenAIResponse(session, transcript);

    // Step 3: Stream AI response to TTS WebSocket
    if (session.ttsWs && session.ttsWs.readyState === WebSocket.OPEN) {
      session.ttsWs.send(JSON.stringify({
        text: aiResponse,
        flush: true
      }));
    }

  } catch (error) {
    console.error('[Conversation] Processing error:', error.message);
    session.clientWs.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process audio'
    }));
  } finally {
    session.isProcessing = false;
  }
}

/**
 * Transcribe audio chunks using ElevenLabs STT (HTTP)
 */
async function transcribeAudioChunks(audioChunks) {
  try {
    // Convert base64 chunks to buffer
    const audioBuffer = Buffer.concat(
      audioChunks.map(chunk => Buffer.from(chunk, 'base64'))
    );

    // Create form data
    const formData = new FormData();
    formData.append('audio', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });
    formData.append('model_id', 'scribe_v1');
    formData.append('language', 'bn'); // Bengali

    // Upload to ElevenLabs STT
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/speech-to-text',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'xi-api-key': ELEVENLABS_API_KEY
        }
      }
    );

    // Handle immediate response or polling
    if (response.data.text) {
      return response.data.text;
    } else if (response.data.transcription_id) {
      // Poll for result
      const transcriptionId = response.data.transcription_id;
      return await pollForTranscription(transcriptionId);
    }

    return null;
  } catch (error) {
    console.error('[STT] Transcription failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Poll ElevenLabs for transcription result
 */
async function pollForTranscription(transcriptionId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(
        `https://api.elevenlabs.io/v1/speech-to-text/transcripts/${transcriptionId}`,
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY
          }
        }
      );

      if (response.data.text) {
        return response.data.text;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      if (error.response?.status === 404 && i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Transcription polling timeout');
}

/**
 * Stream OpenAI response
 */
async function streamOpenAIResponse(session, userMessage) {
  let fullResponse = '';

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: session.conversationHistory,
      stream: true,
      temperature: 0.7,
      max_tokens: 150 // Keep responses short for voice
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        
        // Stream text chunks to client
        session.clientWs.send(JSON.stringify({
          type: 'llm_chunk',
          text: content
        }));
      }
    }

    // Send complete response
    session.clientWs.send(JSON.stringify({
      type: 'llm_complete',
      fullText: fullResponse
    }));

    // Add to conversation history
    session.conversationHistory.push({
      role: 'assistant',
      content: fullResponse
    });

    console.log(`[Conversation] AI responded: ${fullResponse}`);
    return fullResponse;

  } catch (error) {
    console.error('[OpenAI] Streaming error:', error.message);
    throw error;
  }
}

/**
 * End a session and cleanup
 */
function endSession(clientId) {
  const session = sessions.get(clientId);
  if (!session) return;

  console.log(`[ConversationService] Ending session for ${clientId}`);

  // Clear audio timeout
  if (session.audioTimeout) {
    clearTimeout(session.audioTimeout);
  }

  // Close TTS WebSocket
  if (session.ttsWs) {
    // Send EOS (End of Stream)
    if (session.ttsWs.readyState === WebSocket.OPEN) {
      session.ttsWs.send(JSON.stringify({ text: '' }));
    }
    session.ttsWs.close();
  }

  sessions.delete(clientId);
}

module.exports = {
  startSession,
  handleClientAudio,
  endSession
};
