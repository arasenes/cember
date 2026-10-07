import { useState } from "react";
import { donusHash, uygulamaBaglantisi } from "./girisDonus";
import { uygulamaIci } from "./ekranOrtak";
import { t } from "./i18n";

/** Android tarayıcısında Google girişi bitince, Çember uygulamasından geldiysen girişi uygulamaya taşıyan şerit. */
export default function UygulamayaDon({ hash = donusHash }: { hash?: string }) {
  const [gizli, setGizli] = useState(false);
  const android = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  if (gizli || !hash || !android || uygulamaIci()) return null;
  return (
    <div className="banner info guncelleme" role="status">
      <span>{t("Çember uygulamasından mı geldin?")}</span>
      <a className="cta" href={uygulamaBaglantisi(hash)}>{t("Uygulamada aç")}</a>
      <button className="ikincil" onClick={() => setGizli(true)} aria-label={t("Kapat")}>{t("Hayır")}</button>
    </div>
  );
}
