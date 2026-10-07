// GIF arama (Giphy ya da Tenor). Anahtar yalnızca Supabase sırlarında: GIPHY_API_KEY ya da TENOR_API_KEY.
// İstemci yalnızca oturumlu kullanıcıdır (verify_jwt açık).
const IZINLI_KAYNAKLAR = ["https://cember.onrender.com", "http://localhost:5173"];

function corsHazirla(req: Request): Record<string, string> {
  const k = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": IZINLI_KAYNAKLAR.includes(k) ? k : IZINLI_KAYNAKLAR[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

type Sonuc = { id: string; url: string; onizleme: string; genislik: number; yukseklik: number };

Deno.serve(async (req) => {
  const CORS = corsHazirla(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  let q = "";
  try { q = String((await req.json()).q ?? "").trim().slice(0, 60); } catch { return json({ hata: "Geçersiz istek" }, 400); }

  const giphy = Deno.env.get("GIPHY_API_KEY");
  const tenor = Deno.env.get("TENOR_API_KEY");
  if (!giphy && !tenor) return json({ hata: "GIF araması henüz kurulmadı.", kod: "kurulmadi" }, 503);

  try {
    if (giphy) {
      const yol = q ? "search" : "trending";
      const u = new URL(`https://api.giphy.com/v1/gifs/${yol}`);
      u.searchParams.set("api_key", giphy);
      u.searchParams.set("limit", "24");
      u.searchParams.set("rating", "pg-13");
      u.searchParams.set("lang", "tr");
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return json({ hata: "GIF servisi yanıt vermedi." }, 502);
      const j = await r.json();
      const sonuclar: Sonuc[] = (j.data ?? []).map((g: { id: string; images: Record<string, { url: string; width: string; height: string }> }) => ({
        id: g.id,
        url: g.images.downsized?.url ?? g.images.original.url,
        onizleme: g.images.fixed_width_small?.url ?? g.images.fixed_width.url,
        genislik: Number(g.images.fixed_width.width), yukseklik: Number(g.images.fixed_width.height),
      }));
      return json({ sonuclar });
    }
    const u = new URL(`https://tenor.googleapis.com/v2/${q ? "search" : "featured"}`);
    u.searchParams.set("key", tenor!);
    u.searchParams.set("client_key", "cember");
    u.searchParams.set("limit", "24");
    u.searchParams.set("contentfilter", "medium");
    u.searchParams.set("locale", "tr_TR");
    u.searchParams.set("media_filter", "gif,tinygif");
    if (q) u.searchParams.set("q", q);
    const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return json({ hata: "GIF servisi yanıt vermedi." }, 502);
    const j = await r.json();
    const sonuclar: Sonuc[] = (j.results ?? []).map((g: { id: string; media_formats: Record<string, { url: string; dims: number[] }> }) => ({
      id: g.id, url: g.media_formats.gif.url, onizleme: g.media_formats.tinygif?.url ?? g.media_formats.gif.url,
      genislik: g.media_formats.tinygif?.dims?.[0] ?? 200, yukseklik: g.media_formats.tinygif?.dims?.[1] ?? 200,
    }));
    return json({ sonuclar });
  } catch {
    return json({ hata: "GIF servisine ulaşılamadı." }, 502);
  }
});
