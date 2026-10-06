import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: { alias: [{ find: /^\.\/supabase$/, replacement: path.resolve(__dirname, "fakeSupabase.ts") }] },
  server: { fs: { allow: [path.resolve(__dirname, "..")] } },
});
