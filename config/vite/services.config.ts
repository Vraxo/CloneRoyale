import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "server/services.ts",
    outDir: "dist-server",
    emptyOutDir: false,
    rollupOptions: {
      output: { format: "es" }
    }
  }
});
