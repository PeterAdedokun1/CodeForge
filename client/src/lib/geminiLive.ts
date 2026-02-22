/**
 * MIMI Gemini Live — Socket.IO client bridge.
 *
 * Architecture (matches studyaid pattern exactly):
 *   Browser (this file) → Socket.IO → server/index.js → GeminiLiveBridge → Gemini Live API
 *
 * The Node.js backend uses @google/genai SDK with ephemeral tokens + service-account auth.
 * Server auto-connects to Gemini when a socket connects (no start-session event needed).
 *
 * Run the backend with: cd server && npm start
 */

import { io, Socket } from 'socket.io-client';

// Prefer env overrides so frontend and backend stay in sync even if the port changes
const SERVER_URL =
    import.meta.env.VITE_SERVER_URL ||
    `http://localhost:${import.meta.env.VITE_SERVER_PORT || 3001}`;

// ─── Logger ──────────────────────────────────────────────────────────────────
const LOG_PREFIX = '🎙️ [MIMI Live]';
function log(...args: unknown[]) { console.log(LOG_PREFIX, ...args); }
function logWarn(...args: unknown[]) { console.warn(LOG_PREFIX, ...args); }
function logError(...args: unknown[]) { console.error(LOG_PREFIX, ...args); }

export type LiveSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GeminiLiveSessionCallbacks {
    onStatusChange: (status: LiveSessionStatus) => void;
    onTextMessage: (text: string, isPartial: boolean) => void;
    onInputTranscript: (text: string) => void;
    onAudioReceived: (audioData: string, mimeType: string) => void;
    onError: (error: string) => void;
    onTurnComplete: () => void;
    onInterrupted?: () => void;
    onSpeakingChange?: (isSpeaking: boolean) => void;
    // VAD-based user speech activity
    onUserSpeechStart?: () => void;
    onUserSpeechEnd?: () => void;
}

export class GeminiLiveSession {
    private socket: Socket | null = null;
    private callbacks: GeminiLiveSessionCallbacks;
    private status: LiveSessionStatus = 'disconnected';
    private userName: string;

    // Gapless audio playback
    private audioContext: AudioContext | null = null;
    private nextPlayTime = 0;
    private scheduledSources: AudioBufferSourceNode[] = [];
    private isSpeaking = false;
    private speakingTimeout: ReturnType<typeof setTimeout> | null = null;
    // INCREASED lookahead buffer to prevent stuttering/cracking (studyaid uses 200ms)
    private readonly BUFFER_LOOKAHEAD = 0.2;
    private audioChunkCount = 0;

    private intentionalDisconnect = false;

    constructor(
        callbacks: GeminiLiveSessionCallbacks,
        userName = 'Mama',
        _previousContext?: string   // kept for API compat; server has its own system prompt
    ) {
        this.callbacks = callbacks;
        this.userName = userName;
        log('Session created for user:', userName);
    }

