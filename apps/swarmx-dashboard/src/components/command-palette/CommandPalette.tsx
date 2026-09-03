"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import { useEventsStore } from "@/stores/events";
import type { AgentState } from "@swarmx/types";

// ── Static command definitions ────────────────────────────────────────────────

const NAVIGATION_COMMANDS = [
  { id: "nav-overview",   label: "Go to Overview",     shortcut: "⌘1", href: "/",          keywords: "home dashboard" },
  { id: "nav-composer",   label: "Go to Composer",     shortcut: "⌘2", href: "/composer",  keywords: "create build prompt project" },
  { id: "nav-video-studio", label: "Open Video Studio", shortcut: "⌘V", href: "/video/studio", keywords: "viral video reels tiktok shorts create" },
  { id: "nav-agents",     label: "Go to Agent Fleet",  shortcut: "⌘3", href: "/agents",    keywords: "bots workers" },
  { id: "nav-workflows",  label: "Go to Workflows",    shortcut: "⌘4", href: "/workflows", keywords: "dag yaml" },
  { id: "nav-logs",       label: "Go to Logs",         shortcut: "⌘5", href: "/logs",      keywords: "journald syslog events" },
  { id: "nav-system",     label: "Go to System",       shortcut: "⌘6", href: "/system",    keywords: "cgroup linux kernel" },
  { id: "nav-settings",   label: "Go to Settings",     href: "/settings", keywords: "config preferences" },
] as const;

const TERMINAL_COMMANDS = [
  { id: "term-toggle",    label: "Toggle Terminal",    shortcut: "⌘`",  action: "toggleTerminal" as const },
  { id: "term-new-tab",   label: "New Terminal Tab",   shortcut: "⌘T",  action: "addTerminalTab" as const },
  { id: "term-fullscreen",label: "Fullscreen Terminal",shortcut: "⌘⇧`", action: "toggleTerminalFullscreen" as const },
] as const;

const UI_COMMANDS = [
  { id: "ui-nav",      label: "Toggle Sidebar",      shortcut: "⌘B",  action: "toggleNav" as const },
  { id: "ui-telemetry",label: "Toggle Telemetry Rail",shortcut: "⌘⇧T", action: "toggleTelemetryRail" as const },
  { id: "ui-disclosure",label: "Toggle Operator View",shortcut: "⌘⇧O", action: "toggleOperatorViewMode" as const },
] as const;

// ── Command Palette ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);
  const toggleTerminalFullscreen = useUIStore((s) => s.toggleTerminalFullscreen);
  const addTerminalTab = useUIStore((s) => s.addTerminalTab);
  const toggleNav = useUIStore((s) => s.toggleNav);
  const toggleTelemetryRail = useUIStore((s) => s.toggleTelemetryRail);
  const toggleOperatorViewMode = useUIStore((s) => s.toggleOperatorViewMode);

  const agentsMap = useEventsStore((s) => s.agents);
  const agents = React.useMemo(() => [...agentsMap.values()], [agentsMap]);
  const router = useRouter();

  const runTerminalAction = useCallback(
    (action: "toggleTerminal" | "addTerminalTab" | "toggleTerminalFullscreen") => {
      closeCommandPalette();
      if (action === "toggleTerminal") toggleTerminal();
      else if (action === "addTerminalTab") { toggleTerminal(); addTerminalTab(); }
      else toggleTerminalFullscreen();
    },
    [closeCommandPalette, toggleTerminal, addTerminalTab, toggleTerminalFullscreen]
  );

  const runUIAction = useCallback(
    (action: "toggleNav" | "toggleTelemetryRail" | "toggleOperatorViewMode") => {
      closeCommandPalette();
      if (action === "toggleNav") toggleNav();
      else if (action === "toggleTelemetryRail") toggleTelemetryRail();
      else toggleOperatorViewMode();
    },
    [closeCommandPalette, toggleNav, toggleTelemetryRail, toggleOperatorViewMode]
  );

  const navigate = useCallback(
    (href: string) => {
      closeCommandPalette();
      router.push(href);
    },
    [closeCommandPalette, router]
  );

  const focusAgent = useCallback(
    (agentId: string) => {
      closeCommandPalette();
      router.push(`/agents?focus=${encodeURIComponent(agentId)}`);
    },
    [closeCommandPalette, router]
  );

  if (!isOpen) return null;

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Command palette"
      className="swarm-command-palette fixed inset-0 z-100 flex items-start justify-center bg-transparent pt-[20vh]"
      onCancel={(event) => {
        event.preventDefault();
        closeCommandPalette();
      }}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close command palette"
        onClick={closeCommandPalette}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full max-w-lg mx-4 rounded-lg overflow-hidden",
          "bg-bg-elevated border border-border-active",
          "shadow-[0_0_40px_rgba(0,255,136,0.08),0_24px_48px_rgba(0,0,0,0.6)]",
          "animate-in fade-in-0 zoom-in-95 duration-(--duration-reveal)"
        )}
      >
        <CommandPaletteInner
          agents={agents}
          onNavigate={navigate}
          onTerminalAction={runTerminalAction}
          onUIAction={runUIAction}
          onFocusAgent={focusAgent}
          onClose={closeCommandPalette}
        />
      </div>
    </dialog>
  );
}

