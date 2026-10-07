import { useEffect, useRef } from "react";
import type { Kanal, Mesaj, Uye } from "../types";
import { t } from "../i18n";

type Props = {
  mesaj: Mesaj;
  yazar?: Uye;
  kanallar: Kanal[];
  aktifKanal: string | null;
  onIlet: (kanal: Kanal) => void;
  onKapat: () => void;
};

/** Mesajı başka bir yazılı kanala kopyalar; kopyada "<ad>'ten iletildi" etiketi görünür. Resimler iletilmez. */
export default function IletDialog({ mesaj, yazar, kanallar, aktifKanal, onIlet, onKapat }: Props) {
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ilet-baslik" ref={kutuRef}>
        <div className="modal-ust">
          <h2 id="ilet-baslik">{t("Mesajı ilet")}</h2>
          <button type="button" className="sq modal-x" aria-label={t("Kapat")} onClick={onKapat}>×</button>
        </div>
        <blockquote className="ilet-onizleme">
          <b>{yazar?.takma_ad ?? "Eski üye"}</b>
          <span>{mesaj.metin.length > 140 ? mesaj.metin.slice(0, 137) + "…" : mesaj.metin}</span>
        </blockquote>
        <ul className="ilet-liste">
          {kanallar.map((k) => (
            <li key={k.id}>
              <button type="button" className="ilet-kanal" onClick={() => onIlet(k)}>
                <span aria-hidden="true">#</span> {k.ad}{k.id === aktifKanal ? " (bu kanal)" : ""}
              </button>
            </li>
          ))}
          {!kanallar.length && <li className="hint">{t("İletebileceğin kanal yok.")}</li>}
        </ul>
      </div>
    </div>
  );
}
