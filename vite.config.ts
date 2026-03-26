import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
    /* VitePWA({
      registerType: "autoUpdate",
      includeAssets: [], // Removed favicon.ico due to large size
      manifest: {
        name: "Sistema FVL",
        short_name: "FVL",
        description: "Sistema Logístico Favela Llog",
        theme_color: "#1e3a5f",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [], // Removed large icons
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2}"],
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/_lovable/,
          /^\/dev-server/,
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
      },
    }), */
  ].filter(Boolean),
  define: {
    __BUILD_VERSION__: JSON.stringify(Date.now().toString()),
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
