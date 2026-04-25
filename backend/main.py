"""
AI Emergency Command System — FastAPI Backend
Provides incident analysis, escalation prediction, dispatch suggestions, and tactical briefings.
"""

import os
import json
import re
import traceback
from pathlib import Path
from contextlib import asynccontextmanager

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

import google.generativeai as genai

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in .env")

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.5-flash")

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "escalation_dataset.csv"

# ---------------------------------------------------------------------------
# ML Model — trained at startup
# ---------------------------------------------------------------------------
ml_model: RandomForestClassifier | None = None
label_encoders: dict[str, LabelEncoder] = {}
feature_columns: list[str] = []


def train_escalation_model():
    """Train a lightweight RandomForest on the escalation dataset."""
    global ml_model, label_encoders, feature_columns

    if not CSV_PATH.exists():
        print(f"[WARN] Dataset not found at {CSV_PATH}. Escalation prediction will be unavailable.")
        return

    df = pd.read_csv(CSV_PATH)
    # Ensure consistent column names
    df.columns = [c.strip().lower() for c in df.columns]

    feature_columns = [
        "incident_type",
        "location_type",
        "time_of_day",
        "severity_level",
        "people_trapped",
        "hazardous_material",
        "resource_availability",
    ]
    target = "escalation"

    # Encode categorical features
    for col in feature_columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    le_target = LabelEncoder()
    df[target] = le_target.fit_transform(df[target].astype(str))
    label_encoders[target] = le_target

    X = df[feature_columns]
    y = df[target]

    ml_model = RandomForestClassifier(n_estimators=100, random_state=42)
    ml_model.fit(X, y)
    print("[INFO] Escalation model trained successfully.")


# ---------------------------------------------------------------------------
# Lifespan — train model on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    train_escalation_model()
    yield


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Emergency Command System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class AnalyzeInputRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw emergency report text")


class AnalyzeInputResponse(BaseModel):
    incident_type: str
    location: str
    severity_level: str
    priority_score: int
    triage_category: str
    reason: str


class PredictEscalationRequest(BaseModel):
    incident_type: str
    location_type: str
    time_of_day: str
    severity_level: str
    people_trapped: str
    hazardous_material: str
    resource_availability: str


class PredictEscalationResponse(BaseModel):
    threat_growth: float
    prediction: str


class DispatchRequest(BaseModel):
    incident: dict
    available_resources: list[str] = Field(
        default_factory=lambda: [
            "Fire Engine",
            "Ambulance",
            "Police Unit",
            "Hazmat Team",
            "Search & Rescue",
            "Helicopter",
        ]
    )


class DispatchResponse(BaseModel):
    action: str
    reason: str


class BriefingRequest(BaseModel):
    incident: dict
    prediction: dict
    dispatch: dict


class BriefingResponse(BaseModel):
    briefing: str


