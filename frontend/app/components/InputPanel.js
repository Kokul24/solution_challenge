"use client";

import { useState } from "react";

const SAMPLE_REPORTS = [
  "Major fire reported in a 12-story apartment building on MG Road. Multiple residents trapped on upper floors. Fire spreading rapidly. Smoke visible from 2km away. At least 15 people unaccounted for.",
  "Gas leak detected at Sunrise Chemical Plant in the industrial zone. Workers report strong fumes. 3 workers collapsed and unconscious. Hazardous material warning issued. Wind direction towards residential area.",
  "Flash flood in Riverside Colony after dam overflow. Water level 4 feet on ground floor of 50+ homes. Several elderly residents unable to evacuate. Road access completely cut off.",
  "Building collapse at old construction site near City Center. 5-story structure partially down. Construction workers believed to be inside. Dust cloud blocking visibility. Adjacent buildings at risk.",
  "Severe cyclone landfall at Marina Beach coast. Winds 130km/h. Multiple boats overturned. Coastal village evacuations incomplete. Power lines down across 3 districts.",
];

export default function InputPanel({ onSubmit, loading }) {
  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
  };

  const handleSample = (sample) => {
    setText(sample);
  };

  return (
    <div className="glass-card p-5 animate-fade-in">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--color-text-muted)]">
          Emergency Input
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          id="emergency-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter emergency report... (e.g., 'Major fire in residential building, 5 people trapped on 3rd floor, smoke everywhere')"
          rows={4}
          disabled={loading}
          className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/30 transition-all resize-none font-mono disabled:opacity-50"
        />

        <div className="flex items-center justify-between mt-3 gap-3">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            id="submit-incident"
            className="px-6 py-2.5 rounded-lg font-semibold text-sm tracking-wide transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-light)] hover:to-[var(--color-accent-light)] text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                PROCESSING
              </span>
            ) : (
              "⚡ ANALYZE INCIDENT"
            )}
          </button>

          <button
            type="button"
            onClick={() => setText("")}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)] transition-all disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Sample Scenarios */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <p className="text-[10px] font-mono tracking-widest text-[var(--color-text-dim)] uppercase mb-2">
          Quick Scenarios
        </p>
        <div className="flex flex-wrap gap-2">
          {["🔥 Fire", "☣️ Gas Leak", "🌊 Flood", "🏚️ Collapse", "🌀 Cyclone"].map(
            (label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSample(SAMPLE_REPORTS[i])}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:border-[var(--color-accent)]/40 transition-all disabled:opacity-40"
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
