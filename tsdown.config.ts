import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./index.ts"],
  format: ["esm", "cjs"],
  outDir: "dist",
  minify: true,
  dts: {
    cjsReexport: true,
    sourcemap: true,
  },
});
