import type { NextConfig } from "next";

// [V5.9-FIX-07] Default to IPv4 loopback to avoid localhost IPv6 resolution
// mismatches when the API is bound on 127.0.0.1.
const API_URL = (process.env.SWARMX_API_URL?.trim() || "http://127.0.0.1:3001").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  // /api/* is handled by src/app/api/[...path]/route.ts so server-only
  // credentials can be injected for write routes without entering the browser.
  async rewrites() {
    return [
      {
        source: "/ws/:path*",
        destination: `${API_URL}/ws/:path*`,
      },
    ];
  },
  // xterm.js and @xterm/* are browser-only — mark as external for server
  serverExternalPackages: [],
  // Transpile workspace package
  transpilePackages: ["@swarmx/types"],
};

export default nextConfig;
