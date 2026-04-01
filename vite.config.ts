import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Single timestamp shared between __BUILD_VERSION__ (JS) and version.json (polling)
// This ensures they always match on the same build.
const BUILD_VERSION = Date.now().toString();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Only runs during `vite build` (production), NOT during dev server
    mode === "production" && {
      name: "generate-version-json",
      apply: "build" as const,
      buildStart() {
        const publicDir = path.resolve(__dirname, "public");
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(
          path.join(publicDir, "version.json"),
          JSON.stringify({ version: BUILD_VERSION }),
          "utf-8"
        );
        console.log(`[version] version.json → ${BUILD_VERSION}`);
      },
    },
  ].filter(Boolean),
  define: {
    // Same timestamp injected into the JS bundle
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "zustand", "next-themes", "recharts", "sonner", "react-router-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "recharts", "zustand", "zustand/middleware", "next-themes", "sonner", "react-router-dom"],
    force: true,
  },
}));
