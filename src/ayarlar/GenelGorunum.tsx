import { useState } from "react";
import { sunucuBasHarf } from "../sunucu/sunucular";
import { BildirimSatiri, RENK_PALETI, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";
import { t } from "../i18n";

type Props = {
  odaId: string;
  ad: string;
  ikonMetin: string | null;
  ikonRenk: string;
  /** Yalnızca sunucu sahibi değiştirebilir. */
  duzenleyebilir: boolean;
  onKaydedildi: () => void;
};

/** Genel görünüm: sunucu adı, simge yazısı ve simge rengi. */
export default function GenelGorunum({ odaId, ad, ikonMetin, ikonRenk, duzenleyebilir, onKaydedildi }: Props) {
  const [yeniAd, setYeniAd] = useState(ad);
  const [metin, setMetin] = useState(ikonMetin ?? "");
  const [renk, setRenk] = useState(ikonRenk);
  const { bildirim, mesgul, calistir } = useBildirim();
  const onizleme = sunucuBasHarf({ ad: yeniAd, ikon_metin: metin || null });
  const degisti = yeniAd.trim() !== ad || (metin.trim() || "") !== (ikonMetin ?? "") || renk !== ikonRenk;

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    const ok = await calistir("Kaydedildi.", async () => (await rpcCagir("sunucu_ayarla", { p_oda: odaId, p_ad: yeniAd.trim(), p_ikon_metin: metin.trim(), p_ikon_renk: renk })).hata);
    if (ok) onKaydedildi();
  }

  return (
    <form className="ayar-form" onSubmit={kaydet}>
      <SayfaBasligi baslik="Genel görünüm" aciklama="Sunucunun adı ve soldaki şeritte görünen simgesi." />
      <div className="genel-onizleme">
        <span className="sr-dugme sr-sunucu aktif" style={{ background: renk, color: "#0f1116" }} aria-hidden="true">{onizleme}</span>
        <div><b>{yeniAd.trim() || "Sunucu"}</b><div className="hint">{t("Şerit simgesi önizlemesi")}</div></div>
      </div>
      <div className="field">
        <label htmlFor="sunucu-ad-ayar">{t("Sunucu adı")}</label>
        <input id="sunucu-ad-ayar" type="text" value={yeniAd} maxLength={40} disabled={!duzenleyebilir || mesgul} onChange={(e) => setYeniAd(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="sunucu-ikon-metin">{t("Simge yazısı (1-2 harf)")}</label>
        <input id="sunucu-ikon-metin" type="text" value={metin} maxLength={2} disabled={!duzenleyebilir || mesgul} onChange={(e) => setMetin(e.target.value)} placeholder={sunucuBasHarf({ ad: yeniAd, ikon_metin: null })} />
      </div>
      <div className="field">
        <span className="alan-etiket" id="ikon-renk-etiket">{t("Simge rengi")}</span>
        <div className="renk-secici" role="radiogroup" aria-labelledby="ikon-renk-etiket">
          {RENK_PALETI.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={renk === r} aria-label={`Renk ${r}`} className="renk-nokta" style={{ background: r }} disabled={!duzenleyebilir} onClick={() => setRenk(r)} />
          ))}
        </div>
      </div>
      <BildirimSatiri b={bildirim} />
      {duzenleyebilir
        ? <button type="submit" className="cta" disabled={mesgul || !degisti || yeniAd.trim().length < 2}>{mesgul ? "Kaydediliyor…" : "Kaydet"}</button>
        : <p className="hint">{t("Bu ayarları yalnızca sunucu sahibi değiştirebilir.")}</p>}
    </form>
  );
}
