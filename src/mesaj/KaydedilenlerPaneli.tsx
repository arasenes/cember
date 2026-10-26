import { useEffect, useRef, useState } from "react";
import type { KaydedilenMesaj } from "./kaydedilenler";
import { duzMetin } from "./markdown";
import { gunEtiketi, saat } from "../util";
import { t } from "../i18n";

type Props = {
  liste: KaydedilenMesaj[];
  onGit?: (k: KaydedilenMesaj) => void;
  onKaldir: (mesajId: string) => void;
  onKapat: () => void;
};

/** Kullanıcının kişisel yer imlerine (kaydedilenler) aldığı mesajlar. */
export default function KaydedilenlerPaneli({ liste, onGit, onKaldir, onKapat }: Props) {
  const [ara, setAra] = useState("");
  const kutuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  const q = ara.trim().toLocaleLowerCase("tr");
  const suzulmus = q
    ? liste.filter((x) =>
        x.metin.toLocaleLowerCase("tr").includes(q) ||
        x.yazarAd.toLocaleLowerCase("tr").includes(q) ||
        x.kanalAdi.toLocaleLowerCase("tr").includes(q))
    : liste;

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="kayit-baslik" ref={kutuRef}>
        <div className="modal-ust">
          <h2 id="kayit-baslik">🔖 {t("Kaydedilen Mesajlar")} ({liste.length})</h2>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label={t("Kapat")}>✕</button>
        </div>
        {liste.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              value={ara}
              onChange={(e) => setAra(e.target.value)}
              placeholder={t("Kaydedilenlerde ara…")}
              aria-label={t("Kaydedilenlerde ara")}
              style={{ width: "100%" }}
            />
          </div>
        )}
        {suzulmus.length === 0 && (
          <div className="hint">
            {liste.length === 0 ? t("Henüz kaydettiğin bir mesaj yok. Mesajların üzerindeki 🔖 düğmesiyle buraya ekleyebilirsin.") : t("Eşleşen kayıt bulunamadı.")}
          </div>
        )}
        <ul className="sabit-liste">
          {suzulmus.map((k) => (
            <li key={k.id} className="sabit-oge">
              <div className="sabit-ic" style={{ flex: 1 }}>
                <div className="mh" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <b>{k.yazarAd}</b>
                  <span className="hint">{k.dmMi ? `💬 ${k.kanalAdi}` : `#${k.kanalAdi}`}</span>
                  <time dateTime={k.olusturma}>{gunEtiketi(k.olusturma)} {saat(k.olusturma)}</time>
                </div>
                <div className="txt">{duzMetin(k.metin)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {onGit && !k.dmMi && (
                  <button type="button" className="linkbtn" onClick={() => { onGit(k); onKapat(); }}>
                    {t("Git")}
                  </button>
                )}
                <button type="button" className="linkbtn" onClick={() => onKaldir(k.id)} aria-label={t("Kaydı kaldır")}>
                  {t("Kaldır")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
