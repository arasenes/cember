import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "cember-api",
    main: "src/index.ts",
    compatibilityDate: "2024-10-01",
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
      TURNSTILE_SECRET: "0x4AAAAAAFpPMsHnHAxntRJHmEgckgWyOw0",
      R2_PUBLIC_URL: "https://pub-3c82f225f65443d584ddb3e5cfc68b45.r2.dev",
    },
  },
});
