import { useState } from "react";
import { anketGorunumu, type Anket } from "./anket";
import Ikon from "./Ikon";
import { t } from "../i18n";

type Props = {
  anket: Anket;
  benUyeId: string;
  onOyla: (secenekId: string, oy: boolean) => Promise<string | null>;
  onHata: (metin: string) => void;
};

function kalanMetni(bitis: string): string {
  const dk = Math.max(0, Math.round((new Date(bitis).getTime() - Date.now()) / 60000));
  if (dk >= 1440) return `${Math.round(dk / 1440)} gün kaldı`;
  if (dk >= 60) return `${Math.round(dk / 60)} saat kaldı`;
  return `${Math.max(dk, 1)} dk kaldı`;
}

/** Mesaj içindeki anket kartı: oy ver / geri çek, canlı yüzde çubukları. */
export default function AnketKart({ anket, benUyeId, onOyla, onHata }: Props) {
  const [mesgul, setMesgul] = useState(false);
  const g = anketGorunumu(anket, benUyeId);

  async function sec(secenekId: string, benim: boolean) {
    if (mesgul || g.bitti) return;
    setMesgul(true);
    const hata = await onOyla(secenekId, !benim);
    setMesgul(false);
    if (hata) onHata(hata);
  }

  return (
    <div className="anket" role="group" aria-label={t(`Anket: ${anket.soru}`)}>
      <div className="anket-etiket"><Ikon ad="anket" boyut={16} /> ANKET</div>
      <div className="anket-soru">{anket.soru}</div>
      <ul className="anket-liste">
        {g.secenekler.map((s) => (
          <li key={s.id}>
            <button type="button" className={"anket-sec" + (s.benim ? " benim" : "")} aria-pressed={s.benim} disabled={mesgul || g.bitti} onClick={() => void sec(s.id, s.benim)}>
              <span className="anket-cubuk" style={{ width: `${s.yuzde}%` }} aria-hidden="true" />
              <span className="anket-metin">{s.metin}</span>
              <span className="anket-sayi">{s.sayi} oy · %{s.yuzde}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="anket-alt">
        {g.toplamOy} kişi oy verdi · {anket.coklu ? "Birden fazla seçilebilir" : "Tek seçim"} · {g.bitti ? "Sona erdi" : anket.bitis ? kalanMetni(anket.bitis) : "Süresiz"}
      </div>
    </div>
  );
}
