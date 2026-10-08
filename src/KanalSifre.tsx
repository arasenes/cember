import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Kanal } from "./types";
import { t } from "./i18n";

type Props = { kanal: Kanal; onAcildi: () => void; onKapat: () => void };

/** Şifreli bir kanala girmeden önce şifre sorar. Doğruysa sunucu kanalı bu üyeye açar. */
export default function KanalSifre({ kanal, onAcildi, onKapat }: Props) {
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const girdiRef = useRef<HTMLInputElement>(null);

  useEffect(() => { girdiRef.current?.focus(); }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  async function gir(e: React.FormEvent) {
    e.preventDefault();
    if (!sifre || mesgul) return;
    setMesgul(true); setHata("");
    const { data, error } = await supabase.rpc("kanal_ac", { p_kanal: kanal.id, p_sifre: sifre });
    setMesgul(false);
    if (error) { setHata(error.message || "Şifre denenemedi."); return; }
    if (data === true) onAcildi();
    else { setHata("Şifre yanlış."); setSifre(""); girdiRef.current?.focus(); }
  }

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ksifre-baslik" onSubmit={gir}>
        <div className="modal-ust">
          <h2 id="ksifre-baslik">🔒 {kanal.ad}</h2>
          <button type="button" className="lb-kapat modal-x" onClick={onKapat} aria-label={t("Kapat")}>✕</button>
        </div>
        <div className="field">
          <label htmlFor="ksifre">{kanal.tur === "sesli" ? t("Bu sesli oda şifreli. Şifreyi gir:") : t("Bu kanal şifreli. Şifreyi gir:")}</label>
          <input id="ksifre" ref={girdiRef} type="password" value={sifre} onChange={(e) => setSifre(e.target.value)}
            maxLength={40} autoComplete="off" disabled={mesgul} />
        </div>
        <div className="yon-bildirim hata" role="alert" aria-live="assertive">{t(hata)}</div>
        <div className="modal-alt">
          <button type="button" className="ib" onClick={onKapat}>{t("Vazgeç")}</button>
          <button type="submit" className="ib" disabled={!sifre || mesgul}>{mesgul ? "…" : "Gir"}</button>
        </div>
      </form>
    </div>
  );
}
