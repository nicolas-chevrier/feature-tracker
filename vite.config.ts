import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build = un unique dist/index.html (JS + CSS inlinés), publiable tel quel
// sur GitHub Pages ou ouvert directement depuis le disque.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
