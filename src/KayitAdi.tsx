import { useState } from "react";
import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { t } from "./i18n";

/** Google ile ilk kez gelen kişi: takma adını seçip odaya kaydolur. */
export default function KayitAdi({ onBitti, varsayilan }: { onBitti: () => void; varsayilan?: string }) {
  const [ad, setAd] = useState((varsayilan ?? "").slice(0, 24));
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (ad.trim().length < 2) return setHata("Takma ad en az 2 harf olmalı.");
    setBekle(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setHata("Oturum bulunamadı, tekrar giriş yap.");
      const r = await fetch(`${SUPABASE_URL}/functions/v1/katil`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ google: true, takma_ad: ad }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setHata(j.hata ?? "Kayıt olunamadı, tekrar dene.");
      onBitti();
    } catch {
      setHata("Sunucuya ulaşılamadı. İnternetini kontrol et.");
    } finally {
      setBekle(false);
    }
  }

  return (
    <main className="gate-wrap" id="kayit">
      <form className="gatecard" onSubmit={gonder} noValidate>
        <div className="logo"><b>{t("Çember")}</b></div>
        <p>{t("Google hesabın doğrulandı. Odada görünecek bir takma ad seç.")}</p>
        <div className="field">
          <label htmlFor="kayit-ad">{t("Takma ad")}</label>
          <input id="kayit-ad" type="text" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={24} autoComplete="nickname" placeholder={t("Örn. Aras")} autoFocus />
        </div>
        <div className="err" role="alert">{t(hata)}</div>
        <button className="cta" type="submit" disabled={bekle}>{bekle ? "Kaydediliyor…" : "Kayıt ol ve gir"}</button>
        <button className="gate-link" type="button" onClick={() => supabase.auth.signOut({ scope: "local" }).then(onBitti)}>{t("Vazgeç")}</button>
      </form>
    </main>
  );
}
