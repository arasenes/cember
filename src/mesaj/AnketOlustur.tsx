import { useEffect, useRef, useState } from "react";
import Ikon from "./Ikon";
import { t } from "../i18n";

export type AnketTaslak = { soru: string; secenekler: string[]; sureDk: number | null; coklu: boolean };

const SURELER: { ad: string; dk: number | null }[] = [
  { ad: "Süresiz", dk: null }, { ad: "1 saat", dk: 60 }, { ad: "1 gün", dk: 1440 }, { ad: "3 gün", dk: 4320 }, { ad: "7 gün", dk: 10080 },
];

export function taslakGecerli(t: AnketTaslak): string | null {
  if (!t.soru.trim()) return "Soruyu yaz.";
  const dolu = t.secenekler.map((s) => s.trim()).filter(Boolean);
  if (dolu.length < 2) return "En az 2 seçenek yaz.";
  if (new Set(dolu.map((s) => s.toLocaleLowerCase("tr"))).size !== dolu.length) return "Aynı seçenek iki kez yazılmış.";
  return null;
}

type Props = { onOlustur: (t: AnketTaslak) => Promise<string | null>; onKapat: () => void };

/** Anket oluşturma penceresi: soru + 2-6 seçenek + süre. */
export default function AnketOlustur({ onOlustur, onKapat }: Props) {
  const [soru, setSoru] = useState("");
  const [secenekler, setSecenekler] = useState(["", ""]);
  const [sureDk, setSureDk] = useState<number | null>(1440);
  const [coklu, setCoklu] = useState(false);
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const ilkRef = useRef<HTMLInputElement>(null);

  useEffect(() => { ilkRef.current?.focus(); }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    const t: AnketTaslak = { soru: soru.trim(), secenekler: secenekler.map((s) => s.trim()).filter(Boolean), sureDk, coklu };
    const h = taslakGecerli(t);
    if (h) return setHata(h);
    setMesgul(true);
    const sonuc = await onOlustur(t);
    setMesgul(false);
    if (sonuc) setHata(sonuc);
  }

  return (
    <div className="modal-arka" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <form className="modal anket-form" role="dialog" aria-modal="true" aria-labelledby="anket-baslik" onSubmit={gonder} noValidate>
        <h2 id="anket-baslik">{t("Anket oluştur")}</h2>
        <div className="field">
          <label htmlFor="anket-soru">{t("Soru")}</label>
          <input ref={ilkRef} id="anket-soru" type="text" value={soru} maxLength={200} onChange={(e) => setSoru(e.target.value)} placeholder={t("Bu akşam ne oynuyoruz?")} />
        </div>
        <div className="field">
          <span className="alan-etiket" id="anket-sec-etiket">{t("Seçenekler")}</span>
          {secenekler.map((s, i) => (
            <div className="anket-satir" key={i}>
              <input type="text" aria-label={t(`Seçenek ${i + 1}`)} value={s} maxLength={100}
                onChange={(e) => setSecenekler((x) => x.map((y, j) => (j === i ? e.target.value : y)))} placeholder={t(`Seçenek ${i + 1}`)} />
              {secenekler.length > 2 && (
                <button type="button" className="sq" aria-label={t(`Seçenek ${i + 1}'i kaldır`)} onClick={() => setSecenekler((x) => x.filter((_, j) => j !== i))}><Ikon ad="kapat" /></button>
              )}
            </div>
          ))}
          {secenekler.length < 6 && (
            <button type="button" className="linkbtn" onClick={() => setSecenekler((x) => [...x, ""])}><Ikon ad="artir" boyut={14} />{" "}{t("Seçenek ekle")}</button>
          )}
        </div>
        <div className="field">
          <label htmlFor="anket-sure">{t("Süre")}</label>
          <select id="anket-sure" value={sureDk ?? ""} onChange={(e) => setSureDk(e.target.value === "" ? null : Number(e.target.value))}>
            {SURELER.map((s) => <option key={s.ad} value={s.dk ?? ""}>{s.ad}</option>)}
          </select>
        </div>
        <label className="onay-satir"><input type="checkbox" checked={coklu} onChange={(e) => setCoklu(e.target.checked)} />{" "}{t("Birden fazla seçenek seçilebilsin")}</label>
        <div className="err" role="alert">{t(hata)}</div>
        <div className="modal-alt">
          <button type="button" className="linkbtn" onClick={onKapat}>{t("Vazgeç")}</button>
          <button type="submit" className="cta" disabled={mesgul}>{mesgul ? "Gönderiliyor…" : "Anketi gönder"}</button>
        </div>
      </form>
    </div>
  );
}