// ── Inner content (avoids SSR issues with cmdk) ───────────────────────────────

import { Command } from "cmdk";

interface InnerProps {
  readonly agents: AgentState[];
  readonly onNavigate: (href: string) => void;
  readonly onTerminalAction: (a: "toggleTerminal" | "addTerminalTab" | "toggleTerminalFullscreen") => void;
  readonly onUIAction: (a: "toggleNav" | "toggleTelemetryRail" | "toggleOperatorViewMode") => void;
  readonly onFocusAgent: (id: string) => void;
  readonly onClose: () => void;
}

function CommandPaletteInner({
  agents,
  onNavigate,
  onTerminalAction,
  onUIAction,
  onFocusAgent,
  onClose,
}: InnerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input after animation frame
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose]);

  const runningAgents = agents.filter((a) => a.status === "running");
  const errorAgents = agents.filter((a) => a.status === "error" || a.status === "fatal");

  return (
    <Command
      className="bg-transparent"
      shouldFilter={true}
      loop
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <kbd className="text-[10px] font-mono text-text-muted">⌘K</kbd>
        <Command.Input
          ref={inputRef}
          placeholder="Type a command or search..."
          aria-label="Search commands"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            "flex-1 bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted",
            "outline-none border-none"
          )}
        />
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary text-[10px] font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-1"
          aria-label="Close"
        >
          ESC
        </button>
      </div>

      <Command.List className="max-h-100 overflow-y-auto p-1">
        <Command.Empty className="text-center text-xs font-mono text-text-muted py-8">
          No matches — but the swarm is always listening.
        </Command.Empty>

        {/* Navigation */}
        <Command.Group heading="Navigate">
          {NAVIGATION_COMMANDS.map((cmd) => (
            <Command.Item
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords}`}
              onSelect={() => onNavigate(cmd.href)}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded text-xs font-mono",
                "text-text-secondary cursor-pointer",
                "data-[selected=true]:bg-(--color-accent-dim) data-[selected=true]:text-accent",
                "transition-colors duration-(--duration-micro)"
              )}
            >
              <span>{cmd.label}</span>
              {"shortcut" in cmd && cmd.shortcut && (
                <kbd className="text-[10px] text-text-muted">{cmd.shortcut}</kbd>
              )}
            </Command.Item>
          ))}
        </Command.Group>

        {/* Terminal */}
        <Command.Group heading="Terminal">
          {TERMINAL_COMMANDS.map((cmd) => (
            <Command.Item
              key={cmd.id}
              value={cmd.label}
              onSelect={() => onTerminalAction(cmd.action)}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded text-xs font-mono",
                "text-text-secondary cursor-pointer",
                "data-[selected=true]:bg-(--color-accent-dim) data-[selected=true]:text-accent",
                "transition-colors duration-(--duration-micro)"
              )}
            >
              <span>{cmd.label}</span>
              <kbd className="text-[10px] text-text-muted">{cmd.shortcut}</kbd>
            </Command.Item>
          ))}
        </Command.Group>

        {/* UI */}
        <Command.Group heading="Interface">
          {UI_COMMANDS.map((cmd) => (
            <Command.Item
              key={cmd.id}
              value={cmd.label}
              onSelect={() => onUIAction(cmd.action)}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded text-xs font-mono",
                "text-text-secondary cursor-pointer",
                "data-[selected=true]:bg-(--color-accent-dim) data-[selected=true]:text-accent",
                "transition-colors duration-(--duration-micro)"
              )}
            >
              <span>{cmd.label}</span>
              <kbd className="text-[10px] text-text-muted">{cmd.shortcut}</kbd>
            </Command.Item>
          ))}
        </Command.Group>

        {/* Error agents — quick triage */}
        {errorAgents.length > 0 && (
          <Command.Group heading="⚠ Agent Errors">
            {errorAgents.slice(0, 5).map((agent) => (
              <Command.Item
                key={agent.id}
                value={`${agent.id} ${agent.name} error`}
                onSelect={() => onFocusAgent(agent.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded text-xs font-mono",
                  "text-status-error cursor-pointer",
                  "data-[selected=true]:bg-[rgba(239,68,68,0.08)]",
                  "transition-colors duration-(--duration-micro)"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="status-dot" data-status="error" />
                  {agent.name ?? agent.id}
                </span>
                <span className="text-text-muted text-[10px] truncate max-w-40">
                  {agent.lastError ?? agent.status}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Running agents */}
        {runningAgents.length > 0 && (
          <Command.Group heading="Running Agents">
            {runningAgents.slice(0, 8).map((agent) => (
              <Command.Item
                key={agent.id}
                value={`${agent.id} ${agent.name} running agent`}
                onSelect={() => onFocusAgent(agent.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded text-xs font-mono",
                  "text-text-secondary cursor-pointer",
                  "data-[selected=true]:bg-(--color-accent-dim) data-[selected=true]:text-accent",
                  "transition-colors duration-(--duration-micro)"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="status-dot" data-status="active" />
                  {agent.name ?? agent.id}
                </span>
                <span className="text-text-muted text-[10px]">{agent.role}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command>
  );
}
