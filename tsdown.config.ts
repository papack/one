import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./index.ts",
    "./html/index.ts",
    "./style/index.ts",
    "./dom/index.ts",
    "./jsx/index.ts",
    "./layout/index.ts",
    "./runtime/index.ts",
  ],
  format: ["esm", "cjs"],
  outDir: "dist",
  minify: true,
  dts: {
    cjsReexport: true,
    sourcemap: true,
  },
});
