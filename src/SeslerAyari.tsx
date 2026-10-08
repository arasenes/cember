import { useEffect, useState } from "react";
import { OLAYLAR, TAKIMLAR, sesAyarDinle, sesAyarKaydet, sesAyarOku, sesOnizle, type SesAyar, type SesOlayi, type SesTakimi } from "./sesler";
import { t } from "./i18n";

type Props = {
  /** Ayar değişince (hesaba kaydetmek için). */
  onDegisti?: (a: SesAyar) => void;
  /** Sesler açılınca (sistem bildirimi izni istemek için). */
  onAcildi?: () => void;
};

/** Ayarlar > Sesler: aç/kapat, ses düzeyi, takım ve olay listesi (her satırda "Dinle"). Sesler Web Audio ile üretilen kısa tonlardır. */
export default function SeslerAyari({ onDegisti, onAcildi }: Props) {
  const [ayar, setAyar] = useState<SesAyar>(sesAyarOku);
  const [seviye, setSeviye] = useState(ayar.seviye);
  useEffect(() => sesAyarDinle((a) => { setAyar(a); setSeviye(a.seviye); }), []);

  const kaydet = (k: Partial<SesAyar>) => { const yeni = sesAyarKaydet(k); onDegisti?.(yeni); return yeni; };

  return (
    <div className="ayar-grup" role="group" aria-labelledby="sesler-baslik">
      <div className="yon-baslik" id="sesler-baslik">{t("Sesler")}</div>
      <button type="button" className="ayar-anahtar" role="switch" aria-checked={ayar.acik} aria-label={t("Uygulama seslerini aç veya kapat")}
        onClick={() => { const yeni = kaydet({ acik: !ayar.acik }); if (yeni.acik) onAcildi?.(); }}>
        <span>{ayar.acik ? t("🔔 Açık") : t("🔕 Kapalı")} <small>{t("kısa tonlar: mesaj, etiket, odaya giriş/çıkış, mikrofon")}</small></span>
        <span className="anahtar" aria-hidden="true" />
      </button>

      <div className="ses-ayar-satir">
        <label htmlFor="ses-seviye">{t("Ses düzeyi")} <output htmlFor="ses-seviye">{seviye}%</output></label>
        <input id="ses-seviye" type="range" min={0} max={100} step={5} value={seviye} disabled={!ayar.acik} aria-valuetext={t("yüzde {v}", { v: seviye })}
          onChange={(e) => { const v = Number(e.target.value); setSeviye(v); sesAyarKaydet({ seviye: v }); }}
          onPointerUp={() => { onDegisti?.(sesAyarOku()); sesOnizle("mesaj"); }}
          onKeyUp={(e) => { if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End" || e.key === "PageUp" || e.key === "PageDown") { onDegisti?.(sesAyarOku()); sesOnizle("mesaj"); } }} />
      </div>

      <div className="alan-etiket" id="ses-takim-et">{t("Ses takımı")}</div>
      <div className="palet-kartlari ses-takimlar" role="radiogroup" aria-labelledby="ses-takim-et">
        {(Object.keys(TAKIMLAR) as SesTakimi[]).map((id) => (
          <button key={id} type="button" role="radio" aria-checked={ayar.takim === id} tabIndex={ayar.takim === id ? 0 : -1}
            className={"palet-kart" + (ayar.takim === id ? " secili" : "")}
            onClick={() => { kaydet({ takim: id }); sesOnizle("mesaj", id); }}>
            <span className="palet-ad">{t(TAKIMLAR[id].ad)}{ayar.takim === id && <span aria-hidden="true"> ✓</span>}</span>
            <small>{t(TAKIMLAR[id].not)}</small>
          </button>
        ))}
      </div>

      <div className="alan-etiket" id="ses-olay-et">{t("Sesler ve ne zaman çalar")}</div>
      <ul className="ses-olaylar" aria-labelledby="ses-olay-et">
        {(Object.keys(OLAYLAR) as SesOlayi[]).map((o) => (
          <li key={o}>
            <div><b>{t(OLAYLAR[o].ad)}</b><small>{t(OLAYLAR[o].ne)}</small></div>
            <button type="button" className="pk-btn" aria-label={t("{ad} sesini dinle", { ad: t(OLAYLAR[o].ad) })} onClick={() => sesOnizle(o)}>{t("Dinle")}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
