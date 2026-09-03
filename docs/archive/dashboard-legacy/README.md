# SwarmX Dashboard Premium Upgrade

> **⚠ DEPRECATED — Phase 4 Legacy Dashboard Retirement**
>
> This archived directory (`docs/archive/dashboard-legacy/`) is the legacy static front-end dashboard and will be
> **removed in the Phase 4 release**. It is retained for reference and backward-compatibility
> validation only.
>
> **Canonical dashboard:** `apps/swarmx-dashboard/` (Next.js 16 + React 19 + Radix UI)
> ```
> pnpm --filter @swarmx/dashboard dev
> ```

---

This package contains the legacy front-end dashboard for the SwarmX / SCAR Cognitive OS control plane.

## Included files

- `index.html`
- `styles.css`
- `app.js`

The dashboard remains backward compatible with the existing backend contract:

- `GET /api/overview`
- `POST /api/plan`
- `POST /api/run`
- `POST /api/evolve`

## What this upgrade adds

- a more premium command-center visual system
- a live operational intelligence panel
- richer KPI surfacing for automation, intelligence, creativity, and performance
- better tab ergonomics and more responsive layouts
- keyboard shortcuts for fast control
- smarter fallback rendering for evolution / PromptBreeder data
- lighter refresh behavior when the runtime state has not meaningfully changed
- local preference persistence for repository path and control toggles
- stronger error handling for failed API responses

## Setup

1. Copy the `dashboard/` folder into the SwarmX project.
2. Keep the files beside the backend server that already serves the dashboard routes.
3. Make sure the API endpoints above are reachable from the same origin.
4. Open the dashboard through your existing SwarmX server.
5. Enter a repository path, then use Plan, Run, or Evolve.

## Keyboard shortcuts

- `R` refreshes the dashboard
- `P` builds a plan
- `E` generates evolution proposals
- `Ctrl` + `Enter` starts a run

## Notes

- The UI is upgraded only; the workflow contract is preserved.
- No payload shapes were changed.
- The dashboard gracefully falls back when optional runtime fields are absent.
- The mission console, KPI strip, and PromptBreeder pool are rendered entirely on the client side from the live overview payload.
- Repository path and control toggles are stored locally in the browser so the dashboard feels more continuous across sessions.

## Quick local check

If you want to preview the HTML/CSS/JS bundle locally, you can serve the `dashboard/` folder with any static server. For example:

```bash
python -m http.server 8000
```

Then open the dashboard through the SwarmX server or a proxy that can reach the API routes above.
