# SwarmXQ Dashboard

Next.js operator console for SwarmXQ runtime telemetry, agent control, logs, and video generation.

## Local Development

From the repository root:

```bash
pnpm --filter @swarmx/dashboard dev
```

Dashboard: `http://localhost:3000`

## Environment Configuration

- **`SWARMX_API_URL`** (Server-side): Target Fastify API URL used by the Next.js API route proxy (`src/app/api/[...path]/route.ts`) and WebSocket rewrites (`next.config.ts`). Defaults to `http://127.0.0.1:3001`. In cloud deployments (e.g. Vercel), set this to your publicly hosted API URL.
- **`SWARMX_VIDEO_API_TOKEN`** (Server-side): Secret token injected into outbound write requests by the proxy handler. Never exposed to the browser.
- **`NEXT_PUBLIC_SWARMX_API_URL`** (Client-side, Optional): Direct API base override for client fetch calls. If omitted, the browser uses relative `/api/*` endpoints through Next.js proxying.

## Video Workspace

The `/video` route submits jobs to `/api/video/jobs`, listens to shared and
job-specific SSE updates, and renders queue state from `src/stores/video.ts`.

The form defaults to `Auto` model routing. Auto mode omits `modelTier` from the
request so the API can apply low-RAM video configuration such as
`SWARMX_VIDEO_LOW_RAM_MODE=1`. Explicit model overrides remain available for
hosts that have enough memory for the selected profile.

## Validation

Run the dashboard gates after UI or store changes:

```bash
pnpm --filter @swarmx/dashboard lint
pnpm --filter @swarmx/dashboard typecheck
pnpm --filter @swarmx/dashboard test
pnpm --filter @swarmx/dashboard build
```

For visual verification, restart the dashboard dev server and inspect
`/video` at desktop and narrow widths.
