import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a null client if env vars are not set — MIMI uses localStorage as primary storage
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
  : null;


export interface Profile {
  id: string;
  full_name: string;
  age: number;
  gestational_week: number;
  due_date: string;
  location: string;
  phone: string;
  language_preference: string;
  medical_history: Record<string, any>;
  folic_acid_adherence: number;
  last_checkup: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  transcript: string;
  audio_url?: string;
  detected_symptoms: string[];
  sentiment: string;
  duration_seconds: number;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  user_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  contributing_factors: Record<string, any>;
  recommendations: string[];
  escalation_triggered: boolean;
  created_at: string;
}

export interface Symptom {
  id: string;
  user_id: string;
  conversation_id?: string;
  symptom_name: string;
  severity: 'mild' | 'moderate' | 'severe';
  description?: string;
  duration_hours: number;
  reported_at: string;
  created_at: string;
}

export interface Provider {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'chew' | 'pharmacy';
  location: string;
  coordinates?: { lat: number; lng: number };
  phone: string;
  email?: string;
  specialties: string[];
  capacity_status: 'available' | 'limited' | 'full';
  verification_status: 'pending' | 'verified' | 'rejected';
  service_area: string[];
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  risk_assessment_id: string;
  provider_id: string;
  priority: 'medium' | 'high' | 'critical';
  risk_type: string;
  symptoms: string[];
  patient_location: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  acknowledged_at?: string;
  resolved_at?: string;
  notes?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  type: 'medication' | 'appointment' | 'checkup';
  title: string;
  description: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'completed' | 'missed';
  sent_at?: string;
  completed_at?: string;
  created_at: string;
}
