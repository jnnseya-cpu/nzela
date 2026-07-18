import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@nzela/ledger": resolve(__dirname, "shared/ledger/src/index.ts"),
      "@nzela/stackfood-client": resolve(
        __dirname,
        "shared/stackfood-client/src/index.ts",
      ),
      "@nzela/landmark-graph": resolve(
        __dirname,
        "shared/landmark-graph/src/index.ts",
      ),
    },
  },
  test: {
    include: ["shared/*/src/**/*.test.ts", "backend/*/src/**/*.test.ts"],
  },
});
