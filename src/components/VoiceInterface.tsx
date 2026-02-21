import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Send, Loader2, AlertTriangle, Heart, ChevronDown, ChevronUp,
  Wifi, WifiOff, Radio, MessageSquare, Volume2, VolumeX
} from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { GeminiLiveSession, LiveSessionStatus, PCMCapturer } from '../lib/geminiLive';
import { sendMessageToMIMI, ConversationMessage } from '../lib/gemini';
import { calculateRisk, mergeRiskData, getRiskBgClass, RiskAssessment } from '../lib/riskEngine';
import { RiskData } from '../lib/gemini';
import {
  getCurrentUser,
  getCurrentSession,
  startConversationSession,
  addMessageToSession,
  sessionToGeminiHistory,
  getPreviousSessionContext,
  updateUserLastSeen,
  saveLivePatientAlert,
  ConversationSession
} from '../lib/memoryStore';

interface VoiceInterfaceProps {
  onRiskUpdate?: (assessment: RiskAssessment) => void;
}

type InputMode = 'voice' | 'text';
type UIState = 'idle' | 'listening' | 'processing' | 'speaking' | 'connecting';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

// ─── Text-to-Speech for fallback ─────────────────────────────────────────────
function speakText(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google UK English Female') ||
    v.name.includes('Samantha') ||
    v.name.includes('Female')
  );
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

function extractRiskFromText(text: string): { cleanText: string; riskData: RiskData | null } {
  const riskMatch = text.match(/\[RISK_DATA:({[^}]+})\]/);
  if (!riskMatch) return { cleanText: text, riskData: null };
  try {
    const riskData = JSON.parse(riskMatch[1]) as RiskData;
    const cleanText = text.replace(/\[RISK_DATA:[^\]]+\]/g, '').trim();
    return { cleanText, riskData };
  } catch {
    return { cleanText: text.replace(/\[RISK_DATA:[^\]]+\]/g, '').trim(), riskData: null };
  }
}

