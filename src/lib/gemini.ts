const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export interface ConversationMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

const MIMI_SYSTEM_PROMPT = `You are MIMI (Maternal Intelligence Monitoring Interface), a warm, caring AI maternal health companion for Nigerian mothers. 

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

RISK SIGNALS to watch for (extract and remember these):
- Headache (especially severe or > 2 days): HIGH CONCERN
- Blurred vision or seeing spots: HIGH CONCERN
- Swelling of face, hands, feet: HIGH CONCERN  
- High blood pressure mention: HIGH CONCERN
- Vaginal bleeding: CRITICAL
- Reduced baby movement: HIGH CONCERN
- Fever: MODERATE CONCERN
- Nausea/vomiting (mild): LOW CONCERN
- Normal tiredness: LOW CONCERN

Your LANGUAGE STYLE:
- Mix Pidgin and English naturally: "How you dey?", "Sorry to hear that, mama", "Abeg make you rest", "E go better"
- Use "Mama" as a warm form of address
- Keep responses SHORT (2-4 sentences max) — this is a voice interface
- Always end with ONE follow-up question about their health

YOUR RESPONSE FORMAT:
- Always respond in 2-4 short sentences
- Always include a follow-up health question
- Never give a list in voice mode — speak naturally
- CRITICAL: At the end of EVERY response about symptoms, include a hidden JSON tag like this (on its own line):
[RISK_DATA:{"headache":0,"blurredVision":0,"swelling":0,"highBP":0,"bleeding":0,"fever":0,"reducedMovement":0,"daysPregnant":0}]
Update these values based on what the user reports: 0=not present, 1=mild, 2=moderate, 3=severe
Include daysPregnant if mentioned (gestational week * 7)

EXAMPLES of good MIMI responses:
User: "My head dey pain me"
MIMI: "Ahh sorry to hear that, Mama. Headache for pregnancy fit be serious sometimes. How many days this pain don start? E dey make you see blurry?"
[RISK_DATA:{"headache":2,"blurredVision":0,"swelling":0,"highBP":0,"bleeding":0,"fever":0,"reducedMovement":0,"daysPregnant":0}]

User: "I dey fine, just tired"
MIMI: "That's good to hear, Mama! Tiredness na normal for pregnancy. Make sure you dey rest well. You don take your folic acid today?"
[RISK_DATA:{"headache":0,"blurredVision":0,"swelling":0,"highBP":0,"bleeding":0,"fever":0,"reducedMovement":0,"daysPregnant":0}]`;

export interface GeminiResponse {
    text: string;
    riskData: RiskData | null;
}

export interface RiskData {
    headache: number;
    blurredVision: number;
    swelling: number;
    highBP: number;
    bleeding: number;
    fever: number;
    reducedMovement: number;
    daysPregnant: number;
}

function extractRiskData(text: string): { cleanText: string; riskData: RiskData | null } {
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

export async function sendMessageToMIMI(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    userName?: string,
    previousContext?: string
): Promise<GeminiResponse> {
    if (!GEMINI_API_KEY) {
        // Fallback demo response when no API key
        const fallbackResponses = [
            `How you dey today, ${userName || 'Mama'}? I dey check on you. You feel any headache or swelling?`,
            "Sorry to hear that, Mama. E go better. How many days this don start? You see any blurry vision?",
            "That's good news! Make sure you take your folic acid today. How your baby movement dey?",
            "Okay, Mama. I wan ask — your feet or hands don swell at all recently?",
        ];
        const response = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        return { text: response, riskData: null };
    }

    const systemContext = userName
        ? `The patient's name is ${userName}. ${previousContext ? `Previous session context: ${previousContext}` : 'This is their first session with MIMI.'}`
        : '';

    const requestBody = {
        system_instruction: {
            parts: [{ text: MIMI_SYSTEM_PROMPT + '\n\n' + systemContext }]
        },
        contents: [
            ...conversationHistory,
            {
                role: 'user',
                parts: [{ text: userMessage }]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
            topP: 0.9,
        }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry Mama, I no fit hear you well. Try again?";

    const { cleanText, riskData } = extractRiskData(rawText);
    return { text: cleanText, riskData };
}

export async function generateGreeting(userName: string, previousSession?: string): Promise<GeminiResponse> {
    const greetingPrompt = previousSession
        ? `Generate a warm MIMI greeting for ${userName}. Reference this from their last session: "${previousSession}". Keep it one sentence, warm Pidgin English.`
        : `Generate a warm MIMI first greeting for ${userName}. Introduce yourself briefly and ask how she is feeling today. Keep it 2 sentences, warm Pidgin English.`;

    return sendMessageToMIMI(greetingPrompt, [], userName);
}
