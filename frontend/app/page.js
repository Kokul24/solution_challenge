"use client";

import { useState, useCallback } from "react";
import Header from "./components/Header";
import InputPanel from "./components/InputPanel";
import MapView from "./components/MapView";
import IntelPanel from "./components/IntelPanel";
import StatusBar from "./components/StatusBar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Dashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState(null);
  const [incidents, setIncidents] = useState([]);

  const resetState = () => {
    setAnalysis(null);
    setPrediction(null);
    setDispatch(null);
    setBriefing(null);
    setError(null);
    setStep("");
  };

  const handleSubmit = useCallback(
    async (text) => {
      resetState();
      setLoading(true);

      try {
        // Step 1: Analyze Input
        setStep("Analyzing emergency input...");
        const analyzeRes = await fetch(`${API_URL}/analyze-input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!analyzeRes.ok) throw new Error("Analysis failed");
        const analyzeData = await analyzeRes.json();
        setAnalysis(analyzeData);

        // Map severity to model inputs
        const severityMap = {
          low: "low",
          medium: "medium",
          high: "high",
          critical: "high",
        };
        const incidentTypeMap = {
          fire: "fire",
          flood: "flood",
          gas_leak: "gas_leak",
          building_collapse: "building_collapse",
          cyclone: "cyclone",
          hazmat: "gas_leak",
          medical: "fire",
          other: "fire",
        };
        const locationTypeMap = {
          indoor: "indoor",
          outdoor: "outdoor",
          urban: "urban",
          industrial: "industrial",
          coastal: "coastal",
        };

        // Determine location type from the location text
        const locLower = (analyzeData.location || "").toLowerCase();
        let locationType = "urban";
        if (
          locLower.includes("indoor") ||
          locLower.includes("building") ||
          locLower.includes("house") ||
          locLower.includes("apartment")
        )
          locationType = "indoor";
        else if (
          locLower.includes("factory") ||
          locLower.includes("industrial") ||
          locLower.includes("plant") ||
          locLower.includes("warehouse")
        )
          locationType = "industrial";
        else if (
          locLower.includes("coast") ||
          locLower.includes("beach") ||
          locLower.includes("port") ||
          locLower.includes("harbor")
        )
          locationType = "coastal";
        else if (
          locLower.includes("park") ||
          locLower.includes("field") ||
          locLower.includes("forest") ||
          locLower.includes("outdoor")
        )
          locationType = "outdoor";

        // Determine time of day
        const hour = new Date().getHours();
        const timeOfDay = hour >= 6 && hour < 18 ? "day" : "night";

        // Determine people_trapped and hazardous_material from reason + text
        const combined = `${text} ${analyzeData.reason || ""}`.toLowerCase();
        const peoplTrapped = combined.includes("trap") || combined.includes("stuck") ? "yes" : "no";
        const hazmat =
          combined.includes("hazard") ||
          combined.includes("chemical") ||
          combined.includes("toxic") ||
          combined.includes("gas leak")
            ? "yes"
            : "no";

        // Step 2: Predict Escalation
        setStep("Predicting escalation risk...");
        const predictRes = await fetch(`${API_URL}/predict-escalation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_type:
              incidentTypeMap[analyzeData.incident_type] || "fire",
            location_type: locationType,
            time_of_day: timeOfDay,
            severity_level:
              severityMap[analyzeData.severity_level] || "medium",
            people_trapped: peoplTrapped,
            hazardous_material: hazmat,
            resource_availability: "medium",
          }),
        });
        if (!predictRes.ok) throw new Error("Prediction failed");
        const predictData = await predictRes.json();
        setPrediction(predictData);

        // Step 3: Auto-Dispatch
        setStep("Generating dispatch plan...");
        const dispatchRes = await fetch(`${API_URL}/auto-dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident: analyzeData,
            available_resources: [
              "Fire Engine",
              "Ambulance",
              "Police Unit",
              "Hazmat Team",
              "Search & Rescue",
              "Helicopter",
            ],
          }),
        });
        if (!dispatchRes.ok) throw new Error("Dispatch failed");
        const dispatchData = await dispatchRes.json();
        setDispatch(dispatchData);

        // Step 4: Generate Briefing
        setStep("Compiling tactical briefing...");
        const briefRes = await fetch(`${API_URL}/generate-briefing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident: analyzeData,
            prediction: predictData,
            dispatch: dispatchData,
          }),
        });
        if (!briefRes.ok) throw new Error("Briefing failed");
        const briefData = await briefRes.json();
        setBriefing(briefData);

        // Add to incidents list for map
        setIncidents((prev) => [
          ...prev,
          {
            id: Date.now(),
            ...analyzeData,
            prediction: predictData,
            dispatch: dispatchData,
          },
        ]);

        setStep("Complete");
      } catch (err) {
        setError(err.message);
        setStep("Error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 pt-2">
        {/* Left Column — Input + Map */}
        <div className="flex flex-col gap-4 lg:w-[55%] xl:w-[60%]">
          <InputPanel onSubmit={handleSubmit} loading={loading} />
          <MapView incidents={incidents} />
        </div>

        {/* Right Column — Intel Panel */}
        <div className="lg:w-[45%] xl:w-[40%]">
          <IntelPanel
            analysis={analysis}
            prediction={prediction}
            dispatch={dispatch}
            briefing={briefing}
            loading={loading}
            step={step}
            error={error}
          />
        </div>
      </main>

      <StatusBar loading={loading} step={step} incidentCount={incidents.length} />
    </div>
  );
}
