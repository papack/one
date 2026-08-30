import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["./index.ts"],
    format: "esm",
    outDir: "dist",
    minify: true,
    dts: {
      sourcemap: true,
    },
  },
  {
    entry: ["./index.ts"],
    format: "cjs",
    outDir: "dist",
    minify: true,
  },
]);
