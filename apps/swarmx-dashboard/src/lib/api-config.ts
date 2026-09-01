/**
 * apps/swarmx-dashboard/src/lib/api-config.ts
 *
 * Centralized API URL resolution for SwarmX Dashboard.
 *
 * Architecture:
 * - Server-side (Node.js runtime / Next.js API route proxy / next.config.ts):
 *   Uses `SWARMX_API_URL`, defaulting to `http://127.0.0.1:3001`.
 *   This is where server-only tokens (e.g. `SWARMX_VIDEO_API_TOKEN`) are injected
 *   before proxying requests to the backend Fastify API.
 *
 * - Client-side (Browser / React components / hooks):
 *   Defaults to an empty base (`""`), meaning requests are relative to the current origin
 *   and route through `/api/*` (Next.js server proxy). This ensures browser requests work
 *   seamlessly across localhost, remote tunnels, and cloud deployments (e.g. Vercel).
 *   If `NEXT_PUBLIC_SWARMX_API_URL` is explicitly provided, client components use that
 *   direct URL instead.
 */

export const DEFAULT_API_URL = "http://127.0.0.1:3001";

/**
 * Resolves the API base URL for client-side (browser) fetch calls.
 * Returns `NEXT_PUBLIC_SWARMX_API_URL` (without trailing slashes) if configured,
 * or empty string `""` so requests route through the Next.js API proxy `/api/*`.
 */
export function resolveClientApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SWARMX_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "";
}

/**
 * Resolves the target backend API base URL for server-side proxying and rewrites.
 * Returns `SWARMX_API_URL` (without trailing slashes) if configured,
 * or falls back to `http://127.0.0.1:3001`.
 */
export function resolveServerApiUrl(): string {
  const configured = process.env.SWARMX_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return DEFAULT_API_URL;
}
