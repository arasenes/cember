import { useState } from "react";
import type { SesArayuzu } from "./sesMotoru";
import { ekranPaylasilabilirTarayici, KALITE, yerelEkran, type EkranKalite } from "./ekranOrtak";

type Props = { ses: SesArayuzu; kanalAdi: string; className: string; baskasiPaylasiyor?: string | null };

export default function SesCubugu({ ses, kanalAdi, className, baskasiPaylasiyor = null }: Props) {
  const [kalite, setKalite] = useState<EkranKalite>("720");
  if (ses.durum === "kapali") return null;
  const baglaniyor = ses.durum === "baglaniyor";
  return (
    <div className={`voicebar on ${className}`} role="region" aria-label="Sesli oda kontrolleri">
      <div className="vstat"><i aria-hidden="true" />{baglaniyor ? "Bağlanılıyor…" : "Sesli bağlı"}{!baglaniyor && ses.motor === "p2p" && <span className="hint" title="Ücretsiz doğrudan bağlantı modu"> (doğrudan)</span>}<span className="hint" style={{ marginLeft: "auto" }}>{kanalAdi}</span></div>
      <div className="vbtns">
        <button className="ib" aria-pressed={ses.sessiz} onClick={ses.sessizDegistir} disabled={baglaniyor}>
          {ses.sessiz ? "🔇 Sessiz" : "🎙️ Sessize al"}
        </button>
        <button className="ib leave" onClick={ses.ayril}>Ayrıl</button>
      </div>
      {ses.ekranDestegi && (
        ses.paylasiyorum ? (
          <div className="vbtns">
            <button className="ib" aria-pressed={true} onClick={() => void ses.ekranDurdur()}>⏹ Paylaşımı durdur</button>
          </div>
        ) : (
          <>
            <div className="vbtns">
              <select className="ekran-kalite" aria-label="Ekran paylaşım kalitesi" value={kalite} onChange={(e) => setKalite(e.target.value as EkranKalite)} disabled={baglaniyor}>
                {(Object.keys(KALITE) as EkranKalite[]).map((k) => <option key={k} value={k}>{KALITE[k].etiket}</option>)}
              </select>
              <button className="ib" onClick={() => void ses.ekranPaylas(kalite)} disabled={baglaniyor || !!baskasiPaylasiyor}
                title={baskasiPaylasiyor ? `${baskasiPaylasiyor} ekran paylaşıyor` : undefined}>
                🖥️ Ekranı paylaş
              </button>
            </div>
            {baskasiPaylasiyor
              ? <div className="hint">{baskasiPaylasiyor} ekran paylaşıyor; bitince sen paylaşabilirsin.</div>
              : yerelEkran()
                ? <div className="hint">Android'in açacağı izin penceresinde <b>Başla</b>'ya bas; telefonun tüm ekranı paylaşılır. Sonra paylaşmak istediğin uygulamaya geç.</div>
                : ekranPaylasilabilirTarayici()
                  ? <div className="hint">Dizi için: açılan pencerede <b>Chrome Sekmesi</b>'ni seç ve <b>Sekme sesini paylaş</b>'ı işaretle.</div>
                  : <div className="hint">Telefonun tüm ekranını paylaşmak için Çember Android uygulaması (APK) gerekir.</div>}
          </>
        )
      )}
      {className.includes("vbar-dock") && ses.hata && <div className="vbar-hata" role="alert">{ses.hata} <button className="linkbtn" onClick={ses.hataTemizle}>Kapat</button></div>}
      {ses.paylasiyorum && <div className="hint">Ekranın odadakilere gösteriliyor. Kendi ekranını burada görmezsin; ses geri dönmesin diye kulaklık kullan.</div>}
    </div>
  );
}
