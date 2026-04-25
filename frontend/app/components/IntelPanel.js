"use client";

/* ─────────────────────────────────────────────
   IntelPanel — right side intelligence display
   ───────────────────────────────────────────── */

const TRIAGE_CONFIG = {
  MINOR:     { color: "var(--color-green)",  bg: "rgba(16,185,129,0.1)",  label: "MINOR",     tag: "Green"  },
  DELAYED:   { color: "var(--color-yellow)", bg: "rgba(245,158,11,0.1)",  label: "DELAYED",   tag: "Yellow" },
  IMMEDIATE: { color: "var(--color-red)",    bg: "rgba(239,68,68,0.1)",   label: "IMMEDIATE", tag: "Red"    },
  CRITICAL:  { color: "#6b7280",             bg: "rgba(107,114,128,0.1)", label: "CRITICAL",  tag: "Black"  },
};

const SEVERITY_COLORS = {
  low:      "var(--color-green)",
  medium:   "var(--color-yellow)",
  high:     "var(--color-red)",
  critical: "#7c3aed",
};

/* ── Circular progress ring ────────────────── */
function CircleGauge({ value, max = 100, size = 80, color }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / max) * circ;

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="6"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={color}
        fontSize="16"
        fontWeight="700"
        fontFamily="var(--font-mono)"
      >
        {value}
      </text>
    </svg>
  );
}

/* ── Stat Card ─────────────────────────────── */
function StatCard({ label, value, color, icon }) {
  return (
    <div
      className="rounded-lg border border-[var(--color-border)] p-3 text-center transition-all duration-300 hover:border-opacity-60"
      style={{ borderColor: `${color}33`, background: `${color}08` }}
    >
      <p className="text-[10px] font-mono tracking-widest text-[var(--color-text-dim)] uppercase mb-1">
        {icon} {label}
      </p>
      <p className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────── */
function Skeleton({ step }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--color-primary)]/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-primary)] animate-spin" />
      </div>
      <p className="text-sm font-mono text-[var(--color-accent)] animate-pulse">
        {step}
      </p>
    </div>
  );
}

