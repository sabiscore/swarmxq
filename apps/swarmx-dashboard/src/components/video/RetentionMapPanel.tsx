"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { resolveClientApiBaseUrl } from "@/lib/api-config";

interface RetentionBeat {
  timestamp: number;
  beatLabel: "HOOK" | "ORIENTATION" | "ESCALATION" | "INSIGHT" | "PROOF" | "PAYOFF" | "CTA_OR_LOOP";
  viewerQuestion: string;
  newInformation: string;
  visualEvent: string;
  microReward: string | null;
  dropOffRisk: "LOW" | "MEDIUM" | "HIGH";
  plannedRecovery: string | null;
}

interface RetentionMap {
  schemaVersion: 1;
  beats: RetentionBeat[];
  overallRisk: "LOW" | "MEDIUM" | "HIGH";
  highRiskCount: number;
  unrecoveredHighRiskCount: number;
  generatedAt: string;
}

function riskClasses(risk: "LOW" | "MEDIUM" | "HIGH"): string {
  switch (risk) {
    case "LOW":
      return "border-status-success/40 bg-status-success/6 text-status-success";
    case "MEDIUM":
      return "border-status-warning/40 bg-status-warning/6 text-status-warning";
    case "HIGH":
      return "border-status-error/40 bg-status-error/8 text-status-error";
  }
}

function resolveApiBase(): string {
  return resolveClientApiBaseUrl();
}

const DEFAULT_SCRIPT = `[HOOK]
Most creators lose 40% of viewers in three seconds — and it's not the algorithm.
[BODY]
The real drop-off is a hook that promises payoff too far away. Compress the promise to the first frame.
[RESOLUTION]
Move your strongest claim to word one. Everything downstream rewards you.
[CTA]
Watch the next one — same lesson, faster.`;

export function RetentionMapPanel() {
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [duration, setDuration] = useState<number>(33);
  const [map, setMap] = useState<RetentionMap | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${resolveApiBase()}/api/video/factory/retention-map/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ script, targetDurationSecs: duration }),
      });
      if (!res.ok) {
        setError(`API returned ${res.status}`);
        setLoading(false);
        return;
      }
      const body = (await res.json()) as RetentionMap;
      setMap(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
          Script draft
        </label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={10}
          className={cn(
            "font-mono text-xs bg-bg-panel border border-border rounded p-3",
            "text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          )}
          aria-label="Script text for retention preview"
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Target duration (sec)
          </label>
          <input
            type="number"
            min={5}
            max={600}
            value={duration}
            onChange={(e) => setDuration(Math.max(5, Math.min(600, Number(e.target.value) || 33)))}
            className={cn(
              "font-mono text-xs bg-bg-panel border border-border rounded px-3 py-2 w-24",
              "text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            )}
          />
        </div>
        <button
          onClick={preview}
          disabled={loading}
          className={cn(
            "font-mono text-xs px-3 py-2 rounded border transition-colors",
            "border-accent/40 bg-accent/6 text-accent hover:bg-accent/12",
            "disabled:opacity-50 disabled:cursor-wait",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          )}
        >
          {loading ? "computing…" : "Preview retention map"}
        </button>
        {error && (
          <div role="alert" className="text-xs font-mono text-status-error">
            {error}
          </div>
        )}
      </div>

      {map && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div
            className={cn(
              "flex items-center justify-between rounded border px-3 py-2",
              riskClasses(map.overallRisk),
            )}
          >
            <span className="text-xs font-mono">
              Overall risk: <strong>{map.overallRisk}</strong>
            </span>
            <span className="text-[10px] font-mono opacity-70">
              {map.highRiskCount} HIGH · {map.unrecoveredHighRiskCount} unrecovered
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {map.beats.map((beat, idx) => (
              <div
                key={`${beat.beatLabel}-${idx}`}
                className={cn(
                  "grid grid-cols-[6rem_1fr_auto] gap-3 rounded border px-3 py-2",
                  riskClasses(beat.dropOffRisk),
                )}
              >
                <div className="flex flex-col">
                  <div className="text-xs font-mono font-semibold">{beat.beatLabel}</div>
                  <div className="text-[10px] font-mono opacity-70">
                    t={beat.timestamp}s
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs font-mono">
                  <div className="opacity-70 italic">{beat.viewerQuestion}</div>
                  <div>{beat.newInformation}</div>
                  {beat.microReward && (
                    <div className="opacity-70">→ reward: {beat.microReward}</div>
                  )}
                  {beat.plannedRecovery && (
                    <div className="opacity-70">↻ recovery: {beat.plannedRecovery}</div>
                  )}
                </div>
                <div className="text-[10px] font-mono uppercase self-start opacity-70">
                  {beat.dropOffRisk}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
