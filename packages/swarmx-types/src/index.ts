// ============================================================================
// SwarmX OS — Shared Type Definitions
// Target: Linux (Ubuntu 22.04+ / Debian 12+, systemd + cgroup v2)
// Shared between: apps/swarmx-dashboard (Next.js) · apps/swarmx-api (Fastify)
//
// Changelog:
//   [VIDEO-FIX-02] Added VideoJobStatus, VideoDegradeMode, VideoJobEventData,
//                  VideoHealthEventData types and wired video:progress +
//                  video:health into the SwarmXEvent discriminated union.
//                  Without this the dashboard's useSwarmXEvents hook silently
//                  drops all video SSE events — they arrive as unknown types
//                  and fall through the switch without reaching the video store.
//   [APEX17-r8]    Barrel-exported ./operator-map and ./operation-types so
//                  `import {...} from "@swarmx/types"` (root) exposes
//                  MODEL_OPERATOR_MAP / resolveCanonicalTag / OperationKey /
//                  TimeoutPressureLevel etc. Previously operator-map.ts was
//                  fully built but not re-exported from anywhere reachable
//                  by apps/swarmx-api — every consumer there had to reach in
//                  via a relative path or a subpath import that the package's
//                  own exports map did not declare. Both are now reachable
//                  either via this barrel or via the explicit subpaths
//                  "@swarmx/types/operator-map" and
//                  "@swarmx/types/operation-types" (see package.json). No
//                  name collisions: this file's own `PressureLevel` (3-value,
//                  system:governor) is untouched; the 4-value timeout-domain
//                  type is deliberately named `TimeoutPressureLevel` in
//                  operation-types.ts to avoid colliding with it — see that
//                  file's header for the full rationale.
// ============================================================================

export * from "./operator-map.ts";
export * from "./operation-types.ts";
export * from "./video-types.ts";
export * from "./series-types.ts";

import type { VideoHealthEventData, VideoJobEventData } from "./video-types.ts";


// ── Agent ────────────────────────────────────────────────────────────────────

export type AgentStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'success'
  | 'error'
  | 'fatal'
  | 'failed'
  | 'failed_permanent'
  | 'oom_killed'
  | 'oom'
  | 'killed'
  | 'throttled'
  | 'reloading'
  | 'reload'
  | 'paused'

export type SystemdUnitState =
  | 'active'
  | 'activating'
  | 'deactivating'
  | 'inactive'
  | 'failed'
  | 'reloading'

export interface AgentState {
  id: string
  status: AgentStatus
  name?: string
  role?: string
  model?: string | 'fast' | 'reason' | 'code'
  systemdUnit?: string // e.g. swarmx-agent-taxbridge.service
  systemdState?: SystemdUnitState
  pid?: number | null
  cgroupPath?: string // /sys/fs/cgroup/swarmx.slice/agent-[name].scope
  resource?: AgentResourceSnapshot | null
  /** Alias for resource — used by dashboard components */
  resources?: AgentResourceSnapshot | null
  lastActive?: number // Unix ms timestamp
  oomCount?: number // memory.events oom_kill counter
  skillTags?: string[]
  outputs?: string[]
  currentTask?: string
  lastError?: string
  startedAt?: string
}

export interface AgentResourceSnapshot {
  pid: number
  cpuPercent: number // from /proc/[pid]/stat
  memRssMb: number // from /proc/[pid]/status (VmRSS)
  /** Alias for memRssMb */
  memoryMb?: number
  memPssMb: number // from /proc/[pid]/smaps_rollup (proportional)
  cgroupPath: string
  cpuThrottledPercent: number // from cgroup cpu.stat (throttled_usec / usage_usec)
  oomEvents: number // from cgroup memory.events (oom_kill)
  ioReadBytes: number // from cgroup io.stat
  ioWriteBytes: number // from cgroup io.stat
}

// ── Workflow ─────────────────────────────────────────────────────────────────

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'dry-run'

