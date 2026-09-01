import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure logic — money, GST, query building.
 *
 * Nothing here touches a database or a browser. That is the point: tax splits,
 * rounding and amount-in-words have exactly one right answer, they are the
 * cheapest thing in this codebase to test and the most expensive to get wrong,
 * and a test that needs a cluster to run is a test nobody runs.
 *
 * Anything that genuinely needs Atlas lives in scripts/check-*.ts instead, run
 * by hand against a real connection.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
