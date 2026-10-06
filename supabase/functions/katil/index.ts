import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const RENKLER = ["#E8A33D", "#1F7A4D", "#0B7A91", "#B3261E", "#6B4FA0", "#C2548A", "#3C6FB5", "#8A6D3B", "#2E8B8B", "#7A8B2E", "#B5563C", "#4F5BA0"];
const MAX_UYE = 50;
const DENEME_LIMIT = 10; // 10 dakikada IP başına en fazla 10 yanlış deneme

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  let govde: { kod?: string; takma_ad?: string };
  try { govde = await req.json(); } catch { return json({ hata: "Geçersiz istek" }, 400); }
  const kod = String(govde.kod ?? "").trim().toUpperCase();
  const takmaAd = String(govde.takma_ad ?? "").trim().replace(/\s+/g, " ");
  if (takmaAd.length < 2 || takmaAd.length > 24) return json({ hata: "Takma ad 2-24 karakter olmalı." }, 400);
  if (kod.length < 4 || kod.length > 40) return json({ hata: "Davet kodu geçersiz." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "bilinmiyor").split(",")[0].trim();

  // Basit deneme sınırı
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("giris_denemeleri").select("id", { count: "exact", head: true }).eq("ip", ip).gte("zaman", since);
  if ((count ?? 0) >= DENEME_LIMIT) return json({ hata: "Çok fazla yanlış deneme. Birkaç dakika sonra tekrar dene." }, 429);

  // Yönetici kodu: oda sahibinin hesabına (nereden girilirse girilsin) yeni bir oturum açar
  const kodHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(kod)))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const { data: yk } = await admin.from("yonetici_kodlari").select("oda_id").eq("kod_hash", kodHash).maybeSingle();
  if (yk) {
    const { data: sahip } = await admin.from("uyeler").select("user_id").eq("oda_id", yk.oda_id).eq("rol", "sahip").maybeSingle();
    const { data: odaYk } = await admin.from("odalar").select("ad").eq("id", yk.oda_id).maybeSingle();
    const { data: hesap } = sahip ? await admin.auth.admin.getUserById(sahip.user_id) : { data: null };
    if (!sahip || !hesap?.user?.email) return json({ hata: "Yönetici hesabı bulunamadı." }, 500);
    const yeniParola = crypto.randomUUID() + crypto.randomUUID();
    const { error: pErr } = await admin.auth.admin.updateUserById(sahip.user_id, { password: yeniParola });
    if (pErr) return json({ hata: "Yönetici oturumu açılamadı." }, 500);
    const anonYk = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data: oturumYk, error: oErrYk } = await anonYk.auth.signInWithPassword({ email: hesap.user.email, password: yeniParola });
    if (oErrYk || !oturumYk.session) return json({ hata: "Oturum açılamadı." }, 500);
    return json({ access_token: oturumYk.session.access_token, refresh_token: oturumYk.session.refresh_token, oda_adi: odaYk?.ad ?? "Çember", rol: "sahip" });
  }

  const { data: oda } = await admin.from("odalar").select("id, ad").eq("davet_kodu", kod).maybeSingle();
  if (!oda) {
    await admin.from("giris_denemeleri").insert({ ip });
    return json({ hata: "Davet kodu yanlış." }, 403);
  }

  // Yasaklı mı? (takma ad ya da IP eşleşirse girilemez)
  const adKacis = takmaAd.replace(/[%_\\]/g, (m) => "\\" + m);
  const { data: adYasagi } = await admin.from("yasaklar").select("id").eq("oda_id", oda.id).ilike("takma_ad", adKacis).maybeSingle();
  const { data: ipYasagi } = ip === "bilinmiyor" ? { data: null } : await admin.from("yasaklar").select("id").eq("oda_id", oda.id).eq("ip", ip).maybeSingle();
  if (adYasagi || ipYasagi) return json({ hata: "Bu odaya girişin engellendi." }, 403);

  const { count: uyeSayisi } = await admin.from("uyeler").select("id", { count: "exact", head: true }).eq("oda_id", oda.id);
  if ((uyeSayisi ?? 0) >= MAX_UYE) return json({ hata: "Oda dolu." }, 409);

  const { data: ayniAd } = await admin.from("uyeler").select("id").eq("oda_id", oda.id).ilike("takma_ad", takmaAd.replace(/[%_\\]/g, (m) => "\\" + m)).maybeSingle();
  if (ayniAd) return json({ hata: "Bu takma ad odada kullanılıyor, başka bir tane seç." }, 409);

  // Odada henüz sahip yoksa ilk giren kişi sahip olur
  const { count: sahipSayisi } = await admin.from("uyeler").select("id", { count: "exact", head: true }).eq("oda_id", oda.id).eq("rol", "sahip");
  const rol = (sahipSayisi ?? 0) === 0 ? "sahip" : "uye";

  const eposta = `${crypto.randomUUID()}@cember.invalid`;
  const parola = crypto.randomUUID() + crypto.randomUUID();
  const { data: kullanici, error: kErr } = await admin.auth.admin.createUser({ email: eposta, password: parola, email_confirm: true });
  if (kErr || !kullanici.user) return json({ hata: "Hesap oluşturulamadı." }, 500);

  const renk = RENKLER[(uyeSayisi ?? 0) % RENKLER.length];
  const { data: yeniUye, error: uErr } = await admin.from("uyeler").insert({ oda_id: oda.id, user_id: kullanici.user.id, takma_ad: takmaAd, renk, rol }).select("id").single();
  if (uErr) {
    await admin.auth.admin.deleteUser(kullanici.user.id);
    const ad = uErr.code === "23505";
    return json({ hata: ad ? "Bu takma ad odada kullanılıyor, başka bir tane seç." : "Odaya katılınamadı." }, ad ? 409 : 500);
  }
  if (yeniUye && ip !== "bilinmiyor") await admin.from("uye_ip").insert({ uye_id: yeniUye.id, ip });
  if (rol === "sahip") await admin.from("odalar").update({ olusturan: kullanici.user.id }).eq("id", oda.id);

  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data: oturum, error: oErr } = await anon.auth.signInWithPassword({ email: eposta, password: parola });
  if (oErr || !oturum.session) return json({ hata: "Oturum açılamadı." }, 500);

  return json({ access_token: oturum.session.access_token, refresh_token: oturum.session.refresh_token, oda_adi: oda.ad, rol });
});