export type WorkflowRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export type StepState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  yamlContent?: string
  /** Alias for yamlContent */
  rawYaml?: string
  /** Parsed workflow steps */
  steps?: unknown[]
  agentIds?: string[]
  lastRunAt?: number | null
  lastRunStatus?: WorkflowStatus | null
  runCount?: number
  runHistory?: WorkflowRunSummary[]
}

export interface WorkflowRunSummary {
  id: string
  workflowId: string
  startedAt: number
  completedAt: number | null
  status: WorkflowStatus
  stepsTotal: number
  stepsCompleted: number
  stepsFailed: number
  agentIds: string[]
}

export interface WorkflowRunState {
  runId: string
  workflowId: string
  correlationId: string
  status: WorkflowRunStatus
  createdAt: string
  updatedAt: string
  target?: string
  error?: string | null
  result?: unknown
}

export interface WorkflowStep {
  id: string
  name: string
  agentId: string
  state: StepState
  startedAt: number | null
  completedAt: number | null
  retryCount: number
  dependsOn: string[]
  errorMessage: string | null
}

// ── System Metrics ────────────────────────────────────────────────────────────

export interface SystemMetricsSnapshot {
  /** WAT ISO-8601 timestamp (UTC+1) */
  timestamp: number | string
  cpu: {
    load1m: number // /proc/loadavg
    load5m: number
    load15m: number
    /** Per-core utilisation 0–100. Field name alias: perCorePercent (API) */
    perCore: number[]
    /** Alias used by API broadcasts; same as perCore */
    perCorePercent?: number[]
    coreCount?: number
    temperatureCelsius?: number | null // /sys/class/hwmon (may be unavailable)
  }
  memory: {
    totalMb: number // /proc/meminfo MemTotal
    usedMb: number // MemTotal - MemAvailable
    swarmxSliceMb: number // /sys/fs/cgroup/swarmx.slice/memory.current / 1024²
    swarmxSliceLimitMb: number | null // /sys/fs/cgroup/swarmx.slice/memory.max
    availableMb?: number
  }
  disk: {
    readBytesPerSec: number // /proc/diskstats delta
    writeBytesPerSec: number
    usedPercent?: number // df /
    utilizationPercent?: number // alias
  }
  network: {
    rxBytesPerSec: number // /proc/net/dev delta
    txBytesPerSec: number
    interfaceName?: string
  }
}

/** V5 Swarm Coherence Score broadcast (emitted every ~15 s by API) */
export interface ScsSnapshot {
  score: number        // 0.0–1.0
  history: number[]    // last 20 readings
  timestamp: number | string
}

// ── Runtime Governor Snapshot (APEX-17 pressure-aware governance) ─────────────
// [V5.9-ENH-05] Broadcast by API v5metrics poller alongside system:scs.
// Consumers: dashboard TelemetryRail, CommandBar pressure badge.
export type PressureLevel = 'normal' | 'high' | 'critical'

export interface RuntimeGovernorSnapshot {
  /** Current procfs-derived pressure tier */
  pressureLevel: PressureLevel
  /** MemAvailable from /proc/meminfo in MB (0 = unreadable) */
  availableMb: number
  /** ZRAM utilisation fraction 0.0–1.0 */
  zramUsedPct: number
  /** Effective concurrency limit (governance.concurrency.*_max) */
  concurrencyLimit: number
  /** Whether governance is in observe-only mode */
  observeOnly: boolean
  /** Per-tier token ceilings as configured */
  tokenCeilings: Record<string, number>
  /** ISO-8601 UTC timestamp */
  timestamp: string
}

export interface CgroupScopeMetrics {
  path: string // /sys/fs/cgroup/swarmx.slice/agent-[name].scope
  agentId: string
  cpuUsagePercent: number // from cpu.stat throttled_usec / period_usec
  /** Alias for cpuUsagePercent */
  cpuPercent?: number
  cpuThrottledPercent: number
  /** Alias for cpuThrottledPercent */
  cpuThrottledPct?: number
  memCurrentMb: number // memory.current / 1024²
  /** Alias for memCurrentMb */
  memoryCurrentMb?: number
  memHighMb: number | null // memory.high
  memMaxMb: number | null // memory.max
  oomKillCount: number // memory.events oom_kill
  /** Alias for oomKillCount */
  oomEvents?: number
  ioReadBytes: number // io.stat rbytes
  ioWriteBytes: number // io.stat wbytes
}

