# 🚨 AI Emergency Command System

AI-powered emergency triage, escalation prediction, dispatch coordination, and tactical briefing system. Converts chaotic emergency inputs into structured intelligence using Gemini AI and real-world START protocol.

---

## 🏗 Architecture

```
Frontend (Next.js + Tailwind + Google Maps)
    │
    ├── /analyze-input       → Gemini AI + START Triage
    ├── /predict-escalation  → RandomForest ML Classifier
    ├── /auto-dispatch       → Gemini AI Dispatch Coordinator
    └── /generate-briefing   → Gemini AI Tactical Briefing
    │
Backend (FastAPI + scikit-learn + Gemini SDK)
```

## 📁 Project Structure

```
root/
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── components/
│   │   │   ├── Header.js
│   │   │   ├── InputPanel.js
│   │   │   ├── MapView.js
│   │   │   ├── IntelPanel.js
│   │   │   └── StatusBar.js
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── .env.local
│   └── package.json
├── backend/
│   ├── data/
│   │   └── escalation_dataset.csv
│   ├── credentials.json
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- Gemini API key
- Google Maps API key

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

Backend runs at: **http://localhost:8000**

API docs at: **http://localhost:8000/docs**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend runs at: **http://localhost:3000**

## 🔐 Environment Variables

### Backend (`backend/.env`)
```
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## ⚡ Pipeline Flow

1. **Analyze Input** — Gemini extracts incident type, location, severity, and applies START triage
2. **Predict Escalation** — RandomForest model predicts threat growth % from incident features
3. **Auto-Dispatch** — Gemini recommends optimal resource dispatch based on analysis
4. **Generate Briefing** — Gemini compiles a tactical briefing for field commanders

## 🧠 Technologies

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 15, Tailwind CSS, Google Maps |
| Backend | FastAPI, Python |
| AI | Gemini 2.0 Flash |
| ML | scikit-learn (RandomForest) |
| Dataset | 500+ emergency incident records |
