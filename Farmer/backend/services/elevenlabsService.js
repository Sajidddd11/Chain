const axios = require('axios');
const FormData = require('form-data');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || null;
const ELEVENLABS_DEFAULT_TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL_ID || 'eleven_multilingual_v2';
const ELEVENLABS_DEFAULT_STT_MODEL = process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v1';
const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

if (!ELEVENLABS_API_KEY) {
  console.warn('[ElevenLabs] ELEVENLABS_API_KEY is not set. ElevenLabs features will be disabled.');
}

const client = axios.create({
  baseURL: ELEVENLABS_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'xi-api-key': ELEVENLABS_API_KEY || ''
  },
  responseType: 'json'
});

async function synthesizeSpeech({
  text,
  voiceId,
  modelId,
  voiceSettings,
  outputFormat = 'mp3_44100_128',
  optimizeLatency,
  enableLogging
}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }
  if (!text || !text.trim()) {
    throw new Error('Text is required for TTS');
  }

  const resolvedVoiceId = voiceId || ELEVENLABS_DEFAULT_VOICE_ID;
  if (!resolvedVoiceId) {
    throw new Error('Voice ID is required. Provide voiceId in the request or set ELEVENLABS_VOICE_ID in environment.');
  }

  const queryParams = new URLSearchParams();
  if (outputFormat) queryParams.append('output_format', outputFormat);
  if (typeof optimizeLatency !== 'undefined') queryParams.append('optimize_streaming_latency', optimizeLatency);
  if (typeof enableLogging !== 'undefined') queryParams.append('enable_logging', enableLogging);

  const url = `/v1/text-to-speech/${resolvedVoiceId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const payload = {
    text,
    model_id: modelId || ELEVENLABS_DEFAULT_TTS_MODEL
  };

  if (voiceSettings && typeof voiceSettings === 'object') {
    payload.voice_settings = voiceSettings;
  }

  const response = await client.post(url, payload, {
    responseType: 'arraybuffer',
    headers: { 'Content-Type': 'application/json' }
  });

  const contentType = response.headers['content-type'] || 'audio/mpeg';
  const contentLength = Number(response.headers['content-length']) || null;

  return {
    audioBuffer: Buffer.from(response.data),
    contentType,
    contentLength,
    voiceId: resolvedVoiceId,
    modelId: payload.model_id,
    outputFormat
  };
}

async function requestTranscription(audioBuffer, {
  filename = 'audio.webm',
  mimeType = 'audio/webm',
  modelId,
  languageCode,
  diarize,
  enableLogging
} = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    throw new Error('Audio buffer is required for transcription');
  }

  const form = new FormData();
  form.append('file', audioBuffer, { filename, contentType: mimeType });
  form.append('model_id', modelId || ELEVENLABS_DEFAULT_STT_MODEL);
  if (languageCode) form.append('language_code', languageCode);
  if (typeof diarize !== 'undefined') form.append('diarize', String(diarize));
  if (typeof enableLogging !== 'undefined') form.append('enable_logging', String(enableLogging));

  const response = await axios.post(
    `${ELEVENLABS_BASE_URL}/v1/speech-to-text`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'xi-api-key': ELEVENLABS_API_KEY
      },
      timeout: 30000
    }
  );

  return response.data;
}

async function pollTranscription(transcriptionId, {
  intervalMs = 2000,
  timeoutMs = 60000
} = {}) {
  if (!transcriptionId) {
    throw new Error('transcriptionId is required');
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await client.get(`/v1/speech-to-text/transcripts/${transcriptionId}`);
    const data = response.data || {};

    if (data.status === 'completed' || data.status === 'done' || data.status === 'ready' || data.text) {
      return data;
    }
    if (data.status === 'failed' || data.status === 'error') {
      const message = data.error || data.message || 'Transcription failed';
      throw new Error(message);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transcription polling timed out');
}

async function transcribeAudio(audioBuffer, options = {}) {
  const submission = await requestTranscription(audioBuffer, options);
  const transcriptionId = submission?.transcription_id || submission?.id || null;

  let transcription = submission;

  // Some models return the transcript synchronously without an ID
  if (!transcriptionId && (submission?.text || Array.isArray(submission?.words) || Array.isArray(submission?.transcripts))) {
    transcription = submission;
  } else {
    if (!transcriptionId) {
      throw new Error('ElevenLabs did not return a transcription_id');
    }

    transcription = await pollTranscription(transcriptionId, {
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs
    });
  }

  // Normalize transcript text; response may include `text` or nested `transcripts`
  let transcriptText = transcription.text || null;
  let words = [];

  if (!transcriptText && Array.isArray(transcription.transcripts)) {
    transcriptText = transcription.transcripts.map(t => t.text).join(' ');
    words = transcription.transcripts.flatMap(t => t.words || []);
  } else if (Array.isArray(transcription.words)) {
    words = transcription.words;
  }

  return {
    transcript: transcriptText,
    words,
    raw: transcription,
    transcriptionId: transcriptionId || transcription?.transcription_id || null
  };
}

module.exports = {
  synthesizeSpeech,
  transcribeAudio
};

