/**
 * Cloudflare Edge Entegrasyonu (Workers, R2, Workers AI, Turnstile)
 * Edge Worker: https://cember-api.bronzaras.workers.dev
 */

export const CLOUDFLARE_API_URL = "https://cember-api.bronzaras.workers.dev";
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFpPMpeTelOCEQtr";

/**
 * Dosyayı Cloudflare R2 Bucket'ına yükler.
 * Başarılı olursa kalıcı CDN URL'sini döner.
 */
export async function cloudflareYukle(
  blob: Blob,
  dosyaAdi = "dosya.bin"
): Promise<{ url: string; key: string; size: number } | null> {
  try {
    const enc = encodeURIComponent(dosyaAdi);
    const res = await fetch(`${CLOUDFLARE_API_URL}/api/upload?name=${enc}`, {
      method: "PUT",
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
      },
      body: blob,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.url) {
      return { url: json.url, key: json.key, size: json.size };
    }
    return null;
  } catch (e) {
    console.warn("Cloudflare R2 yükleme hatası:", e);
    return null;
  }
}

/**
 * Cloudflare Workers AI Whisper modeliyle ses kaydını metne döker.
 */
export async function cloudflareWhisper(ses: Blob | string): Promise<string | null> {
  try {
    let res: Response;
    if (typeof ses === "string") {
      res = await fetch(`${CLOUDFLARE_API_URL}/api/ai/whisper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ses }),
      });
    } else {
      res = await fetch(`${CLOUDFLARE_API_URL}/api/ai/whisper`, {
        method: "POST",
        headers: { "Content-Type": ses.type || "audio/webm" },
        body: ses,
      });
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.text || null;
  } catch (e) {
    console.warn("Cloudflare Whisper hatası:", e);
    return null;
  }
}

/**
 * Cloudflare Workers AI Llama modeli ile akıllı sohbet veya özet üretir.
 */
export async function cloudflareAiSohbet(
  prompt: string,
  gecmis?: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string | null> {
  try {
    const messages = gecmis && gecmis.length > 0 ? gecmis : [
      {
        role: "system",
        content:
          "Sen Çember uygulamasının resmi akıllı asistanısın (@CemberAI). Discord/Çember topluluğuna uygun, samimi, esprili ve yardımsever Türkçe yanıtlar ver. Yanıtların çok uzun olmasın, öz ve net olsun.",
      },
      { role: "user", content: prompt },
    ];

    const res = await fetch(`${CLOUDFLARE_API_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, messages }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json?.reply || null;
  } catch (e) {
    console.warn("Cloudflare AI sohbet hatası:", e);
    return null;
  }
}

/**
 * Cloudflare Turnstile tokenını doğrular.
 */
export async function cloudflareTurnstileDogrula(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${CLOUDFLARE_API_URL}/api/turnstile/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.ok);
  } catch {
    return false;
  }
}
