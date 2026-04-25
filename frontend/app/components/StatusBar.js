"use client";

export default function StatusBar({ loading, step, incidentCount }) {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm px-6 py-2 flex items-center justify-between text-[10px] font-mono tracking-wider text-[var(--color-text-dim)]">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              loading ? "bg-[var(--color-yellow)] animate-pulse" : "bg-[var(--color-green)]"
            }`}
          />
          {loading ? "PROCESSING" : "READY"}
        </span>
        {step && step !== "Complete" && step !== "Error" && (
          <span className="text-[var(--color-accent)]">» {step}</span>
        )}
      </div>

      <div className="flex items-center gap-6">
        <span>INCIDENTS: {incidentCount}</span>
        <span>GEMINI 2.0 FLASH</span>
        <span>RF CLASSIFIER v1</span>
      </div>
    </footer>
  );
}