# ---------------------------------------------------------------------------
# Helper — call Gemini and parse JSON
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """Extract JSON from Gemini response, handling markdown fences."""
    # Try to find JSON block in markdown code fences
    match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)```", text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Last resort: try finding first { ... }
        match2 = re.search(r"\{[\s\S]*\}", text)
        if match2:
            return json.loads(match2.group(0))
        raise


async def call_gemini(prompt: str) -> str:
    """Send prompt to Gemini and return text."""
    response = gemini_model.generate_content(prompt)
    return response.text


# ---------------------------------------------------------------------------
# 1. POST /analyze-input
# ---------------------------------------------------------------------------
ANALYZE_SYSTEM_PROMPT = """\
You are an AI Emergency Triage Analyst. You follow the START triage protocol strictly.

Given a raw emergency report, extract structured intelligence.

START Protocol Triage Categories:
- MINOR (Green): Walking wounded, minor injuries, can wait
- DELAYED (Yellow): Serious but not life-threatening, can wait 1-3 hours
- IMMEDIATE (Red): Life-threatening, needs care within 1 hour
- CRITICAL/EXPECTANT (Black): Unlikely to survive even with treatment

Severity Reasoning Rules:
- Fire + indoor + trapped persons → HIGH severity, IMMEDIATE triage
- Hazardous material present → increase severity by 1 level
- Multiple victims (>3) → increase severity by 1 level
- Building collapse + people inside → IMMEDIATE or CRITICAL
- Gas leak + enclosed space → HIGH severity

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "incident_type": "<fire|flood|gas_leak|building_collapse|cyclone|hazmat|medical|other>",
  "location": "<extracted or inferred location>",
  "severity_level": "<low|medium|high|critical>",
  "priority_score": <integer 1-100, 100 = highest>,
  "triage_category": "<MINOR|DELAYED|IMMEDIATE|CRITICAL>",
  "reason": "<brief reasoning>"
}
"""


@app.post("/analyze-input", response_model=AnalyzeInputResponse)
async def analyze_input(req: AnalyzeInputRequest):
    try:
        prompt = f"{ANALYZE_SYSTEM_PROMPT}\n\nEmergency Report:\n{req.text}"
        raw = await call_gemini(prompt)
        data = _extract_json(raw)
        return AnalyzeInputResponse(**data)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ---------------------------------------------------------------------------
# 2. POST /predict-escalation
# ---------------------------------------------------------------------------
@app.post("/predict-escalation", response_model=PredictEscalationResponse)
async def predict_escalation(req: PredictEscalationRequest):
    if ml_model is None:
        raise HTTPException(status_code=503, detail="ML model not available")

    try:
        row = {}
        for col in feature_columns:
            val = getattr(req, col)
            le = label_encoders[col]
            if val in le.classes_:
                row[col] = le.transform([val])[0]
            else:
                # Unknown category — use most common class
                row[col] = 0

        X_input = pd.DataFrame([row], columns=feature_columns)
        proba = ml_model.predict_proba(X_input)[0]

        # Find index for "yes" escalation
        target_le = label_encoders["escalation"]
        yes_idx = list(target_le.classes_).index("yes") if "yes" in target_le.classes_ else 1
        threat_growth = round(proba[yes_idx] * 100, 1)

        if threat_growth >= 70:
            prediction = "High likelihood of escalation — immediate intervention recommended"
        elif threat_growth >= 40:
            prediction = "Moderate escalation risk — monitor closely and prepare contingencies"
        else:
            prediction = "Low escalation risk — standard response protocol sufficient"

        return PredictEscalationResponse(
            threat_growth=threat_growth,
            prediction=prediction,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ---------------------------------------------------------------------------
# 3. POST /auto-dispatch
# ---------------------------------------------------------------------------
DISPATCH_SYSTEM_PROMPT = """\
You are an AI Emergency Dispatch Coordinator. Given an incident analysis and a list of available resources,
determine the optimal dispatch action.

Consider:
- Match resource types to incident type (e.g., fire → fire engine, medical → ambulance)
- Higher severity = more resources
- If hazardous materials are involved, always include Hazmat Team
- People trapped → include Search & Rescue
- Always provide a clear, actionable dispatch order

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "action": "<specific dispatch order with resources and quantities>",
  "reason": "<brief tactical reasoning>"
}
"""


@app.post("/auto-dispatch", response_model=DispatchResponse)
async def auto_dispatch(req: DispatchRequest):
    try:
        prompt = (
            f"{DISPATCH_SYSTEM_PROMPT}\n\n"
            f"Incident:\n{json.dumps(req.incident, indent=2)}\n\n"
            f"Available Resources:\n{json.dumps(req.available_resources, indent=2)}"
        )
        raw = await call_gemini(prompt)
        data = _extract_json(raw)
        return DispatchResponse(**data)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Dispatch failed: {str(e)}")


# ---------------------------------------------------------------------------
# 4. POST /generate-briefing
# ---------------------------------------------------------------------------
BRIEFING_SYSTEM_PROMPT = """\
You are a Tactical Briefing Officer. Given the incident analysis, escalation prediction, and dispatch plan,
generate a concise, actionable tactical briefing for field commanders.

Format:
- SITUATION: 1-2 sentences on what happened
- THREAT ASSESSMENT: Escalation risk and timeline
- ACTIONS ORDERED: Dispatch summary
- COMMANDER NOTES: Any special considerations

Keep the total briefing under 200 words. Be direct and professional.

Respond with plain text (no JSON, no markdown fences).
"""


@app.post("/generate-briefing", response_model=BriefingResponse)
async def generate_briefing(req: BriefingRequest):
    try:
        prompt = (
            f"{BRIEFING_SYSTEM_PROMPT}\n\n"
            f"Incident:\n{json.dumps(req.incident, indent=2)}\n\n"
            f"Escalation Prediction:\n{json.dumps(req.prediction, indent=2)}\n\n"
            f"Dispatch Plan:\n{json.dumps(req.dispatch, indent=2)}"
        )
        raw = await call_gemini(prompt)
        return BriefingResponse(briefing=raw.strip())
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Briefing failed: {str(e)}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": ml_model is not None,
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
