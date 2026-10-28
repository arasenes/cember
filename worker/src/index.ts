export interface Env {
  CEMBER_MEDYA: any; // R2Bucket
  AI: any;
  ASSETS?: any; // Static Assets
  TURNSTILE_SECRET: string;
  R2_PUBLIC_URL: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const workerOrigin = url.origin;

    try {
      // 1. Healthcheck
      if (path === "/api/ping") {
        return json({ ok: true, app: "cember-api", version: "1.0.0" });
      }

      // 2. Media Download Proxy (GET /api/media/:key)
      if (path.startsWith("/api/media/") && request.method === "GET") {
        const key = decodeURIComponent(path.replace("/api/media/", ""));
        const obj = await env.CEMBER_MEDYA.get(key);
        if (!obj) {
          return json({ error: "Medya bulunamadı" }, 404);
        }
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set("etag", obj.httpEtag);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(obj.body, { headers });
      }

      // 3. R2 Upload (PUT /api/upload?name=filename.ext)
      if (path === "/api/upload" && (request.method === "PUT" || request.method === "POST")) {
        const queryName = url.searchParams.get("name");
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const uzanti = queryName?.split(".").pop() || "bin";
        const key = `${Date.now()}-${crypto.randomUUID()}.${uzanti}`;

        const body = await request.arrayBuffer();
        if (!body || body.byteLength === 0) {
          return json({ error: "Boş dosya yüklenemez." }, 400);
        }

        await env.CEMBER_MEDYA.put(key, body, {
          httpMetadata: { contentType },
        });

        const publicUrl = `${workerOrigin}/api/media/${key}`;
        return json({ ok: true, key, url: publicUrl, size: body.byteLength });
      }

      // 4. Workers AI: Whisper Speech-to-Text (POST /api/ai/whisper)
      if (path === "/api/ai/whisper" && request.method === "POST") {
        let audioBytes: number[] = [];

        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const bodyJson: any = await request.json();
          if (bodyJson.url) {
            const res = await fetch(bodyJson.url);
            const buf = await res.arrayBuffer();
            audioBytes = [...new Uint8Array(buf)];
          } else if (bodyJson.audio) {
            const binStr = atob(bodyJson.audio);
            const len = binStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
            audioBytes = [...bytes];
          }
        } else {
          const buf = await request.arrayBuffer();
          audioBytes = [...new Uint8Array(buf)];
        }

        if (audioBytes.length === 0) {
          return json({ error: "Ses verisi bulunamadı." }, 400);
        }

        const aiRes = await env.AI.run("@cf/openai/whisper", {
          audio: audioBytes,
        });

        return json({ ok: true, text: aiRes?.text?.trim() || "" });
      }

      // 5. Workers AI: Chatbot & Özet (POST /api/ai/chat)
      if (path === "/api/ai/chat" && request.method === "POST") {
        const body: any = await request.json();
        const prompt = body.prompt;
        const messages = body.messages || [
          { role: "system", content: "Sen Çember uygulamasının samimi, yardımsever ve esprili yapay zeka asistanısın. Türkçe konuşuyorsun. Cevapların kısa, net, modern ve Discord/Çember topluluğuna uygun olsun. Markdown formatını kullanabilirsin." },
          { role: "user", content: prompt || "Merhaba!" },
        ];

        const aiRes = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
          messages,
          max_tokens: 512,
        });

        const reply = aiRes?.response || aiRes?.choices?.[0]?.text || "";
        return json({ ok: true, reply: reply.trim() });
      }

      // 6. Cloudflare Turnstile Verification (POST /api/turnstile/verify)
      if (path === "/api/turnstile/verify" && request.method === "POST") {
        const body: any = await request.json();
        const token = body.token;
        const ip = request.headers.get("CF-Connecting-IP") || "";

        if (!token) {
          return json({ success: false, error: "Eksik token" }, 400);
        }

        const formData = new FormData();
        formData.append("secret", env.TURNSTILE_SECRET);
        formData.append("response", token);
        if (ip) formData.append("remoteip", ip);

        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          body: formData,
        });

        const outcome: any = await verifyRes.json();
        return json({ ok: outcome.success, details: outcome });
      }

      // 7. Supabase Katil Edge Function Proxy (CORS Bypass)
      if (path === "/api/katil" && request.method === "POST") {
        const reqBody = await request.text();
        const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";
        const authHeader = request.headers.get("Authorization") || request.headers.get("authorization") || "";

        const supabaseHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "apikey": "sb_publishable_UvoyTwS7YV7Mk80Ilymvug_-lrhZwRi",
          "Origin": "https://cember.onrender.com",
        };
        if (clientIp) supabaseHeaders["CF-Connecting-IP"] = clientIp;
        if (authHeader) supabaseHeaders["Authorization"] = authHeader;

        const res = await fetch("https://ehjslrbgazmakeucvquk.supabase.co/functions/v1/katil", {
          method: "POST",
          headers: supabaseHeaders,
          body: reqBody,
        });

        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        });
      }

      // 8. Statik Ön Yüz (Static Assets)
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return json({ error: "Bilinmeyen istek" }, 404);
    } catch (err: any) {
      return json({ error: err?.message || String(err) }, 500);
    }
  },
};
