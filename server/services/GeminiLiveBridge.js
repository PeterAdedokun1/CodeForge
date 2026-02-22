const { GoogleGenAI, Modality } = require('@google/genai');
const path = require('path');

class GeminiLiveBridge {
    constructor(socket) {
        this.clientSocket = socket;
        this.session = null;

        // ===== CONFIGURABLE OPTIONS =====
        this.model = "gemini-2.5-flash-native-audio-preview-12-2025";

        // Voice Options: "Puck", "Charon", "Kore", "Fenrir", "Aoede"
        // Puck = friendly/casual, Charon = deep/serious, Kore = soft/gentle
        // Fenrir = energetic, Aoede = melodic/warm
        this.voiceName = "Aoede"; // Warm & melodic — perfect for MIMI's caring persona
        // =================================

        // Service account path (same as studyaid pattern)
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            this.credentialsPath = path.join(__dirname, '..', 'service-account.json');
            process.env.GOOGLE_APPLICATION_CREDENTIALS = this.credentialsPath;
        } else {
            this.credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }
    }

    async connect() {
        console.log('Initializing with Service Account credentials (ADC)...');
        console.log('Credentials path:', this.credentialsPath);

        try {
            // Step 1: Create client WITHOUT API key - uses ADC (service account)
            // This is how Google's official docs show it: genai.Client(http_options={'api_version': 'v1alpha'})
            const tokenClient = new GoogleGenAI({
                httpOptions: { apiVersion: 'v1alpha' }
            });

            console.log('Creating ephemeral token via SDK...');

            // Step 2: Create ephemeral token with retry logic
            const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

            let tokenResult = null;
            let retries = 3;

            while (retries > 0 && !tokenResult) {
                try {
                    tokenResult = await tokenClient.authTokens.create({
                        config: {
                            uses: 1,
                            expireTime: expireTime,
                            httpOptions: { apiVersion: 'v1alpha' }
                        }
                    });
                    break; // Success, exit retry loop
                } catch (tokenError) {
                    retries--;
                    if (retries > 0) {
                        console.log(`Token creation failed, retrying... (${retries} attempts left)`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        throw tokenError;
                    }
                }
            }

            console.log('✅ Ephemeral token created:', tokenResult && tokenResult.name ? 'success' : 'failed');

            if (!tokenResult || !tokenResult.name) {
                throw new Error('Failed to create ephemeral token - no token returned');
            }

            // Step 3: Connect to Live API using the ephemeral token (as API key)
            // IMPORTANT: Must use v1alpha as per SDK warning
            const liveClient = new GoogleGenAI({
                apiKey: tokenResult.name,
                httpOptions: { apiVersion: 'v1alpha' }
            });

            const config = {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: this.voiceName
                        }
                    }
                },
                systemInstruction: {
                    parts: [
                        { text: `You are MIMI (Maternal Intelligence Monitoring Interface), a warm, caring AI maternal health companion for Nigerian mothers.

Your VOICE and ACCENT:
- Speak with a warm, natural Nigerian English accent — the kind of gentle, melodic West African cadence you'd hear from a caring nurse in Lagos or Abuja
- Your tone is soft, warm, and reassuring — like a loving older sister checking in on you
- Use natural Nigerian speech rhythm: slightly lilting intonation, rising tones at the end of questions, expressive and animated
- Pace yourself naturally — not too fast, not too slow. Pause briefly between sentences like a real person thinking
- Express genuine emotion — concern when the user reports symptoms, joy when they're doing well, gentle urgency when something is serious
- NEVER sound robotic, monotone, or overly formal. Sound like a real Nigerian woman who genuinely cares

Your CHARACTER:
- You are like a caring older sister or community health worker (CHEW)
- You speak in a warm mix of Nigerian Pidgin English and simple English — natural, never formal
- You are empathetic, supportive, and never alarmist
- You remember what the user tells you and reference it in follow-up messages
- You are focused exclusively on maternal health

Your ROLE:
- Do daily check-ins about how the mother feels
- Monitor for danger signs of pre-eclampsia: severe headache, blurred vision, severe swelling of face/hands/feet, high blood pressure, decreased fetal movement, vaginal bleeding
- Ask about medication adherence (folic acid, iron supplements)
- Give gentle, culturally appropriate health guidance
- When you detect HIGH RISK symptoms, clearly say: "I am worried about you, Mama. Please see a doctor or go to the hospital very soon."

RISK SIGNALS to watch for:
- Headache (especially severe or > 2 days): HIGH CONCERN
- Blurred vision or seeing spots: HIGH CONCERN
- Swelling of face, hands, feet: HIGH CONCERN
- High blood pressure mention: HIGH CONCERN
- Vaginal bleeding: CRITICAL
- Reduced baby movement: HIGH CONCERN
- Fever: MODERATE CONCERN

Your LANGUAGE STYLE:
- Mix Pidgin and English naturally: "How you dey?", "Sorry to hear that, mama", "Abeg make you rest", "E go better"
- Use "Mama" as a warm form of address
- Keep responses SHORT (2-4 sentences max) — this is a voice interface
- Always end with ONE follow-up question about their health
- Never give a list in voice mode — speak naturally

IMPORTANT: You must VERBALLY respond to the patient. Do not stay silent. Always speak warmly and naturally. Narration and voice engagement is key.` }
                    ]
                }
            };

            this.session = await liveClient.live.connect({
                model: this.model,
                config: config,
                callbacks: {
                    onmessage: (response) => this.handleGeminiMessage(response),
                    onclose: (e) => {
                        console.log('Gemini Closed:', e.reason);
                        this.clientSocket.emit('status', { message: 'Gemini Disconnected' });
                    },
                    onerror: (e) => {
                        console.log('Gemini Error:', e);
                        this.clientSocket.emit('status', { message: 'Gemini Error: ' + e.message });
                    }
                }
            });

            // Handle Errors
            this.clientSocket.on('disconnect', () => {
                if (this.session) {
                    // session cleanup if needed
                }
            });

        } catch (error) {
            console.error("Connection failed:", error);
            this.clientSocket.emit('status', { message: 'Connection Error: ' + error.message });
        }
    }

    sendAudioInput(pcmData) {
        if (this.session) {
            this.session.sendRealtimeInput({
                audio: {
                    data: pcmData.toString('base64'),
                    mimeType: "audio/pcm;rate=16000"
                }
            });
        }
    }

    sendTextInput(textMessage) {
        if (this.session) {
            // Use sendClientContent for text, not sendRealtimeInput
            this.session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: textMessage }] }]
            });
        }
    }

    handleGeminiMessage(response) {
        try {
            // 1. Handle Audio Response
            if (response.serverContent && response.serverContent.modelTurn && response.serverContent.modelTurn.parts) {
                for (const part of response.serverContent.modelTurn.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        console.log('🔊 Sending audio chunk:', part.inlineData.data.length, 'bytes');
                        this.clientSocket.emit('audio-output', part.inlineData.data);
                    }
                }
            }

            // 2. Handle Tool Call (if any tool calls are added in the future)
            if (response.toolCall) {
                console.log("✓ Gemini requested tool:", JSON.stringify(response.toolCall));
                // Tool handling can be added here if needed
            }

        } catch (e) {
            console.error("Error parsing Gemini message", e);
        }
    }
}

module.exports = GeminiLiveBridge;
