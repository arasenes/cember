import { useEffect, useRef, useState } from "react";
import type { Uye } from "../types";
import type { Iliski } from "./tipler";

export const GRUP_MIN_DIGER = 2;
export const GRUP_MAX_DIGER = 9;

type Props = {
  uyeler: Uye[];
  benId: string;
  iliski: (uyeId: string) => Iliski;
  onOlustur: (ad: string, uyeIdleri: string[]) => Promise<string | null>;
  onKapat: () => void;
};

/** Grup DM kurma: 2-9 kişi seç (sen dahil en çok 10), ad isteğe bağlı. Engellediğin kişiler listelenmez. */
export default function YeniGrupDialog({ uyeler, benId, iliski, onOlustur, onKapat }: Props) {
  const [ad, setAd] = useState("");
  const [secili, setSecili] = useState<string[]>([]);
  const [filtre, setFiltre] = useState("");
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const ilkRef = useRef<HTMLInputElement>(null);
  useEffect(() => { ilkRef.current?.focus(); }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  const adaylar = uyeler.filter((u) => u.id !== benId && !u.silindi && iliski(u.id) !== "engelli"
    && u.takma_ad.toLocaleLowerCase("tr").includes(filtre.trim().toLocaleLowerCase("tr")));
  const gecerli = secili.length >= GRUP_MIN_DIGER && secili.length <= GRUP_MAX_DIGER;

  function degistir(id: string) {
    setHata("");
    setSecili((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= GRUP_MAX_DIGER ? x : [...x, id]));
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!gecerli) return setHata(`En az ${GRUP_MIN_DIGER} kişi seç.`);
    setMesgul(true);
    const h = await onOlustur(ad.trim(), secili);
    setMesgul(false);
    if (h) setHata(h);
  }

  return (
    <div className="modal-arka" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <form className="modal grup-form" role="dialog" aria-modal="true" aria-labelledby="grup-baslik" onSubmit={gonder} noValidate>
        <h2 id="grup-baslik">Grup mesajı oluştur</h2>
        <div className="field">
          <label htmlFor="grup-ad">Grup adı (isteğe bağlı)</label>
          <input ref={ilkRef} id="grup-ad" type="text" value={ad} maxLength={40} onChange={(e) => setAd(e.target.value)} placeholder="Örn. Cuma akşamı" />
        </div>
        <div className="field">
          <label htmlFor="grup-ara">Kişi ara</label>
          <input id="grup-ara" type="text" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Ad yaz…" />
        </div>
        <fieldset className="grup-liste">
          <legend className="alan-etiket">Kişiler — {secili.length}/{GRUP_MAX_DIGER} seçili</legend>
          {adaylar.map((u) => (
            <label key={u.id} className="onay-satir grup-kisi">
              <input type="checkbox" checked={secili.includes(u.id)} disabled={!secili.includes(u.id) && secili.length >= GRUP_MAX_DIGER} onChange={() => degistir(u.id)} />
              <span className="grup-renk" style={{ background: u.renk }} aria-hidden="true" /> {u.takma_ad}
            </label>
          ))}
          {!adaylar.length && <p className="hint">Kimse bulunamadı.</p>}
        </fieldset>
        <div className="err" role="alert">{hata}</div>
        <div className="modal-alt">
          <button type="button" className="linkbtn" onClick={onKapat}>Vazgeç</button>
          <button type="submit" className="cta" disabled={mesgul || !gecerli}>{mesgul ? "Kuruluyor…" : "Grubu kur"}</button>
        </div>
      </form>
    </div>
  );
}
