import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@nzela/ledger": resolve(__dirname, "packages/ledger/src/index.ts"),
      "@nzela/stackfood-client": resolve(
        __dirname,
        "packages/stackfood-client/src/index.ts",
      ),
      "@nzela/landmark-graph": resolve(
        __dirname,
        "packages/landmark-graph/src/index.ts",
      ),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
  },
});
