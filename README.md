# AI Emergency Command System

AI-powered emergency triage, escalation prediction, dispatch coordination, and tactical briefing system. Converts chaotic emergency inputs into structured intelligence using Gemini AI and real-world START protocol.

**Live Deployment:** [Link](https://solution-challenge-delta.vercel.app/)
**Live Demo Video:** [Link](https://vimeo.com/1187396801?fl=ip&fe=ec)

---

---

## Architecture

```
Frontend (Next.js + Tailwind + Google Maps)
    |
    v
Single POST /process-incident
    |
    ├── Step 1: Gemini AI — Input Analysis + START Triage
    ├── Step 2: RandomForest ML — Escalation Prediction
    ├── Step 3: Gemini AI — Auto Dispatch Coordination
    └── Step 4: Gemini AI — Tactical Briefing Generation
    |
    v
Backend (FastAPI + scikit-learn + Gemini SDK)
    |
    v
Unified JSON Response
    {
      triage: { incident_type, severity, casualties, priority },
      escalation: { threat_growth_pct, risk_level },
      dispatch: { units, eta, instructions },
      briefing: { summary, field_commands, resource_status }
    }
```

All four pipeline stages execute in a single backend request. The frontend receives a unified response containing triage analysis, escalation prediction, dispatch recommendations, and tactical briefing simultaneously.

---





## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Gemini API key
- Google Maps API key
-Firebase keys and Credentials

### 1. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
```





### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```



---

## Environment Variables

### Backend (`backend/.env`)

```
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_IDNEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_API_URL
```

---

## Pipeline Flow

The entire pipeline executes in a single request to `/process-incident`. The backend runs all four stages sequentially and returns a unified response.

1. **Analyze Input** — Gemini extracts incident type, location, severity, and applies START triage protocol
2. **Predict Escalation** — RandomForest classifier predicts threat growth percentage from incident features
3. **Auto-Dispatch** — Gemini recommends optimal resource dispatch based on triage analysis and escalation score
4. **Generate Briefing** — Gemini compiles a tactical briefing for field commanders incorporating all prior outputs

---

## Technologies

| Component | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Next.js 15, Tailwind CSS, Google Maps |
| Backend   | FastAPI, Python                     |
| AI        | Gemini 2.0 Flash                    |
| ML        | scikit-learn (RandomForest)         |
| Dataset   | 500+ emergency incident records     |
