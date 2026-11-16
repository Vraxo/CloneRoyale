import { defineConfig } from "vite";
export default defineConfig({ build: { ssr: "server/simulation.ts", outDir: "dist-server", emptyOutDir: true, rollupOptions: { output: { format: "es" } } } });
