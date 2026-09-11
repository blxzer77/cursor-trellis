import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests spawn git/npm/python and exercise real Windows temp
    // projects; cold starts and recursive cleanup can exceed 30s on hosted
    // runners, especially when a case performs two init/update passes.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
    include: ["test/**/*.test.ts"],
    exclude: ["third/**", "node_modules/**"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
      reportsDirectory: "./coverage",
    },
  },
});
