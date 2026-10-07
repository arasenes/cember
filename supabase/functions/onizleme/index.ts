// Bağlantı önizleme (Open Graph). İstemci mesajı gönderince çağırır; mesajdaki ilk http(s) bağlantının
// başlık/açıklama/resmini okuyup mesajlar.onizleme'ye yazar. SSRF'ye karşı: özel/yerel adresler engellenir,
// yönlendirmeler tek tek doğrulanır, 3 sn zaman aşımı ve 512 KB sınırı vardır.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ipOzelMi, onizlemeCikar } from "./saf.ts";

const IZINLI_KAYNAKLAR = ["https://cember.onrender.com", "http://localhost:5173"];
const ZAMAN_ASIMI_MS = 3000;
const MAX_BAYT = 512 * 1024;
const MAX_YONLENDIRME = 3;

function corsHazirla(req: Request): Record<string, string> {
  const k = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": IZINLI_KAYNAKLAR.includes(k) ? k : IZINLI_KAYNAKLAR[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function adresGuvenliMi(host: string): Promise<boolean> {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":")) return !ipOzelMi(h);
  const adresler: string[] = [];
  for (const tur of ["A", "AAAA"] as const) {
    try { adresler.push(...(await Deno.resolveDns(h, tur))); } catch { /* o türde kayıt yok */ }
  }
  return adresler.length > 0 && adresler.every((a) => !ipOzelMi(a));
}

async function guvenliGetir(ilkUrl: string): Promise<{ url: string; html: string } | null> {
  let url = ilkUrl;
  for (let i = 0; i <= MAX_YONLENDIRME; i++) {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) return null;
    if (!(await adresGuvenliMi(u.hostname))) return null;
    const r = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
      headers: { "User-Agent": "CemberOnizleme/1.0 (+https://cember.onrender.com)", "Accept": "text/html,application/xhtml+xml" },
    });
    if (r.status >= 300 && r.status < 400) {
      const yer = r.headers.get("location");
      if (!yer) return null;
      url = new URL(yer, u).toString();
      continue;
    }
    if (!r.ok || !(r.headers.get("content-type") ?? "").toLowerCase().includes("html") || !r.body) return null;
    const okuyucu = r.body.getReader();
    const parcalar: Uint8Array[] = [];
    let toplam = 0;
    while (toplam < MAX_BAYT) {
      const { done, value } = await okuyucu.read();
      if (done || !value) break;
      parcalar.push(value);
      toplam += value.length;
    }
    try { await okuyucu.cancel(); } catch { /* yoksay */ }
    const tum = new Uint8Array(toplam);
    let konum = 0;
    for (const p of parcalar) { tum.set(p, konum); konum += p.length; }
    return { url, html: new TextDecoder("utf-8", { fatal: false }).decode(tum) };
  }
  return null;
}

Deno.serve(async (req) => {
  const CORS = corsHazirla(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  let mesajId = "";
  try { mesajId = String((await req.json()).mesaj_id ?? ""); } catch { return json({ hata: "Geçersiz istek" }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(mesajId)) return json({ hata: "Geçersiz mesaj" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  // Mesajı kullanıcının kendi yetkisiyle oku: RLS erişimi yoksa bulunamaz
  const kullanici = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: m } = await kullanici.from("mesajlar").select("id, metin, onizleme, silindi").eq("id", mesajId).maybeSingle();
  if (!m || m.silindi) return json({ hata: "Mesaj bulunamadı" }, 404);
  if (m.onizleme) return json({ ok: true, onizleme: m.onizleme });

  const bulunan = /https?:\/\/[^\s<]+/i.exec(String(m.metin ?? ""));
  if (!bulunan) return json({ ok: true, onizleme: null });
  const hedef = bulunan[0].replace(/[.,;:!?)\]'"]+$/, "");

  try {
    const sayfa = await guvenliGetir(hedef);
    const o = sayfa ? onizlemeCikar(sayfa.html, sayfa.url) : null;
    if (!o) return json({ ok: true, onizleme: null });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    await admin.from("mesajlar").update({ onizleme: o }).eq("id", mesajId);
    return json({ ok: true, onizleme: o });
  } catch {
    return json({ ok: true, onizleme: null });
  }
});