    /**
     * Connect to the MIMI server via Socket.IO.
     * The server auto-initialises a GeminiLiveBridge (ephemeral-token auth)
     * on socket connection — no "start-session" event needed (studyaid pattern).
     */
    async connect(): Promise<boolean> {
        this.intentionalDisconnect = false;
        this.setStatus('connecting');
        log(`Connecting to MIMI server at ${SERVER_URL}...`);

        return new Promise((resolve) => {
            // Give enough time for Socket.IO connect + server's Gemini live.connect()
            const connectTimeout = setTimeout(() => {
                logError('Connection timeout — is the server running?');
                this.callbacks.onError(
                    'Cannot reach MIMI server. Run: cd server && npm start'
                );
                this.setStatus('error');
                resolve(false);
            }, 20000);

            const socket = io(SERVER_URL, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: false, // We handle reconnect manually
            });

            this.socket = socket;

            // ── Socket.IO lifecycle ──────────────────────────────────────
            socket.on('connect', () => {
                log('✅ Socket.IO connected, waiting for Gemini status...');
            });

            // Server emits 'status' when Gemini bridge is ready (studyaid pattern)
            socket.on('status', ({ status, message }: { status?: string; message: string }) => {
                log('📡 Server status:', message);

                if (message.toLowerCase().includes('error')) {
                    clearTimeout(connectTimeout);
                    logError('Live error from server:', message);
                    this.callbacks.onError(message);
                    this.setStatus('error');
                    resolve(false);
                } else if (status === 'connected' || message.toLowerCase().includes('ready')) {
                    clearTimeout(connectTimeout);
                    log('✅ Gemini Live ready!');
                    this.setStatus('connected');
                    resolve(true);
                }
            });

            socket.on('connect_error', (err) => {
                logError('Socket.IO connect error:', err.message);
                clearTimeout(connectTimeout);
                if (!this.intentionalDisconnect) {
                    this.callbacks.onError(
                        `Cannot connect to MIMI server at ${SERVER_URL} — is it running?`
                    );
                    this.setStatus('error');
                }
                resolve(false);
            });

            socket.on('disconnect', (reason) => {
                log('Socket.IO disconnected:', reason);
                if (!this.intentionalDisconnect) {
                    this.setStatus('disconnected');
                    this.callbacks.onError('Live connection lost — using standard mode');
                }
            });

            // ── Gemini audio output (studyaid pattern: base64 PCM) ────────
            socket.on('audio-output', (base64PCM: string) => {
                this.audioChunkCount++;
                if (this.audioChunkCount <= 3 || this.audioChunkCount % 10 === 0) {
                    log(`📥 Audio chunk #${this.audioChunkCount}`);
                }
                this.callbacks.onAudioReceived(base64PCM, 'audio/pcm;rate=24000');
                this.scheduleAudioPlayback(base64PCM);
            });

            // ── Turn completion and interruption events (VAD-based) ────────
            socket.on('turn-complete', () => {
                log('✅ Turn complete — Gemini finished speaking');
                this.callbacks.onTurnComplete();
            });

            socket.on('interrupted', () => {
                log('⚡ Interrupted — user spoke while Gemini was speaking');
                this.stopAllAudio();
                this.callbacks.onInterrupted?.();
            });

            // ── User speech activity detection (VAD) ────────
            socket.on('user-speech-start', () => {
                log('🎤 VAD: User started speaking');
                // Notify UI that user is speaking (can be used for visual feedback)
                this.callbacks.onUserSpeechStart?.();
            });

            socket.on('user-speech-end', () => {
                log('🎤 VAD: User stopped speaking');
                // Notify UI that user finished speaking - Gemini will respond
                this.callbacks.onUserSpeechEnd?.();
            });
        });
    }

    /** Send text to Gemini via server (server calls sendClientContent) */
    sendText(text: string): void {
        if (!this.socket?.connected) return;
        log('📤 Sending text:', text.substring(0, 50));
        this.socket.emit('text-input', text);
    }

    /** Send raw PCM audio to Gemini via server (studyaid pattern: ArrayBuffer) */
    sendAudioChunk(base64PCM: string): void {
        if (!this.socket?.connected) return;
        // Decode base64 → ArrayBuffer for binary transmission
        const binaryStr = atob(base64PCM);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        this.socket.emit('audio-input', bytes.buffer);
    }

    sendAudioStreamEnd(): void {
        // VAD handles this automatically on server side
        log('📤 Audio stream paused (VAD active on server)');
    }

    disconnect(): void {
        log('Disconnecting...');
        this.intentionalDisconnect = true;
        this.socket?.disconnect();
        this.socket = null;
        this.stopAllAudio();
        this.setStatus('disconnected');
    }

    get isConnected(): boolean {
        return this.status === 'connected';
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private setStatus(status: LiveSessionStatus): void {
        this.status = status;
        log('Status →', status);
        this.callbacks.onStatusChange(status);
    }

    // ─── Gapless Audio Playback ───────────────────────────────────────────────

    private async scheduleAudioPlayback(base64: string): Promise<void> {
        try {
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new AudioContext({ sampleRate: 24000 });
                log('🔊 AudioContext created (24kHz)');
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
            }

            const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);

            const currentTime = this.audioContext.currentTime;

            // Initialize playback timeline on first chunk (studyaid pattern)
            if (this.nextPlayTime === 0) {
                this.nextPlayTime = currentTime + this.BUFFER_LOOKAHEAD;
            }

            // If we've fallen behind (e.g., due to page being backgrounded), catch up
            if (this.nextPlayTime < currentTime) {
                this.nextPlayTime = currentTime + this.BUFFER_LOOKAHEAD;
                logWarn('Audio playback fell behind, catching up...');
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(this.nextPlayTime);

            this.scheduledSources.push(source);
            source.onended = () => {
                const idx = this.scheduledSources.indexOf(source);
                if (idx !== -1) this.scheduledSources.splice(idx, 1);
                if (this.scheduledSources.length === 0) this.setSpeaking(false);
            };

            this.nextPlayTime += audioBuffer.duration;
            this.setSpeaking(true);
        } catch (e) {
            logWarn('Audio schedule error:', e);
        }
    }

    private stopAllAudio(): void {
        for (const source of this.scheduledSources) {
            try { source.onended = null; source.stop(); source.disconnect(); } catch { /* ok */ }
        }
        this.scheduledSources = [];
        this.nextPlayTime = 0;
        this.setSpeaking(false);
    }

    private setSpeaking(speaking: boolean): void {
        if (this.speakingTimeout) { clearTimeout(this.speakingTimeout); this.speakingTimeout = null; }
        if (speaking && !this.isSpeaking) {
            this.isSpeaking = true;
            this.callbacks.onSpeakingChange?.(true);
        } else if (!speaking && this.isSpeaking) {
            this.speakingTimeout = setTimeout(() => {
                this.isSpeaking = false;
                this.callbacks.onSpeakingChange?.(false);
            }, 300);
        }
    }
}

/**
 * Captures microphone audio as 16-bit PCM at 16kHz using ScriptProcessor.
 * (Same approach as studyaid/client/src/hooks/useAudioStream.js)
 */
export class PCMCapturer {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private processor: ScriptProcessorNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    public onChunk: (base64: string) => void = () => { };
    public onLevel: (level: number) => void = () => { };

    async start(): Promise<void> {
        log('🎤 Starting PCM capture...');
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

        // ScriptProcessor (same as studyaid — simpler than AudioWorklet)
        this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

        this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);

            // Float32 → Int16 PCM
            const int16 = new Int16Array(inputData.length);
            let maxAbs = 0;
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                const abs = Math.abs(inputData[i]);
                if (abs > maxAbs) maxAbs = abs;
            }

            // Base64 encode for sending
            const bytes = new Uint8Array(int16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            this.onChunk(btoa(binary));
            this.onLevel(maxAbs);
        };

        this.sourceNode.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        log('🎤 PCM capture started (16kHz, ScriptProcessor)');
    }

    stop(): void {
        log('🎤 PCM capture stopped');
        this.processor?.disconnect();
        this.sourceNode?.disconnect();
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.audioContext?.close().catch(() => { });
        this.processor = null;
        this.sourceNode = null;
        this.mediaStream = null;
        this.audioContext = null;
    }
}
