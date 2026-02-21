import { RiskData } from './gemini';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
    score: number;         // 0-100
    level: RiskLevel;
    flags: RiskFlag[];
    recommendation: string;
    requiresAlert: boolean;
}

export interface RiskFlag {
    name: string;
    severity: 'warning' | 'danger' | 'critical';
    description: string;
}

/**
 * Rule-based maternal risk scoring engine.
 * 
 * Evidence-based rules aligned with WHO antenatal danger signs:
 * - Pre-eclampsia indicators (headache + swelling + BP)
 * - Imminent eclampsia signs (blurred vision)
 * - Placental abruption (bleeding)
 * - Fetal distress (reduced movement)
 */
export function calculateRisk(
    riskData: Partial<RiskData>,
    storedHistory?: StoredRiskHistory
): RiskAssessment {
    const flags: RiskFlag[] = [];
    let score = 0;

    // ─── RULE 1: Severe headache (pre-eclampsia indicator) ───────────────────
    if (riskData.headache !== undefined) {
        if (riskData.headache >= 3) {
            score += 25;
            flags.push({
                name: 'Severe Headache',
                severity: 'danger',
                description: 'Severe persistent headache is a key pre-eclampsia warning sign'
            });
        } else if (riskData.headache === 2) {
            score += 15;
            flags.push({
                name: 'Moderate Headache',
                severity: 'warning',
                description: 'Recurring headache requires monitoring'
            });
        } else if (riskData.headache === 1) {
            score += 5;
        }
    }

    // ─── RULE 2: Blurred vision (eclampsia imminent sign) ────────────────────
    if (riskData.blurredVision !== undefined && riskData.blurredVision > 0) {
        score += 30;
        flags.push({
            name: 'Blurred Vision / Seeing Spots',
            severity: 'critical',
            description: 'Visual disturbances indicate possible eclampsia — URGENT care needed'
        });
    }

    // ─── RULE 3: Swelling (pre-eclampsia) ────────────────────────────────────
    if (riskData.swelling !== undefined) {
        if (riskData.swelling >= 2) {
            score += 20;
            flags.push({
                name: 'Significant Swelling',
                severity: 'danger',
                description: 'Swelling of face/hands/feet is a pre-eclampsia warning sign'
            });
        } else if (riskData.swelling === 1) {
            score += 8;
            flags.push({
                name: 'Mild Swelling',
                severity: 'warning',
                description: 'Monitor swelling — report if it worsens'
            });
        }
    }

    // ─── RULE 4: High blood pressure ─────────────────────────────────────────
    if (riskData.highBP !== undefined && riskData.highBP > 0) {
        score += 25;
        flags.push({
            name: 'High Blood Pressure',
            severity: 'danger',
            description: 'Hypertension in pregnancy requires immediate medical attention'
        });
    }

    // ─── RULE 5: Vaginal bleeding (CRITICAL) ─────────────────────────────────
    if (riskData.bleeding !== undefined && riskData.bleeding > 0) {
        score += 40;
        flags.push({
            name: 'Vaginal Bleeding',
            severity: 'critical',
            description: 'Any vaginal bleeding requires immediate emergency care'
        });
    }

    // ─── RULE 6: Fever ───────────────────────────────────────────────────────
    if (riskData.fever !== undefined && riskData.fever > 0) {
        score += 15;
        flags.push({
            name: 'Fever',
            severity: 'warning',
            description: 'Fever during pregnancy can indicate infection'
        });
    }

    // ─── RULE 7: Reduced fetal movement ──────────────────────────────────────
    if (riskData.reducedMovement !== undefined && riskData.reducedMovement > 0) {
        score += 25;
        flags.push({
            name: 'Reduced Baby Movement',
            severity: 'danger',
            description: 'Decreased fetal movement may indicate fetal distress'
        });
    }

    // ─── RULE 8: Combined pre-eclampsia triad (headache + swelling + BP) ─────
    const preEclampsiaTrifecta =
        (riskData.headache ?? 0) >= 2 &&
        (riskData.swelling ?? 0) >= 1 &&
        (riskData.highBP ?? 0) > 0;

    if (preEclampsiaTrifecta) {
        score += 20; // Bonus penalty for combined presentation
        flags.push({
            name: 'Pre-Eclampsia Pattern Detected',
            severity: 'critical',
            description: 'The combination of headache, swelling, and high BP strongly suggests pre-eclampsia'
        });
    }

    // ─── RULE 9: History amplifier ───────────────────────────────────────────
    if (storedHistory?.previousHighRisk) {
        score = Math.min(score * 1.2, 100); // 20% amplifier for repeat high risk
    }

    // ─── RULE 10: Late gestation amplifier (3rd trimester = higher risk) ──────
    if (riskData.daysPregnant && riskData.daysPregnant >= 196) { // 28+ weeks
        if (score > 20) score = Math.min(score * 1.15, 100);
    }

    // Cap at 100
    score = Math.min(Math.round(score), 100);

    // Determine level
    let level: RiskLevel;
    let recommendation: string;
    let requiresAlert = false;

    if (score >= 70 || flags.some(f => f.severity === 'critical')) {
        level = 'critical';
        requiresAlert = true;
        recommendation = 'Please go to the hospital immediately. Your symptoms are very serious. A CHEW worker is being notified now.';
    } else if (score >= 45) {
        level = 'high';
        requiresAlert = true;
        recommendation = 'Your symptoms are concerning. Please visit a health facility today and contact your CHEW worker.';
    } else if (score >= 20) {
        level = 'medium';
        recommendation = 'Monitor your symptoms closely. If they worsen, please contact your CHEW worker.';
    } else {
        level = 'low';
        recommendation = 'You are doing well! Keep taking your supplements and attend your antenatal appointments.';
    }

    return { score, level, flags, recommendation, requiresAlert };
}

export interface StoredRiskHistory {
    previousHighRisk: boolean;
    lastScore: number;
    scoreHistory: Array<{ date: string; score: number }>;
}

/**
 * Merge new risk data with cumulative stored data
 */
export function mergeRiskData(existing: Partial<RiskData>, incoming: Partial<RiskData>): Partial<RiskData> {
    return {
        headache: Math.max(existing.headache ?? 0, incoming.headache ?? 0),
        blurredVision: Math.max(existing.blurredVision ?? 0, incoming.blurredVision ?? 0),
        swelling: Math.max(existing.swelling ?? 0, incoming.swelling ?? 0),
        highBP: Math.max(existing.highBP ?? 0, incoming.highBP ?? 0),
        bleeding: Math.max(existing.bleeding ?? 0, incoming.bleeding ?? 0),
        fever: Math.max(existing.fever ?? 0, incoming.fever ?? 0),
        reducedMovement: Math.max(existing.reducedMovement ?? 0, incoming.reducedMovement ?? 0),
        daysPregnant: incoming.daysPregnant ?? existing.daysPregnant ?? 0,
    };
}

export function getRiskColor(level: RiskLevel): string {
    switch (level) {
        case 'critical': return '#DC2626'; // red-600
        case 'high': return '#EA580C';     // orange-600
        case 'medium': return '#D97706';   // amber-600
        case 'low': return '#16A34A';      // green-600
    }
}

export function getRiskBgClass(level: RiskLevel): string {
    switch (level) {
        case 'critical': return 'bg-red-100 border-red-500 text-red-800';
        case 'high': return 'bg-orange-100 border-orange-500 text-orange-800';
        case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
        case 'low': return 'bg-green-100 border-green-500 text-green-800';
    }
}
