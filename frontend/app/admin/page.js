"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, AdvancedMarker, Map, Pin } from "@vis.gl/react-google-maps";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDb, hasFirebaseConfig } from "../../lib/firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const sevColor = {
  Low: "#1ad388",
  Medium: "#ff9f3d",
  High: "#ff4365",
  Critical: "#a35dff",
};

const severityOrder = ["Low", "Medium", "High", "Critical"];

function normalizeSeverity(value) {
  const safe = String(value || "low").toLowerCase();
  if (safe === "critical") return "Critical";
  if (safe === "high") return "High";
  if (safe === "medium") return "Medium";
  return "Low";
}

function titleFromType(value) {
  return String(value || "Unknown Incident")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createdAtLabel(value) {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toDisplayIncident(raw) {
  const severity = normalizeSeverity(raw?.severity_level || "low");
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);
  return {
    id: String(raw?.id || ""),
    title: titleFromType(raw?.incident_type || "incident"),
    incidentType: String(raw?.incident_type || "other"),
    userId: String(raw?.userId || ""),
    location: `${Number.isFinite(lat) ? lat.toFixed(4) : "--"}, ${Number.isFinite(lng) ? lng.toFixed(4) : "--"}`,
    severity,
    lat,
    lng,
    details: String(raw?.description || "No description provided."),
    createdAt: raw?.created_at || null,
    updatedAt: raw?.updatedAt || null,
    status: String(raw?.status || "pending"),
    priorityScore: raw?.priority_score ?? null,
    threatGrowth: raw?.threat_growth ?? null,
    prediction: raw?.prediction ?? null,
    dispatchAction: raw?.dispatch_action ?? null,
    dispatchReason: raw?.dispatch_reason ?? null,
    briefing: raw?.briefing ?? null,
    createdAtRaw: raw?.createdAt || null,
    imageUrl: raw?.imageUrl || null,
  };
}

function inferIncidentType(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("fire")) return "fire";
  if (value.includes("flood")) return "flood";
  if (value.includes("gas")) return "gas_leak";
  if (value.includes("collapse")) return "building_collapse";
  if (value.includes("cyclone")) return "cyclone";
  if (value.includes("hazmat") || value.includes("chemical")) return "hazmat";
  if (value.includes("injury") || value.includes("medical") || value.includes("ambulance")) return "medical";
  return "other";
}

function buildPredictPayload(analysis, incident) {
  const nowHour = new Date().getHours();
  const timeOfDay = nowHour < 12 ? "morning" : nowHour < 17 ? "afternoon" : "night";
  const description = String(incident.details || "").toLowerCase();
  const peopleTrapped = description.includes("trapped") ? "yes" : "no";
  const hazardousMaterial =
    description.includes("chemical") || description.includes("gas") || description.includes("hazmat")
      ? "yes"
      : "no";
  return {
    incident_type: analysis?.incident_type || inferIncidentType(incident.details),
    location_type: "urban",
    time_of_day: timeOfDay,
    severity_level: String(analysis?.severity_level || "medium").toLowerCase(),
    people_trapped: peopleTrapped,
    hazardous_material: hazardousMaterial,
    resource_availability: "medium",
  };
}

function SevBadge({ value }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      padding: "2px 8px",
      border: `1px solid ${sevColor[value]}44`,
      background: `${sevColor[value]}18`,
      fontSize: "0.72rem",
      fontWeight: 600,
      letterSpacing: "0.02em",
      color: sevColor[value],
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: sevColor[value],
        flexShrink: 0,
      }} />
      {value}
    </span>
  );
}

