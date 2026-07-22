import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests cover the pure logic in src/lib (catch formulas, effectiveness,
// learnsets, ranking, settings parsing). The `@` alias mirrors tsconfig so the
// modules import exactly as they do in the app; type-only imports of data.ts
// are erased, so no filesystem/DB access is pulled in.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
