import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  // IMPORTANT: Use absolute path '/' for local development ('serve') and Vercel Web builds to prevent relative MIME-type crashes, but keep relative './' for PC/Electron/Capacitor packaging.
  base: command === "serve" || process.env.VERCEL === "1" ? "/" : "./", 
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));