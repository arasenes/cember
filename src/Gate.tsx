import { useState } from "react";
import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";

export default function Gate({ onJoined }: { onJoined: () => void }) {
  const [kod, setKod] = useState("");
  const [ad, setAd] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (ad.trim().length < 2) return setHata("Takma ad en az 2 harf olmalı.");
    if (!kod.trim()) return setHata("Davet kodunu yaz.");
    setBekle(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/katil`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ kod, takma_ad: ad }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setHata(j.hata ?? "Katılınamadı, tekrar dene.");
        return;
      }
      const { error } = await supabase.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
      if (error) {
        setHata("Oturum açılamadı, tekrar dene.");
        return;
      }
      onJoined();
    } catch {
      setHata("Sunucuya ulaşılamadı. İnternetini kontrol et.");
    } finally {
      setBekle(false);
    }
  }

  return (
    <main className="gate-wrap" id="gate">
      <form className="gatecard" onSubmit={gonder} noValidate>
        <div className="logo">
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="16" fill="none" stroke="#E8A33D" strokeWidth="7" />
            <circle cx="22" cy="22" r="4" fill="currentColor" />
          </svg>
          <b>Çember</b>
        </div>
        <p>Arkadaşlarla yazış ve konuş. Girmek için davet kodunu ve bir takma ad yaz.</p>
        <div className="field">
          <label htmlFor="kod">Davet kodu</label>
          <input id="kod" type="text" value={kod} onChange={(e) => setKod(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="CMB-XXXX-XXXX" />
        </div>
        <div className="field">
          <label htmlFor="ad">Takma ad</label>
          <input id="ad" type="text" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="Örn. Aras" />
        </div>
        <div className="err" role="alert">{hata}</div>
        <button className="cta" type="submit" disabled={bekle}>{bekle ? "Giriliyor…" : "Odaya gir"}</button>
        <p className="hint">E-posta ya da şifre yok. Bu tarayıcıda oturumun açık kalır.</p>
      </form>
    </main>
  );
}
