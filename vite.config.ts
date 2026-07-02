import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/", // ← 添加这行
  build: {
    target: "safari11", // 兼容 Safari 11+
    // 或 target: "es2015"  // 兼容 Safari 9+
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
});
