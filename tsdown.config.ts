import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./index.ts",
    "./constants/index.ts",
    "./html/index.ts",
    "./style/index.ts",
    "./schema/index.ts",
    "./dom/index.ts",
    "./jsx/index.ts",
    "./layout/index.ts",
    "./runtime/index.ts",
    "./smtp/index.ts",
    "./bus/index.ts",
    "./cron/index.ts",
    "./log/index.ts",
    "./cache/index.ts",
  ],
  format: ["esm", "cjs"],
  outDir: "dist",
  minify: true,
  dts: {
    cjsReexport: true,
    sourcemap: true,
  },
});
