import { useState } from "react";
import type { SesArayuzu } from "./sesMotoru";
import { ekranPaylasilabilirTarayici, KALITE, yerelEkran, type EkranKalite } from "./ekranOrtak";
import { t } from "./i18n";

type Props = { ses: SesArayuzu; kanalAdi: string; className: string; baskasiPaylasiyor?: string | null };

export default function SesCubugu({ ses, kanalAdi, className, baskasiPaylasiyor = null }: Props) {
  const [kalite, setKalite] = useState<EkranKalite>("720");
  if (ses.durum === "kapali") return null;
  const baglaniyor = ses.durum === "baglaniyor";
  const dock = className.includes("vbar-dock");
  if (dock) {
    // Telefonda tek satır: ikonlu düğmeler (uyarılar Chat'te kısa bildirim olarak çıkar)
    const engel = !!baskasiPaylasiyor;
    return (
      <div className={`voicebar on ${className} vbar-kompakt`} role="region" aria-label={t("Sesli oda kontrolleri")}>
        <div className="vk-durum"><i aria-hidden="true" /><span>{baglaniyor ? "Bağlanılıyor…" : kanalAdi || "Sesli bağlı"}</span></div>
        <div className="vk-dugmeler">
          <button className="ik mik" aria-pressed={ses.sessiz} onClick={ses.sessizDegistir} disabled={baglaniyor}
            aria-label={ses.sessiz ? "Mikrofonu aç" : "Mikrofonu sessize al"} title={ses.sessiz ? "Mikrofon kapalı" : "Mikrofon açık"}>{ses.sessiz ? "🔇" : "🎙️"}</button>
          {ses.ekranDestegi && (ses.paylasiyorum
            ? <button className="ik mik" aria-pressed={true} onClick={() => void ses.ekranDurdur()} aria-label={t("Paylaşımı durdur")} title={t("Paylaşımı durdur")}>⏹</button>
            : <button className="ik" onClick={() => void ses.ekranPaylas(kalite)} disabled={baglaniyor || engel} aria-label={t("Ekranı paylaş")}
                title={engel ? `${baskasiPaylasiyor} ekran paylaşıyor` : "Ekranı paylaş"}>🖥️</button>)}
          <button className="ik" aria-pressed={ses.gurultu} onClick={() => void ses.gurultuDegistir()} disabled={baglaniyor}
            aria-label={ses.gurultu ? "Gürültü engellemeyi kapat" : "Gürültü engellemeyi aç"} title={t("Gürültü engelleme")}>🔕</button>
          <button className="ik leave" onClick={ses.ayril} aria-label={t("Sesli odadan ayrıl")} title={t("Ayrıl")}>✕</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`voicebar on ${className}`} role="region" aria-label={t("Sesli oda kontrolleri")}>
      <div className="vstat"><i aria-hidden="true" />{baglaniyor ? "Bağlanılıyor…" : "Sesli bağlı"}{!baglaniyor && ses.motor === "p2p" && <span className="hint" title={t("Ücretsiz doğrudan bağlantı modu")}>{" "}{t("(doğrudan)")}</span>}<span className="hint" style={{ marginLeft: "auto" }}>{kanalAdi}</span></div>
      <div className="vbtns">
        <button className="ib" aria-pressed={ses.sessiz} onClick={ses.sessizDegistir} disabled={baglaniyor}>
          {ses.sessiz ? "🔇 Sessiz" : "🎙️ Sessize al"}
        </button>
        <button className="ib leave" onClick={ses.ayril}>{t("Ayrıl")}</button>
      </div>
      <div className="vbtns">
        <button className="ib gurultu" aria-pressed={ses.gurultu} onClick={() => void ses.gurultuDegistir()} disabled={baglaniyor}
          title={t("Klavye, fan, çevre sesi gibi arka plan gürültüsünü azaltır")}>
          {ses.gurultu ? "🔕 Gürültü engelleme: açık" : "🔔 Gürültü engelleme: kapalı"}
        </button>
      </div>
      {ses.ekranDestegi && (
        ses.paylasiyorum ? (
          <div className="vbtns">
            <button className="ib" aria-pressed={true} onClick={() => void ses.ekranDurdur()}>{t("⏹ Paylaşımı durdur")}</button>
          </div>
        ) : (
          <>
            <div className="vbtns">
              <select className="ekran-kalite" aria-label={t("Ekran paylaşım kalitesi")} value={kalite} onChange={(e) => setKalite(e.target.value as EkranKalite)} disabled={baglaniyor}>
                {(Object.keys(KALITE) as EkranKalite[]).map((k) => <option key={k} value={k}>{KALITE[k].etiket}</option>)}
              </select>
              <button className="ib" onClick={() => void ses.ekranPaylas(kalite)} disabled={baglaniyor || !!baskasiPaylasiyor}
                title={baskasiPaylasiyor ? `${baskasiPaylasiyor} ekran paylaşıyor` : undefined}>{t("🖥️ Ekranı paylaş")}</button>
            </div>
            {baskasiPaylasiyor
              ? <div className="hint">{baskasiPaylasiyor} ekran paylaşıyor; bitince sen paylaşabilirsin.</div>
              : yerelEkran()
                ? <div className="hint">{t("Android'in açacağı izin penceresinde")}{" "}<b>{t("Başla")}</b>'ya bas; telefonun tüm ekranı paylaşılır. Sonra paylaşmak istediğin uygulamaya geç.</div>
                : ekranPaylasilabilirTarayici()
                  ? <div className="hint">{t("Dizi için: açılan pencerede")}{" "}<b>{t("Chrome Sekmesi")}</b>{t("'ni seç ve")}{" "}<b>{t("Sekme sesini paylaş")}</b>{t("'ı işaretle.")}</div>
                  : <div className="hint">{t("Telefonun tüm ekranını paylaşmak için Çember Android uygulaması (APK) gerekir.")}</div>}
          </>
        )
      )}
      {ses.paylasiyorum && <div className="hint">Ekranın odadakilere gösteriliyor. Kendi ekranını burada görmezsin; ses geri dönmesin diye kulaklık kullan.</div>}
    </div>
  );
}
