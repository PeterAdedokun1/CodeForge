# MIMI — Maternal Intelligence Monitoring Interface

> **Cavista Hackathon 2026 · Feb 21-22**
> A voice-first AI health companion that monitors, remembers, and protects Nigerian mothers.

---

## What it does

MIMI turns a basic smartphone into a 24/7 maternal health partner. It conducts daily check-in conversations via voice (in Pidgin English), scores symptoms in real-time against WHO danger signs, and automatically alerts community health workers and hospitals when risk is HIGH.

**Three core pillars:**

1. **Conversation** — Real-time two-way voice via Gemini Live API (streamed PCM audio over Socket.IO)
2. **Intelligence** — Rule-based risk engine flags pre-eclampsia, postpartum hemorrhage, and sepsis signs
3. **Action** — CHEW and Hospital dashboards receive tiered alerts with patient location

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Live Voice (STT + TTS) | Google Gemini Live API (via server bridge) |
| Fallback Voice | Web Speech API + Web Speech Synthesis |
| Risk Engine | Custom rule-based scoring (WHO-aligned) |
| Memory | `localStorage` — works offline, no auth friction |
| Maps | OpenStreetMap (no API key needed) |
| Backend | Node.js + Express + Socket.IO |
| AI Bridge | `@google/genai` SDK (server-side, ephemeral tokens) |

---

## Project Structure

```
project/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── geminiLive.ts   # Socket.IO ↔ Gemini Live bridge (client side)
│   │   │   ├── gemini.ts       # Gemini text API + MIMI persona
│   │   │   ├── riskEngine.ts   # WHO-aligned maternal risk scoring
│   │   │   └── memoryStore.ts  # localStorage conversation memory
│   │   ├── components/
│   │   │   ├── VoiceInterface.tsx   # Core voice UI
│   │   │   ├── CHEWDashboard.tsx    # Community health worker view
│   │   │   └── HospitalAlert.tsx    # Hospital emergency dashboard
│   │   └── pages/               # LoginPage, HomePage, CHEWPage, HospitalPage, ProfilePage
│   └── .env                     # VITE_GEMINI_API_KEY, VITE_SERVER_URL, etc.
│
├── server/               # Node.js backend
│   ├── index.js          # Express + Socket.IO entry point
│   └── services/
│       └── GeminiLiveBridge.js   # Streams audio to/from Gemini Live API
│
└── package.json          # Root scripts (runs client + server concurrently)
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key
- Chrome or Edge (required for Web Speech API fallback)

### 1. Install dependencies

```bash
# From the project root — installs both client and server deps
npm install
```

### 2. Configure environment

**`client/.env`**
```env
VITE_GEMINI_API_KEY=your_key_here
VITE_SERVER_URL=http://localhost:3001
```

**`server/.env`**
```env
GEMINI_API_KEY=your_key_here
PORT=3001
```

### 3. Run

```bash
# Starts both the React dev server (port 5173) and Node server (port 3001) together
npm run dev
```

Or run separately:

```bash
# Terminal 1 — backend
cd server && npm start

# Terminal 2 — frontend
cd client && npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

---

## Demo Roles

Switch views by clicking the role switcher in the sidebar, or by URL:

| Role | URL | Description |
|---|---|---|
| Patient | `localhost:5173/` | MIMI voice interface |
| CHEW Worker | `localhost:5173/?role=chew` | Patient risk dashboard |
| Hospital | `localhost:5173/?role=hospital` | Emergency alert dashboard |

---

## Risk Scoring

The risk engine (`riskEngine.ts`) maps reported symptoms to a score:

| Symptom | Score |
|---|---|
| Vaginal bleeding | +40 |
| Blurred vision | +30 |
| Reduced fetal movement | +25 |
| Severe headache | +25 |
| High blood pressure | +25 |
| Pre-eclampsia triad (bonus) | +20 |
| Significant swelling | +20 |

**Thresholds:** LOW (0–19) → MEDIUM (20–44) → HIGH (45–69) → CRITICAL (70+)

---

## Environment Variables Reference

| Variable | Where | Required | Description |
|---|---|---|---|
| `VITE_GEMINI_API_KEY` | `client/.env` | Yes | Gemini API key for text fallback |
| `VITE_SERVER_URL` | `client/.env` | Yes | Backend URL |
| `VITE_SUPABASE_URL` | `client/.env` | No | Optional cloud persistence |
| `VITE_SUPABASE_ANON_KEY` | `client/.env` | No | Optional cloud persistence |
| `GEMINI_API_KEY` | `server/.env` | Yes | Gemini Live API key (server-side) |
| `PORT` | `server/.env` | No | Server port (default: 3001) |

---

