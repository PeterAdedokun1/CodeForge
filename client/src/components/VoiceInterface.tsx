import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Send, Loader2, AlertTriangle, Heart,
  X, Info, MessageSquare, ChevronLeft, Radio, WifiOff
} from 'lucide-react';
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

type UIState = 'idle' | 'listening' | 'processing' | 'speaking' | 'connecting';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

// ─── TTS fallback ─────────────────────────────────────────────────
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const VoiceInterface = ({ onRiskUpdate }: VoiceInterfaceProps) => {
  const [uiState, setUiState] = useState<UIState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [liveStatus, setLiveStatus] = useState<LiveSessionStatus>('disconnected');
  const [isLiveEnabled, setIsLiveEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [currentRisk, setCurrentRisk] = useState<RiskAssessment | null>(null);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isMimiSpeaking, setIsMimiSpeaking] = useState(false);
  // Separate mic state from UI state — mic stays on until user explicitly mutes
  const [isMicActive, setIsMicActive] = useState(false);

  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const pcmCapturerRef = useRef<PCMCapturer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const partialMessageIdRef = useRef<string | null>(null);
  const currentUser = getCurrentUser();
  // Use dedicated mic state instead of deriving from uiState
  const isRecording = isMicActive;

  // The user's display name — fallback to "Mama" if not set or invalid
  const userName = (currentUser?.name && currentUser.name.length >= 2 && /^[a-zA-Z\s\-']+$/.test(currentUser.name))
    ? currentUser.name
    : 'Mama';

  // ─── Init session + greeting ────────────────────────────────────────
  useEffect(() => {
    let session = getCurrentSession();
    if (!session) {
      const userId = currentUser?.userId || 'guest_' + Date.now();
      session = startConversationSession(userId);
    }
    setCurrentSession(session);

    const previousContext = currentUser?.userId
      ? getPreviousSessionContext(currentUser.userId)
      : undefined;

    const greetingText = `Hello ${userName}! 👋 I'm MIMI, your personal maternal health companion. How you dey today, Mama? You feeling well?`;

    addGreetingMessage(greetingText);
    initLiveSession(previousContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (apiError) {
      const timer = setTimeout(() => setApiError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [apiError]);

  const addGreetingMessage = (text: string) => {
    const greetMsg: ChatMessage = {
      id: 'greeting_' + Date.now(),
      role: 'assistant',
      text,
      timestamp: new Date(),
    };
    setMessages([greetMsg]);
  };

  // ─── Risk processing ──────────────────────────────────────────────
  const [cumulativeRiskDataRef] = useState<{ current: Partial<RiskData> }>({ current: {} });

  const handleRiskData = useCallback((riskData: RiskData) => {
    const merged = mergeRiskData(cumulativeRiskDataRef.current, riskData);
    cumulativeRiskDataRef.current = merged;
    const assessment = calculateRisk(merged);
    setCurrentRisk(assessment);
    onRiskUpdate?.(assessment);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, onRiskUpdate]);

  // ─── Gemini Live Session ──────────────────────────────────────────
  const initLiveSession = useCallback(async (previousContext?: string) => {
    if (liveSessionRef.current) {
      liveSessionRef.current.disconnect();
    }

    const session = new GeminiLiveSession(
      {
        onStatusChange: (status) => {
          setLiveStatus(status);
          if (status === 'error' || status === 'disconnected') {
            setIsLiveEnabled(false);
          }
        },
        onTextMessage: (text, _isPartial) => {
          const { cleanText, riskData } = extractRiskFromText(text);
          if (!cleanText) return;

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
        onAudioReceived: () => {
          // MIMI started speaking — update visual state but keep mic active
          setUiState('speaking');
        },
        onError: (error) => {
          console.warn('Live API error:', error);
          setApiError(error);
          setIsLiveEnabled(false);
          setIsMicActive(false); // Stop mic on error
          setUiState('idle');
        },
        onTurnComplete: () => {
          // MIMI finished speaking — go back to idle visual state
          // Mic stays active (isMicActive unchanged) — user can keep talking
          setUiState('idle');
          partialMessageIdRef.current = null;
          setLiveTranscript('');
        },
        onInterrupted: () => {
          // User interrupted MIMI
          setIsMimiSpeaking(false);
        },
        onSpeakingChange: (speaking) => {
          setIsMimiSpeaking(speaking);
          if (speaking) {
            setUiState('speaking');
          }
        },
      },
      userName,
      previousContext
    );

    liveSessionRef.current = session;
    await session.connect();
  }, [userName, handleRiskData]);

  // ─── Handle mic button ────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      // User explicitly clicked to MUTE — stop mic and capturer
      setIsMicActive(false);
      setUiState('idle');
      pcmCapturerRef.current?.stop();
      pcmCapturerRef.current = null;
      if (isLiveEnabled && liveSessionRef.current?.isConnected) {
        liveSessionRef.current.sendAudioStreamEnd();
      }
      setAudioLevel(0);
      return;
    }

    // User clicked to UNMUTE — start mic and capturer
    setLiveTranscript('');
    setIsMicActive(true);
    setUiState('listening');

    if (isLiveEnabled && liveSessionRef.current?.isConnected) {
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
        console.warn('PCM capture failed:', err);
        setIsLiveEnabled(false);
        setIsMicActive(false);
        fallbackSpeechRecognition();
      }
    } else {
      fallbackSpeechRecognition();
    }
  }, [isRecording, isLiveEnabled]);

  const fallbackSpeechRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as (new () => { continuous: boolean; lang: string; interimResults: boolean; onresult: (e: { results: { [key: number]: { isFinal: boolean;[key: number]: { transcript: string } } } }) => void; onerror: () => void; onend: () => void; start: () => void }) | null;
    if (!SR) {
      setApiError('Speech recognition not supported. Use the chat instead.');
      setIsMicActive(false);
      setUiState('idle');
      setShowChat(true);
      return;
    }
    const recognition = new SR();
    recognition.continuous = true; // Keep listening until user explicitly stops
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
      setIsMicActive(false);
      setUiState('idle');
      setLiveTranscript('');
    };
    recognition.onend = () => {
      // Only stop if user explicitly muted (isMicActive is false)
      if (!isMicActive) {
        setUiState('idle');
      }
    };
    recognition.start();
    setAudioLevel(0.5);
  }, [isMicActive]);

  // ─── Send text message (fallback) ─────────────────────────────────
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

    if (isLiveEnabled && liveSessionRef.current?.isConnected) {
      liveSessionRef.current.sendText(trimmed);
      return;
    }

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

      speakText(cleanText);
      setUiState('speaking');
      setTimeout(() => setUiState('idle'), 3000);

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
  }, [currentSession, currentUser, isLiveEnabled, handleRiskData]);

  const handleTextSend = useCallback(() => {
    if (textInput.trim()) handleSendMessage(textInput.trim());
  }, [textInput, handleSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  const handleCancel = useCallback(() => {
    if (isRecording) {
      setIsMicActive(false);
      pcmCapturerRef.current?.stop();
      pcmCapturerRef.current = null;
      if (isLiveEnabled && liveSessionRef.current?.isConnected) {
        liveSessionRef.current.sendAudioStreamEnd();
      }
      setAudioLevel(0);
    }
    setUiState('idle');
    setLiveTranscript('');
  }, [isRecording, isLiveEnabled]);

  // Orb state class — use isRecording (isMicActive) for listening state
  const orbStateClass = isMimiSpeaking
    ? 'speaking'
    : isRecording
      ? 'listening'
      : uiState === 'processing'
        ? 'processing'
        : '';

  const orbDynamicStyle = isRecording
    ? { transform: `scale(${1 + audioLevel * 0.2})` }
    : {};

  // Status subtitle — mic state takes priority
  const statusText = (() => {
    if (isRecording && isMimiSpeaking) return '● Conversation active...';
    if (isRecording) return liveStatus === 'connected' ? '● Listening — speak naturally...' : 'Listening...';
    if (uiState === 'speaking' || isMimiSpeaking) return 'MIMI is speaking...';
    if (uiState === 'processing') return 'MIMI is thinking...';
    if (uiState === 'connecting') return 'Connecting to MIMI Live...';
    return 'Tap the microphone to talk to MIMI';
  })();

  const riskBgClass = currentRisk ? getRiskBgClass(currentRisk.level) : 'bg-green-50';

  return (
    <div className="flex flex-col h-full mimi-dark-bg relative overflow-hidden select-none">

      {/* ─── Top Bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 z-10">
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <span className={`block w-2.5 h-2.5 rounded-full ${liveStatus === 'connected'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              : liveStatus === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-gray-500'
              }`} />
          </div>
          <span className="text-white/90 text-sm font-bold tracking-widest uppercase">MIMI Live</span>
          {liveStatus === 'connecting' && (
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          )}
          {!isLiveEnabled && liveStatus !== 'connecting' && (
            <span className="flex items-center space-x-1 text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
              <WifiOff className="w-3 h-3" />
              <span>Standard</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setShowChat(true)}
          className="mimi-control-btn w-10 h-10 backdrop-blur-sm"
          title="Open chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* ─── Greeting ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-3 md:pt-6 z-10">
        <h1 className="text-white text-2xl md:text-4xl font-extrabold leading-tight tracking-tight">
          {getGreeting()},
          <br />
          <span className="gradient-text">{userName}</span>
        </h1>
        <p className="text-white/40 text-sm mt-2 font-medium">
          {statusText}
        </p>
      </div>

      {/* ─── Error (auto-hides after 5s) ──────────────────────────── */}
      {apiError && (
        <div className="mx-5 mt-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-2.5 text-sm text-red-300/80 z-10 animate-pulse">
          {apiError}
        </div>
      )}

      {/* ─── Risk panel ───────────────────────────────────────────── */}
      {showRiskPanel && currentRisk && (
        <div className={`mx-5 mt-3 rounded-2xl p-4 border shadow-sm z-10 ${riskBgClass}`}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-semibold text-sm text-gray-800">⚠️ {currentRisk.recommendation}</p>
            <button onClick={() => setShowRiskPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
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

      {/* ─── Orb (center) ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center z-10 py-4">
        <div className="relative flex items-center justify-center">
          {/* Outer glow ring */}
          <div className={`absolute w-[280px] h-[280px] md:w-[340px] md:h-[340px] rounded-full transition-all duration-500 ${isMimiSpeaking
            ? 'bg-pink-500/10 scale-110'
            : uiState === 'listening'
              ? 'bg-pink-500/5 scale-105'
              : 'bg-transparent scale-100'
            }`} />
          {/* Main orb */}
          <div
            className={`mimi-orb w-[200px] h-[200px] md:w-[260px] md:h-[260px] ${orbStateClass}`}
            style={orbDynamicStyle}
          />
          {/* Center icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {uiState === 'processing' && (
              <Loader2 className="w-10 h-10 text-white/30 animate-spin" />
            )}
            {isMimiSpeaking && (
              <div className="flex space-x-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="w-1 bg-white/40 rounded-full animate-bounce"
                    style={{
                      height: `${12 + Math.random() * 20}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.6s'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Live transcript ──────────────────────────────────────── */}
      {liveTranscript && (
        <div className="px-6 pb-3 z-10">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 backdrop-blur-md">
            <p className="text-white/50 text-sm italic leading-relaxed">{liveTranscript}</p>
            <div className="flex space-x-1 mt-1.5">
              {[1, 2, 3].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom Controls ──────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-center space-x-10 pb-8 md:pb-10 pt-4 z-10">
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="mimi-control-btn"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Mic button */}
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-0 -m-3 rounded-full border-2 border-pink-400/40 animate-ping" />
          )}
          <button
            id="mimi-mic-button"
            onClick={handleMicPress}
            disabled={uiState === 'processing' || uiState === 'connecting'}
            className={`mimi-mic-btn ${isRecording ? 'active' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {uiState === 'processing' ? (
              <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-pink-500" />
            )}
          </button>
        </div>

        {/* Info button */}
        <button
          onClick={() => {
            if (currentRisk) setShowRiskPanel(p => !p);
          }}
          className="mimi-control-btn"
          title="Risk info"
        >
          {currentRisk ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : (
            <Info className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* ─── Chat Panel (slide-in) ────────────────────────────────── */}
      <div className={`chat-panel ${showChat ? 'open' : ''}`}>
        <div className="flex flex-col h-full">
          {/* Chat header */}
          <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
            <button
              onClick={() => setShowChat(false)}
              className="flex items-center space-x-2 text-white/50 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <Heart className="w-3 h-3 text-white" />
              </div>
              <span className="text-white font-bold text-sm tracking-wide">MIMI Chat</span>
            </div>
            <div className="flex items-center space-x-1 text-xs">
              {liveStatus === 'connected' ? (
                <span className="flex items-center space-x-1 text-emerald-400">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Live</span>
                </span>
              ) : (
                <span className="text-white/20">Offline</span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-2.5 mt-0.5 shrink-0 shadow-lg shadow-pink-500/20">
                    <Heart className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                  ? 'bg-gradient-to-br from-pink-500/90 to-purple-600/90 text-white rounded-tr-md shadow-lg shadow-pink-500/10'
                  : 'bg-white/[0.06] text-white/85 rounded-tl-md border border-white/[0.06]'
                  }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-pink-200/60' : 'text-white/20'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {liveTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-pink-900/20 text-pink-200/70 rounded-tr-md border border-pink-500/10">
                  <p className="text-sm italic">{liveTranscript}</p>
                  <div className="flex space-x-1 mt-1">
                    {[1, 2, 3].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-pink-400/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {uiState === 'processing' && (
              <div className="flex justify-start">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
                  <Heart className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex items-center space-x-1.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-2 h-2 bg-pink-400/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                    <span className="text-xs text-white/25 ml-2">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat text input */}
          <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/[0.06]">
            <div className="flex items-end space-x-2.5">
              <div className="flex-1 bg-white/[0.04] border border-white/[0.08] focus-within:border-pink-500/30 rounded-2xl transition-all overflow-hidden">
                <input
                  ref={textInputRef}
                  id="mimi-text-input"
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  disabled={uiState === 'processing'}
                  className="w-full px-4 py-3.5 text-white text-sm bg-transparent outline-none placeholder-white/20"
                />
              </div>
              <button
                id="mimi-send-button"
                onClick={handleTextSend}
                disabled={!textInput.trim() || uiState === 'processing'}
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20 disabled:opacity-30 hover:shadow-pink-500/40 transition-all active:scale-95"
              >
                {uiState === 'processing' ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
