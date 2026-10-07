// Gelen webhook: dış servislerin (GitHub, takvim, kendi betiğin…) bir kanala mesaj göndermesi.
// İstek: POST { "id": "<webhook kimliği>", "sifre": "<32 karakterlik şifre>", "icerik": "mesaj metni" }
// Webhook ve şifre, Sunucu ayarları > Webhook ve botlar bölümünde oluşturulur; şifre yalnızca bir kez gösterilir (veritabanında özeti saklanır).
// JWT doğrulaması kapalıdır (çağıran oturumsuz bir servis); kimlik doğrulaması şifre ile yapılır.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f-]{36}$/i;
const DAKIKADA_EN_FAZLA = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function ozet(metin: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(metin));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// Zamanlamadan sızıntı olmasın diye sabit sürede karşılaştırır
function esitMi(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  let g: { id?: string; sifre?: string; icerik?: string };
  try { g = await req.json(); } catch { return json({ hata: "Geçersiz JSON" }, 400); }
  const id = String(g.id ?? "");
  const sifre = String(g.sifre ?? "");
  const icerik = String(g.icerik ?? "").trim();
  if (!UUID.test(id) || !/^[0-9a-f]{32}$/i.test(sifre)) return json({ hata: "Webhook bulunamadı" }, 404);
  if (!icerik || icerik.length > 2000) return json({ hata: "icerik 1-2000 karakter olmalı" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: w } = await admin.from("webhooklar").select("id, kanal_id, bot_uye, sifre_hash").eq("id", id).maybeSingle();
  // Var olmayan webhook ile yanlış şifre aynı yanıtı verir (varlık sızdırılmaz)
  if (!w || !esitMi(w.sifre_hash, await ozet(sifre.toLowerCase()))) return json({ hata: "Webhook bulunamadı" }, 404);

  const bir = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("mesajlar").select("id", { count: "exact", head: true }).eq("uye_id", w.bot_uye).gte("olusturma", bir);
  if ((count ?? 0) >= DAKIKADA_EN_FAZLA) return json({ hata: "Çok fazla istek (dakikada en fazla 30)" }, 429);

  const { error } = await admin.from("mesajlar").insert({ kanal_id: w.kanal_id, uye_id: w.bot_uye, metin: icerik });
  if (error) return json({ hata: /yasaklı/i.test(error.message) ? "Mesajda sunucuda yasaklı bir kelime var" : "Mesaj gönderilemedi" }, 400);
  return json({ ok: true });
});
