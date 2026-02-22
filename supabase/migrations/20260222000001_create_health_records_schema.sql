-- ============================================================================
-- MIMI Health Records Schema
-- Persistent storage for patient health data extracted from conversations
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- PATIENTS TABLE
-- Core patient profile information
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Basic info
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INTEGER,
    location VARCHAR(255),
    
    -- Pregnancy-specific
    gestational_week INTEGER,
    expected_delivery_date DATE,
    gravida INTEGER, -- Number of pregnancies
    para INTEGER,    -- Number of births
    
    -- Medical history flags
    has_hypertension BOOLEAN DEFAULT FALSE,
    has_diabetes BOOLEAN DEFAULT FALSE,
    has_previous_preeclampsia BOOLEAN DEFAULT FALSE,
    blood_type VARCHAR(10),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_conversation_at TIMESTAMPTZ,
    
    -- For offline sync
    local_id VARCHAR(100) UNIQUE, -- Maps to localStorage userId
    sync_status VARCHAR(20) DEFAULT 'synced'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONVERSATIONS TABLE
-- Full conversation records with transcripts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Content
    transcript_json JSONB, -- Array of {role, content, timestamp}
    summary TEXT,          -- AI-generated conversation summary
    
    -- Risk assessment at end of conversation
    final_risk_score INTEGER,
    final_risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    
    -- Processing status
    extraction_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    extracted_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- HEALTH_RECORDS TABLE
-- Extracted health entities from conversations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- When this record applies to
    record_date DATE DEFAULT CURRENT_DATE,
    gestational_week_at_record INTEGER,
    
    -- Extracted health data (JSONB for flexibility)
    conditions JSONB DEFAULT '[]',     -- [{name, severity, notes}]
    symptoms JSONB DEFAULT '[]',       -- [{name, severity, duration, frequency}]
    vitals JSONB DEFAULT '{}',         -- {bloodPressure, temperature, weight, fetalHeartRate}
    medications JSONB DEFAULT '[]',    -- [{name, dosage, frequency, adherence}]
    lifestyle JSONB DEFAULT '{}',      -- {diet, exercise, sleep, stress}
    
    -- AI insights
    ai_assessment TEXT,                -- AI's interpretation of the conversation
    recommendations JSONB DEFAULT '[]', -- What MIMI recommended
    follow_up_needed BOOLEAN DEFAULT FALSE,
    follow_up_reason TEXT,
    follow_up_urgency VARCHAR(20),     -- 'routine', 'soon', 'urgent', 'emergency'
    
    -- For medical personnel
    clinical_notes TEXT,               -- Formatted for medical handoff
    icd_codes JSONB DEFAULT '[]',      -- Suggested ICD-10 codes
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RISK_ASSESSMENTS TABLE
-- Historical risk tracking per conversation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- Risk data
    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL,   -- 'low', 'medium', 'high', 'critical'
    
    -- Contributing factors
    flags JSONB DEFAULT '[]',          -- [{name, severity, contribution}]
    danger_signs JSONB DEFAULT '[]',   -- WHO danger signs detected
    
    -- Pre-eclampsia specific
    preeclampsia_indicators JSONB DEFAULT '{}', -- {headache, vision, swelling, bp, proteinuria}
    
    -- Context
    gestational_week INTEGER,
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Actions taken
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_to VARCHAR(255),        -- CHEW ID or hospital
    alert_acknowledged BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHEW_ALERTS TABLE
-- Alerts sent to Community Health Extension Workers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chew_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    risk_assessment_id UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL,   -- 'high_risk', 'critical', 'follow_up', 'routine_check'
    priority VARCHAR(20) NOT NULL,     -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Patient context for CHEW
    patient_summary TEXT,              -- Quick summary for CHEW
    recommended_actions JSONB DEFAULT '[]',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'acknowledged', 'in_progress', 'resolved', 'escalated'
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Escalation
    escalated_to_hospital BOOLEAN DEFAULT FALSE,
    hospital_referral_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_patients_local_id ON patients(local_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_conversations_patient ON conversations(patient_id);
CREATE INDEX idx_conversations_started ON conversations(started_at DESC);
CREATE INDEX idx_health_records_patient ON health_records(patient_id);
CREATE INDEX idx_health_records_date ON health_records(record_date DESC);
CREATE INDEX idx_risk_assessments_patient ON risk_assessments(patient_id);
CREATE INDEX idx_risk_assessments_level ON risk_assessments(risk_level);
CREATE INDEX idx_chew_alerts_status ON chew_alerts(status);
CREATE INDEX idx_chew_alerts_priority ON chew_alerts(priority);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chew_alerts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for server-side access)
CREATE POLICY "Service role full access to patients" ON patients
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to conversations" ON conversations
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to health_records" ON health_records
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to risk_assessments" ON risk_assessments
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to chew_alerts" ON chew_alerts
    FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_records_updated_at
    BEFORE UPDATE ON health_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chew_alerts_updated_at
    BEFORE UPDATE ON chew_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get patient context for AI
CREATE OR REPLACE FUNCTION get_patient_context(p_patient_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
    patient_info JSONB,
    recent_records JSONB,
    recent_conversations JSONB,
    risk_history JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Patient info
        (SELECT jsonb_build_object(
            'name', p.name,
            'age', p.age,
            'gestationalWeek', p.gestational_week,
            'location', p.location,
            'hasHypertension', p.has_hypertension,
            'hasDiabetes', p.has_diabetes,
            'hasPreviousPreeclampsia', p.has_previous_preeclampsia
        ) FROM patients p WHERE p.id = p_patient_id) AS patient_info,
        
        -- Recent health records
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'date', hr.record_date,
            'conditions', hr.conditions,
            'symptoms', hr.symptoms,
            'vitals', hr.vitals,
            'medications', hr.medications,
            'recommendations', hr.recommendations,
            'followUpNeeded', hr.follow_up_needed
        ) ORDER BY hr.record_date DESC), '[]'::jsonb)
        FROM (SELECT * FROM health_records WHERE patient_id = p_patient_id ORDER BY record_date DESC LIMIT p_limit) hr) AS recent_records,
        
        -- Recent conversation summaries
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'date', c.started_at,
            'summary', c.summary,
            'riskLevel', c.final_risk_level
        ) ORDER BY c.started_at DESC), '[]'::jsonb)
        FROM (SELECT * FROM conversations WHERE patient_id = p_patient_id AND summary IS NOT NULL ORDER BY started_at DESC LIMIT p_limit) c) AS recent_conversations,
        
        -- Risk history
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'date', ra.assessed_at,
            'score', ra.risk_score,
            'level', ra.risk_level,
            'dangerSigns', ra.danger_signs
        ) ORDER BY ra.assessed_at DESC), '[]'::jsonb)
        FROM (SELECT * FROM risk_assessments WHERE patient_id = p_patient_id ORDER BY assessed_at DESC LIMIT p_limit) ra) AS risk_history;
END;
$$ LANGUAGE plpgsql;
