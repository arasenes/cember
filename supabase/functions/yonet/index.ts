import { createClient } from "npm:@supabase/supabase-js@2";
import * as lksdk from "npm:livekit-server-sdk@2";

const { RoomServiceClient } = lksdk;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Govde = { islem?: string; uye_id?: string; yasakla?: boolean; sebep?: string; yasak_id?: string; tur?: string; kanal_id?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  let g: Govde;
  try { g = await req.json(); } catch { return json({ hata: "Geçersiz istek" }, 400); }

  const url = Deno.env.get("SUPABASE_URL")!;
  const kullanici = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await kullanici.auth.getUser();
  if (!user) return json({ hata: "Oturum geçersiz" }, 401);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // İzin bitleri (bkz. 024_roller_izinler.sql): 16 mesaj_yonet · 32 sustur · 64 yasakla · 128 kanal_yonet
  const IZIN = { sustur: 32, yasakla: 64 } as const;
  async function izinMaskesi(uyeId: string): Promise<number> {
    const { data } = await admin.rpc("uye_izni", { p_uye: uyeId });
    return Number(data ?? 0);
  }
  async function denetim(odaId: string, eyleyen: string, eylem: string, hedef: string | null, ayrinti: Record<string, unknown> = {}) {
    try { await admin.from("denetim_kaydi").insert({ oda_id: odaId, eyleyen, eylem, hedef, ayrinti }); } catch { /* kayıt yazılamazsa işlem yine de yapılır */ }
  }

  // Hedef üye ve yetki denetimi (izin: gereken bit)
  async function hedefVeYetki(uyeId: unknown, izin: number = IZIN.sustur) {
    if (typeof uyeId !== "string" || !UUID.test(uyeId)) return { hata: json({ hata: "Geçersiz üye" }, 400) };
    const { data: hedef } = await admin.from("uyeler").select("id, oda_id, user_id, rol, takma_ad").eq("id", uyeId).maybeSingle();
    if (!hedef) return { hata: json({ hata: "Üye bulunamadı" }, 404) };
    const { data: ben } = await admin.from("uyeler").select("id, rol").eq("oda_id", hedef.oda_id).eq("user_id", user!.id).eq("silindi", false).maybeSingle();
    if (!ben || (await izinMaskesi(ben.id) & izin) === 0) return { hata: json({ hata: "Bu işlem için yetkin yok" }, 403) };
    if (hedef.rol === "sahip") return { hata: json({ hata: "Oda sahibine işlem yapılamaz" }, 403) };
    if (ben.rol !== "sahip" && hedef.rol !== "uye") return { hata: json({ hata: "Moderatör, başka bir moderatöre işlem yapamaz" }, 403) };
    return { hedef, ben };
  }

  const lkUrl = Deno.env.get("LIVEKIT_URL");
  const lkKey = Deno.env.get("LIVEKIT_API_KEY");
  const lkSecret = Deno.env.get("LIVEKIT_API_SECRET");
  async function sesttenCikar(odaId: string, uyeId: string, haric?: string) {
    if (!lkUrl || !lkKey || !lkSecret) return;
    const lk = new RoomServiceClient(lkUrl.replace(/^wss?:\/\//, "https://"), lkKey, lkSecret);
    const { data: kanallar } = await admin.from("kanallar").select("id").eq("oda_id", odaId).eq("tur", "sesli");
    for (const k of kanallar ?? []) {
      if (k.id === haric) continue;
      for (const kimlik of [uyeId, `${uyeId}~ekran`]) {
        try { await lk.removeParticipant(k.id, kimlik); } catch { /* odada değil */ }
      }
    }
  }

  // Sunucuda sustur: odadaki mikrofon yayını LiveKit'ten susturulur (en iyi çaba); asıl kilit, hedefin istemcisine giden komutla uygulanır
  async function mikSustur(odaId: string, uyeId: string) {
    if (!lkUrl || !lkKey || !lkSecret) return;
    const lk = new RoomServiceClient(lkUrl.replace(/^wss?:\/\//, "https://"), lkKey, lkSecret);
    const { data: kanallar } = await admin.from("kanallar").select("id").eq("oda_id", odaId).eq("tur", "sesli");
    const MIK = (lksdk as unknown as { TrackSource?: { MICROPHONE?: number } }).TrackSource?.MICROPHONE ?? 2;
    for (const k of kanallar ?? []) {
      try {
        const p = await lk.getParticipant(k.id, uyeId);
        for (const t of p.tracks ?? []) if (t.source === MIK) await lk.mutePublishedTrack(k.id, uyeId, t.sid, true);
      } catch { /* odada değil */ }
    }
  }

  if (g.islem === "at") {
    const s = await hedefVeYetki(g.uye_id, g.yasakla ? IZIN.yasakla : IZIN.sustur);
    if (s.hata) return s.hata;
    const { hedef, ben } = s as { hedef: { id: string; oda_id: string; user_id: string; takma_ad: string }; ben: { rol: string } };
    if (g.yasakla) {
      const { data: ip } = await admin.from("uye_ip").select("ip").eq("uye_id", hedef.id).maybeSingle();
      const sebep = String(g.sebep ?? "").trim().slice(0, 100) || null;
      const kacis = hedef.takma_ad.replace(/[%_\\]/g, (m) => "\\" + m);
      const { data: var_ } = await admin.from("yasaklar").select("id").eq("oda_id", hedef.oda_id).ilike("takma_ad", kacis).maybeSingle();
      const { error } = var_
        ? await admin.from("yasaklar").update({ ip: ip?.ip ?? null, sebep }).eq("id", var_.id)
        : await admin.from("yasaklar").insert({ oda_id: hedef.oda_id, takma_ad: hedef.takma_ad, ip: ip?.ip ?? null, sebep });
      if (error) return json({ hata: "Yasak kaydedilemedi" }, 500);
    }
    await sesttenCikar(hedef.oda_id, hedef.id);
    const { error: sErr } = await admin.auth.admin.deleteUser(hedef.user_id);
    if (sErr) return json({ hata: "Üye atılamadı" }, 500);
    await denetim(hedef.oda_id, (s as { ben: { id: string } }).ben.id, g.yasakla ? "yasakla" : "at", hedef.takma_ad, { sebep: String(g.sebep ?? "").slice(0, 100) });
    return json({ ok: true });
  }

  if (g.islem === "yasak-kaldir") {
    if (typeof g.yasak_id !== "string" || !UUID.test(g.yasak_id)) return json({ hata: "Geçersiz kayıt" }, 400);
    const { data: y } = await admin.from("yasaklar").select("id, oda_id").eq("id", g.yasak_id).maybeSingle();
    if (!y) return json({ hata: "Kayıt bulunamadı" }, 404);
    const { data: ben } = await admin.from("uyeler").select("id").eq("oda_id", y.oda_id).eq("user_id", user.id).eq("silindi", false).maybeSingle();
    if (!ben || (await izinMaskesi(ben.id) & IZIN.yasakla) === 0) return json({ hata: "Bu işlem için yetkin yok" }, 403);
    await admin.from("yasaklar").delete().eq("id", y.id);
    await denetim(y.oda_id, ben.id, "yasak_kaldir", null, {});
    return json({ ok: true });
  }

  if (g.islem === "ses") {
    const s = await hedefVeYetki(g.uye_id);
    if (s.hata) return s.hata;
    const { hedef } = s as { hedef: { id: string; oda_id: string; takma_ad?: string } };
    const eyleyen = (s as { ben: { id: string } }).ben.id;
    await denetim(hedef.oda_id, eyleyen, g.tur === "sustur" ? "ses_sustur" : g.tur === "sustur-kaldir" ? "ses_sustur_kaldir" : g.tur === "tasi" ? "ses_tasi" : "ses_at", String(hedef.takma_ad ?? ""), {});
    if (g.tur === "sustur" || g.tur === "sustur-kaldir") {
      await admin.from("yonetim_komutlari").delete().eq("hedef_uye", hedef.id).lt("olusturma", new Date(Date.now() - 60_000).toISOString());
      const { error: sErr } = await admin.from("yonetim_komutlari").insert({ oda_id: hedef.oda_id, hedef_uye: hedef.id, tur: g.tur, kanal_id: null });
      if (sErr) return json({ hata: "Komut gönderilemedi" }, 500);
      if (g.tur === "sustur") await mikSustur(hedef.oda_id, hedef.id);
      return json({ ok: true });
    }
    let kanalId: string | null = null;
    if (g.tur === "tasi") {
      if (typeof g.kanal_id !== "string" || !UUID.test(g.kanal_id)) return json({ hata: "Geçersiz kanal" }, 400);
      const { data: k } = await admin.from("kanallar").select("id").eq("id", g.kanal_id).eq("oda_id", hedef.oda_id).eq("tur", "sesli").maybeSingle();
      if (!k) return json({ hata: "Sesli kanal bulunamadı" }, 404);
      kanalId = k.id;
      // Şifreli odaya taşınan üye şifre sormadan girebilsin
      await admin.from("kanal_acik").upsert({ kanal_id: k.id, uye_id: hedef.id }, { onConflict: "kanal_id,uye_id" });
    } else if (g.tur !== "at") return json({ hata: "Geçersiz işlem" }, 400);
    // Eski komutları temizle, yenisini yaz (hedefin istemcisi Realtime ile alır)
    await admin.from("yonetim_komutlari").delete().eq("hedef_uye", hedef.id).lt("olusturma", new Date(Date.now() - 60_000).toISOString());
    const { error } = await admin.from("yonetim_komutlari").insert({ oda_id: hedef.oda_id, hedef_uye: hedef.id, tur: g.tur === "tasi" ? "tasi" : "ses-at", kanal_id: kanalId });
    if (error) return json({ hata: "Komut gönderilemedi" }, 500);
    // İstemci kendi ayrılsın diye kısa süre bekle; ayrılmazsa LiveKit'ten zorla çıkarılır
    await bekle(1500);
    await sesttenCikar(hedef.oda_id, hedef.id, kanalId ?? undefined);
    return json({ ok: true });
  }

  return json({ hata: "Geçersiz işlem" }, 400);
});
