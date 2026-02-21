# 🫀 MIMI — Maternal Intelligence Monitoring Interface

> **Cavista Hackathon 2026 (Feb 21-22) · Team Entry**
>
> *A voice-first AI health companion that monitors, remembers, and protects Nigerian mothers.*

---

## 🎯 The Problem

**Nigeria has one of the world's highest maternal mortality rates.** Most deaths are preventable — caused by late detection of pre-eclampsia, postpartum hemorrhage, and sepsis. Women in rural and peri-urban areas often don't see a doctor until it's too late.

## 💡 The Solution: MIMI

MIMI is a **Progressive Web App (PWA)** that turns a basic smartphone into a 24/7 maternal health partner. Using voice-first AI in Pidgin English, MIMI:

1. **Listens** — Conducts daily check-in conversations via voice
2. **Understands** — Real-time risk scoring flags pre-eclampsia warning signs
3. **Remembers** — Cross-session memory ensures continuity of care
4. **Alerts** — Automatically notifies CHEW workers and hospitals when risk is HIGH

---

## 🏗️ Architecture: Three Pillars

### Pillar 1: Voice-First Conversation
- **Web Speech API** for speech-to-text (no setup, works natively)
- **Google Gemini 2.0 Flash** AI with a custom MIMI persona (Pidgin English, maternal health focused)
- **Web Speech Synthesis** for text-to-speech responses
- MIMI greets returning mothers by referencing their last session

### Pillar 2: The Risk Engine
A **rule-based maternal risk scoring** system (`src/lib/riskEngine.ts`) aligned with WHO danger signs:

| Symptom | Score | Basis |
|---------|-------|-------|
| Blurred vision | +30 | Eclampsia sign |
| Vaginal bleeding | +40 | Placental abruption |
| Severe headache | +25 | Pre-eclampsia |
| Significant swelling | +20 | Pre-eclampsia |
| High BP | +25 | Hypertension |
| Pre-eclampsia triad | +20 bonus | Combined presentation |
| Reduced fetal movement | +25 | Fetal distress |

Risk levels: `LOW (0-19)` → `MEDIUM (20-44)` → `HIGH (45-69)` → `CRITICAL (70+)`

### Pillar 3: Tiered Alert System
- **CHEW Dashboard** — Real-time patient list merging conversation-driven alerts + demo patients
- **Hospital Dashboard** — Emergency alerts with OpenStreetMap location embed
- **"Send Alert & Directions"** — Shows verified nearby hospitals
- **Nurse Call Simulator** — TTS-powered nurse call playback (stretch feature ✅)

---

## 🚀 Demo Flow (3-minute pitch script)

1. **[Patient View]** Open app → See MIMI Login → Enter name "Amina" → Week 32
2. **[MIMI Voice]** Tap mic → Say: *"My head dey pain me for 3 days and my feet don swell well well"*
3. **[Risk Engine]** Watch risk score jump from 0 → 65 (HIGH RISK) in real-time
4. **[CHEW View]** Switch role → See "Amina" appear at top of CHEW dashboard highlighted in red
5. **[Hospital View]** Switch to Hospital → Click alert → See location map → Click "Nurse Call Simulator"
6. **[Memory Demo]** Reload app → MIMI greets: *"Welcome back, Amina — last time you told me your head was hurting. How is it today?"*

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Voice STT | Web Speech API (built-in browser) |
| Voice TTS | Web Speech Synthesis API (built-in) |
| AI Brain | Google Gemini 2.0 Flash (`gemini-2.0-flash-exp`) |
| Risk Engine | Custom rule-based engine (WHO-aligned) |
| Memory | `localStorage` (works offline, no auth needed) |
| Maps | OpenStreetMap (free, no API key needed) |
| Backend | Supabase (optional, for persistence) |
| PWA | Vite PWA plugin |

---

## 📦 Quick Start

```bash
# Clone and install
cd project
npm install

# Set your Gemini API key (already set in .env)
# Get free key at: https://aistudio.google.com/

# Run development server
npm run dev
```

