"use client";

import React, { Suspense, useMemo, useState, useCallback } from "react";
import { cn, formatPct, formatBytes } from "@/lib/utils";
import { useEventsStore } from "@/stores/events";
import { useSearchParams } from "next/navigation";
import { agentStatusVariant, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RefreshCw, Search, Terminal as TerminalIcon } from "lucide-react";
import type { AgentState } from "@swarmx/types";
import { useUIStore } from "@/stores/ui";
import { useApiHealth } from "@/hooks/useApiHealth";
import { RouteDegradedBanner } from "@/components/layout/RouteDegradedBanner";
import { resolveClientApiBaseUrl } from "@/lib/api-config";

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentDataStatus(status: AgentState["status"]): string {
  if (status === "running" || status === "active") return "active";
  if (status === "idle") return "idle";
  if (status === "queued") return "queued";
  if (status === "error" || status === "fatal" || status === "failed" || status === "failed_permanent") return "error";
  if (status === "success") return "success";
  if (status === "throttled") return "throttled";
  return "idle";
}

function isRunningStatus(status: AgentState["status"]): boolean {
  return status === "running" || status === "active";
}

function isErrorStatus(status: AgentState["status"]): boolean {
  return status === "error" || status === "fatal" || status === "failed" || status === "failed_permanent";
}

