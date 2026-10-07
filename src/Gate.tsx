import { useEffect, useState } from "react";
import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { googleAcikMi, googleIleGir } from "./google";

const SOZLER = ["Arkadaşlarınla yaz", "Sesli odada sohbet et", "Ekranını paylaş", "Birlikte film izle", "Çemberine katıl"];

function DonenSoz() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SOZLER.length), 2600);
    return () => clearInterval(t);
  }, []);
  return <div className="gate-soz" aria-hidden="true"><span key={i}>{SOZLER[i]}</span></div>;
}

export default function Gate({ onJoined }: { onJoined: () => void }) {
  const [ad, setAd] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);
  const [google, setGoogle] = useState(false);

  useEffect(() => { let iptal = false; googleAcikMi().then((a) => { if (!iptal) setGoogle(a); }); return () => { iptal = true; }; }, []);

  async function googleGir() {
    setHata("");
    setBekle(true);
    const h = await googleIleGir();
    if (h) { setHata(h); setBekle(false); }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (ad.trim().length < 2) return setHata("Takma ad en az 2 harf olmalı.");
    setBekle(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/katil`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ misafir: true, takma_ad: ad }),
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
      <div className="gate-arka" aria-hidden="true">
        <i className="blob b1" /><i className="blob b2" /><i className="blob b3" />
        <i className="halka h1" /><i className="halka h2" /><i className="halka h3" />
      </div>
      <form className="gatecard" onSubmit={gonder} noValidate>
        <div className="logo">
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="16" fill="none" stroke="#4fd1a5" strokeWidth="7" />
            <circle cx="22" cy="22" r="4" fill="currentColor" />
          </svg>
          <b>Çember</b>
        </div>
        <DonenSoz />
        <p>{google ? "Arkadaşlarla yazış ve konuş. Google ile gir ya da misafir olarak katıl." : "Arkadaşlarla yazış ve konuş. Bir takma ad yazıp misafir olarak katıl."}</p>
        {google && (
          <>
            <button className="cta google-btn" type="button" onClick={googleGir} disabled={bekle}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
              Google ile devam et
            </button>
            <div className="gate-ayrac"><span>ya da misafir olarak</span></div>
          </>
        )}
        <div className="field">
          <label htmlFor="ad">Takma ad</label>
          <input id="ad" type="text" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="Örn. Aras" />
        </div>
        <div className="err" role="alert">{hata}</div>
        <button className="cta" type="submit" disabled={bekle}>{bekle ? "Giriliyor…" : "Misafir olarak gir"}</button>
        <p className="hint">Misafir hesabı Çıkış'a basınca silinir; mesajların "Silinmiş üye" adıyla kalır.</p>
      </form>
    </main>
  );
}
