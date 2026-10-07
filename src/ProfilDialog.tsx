import { useEffect, useRef, useState, type ReactNode } from "react";
import Avatar from "./Avatar";
import { avatarHazirla, EkHatasi, IZINLI_TURLER, type HazirEk } from "./ekler";
import type { Durum, Uye } from "./types";
import { DURUM_BILGI, rolEtiketi } from "./util";
import { t } from "./i18n";

// Seçici renkleri, üzerindeki baş harfin kontrastı en az 4.5 olacak şekilde seçildi (profil.test.tsx denetler).
export const PROFIL_RENKLERI = ["#E8A33D", "#1F7A4D", "#0B7A91", "#B3261E", "#6B4FA0", "#B04680", "#3C6FB5", "#8A6D3B", "#287878", "#68761F", "#B5563C", "#4F5BA0"];
export const AD_MIN = 2, AD_MAX = 24, HAKKINDA_MAX = 120;

export type ProfilDegisiklik = { takma_ad: string; renk: string; hakkinda: string; durum_metin: string; yeniAvatar: HazirEk | null; avatarKaldir: boolean };
export const DURUM_METNI_MAX = 60;

type Props = {
  uye: Uye;
  benim: boolean;
  cevrimici: boolean;
  onKapat: () => void;
  /** Hata varsa mesajını, başarılıysa null döndürür. */
  onKaydet: (d: ProfilDegisiklik) => Promise<string | null>;
  /** Yalnızca kendi profilinde: durumu hemen değiştirir. */
  onDurum?: (d: Durum) => void;
  /** Başkasının profilinde gösterilecek eylemler (mesaj gönder, arkadaş ekle…). */
  eylemler?: ReactNode;
};

export function adGecerli(ad: string): string | null {
  const t = ad.trim();
  if (t.length < AD_MIN || t.length > AD_MAX) return `Takma ad ${AD_MIN}-${AD_MAX} karakter olmalı.`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/.test(t)) return "Takma adda geçersiz karakter var.";
  return null;
}

