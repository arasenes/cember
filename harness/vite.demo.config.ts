import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: { alias: [{ find: /^\.{1,2}\/supabase$/, replacement: path.resolve(__dirname, "demoSupabase.ts") }] },
  server: { port: 5199, strictPort: true, fs: { allow: [path.resolve(__dirname, "..")] } },
});
