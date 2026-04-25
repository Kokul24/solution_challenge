"use client";

import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Default center — India (Chennai)
const DEFAULT_CENTER = { lat: 13.0827, lng: 80.2707 };

const SEVERITY_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#7c3aed",
};

export default function MapView({ incidents = [] }) {
  if (!MAPS_KEY) {
    return (
      <div className="glass-card flex-1 min-h-[300px] lg:min-h-0 flex items-center justify-center animate-fade-in">
        <div className="text-center text-[var(--color-text-dim)]">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-sm font-mono">GOOGLE_MAPS_API_KEY not configured</p>
          <p className="text-xs mt-1">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card flex-1 min-h-[300px] lg:min-h-0 overflow-hidden animate-fade-in relative">
      {/* Section Header */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-[var(--color-accent)]" />
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--color-text-muted)] bg-[var(--color-background)]/80 backdrop-blur-sm px-2 py-0.5 rounded">
          Tactical Map
        </h2>
        {incidents.length > 0 && (
          <span className="text-[10px] font-mono bg-[var(--color-red)]/20 text-[var(--color-red)] px-2 py-0.5 rounded-full">
            {incidents.length} ACTIVE
          </span>
        )}
      </div>

      <APIProvider apiKey={MAPS_KEY}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={12}
          mapId="emergency-command-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: "100%", height: "100%" }}
          colorScheme="DARK"
        >
          {incidents.map((inc) => {
            const color = SEVERITY_COLORS[inc.severity_level] || "#3b82f6";
            // Offset markers slightly so they don't stack
            const offset = incidents.indexOf(inc) * 0.003;
            return (
              <AdvancedMarker
                key={inc.id}
                position={{
                  lat: DEFAULT_CENTER.lat + (Math.random() - 0.5) * 0.05 + offset,
                  lng: DEFAULT_CENTER.lng + (Math.random() - 0.5) * 0.05,
                }}
                title={`${inc.incident_type} — ${inc.severity_level}`}
              >
                <Pin
                  background={color}
                  borderColor={color}
                  glyphColor="white"
                />
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
