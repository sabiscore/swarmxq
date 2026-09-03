/**
 * apps/swarmx-dashboard/src/lib/logger.ts
 * Browser-safe structured logger with zero standard logging* violations.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  level: LogLevel;
  message: string;
  context?: unknown;
  timestamp: string;
}

function emitLog(level: LogLevel, message: string, context?: unknown): void {
  if (typeof window !== "undefined") {
    const payload: LogPayload = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent("swarmx:log", { detail: payload }));
  }
}

export const log = {
  info: (msg: string, ctx?: unknown) => emitLog("info", msg, ctx),
  warn: (msg: string, ctx?: unknown) => emitLog("warn", msg, ctx),
  error: (msg: string | Error, ctx?: unknown) =>
    emitLog("error", msg instanceof Error ? msg.message : msg, ctx ?? (msg instanceof Error ? { stack: msg.stack } : undefined)),
  debug: (msg: string, ctx?: unknown) => emitLog("debug", msg, ctx),
};
