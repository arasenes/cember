// Yeni mesaj için bildirim gönderir (tarayıcı web push + Android FCM). Yalnızca veritabanı tetikleyicisi çağırır (x-gizli).
// Gövde: { mesaj_id } kanal mesajı için, { dm_mesaj_id } özel mesaj için (yalnızca DM üyelerine gider).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const KONU = "https://cember.onrender.com";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}

// --- FCM (HTTP v1): servis hesabı anahtarından kısa ömürlü erişim jetonu ---
let fcmJeton: { t: string; bitis: number } | null = null;
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function fcmErisim(sa: { client_email: string; private_key: string }): Promise<string> {
  if (fcmJeton && fcmJeton.bitis > Date.now() + 60_000) return fcmJeton.t;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const girdi = enc({ alg: "RS256", typ: "JWT" }) + "." + enc({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const anahtar = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const imza = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", anahtar, new TextEncoder().encode(girdi));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: girdi + "." + b64u(imza) }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("FCM jetonu alınamadı");
  fcmJeton = { t: j.access_token, bitis: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return fcmJeton.t;
}

type Abone = { id: string; uye_id: string; tur: string; uc: string; p256dh: string | null; auth: string | null; sadece_etiket: boolean };
const kisalt = (s: string) => (s.length > 140 ? s.slice(0, 137) + "…" : s);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: ayarlar } = await admin.from("push_ayar").select("anahtar, deger");
  const ayar = Object.fromEntries((ayarlar ?? []).map((a: { anahtar: string; deger: string }) => [a.anahtar, a.deger]));
  if (!ayar.bildir_gizli || req.headers.get("x-gizli") !== ayar.bildir_gizli) return json({ hata: "Yetkisiz" }, 401);

  let mesajId = "";
  let dmMesajId = "";
  try {
    const g = await req.json();
    mesajId = String(g.mesaj_id ?? "");
    dmMesajId = String(g.dm_mesaj_id ?? "");
  } catch { /* yoksay */ }
  if (!mesajId && !dmMesajId) return json({ hata: "mesaj_id gerekli" }, 400);

  let baslik = "";
  let govde = "";
  let veri: Record<string, string> = {};
  let etiketMetni = "";
  let hedefler: Abone[] = [];

  if (dmMesajId) {
    // --- Özel mesaj: yalnızca DM üyeleri (gönderen hariç) ---
    const { data: d } = await admin.from("dm_mesajlari").select("id, dm_id, uye_id, metin, silindi").eq("id", dmMesajId).maybeSingle();
    if (!d || d.silindi) return json({ ok: true, gonderilen: 0 });
    const [{ data: gonderen }, { data: dm }, { data: uyeler }] = await Promise.all([
      admin.from("uyeler").select("takma_ad").eq("id", d.uye_id).maybeSingle(),
      admin.from("dm_kanallari").select("tur, ad").eq("id", d.dm_id).maybeSingle(),
      admin.from("dm_uyeleri").select("uye_id").eq("dm_id", d.dm_id),
    ]);
    const ad = gonderen?.takma_ad ?? "Biri";
    baslik = dm?.tur === "grup" ? `${ad} · ${dm.ad ?? "Grup"}` : ad;
    govde = kisalt(String(d.metin ?? "").replace(/\s+/g, " ").trim()) || "Yeni mesaj";
    veri = { dm_id: d.dm_id, mesaj_id: d.id };
    const alicilar = (uyeler ?? []).map((u: { uye_id: string }) => u.uye_id).filter((id: string) => id !== d.uye_id);
    if (!alicilar.length) return json({ ok: true, gonderilen: 0 });
    const { data: ab } = await admin.from("push_abonelikleri").select("id, uye_id, tur, uc, p256dh, auth, sadece_etiket").in("uye_id", alicilar);
    hedefler = (ab ?? []) as Abone[];
  } else {
    // --- Kanal mesajı ---
    const { data: m } = await admin.from("mesajlar").select("id, kanal_id, uye_id, metin, ek_tur, silindi").eq("id", mesajId).maybeSingle();
    if (!m || m.silindi) return json({ ok: true, gonderilen: 0 });
    const [{ data: gonderen }, { data: kanal }] = await Promise.all([
      admin.from("uyeler").select("takma_ad").eq("id", m.uye_id).maybeSingle(),
      admin.from("kanallar").select("ad, sifreli").eq("id", m.kanal_id).maybeSingle(),
    ]);
    const ad = gonderen?.takma_ad ?? "Biri";
    const sifreli = !!kanal?.sifreli;
    const metin = String(m.metin ?? "").replace(/\s+/g, " ").trim();
    etiketMetni = metin.toLowerCase();
    govde = sifreli ? "Yeni mesaj" : metin ? kisalt(metin) : m.ek_tur?.startsWith("image/") ? "📷 Resim" : "📎 Dosya";
    baslik = `${ad} · #${kanal?.ad ?? "sohbet"}`;
    veri = { kanal_id: m.kanal_id, mesaj_id: m.id };

    const { data: abonelikler } = await admin.from("push_abonelikleri").select("id, uye_id, tur, uc, p256dh, auth, sadece_etiket").neq("uye_id", m.uye_id);
    const adlar = new Map<string, string>();
    const uyeIdler = [...new Set((abonelikler ?? []).map((a: { uye_id: string }) => a.uye_id))];
    if (uyeIdler.length) {
      const { data: uy } = await admin.from("uyeler").select("id, takma_ad").in("id", uyeIdler);
      for (const u of uy ?? []) adlar.set(u.id, u.takma_ad);
    }
    hedefler = ((abonelikler ?? []) as Abone[]).filter((a) => !a.sadece_etiket || etiketMetni.includes("@" + (adlar.get(a.uye_id) ?? "\u0000").toLowerCase()));
  }

  let vapidHazir = false;
  if (ayar.vapid_public && ayar.vapid_private) { webpush.setVapidDetails(KONU, ayar.vapid_public, ayar.vapid_private); vapidHazir = true; }
  let sa: { client_email: string; private_key: string } | null = null;
  try { const h = Deno.env.get("FCM_SERVICE_ACCOUNT"); if (h) sa = JSON.parse(h); } catch { /* yoksay */ }
  const fcmProje = sa ? (sa as unknown as { project_id: string }).project_id : "";
  const etiketKanal = veri.dm_id ?? veri.kanal_id;

  const olu: string[] = [];
  let gidenSayi = 0;
  await Promise.allSettled(hedefler.map(async (a) => {
    try {
      if (a.tur === "web" && vapidHazir && a.p256dh && a.auth) {
        await webpush.sendNotification({ endpoint: a.uc, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify({ baslik, govde, ...veri }), { TTL: 3600, urgency: "high" });
        gidenSayi++;
      } else if (a.tur === "fcm" && sa) {
        const jeton = await fcmErisim(sa);
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${fcmProje}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token: a.uc, notification: { title: baslik, body: govde }, data: veri, android: { priority: "HIGH", notification: { channel_id: "mesajlar", tag: String(etiketKanal) } } } }),
        });
        if (r.ok) gidenSayi++;
        else {
          const t = await r.text();
          if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(t)) olu.push(a.id);
        }
      }
    } catch (e) {
      const kod = (e as { statusCode?: number }).statusCode;
      if (kod === 404 || kod === 410) olu.push(a.id);
    }
  }));
  if (olu.length) await admin.from("push_abonelikleri").delete().in("id", olu);
  return json({ ok: true, gonderilen: gidenSayi, temizlenen: olu.length });
});
