import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api to Spring Boot, so no CORS problems while developing.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8080" } },
});
