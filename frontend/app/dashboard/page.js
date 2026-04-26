"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDb, hasFirebaseConfig } from "../../lib/firebase";

function statusClass(status) {
  if (status === "resolved") return "sev-low";
  if (status === "processing") return "sev-high";
  return "sev-medium";
}

function formatTimestamp(value) {
  if (!value) return "Pending timestamp";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "2-digit",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending timestamp";
  return parsed.toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

export default function UserDashboardPage() {
  const router = useRouter();
  const [incidentText, setIncidentText] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [location, setLocation] = useState("Location not attached");
  const [locationCoords, setLocationCoords] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  function onLogout() {
    localStorage.removeItem("ecsAuth");
    router.replace("/login");
  }

  useEffect(() => {
    const raw = localStorage.getItem("ecsAuth");
    if (!raw) {
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.role || (parsed.role !== "user" && parsed.role !== "admin")) {
        router.replace("/login");
        return;
      }

      if (!parsed?.email) {
        router.replace("/login");
        return;
      }

      setCurrentUser(parsed);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!currentUser?.email) return undefined;

    const db = getDb();

    if (!hasFirebaseConfig() || !db) {
      setSubmitError("Firebase is not configured in frontend environment variables.");
      return undefined;
    }

    const incidentsQuery = query(
      collection(db, "incidents"),
      where("userId", "==", currentUser.email)
    );

    const unsub = onSnapshot(
      incidentsQuery,
      (snapshot) => {
        const entries = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              description: String(data.description || "No description"),
              status: String(data.status || "pending"),
              createdAt: data.createdAt || null,
            };
          })
          .sort((a, b) => {
            const at = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
            const bt = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
            return bt - at;
          });

        setHistory(entries);
      },
      () => {
        setSubmitError("Unable to stream your incidents in real-time.");
      }
    );

    return () => unsub();
  }, [currentUser]);

  const canSubmit = useMemo(
    () => Boolean(locationCoords) && (incidentText.trim().length > 0 || uploadedImage),
    [incidentText, locationCoords, uploadedImage]
  );

  function onFetchLocation() {
    if (!navigator.geolocation) {
      setLocation("Geolocation is not supported in this browser");
      return;
    }

    setIsFetchingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocationCoords({ lat: latitude, lng: longitude });
        setLocation(
          `${latitude.toFixed(6)}, ${longitude.toFixed(6)} • Accuracy ~${Math.round(accuracy)}m`
        );
        setIsFetchingLocation(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocation("Location permission denied. Please allow location access.");
          setLocationCoords(null);
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocation("Location unavailable. Try again outdoors or on a stronger network.");
          setLocationCoords(null);
        } else if (error.code === error.TIMEOUT) {
          setLocation("Location request timed out. Please try again.");
          setLocationCoords(null);
        } else {
          setLocation("Unable to fetch your real location.");
          setLocationCoords(null);
        }
        setIsFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  async function onImageSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setSubmitError("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Image file is too large. Maximum size is 5MB.");
      return;
    }

    setUploadedImage(file);
    setSubmitError("");

    // Create preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImagePreview(evt.target.result);
    };
    reader.readAsDataURL(file);
  }

  function onClearImage() {
    setUploadedImage(null);
    setImagePreview(null);
  }

  async function onSubmitIncident() {
    if (!canSubmit) return;

    const db = getDb();

    if (!currentUser?.email || !db) {
      setSubmitError("Cannot submit without authenticated user and Firestore connection.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const incidentData = {
        userId: currentUser.email,
        description: incidentText.trim(),
        imageUrl: imagePreview || null,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        status: "pending",
        severity_level: null,
        priority_score: null,
        triage_category: null,
        image_analysis: null,
        reason: null,
        prediction: null,
        dispatch_action: null,
        dispatch_reason: null,
        briefing: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "incidents"), incidentData);

      setIncidentText("");
      setUploadedImage(null);
      setImagePreview(null);
    } catch {
      setSubmitError("Failed to submit incident to Firestore.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell" style={{ display: "grid", gap: 16 }}>
      <header
        className="glass slide-up"
        style={{
          padding: "18px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <p className="panel-title">AI Emergency Command System</p>
          <h1 className="h2">Rapid Incident Reporting Console</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="tag">Responder: Field Unit 21</div>
          <button type="button" className="btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr minmax(280px, 0.8fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <article className="glass-strong slide-up" style={{ padding: 22, animationDelay: "90ms" }}>
          <p className="panel-title">Create Incident Report</p>
          <h2 className="h2" style={{ marginBottom: 10 }}>
            Describe emergency details
          </h2>

          <textarea
            className="field"
            value={incidentText}
            onChange={(e) => setIncidentText(e.target.value)}
            placeholder="Describe what happened, nearby landmarks, people involved, and immediate risks..."
            rows={8}
            style={{ resize: "vertical", minHeight: 180 }}
          />

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
              gap: 10,
            }}
          >
            <label className="btn" style={{ textAlign: "center", cursor: "pointer" }}>
              {uploadedImage ? "✓ Image Ready" : "Upload Image"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onImageSelected}
              />
            </label>
            <button type="button" className="btn" aria-label="Voice input placeholder">
              Voice Input (Soon)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onFetchLocation}
              disabled={isFetchingLocation}
            >
              {isFetchingLocation ? "Locating..." : "Fetch My Location"}
            </button>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(130, 175, 255, 0.2)",
              background: "rgba(14, 24, 45, 0.6)",
            }}
          >
            <span className="muted" style={{ fontSize: "0.88rem" }}>
              {location}
            </span>
          </div>

          {imagePreview && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(130, 175, 255, 0.3)",
                background: "rgba(14, 24, 45, 0.6)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span className="panel-title" style={{ margin: 0 }}>
                  Image Preview
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={onClearImage}
                  style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                >
                  Remove
                </button>
              </div>

              <img
                src={imagePreview}
                alt="Incident"
                style={{
                  width: "100%",
                  maxHeight: 200,
                  borderRadius: 8,
                  objectFit: "cover",
                  marginBottom: 10,
                }}
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14, width: "100%", padding: "14px 16px", fontSize: "1rem" }}
            onClick={onSubmitIncident}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Emergency Report"}
          </button>

          {submitError ? (
            <p className="muted" style={{ color: "#ff89a2", marginTop: 8, marginBottom: 0 }}>
              {submitError}
            </p>
          ) : null}
        </article>

        <aside className="glass fade-in" style={{ padding: 18 }}>
          <p className="panel-title">Recent Submissions</p>
          <div style={{ display: "grid", gap: 10 }}>
            {history.map((entry) => (
              <article
                key={entry.id}
                style={{
                  border: "1px solid rgba(130, 175, 255, 0.18)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(14, 24, 45, 0.62)",
                  display: "grid",
                  gap: 8,
                  transition: "transform 200ms ease, border-color 200ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: "0.93rem" }}>{entry.description}</strong>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
                    <span className={`severity-dot ${statusClass(entry.status)}`} />
                    {entry.status}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: "0.82rem" }}>
                  {formatTimestamp(entry.createdAt)}
                </span>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <style jsx>{`
        @media (max-width: 980px) {
          section {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          article div[style*="repeat(3"] {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}