import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        // Split heavy deps to keep initial chunks below warning thresholds.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@langchain/langgraph")) return "langgraph";
          if (id.includes("@langchain/core")) return "langchain-core";
          if (id.includes("langsmith")) return "langsmith";
          if (id.includes("zod-to-json-schema")) return "zod-json";
          if (id.includes("zod")) return "zod";
          if (id.includes("react-dom") || id.includes("react/")) return "react";
          if (id.includes("@heroui")) return "ui";
          if (id.includes("react-markdown") || id.includes("remark-gfm")) {
            return "markdown";
          }
          if (id.includes("@tauri-apps")) return "tauri";
          return undefined;
        },
      },
    },
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1430,
    strictPort: true,
    host: host || "0.0.0.0",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
