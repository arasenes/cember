import { useEffect, useRef } from "react";
import Avatar from "./Avatar";
import type { Mesaj, Uye } from "./types";
import { gunEtiketi, saat } from "./util";
import { t } from "./i18n";

type Props = {
  mesajlar: Mesaj[];
  uyeler: Map<string, Uye>;
  kanalAdi: string;
  yonetici: boolean;
  onKaldir: (m: Mesaj) => void;
  onKapat: () => void;
};

/** Kanaldaki sabitlenmiş mesajların listesi (en yeni sabitlenen üstte). */
export default function SabitlerDialog({ mesajlar, uyeler, kanalAdi, yonetici, onKaldir, onKapat }: Props) {
  const kutuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onceki = document.activeElement as HTMLElement | null;
    kutuRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { onceki?.focus?.(); };
  }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sabit-baslik" ref={kutuRef}>
        <div className="modal-ust">
          <h2 id="sabit-baslik">📌 Sabitlenenler — #{kanalAdi}</h2>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label={t("Kapat")}>✕</button>
        </div>
        {mesajlar.length === 0 && <div className="hint">{t("Bu kanalda sabitlenmiş mesaj yok.")}</div>}
        <ul className="sabit-liste">
          {mesajlar.map((m) => {
            const y = uyeler.get(m.uye_id);
            return (
              <li key={m.id} className="sabit-oge">
                <Avatar uye={y} />
                <div className="sabit-ic">
                  <div className="mh"><b>{y?.takma_ad ?? "Eski üye"}</b><time dateTime={m.olusturma}>{gunEtiketi(m.olusturma)} {saat(m.olusturma)}</time></div>
                  <div className="txt">{m.metin || (m.ek_yol ? "🖼️ Resim" : "")}</div>
                </div>
                {yonetici && <button className="linkbtn" onClick={() => onKaldir(m)} aria-label={t("Sabitlemeyi kaldır")}>{t("Kaldır")}</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
