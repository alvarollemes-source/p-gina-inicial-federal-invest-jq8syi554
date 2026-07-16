import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/boletos/validate.ts",
        "src/lib/boletos/normalize.ts",
        "src/lib/boletos/format.ts",
        "src/lib/ofx/convert.ts",
        "src/lib/rbac/roles.ts",
      ],
      reporter: ["text", "html"],
    },
  },
});