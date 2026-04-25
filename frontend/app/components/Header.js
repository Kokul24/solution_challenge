"use client";

import { useState, useEffect } from "react";

export default function Header() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl px-6 py-3">
      {/* Scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none scanner" />

      <div className="flex items-center justify-between relative z-10">
        {/* Left — Logo + Title */}
        <div className="flex items-center gap-3">
          {/* Pulsing beacon */}
          <div className="relative flex items-center justify-center w-10 h-10">
            <div className="absolute w-10 h-10 rounded-full bg-[var(--color-red)]/20 animate-ping" />
            <div className="relative w-5 h-5 rounded-full bg-[var(--color-red)] shadow-lg shadow-red-500/50" />
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-wide text-[var(--color-text)] leading-tight">
              AI EMERGENCY COMMAND
            </h1>
            <p className="text-[10px] font-mono tracking-[0.3em] text-[var(--color-accent)] uppercase">
              Tactical Intelligence System
            </p>
          </div>
        </div>

        {/* Right — Clock + Status */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
            SYSTEM ONLINE
          </div>

          <div className="font-mono text-lg font-semibold text-[var(--color-accent-light)] tabular-nums tracking-wider">
            {time || "--:--:--"}
          </div>
        </div>
      </div>
    </header>
  );
}