/* ── Empty state ───────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="text-4xl opacity-30">📡</div>
      <p className="text-sm text-[var(--color-text-dim)] font-mono">
        AWAITING INCIDENT INPUT
      </p>
      <p className="text-xs text-[var(--color-text-dim)]/60 max-w-[250px]">
        Submit an emergency report to activate the intelligence pipeline
      </p>
    </div>
  );
}

/* ── Main Panel ────────────────────────────── */
export default function IntelPanel({
  analysis,
  prediction,
  dispatch,
  briefing,
  loading,
  step,
  error,
}) {
  if (error) {
    return (
      <div className="glass-card p-5 h-full animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-[var(--color-red)]" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--color-red)]">
            System Error
          </h2>
        </div>
        <div className="bg-[var(--color-red)]/10 border border-[var(--color-red)]/20 rounded-lg p-4">
          <p className="text-sm text-[var(--color-red)] font-mono">{error}</p>
          <p className="text-xs text-[var(--color-text-dim)] mt-2">
            Check that the backend is running on port 8000
          </p>
        </div>
      </div>
    );
  }

  if (loading && !analysis) {
    return (
      <div className="glass-card p-5 h-full">
        <SectionHeader title="Intelligence" />
        <Skeleton step={step} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="glass-card p-5 h-full">
        <SectionHeader title="Intelligence" />
        <EmptyState />
      </div>
    );
  }

  const triageCfg = TRIAGE_CONFIG[analysis.triage_category] || TRIAGE_CONFIG.MINOR;
  const sevColor = SEVERITY_COLORS[analysis.severity_level] || "var(--color-primary)";

  return (
    <div className="glass-card p-5 h-full overflow-y-auto flex flex-col gap-5 animate-slide-in">
      {/* Header */}
      <SectionHeader title="Intelligence Report" />

      {/* ── Triage Banner ────────────────────── */}
      <div
        className="rounded-lg p-4 border flex items-center justify-between"
        style={{
          borderColor: triageCfg.color,
          background: triageCfg.bg,
        }}
      >
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[var(--color-text-dim)] uppercase">
            START Triage
          </p>
          <p className="text-2xl font-extrabold tracking-wide" style={{ color: triageCfg.color }}>
            {triageCfg.label}
          </p>
          <p className="text-xs font-mono mt-0.5" style={{ color: triageCfg.color }}>
            Category {triageCfg.tag}
          </p>
        </div>
        <CircleGauge
          value={analysis.priority_score}
          color={sevColor}
        />
      </div>

      {/* ── Stats Grid ────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Incident"
          value={analysis.incident_type?.replace(/_/g, " ").toUpperCase()}
          color="var(--color-primary-light)"
          icon="🔹"
        />
        <StatCard
          label="Severity"
          value={analysis.severity_level?.toUpperCase()}
          color={sevColor}
          icon="⚠️"
        />
        <StatCard
          label="Priority"
          value={`${analysis.priority_score}/100`}
          color={sevColor}
          icon="📊"
        />
        <StatCard
          label="Location"
          value={analysis.location?.length > 18 ? analysis.location.slice(0, 16) + "…" : analysis.location}
          color="var(--color-accent)"
          icon="📍"
        />
      </div>

      {/* ── Reason ────────────────────────────── */}
      <InfoBlock title="Analysis Reasoning" icon="🧠">
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {analysis.reason}
        </p>
      </InfoBlock>

      {/* ── Escalation ────────────────────────── */}
      {prediction && (
        <InfoBlock title="Escalation Prediction" icon="📈">
          <div className="flex items-center gap-4 mb-3">
            <CircleGauge
              value={prediction.threat_growth}
              size={70}
              color={
                prediction.threat_growth >= 70
                  ? "var(--color-red)"
                  : prediction.threat_growth >= 40
                  ? "var(--color-yellow)"
                  : "var(--color-green)"
              }
            />
            <div>
              <p className="text-xs font-mono text-[var(--color-text-dim)] uppercase mb-1">
                Threat Growth
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {prediction.prediction}
              </p>
            </div>
          </div>
          {/* Threat bar */}
          <div className="w-full h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${prediction.threat_growth}%`,
                background:
                  prediction.threat_growth >= 70
                    ? "var(--color-red)"
                    : prediction.threat_growth >= 40
                    ? "var(--color-yellow)"
                    : "var(--color-green)",
              }}
            />
          </div>
        </InfoBlock>
      )}
      {loading && !prediction && (
        <Skeleton step="Predicting escalation..." />
      )}

      {/* ── Dispatch ──────────────────────────── */}
      {dispatch && (
        <InfoBlock title="Dispatch Order" icon="🚨">
          <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
            {dispatch.action}
          </p>
          <p className="text-xs text-[var(--color-text-dim)]">
            {dispatch.reason}
          </p>
        </InfoBlock>
      )}
      {loading && !dispatch && prediction && (
        <Skeleton step="Generating dispatch plan..." />
      )}

      {/* ── Briefing ──────────────────────────── */}
      {briefing && (
        <InfoBlock title="Tactical Briefing" icon="📋">
          <pre className="text-xs font-mono text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">
            {briefing.briefing}
          </pre>
        </InfoBlock>
      )}
      {loading && !briefing && dispatch && (
        <Skeleton step="Compiling briefing..." />
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────── */
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-5 rounded-full bg-[var(--color-red)]" />
      <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--color-text-muted)]">
        {title}
      </h2>
    </div>
  );
}

function InfoBlock({ title, icon, children }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-background)]/40 animate-fade-in">
      <p className="text-[10px] font-mono tracking-widest text-[var(--color-text-dim)] uppercase mb-2">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}
