import { useState } from "react";
import Avatar from "../Avatar";
import { metinOge } from "../mesaj/markdown";
import type { Mesaj, Uye } from "../types";
import { DUZEY_MAX, DUZEY_MIN, useSesDuzeyleri } from "./sesDuzeyi";
import { t } from "../i18n";

type Props = {
  ben: Uye;
  /** Odadaki diğer katılımcılar (kendin hariç). */
  digerleri: Uye[];
  paylasanlar: Set<string>;
  uyeHaritasi: Map<string, Uye>;
  yonetici: boolean;
  /** Bu kişiye yönetici işlemi yapılabilir mi (rol kuralları)? */
  islemYapabilir: (hedef: Uye) => boolean;
  susturulanlar: Set<string>;
  onSustur: (uye: Uye, sustur: boolean) => Promise<string | null>;
  onAt: (uye: Uye) => Promise<string | null>;
  mesajlar: Mesaj[];
  onGonder: (metin: string) => Promise<boolean>;
  yazamaz: boolean;
  onHata: (metin: string) => void;
};

/** Sesli oda yan paneli: kişi başı ses düzeyi (0-200%), yönetici işlemleri ve odanın yazılı sohbeti. */
export default function SesYani({ ben, digerleri, paylasanlar, uyeHaritasi, yonetici, islemYapabilir, susturulanlar, onSustur, onAt, mesajlar, onGonder, yazamaz, onHata }: Props) {
  const d = useSesDuzeyleri();
  const [secili, setSecili] = useState<string>("");
  const [metin, setMetin] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const hedef = digerleri.find((u) => u.id === secili);
  const hedefUygun = !!hedef && islemYapabilir(hedef);

  // Kaydırıcılar: her uzak kişi için mikrofon sesi; ekran sesi gelen kişi için ayrı satır
  const satirlar = digerleri.flatMap((u) => {
    const l = [{ anahtar: u.id, ad: u.takma_ad, uye: u }];
    if (paylasanlar.has(u.id) || d.anahtarlar.includes(`${u.id}~ekran`)) l.push({ anahtar: `${u.id}~ekran`, ad: `${u.takma_ad} · Ekran sesi`, uye: u });
    return l;
  });

  async function calistir(is: Promise<string | null>) {
    setMesgul(true);
    const h = await is;
    setMesgul(false);
    if (h) onHata(h);
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    const t = metin.trim();
    if (!t || yazamaz) return;
    if (await onGonder(t)) setMetin("");
  }

  const son = mesajlar.filter((m) => !m.silindi && !m.ust_mesaj_id).slice(-30);

  return (
    <div className="ses-yani">
      <h2 className="yan-baslik">{t("Kişi başı ses düzeyi")}</h2>
      {satirlar.length === 0 && <p className="hint">{t("Odada başka kimse yok.")}</p>}
      {satirlar.map((s) => {
        const v = d.duzey(s.anahtar);
        return (
          <div key={s.anahtar} className={"yan-kisi" + (s.anahtar.endsWith("~ekran") ? " ekran-ses" : "")}>
            <div className="yan-kisi-ust">
              <Avatar uye={s.uye} className="yan-avatar" />
              <label htmlFor={`duzey-${s.anahtar}`} className="yan-ad">{s.ad}</label>
              <output htmlFor={`duzey-${s.anahtar}`} className="yan-deger">{v}%</output>
            </div>
            <input id={`duzey-${s.anahtar}`} type="range" min={DUZEY_MIN} max={DUZEY_MAX} step={5} value={v}
              aria-label={`${s.ad} ses düzeyi`} aria-valuetext={`yüzde ${v}`} onChange={(e) => d.ayarla(s.anahtar, Number(e.target.value))} />
          </div>
        );
      })}

      {yonetici && (
        <>
          <h2 className="yan-baslik">{t("Yönetici")}</h2>
          <label htmlFor="ses-yonet-kisi" className="sr">{t("İşlem yapılacak kişi")}</label>
          <select id="ses-yonet-kisi" className="yan-sec" value={secili} onChange={(e) => setSecili(e.target.value)}>
            <option value="">{t("Kişi seç…")}</option>
            {digerleri.filter((u) => islemYapabilir(u)).map((u) => <option key={u.id} value={u.id}>{u.takma_ad}</option>)}
          </select>
          <div className="yan-eylemler">
            <button type="button" className="pk-btn" disabled={!hedefUygun || mesgul}
              onClick={() => hedef && void calistir(onSustur(hedef, !susturulanlar.has(hedef.id)))}>
              {hedef && susturulanlar.has(hedef.id) ? "Susturmayı kaldır" : "Sunucuda sustur"}
            </button>
            <button type="button" className="pk-btn tehlike" disabled={!hedefUygun || mesgul}
              onClick={() => { if (hedef && confirm(`${hedef.takma_ad} sesli odadan çıkarılsın mı?`)) void calistir(onAt(hedef)); }}>{t("Odadan at")}</button>
          </div>
        </>
      )}

      <h2 className="yan-baslik">{t("Sesli kanal sohbeti")}</h2>
      <div className="yan-sohbet">
        <ul className="yan-mesajlar" aria-label={t("Sesli kanal mesajları")} aria-live="polite">
          {son.map((m) => {
            const y = uyeHaritasi.get(m.uye_id);
            return (
              <li key={m.id}>
                <b className={"rol-" + (y?.rol ?? "uye")}>{y?.takma_ad ?? "Eski üye"}</b>{" "}
                <span className="yan-metin">{metinOge(m.metin, ben.takma_ad)}</span>
              </li>
            );
          })}
          {!son.length && <li className="hint">{t("Henüz mesaj yok.")}</li>}
        </ul>
        <form className="yan-yaz" onSubmit={gonder}>
          <label htmlFor="ses-sohbet-girdi" className="sr">{t("Sesli kanal sohbetine mesaj yaz")}</label>
          <input id="ses-sohbet-girdi" type="text" value={metin} maxLength={4000} disabled={yazamaz} onChange={(e) => setMetin(e.target.value)} placeholder={t("Mesaj yaz…")} autoComplete="off" />
        </form>
      </div>
    </div>
  );
}
