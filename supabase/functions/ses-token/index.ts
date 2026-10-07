import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";
import * as lksdk from "npm:livekit-server-sdk@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_SESLI = Number(Deno.env.get("SES_MAX_KISI") ?? "12");
const AYLIK_LIMIT = Number(Deno.env.get("SES_AYLIK_DAKIKA") ?? "5000");
const NABIZ_PENCERESI_SN = 90; // bu süredir nabız atmayan bağlantı aktif sayılmaz

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  const lkUrl = Deno.env.get("LIVEKIT_URL");
  const lkKey = Deno.env.get("LIVEKIT_API_KEY");
  const lkSecret = Deno.env.get("LIVEKIT_API_SECRET");
  if (!lkUrl || !lkKey || !lkSecret) return json({ hata: "Sesli odalar henüz kurulmadı.", kod: "kurulmadi" }, 503);

  let govde: { kanal_id?: string; ekran?: boolean };
  try { govde = await req.json(); } catch { return json({ hata: "Geçersiz istek" }, 400); }
  const kanalId = String(govde.kanal_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(kanalId)) return json({ hata: "Geçersiz kanal" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const kullaniciIstemci = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await kullaniciIstemci.auth.getUser();
  if (!user) return json({ hata: "Oturum geçersiz" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: kanal } = await admin.from("kanallar").select("id, oda_id, tur, sifreli").eq("id", kanalId).maybeSingle();
  if (!kanal || kanal.tur !== "sesli") return json({ hata: "Sesli kanal bulunamadı" }, 404);

  // Kullanıcı bu odanın üyesi mi?
  const { data: uye } = await admin.from("uyeler").select("id, takma_ad, rol").eq("oda_id", kanal.oda_id).eq("user_id", user.id).maybeSingle();
  if (!uye) return json({ hata: "Bu odanın üyesi değilsin" }, 403);

  // İzinler: 4 sesli odada konuş · 8 ekran ve kamera paylaş (024_roller_izinler.sql)
  const { data: maskeVeri } = await admin.rpc("uye_izni", { p_uye: uye.id });
  const maske = Number(maskeVeri ?? 0);
  const TS = (lksdk as unknown as { TrackSource?: Record<string, number> }).TrackSource;
  const yayinKaynaklari = (): { canPublish: boolean; canPublishSources?: number[] } => {
    if (!TS) return { canPublish: (maske & 12) !== 0 };
    const k: number[] = [];
    if (maske & 4) k.push(TS.MICROPHONE);
    if (maske & 8) k.push(TS.CAMERA, TS.SCREEN_SHARE, TS.SCREEN_SHARE_AUDIO);
    return { canPublish: k.length > 0, canPublishSources: k };
  };

  // Şifreli odada: yönetici ya da şifreyi girmiş üye
  if (kanal.sifreli && uye.rol !== "sahip" && uye.rol !== "moderator") {
    const { data: acik } = await admin.from("kanal_acik").select("uye_id").eq("kanal_id", kanalId).eq("uye_id", uye.id).maybeSingle();
    if (!acik) return json({ hata: "Bu odanın şifresini girmelisin.", kod: "sifre" }, 403);
  }

  // Aylık limit
  const ayBasi = new Date(); ayBasi.setUTCDate(1); ayBasi.setUTCHours(0, 0, 0, 0);
  const { data: oturumlar } = await admin.from("ses_oturumlari")
    .select("baslangic, son_nabiz, kanallar!inner(oda_id)")
    .eq("kanallar.oda_id", kanal.oda_id).gte("baslangic", ayBasi.toISOString());
  const kullanilanSn = (oturumlar ?? []).reduce((t, o) => t + (new Date(o.son_nabiz).getTime() - new Date(o.baslangic).getTime()) / 1000, 0);
  const kullanilan = Math.ceil(kullanilanSn / 60);
  if (kullanilan >= AYLIK_LIMIT) return json({ hata: "Bu ay ses limiti doldu. Yazılı sohbet çalışmaya devam ediyor.", kod: "limit", kullanilan }, 403);

  // Telefondan ekran paylaşımı: ayrı bir katılımcı (kimlik "<üye>~ekran"), yalnızca yayın yapar, ses oturumu sayılmaz
  if (govde.ekran === true) {
    if ((maske & 8) === 0) return json({ hata: "Bu sunucuda ekran paylaşma iznin yok." }, 403);
    const atE = new AccessToken(lkKey, lkSecret, { identity: `${uye.id}~ekran`, name: `${uye.takma_ad} (ekran)`, ttl: "2h" });
    atE.addGrant({ room: kanalId, roomJoin: true, canPublish: true, canSubscribe: false, canPublishData: false });
    return json({ token: await atE.toJwt(), url: lkUrl, oturum_id: null, kullanilan, limit: AYLIK_LIMIT });
  }

  // Kanal doluluk
  const esik = new Date(Date.now() - NABIZ_PENCERESI_SN * 1000).toISOString();
  const { data: aktif } = await admin.from("ses_oturumlari").select("uye_id").eq("kanal_id", kanalId).gte("son_nabiz", esik);
  const aktifUyeler = new Set((aktif ?? []).map((a) => a.uye_id));
  if (!aktifUyeler.has(uye.id) && aktifUyeler.size >= MAX_SESLI) return json({ hata: `Sesli oda dolu (en fazla ${MAX_SESLI} kişi).`, kod: "dolu" }, 409);

  const { data: oturum, error: oErr } = await admin.from("ses_oturumlari").insert({ uye_id: uye.id, kanal_id: kanalId }).select("id").single();
  if (oErr || !oturum) return json({ hata: "Oturum başlatılamadı" }, 500);

  const at = new AccessToken(lkKey, lkSecret, { identity: uye.id, name: uye.takma_ad, ttl: "2h" });
  at.addGrant({ room: kanalId, roomJoin: true, ...yayinKaynaklari(), canSubscribe: true, canPublishData: false } as Parameters<typeof at.addGrant>[0]);
  const token = await at.toJwt();

  return json({ token, url: lkUrl, oturum_id: oturum.id, kullanilan, limit: AYLIK_LIMIT });
});
