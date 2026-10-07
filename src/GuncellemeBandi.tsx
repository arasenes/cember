import { useEffect, useState } from "react";
import { APK_ADRESI, yeniSurumVarMi } from "./guncelleme";
import { t } from "./i18n";

const GIZLE = "cember.guncelleme.gizli";

function gizliOku(): number {
  try { return Number(localStorage.getItem(GIZLE) ?? 0) || 0; } catch { return 0; }
}

/** Android uygulamasında yeni APK çıktıysa tek dokunuşla indirme bağlantısını açan şerit. */
export default function GuncellemeBandi() {
  const [no, setNo] = useState<number | null>(null);
  useEffect(() => {
    let iptal = false;
    void yeniSurumVarMi().then((n) => { if (!iptal && n !== null && n > gizliOku()) setNo(n); });
    return () => { iptal = true; };
  }, []);
  if (no === null) return null;
  const sonra = () => {
    try { localStorage.setItem(GIZLE, String(no)); } catch { /* yoksay */ }
    setNo(null);
  };
  return (
    <div className="banner info guncelleme" role="status">
      <span>{t("🆕 Yeni sürüm var.")}</span>
      <button className="cta" onClick={() => window.location.assign(APK_ADRESI)}>{t("İndir")}</button>
      <button className="ikincil" onClick={sonra} aria-label={t("Şimdilik kapat")}>{t("Sonra")}</button>
    </div>
  );
}
