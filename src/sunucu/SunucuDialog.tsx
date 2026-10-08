import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { davetKodunuCikar } from "./sunucular";
import { t } from "../i18n";

type Props = {
  /** Davetle katılındı: sunucunun kimliği. */
  onTamam: (odaId: string) => void;
  onKapat: () => void;
  misafir?: boolean;
};

/** "Davetle sunucuya katıl": davet bağlantısı ya da kodu yapıştırarak katıl. Yeni sunucu kurma kapalıdır. */
export default function SunucuDialog({ onTamam, onKapat, misafir = false }: Props) {
  const [davet, setDavet] = useState("");
  const [takmaAd, setTakmaAd] = useState("");
  const [adIste, setAdIste] = useState(false);
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const ilkRef = useRef<HTMLInputElement>(null);
  useEffect(() => { ilkRef.current?.focus(); }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (misafir) return setHata("Misafir hesaplar davetle katılamaz. Google ile giriş yap.");
    setMesgul(true);
    try {
      const kod = davetKodunuCikar(davet);
      if (!kod) return setHata("Geçerli bir davet bağlantısı ya da kodu yapıştır.");
      const { data, error } = await supabase.rpc("davet_katil", { p_kod: kod, p_takma_ad: takmaAd.trim() || null });
      if (error) {
        if (/takma ad/i.test(error.message)) setAdIste(true);
        return setHata(error.message);
      }
      onTamam(data as string);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className="modal-arka" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <form className="modal sunucu-form" role="dialog" aria-modal="true" aria-labelledby="sunucu-baslik" onSubmit={gonder} noValidate>
        <h2 id="sunucu-baslik">{t("Davetle sunucuya katıl")}</h2>
        <div className="field">
          <label htmlFor="sunucu-davet">{t("Davet bağlantısı ya da kodu")}</label>
          <input ref={ilkRef} id="sunucu-davet" type="text" value={davet} onChange={(e) => setDavet(e.target.value)} placeholder={t("https://cember.onrender.com/?davet=X7KP2Q9A")} autoComplete="off" />
        </div>
        {adIste && (
          <div className="field">
            <label htmlFor="sunucu-takma-ad">{t("Bu sunucudaki takma adın")}</label>
            <input id="sunucu-takma-ad" type="text" value={takmaAd} maxLength={24} onChange={(e) => setTakmaAd(e.target.value)} />
          </div>
        )}
        <div className="err" role="alert">{t(hata)}</div>
        <div className="modal-alt">
          <button type="button" className="linkbtn" onClick={onKapat}>{t("Vazgeç")}</button>
          <button type="submit" className="cta" disabled={mesgul}>{mesgul ? "…" : "Katıl"}</button>
        </div>
      </form>
    </div>
  );
}
