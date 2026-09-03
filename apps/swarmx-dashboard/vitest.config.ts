import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@swarmx/types/operator-map", replacement: path.resolve(__dirname, "../../packages/swarmx-types/src/operator-map.ts") },
      { find: "@swarmx/types/operation-types", replacement: path.resolve(__dirname, "../../packages/swarmx-types/src/operation-types.ts") },
      { find: "@swarmx/types/video-types", replacement: path.resolve(__dirname, "../../packages/swarmx-types/src/video-types.ts") },
      { find: "@swarmx/types/series-types", replacement: path.resolve(__dirname, "../../packages/swarmx-types/src/series-types.ts") },
      { find: "@swarmx/types", replacement: path.resolve(__dirname, "../../packages/swarmx-types/src/index.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    globals: false,
  },
});
