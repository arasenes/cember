import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { davetKodunuCikar } from "./sunucular";

type Props = {
  /** Sunucu kuruldu ya da davetle katılındı: yeni sunucunun kimliği. */
  onTamam: (odaId: string) => void;
  onKapat: () => void;
  misafir?: boolean;
};

/** "Sunucu oluştur veya katıl": yeni sunucu kur ya da davet bağlantısı/kodu yapıştırarak katıl. */
export default function SunucuDialog({ onTamam, onKapat, misafir = false }: Props) {
  const [sekme, setSekme] = useState<"kur" | "katil">("katil");
  const [ad, setAd] = useState("");
  const [davet, setDavet] = useState("");
  const [takmaAd, setTakmaAd] = useState("");
  const [adIste, setAdIste] = useState(false);
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const ilkRef = useRef<HTMLInputElement>(null);
  useEffect(() => { ilkRef.current?.focus(); }, [sekme]);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (misafir) return setHata("Misafir hesaplar sunucu kuramaz ya da davetle katılamaz. Google ile giriş yap.");
    setMesgul(true);
    try {
      if (sekme === "kur") {
        if (ad.trim().length < 2) return setHata("Sunucu adı en az 2 karakter olmalı.");
        const { data, error } = await supabase.rpc("sunucu_olustur", { p_ad: ad.trim() });
        if (error) return setHata(error.message);
        onTamam(data as string);
      } else {
        const kod = davetKodunuCikar(davet);
        if (!kod) return setHata("Geçerli bir davet bağlantısı ya da kodu yapıştır.");
        const { data, error } = await supabase.rpc("davet_katil", { p_kod: kod, p_takma_ad: takmaAd.trim() || null });
        if (error) {
          if (/takma ad/i.test(error.message)) setAdIste(true);
          return setHata(error.message);
        }
        onTamam(data as string);
      }
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className="modal-arka" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <form className="modal sunucu-form" role="dialog" aria-modal="true" aria-labelledby="sunucu-baslik" onSubmit={gonder} noValidate>
        <h2 id="sunucu-baslik">Sunucu oluştur veya katıl</h2>
        <div role="tablist" className="ark-sekmeler" aria-label="Sunucu işlemi">
          <button type="button" role="tab" aria-selected={sekme === "katil"} className={"ark-sekme" + (sekme === "katil" ? " acik" : "")} onClick={() => { setSekme("katil"); setHata(""); }}>Davetle katıl</button>
          <button type="button" role="tab" aria-selected={sekme === "kur"} className={"ark-sekme" + (sekme === "kur" ? " acik" : "")} onClick={() => { setSekme("kur"); setHata(""); }}>Sunucu kur</button>
        </div>
        {sekme === "kur" ? (
          <div className="field">
            <label htmlFor="sunucu-ad">Sunucu adı</label>
            <input ref={ilkRef} id="sunucu-ad" type="text" value={ad} maxLength={40} onChange={(e) => setAd(e.target.value)} placeholder="Örn. Oyun gecesi" />
            <p className="hint">Kurucu olarak sunucunun sahibi olursun; “genel-sohbet” ve “Salon” kanalları hazır gelir.</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="sunucu-davet">Davet bağlantısı ya da kodu</label>
              <input ref={ilkRef} id="sunucu-davet" type="text" value={davet} onChange={(e) => setDavet(e.target.value)} placeholder="https://cember.onrender.com/?davet=X7KP2Q9A" autoComplete="off" />
            </div>
            {adIste && (
              <div className="field">
                <label htmlFor="sunucu-takma-ad">Bu sunucudaki takma adın</label>
                <input id="sunucu-takma-ad" type="text" value={takmaAd} maxLength={24} onChange={(e) => setTakmaAd(e.target.value)} />
              </div>
            )}
          </>
        )}
        <div className="err" role="alert">{hata}</div>
        <div className="modal-alt">
          <button type="button" className="linkbtn" onClick={onKapat}>Vazgeç</button>
          <button type="submit" className="cta" disabled={mesgul}>{mesgul ? "…" : sekme === "kur" ? "Sunucuyu kur" : "Katıl"}</button>
        </div>
      </form>
    </div>
  );
}
