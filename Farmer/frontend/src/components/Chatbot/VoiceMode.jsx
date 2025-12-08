import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Volume2, VolumeX, Mic, MicOff, Loader2 } from 'lucide-react';
import './VoiceMode.css';

/**
 * VoiceMode Component
 * Hands-free conversational voice interface with WebSocket streaming
 */
const VoiceMode = ({ isActive, onToggle }) => {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioQueueRef = useRef([]);
  const audioElementRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Initialize audio element for playback
  useEffect(() => {
    audioElementRef.current = new Audio();
    audioElementRef.current.addEventListener('ended', () => {
      setIsSpeaking(false);
      playNextAudioChunk();
    });

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  // Main effect: connect/disconnect when voice mode toggles
  useEffect(() => {
    if (isActive) {
      startVoiceMode();
    } else {
      stopVoiceMode();
    }

    return () => {
      stopVoiceMode();
    };
  }, [isActive]);

  /**
   * Start voice mode: connect WebSocket and open microphone
   */
  const startVoiceMode = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Connect to WebSocket - derive from API base URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const wsProtocol = apiBaseUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = apiBaseUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '');
      const wsUrl = `${wsProtocol}://${wsHost}/ws/voice`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('🔊 WebSocket connected');
        
        // Start conversation with user context
        ws.send(JSON.stringify({
          type: 'start_conversation',
          userId: user.id
        }));

        // Open microphone
        await startMicrophone();
        
        setIsConnected(true);
        setIsConnecting(false);
        setIsListening(true);
      };

      ws.onmessage = (event) => {
        handleWebSocketMessage(JSON.parse(event.data));
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Failed to connect to voice service. Make sure the backend is running.');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        if (event.code !== 1000) {
          // Abnormal closure
          setError(`Connection lost (code: ${event.code})`);
        }
        setIsConnected(false);
        setIsListening(false);
      };

    } catch (err) {
      console.error('Failed to start voice mode:', err);
      setError(err.message);
      setIsConnecting(false);
    }
  };

  /**
   * Stop voice mode: close connections and release resources
   */
  const stopVoiceMode = () => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end_conversation' }));
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop any playing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    // Clear state
    audioQueueRef.current = [];
    setTranscript('');
    setResponse('');
    setIsSpeaking(false);
    setIsListening(false);
    setIsConnected(false);
  };

  /**
   * Start microphone capture and stream to WebSocket
   */
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      mediaStreamRef.current = stream;

      // Use MediaRecorder to capture audio in chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          audioChunksRef.current.push(event.data);
          
          // Convert blob to base64 and send every 0.5s worth of data
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
            wsRef.current.send(JSON.stringify({
              type: 'audio',
              data: base64Audio
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Capture audio in 500ms chunks for near-real-time streaming
      mediaRecorder.start(500);

      console.log('🎤 Microphone started');

    } catch (err) {
      console.error('Microphone error:', err);
      throw new Error('Could not access microphone');
    }
  };

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = (message) => {
    console.log('📨 WS Message:', message.type);

    switch (message.type) {
      case 'connected':
        console.log('Connected:', message.clientId);
        break;

      case 'conversation_started':
        console.log('Conversation started');
        break;

      case 'transcript_partial':
        // Live transcript from user's speech
        if (message.isFinal) {
          setTranscript(prev => prev + ' ' + message.text);
        }
        break;

      case 'llm_processing':
        // AI is thinking
        setResponse('');
        break;

      case 'llm_chunk':
        // Streaming text response
        setResponse(prev => prev + message.text);
        break;

      case 'llm_complete':
        // Full response received
        setResponse(message.fullText);
        break;

      case 'audio_chunk':
        // Audio chunk from TTS - queue for playback
        queueAudioChunk(message.audio);
        break;

      case 'audio_end':
        // TTS complete
        break;

      case 'error':
        console.error('Server error:', message.message);
        setError(message.message);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  /**
   * Queue audio chunks for sequential playback
   */
  const queueAudioChunk = (base64Audio) => {
    audioQueueRef.current.push(base64Audio);
    
    // Start playing if not already speaking
    if (!isSpeaking && audioQueueRef.current.length > 0) {
      playNextAudioChunk();
    }
  };

  /**
   * Play next audio chunk from queue
   */
  const playNextAudioChunk = () => {
    if (audioQueueRef.current.length === 0) {
      setIsSpeaking(false);
      return;
    }

    const audioData = audioQueueRef.current.shift();
    
    // Convert base64 to blob and play
    const byteCharacters = atob(audioData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    if (audioElementRef.current) {
      audioElementRef.current.src = url;
      audioElementRef.current.play().catch(err => {
        console.error('Audio playback error:', err);
      });
      setIsSpeaking(true);
    }
  };

  if (!isActive) return null;

  return (
    <div className="voice-mode-overlay">
      <div className="voice-mode-container">
        {/* Header */}
        <div className="voice-mode-header">
          <div className="voice-mode-title">
            <Volume2 className="voice-icon" />
            <h3>Voice Mode</h3>
          </div>
          <button 
            className="voice-mode-close" 
            onClick={onToggle}
            disabled={isConnecting}
          >
            ✕
          </button>
        </div>

        {/* Status */}
        <div className="voice-mode-status">
          {isConnecting && (
            <div className="status-item connecting">
              <Loader2 className="spinner" />
              <span>Connecting...</span>
            </div>
          )}

          {isConnected && !error && (
            <>
              <div className={`status-item ${isListening ? 'active' : ''}`}>
                {isListening ? <Mic /> : <MicOff />}
                <span>{isListening ? 'Listening...' : 'Mic off'}</span>
              </div>
              
              <div className={`status-item ${isSpeaking ? 'active' : ''}`}>
                {isSpeaking ? <Volume2 /> : <VolumeX />}
                <span>{isSpeaking ? 'Speaking...' : 'Quiet'}</span>
              </div>
            </>
          )}

          {error && (
            <div className="status-item error">
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>

        {/* Conversation Display */}
        <div className="voice-mode-conversation">
          {transcript && (
            <div className="conversation-block user">
              <div className="conversation-label">You:</div>
              <div className="conversation-text">{transcript}</div>
            </div>
          )}

          {response && (
            <div className="conversation-block assistant">
              <div className="conversation-label">Chain Farm AI:</div>
              <div className="conversation-text">{response}</div>
            </div>
          )}

          {!transcript && !response && isConnected && (
            <div className="voice-mode-hint">
              <p>🎤 Start speaking naturally</p>
              <p>I'll respond automatically</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="voice-mode-instructions">
          <p>💡 Just speak naturally - I'll listen and respond</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceMode;

