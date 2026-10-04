import { useCallback, useEffect, useState } from "react";
import { supabase, SUPABASE_URL } from "./supabase";
import type { Uye } from "./types";
import Gate from "./Gate";
import Chat from "./Chat";

export default function App() {
  const [durum, setDurum] = useState<"yukleniyor" | "giris" | "sohbet">("yukleniyor");
  const [ben, setBen] = useState<Uye | null>(null);

  const yukle = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBen(null); return setDurum("giris"); }
    const { data } = await supabase.from("uyeler").select("*").eq("user_id", session.user.id).maybeSingle();
    if (!data) { await supabase.auth.signOut(); setBen(null); return setDurum("giris"); }
    setBen(data as Uye);
    setDurum("sohbet");
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  if (!SUPABASE_URL) return <main className="gate-wrap"><p className="empty">VITE_SUPABASE_URL tanımlı değil. .env.example dosyasına bak.</p></main>;
  if (durum === "yukleniyor") return <main className="gate-wrap"><p className="empty">Yükleniyor…</p></main>;
  if (durum === "giris" || !ben) return <Gate onJoined={yukle} />;
  return <Chat me={ben} onExit={() => { setBen(null); setDurum("giris"); }} />;
}
