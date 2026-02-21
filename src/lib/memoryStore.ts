/**
 * Persistent memory store for MIMI conversations.
 * Uses localStorage so memory survives page reloads and app restarts.
 */

import { ConversationMessage, RiskData } from './gemini';
import { RiskLevel } from './riskEngine';

const STORAGE_PREFIX = 'mimi_';

export interface UserSession {
    userId: string;
    name: string;
    age?: number;
    gestationalWeek?: number;
    location?: string;
    phone?: string;
    createdAt: string;
    lastSeen: string;
}

export interface ConversationSession {
    id: string;
    userId: string;
    startedAt: string;
    endedAt?: string;
    messages: StoredMessage[];
    riskScore: number;
    riskLevel: RiskLevel;
    cumulativeRiskData: Partial<RiskData>;
    summaryContext: string; // Short text summary for next session's memory
}

export interface StoredMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    riskData?: Partial<RiskData>;
}

// ─── User Session Management ─────────────────────────────────────────────────

export function saveUser(user: UserSession): void {
    localStorage.setItem(`${STORAGE_PREFIX}user_${user.userId}`, JSON.stringify(user));
    localStorage.setItem(`${STORAGE_PREFIX}current_user_id`, user.userId);
}

export function getCurrentUser(): UserSession | null {
    const userId = localStorage.getItem(`${STORAGE_PREFIX}current_user_id`);
    if (!userId) return null;
    return getUser(userId);
}

export function getUser(userId: string): UserSession | null {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}user_${userId}`);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as UserSession;
    } catch {
        return null;
    }
}

export function updateUserLastSeen(userId: string): void {
    const user = getUser(userId);
    if (user) {
        user.lastSeen = new Date().toISOString();
        saveUser(user);
    }
}

export function clearSession(): void {
    localStorage.removeItem(`${STORAGE_PREFIX}current_user_id`);
}

// ─── Conversation Session Management ─────────────────────────────────────────

export function startConversationSession(userId: string): ConversationSession {
    const session: ConversationSession = {
        id: `session_${Date.now()}`,
        userId,
        startedAt: new Date().toISOString(),
        messages: [],
        riskScore: 0,
        riskLevel: 'low',
        cumulativeRiskData: {},
        summaryContext: ''
    };
    saveConversationSession(session);
    setCurrentSessionId(session.id);
    return session;
}

export function saveConversationSession(session: ConversationSession): void {
    localStorage.setItem(`${STORAGE_PREFIX}session_${session.id}`, JSON.stringify(session));
}

export function getCurrentSession(): ConversationSession | null {
    const sessionId = localStorage.getItem(`${STORAGE_PREFIX}current_session_id`);
    if (!sessionId) return null;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}session_${sessionId}`);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as ConversationSession;
    } catch {
        return null;
    }
}

export function setCurrentSessionId(sessionId: string): void {
    localStorage.setItem(`${STORAGE_PREFIX}current_session_id`, sessionId);
}

export function addMessageToSession(
    session: ConversationSession,
    role: 'user' | 'assistant',
    content: string,
    riskData?: Partial<RiskData>
): ConversationSession {
    const message: StoredMessage = {
        role,
        content,
        timestamp: new Date().toISOString(),
        riskData
    };
    const updated = {
        ...session,
        messages: [...session.messages, message]
    };
    saveConversationSession(updated);
    return updated;
}

export function updateSessionRisk(
    session: ConversationSession,
    riskScore: number,
    riskLevel: RiskLevel,
    cumulativeRiskData: Partial<RiskData>
): ConversationSession {
    const updated = {
        ...session,
        riskScore,
        riskLevel,
        cumulativeRiskData
    };
    saveConversationSession(updated);
    return updated;
}

// ─── Previous Session Context ─────────────────────────────────────────────────

export function getPreviousSessionContext(userId: string): string | undefined {
    // Get all sessions for this user, sorted by date
    const sessions = getAllUserSessions(userId);
    if (sessions.length === 0) return undefined;

    const lastSession = sessions[sessions.length - 1];

    if (lastSession.riskScore > 20) {
        return `Last time (${new Date(lastSession.startedAt).toLocaleDateString()}), her risk score was ${lastSession.riskScore}/100 (${lastSession.riskLevel} risk). ${lastSession.summaryContext}`;
    }

    // Build context from recent symptoms
    const recentSymptoms = lastSession.messages
        .filter(m => m.role === 'user' && m.content.length > 5)
        .slice(-3)
        .map(m => m.content)
        .join('; ');

    if (recentSymptoms) {
        return `Last session: ${new Date(lastSession.startedAt).toLocaleDateString()}. Patient reported: ${recentSymptoms}`;
    }

    return undefined;
}

export function getAllUserSessions(userId: string): ConversationSession[] {
    const sessions: ConversationSession[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(`${STORAGE_PREFIX}session_`)) continue;
        try {
            const session = JSON.parse(localStorage.getItem(key)!) as ConversationSession;
            if (session.userId === userId) {
                sessions.push(session);
            }
        } catch {
            // Skip corrupt entries
        }
    }
    return sessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

// ─── Gemini conversation history format ──────────────────────────────────────

export function sessionToGeminiHistory(session: ConversationSession): ConversationMessage[] {
    return session.messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
}

// ─── Generate Summary Context ─────────────────────────────────────────────────
export function generateSummaryContext(session: ConversationSession): string {
    const parts: string[] = [];

    if (session.riskLevel === 'high' || session.riskLevel === 'critical') {
        parts.push(`Had ${session.riskLevel} risk (score: ${session.riskScore})`);
    }

    const rd = session.cumulativeRiskData;
    if (rd.headache && rd.headache > 0) parts.push('reported headache');
    if (rd.swelling && rd.swelling > 0) parts.push('reported swelling');
    if (rd.blurredVision && rd.blurredVision > 0) parts.push('reported blurred vision');
    if (rd.highBP && rd.highBP > 0) parts.push('had high blood pressure');

    return parts.join(', ');
}

// Global alert store for CHEW dashboard integration
export interface LivePatientAlert {
    patientId: string;
    patientName: string;
    riskScore: number;
    riskLevel: RiskLevel;
    symptoms: string[];
    timestamp: string;
    location?: string;
}

export function saveLivePatientAlert(alert: LivePatientAlert): void {
    const existing = getLivePatientAlerts();
    const idx = existing.findIndex(a => a.patientId === alert.patientId);
    if (idx >= 0) {
        existing[idx] = alert;
    } else {
        existing.push(alert);
    }
    localStorage.setItem(`${STORAGE_PREFIX}live_alerts`, JSON.stringify(existing));
}

export function getLivePatientAlerts(): LivePatientAlert[] {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}live_alerts`);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as LivePatientAlert[];
    } catch {
        return [];
    }
}

export function clearLiveAlert(patientId: string): void {
    const existing = getLivePatientAlerts().filter(a => a.patientId !== patientId);
    localStorage.setItem(`${STORAGE_PREFIX}live_alerts`, JSON.stringify(existing));
}
