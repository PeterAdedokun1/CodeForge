import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, AlertTriangle, Brain, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { VoiceVisualizer } from './VoiceVisualizer';
import { sendMessageToMIMI, ConversationMessage } from '../lib/gemini';
import { calculateRisk, mergeRiskData, getRiskBgClass, RiskLevel, RiskAssessment } from '../lib/riskEngine';
import {
  getCurrentUser,
  getCurrentSession,
  startConversationSession,
  addMessageToSession,
  updateSessionRisk,
  sessionToGeminiHistory,
  getPreviousSessionContext,
  updateUserLastSeen,
  saveLivePatientAlert,
  ConversationSession
} from '../lib/memoryStore';
import { RiskData } from '../lib/gemini';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  riskData?: Partial<RiskData>;
}

interface VoiceInterfaceProps {
  onRiskUpdate?: (assessment: RiskAssessment) => void;
}

// Text-to-speech using Web Speech API
function speakText(text: string, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel(); // Cancel any ongoing speech

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;

  // Try to find a good voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v =>
    v.name.includes('Female') ||
    v.name.includes('Samantha') ||
    v.name.includes('Google UK English Female') ||
    v.name.includes('Karen') ||
    v.lang.startsWith('en')
  );
  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export const VoiceInterface = ({ onRiskUpdate }: VoiceInterfaceProps) => {
  const [interfaceState, setInterfaceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [cumulativeRiskData, setCumulativeRiskData] = useState<Partial<RiskData>>({});
  const [currentRisk, setCurrentRisk] = useState<RiskAssessment | null>(null);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = getCurrentUser();

  const {
    isRecording,
    recordingState,
    audioLevel,
    transcript,
    error: recordError,
    isSupported,
    startRecording,
    stopRecording,
    resetRecording
  } = useVoiceRecorder();

  // Initialize session and greeting
  useEffect(() => {
    if (isInitialized) return;
    setIsInitialized(true);

    let session = getCurrentSession();
    if (!session || !currentUser) {
      // Guest mode - create a temp session
      const userId = currentUser?.userId || 'guest_' + Date.now();
      session = startConversationSession(userId);
    }
    setCurrentSession(session);

    // Get previous context for memory feature
    const previousContext = currentUser
      ? getPreviousSessionContext(currentUser.userId)
      : undefined;

    // Generate MIMI greeting
    const userName = currentUser?.name || 'Mama';

    const greetingText = previousContext
      ? `Welcome back, ${userName}! I remember from your last visit — ${previousContext.split('.').slice(-1)[0].trim()}. How are you feeling today?`
      : `Welcome to MIMI, ${userName}! I am your maternal health companion. How are you feeling today, Mama? Any symptoms you want to tell me about?`;

    setTimeout(() => {
      const greetingMessage: Message = {
        id: 'greeting',
        role: 'assistant',
        content: greetingText,
        timestamp: new Date()
      };
      setMessages([greetingMessage]);

      // MIMI speaks the greeting
      setInterfaceState('speaking');
      speakText(greetingText, () => setInterfaceState('idle'));

      if (currentUser) updateUserLastSeen(currentUser.userId);
    }, 500);
  }, [isInitialized, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    setApiError(null);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    setInterfaceState('processing');

    // Update session
    let session = currentSession;
    if (session) {
      session = addMessageToSession(session, 'user', userText);
      setCurrentSession(session);
    }

    try {
      // Build conversation history for Gemini
      const history: ConversationMessage[] = session
        ? sessionToGeminiHistory(session).slice(0, -1) // Exclude the message we just added
        : [];

      const previousContext = currentUser
        ? getPreviousSessionContext(currentUser.userId)
        : undefined;

      const response = await sendMessageToMIMI(
        userText,
        history,
        currentUser?.name || 'Mama',
        previousContext
      );

      // Process risk data if provided by Gemini
      let updatedRiskData = cumulativeRiskData;
      if (response.riskData) {
        updatedRiskData = mergeRiskData(cumulativeRiskData, response.riskData);
        setCumulativeRiskData(updatedRiskData);

        // Calculate risk assessment
        const assessment = calculateRisk(updatedRiskData);
        setCurrentRisk(assessment);
        onRiskUpdate?.(assessment);

        // Auto-show risk panel if medium or higher
        if (assessment.level !== 'low') {
          setShowRiskPanel(true);
        }

        // Update session risk
        if (session) {
          session = updateSessionRisk(session, assessment.score, assessment.level, updatedRiskData);
          setCurrentSession(session);
        }

        // If high risk, save as live patient alert for CHEW dashboard
        if (assessment.requiresAlert && currentUser) {
          saveLivePatientAlert({
            patientId: currentUser.userId,
            patientName: currentUser.name,
            riskScore: assessment.score,
            riskLevel: assessment.level,
            symptoms: assessment.flags.map(f => f.name),
            timestamp: new Date().toISOString(),
            location: currentUser.location
          });
        }
      }

      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        riskData: response.riskData || undefined
      };
      setMessages(prev => [...prev, aiMessage]);

      // MIMI speaks the response
      setInterfaceState('speaking');
      speakText(response.text, () => setInterfaceState('idle'));

      // Save AI message to session
      if (session) {
        session = addMessageToSession(session, 'assistant', response.text, response.riskData || undefined);
        setCurrentSession(session);
      }

    } catch (err: any) {
      console.error('Error calling MIMI:', err);
      setApiError(err.message || 'Connection error');

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry Mama, I dey have small connection problem. You fit try again? I dey here for you.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      setInterfaceState('idle');
    }
  }, [currentSession, cumulativeRiskData, currentUser, onRiskUpdate]);

  const handleMicrophoneClick = useCallback(async () => {
    if (!isSupported) {
      alert('Voice recording is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isRecording) {
      setInterfaceState('processing');
      await stopRecording();

      if (transcript && transcript.trim()) {
        await handleSendMessage(transcript.trim());
      } else {
        setInterfaceState('idle');
      }
      resetRecording();
    } else {
      // Stop any speech before listening
      window.speechSynthesis?.cancel();
      setInterfaceState('listening');
      await startRecording();
    }
  }, [isRecording, isSupported, stopRecording, startRecording, transcript, handleSendMessage, resetRecording]);

  const getRiskLevelLabel = (level: RiskLevel) => {
    switch (level) {
      case 'critical': return '🚨 CRITICAL';
      case 'high': return '⚠️ HIGH RISK';
      case 'medium': return '⚡ MEDIUM RISK';
      case 'low': return '✅ LOW RISK';
    }
  };

  const getButtonContent = () => {
    switch (interfaceState) {
      case 'listening':
        return {
          icon: <Mic className="w-12 h-12" />,
          text: 'Listening... Tap to send',
          color: 'bg-pink-500 hover:bg-pink-600 animate-pulse shadow-pink-300 shadow-2xl'
        };
      case 'processing':
        return {
          icon: <Loader2 className="w-12 h-12 animate-spin" />,
          text: 'MIMI is thinking...',
          color: 'bg-purple-500 shadow-purple-300 shadow-2xl'
        };
      case 'speaking':
        return {
          icon: <Volume2 className="w-12 h-12 animate-bounce" />,
          text: 'MIMI is speaking...',
          color: 'bg-indigo-500 shadow-indigo-300 shadow-2xl'
        };
      default:
        return {
          icon: <MicOff className="w-12 h-12" />,
          text: 'Tap to speak to MIMI',
          color: 'bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-pink-200 shadow-xl'
        };
    }
  };

  const buttonContent = getButtonContent();

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">MIMI</h2>
            <p className="text-pink-100 text-xs">{currentUser?.name ? `Hello, ${currentUser.name}` : 'Maternal Health AI'}</p>
          </div>
        </div>

        {/* Risk Score Badge */}
        {currentRisk && (
          <button
            onClick={() => setShowRiskPanel(!showRiskPanel)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${getRiskBgClass(currentRisk.level)}`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Risk: {currentRisk.score}</span>
            {showRiskPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Risk Panel (collapsible) */}
      {currentRisk && showRiskPanel && (
        <div className={`border-b-2 p-4 ${getRiskBgClass(currentRisk.level)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm">{getRiskLevelLabel(currentRisk.level)}</span>
            <span className="text-lg font-black">{currentRisk.score}/100</span>
          </div>
          {/* Score bar */}
          <div className="w-full bg-white/50 rounded-full h-2 mb-2">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${currentRisk.score}%`,
                backgroundColor: currentRisk.level === 'critical' ? '#DC2626' :
                  currentRisk.level === 'high' ? '#EA580C' :
                    currentRisk.level === 'medium' ? '#D97706' : '#16A34A'
              }}
            />
          </div>
          {currentRisk.flags.length > 0 && (
            <div className="space-y-1">
              {currentRisk.flags.slice(0, 3).map((flag, i) => (
                <div key={i} className="flex items-center space-x-2 text-xs">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>{flag.name}</span>
                </div>
              ))}
            </div>
          )}
          {currentRisk.requiresAlert && (
            <div className="mt-2 text-xs font-semibold bg-white/60 rounded px-2 py-1">
              ⚕️ CHEW worker has been notified
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {recordError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm">
            {recordError}
          </div>
        )}
        {apiError && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-3 rounded text-sm">
            ⚠️ {apiError}
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center shadow-xl">
              <Heart className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Starting MIMI...</h2>
            <p className="text-gray-500 text-sm">Your AI maternal health companion</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1 shadow">
                <Heart className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user'
                ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-br-sm'
                : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p className={`text-xs mt-1.5 ${message.role === 'user' ? 'text-pink-100' : 'text-gray-400'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Input Area */}
      <div className="border-t border-gray-100 bg-white/90 backdrop-blur-sm shadow-lg">
        {interfaceState === 'listening' && (
          <div className="px-4 pt-3">
            <VoiceVisualizer
              isRecording={isRecording}
              audioLevel={audioLevel}
              width={window.innerWidth - 32}
              height={50}
            />
            {transcript && (
              <div className="mt-2 p-2 bg-pink-50 rounded-lg border border-pink-100">
                <p className="text-sm text-gray-700 italic">"{transcript}"</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-6 px-4">
          <button
            onClick={handleMicrophoneClick}
            disabled={interfaceState === 'processing'}
            id="mimi-mic-button"
            className={`${buttonContent.color}
              w-24 h-24 rounded-full flex items-center justify-center
              text-white transition-all duration-300 transform hover:scale-105
              active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {buttonContent.icon}
          </button>
          <p className="mt-3 text-sm font-semibold text-gray-600">{buttonContent.text}</p>
          {recordingState === 'recording' && (
            <p className="mt-1 text-xs text-gray-400">Speak clearly, then tap again to send</p>
          )}
        </div>
      </div>
    </div>
  );
};
