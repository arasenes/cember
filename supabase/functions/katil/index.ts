import { createClient } from "npm:@supabase/supabase-js@2";

// Yalnızca kendi sitemizden gelen tarayıcı isteklerine izin ver (Android uygulaması da bu siteyi açar)
const IZINLI_KAYNAKLAR = ["https://cember.pages.dev", "https://cember-api.bronzaras.workers.dev", "https://cember.space", "https://www.cember.space", "https://cember.onrender.com", "http://localhost:5173"];
function corsHazirla(req: Request): Record<string, string> {
  const k = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": IZINLI_KAYNAKLAR.includes(k) ? k : IZINLI_KAYNAKLAR[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
const RENKLER = ["#E8A33D", "#1F7A4D", "#0B7A91", "#B3261E", "#6B4FA0", "#C2548A", "#3C6FB5", "#8A6D3B", "#2E8B8B", "#7A8B2E", "#B5563C", "#4F5BA0"];
const MAX_UYE = 50;
const YONETICI_EPOSTA = "bronzaras@gmail.com";
const DENEME_LIMIT = 10; // 10 dakikada IP başına en fazla 10 yanlış deneme

// Misafiri siler: mesajları kalır (ad gizlenir), hesabı ve kişisel kayıtları silinir
// deno-lint-ignore no-explicit-any
async function misafirSil(admin: any, uye: { id: string; user_id: string | null }) {
  await admin.from("uyeler").update({ silindi: true, takma_ad: "silindi-" + uye.id.slice(0, 8), avatar_yol: null, hakkinda: null, renk: "#6B7280" }).eq("id", uye.id);
  await admin.from("uye_ip").delete().eq("uye_id", uye.id);
  await admin.from("kanal_acik").delete().eq("uye_id", uye.id);
  await admin.from("ses_oturumlari").delete().eq("uye_id", uye.id);
  await admin.from("kanal_okuma").delete().eq("uye_id", uye.id);
  await admin.from("dm_uyeleri").delete().eq("uye_id", uye.id);
  await admin.from("arkadasliklar").delete().or(`a.eq.${uye.id},b.eq.${uye.id}`);
  if (uye.user_id) await admin.auth.admin.deleteUser(uye.user_id);
}

// İstemci IP'si. cf-connecting-ip'yi Cloudflare koyar, istemci değiştiremez. x-forwarded-for'un SOLDAKİ adresleri istemci
// tarafından uydurulabilir; yalnızca yedek olarak ve en SAĞDaki (en yakın güvenilir vekilin eklediği) adres alınır.
// Geçerli bir adres bulunamazsa "bilinmiyor" döner; bu paylaşılan tek kova olarak sınırlanır (kontrolsüz bırakılmaz).
function istemciIp(req: Request): string {
  const gecerli = (v: string | null | undefined) => (v && /^[0-9a-fA-F:.]{3,45}$/.test(v.trim()) ? v.trim() : null);
  const cf = gecerli(req.headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return gecerli(xff[xff.length - 1]) ?? "bilinmiyor";
}

Deno.serve(async (req) => {
  const CORS = corsHazirla(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  let govde: { takma_ad?: string; google?: boolean; misafir?: boolean; misafir_sil?: boolean };
  try { govde = await req.json(); } catch { return json({ hata: "Geçersiz istek" }, 400); }
  // Misafir girişi kapatıldı (misafir_sil ile mevcut misafirler hâlâ çıkış yapabilir)
  if (govde.misafir) return json({ hata: "Misafir girişi kapatıldı. Google ile giriş yap." }, 403);
  const takmaAd = String(govde.takma_ad ?? "").trim().replace(/\s+/g, " ");
  if (!govde.misafir_sil && (takmaAd.length < 2 || takmaAd.length > 24)) return json({ hata: "Takma ad 2-24 karakter olmalı." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = istemciIp(req);

  // Basit deneme sınırı
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("giris_denemeleri").select("id", { count: "exact", head: true }).eq("ip", ip).gte("zaman", since);
  if ((count ?? 0) >= DENEME_LIMIT) return json({ hata: "Çok fazla yanlış deneme. Birkaç dakika sonra tekrar dene." }, 429);

  // Misafir çıkışı: hesabı ve kişisel kayıtları sil, mesajlar "Silinmiş üye" olarak kalır
  if (govde.misafir_sil) {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: ku } = jwt ? await admin.auth.getUser(jwt) : { data: null };
    if (!ku?.user) return json({ hata: "Oturum bulunamadı." }, 401);
    const { data: m } = await admin.from("uyeler").select("id, user_id").eq("user_id", ku.user.id).eq("misafir", true).eq("silindi", false).maybeSingle();
    if (!m) return json({ hata: "Misafir hesabı bulunamadı." }, 404);
    await misafirSil(admin, m);
    return json({ ok: true });
  }

  // Google ile kayıt: oturum Google kimliğiyle açılmıştır, burada yalnızca odaya üye kaydı yapılır
  if (govde.google) {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: ku, error: kuErr } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: new Error("yok") };
    if (kuErr || !ku?.user || !(ku.user.identities ?? []).some((i) => i.provider === "google")) return json({ hata: "Google oturumu doğrulanamadı." }, 401);
    const { data: oda } = await admin.from("odalar").select("id, ad").order("olusturma").limit(1).maybeSingle();
    if (!oda) return json({ hata: "Oda bulunamadı." }, 500);
    const { data: mevcut } = await admin.from("uyeler").select("id, rol").eq("oda_id", oda.id).eq("user_id", ku.user.id).maybeSingle();
    if (mevcut) return json({ ok: true, rol: mevcut.rol, oda_adi: oda.ad });

    const esc = (v: string) => v.replace(/[%_\\]/g, (m) => "\\" + m);
    const { data: adYasagi } = await admin.from("yasaklar").select("id").eq("oda_id", oda.id).ilike("takma_ad", esc(takmaAd)).maybeSingle();
    const { data: ipYasagi } = ip === "bilinmiyor" ? { data: null } : await admin.from("yasaklar").select("id").eq("oda_id", oda.id).eq("ip", ip).maybeSingle();
    if (adYasagi || ipYasagi) return json({ hata: "Bu odaya girişin engellendi." }, 403);

    // Herkese açık kayıt: aynı IP'den art arda kayıt denemelerini sınırla
    // Sayma ve kaydetme tek işlemde (039): paralel isteklerle limit aşılamaz
    const { data: izinli, error: dErr } = await admin.rpc("deneme_kaydet", { p_ip: ip, p_limit: DENEME_LIMIT * 2 });
    if (dErr) { console.error("deneme_kaydet hatası", dErr.message); return json({ hata: "Şu an kayıt yapılamıyor, biraz sonra tekrar dene." }, 503); }
    if (izinli === false) return json({ hata: "Çok fazla deneme. Birkaç dakika sonra tekrar dene." }, 429);

    const { count: uyeSayisi } = await admin.from("uyeler").select("id", { count: "exact", head: true }).eq("oda_id", oda.id).eq("silindi", false);
    if ((uyeSayisi ?? 0) >= MAX_UYE) return json({ hata: "Oda dolu." }, 409);
    const { data: ayniAd } = await admin.from("uyeler").select("id").eq("oda_id", oda.id).ilike("takma_ad", esc(takmaAd)).maybeSingle();
    if (ayniAd) return json({ hata: "Bu takma ad odada kullanılıyor, başka bir tane seç." }, 409);
    // Yönetici: yalnızca doğrulanmış Google e-postası YONETICI_EPOSTA olan hesap
    const rol = ku.user.email?.toLowerCase() === YONETICI_EPOSTA && !!ku.user.email_confirmed_at ? "sahip" : "uye";
    const renk = RENKLER[(uyeSayisi ?? 0) % RENKLER.length];
    const { data: yeniUye, error: uErr } = await admin.from("uyeler").insert({ oda_id: oda.id, user_id: ku.user.id, takma_ad: takmaAd, renk, rol }).select("id").single();
    if (uErr) {
      const ad = uErr.code === "23505";
      return json({ hata: ad ? "Bu takma ad odada kullanılıyor, başka bir tane seç." : "Odaya katılınamadı." }, ad ? 409 : 500);
    }
    if (yeniUye && ip !== "bilinmiyor") await admin.from("uye_ip").insert({ uye_id: yeniUye.id, ip });
    return json({ ok: true, rol, oda_adi: oda.ad });
  }

  return json({ hata: "Geçersiz istek. Google ile gir." }, 400);
});
