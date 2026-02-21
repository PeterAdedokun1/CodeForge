/**
 * Gemini Live API — pure WebSocket implementation for the browser.
 *
 * The @google/genai SDK uses Node.js globals (process, ws) that break in Vite.
 * This implementation uses the native browser WebSocket directly, which is
 * exactly how the Gemini Live API works underneath.
 *
 * Protocol reference:
 * https://ai.google.dev/api/generate-content#v1beta.BidiGenerateContent
 *
 * ⚠️ API key is in the URL — fine for hackathon demo (use ephemeral tokens in prod)
 */

import { MIMI_SYSTEM_PROMPT } from './geminiPrompt';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Stable Gemini Live model
const LIVE_MODEL = 'gemini-2.0-flash-live-001';
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

export type LiveSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GeminiLiveSessionCallbacks {
    onStatusChange: (status: LiveSessionStatus) => void;
    onTextMessage: (text: string, isPartial: boolean) => void;
    onInputTranscript: (text: string) => void;
    onAudioReceived: (audioData: string, mimeType: string) => void;
    onError: (error: string) => void;
    onTurnComplete: () => void;
}

export class GeminiLiveSession {
    private ws: WebSocket | null = null;
    private callbacks: GeminiLiveSessionCallbacks;
    private status: LiveSessionStatus = 'disconnected';
    private userName: string;
    private previousContext?: string;
    private setupSent = false;

    // Audio playback
    private audioContext: AudioContext | null = null;
    private audioQueue: AudioBuffer[] = [];
    private isPlayingAudio = false;

    constructor(
        callbacks: GeminiLiveSessionCallbacks,
        userName = 'Mama',
        previousContext?: string
    ) {
        this.callbacks = callbacks;
        this.userName = userName;
        this.previousContext = previousContext;
    }

    async connect(): Promise<boolean> {
        if (!GEMINI_API_KEY) {
            this.callbacks.onError('No API key. Add VITE_GEMINI_API_KEY to .env');
            return false;
        }

        this.setStatus('connecting');

        return new Promise((resolve) => {
            try {
                this.ws = new WebSocket(WS_URL);

                this.ws.onopen = () => {
                    this.sendSetup();
                };

                this.ws.onmessage = (event: MessageEvent) => {
                    this.handleMessage(event.data as string);
                };

                this.ws.onerror = () => {
                    this.callbacks.onError(
                        'Gemini Live WebSocket error — falling back to standard mode'
                    );
                    this.setStatus('error');
                    resolve(false);
                };

                this.ws.onclose = (event) => {
                    if (this.status === 'connecting' || this.status === 'connected') {
                        console.log('Live session closed:', event.code, event.reason);
                        this.setStatus('disconnected');
                    }
                    resolve(false);
                };

                // Resolve true once we send setup successfully (onopen fires)
                const origOpen = this.ws.onopen;
                this.ws.onopen = (ev) => {
                    if (origOpen) (origOpen as (ev: Event) => void)(ev);
                    resolve(true);
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.callbacks.onError(`WebSocket connect failed: ${msg}`);
                this.setStatus('error');
                resolve(false);
            }
        });
    }

    /** Send the BidiGenerateContent setup message */
    private sendSetup() {
        const systemInstruction =
            MIMI_SYSTEM_PROMPT +
            `\n\nThe patient's name is ${this.userName}.` +
            (this.previousContext
                ? `\nContext from last session: ${this.previousContext}`
                : '');

        const setupMsg = {
            setup: {
                model: `models/${LIVE_MODEL}`,
                generation_config: {
                    response_modalities: ['TEXT'],
                    temperature: 0.75,
                },
                system_instruction: {
                    parts: [{ text: systemInstruction }],
                },
                input_audio_transcription: {},
                output_audio_transcription: {},
            },
        };

        this.send(setupMsg);
        // Status gets set to 'connected' after server sends setupComplete
    }

    /** Send a text message to MIMI */
    sendText(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            client_content: {
                turns: [
                    {
                        role: 'user',
                        parts: [{ text }],
                    },
                ],
                turn_complete: true,
            },
        };
        this.send(msg);
    }