export default function ProfilDialog({ uye, benim, cevrimici, onKapat, onKaydet, onDurum, eylemler }: Props) {
  const [ad, setAd] = useState(uye.takma_ad);
  const [renk, setRenk] = useState(uye.renk);
  const [hakkinda, setHakkinda] = useState(uye.hakkinda ?? "");
  const [durumMetin, setDurumMetin] = useState(uye.durum_metin ?? "");
  const [yeni, setYeni] = useState<HazirEk | null>(null);
  const [kaldir, setKaldir] = useState(false);
  const [hata, setHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const kutuRef = useRef<HTMLDivElement>(null);
  const yeniRef = useRef<HazirEk | null>(null);
  yeniRef.current = yeni;

  useEffect(() => {
    const onceki = document.activeElement as HTMLElement | null;
    (kutuRef.current?.querySelector<HTMLElement>("#pf-ad") ?? kutuRef.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => { onceki?.focus?.(); };
  }, []);
  useEffect(() => () => { if (yeniRef.current) URL.revokeObjectURL(yeniRef.current.onizleme); }, []);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !kaydediliyor) { onKapat(); return; }
      if (e.key !== "Tab" || !kutuRef.current) return;
      const odaklanabilir = [...kutuRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]):not([type=file]), textarea:not([disabled])")];
      if (!odaklanabilir.length) return;
      const ilk = odaklanabilir[0], son = odaklanabilir[odaklanabilir.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat, kaydediliyor]);

  async function fotoSec(dosya: File | undefined) {
    if (!dosya) return;
    setHata("");
    try {
      const hazir = await avatarHazirla(dosya, dosya.name);
      setYeni((eski) => { if (eski) URL.revokeObjectURL(eski.onizleme); return hazir; });
      setKaldir(false);
    } catch (e) {
      setHata(e instanceof EkHatasi ? e.message : "Fotoğraf eklenemedi.");
    }
  }

  function fotoKaldir() {
    setYeni((eski) => { if (eski) URL.revokeObjectURL(eski.onizleme); return null; });
    setKaldir(true);
  }

  const gosterilenUye = { takma_ad: benim ? ad.trim() || uye.takma_ad : uye.takma_ad, renk: benim ? renk : uye.renk, avatar_yol: kaldir ? null : uye.avatar_yol };
  const fotoVar = !!yeni || (!kaldir && !!uye.avatar_yol);
  const degisti = ad.trim() !== uye.takma_ad || renk !== uye.renk || hakkinda.trim() !== (uye.hakkinda ?? "") || durumMetin.trim() !== (uye.durum_metin ?? "") || !!yeni || kaldir;

  async function kaydet() {
    const adHata = adGecerli(ad);
    if (adHata) return setHata(adHata);
    if (hakkinda.length > HAKKINDA_MAX) return setHata(`Hakkımda en fazla ${HAKKINDA_MAX} karakter olabilir.`);
    setHata(""); setKaydediliyor(true);
    try {
      const sonuc = await onKaydet({ takma_ad: ad.trim(), renk, hakkinda: hakkinda.trim(), durum_metin: durumMetin.trim(), yeniAvatar: yeni, avatarKaldir: kaldir });
      if (sonuc) setHata(sonuc); else onKapat();
    } finally {
      setKaydediliyor(false);
    }
  }

  const baslikId = "profil-baslik";
  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget && !kaydediliyor) onKapat(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={baslikId} ref={kutuRef}>
        <div className="modal-ust">
          <h2 id={baslikId}>{benim ? "Profilim" : uye.takma_ad}</h2>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label={t("Kapat")} disabled={kaydediliyor}>✕</button>
        </div>

        <div className="profil-kimlik">
          <Avatar uye={gosterilenUye} onizleme={yeni?.onizleme ?? null} className="buyuk" />
          <div>
            {!benim && <div className="profil-ad">{uye.takma_ad}</div>}
            <div className="hint">{rolEtiketi(uye.rol)} · {!cevrimici ? "Çevrimdışı" : DURUM_BILGI[uye.durum ?? "cevrimici"].ad}</div>
            {benim && (
              <div className="profil-foto">
                <button className="ib" onClick={() => dosyaRef.current?.click()} disabled={kaydediliyor}>{t("Fotoğraf seç")}</button>
                {fotoVar && <button className="linkbtn" onClick={fotoKaldir} disabled={kaydediliyor}>{t("Fotoğrafı kaldır")}</button>}
                <input ref={dosyaRef} type="file" accept={IZINLI_TURLER.join(",")} hidden aria-label={t("Profil fotoğrafı dosyası")}
                  onChange={(e) => { void fotoSec(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            )}
          </div>
        </div>

        {benim && onDurum && (
          <div className="profil-durum" role="radiogroup" aria-label={t("Durumum")}>
            {(Object.keys(DURUM_BILGI) as Durum[]).map((d) => (
              <button type="button" key={d} role="radio" aria-checked={(uye.durum ?? "cevrimici") === d} onClick={() => onDurum(d)}>
                <i style={{ background: DURUM_BILGI[d].renk }} aria-hidden="true" />{DURUM_BILGI[d].ad}
              </button>
            ))}
          </div>
        )}

        {benim ? (
          <form className="profil-form" onSubmit={(e) => { e.preventDefault(); void kaydet(); }}>
            <label htmlFor="pf-ad">{t("Takma ad")}</label>
            <input id="pf-ad" type="text" value={ad} maxLength={AD_MAX} onChange={(e) => setAd(e.target.value)} autoComplete="off" />

            <label id="pf-renk-et">{t("Renk")}</label>
            <div className="renkler" role="radiogroup" aria-labelledby="pf-renk-et">
              {(PROFIL_RENKLERI.includes(uye.renk) ? PROFIL_RENKLERI : [uye.renk, ...PROFIL_RENKLERI]).map((r) => (
                <button type="button" key={r} className="renk" role="radio" aria-checked={renk === r} aria-label={`Renk ${r}`}
                  style={{ background: r }} onClick={() => setRenk(r)} />
              ))}
            </div>

            <label htmlFor="pf-hk">{t("Hakkımda")}</label>
            <textarea id="pf-hk" rows={3} value={hakkinda} maxLength={HAKKINDA_MAX} onChange={(e) => setHakkinda(e.target.value)}
              placeholder={t("Kendinden kısaca bahset")} />
            <div className="counter" aria-live="off">{hakkinda.length}/{HAKKINDA_MAX}</div>

            <label htmlFor="pf-dm">{t("Durum metni")}</label>
            <input id="pf-dm" type="text" value={durumMetin} maxLength={DURUM_METNI_MAX} onChange={(e) => setDurumMetin(e.target.value)} placeholder={t("Ne yapıyorsun? (örn. Oyundayım)")} autoComplete="off" />

            <div className="err" role="alert">{hata}</div>
            <div className="modal-alt">
              <button type="button" className="ib" onClick={onKapat} disabled={kaydediliyor}>{t("Vazgeç")}</button>
              <button type="submit" className="cta" disabled={kaydediliyor || !degisti}>{kaydediliyor ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </form>
        ) : (
          <div className="profil-hk">
            {uye.durum_metin && <p className="profil-durum-metin">“{uye.durum_metin}”</p>}
            {uye.hakkinda ? <p>{uye.hakkinda}</p> : <p className="hint">{t("Henüz bir şey yazmamış.")}</p>}
            {eylemler && <div className="pk-eylemler">{eylemler}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
