import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests spawn git/npm/python; 10s was flaky under parallel load (prepublishOnly).
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
