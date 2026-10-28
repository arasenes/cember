export interface Env {
  CEMBER_MEDYA: any; // R2Bucket
  AI: any;
  ASSETS?: any; // Static Assets
  TURNSTILE_SECRET: string; // `wrangler secret put TURNSTILE_SECRET`
  R2_PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string; // publishable (istemci) anahtar
  CF_TURN_KEY_ID: string;
  CF_TURN_API_TOKEN: string; // `wrangler secret put CF_TURN_API_TOKEN`
}

const YUKLEME_MAX_BAYT = 25 * 1024 * 1024;
const SES_MAX_BAYT = 10 * 1024 * 1024;
const AI_MESAJ_MAX = 20;
const AI_METIN_MAX = 4000;

// SVG/HTML gibi betik taşıyabilen türler bilerek yok.
const IZINLI_TURLER: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/aac": "aac",
};

const IZINLI_ORIGINLER = new Set([
  "https://cember-api.bronzaras.workers.dev",
  "https://cember.space",
  "https://www.cember.space",
  "https://localhost", // Capacitor (androidScheme: https)
  "capacitor://localhost",
  "http://localhost:5173",
]);

function corsBasliklari(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);
  const izinli = origin === url.origin || IZINLI_ORIGINLER.has(origin);
  return {
    ...(izinli ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(request: Request, data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsBasliklari(request) },
  });
}

