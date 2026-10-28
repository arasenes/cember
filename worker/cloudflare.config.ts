import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "cember-api",
    main: "src/index.ts",
    compatibilityDate: "2025-09-01",
    r2Buckets: [
      {
        binding: "CEMBER_MEDYA",
        bucketName: "cember-medya",
      },
    ],
    ai: {
      binding: "AI",
    },
    vars: {
      SUPABASE_URL: "https://ehjslrbgazmakeucvquk.supabase.co",
      SUPABASE_KEY: "sb_publishable_UvoyTwS7YV7Mk80Ilymvug_-lrhZwRi",
      R2_PUBLIC_URL: "https://pub-3c82f225f65443d584ddb3e5cfc68b45.r2.dev",
    },
  },
});
