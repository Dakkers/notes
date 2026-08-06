import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";

// Test-only config, deliberately separate from `.config/vite.config.ts`: the app
// build wires in the TanStack Start plugin, which the unit tests neither need nor
// can use. Here we keep just React Fast Refresh + path resolution.
export default defineConfig({
  // Vite 8 native `paths` resolution — provides the `#/*` alias from tsconfig.
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