    /** Send a raw base64 PCM audio chunk (16kHz, 16-bit, mono) */
    sendAudioChunk(base64PCM: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            realtime_input: {
                media_chunks: [
                    {
                        data: base64PCM,
                        mime_type: 'audio/pcm;rate=16000',
                    },
                ],
            },
        };
        this.send(msg);
    }

    /** Signal that the user finished speaking */
    sendAudioEnd(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.send({ realtime_input: { activity_end: {} } });
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.onclose = null; // Prevent triggering status changes
            this.ws.close();
            this.ws = null;
        }
        this.stopAudio();
        this.setStatus('disconnected');
    }

    get isConnected(): boolean {
        return this.status === 'connected';
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private send(data: unknown): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    private setStatus(status: LiveSessionStatus): void {
        this.status = status;
        this.callbacks.onStatusChange(status);
    }

    private handleMessage(rawData: string): void {
        let msg: Record<string, unknown>;
        try {
            msg = JSON.parse(rawData) as Record<string, unknown>;
        } catch {
            return;
        }

        // Setup complete → Now we're officially connected
        if (msg.setupComplete !== undefined && !this.setupSent) {
            this.setupSent = true;
            this.setStatus('connected');
            return;
        }

        // Server content (model response)
        const serverContent = msg.serverContent as Record<string, unknown> | undefined;
        if (serverContent) {
            // Model text parts
            const modelTurn = serverContent.modelTurn as { parts?: unknown[] } | undefined;
            if (modelTurn?.parts) {
                for (const part of modelTurn.parts) {
                    const p = part as Record<string, unknown>;
                    if (typeof p.text === 'string' && p.text) {
                        this.callbacks.onTextMessage(p.text, true);
                    }
                    if (p.inlineData) {
                        const inline = p.inlineData as { data: string; mimeType: string };
                        this.callbacks.onAudioReceived(inline.data, inline.mimeType);
                        this.playAudioBase64(inline.data);
                    }
                }
            }

            // Output transcription (what MIMI said, transcribed)
            const outputTrans = serverContent.outputTranscription as { text?: string } | undefined;
            if (outputTrans?.text) {
                this.callbacks.onTextMessage(outputTrans.text, false);
            }

            // Input transcription (what user said, transcribed)
            const inputTrans = serverContent.inputTranscription as { text?: string } | undefined;
            if (inputTrans?.text) {
                this.callbacks.onInputTranscript(inputTrans.text);
            }

            // Turn complete
            if (serverContent.turnComplete) {
                this.callbacks.onTurnComplete();
            }

            // Interrupted
            if (serverContent.interrupted) {
                this.stopAudio();
            }
        }

        // Top-level text (some responses come here)
        if (typeof msg.text === 'string' && msg.text) {
            this.callbacks.onTextMessage(msg.text, false);
        }
    }

    /** Decode and play 24kHz PCM audio from Gemini */
    private async playAudioBase64(base64: string): Promise<void> {
        try {
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new AudioContext({ sampleRate: 24000 });
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Convert 16-bit PCM → Float32
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
            }

            const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);
            this.audioQueue.push(audioBuffer);

            if (!this.isPlayingAudio) {
                this.playNextFromQueue();
            }
        } catch (e) {
            console.warn('Audio decode/play error:', e);
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
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(() => { });
            this.audioContext = null;
        }
    }
}

/**
 * Captures microphone audio as 16-bit PCM at 16kHz using AudioWorklet.
 * Streams chunks back via `onChunk(base64)` callback.
 */
export class PCMCapturer {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    public onChunk: (base64: string) => void = () => { };
    public onLevel: (level: number) => void = () => { };

    async start(): Promise<void> {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        this.audioContext = new AudioContext({ sampleRate: 16000 });

        // Inline AudioWorklet — converts Float32 mic input to Int16 PCM chunks
        const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this._buffer = [];
          this._bufferSize = 2048; // ~128ms at 16kHz
        }
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            const float32 = input[0];
            for (let i = 0; i < float32.length; i++) {
              this._buffer.push(float32[i]);
            }
            if (this._buffer.length >= this._bufferSize) {
              const chunk = this._buffer.splice(0, this._bufferSize);
              const int16 = new Int16Array(chunk.length);
              for (let i = 0; i < chunk.length; i++) {
                const s = Math.max(-1, Math.min(1, chunk[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              this.port.postMessage({ pcm: int16.buffer, level: Math.max(...chunk.map(Math.abs)) }, [int16.buffer]);
            }
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;

        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(blobUrl);
        URL.revokeObjectURL(blobUrl);

        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

        this.workletNode.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
            const buffer = e.data.pcm;
            const level = e.data.level;
            // base64-encode the raw ArrayBuffer
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            this.onChunk(btoa(binary));
            this.onLevel(level);
        };

        this.sourceNode.connect(this.workletNode);
        // Don't connect workletNode to destination — we don't want mic playback
    }

    stop(): void {
        this.workletNode?.disconnect();
        this.sourceNode?.disconnect();
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.audioContext?.close().catch(() => { });
        this.workletNode = null;
        this.sourceNode = null;
        this.mediaStream = null;
        this.audioContext = null;
    }
}
