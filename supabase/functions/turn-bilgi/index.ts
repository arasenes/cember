import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// TURN anahtarı tanımlı değilse yalnızca STUN döner; çoğu bağlantı yine kurulur, çok kısıtlı ağlarda kurulamayabilir.
const VARSAYILAN = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ hata: "Geçersiz istek" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const istemci = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await istemci.auth.getUser();
  if (!user) return json({ hata: "Oturum geçersiz" }, 401);

  // Yalnızca bir odanın üyesi TURN bilgisi alabilir
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: uye } = await admin.from("uyeler").select("id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!uye) return json({ hata: "Üye değilsin" }, 403);

  const keyId = Deno.env.get("CF_TURN_KEY_ID");
  const token = Deno.env.get("CF_TURN_API_TOKEN");
  if (!keyId || !token) return json({ iceServers: VARSAYILAN, turn: false });

  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!r.ok) return json({ iceServers: VARSAYILAN, turn: false });
    const j = await r.json();
    return json({ iceServers: j.iceServers ?? VARSAYILAN, turn: true });
  } catch {
    return json({ iceServers: VARSAYILAN, turn: false });
  }
});