/** Supabase oturum anahtarını (misafir dahil) Supabase'e sorarak doğrular. */
async function oturumGecerliMi(request: Request, env: Env): Promise<boolean> {
  const auth = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return false;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_KEY, Authorization: auth },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function baytDizisi(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsBasliklari(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const workerOrigin = url.origin;

    try {
      // 1. Healthcheck
      if (path === "/api/ping") {
        return json(request, { ok: true, app: "cember-api", version: "1.1.0" });
      }

      // 2. Media Download Proxy (GET /api/media/:key)
      if (path.startsWith("/api/media/") && request.method === "GET") {
        const key = decodeURIComponent(path.replace("/api/media/", ""));
        const obj = await env.CEMBER_MEDYA.get(key);
        if (!obj) {
          return json(request, { error: "Medya bulunamadı" }, 404);
        }
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set("etag", obj.httpEtag);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Content-Disposition", "inline");
        headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
        headers.set("Cross-Origin-Resource-Policy", "cross-origin");
        return new Response(obj.body, { headers });
      }

      // 3. R2 Upload (PUT|POST /api/upload) — oturum + tür + boyut sınırı
      if (path === "/api/upload" && (request.method === "PUT" || request.method === "POST")) {
        if (!(await oturumGecerliMi(request, env))) {
          return json(request, { error: "Giriş gerekli." }, 401);
        }

        const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const uzanti = IZINLI_TURLER[contentType];
        if (!uzanti) {
          return json(request, { error: "Bu dosya türüne izin verilmiyor." }, 415);
        }

        const bildirilen = Number(request.headers.get("content-length") || 0);
        if (bildirilen > YUKLEME_MAX_BAYT) {
          return json(request, { error: "Dosya çok büyük (en fazla 25 MB)." }, 413);
        }

        const body = await request.arrayBuffer();
        if (!body || body.byteLength === 0) {
          return json(request, { error: "Boş dosya yüklenemez." }, 400);
        }
        if (body.byteLength > YUKLEME_MAX_BAYT) {
          return json(request, { error: "Dosya çok büyük (en fazla 25 MB)." }, 413);
        }

        const key = `${Date.now()}-${crypto.randomUUID()}.${uzanti}`;
        await env.CEMBER_MEDYA.put(key, body, { httpMetadata: { contentType } });

        const publicUrl = `${workerOrigin}/api/media/${key}`;
        return json(request, { ok: true, key, url: publicUrl, size: body.byteLength });
      }

      // 4. Workers AI: Whisper Speech-to-Text (POST /api/ai/whisper)
      if (path === "/api/ai/whisper" && request.method === "POST") {
        if (!(await oturumGecerliMi(request, env))) {
          return json(request, { error: "Giriş gerekli." }, 401);
        }

        let buf: ArrayBuffer | null = null;
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const bodyJson: any = await request.json();
          if (typeof bodyJson.url === "string") {
            let hedef: URL;
            try {
              hedef = new URL(bodyJson.url);
            } catch {
              return json(request, { error: "Geçersiz adres." }, 400);
            }
            if (hedef.origin === workerOrigin && hedef.pathname.startsWith("/api/media/")) {
              // Kendi medyamız: R2'den doğrudan oku (ağ isteği yok)
              const obj = await env.CEMBER_MEDYA.get(decodeURIComponent(hedef.pathname.replace("/api/media/", "")));
              if (!obj) return json(request, { error: "Medya bulunamadı" }, 404);
              buf = await obj.arrayBuffer();
            } else if (hedef.protocol === "https:" && hedef.hostname.endsWith(".supabase.co")) {
              // SSRF'e karşı: yalnızca Supabase depolama adresleri, yönlendirme yok
              const res = await fetch(hedef.toString(), { redirect: "error" });
              if (!res.ok) return json(request, { error: "Ses alınamadı." }, 400);
              buf = await res.arrayBuffer();
            } else {
              return json(request, { error: "Bu adrese izin verilmiyor." }, 400);
            }
          } else if (typeof bodyJson.audio === "string") {
            const binStr = atob(bodyJson.audio);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            buf = bytes.buffer;
          }
        } else {
          buf = await request.arrayBuffer();
        }

        if (!buf || buf.byteLength === 0) {
          return json(request, { error: "Ses verisi bulunamadı." }, 400);
        }
        if (buf.byteLength > SES_MAX_BAYT) {
          return json(request, { error: "Ses çok büyük (en fazla 10 MB)." }, 413);
        }

        const aiRes = await env.AI.run("@cf/openai/whisper", {
          audio: baytDizisi(new Uint8Array(buf)),
        });

        return json(request, { ok: true, text: aiRes?.text?.trim() || "" });
      }

      // 5. Workers AI: Chatbot & Özet (POST /api/ai/chat)
      if (path === "/api/ai/chat" && request.method === "POST") {
        if (!(await oturumGecerliMi(request, env))) {
          return json(request, { error: "Giriş gerekli." }, 401);
        }

        const body: any = await request.json();
        const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, AI_METIN_MAX) : "";

        // Sistem istemi sunucuda sabit; istemciden yalnızca user/assistant geçmişi alınır.
        const gecmis = Array.isArray(body.messages)
          ? body.messages
              .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
              .slice(-AI_MESAJ_MAX)
              .map((m: any) => ({ role: m.role, content: m.content.slice(0, AI_METIN_MAX) }))
          : [];

        const messages = [
          {
            role: "system",
            content:
              "Sen Çember uygulamasının samimi, yardımsever ve esprili yapay zeka asistanısın. Türkçe konuşuyorsun. Cevapların kısa, net, modern ve Discord/Çember topluluğuna uygun olsun. Markdown formatını kullanabilirsin.",
          },
          ...(gecmis.length > 0 ? gecmis : [{ role: "user", content: prompt || "Merhaba!" }]),
        ];

        const aiRes = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
          messages,
          max_tokens: 512,
        });

        const reply = aiRes?.response || aiRes?.choices?.[0]?.text || "";
        return json(request, { ok: true, reply: reply.trim() });
      }

      // 5b. TURN kimlik bilgileri (POST /api/turn): oturumlu kullanıcıya kısa ömürlü Cloudflare TURN bilgisi
      if (path === "/api/turn" && request.method === "POST") {
        if (!(await oturumGecerliMi(request, env))) {
          return json(request, { error: "Giriş gerekli." }, 401);
        }
        const stun = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
        if (!env.CF_TURN_KEY_ID || !env.CF_TURN_API_TOKEN) {
          return json(request, { iceServers: stun, turn: false, neden: "turn-yapilandirilmamis" });
        }
        const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CF_TURN_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ttl: 86400 }),
        });
        if (!res.ok) {
          console.error("TURN anahtarı reddedildi:", res.status);
          return json(request, { iceServers: stun, turn: false, neden: `cloudflare-${res.status}` });
        }
        const j: any = await res.json();
        return json(request, { iceServers: j.iceServers ?? stun, turn: Array.isArray(j.iceServers) && j.iceServers.length > 0 });
      }

      // 6. Cloudflare Turnstile Verification (POST /api/turnstile/verify)
      if (path === "/api/turnstile/verify" && request.method === "POST") {
        const body: any = await request.json();
        const token = body.token;
        const ip = request.headers.get("CF-Connecting-IP") || "";

        if (!token) {
          return json(request, { success: false, error: "Eksik token" }, 400);
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
        return json(request, { ok: outcome.success });
      }

      // 7. Supabase Katil Edge Function Proxy
      if (path === "/api/katil" && request.method === "POST") {
        const reqBody = await request.text();
        // Yalnızca Cloudflare'in doğruladığı istemci IP'si; x-forwarded-for taklit edilebilir.
        const clientIp = request.headers.get("CF-Connecting-IP") || "";
        const authHeader = request.headers.get("Authorization") || "";

        // Misafir girişi kapatıldı: yalnızca Google ile giriş yapan hesaplar katılabilir.
        let govde: any;
        try {
          govde = JSON.parse(reqBody);
        } catch {
          return json(request, { hata: "Geçersiz istek" }, 400);
        }
        if (govde && govde.misafir === true) {
          return json(request, { hata: "Misafir girişi kapatıldı. Google ile giriş yap." }, 403);
        }

        const supabaseHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_KEY,
          Origin: workerOrigin,
        };
        if (clientIp) supabaseHeaders["CF-Connecting-IP"] = clientIp;
        if (authHeader) supabaseHeaders["Authorization"] = authHeader;

        const res = await fetch(`${env.SUPABASE_URL}/functions/v1/katil`, {
          method: "POST",
          headers: supabaseHeaders,
          body: reqBody,
        });

        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: { "Content-Type": "application/json", ...corsBasliklari(request) },
        });
      }

      // 8. Statik Ön Yüz (Static Assets)
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return json(request, { error: "Bilinmeyen istek" }, 404);
    } catch (err: any) {
      console.error("worker hatası:", err?.message || err);
      return json(request, { error: "Sunucu hatası." }, 500);
    }
  },
};
