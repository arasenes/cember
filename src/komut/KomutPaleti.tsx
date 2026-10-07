import { useEffect, useMemo, useRef, useState } from "react";
import Ikon from "../mesaj/Ikon";
import { cevir } from "../i18n";
import { komutlariSuz, type Komut } from "./komutlar";

type Props = { komutlar: Komut[]; onKapat: () => void };

/** Ctrl/Cmd+K: kanal, sunucu ve komutlara klavyeyle hızlı geçiş. */
export default function KomutPaleti({ komutlar, onKapat }: Props) {
  const [sorgu, setSorgu] = useState("");
  const [sec, setSec] = useState(0);
  const giris = useRef<HTMLInputElement>(null);
  const sonuc = useMemo(() => komutlariSuz(komutlar, sorgu), [komutlar, sorgu]);
  useEffect(() => { giris.current?.focus(); }, []);
  useEffect(() => { setSec(0); }, [sorgu]);

  function calistir(k: Komut | undefined) { if (!k) return; onKapat(); k.calistir(); }
  function tus(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSec((s) => Math.min(s + 1, sonuc.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSec((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); calistir(sonuc[sec]); }
    else if (e.key === "Escape") { e.preventDefault(); onKapat(); }
  }

  return (
    <div className="modal-arka palet-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div className="palet" role="dialog" aria-modal="true" aria-label={cevir("palet.baslik")} onKeyDown={tus}>
        <div className="palet-ara">
          <Ikon ad="ara" boyut={18} />
          <input ref={giris} type="text" value={sorgu} onChange={(e) => setSorgu(e.target.value)} placeholder={cevir("palet.yer")} aria-label={cevir("palet.yer")}
            role="combobox" aria-expanded="true" aria-controls="palet-liste" aria-activedescendant={sonuc[sec] ? `palet-${sonuc[sec].id}` : undefined} autoComplete="off" />
        </div>
        <ul id="palet-liste" className="palet-liste" role="listbox" aria-label={cevir("palet.baslik")}>
          {sonuc.map((k, i) => (
            <li key={k.id} id={`palet-${k.id}`} role="option" aria-selected={i === sec}>
              <button type="button" tabIndex={-1} className={"palet-oge" + (i === sec ? " acik" : "")} onMouseEnter={() => setSec(i)} onClick={() => calistir(k)}>
                <Ikon ad={k.ikon} boyut={18} /><span className="palet-ad">{k.ad}</span><small>{k.tur}</small>
              </button>
            </li>
          ))}
          {!sonuc.length && <li className="hint palet-bos">{cevir("palet.bos")}</li>}
        </ul>
        <div className="palet-alt">{cevir("palet.ipucu")}</div>
      </div>
    </div>
  );
}
