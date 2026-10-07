import { useMemo, useState } from "react";
import Ikon from "../mesaj/Ikon";
import YonetimPaneli from "../YonetimPaneli";
type SesKonum = Map<string, { kanal: string }>;
import type { Kanal, Kategori, Uye } from "../types";
import { IZIN } from "../sunucu/izin";
import type { Sunucu } from "../sunucu/sunucular";
import GenelGorunum from "./GenelGorunum";
import KanalAyarlari from "./KanalAyarlari";
import RollerIzinler from "./RollerIzinler";
import Davetler from "./Davetler";
import OtomatikModerasyon from "./OtomatikModerasyon";
import DenetimKaydi from "./DenetimKaydi";
import WebhookBotlar from "./WebhookBotlar";
import SunucuSil from "./SunucuSil";

export type Bolum = "genel" | "kanallar" | "roller" | "davetler" | "otomod" | "uyeler" | "denetim" | "webhook" | "sil";

type Props = {
  sunucu: Sunucu;
  baslangic?: Bolum;
  ben: Uye;
  uyeler: Uye[];
  kanallar: Kanal[];
  kategoriler: Kategori[];
  sesKonum: SesKonum;
  cevrimici: Set<string>;
  /** Etkin izin maskem. */
  izin: number;
  varsayilanSunucu: boolean;
  onKapat: () => void;
  onKanallarDegisti: () => void;
  onSunucuDegisti: () => void;
  onSunucuSilindi: () => void;
};

/** Sunucu ayarları: sol menü + sağda seçili bölüm. Bölümler izne göre görünür. */
export default function SunucuAyarlari({ baslangic, sunucu, ben, uyeler, kanallar, kategoriler, sesKonum, cevrimici, izin, varsayilanSunucu, onKapat, onKanallarDegisti, onSunucuDegisti, onSunucuSilindi }: Props) {
  const sahip = ben.rol === "sahip";
  const var_ = (b: number) => (izin & b) !== 0;
  const bolumler = useMemo(() => {
    const l: { id: Bolum; ad: string; ikon: "ayar" | "hash" | "kalkan" | "kullanici" | "grup" | "sohbet" | "sil"; goster: boolean; tehlike?: boolean }[] = [
      { id: "genel", ad: "Genel görünüm", ikon: "ayar", goster: true },
      { id: "kanallar", ad: "Kanallar ve kategoriler", ikon: "hash", goster: var_(IZIN.KANAL_YONET) },
      { id: "roller", ad: "Roller ve izinler", ikon: "kalkan", goster: true },
      { id: "davetler", ad: "Davetler", ikon: "kullanici", goster: var_(IZIN.DAVET) },
      { id: "otomod", ad: "Otomatik moderasyon", ikon: "kalkan", goster: var_(IZIN.MESAJ_YONET) || var_(IZIN.SUSTUR) || sahip },
      { id: "uyeler", ad: "Yasaklar ve zaman aşımı", ikon: "grup", goster: var_(IZIN.SUSTUR) || var_(IZIN.YASAKLA) },
      { id: "denetim", ad: "Denetim kaydı", ikon: "sohbet", goster: var_(IZIN.SUSTUR) || var_(IZIN.YASAKLA) || var_(IZIN.KANAL_YONET) || sahip },
      { id: "webhook", ad: "Webhook ve botlar", ikon: "sohbet", goster: var_(IZIN.KANAL_YONET) },
      { id: "sil", ad: "Sunucuyu sil", ikon: "sil", goster: sahip, tehlike: true },
    ];
    return l.filter((b) => b.goster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izin, sahip]);
  const [secili, setSecili] = useState<Bolum>(baslangic ?? "genel");
  const aktif = bolumler.some((b) => b.id === secili) ? secili : bolumler[0].id;

  return (
    <div className="ayarlar-ekran" role="dialog" aria-modal="true" aria-label="Sunucu ayarları">
      <nav className="ayarlar-menu" aria-label="Sunucu ayar bölümleri">
        <div className="ayarlar-sunucu">{sunucu.ad}</div>
        {bolumler.map((b) => (
          <button key={b.id} type="button" aria-current={aktif === b.id ? "page" : undefined} className={"ayarlar-ogesi" + (aktif === b.id ? " acik" : "") + (b.tehlike ? " tehlike" : "")} onClick={() => setSecili(b.id)}>
            <Ikon ad={b.ikon} boyut={18} />{b.ad}
          </button>
        ))}
      </nav>
      <main className="ayarlar-icerik">
        <button type="button" className="ayarlar-kapat" onClick={onKapat} aria-label="Ayarları kapat"><Ikon ad="kapat" boyut={20} /><span>Esc</span></button>
        {aktif === "genel" && <GenelGorunum odaId={sunucu.oda_id} ad={sunucu.ad} ikonMetin={sunucu.ikon_metin} ikonRenk={sunucu.ikon_renk} duzenleyebilir={sahip} onKaydedildi={onSunucuDegisti} />}
        {aktif === "kanallar" && <KanalAyarlari odaId={sunucu.oda_id} kanallar={kanallar} kategoriler={kategoriler} onDegisti={onKanallarDegisti} />}
        {aktif === "roller" && <RollerIzinler odaId={sunucu.oda_id} uyeler={uyeler} sahipMi={sahip} />}
        {aktif === "davetler" && <Davetler odaId={sunucu.oda_id} />}
        {aktif === "otomod" && <OtomatikModerasyon odaId={sunucu.oda_id} kanallar={kanallar} duzenleyebilir={sahip} />}
        {aktif === "uyeler" && <YonetimPaneli ben={ben} uyeler={uyeler} kanallar={kanallar} sesKonum={sesKonum} cevrimici={cevrimici} izin={izin} />}
        {aktif === "denetim" && <DenetimKaydi odaId={sunucu.oda_id} uyeler={uyeler} />}
        {aktif === "webhook" && <WebhookBotlar odaId={sunucu.oda_id} kanallar={kanallar} />}
        {aktif === "sil" && <SunucuSil odaId={sunucu.oda_id} ad={sunucu.ad} varsayilan={varsayilanSunucu} onSilindi={onSunucuSilindi} />}
      </main>
    </div>
  );
}
