/**
 * Gemini Live API integration using WebSockets via @google/genai SDK.
 * Supports: streaming microphone audio (real-time), typed text, and receives
 * both audio (PCM 24kHz) and text transcriptions back.
 *
 * ⚠️ NOTE: API key is exposed client-side — fine for hackathon demo.
 * In production, use ephemeral tokens: https://ai.google.dev/gemini-api/docs/ephemeral-tokens
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { MIMI_SYSTEM_PROMPT } from './geminiPrompt';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// gemini-2.0-flash-live-001 is the stable Live API model
const LIVE_MODEL = 'gemini-2.0-flash-live-001';

export type LiveSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LiveMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    isPartial?: boolean;
}

export interface GeminiLiveSessionCallbacks {
    onStatusChange: (status: LiveSessionStatus) => void;
    onTextMessage: (text: string, isPartial: boolean) => void;
    onInputTranscript: (text: string) => void;
    onAudioReceived: (audioData: string, mimeType: string) => void;
    onError: (error: string) => void;
    onTurnComplete: () => void;
}

export class GeminiLiveSession {
    private ai: GoogleGenAI;
    private session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    private callbacks: GeminiLiveSessionCallbacks;
    private status: LiveSessionStatus = 'disconnected';
    private userName: string;
    private previousContext?: string;

    // Audio playback queue
    private audioContext: AudioContext | null = null;
    private audioQueue: AudioBuffer[] = [];
    private isPlayingAudio = false;

    constructor(callbacks: GeminiLiveSessionCallbacks, userName = 'Mama', previousContext?: string) {
        this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || 'demo' });
        this.callbacks = callbacks;
        this.userName = userName;
        this.previousContext = previousContext;
    }

    async connect(): Promise<boolean> {
        if (!GEMINI_API_KEY) {
            this.callbacks.onError('No Gemini API key found. Add VITE_GEMINI_API_KEY to .env');
            return false;
        }

        this.setStatus('connecting');

        try {
            const systemInstruction = MIMI_SYSTEM_PROMPT +
                `\n\nThe patient's name is ${this.userName}.` +
                (this.previousContext ? `\nPrevious session context: ${this.previousContext}` : '');

            this.session = await this.ai.live.connect({
                model: LIVE_MODEL,
                config: {
                    responseModalities: [Modality.TEXT], // TEXT so we also get transcriptions easily
                    systemInstruction,
                    inputAudioTranscription: {},   // transcribe what user says
                    outputAudioTranscription: {},  // transcribe what MIMI says
                },
                callbacks: {
                    onopen: () => {
                        this.setStatus('connected');
                    },
                    onmessage: (message: unknown) => {
                        this.handleMessage(message);
                    },
                    onerror: (e: { message: string }) => {
                        this.callbacks.onError(`Live API error: ${e.message}`);
                        this.setStatus('error');
                    },
                    onclose: (e: { reason: string }) => {
                        console.log('Live session closed:', e.reason);
                        this.setStatus('disconnected');
                    },
                },
            });

            return true;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.callbacks.onError(`Failed to connect: ${msg}`);
            this.setStatus('error');
            return false;
        }
    }

    /** Send a text message to MIMI */
    sendText(text: string): void {
        if (!this.session) return;
        this.session.sendClientContent({
            turns: text,
            turnComplete: true,
        });
    }

    /** Send raw PCM audio chunk (from MediaRecorder / AudioWorklet)
     *  data must be base64-encoded 16-bit PCM at 16kHz, mono
     */
    sendAudioChunk(base64PCM: string): void {
        if (!this.session) return;
        this.session.sendRealtimeInput({
            audio: {
                data: base64PCM,
                mimeType: 'audio/pcm;rate=16000',
            },
        });
    }

    /** Signal that the user has finished speaking */
    sendAudioEnd(): void {
        if (!this.session) return;
        // Send activity end to trigger model response
        this.session.sendRealtimeInput({ activityEnd: {} });
    }

    disconnect(): void {
        if (this.session) {
            this.session.close();
            this.session = null;
        }
        this.setStatus('disconnected');
    }

    get isConnected(): boolean {
        return this.status === 'connected';
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private setStatus(status: LiveSessionStatus) {
        this.status = status;
        this.callbacks.onStatusChange(status);
    }

    private handleMessage(message: unknown): void {
        const msg = message as Record<string, unknown>;

        // Text response from model
        if (msg.text) {
            this.callbacks.onTextMessage(msg.text as string, false);
            return;
        }

        // Server content (turn-based response)
        const serverContent = msg.serverContent as Record<string, unknown> | undefined;
        if (serverContent) {
            // Text transcription of MIMI's audio output
            const outputTranscription = serverContent.outputTranscription as { text?: string } | undefined;
            if (outputTranscription?.text) {
                this.callbacks.onTextMessage(outputTranscription.text, false);
            }

            // Transcription of user's audio input
            const inputTranscription = serverContent.inputTranscription as { text?: string } | undefined;
            if (inputTranscription?.text) {
                this.callbacks.onInputTranscript(inputTranscription.text);
            }

            // Model turn parts (inline text or audio)
            const modelTurn = serverContent.modelTurn as { parts?: unknown[] } | undefined;
            if (modelTurn?.parts) {
                for (const part of modelTurn.parts) {
                    const p = part as Record<string, unknown>;
                    if (p.text) {
                        this.callbacks.onTextMessage(p.text as string, false);
                    }
                    if (p.inlineData) {
                        const inline = p.inlineData as { data: string; mimeType: string };
                        this.callbacks.onAudioReceived(inline.data, inline.mimeType);
                        this.playAudioBase64(inline.data);
                    }
                }
            }

            // Turn complete
            if (serverContent.turnComplete) {
                this.callbacks.onTurnComplete();
            }

            // Interrupted (user interrupted MIMI)
            if (serverContent.interrupted) {
                this.stopAudio();
            }
        }
    }

    /** Decode and play audio from base64 PCM 24kHz */
    private async playAudioBase64(base64: string): Promise<void> {
        try {
            if (!this.audioContext) {
                this.audioContext = new AudioContext({ sampleRate: 24000 });
            }
            // Decode base64 → binary → ArrayBuffer
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            // Convert 16-bit PCM to Float32
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
            }
            // Create AudioBuffer
            const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);
            this.audioQueue.push(audioBuffer);
            if (!this.isPlayingAudio) {
                this.playNextFromQueue();
            }
        } catch (e) {
            console.warn('Audio decode error:', e);
        }
    }

    private playNextFromQueue(): void {
        if (!this.audioContext || this.audioQueue.length === 0) {
            this.isPlayingAudio = false;
            return;
        }
        this.isPlayingAudio = true;
        const buffer = this.audioQueue.shift()!;
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.onended = () => this.playNextFromQueue();
        source.start();
    }

    private stopAudio(): void {
        this.audioQueue = [];
        this.isPlayingAudio = false;
        // Re-create audio context to stop current playback
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

/** Capture microphone as 16-bit PCM at 16kHz using AudioWorklet */
export class PCMCapturer {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    onChunk: (base64: string) => void = () => { };

    async start(): Promise<void> {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        this.audioContext = new AudioContext({ sampleRate: 16000 });

        // Inline AudioWorklet processor to avoid a separate file
        const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            const float32 = input[0];
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
              const s = Math.max(-1, Math.min(1, float32[i]));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(int16.buffer, [int16.buffer]);
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

        this.workletNode.port.onmessage = (e: MessageEvent) => {
            const buffer = e.data as ArrayBuffer;
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            this.onChunk(base64);
        };

        this.sourceNode.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination);
    }

    stop(): void {
        this.workletNode?.disconnect();
        this.sourceNode?.disconnect();
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.audioContext?.close();
        this.workletNode = null;
        this.sourceNode = null;
        this.mediaStream = null;
        this.audioContext = null;
    }
}