function SeverityChart({ incidents }) {
  const total = incidents.length || 1;
  const counts = severityOrder.map((level) => incidents.filter((i) => i.severity === level).length);
  const percentages = counts.map((count) => Math.round((count / total) * 100));

  let current = 0;
  const chartStops = percentages
    .map((pct, idx) => {
      const start = current;
      current += pct;
      return `${sevColor[severityOrder[idx]]} ${start}% ${current}%`;
    })
    .join(", ");

  const chart = `conic-gradient(${chartStops || "#1ad388 0 100%"})`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: chart,
        position: "relative",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute",
          inset: 14,
          borderRadius: "50%",
          background: "rgba(9, 18, 35, 0.95)",
          border: "1px solid rgba(137, 183, 255, 0.15)",
        }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: "0.75rem" }}>
        {severityOrder.map((level, idx) => (
          <span key={level} style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(180,200,240,0.7)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor[level], flexShrink: 0 }} />
            {level} <span style={{ color: "rgba(200,220,255,0.9)", fontWeight: 600 }}>{percentages[idx]}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: "rgba(14, 26, 52, 0.6)",
      border: "1px solid rgba(130, 175, 255, 0.12)",
      borderRadius: 10,
      padding: "10px 14px",
    }}>
      <div style={{ fontSize: "0.7rem", color: "rgba(150,175,220,0.65)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, color: color || "rgba(220,235,255,0.95)", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("visualization");
  const [selectedId, setSelectedId] = useState(null);
  const [modalIncidentId, setModalIncidentId] = useState(null);
  const [mapsKey, setMapsKey] = useState("");
  const [mapsError, setMapsError] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [incidentsError, setIncidentsError] = useState("");
  const [processingIncidentId, setProcessingIncidentId] = useState(null);
  const [processingErrors, setProcessingErrors] = useState({});
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState(false);
  const [imageAnalysisResults, setImageAnalysisResults] = useState({});

  function onLogout() {
    localStorage.removeItem("ecsAuth");
    router.replace("/login");
  }

  useEffect(() => {
    const raw = localStorage.getItem("ecsAuth");
    if (!raw) { router.replace("/login"); return; }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role !== "admin") { router.replace("/dashboard"); return; }
    } catch { router.replace("/login"); return; }

    async function loadMapsKey() {
      try {
        const res = await fetch(`${API_URL}/config/google-maps-key`);
        const data = await res.json();
        if (!res.ok || !data?.apiKey) throw new Error(data?.detail || "Unable to fetch Google Maps key");
        setMapsKey(data.apiKey);
      } catch (ex) {
        setMapsError(ex.message || "Unable to load map configuration");
      }
    }
    loadMapsKey();

    const db = getDb();
    if (!hasFirebaseConfig() || !db) {
      setIncidentsError("Firebase is not configured in frontend environment variables.");
      setLoadingIncidents(false);
      return undefined;
    }

    const incidentsQuery = query(collection(db, "incidents"));
    const unsub = onSnapshot(
      incidentsQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((incidentDoc) => {
            const data = incidentDoc.data() || {};
            return toDisplayIncident({ id: incidentDoc.id, ...data });
          })
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
          .sort((a, b) => {
            const at = typeof a.createdAtRaw?.toMillis === "function" ? a.createdAtRaw.toMillis() : 0;
            const bt = typeof b.createdAtRaw?.toMillis === "function" ? b.createdAtRaw.toMillis() : 0;
            return bt - at;
          });
        setIncidents(next);
        setIncidentsError("");
        setLoadingIncidents(false);
        setSelectedId((prev) => (prev && next.some((item) => item.id === prev) ? prev : next[0]?.id || null));
      },
      () => {
        setIncidentsError("Unable to stream incidents in real-time.");
        setLoadingIncidents(false);
      }
    );
    return () => unsub();
  }, [router]);

  const selected = useMemo(() => incidents.find((i) => i.id === selectedId) || incidents[0] || null, [selectedId, incidents]);
  const stats = useMemo(() => ({
    total: incidents.length,
    alerts: incidents.filter((i) => i.severity === "Critical" || i.severity === "High").length,
    pending: incidents.filter((i) => i.status === "pending").length,
    processing: incidents.filter((i) => i.status === "processing").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    activeUnits: 12,
  }), [incidents]);

  const modalIncident = useMemo(() => incidents.find((i) => i.id === modalIncidentId) || null, [incidents, modalIncidentId]);
  const topThreatIncidents = useMemo(
    () => [...incidents].sort((a, b) => (b.threatGrowth || 0) - (a.threatGrowth || 0)).slice(0, 5),
    [incidents]
  );

  async function processIncident(incident) {
    const db = getDb();
    if (!incident?.id || !db) return;
    const incidentRef = doc(db, "incidents", incident.id);
    setProcessingIncidentId(incident.id);
    setIncidentsError("");
    try {
      await updateDoc(incidentRef, { status: "processing", updatedAt: serverTimestamp() });
      const analyzeRes = await fetch(`${API_URL}/analyze-input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: incident.details }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData?.detail || "Analyze failed");

      const predictPayload = buildPredictPayload(analyzeData, incident);
      const predictRes = await fetch(`${API_URL}/predict-escalation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(predictPayload),
      });
      const predictData = await predictRes.json();
      if (!predictRes.ok) throw new Error(predictData?.detail || "Predict escalation failed");

      const dispatchRes = await fetch(`${API_URL}/auto-dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident: {
            incident_type: analyzeData.incident_type,
            severity_level: analyzeData.severity_level,
            priority_score: analyzeData.priority_score,
            description: incident.details,
            lat: incident.lat,
            lng: incident.lng,
          },
          available_resources: ["Fire Engine", "Ambulance", "Police Unit", "Hazmat Team", "Search & Rescue", "Helicopter"],
        }),
      });
      const dispatchData = await dispatchRes.json();
      if (!dispatchRes.ok) throw new Error(dispatchData?.detail || "Auto dispatch failed");

      const briefingRes = await fetch(`${API_URL}/generate-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident: {
            incident_type: analyzeData.incident_type,
            severity_level: analyzeData.severity_level,
            priority_score: analyzeData.priority_score,
            description: incident.details,
            lat: incident.lat,
            lng: incident.lng,
          },
          prediction: predictData,
          dispatch: dispatchData,
        }),
      });
      const briefingData = await briefingRes.json();
      if (!briefingRes.ok) throw new Error(briefingData?.detail || "Generate briefing failed");

      await updateDoc(incidentRef, {
        severity_level: analyzeData?.severity_level ?? null,
        priority_score: analyzeData?.priority_score ?? null,
        threat_growth: predictData?.threat_growth ?? null,
        prediction: predictData?.prediction ?? null,
        dispatch_action: dispatchData?.action ?? null,
        dispatch_reason: dispatchData?.reason ?? null,
        briefing: briefingData?.briefing ?? null,
        status: "resolved",
        updatedAt: serverTimestamp(),
      });
      setProcessingErrors((prev) => { const next = { ...prev }; delete next[incident.id]; return next; });
    } catch (ex) {
      setProcessingErrors((prev) => ({ ...prev, [incident.id]: ex.message || "AI processing failed" }));
      setIncidentsError(ex.message || "AI processing failed");
    } finally {
      setProcessingIncidentId(null);
    }
  }

  async function analyzeIncidentImage(incident) {
    if (!incident?.imageUrl) {
      setIncidentsError("No image available for analysis");
      return;
    }

    setImageAnalysisLoading(true);
    setIncidentsError("");

    try {
      const response = await fetch(`${API_URL}/api/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: incident.imageUrl.split(",")[1] || incident.imageUrl,
          description: incident.details,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Image analysis failed");

      setImageAnalysisResults((prev) => ({
        ...prev,
        [incident.id]: data,
      }));
    } catch (ex) {
      setIncidentsError(ex.message || "Image analysis failed");
    } finally {
      setImageAnalysisLoading(false);
    }
  }

  async function onIncidentClick(incident) {
    setSelectedId(incident.id);
    setModalIncidentId(incident.id);
  }

  const tabs = [
    { id: "visualization", label: "Visualization" },
    { id: "map", label: "Map" },
    { id: "reports", label: "Reports" },
  ];

  const buttonProportion = {
    borderRadius: 10,
    minHeight: 34,
    padding: "0 14px",
    fontSize: "0.78rem",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  const tabButtonProportion = {
    ...buttonProportion,
    minHeight: 36,
    padding: "0 18px",
    flex: "1 1 180px",
    minWidth: 120,
    letterSpacing: "0.03em",
  };

  return (
    <main className="app-shell" style={{ display: "grid", gap: 12, padding: "clamp(10px, 2vw, 20px)" }}>

      {/* ── HEADER ── */}
      <header className="glass admin-header" style={{
        padding: "20px 18px",
        display: "flex",
        
        justifyContent: "space-between",
        gap: 0,
        minHeight: 0,
      }}>
        <div>
          <p className="panel-title" style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.1em" }}>MISSION CONTROL</p>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, lineHeight: 1.2, color: "rgba(220,235,255,0.95)" }}>
            AI Emergency Command Center
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatCard label="Total Incidents" value={stats.total} />
          <StatCard label="High Priority" value={stats.alerts} color="#ff6a81" />
          <StatCard label="Active Units" value={stats.activeUnits} color="#74d8ab" />
          <button
            type="button"
            className="btn"
            onClick={onLogout}
            style={{ ...buttonProportion, alignSelf: "center" }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── TAB BAR ── */}
      <nav className="admin-tabs" style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 6,
        background: "rgba(10, 18, 38, 0.5)",
        border: "1px solid rgba(130, 175, 255, 0.12)",
        borderRadius: 12,
        padding: "5px 6px",
        width: "100%",
      }}>
        {tabs.map((tab) => (
          <button
            className="admin-tab-btn"
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabButtonProportion,
              width: "100%",
              minWidth: 0,
              minHeight: 34,
              padding: "0 12px",
              border: activeTab === tab.id ? "1px solid rgba(94, 158, 255, 0.5)" : "1px solid transparent",
              background: activeTab === tab.id ? "rgba(46, 132, 255, 0.22)" : "transparent",
              color: activeTab === tab.id ? "rgba(180, 210, 255, 0.95)" : "rgba(130, 165, 220, 0.6)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── VISUALIZATION TAB ── */}
      {activeTab === "visualization" && (
        <section className="visualization-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 12 }}>

          {/* Left column */}
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>

            {/* Status row */}
            <article className="glass-strong" style={{ padding: "14px 16px" }}>
              <p className="panel-title" style={{ margin: "0 0 10px", fontSize: "0.68rem", letterSpacing: "0.08em" }}>INCIDENT STATUS OVERVIEW</p>
              <div className="status-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                <div style={{
                  background: "rgba(14, 26, 52, 0.6)",
                  border: "1px solid rgba(130, 175, 255, 0.12)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "0.68rem", color: "rgba(150,175,220,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Pending</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1, color: "rgba(220,235,255,0.9)" }}>{stats.pending}</div>
                </div>
                <div style={{
                  background: "rgba(14, 26, 52, 0.6)",
                  border: "1px solid rgba(255, 159, 61, 0.2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,159,61,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Processing</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1, color: "#ff9f3d" }}>{stats.processing}</div>
                </div>
                <div style={{
                  background: "rgba(14, 26, 52, 0.6)",
                  border: "1px solid rgba(26, 211, 136, 0.2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "0.68rem", color: "rgba(26,211,136,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Resolved</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1, color: "#1ad388" }}>{stats.resolved}</div>
                </div>
              </div>
            </article>

            {/* Top Escalation */}
            <article className="glass-strong" style={{ padding: "14px 16px" }}>
              <p className="panel-title" style={{ margin: "0 0 10px", fontSize: "0.68rem", letterSpacing: "0.08em" }}>TOP ESCALATION PREDICTIONS</p>
              <div style={{ display: "grid", gap: 6 }}>
                {topThreatIncidents.length ? topThreatIncidents.map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => onIncidentClick(incident)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "4px 12px",
                      alignItems: "center",
                      borderRadius: 8,
                      border: "1px solid rgba(130, 175, 255, 0.14)",
                      background: "rgba(14, 26, 52, 0.5)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "rgba(210,228,255,0.9)", marginBottom: 2 }}>{incident.title}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(140,170,220,0.6)" }}>
                        {incident.status} · ID {incident.id.slice(0, 6).toUpperCase()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: incident.threatGrowth > 50 ? "#ff4365" : "#ff9f3d" }}>
                        {incident.threatGrowth ?? 0}%
                      </div>
                      <div style={{ fontSize: "0.66rem", color: "rgba(140,170,220,0.5)" }}>threat</div>
                    </div>
                  </button>
                )) : (
                  <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>No incident data available yet.</p>
                )}
              </div>
            </article>
          </div>

          {/* Right column */}
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>

            {/* Severity chart */}
            <article className="glass" style={{ padding: "14px 16px" }}>
              <p className="panel-title" style={{ margin: "0 0 12px", fontSize: "0.68rem", letterSpacing: "0.08em" }}>SEVERITY DISTRIBUTION</p>
              <SeverityChart incidents={incidents} />
            </article>

            {/* Realtime feed */}
            <article className="glass" style={{ padding: "14px 16px" }}>
              <p className="panel-title" style={{ margin: "0 0 10px", fontSize: "0.68rem", letterSpacing: "0.08em" }}>REALTIME FEED</p>
              <div style={{ display: "grid", gap: 6 }}>
                {incidents.slice(0, 6).map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => onIncidentClick(incident)}
                    style={{
                      textAlign: "left",
                      border: "1px solid rgba(130, 175, 255, 0.14)",
                      borderRadius: 8,
                      background: "rgba(14, 24, 45, 0.5)",
                      padding: "8px 10px",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(210,228,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {incident.title}
                      </span>
                      <SevBadge value={incident.severity} />
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "rgba(130,165,220,0.5)" }}>{createdAtLabel(incident.createdAt)}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>
      )}

      {/* ── MAP TAB ── */}
      {activeTab === "map" && (
        <section className="glass-strong" style={{ padding: 14, display: "grid", gap: 10, minHeight: "calc(100vh - 210px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="panel-title" style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.08em" }}>LIVE TACTICAL MAP</p>
            {selected && (
              <span style={{ fontSize: "0.72rem", color: "rgba(140,175,220,0.6)" }}>
                Tracking: <strong style={{ color: "rgba(180,210,255,0.85)" }}>{selected.id.slice(0, 8).toUpperCase()}</strong>
                {" · "}{createdAtLabel(selected.createdAt)}
              </span>
            )}
          </div>
          <div style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 12,
            flex: 1,
            minHeight: "clamp(320px, 56vh, 640px)",
            border: "1px solid rgba(137, 183, 255, 0.18)",
            background: "rgba(7, 17, 34, 0.88)",
          }}>
            {mapsKey ? (
              <APIProvider apiKey={mapsKey}>
                <Map
                  defaultCenter={{ lat: 12.9716, lng: 77.5946 }}
                  defaultZoom={12}
                  mapId="emergency-command-map"
                  style={{ width: "100%", height: "100%" }}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                >
                  {incidents.map((incident) => (
                    <AdvancedMarker
                      key={incident.id}
                      position={{ lat: incident.lat, lng: incident.lng }}
                      onClick={() => onIncidentClick(incident)}
                    >
                      <Pin
                        background={sevColor[incident.severity]}
                        borderColor={sevColor[incident.severity]}
                        glyphColor="#ffffff"
                        scale={selected?.id === incident.id ? 1.15 : 1}
                      />
                    </AdvancedMarker>
                  ))}
                </Map>
              </APIProvider>
            ) : (
              <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 18 }}>
                <p className="muted" style={{ fontSize: "0.85rem" }}>{mapsError || "Loading Google Maps..."}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === "reports" && (
        <section className="glass" style={{ padding: "14px 16px", display: "grid", gap: 10 }}>
          <p className="panel-title" style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.08em" }}>INCOMING REPORTS</p>

          {loadingIncidents && (
            <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>Loading live reports...</p>
          )}
          {incidentsError && (
            <p style={{ fontSize: "0.82rem", color: "#ff6a81", margin: 0 }}>{incidentsError}</p>
          )}
          {!loadingIncidents && !incidents.length && !incidentsError && (
            <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>No incoming reports.</p>
          )}

          <div style={{ display: "grid", gap: 6 }}>
            {incidents.map((incident) => {
              const active = incident.id === selected?.id;
              return (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => onIncidentClick(incident)}
                  style={{
                    textAlign: "left",
                    borderRadius: 10,
                    border: active
                      ? "1px solid rgba(94, 158, 255, 0.55)"
                      : "1px solid rgba(130, 175, 255, 0.14)",
                    background: active ? "rgba(46, 132, 255, 0.14)" : "rgba(13, 22, 43, 0.6)",
                    color: "inherit",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "4px 12px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(210,228,255,0.9)" }}>{incident.title}</span>
                      <SevBadge value={incident.severity} />
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(140,170,220,0.55)" }}>
                      {incident.location} · ID {incident.id.slice(0, 8).toUpperCase()} · {incident.status}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: (incident.threatGrowth ?? 0) > 50 ? "#ff4365" : "#ff9f3d" }}>
                      {incident.threatGrowth ?? 0}%
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "rgba(130,165,220,0.45)" }}>escalation</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── INCIDENT MODAL ── */}
      {modalIncident && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalIncidentId(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            background: "rgba(3, 8, 18, 0.7)",
            backdropFilter: "blur(6px)",
            padding: 16,
          }}
        >
          <article
            className="glass-strong"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(700px, 96vw)",
              maxHeight: "88vh",
              overflow: "auto",
              padding: 18,
              display: "grid",
              gap: 12,
              borderRadius: 16,
            }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p className="panel-title" style={{ margin: "0 0 2px", fontSize: "0.65rem", letterSpacing: "0.1em" }}>INCIDENT REPORT</p>
                <h3 style={{ margin: 0, fontSize: "1.05rem", color: "rgba(215,232,255,0.95)" }}>{modalIncident.title}</h3>
              </div>
              <button type="button" className="btn" onClick={() => setModalIncidentId(null)}
                style={{ ...buttonProportion, minHeight: 32, padding: "0 12px", fontSize: "0.76rem", flexShrink: 0 }}>
                Close
              </button>
            </div>

            {/* Meta row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.76rem", color: "rgba(140,170,220,0.6)" }}>
              <span>ID: <strong style={{ color: "rgba(180,210,255,0.8)" }}>{modalIncident.id.slice(0, 8).toUpperCase()}</strong></span>
              <span>Status: <strong style={{ color: "rgba(180,210,255,0.8)" }}>{modalIncident.status}</strong></span>
              <span>Submitted: <strong style={{ color: "rgba(180,210,255,0.8)" }}>{createdAtLabel(modalIncident.createdAt)}</strong></span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <SevBadge value={modalIncident.severity} />
              <span style={{ fontSize: "0.76rem", color: "rgba(140,170,220,0.6)" }}>
                Location: {modalIncident.location}
              </span>
              <span style={{ fontSize: "0.76rem", color: "rgba(140,170,220,0.6)" }}>
                Escalation: <strong style={{ color: "#ff9f3d" }}>{modalIncident.threatGrowth ?? 0}%</strong>
              </span>
            </div>

            {/* Description */}
            <article className="glass" style={{ padding: "10px 12px", borderRadius: 10 }}>
              <p className="panel-title" style={{ margin: "0 0 6px", fontSize: "0.65rem", letterSpacing: "0.08em" }}>DESCRIPTION</p>
              <p style={{ margin: 0, lineHeight: 1.5, fontSize: "0.82rem", color: "rgba(170,195,235,0.8)" }}>{modalIncident.details}</p>
            </article>

            {/* Image Section */}
            {modalIncident.imageUrl && (
              <article className="glass" style={{ padding: "10px 12px", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p className="panel-title" style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.08em" }}>UPLOADED IMAGE</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => analyzeIncidentImage(modalIncident)}
                    disabled={imageAnalysisLoading}
                    style={{ padding: "4px 8px", fontSize: "0.75rem", minHeight: 24 }}
                  >
                    {imageAnalysisLoading ? "Analyzing..." : "Analyze with Gemini"}
                  </button>
                </div>
                <img
                  src={modalIncident.imageUrl}
                  alt="Incident"
                  style={{
                    width: "100%",
                    maxHeight: 250,
                    borderRadius: 8,
                    objectFit: "cover",
                    marginBottom: 8,
                  }}
                />
              </article>
            )}

            {/* Image Analysis Results */}
            {imageAnalysisResults[modalIncident.id] && (
              <article className="glass" style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(82, 175, 255, 0.05)", border: "1px solid rgba(82, 175, 255, 0.2)" }}>
                <p className="panel-title" style={{ margin: "0 0 8px", fontSize: "0.65rem", letterSpacing: "0.08em", color: "#82afff" }}>GEMINI IMAGE ANALYSIS</p>
                <div style={{ display: "grid", gap: 5, fontSize: "0.78rem", color: "rgba(160,190,230,0.75)" }}>
                  {[
                    ["Type", imageAnalysisResults[modalIncident.id].incident_type],
                    ["Severity", imageAnalysisResults[modalIncident.id].severity_level],
                    ["Priority", imageAnalysisResults[modalIncident.id].priority_score],
                    ["Triage", imageAnalysisResults[modalIncident.id].triage_category],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
                      <span style={{ color: "rgba(130,165,220,0.5)", fontSize: "0.72rem" }}>{label}</span>
                      <span style={{ color: "rgba(190,215,250,0.85)", lineHeight: 1.4 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(82, 175, 255, 0.3)" }}>
                    <span style={{ color: "rgba(130,165,220,0.5)", fontSize: "0.72rem" }}>Visual Assessment</span>
                    <p style={{ margin: "4px 0 0 0", color: "rgba(190,215,250,0.85)", fontSize: "0.76rem", lineHeight: 1.4 }}>
                      {imageAnalysisResults[modalIncident.id].image_analysis}
                    </p>
                  </div>
                </div>
              </article>
            )}

            {/* AI output */}
            <article className="glass" style={{ padding: "10px 12px", borderRadius: 10 }}>
              <p className="panel-title" style={{ margin: "0 0 8px", fontSize: "0.65rem", letterSpacing: "0.08em" }}>AI TACTICAL OUTPUT</p>
              <div style={{ display: "grid", gap: 5, fontSize: "0.78rem", color: "rgba(160,190,230,0.75)" }}>
                {[
                  ["Priority", modalIncident.priorityScore ?? "—"],
                  ["Threat", modalIncident.threatGrowth != null ? `${modalIncident.threatGrowth}%` : "—"],
                  ["Prediction", modalIncident.prediction || "—"],
                  ["Dispatch", modalIncident.dispatchAction || "—"],
                  ["Reason", modalIncident.dispatchReason || "—"],
                  ["Briefing", modalIncident.briefing || "—"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
                    <span style={{ color: "rgba(130,165,220,0.5)", fontSize: "0.72rem" }}>{label}</span>
                    <span style={{ color: "rgba(190,215,250,0.85)", lineHeight: 1.4 }}>{val}</span>
                  </div>
                ))}
              </div>
            </article>

            {processingErrors[modalIncident.id] && (
              <p style={{ margin: 0, color: "#ff89a2", fontSize: "0.78rem" }}>{processingErrors[modalIncident.id]}</p>
            )}

            <button
              type="button"
              className="btn btn-critical"
              onClick={async () => { if (!modalIncident) return; await processIncident(modalIncident); }}
              disabled={processingIncidentId === modalIncident.id}
              style={{ ...buttonProportion, width: "100%", minHeight: 40, fontSize: "0.84rem" }}
            >
              {processingIncidentId === modalIncident.id ? "Processing..." : "Escalate Response Team"}
            </button>
          </article>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 1280px) {
          .visualization-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 980px) {
          .status-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .admin-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .admin-tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            padding: 8px;
          }

          .admin-tab-btn {
            width: 100% !important;
          }
        }

        @media (max-width: 640px) {
          .status-cards-grid {
            grid-template-columns: 1fr !important;
          }

          .admin-tabs {
            grid-template-columns: 1fr !important;
          }

          .admin-tab-btn {
            width: 100% !important;
          }

          .admin-header :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}