// ── Queue (BullMQ) ────────────────────────────────────────────────────────────

export interface QueueMetrics {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
  latencyMs: number | null
}

// ── Logs (journald) ───────────────────────────────────────────────────────────

export type LogLevel = 'emergency' | 'alert' | 'critical' | 'fatal' | 'error' | 'warn' | 'notice' | 'info' | 'debug'

export interface JournaldEntry {
  id: string
  MESSAGE: string
  PRIORITY: string // 0=emerg, 3=err, 4=warning, 6=info, 7=debug
  _SYSTEMD_UNIT: string
  _PID: string
  __REALTIME_TIMESTAMP: string // microseconds since epoch as string
  SYSLOG_IDENTIFIER: string
}

export interface LogEntry {
  id?: string
  agentId?: string | null
  unit?: string
  level: LogLevel
  message: string
  timestamp: number | string // Unix ms or ISO string
  pid?: number | null
  raw?: string
}

// ── Control Plane ─────────────────────────────────────────────────────────────

export interface ControlPlaneLayer {
  id: string
  name: string
  description: string
  status: 'healthy' | 'degraded' | 'critical' | 'unknown'
  latencyP50Ms: number | null
  lastEventAt: number | null
}

// ── SSE Events ───────────────────────────────────────────────────────────────

export type WorkflowEventStatus = 'running' | 'success' | 'failed' | 'cancelled'

export interface WorkflowEventData {
  id: string
  workflowId: string
  correlationId: string
  status: WorkflowEventStatus
  timestamp: string
  name?: string
  exitCode?: number
  error?: string
}

// ── Python lifecycle events (V5.9-FIX-05) ───────────────────────────────────

export interface RunStartedData {
  jobId: string
  repo: string
  target: string
  timestamp: string
}

export interface RunCompletedData {
  jobId: string
  runId: string
  status: 'success' | 'partial' | 'failed' | 'error'
  timestamp: string
}

export interface MissionCreatedData {
  missionId: string
  repo: string
  target: string
  timestamp: string
}

export interface TaskEventData {
  goal: string
  stepIndex?: number
  runId?: string
  timestamp: string
}

export interface EvolutionEventData {
  jobId: string
  repo?: string
  proposalCount?: number
  timestamp: string
}

export interface WorkerJobEventData {
  jobId: string
  kind?: string
  repo?: string
  target?: string
  error?: string
  timestamp: string
}

// ── Startup Autopilot Summary (V6.1) ─────────────────────────────────────────
export interface StartupSummary {
  timestamp: string
  status: 'ready' | 'degraded' | 'critical'
  narrative: string
  pressureLevel: PressureLevel
  availableMb: number
  zramUsedPct: number
  concurrencyLimit: number
  ollamaReachable: boolean
  warmupDone: boolean
  evolverSynced: boolean
  evolverProposals: number
  durationMs: number
}

// ── Video Generation Types ────────────────────────────────────────────────────
// Canonical VIDEO-ALPHA contracts are exported from ./video-types.

// ── Discriminated union ───────────────────────────────────────────────────────