Open `http://localhost:5173` in **Chrome or Edge** (for Web Speech API support).

### Demo Role Switching

Switch between views using the **role switcher** in the left sidebar (desktop) or by adding `?role=chew` or `?role=hospital` to the URL:

| Role | URL | View |
|------|-----|------|
| Patient | `localhost:5173/` | MIMI voice interface |
| CHEW Worker | `localhost:5173/?role=chew` | Patient dashboard |
| Hospital | `localhost:5173/?role=hospital` | Emergency alerts |

---

## 🔑 Environment Variables

```env
VITE_GEMINI_API_KEY=your_key_from_aistudio.google.com
VITE_SUPABASE_URL=your_supabase_url       # Optional
VITE_SUPABASE_ANON_KEY=your_anon_key      # Optional
```

---

## 🗂️ Project Structure

```
src/
├── lib/
│   ├── gemini.ts       # Google Gemini AI integration + MIMI persona
│   ├── riskEngine.ts   # Rule-based maternal risk scoring (WHO-aligned)
│   ├── memoryStore.ts  # localStorage conversation memory + live alerts
│   └── supabase.ts     # Optional cloud persistence
├── components/
│   ├── VoiceInterface.tsx    # ★ Core: Gemini AI + TTS + risk display
│   ├── AppLayout.tsx         # Auth routing + role switcher
│   ├── CHEWDashboard.tsx     # Community health worker view
│   ├── HospitalAlert.tsx     # Hospital emergency dashboard + map
│   ├── HealthProfile.tsx     # Patient health profile
│   └── VoiceVisualizer.tsx   # Audio waveform visualizer
├── pages/
│   ├── HomePage.tsx      # Patient voice interface
│   ├── LoginPage.tsx     # Name/profile onboarding
│   ├── CHEWPage.tsx      # CHEW dashboard (live + demo patients)
│   ├── HospitalPage.tsx  # Hospital alerts
│   └── ProfilePage.tsx   # Patient health summary
└── hooks/
    ├── useVoiceRecorder.ts  # MediaRecorder + Web Speech STT
    └── useDemoData.ts       # Demo patient data (real Nigerian names/locations)
```

---

## 🧑‍⚕️ Real Data

All demo patients use **real Nigerian names, cities, and clinical presentations**:
- Amina Ibrahim, 28y, Week 32, Ajegunle Lagos — HIGH RISK (pre-eclampsia signs)
- Funke Adeyemi, 24y, Week 24, Ibadan — MEDIUM RISK
- Zainab Mohammed, 31y, Week 36, Kano — MEDIUM RISK (hypertension)
- Chiamaka Okonkwo, 22y, Week 16, Enugu — LOW RISK
- Blessing Okoro, 26y, Week 28, Surulere Lagos — LOW RISK

Hospital data uses real Lagos hospitals (LUTH, Apapa General, Lagos Island General).

---

## 🎓 Key Design Decisions

- **Fake nothing that matters** — The AI responses are real Gemini API calls, not hardcoded
- **localStorage-first** — Works offline, no sign-up friction, works in low-connectivity areas
- **Voice-first** — Designed for low-literacy users; text is secondary to speech
- **Pidgin English** — Culturally appropriate; MIMI feels like a neighbour, not a chatbot
- **Rule-based risk engine** — Explainable, auditable, can be validated by clinicians

---

## 🏆 Hackathon Talking Points

| Judge Question | Our Answer |
|----------------|------------|
| "Is it innovative?" | Voice-first in Pidgin English that **remembers** you across sessions |
| "How does it prevent?" | Real-time symptom scoring catches pre-eclampsia **weeks** before crisis |
| "Practical for Nigeria?" | PWA, works offline, no app store, no smartphone required |
| "Can it scale?" | Built with free APIs. Gemini costs ~$0.001 per conversation |
| "Is it working?" | Live demo — say anything and MIMI responds in 2 seconds |

---

*Built with ❤️ for Nigerian mothers. Every minute counts.*
