import { useCallback, useEffect, useState } from "react";
import { supabase, SUPABASE_URL } from "./supabase";
import type { Uye } from "./types";
import Gate from "./Gate";
import Chat from "./Chat";
import KayitAdi from "./KayitAdi";
import { googleKullanicisi } from "./google";

export default function App() {
  const [durum, setDurum] = useState<"yukleniyor" | "giris" | "kayit" | "sohbet">("yukleniyor");
  const [ben, setBen] = useState<Uye | null>(null);
  const [adOnerisi, setAdOnerisi] = useState("");

  const yukle = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBen(null); return setDurum("giris"); }
    const { data } = await supabase.from("uyeler").select("*").eq("user_id", session.user.id).maybeSingle();
    if (!data) {
      // Google ile gelen ama henüz odada kaydı olmayan kişi takma ad seçer; diğerleri girişe döner
      if (googleKullanicisi(session.user)) { setBen(null); setAdOnerisi(String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "").split(" ")[0]); return setDurum("kayit"); }
      await supabase.auth.signOut(); setBen(null); return setDurum("giris");
    }
    setBen(data as Uye);
    setDurum("sohbet");
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  if (!SUPABASE_URL) return <main className="gate-wrap"><p className="empty">VITE_SUPABASE_URL tanımlı değil. .env.example dosyasına bak.</p></main>;
  if (durum === "yukleniyor") return <main className="gate-wrap"><p className="empty">Yükleniyor…</p></main>;
  if (durum === "kayit") return <KayitAdi onBitti={yukle} varsayilan={adOnerisi} />;
  if (durum === "giris" || !ben) return <Gate onJoined={yukle} />;
  return <Chat me={ben} onExit={() => { setBen(null); setDurum("giris"); }} />;
}