export const VoiceInterface = ({ onRiskUpdate }: VoiceInterfaceProps) => {
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [uiState, setUiState] = useState<UIState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [liveStatus, setLiveStatus] = useState<LiveSessionStatus>('disconnected');
  const [isLiveEnabled, setIsLiveEnabled] = useState(true); // Try Live API first
  const [isMuted, setIsMuted] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [currentRisk, setCurrentRisk] = useState<RiskAssessment | null>(null);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState(''); // Live speech-to-text display
  const [apiError, setApiError] = useState<string | null>(null);

  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const pcmCapturerRef = useRef<PCMCapturer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const partialMessageIdRef = useRef<string | null>(null);
  const currentUser = getCurrentUser();
  const isRecording = uiState === 'listening';

  // ─── Init session + greeting ────────────────────────────────────────────────
  useEffect(() => {
    let session = getCurrentSession();
    if (!session) {
      const userId = currentUser?.userId || 'guest_' + Date.now();
      session = startConversationSession(userId);
    }
    setCurrentSession(session);

    // Get and show initial greeting
    const previousContext = currentUser?.userId
      ? getPreviousSessionContext(currentUser.userId)
      : undefined;

    const greetingText = currentUser?.name
      ? `Hello ${currentUser.name}! 👋 I'm MIMI, your personal maternal health companion. How you dey today, Mama? You feeling well?`
      : `Hello! 👋 I'm MIMI, your personal maternal health companion. How you dey today, Mama?`;

    addGreetingMessage(greetingText);

    // Auto-connect Live API
    initLiveSession(previousContext);
  }, []);

  // ─── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addGreetingMessage = (text: string) => {
    const greetMsg: ChatMessage = {
      id: 'greeting_' + Date.now(),
      role: 'assistant',
      text,
      timestamp: new Date(),
    };
    setMessages([greetMsg]);
  };

  // ─── Gemini Live Session ────────────────────────────────────────────────────
  const initLiveSession = useCallback(async (previousContext?: string) => {
    if (liveSessionRef.current) {
      liveSessionRef.current.disconnect();
    }

    const session = new GeminiLiveSession(
      {
        onStatusChange: (status) => {
          setLiveStatus(status);
          if (status === 'error' || status === 'disconnected') {
            setIsLiveEnabled(false); // Fallback to standard API
          }
        },
        onTextMessage: (text, _isPartial) => {
          const { cleanText, riskData } = extractRiskFromText(text);
          if (!cleanText) return;

          // Update or create assistant message
          const msgId = partialMessageIdRef.current || 'live_' + Date.now();
          partialMessageIdRef.current = msgId;

          setMessages(prev => {
            const existing = prev.find(m => m.id === msgId);
            if (existing) {
              return prev.map(m => m.id === msgId ? { ...m, text: cleanText } : m);
            }
            return [...prev, { id: msgId, role: 'assistant', text: cleanText, timestamp: new Date() }];
          });

          if (riskData) handleRiskData(riskData);
        },
        onInputTranscript: (text) => {
          setLiveTranscript(text);
        },
        onAudioReceived: (_data, _mimeType) => {
          setUiState('speaking');
        },
        onError: (error) => {
          console.warn('Live API error:', error);
          setApiError(error);
          setIsLiveEnabled(false);
          setUiState('idle');
        },
        onTurnComplete: () => {
          setUiState('idle');
          partialMessageIdRef.current = null;
          setLiveTranscript('');
        },
      },
      currentUser?.name || 'Mama',
      previousContext
    );

    liveSessionRef.current = session;
    await session.connect();
  }, [currentUser?.name]);

  // ─── Risk processing ─────────────────────────────────────────────────────────
  const [cumulativeRiskDataRef] = useState<{ current: Partial<RiskData> }>({ current: {} });

  const handleRiskData = useCallback((riskData: RiskData) => {
    const merged = mergeRiskData(cumulativeRiskDataRef.current, riskData);
    cumulativeRiskDataRef.current = merged;
    const assessment = calculateRisk(merged);
    setCurrentRisk(assessment);
    onRiskUpdate?.(assessment);

    // Alert CHEW if high/critical
    if (assessment.requiresAlert && currentUser) {
      saveLivePatientAlert({
        patientId: currentUser.userId,
        patientName: currentUser.name,
        riskScore: assessment.score,
        riskLevel: assessment.level,
        symptoms: assessment.flags.map(f => f.name),
        timestamp: new Date().toISOString(),
        location: currentUser.location,
      });
      setShowRiskPanel(true);
    }
  }, [currentUser, onRiskUpdate, cumulativeRiskDataRef]);

  // ─── Handle mic button (Gemini Live streaming or fallback) ───────────────────
  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      setUiState('processing');
      pcmCapturerRef.current?.stop();
      pcmCapturerRef.current = null;
      // Signal end of audio to Live API
      if (isLiveEnabled && liveSessionRef.current?.isConnected) {
        liveSessionRef.current.sendAudioEnd();
      }
      setAudioLevel(0);
      return;
    }

    // Start recording
    setLiveTranscript('');
    setUiState('listening');

    if (isLiveEnabled && liveSessionRef.current?.isConnected) {
      // ─ Gemini Live: stream raw PCM ─
      try {
        const capturer = new PCMCapturer();
        capturer.onChunk = (base64) => {
          liveSessionRef.current?.sendAudioChunk(base64);
        };
        capturer.onLevel = (level) => {
          setAudioLevel(level);
        };
        await capturer.start();
        pcmCapturerRef.current = capturer;
      } catch (err) {
        console.warn('PCM capture failed, falling back to Web Speech', err);
        setIsLiveEnabled(false);
        fallbackSpeechRecognition();
      }
    } else {
      // ─ Fallback: Web Speech API ─
      fallbackSpeechRecognition();
    }
  }, [isRecording, isLiveEnabled]);

  const fallbackSpeechRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as (new () => { continuous: boolean; lang: string; interimResults: boolean; onresult: (e: { results: { [key: number]: { isFinal: boolean;[key: number]: { transcript: string } } } }) => void; onerror: () => void; onend: () => void; start: () => void }) | null;
    if (!SR) {
      setApiError('Speech recognition not supported. Please type instead.');
      setUiState('idle');
      setInputMode('text');
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.lang = 'en-NG';
    recognition.interimResults = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const result = (event.results as SpeechRecognitionResultList)[event.results.length - 1];
      const transcript = result[0].transcript;
      setLiveTranscript(transcript);
      if (result.isFinal) {
        handleSendMessage(transcript);
      }
    };
    recognition.onerror = () => {
      setUiState('idle');
      setLiveTranscript('');
    };
    recognition.onend = () => {
      if (uiState === 'listening') setUiState('idle');
    };
    recognition.start();
    setAudioLevel(0.5);
  }, []);

  // ─── Send text/voice message through standard Gemini API (fallback) ──────────
  const handleSendMessage = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    const trimmed = userText.trim();
    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setTextInput('');
    setLiveTranscript('');
    setUiState('processing');
    setApiError(null);

    // If Live API connected — send as text
    if (isLiveEnabled && liveSessionRef.current?.isConnected) {
      liveSessionRef.current.sendText(trimmed);
      return;
    }

    // ─ Fallback: Standard Gemini REST API ─
    try {
      let session = currentSession;
      if (!session) {
        const userId = currentUser?.userId || 'guest';
        session = startConversationSession(userId);
        setCurrentSession(session);
      }

      const history: ConversationMessage[] = sessionToGeminiHistory(session);
      const previousContext = currentUser?.userId
        ? getPreviousSessionContext(currentUser.userId)
        : undefined;

      const response = await sendMessageToMIMI(
        trimmed,
        history,
        currentUser?.name,
        previousContext
      );

      const { cleanText, riskData } = extractRiskFromText(response.text);

      const assistantMsg: ChatMessage = {
        id: 'ai_' + Date.now(),
        role: 'assistant',
        text: cleanText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // TTS fallback
      if (!isMuted) speakText(cleanText);
      setUiState('speaking');
      setTimeout(() => setUiState('idle'), 3000);

      // Update session
      let updatedSession = addMessageToSession(session, 'user', trimmed);
      updatedSession = addMessageToSession(updatedSession, 'assistant', cleanText);
      setCurrentSession(updatedSession);

      if (response.riskData) handleRiskData(response.riskData);
      if (riskData) handleRiskData(riskData);

      if (currentUser) updateUserLastSeen(currentUser.userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      setApiError(msg);
      setUiState('idle');
    }
  }, [currentSession, currentUser, isLiveEnabled, isMuted, handleRiskData]);

  // ─── Handle "send" on text box ───────────────────────────────────────────────
  const handleTextSend = useCallback(() => {
    if (textInput.trim()) {
      handleSendMessage(textInput.trim());
    }
  }, [textInput, handleSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  // ─── Status chip helper ──────────────────────────────────────────────────────
  const getLiveStatusChip = () => {
    if (!isLiveEnabled) {
      return (
        <span className="flex items-center space-x-1 text-xs text-gray-400">
          <WifiOff className="w-3 h-3" />
          <span>Standard mode</span>
        </span>
      );
    }
    const cfg: Record<LiveSessionStatus, { icon: React.ReactNode; label: string; color: string }> = {
      connected: { icon: <Radio className="w-3 h-3 animate-pulse" />, label: 'Live', color: 'text-green-500' },
      connecting: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Connecting...', color: 'text-yellow-500' },
      disconnected: { icon: <Wifi className="w-3 h-3" />, label: 'Disconnected', color: 'text-gray-400' },
      error: { icon: <WifiOff className="w-3 h-3" />, label: 'Offline', color: 'text-red-400' },
    };
    const c = cfg[liveStatus];
    return (
      <span className={`flex items-center space-x-1 text-xs ${c.color}`}>
        {c.icon}
        <span>Gemini {c.label}</span>
      </span>
    );
  };

  const riskBgClass = currentRisk ? getRiskBgClass(currentRisk.level) : 'bg-green-50';

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-pink-50 via-white to-purple-50">

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Heart className="w-5 h-5 text-white" />
              {liveStatus === 'connected' && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-gray-800 leading-tight">MIMI</h2>
              {getLiveStatusChip()}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Mute toggle */}
            <button
              onClick={() => setIsMuted(m => !m)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-pink-500" />}
            </button>

            {/* Risk panel toggle */}
            {currentRisk && (
              <button
                onClick={() => setShowRiskPanel(p => !p)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-semibold ${riskBgClass} transition-all`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="capitalize">{currentRisk.level} Risk • {currentRisk.score}</span>
                {showRiskPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Risk panel */}
        {showRiskPanel && currentRisk && (
          <div className={`mt-3 rounded-2xl p-4 border ${riskBgClass} shadow-sm`}>
            <p className="font-semibold text-sm text-gray-800 mb-1.5">⚠️ {currentRisk.recommendation}</p>
            <ul className="space-y-1">
              {currentRisk.flags.slice(0, 3).map((flag, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${flag.severity === 'critical' ? 'bg-red-500' : flag.severity === 'danger' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                  <span>{flag.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error banner */}
        {apiError && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
            ⚠️ {apiError}
          </div>
        )}
      </div>

      {/* ─── Message Thread ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-2 mt-1 shrink-0 shadow">
                <Heart className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${msg.role === 'user'
              ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-tr-sm'
              : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
              }`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-pink-200' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Live transcript preview */}
        {liveTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-pink-100 text-pink-800 rounded-tr-sm border border-pink-200">
              <p className="text-sm italic opacity-70">{liveTranscript}</p>
              <div className="flex space-x-1 mt-1">
                {[1, 2, 3].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {uiState === 'processing' && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-2 mt-1 shrink-0">
              <Heart className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center space-x-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
                <span className="text-xs text-gray-400 ml-2">MIMI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input area ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-6 pt-2">
        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          <button
            onClick={() => setInputMode('voice')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'voice'
              ? 'bg-white text-pink-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Mic className="w-4 h-4" />
            <span>Voice</span>
          </button>
          <button
            onClick={() => { setInputMode('text'); setTimeout(() => textInputRef.current?.focus(), 100); }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'text'
              ? 'bg-white text-pink-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Type</span>
          </button>
        </div>

        {inputMode === 'voice' ? (
          /* ─ Voice mode ─ */
          <div className="flex flex-col items-center space-y-3">
            {isRecording && (
              <VoiceVisualizer isRecording={isRecording} audioLevel={audioLevel} width={280} height={56} />
            )}

            <button
              id="mimi-mic-button"
              onClick={handleMicPress}
              disabled={uiState === 'processing' || uiState === 'connecting'}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 ${isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : uiState === 'processing'
                  ? 'bg-gray-400'
                  : 'bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                }`}
            >
              {isRecording && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" />
                  <span className="absolute inset-0 rounded-full bg-red-400/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                </>
              )}
              {uiState === 'processing' ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-8 h-8 text-white relative z-10" />
              ) : (
                <Mic className="w-8 h-8 text-white relative z-10" />
              )}
            </button>

            <p className="text-sm text-gray-500 font-medium">
              {uiState === 'connecting' && 'Connecting to MIMI Live...'}
              {uiState === 'idle' && (liveStatus === 'connected' ? 'Tap to speak with MIMI Live' : 'Tap to speak')}
              {uiState === 'listening' && (liveStatus === 'connected' ? '🔴 Streaming to Gemini Live...' : '🔴 Listening...')}
              {uiState === 'processing' && 'MIMI is thinking...'}
              {uiState === 'speaking' && '🔊 MIMI is speaking...'}
            </p>

            {liveStatus === 'connected' && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
                <Radio className="w-3 h-3 text-green-500 animate-pulse" />
                <span className="text-xs text-green-700 font-semibold">Gemini Live Active</span>
              </div>
            )}
          </div>
        ) : (
          /* ─ Text mode ─ */
          <div className="flex items-end space-x-2">
            <div className="flex-1 bg-white border-2 border-gray-200 focus-within:border-pink-400 rounded-2xl transition-colors overflow-hidden">
              <input
                ref={textInputRef}
                id="mimi-text-input"
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message to MIMI..."
                disabled={uiState === 'processing'}
                className="w-full px-4 py-3.5 text-gray-800 text-sm bg-transparent outline-none placeholder-gray-400"
              />
            </div>
            <button
              id="mimi-send-button"
              onClick={handleTextSend}
              disabled={!textInput.trim() || uiState === 'processing'}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg disabled:opacity-40 hover:from-pink-600 hover:to-purple-700 transition-all active:scale-95"
            >
              {uiState === 'processing' ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