// ── Status filter tabs ────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: "All",       value: "all" },
  { label: "Running",   value: "running" },
  { label: "Idle",      value: "idle" },
  { label: "Queued",    value: "queued" },
  { label: "Error",     value: "error" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

// ── Agent table ───────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  nowMs,
  onSelect,
}: {
  readonly agent: AgentState;
  readonly nowMs: number;
  readonly onSelect: (a: AgentState) => void;
}) {
  // Normalise the resource/resources alias — API may send either field
  const res = agent.resources ?? agent.resource ?? null;
  const cpuPct = res?.cpuPercent ?? 0;
  const memMb = res?.memoryMb ?? res?.memRssMb ?? 0;
  const throttled = (res?.cpuThrottledPercent ?? 0) > 10;
  const oomEvents = res?.oomEvents ?? 0;
  let cpuClassName = "text-text-secondary";
  if (cpuPct > 85) {
    cpuClassName = "text-status-error";
  } else if (cpuPct > 60) {
    cpuClassName = "text-status-warning";
  }

  return (
    <tr className="border-b border-border last:border-0 transition-colors duration-(--duration-micro) hover:bg-bg-elevated">
      <td className="w-10 px-4 py-2.5">
        <span
          className="status-dot h-2 w-2 shrink-0"
          data-status={agentDataStatus(agent.status)}
          aria-hidden="true"
        />
      </td>
      <th scope="row" className="min-w-48 px-2 py-2.5 text-left font-normal">
        <button
          type="button"
          onClick={() => onSelect(agent)}
          className="block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          aria-label={`View details for ${agent.name ?? agent.id}`}
        >
          <span className="block truncate text-xs font-mono text-text-primary">
            {agent.name ?? agent.id}
            {oomEvents > 0 && (
              <span className="ml-1.5 text-[9px] text-status-error">OOM×{oomEvents}</span>
            )}
          </span>
          <span className="block truncate text-[10px] font-mono text-text-muted">{agent.role}</span>
        </button>
      </th>
      <td className="px-3 py-2.5">
        <Badge variant={agentStatusVariant(agent.status)} className="w-fit text-[9px]">
          {agent.status}
        </Badge>
      </td>
      <td className={cn("px-3 py-2.5 text-right text-xs font-mono tabular-nums", cpuClassName)} data-metric>
        {formatPct(cpuPct)}
        {throttled && <span className="ml-0.5 text-[9px] text-status-warning">↓</span>}
      </td>
      <td className="px-3 py-2.5 text-right text-xs font-mono tabular-nums text-text-secondary" data-metric>
        {formatBytes(memMb * 1024 * 1024)}
      </td>
      <td className="max-w-56 truncate px-3 py-2.5 text-[10px] font-mono text-text-muted">
        {agent.currentTask ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-right text-[10px] font-mono text-text-muted">
        {agent.startedAt ? formatDuration(nowMs - new Date(agent.startedAt).getTime()) : "—"}
      </td>
    </tr>
  );
}

function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${m % 60}m`;
  if (m > 0) return `${m}m${s % 60}s`;
  return `${s}s`;
}

// ── Agent detail sheet ────────────────────────────────────────────────────────

function AgentDetailSheet({
  agent,
  onClose,
}: {
  readonly agent: AgentState | null;
  readonly onClose: () => void;
}) {
  const addTerminalTab = useUIStore((s) => s.addTerminalTab);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);

  const openAgentTerminal = () => {
    if (!agent) return;
    addTerminalTab(`agent:${agent.name ?? agent.id}`, agent.id);
    toggleTerminal();
    onClose();
  };

  return (
    <Sheet open={agent !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        {agent && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span
                  className="status-dot h-2.5 w-2.5"
                  data-status={agentDataStatus(agent.status)}
                />
                <SheetTitle>{agent.name ?? agent.id}</SheetTitle>
              </div>
              <SheetDescription>{agent.role}</SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-6">
                {/* Status + Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={agentStatusVariant(agent.status)}>{agent.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openAgentTerminal}
                    className="gap-1.5"
                  >
                    <TerminalIcon className="h-3 w-3" />
                    Attach Terminal
                  </Button>
                </div>

                {/* Resource metrics */}
                {(() => {
                  const res = agent.resources ?? agent.resource ?? null;
                  return (
                    <section>
                      <h4 className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
                        Resources
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <DetailMetric label="CPU" value={formatPct(res?.cpuPercent ?? 0)} alert={(res?.cpuPercent ?? 0) > 85} />
                        <DetailMetric label="Memory" value={formatBytes((res?.memoryMb ?? res?.memRssMb ?? 0) * 1024 * 1024)} />
                        <DetailMetric label="Throttled" value={formatPct(res?.cpuThrottledPercent ?? 0)} alert={(res?.cpuThrottledPercent ?? 0) > 10} />
                        <DetailMetric label="OOM Events" value={String(res?.oomEvents ?? 0)} alert={(res?.oomEvents ?? 0) > 0} />
                        {res?.ioReadBytes != null && (
                          <DetailMetric label="I/O Read" value={formatBytes(res.ioReadBytes)} />
                        )}
                        {res?.ioWriteBytes != null && (
                          <DetailMetric label="I/O Write" value={formatBytes(res.ioWriteBytes)} />
                        )}
                      </div>
                    </section>
                  );
                })()}

                {/* Current task */}
                {agent.currentTask && (
                  <section>
                    <h4 className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
                      Current Task
                    </h4>
                    <p className="text-xs font-mono text-text-secondary">{agent.currentTask}</p>
                  </section>
                )}

                {/* Last error */}
                {agent.lastError && (
                  <section>
                    <h4 className="text-[10px] font-mono text-status-error uppercase tracking-widest mb-2">
                      Last Error
                    </h4>
                    <p className="rounded bg-status-error/5 p-2 text-[10px] font-mono text-status-error">
                      This agent reported an error. Review the structured server logs using this agent ID for details.
                    </p>
                  </section>
                )}

                {/* Metadata */}
                <section>
                  <h4 className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
                    Metadata
                  </h4>
                  <div className="space-y-1">
                    <KeyValue label="ID" value={agent.id} />
                    <KeyValue label="Model" value={agent.model ?? "—"} />
                    <KeyValue label="Started" value={agent.startedAt ? new Date(agent.startedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" }) : "—"} />
                    <KeyValue label="PID" value={agent.pid == null ? "—" : String(agent.pid)} />
                    <KeyValue label="cgroup" value={agent.cgroupPath ?? "—"} />
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailMetric({ label, value, alert }: { readonly label: string; readonly value: string; readonly alert?: boolean }) {
  return (
    <div className="bg-bg-elevated rounded p-2">
      <div className="text-[9px] font-mono text-text-muted uppercase tracking-wide">{label}</div>
      <div
        className={cn("text-sm font-mono tabular-nums font-medium mt-0.5", alert ? "text-status-error" : "text-text-primary")}
        data-metric
      >
        {value}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-mono text-text-muted w-16 shrink-0">{label}</span>
      <span className="text-[10px] font-mono text-text-secondary break-all">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function AgentsPageContent() {
  const agentsMap = useEventsStore((s) => s.agents);
  const replaceAgents = useEventsStore((s) => s.replaceAgents);
  const agents = useMemo(() => [...agentsMap.values()], [agentsMap]);
  const searchParams = useSearchParams();
  const governorState = useEventsStore((s) => s.governorState);
  const startupSummary = useEventsStore((s) => s.startupSummary);
  const apiHealth = useApiHealth();
  const pressureLevel = governorState?.pressureLevel ?? startupSummary?.pressureLevel;
  const availableMb = governorState?.availableMb ?? startupSummary?.availableMb ?? null;
  const ollamaOnline = apiHealth.ollamaOnline ?? startupSummary?.ollamaReachable ?? null;
  // [V6.1-FIX-10] Local client state for uptime rendering.
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [ignoreUrlFocus, setIgnoreUrlFocus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const connectionStatus = useEventsStore((s) => s.connectionStatus);

  const refreshAgents = useCallback(async (signal?: AbortSignal) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timeoutId = window.setTimeout(abort, 5_000);
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });

    try {
      const base = resolveClientApiBaseUrl();
      const res = await fetch(`${base}/api/agents`, { cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as { agents?: AgentState[] };
      replaceAgents(data.agents ?? []);
    } catch { /* best-effort */ }
    finally {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
    }
  }, [replaceAgents]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshAgents();
    setIsRefreshing(false);
  }, [refreshAgents]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (connectionStatus !== "disconnected") return;

    // §4: ≤10 s interval, max 12 attempts, jitter, pause when hidden, abort on SSE reconnect
    const POLL_INTERVAL_MS = 8_000;
    const MAX_POLL_ATTEMPTS = 12;

    const controller = new AbortController();
    let attempts = 0;

    void refreshAgents(controller.signal);

    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        window.clearInterval(intervalId);
        return;
      }
      const jitter = (Math.random() * 2 - 1) * POLL_INTERVAL_MS * 0.1;
      window.setTimeout(() => void refreshAgents(controller.signal), Math.round(jitter));
      attempts++;
    }, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [connectionStatus, refreshAgents]);

  const handleSelectAgent = useCallback(
    (chosen: AgentState) => {
      setIgnoreUrlFocus(true);
      setSelectedAgentId(chosen.id);
    },
    [],
  );

  const selectedAgent = useMemo(() => {
    const focusId = ignoreUrlFocus ? null : searchParams.get("focus");
    const effectiveId = selectedAgentId ?? focusId;
    if (!effectiveId) return null;
    return agents.find((a) => a.id === effectiveId) ?? null;
  }, [agents, ignoreUrlFocus, searchParams, selectedAgentId]);

  const filtered = useMemo(() => {
    let list = agents;
    if (statusFilter !== "all") {
      list = list.filter((a) =>
        statusFilter === "error"
          ? isErrorStatus(a.status)
          : statusFilter === "running"
          ? isRunningStatus(a.status)
          : a.status === statusFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.role ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [agents, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: agents.length,
      running: agents.filter((a) => isRunningStatus(a.status)).length,
      idle: agents.filter((a) => a.status === "idle").length,
      queued: agents.filter((a) => a.status === "queued").length,
      error: agents.filter((a) => isErrorStatus(a.status)).length,
    };
  }, [agents]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4">
        <RouteDegradedBanner
          pressureLevel={pressureLevel}
          availableMb={availableMb}
          apiOnline={apiHealth.apiOnline}
          ollamaOnline={ollamaOnline}
        />
      </div>

      {/* Toolbar */}
      <div className="px-4 pt-4 pb-2 space-y-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-mono font-semibold text-text-primary">Agent Fleet</h1>
          <div className="flex items-center gap-2">
            {(connectionStatus === "disconnected" || connectionStatus === "connecting") && (
              <span className="text-[9px] font-mono text-status-warning uppercase tracking-wide" role="status">
                {connectionStatus === "connecting" ? "reconnecting…" : "live feed unavailable · polling every 8 s"}
              </span>
            )}
            <span className="text-xs font-mono text-text-muted tabular-nums" data-metric>
              {filtered.length} of {agents.length}
            </span>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="flex h-11 w-11 items-center justify-center rounded hover:bg-bg-elevated transition-colors disabled:opacity-50"
              aria-label="Refresh agent list"
              aria-busy={isRefreshing}
            >
              <RefreshCw className={cn("h-3 w-3 text-text-muted", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="text-[9px] tabular-nums" data-metric>
                  {counts[f.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, role, or ID..."
            className="pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse" aria-label="Agent fleet">
            <caption className="sr-only">
              Live agent status, resource use, active work, and uptime. Select an agent name for details.
            </caption>
            <thead className="border-b border-border bg-bg-surface">
              <tr className="text-[9px] font-mono uppercase tracking-wide text-text-muted">
                <th scope="col" className="w-10 px-4 py-1.5"><span className="sr-only">Health</span></th>
                <th scope="col" className="px-2 py-1.5 text-left">Agent</th>
                <th scope="col" className="px-3 py-1.5 text-left">Status</th>
                <th scope="col" className="px-3 py-1.5 text-right">CPU</th>
                <th scope="col" className="px-3 py-1.5 text-right">Memory</th>
                <th scope="col" className="px-3 py-1.5 text-left">Current task</th>
                <th scope="col" className="px-4 py-1.5 text-right">Uptime</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-40 px-4 text-center text-xs font-mono text-text-muted">
                    {agents.length === 0 ? "No agents have checked in yet — is the swarm running?" : "Nothing matches that filter — try broadening your search"}
                  </td>
                </tr>
              ) : (
                filtered.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    nowMs={nowMs}
                    onSelect={handleSelectAgent}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Agent detail sheet */}
      <AgentDetailSheet
        agent={selectedAgent}
        onClose={() => {
          setSelectedAgentId(null);
          setIgnoreUrlFocus(true);
        }}
      />
    </div>
  );
}

function AgentsPageFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 pt-4 pb-2">
        <div className="h-6 w-36 skeleton" />
      </div>
      <div className="flex-1 p-4 space-y-2">
        <div className="h-8 w-full skeleton" />
        <div className="h-8 w-full skeleton" />
        <div className="h-8 w-full skeleton" />
        <div className="h-8 w-full skeleton" />
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<AgentsPageFallback />}>
      <AgentsPageContent />
    </Suspense>
  );
}