export type SwarmXEvent =
  // Agent lifecycle — full state object; handles create, update, status change
  | { type: 'agent:update'; data: AgentState }
  | { type: 'agent:remove'; data: { id: string } }
  // Workflow lifecycle
  | { type: 'workflow:started'; data: WorkflowEventData }
  | { type: 'workflow:completed'; data: WorkflowEventData }
  | { type: 'workflow:failed'; data: WorkflowEventData }
  | { type: 'workflow:cancelled'; data: WorkflowEventData }
  // Queue telemetry
  | { type: 'queue:metrics'; data: QueueMetrics }
  | { type: 'queue:drained'; data: { name: string } }
  // System metrics
  | { type: 'system:metrics'; data: SystemMetricsSnapshot }
  | { type: 'system:scs'; data: ScsSnapshot }
  | { type: 'system:governor'; data: RuntimeGovernorSnapshot }
  | { type: 'system:startup'; data: StartupSummary }
  | { type: 'system:oom'; data: { agentId: string; cgroupPath: string; count: number } }
  | { type: 'system:alert'; data: { severity: 'warn' | 'critical'; message: string; source: string; timestamp: number } }
  // cgroup scope telemetry
  | { type: 'cgroup:metrics'; data: CgroupScopeMetrics }
  // Structured log stream (journald)
  | { type: 'log:entry'; data: { timestamp: string; level: LogLevel; message: string; unit?: string; agentId?: string; traceId?: string } }
  // Python mission/run/task lifecycle
  | { type: 'mission:created'; data: MissionCreatedData }
  | { type: 'run:started'; data: RunStartedData }
  | { type: 'run:completed'; data: RunCompletedData }
  | { type: 'task:start'; data: TaskEventData }
  | { type: 'task:complete'; data: TaskEventData }
  | { type: 'task:failed'; data: TaskEventData }
  | { type: 'evolution:started'; data: EvolutionEventData }
  | { type: 'evolution:completed'; data: EvolutionEventData }
  | { type: 'worker:job_started'; data: WorkerJobEventData }
  | { type: 'worker:job_done'; data: WorkerJobEventData }
  | { type: 'worker:job_error'; data: WorkerJobEventData }
  // Control plane signals
  | { type: 'control:pause'; data: Record<string, never> }
  | { type: 'control:resume'; data: Record<string, never> }
  // [VIDEO-FIX-02] Video generation pipeline — must be in the shared union so
  // useSwarmXEvents can type-narrow and dispatch them to the video store.
  | { type: 'video:progress'; data: VideoJobEventData }
  | { type: 'video:health';   data: VideoHealthEventData }

// ── Legacy SSE events (kept for backward-compat consumers; not emitted by API v2+) ─

/** @deprecated Use agent:update instead */
export type LegacySwarmXEvent =
  | { type: 'agent:status'; agentId: string; status: AgentStatus; pid: number | null; timestamp: number }
  | { type: 'agent:resource'; agentId: string; resource: AgentResourceSnapshot }
  | { type: 'agent:log'; agentId: string; level: LogLevel; message: string; timestamp: number }
  | { type: 'agent:oom'; agentId: string; count: number; timestamp: number }
  | { type: 'queue:metrics'; queueName: string; metrics: QueueMetrics }
  | { type: 'cgroup:metrics'; metrics: CgroupScopeMetrics }
  | { type: 'system:cpu'; load1m: number; load5m: number; perCore: number[]; timestamp: number }
  | { type: 'system:memory'; totalMb: number; usedMb: number; swarmxSliceMb: number; timestamp: number }
  | { type: 'system:io'; readBps: number; writeBps: number; rxBps: number; txBps: number; timestamp: number }
  | { type: 'system:oom_global'; count: number; timestamp: number }
  | { type: 'workflow:step'; workflowId: string; stepId: string; state: StepState; timestamp: number }
  | { type: 'workflow:status'; workflowId: string; status: WorkflowStatus; timestamp: number }

// ── PTY (Terminal) ────────────────────────────────────────────────────────────

export interface PTYSessionConfig {
  shell: string // process.env.SHELL ?? '/bin/bash'
  cwd: string
  cols: number
  rows: number
  agentId?: string // if bound to agent stdout
  env?: Record<string, string>
}

export interface PTYResizeMessage {
  type: 'resize'
  cols: number
  rows: number
}

export interface PTYDataMessage {
  type: 'data'
  data: string
}

export type PTYClientMessage = PTYResizeMessage | PTYDataMessage

// ── API Response shapes ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  timestamp: number
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

// ── Terminal Tab ──────────────────────────────────────────────────────────────

export interface TerminalTab {
  id: string
  label: string
  sessionId: string
  agentId?: string
  lastExitCode: number | null
  cwd: string
  createdAt: number
}
