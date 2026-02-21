import { MIMI_SYSTEM_PROMPT } from './geminiPrompt';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

export interface ConversationMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

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
