import { useEffect, useRef, useState } from "react";
import { googleAcikMi, googleBagla, googleBagliMi } from "./google";
import { TEMA_BILGI, type Tema } from "./tema";
import type { YaziBoyutu } from "./yerel";

type Props = {
  tema: Tema; onTema: (t: Tema) => void;
  yazi: YaziBoyutu; onYazi: (b: YaziBoyutu) => void;
  sesler: boolean; onSesler: (a: boolean) => void;
  onKapat: () => void;
};

const BOYUTLAR: { id: YaziBoyutu; ad: string }[] = [{ id: "kucuk", ad: "Küçük" }, { id: "orta", ad: "Orta" }, { id: "buyuk", ad: "Büyük" }];

export default function AyarlarDialog({ tema, onTema, yazi, onYazi, sesler, onSesler, onKapat }: Props) {
  const kutu = useRef<HTMLDivElement>(null);
  const [googleDurum, setGoogleDurum] = useState<"yok" | "bagla" | "bagli">("yok");
  const [googleHata, setGoogleHata] = useState("");
  useEffect(() => {
    let iptal = false;
    (async () => {
      if (!(await googleAcikMi())) return;
      const bagli = await googleBagliMi();
      if (!iptal) setGoogleDurum(bagli ? "bagli" : "bagla");
    })();
    return () => { iptal = true; };
  }, []);
  useEffect(() => {
    kutu.current?.querySelector<HTMLElement>("button[aria-checked=true]")?.focus();
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div className="modal ayarlar" role="dialog" aria-modal="true" aria-labelledby="ayar-baslik" ref={kutu}>
        <div className="modal-ust">
          <h2 id="ayar-baslik">Ayarlar</h2>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label="Kapat">✕</button>
        </div>

        <div className="ayar-grup" role="radiogroup" aria-label="Tema">
          <div className="yon-baslik">Tema</div>
          <div className="segment">
            {(Object.keys(TEMA_BILGI) as Tema[]).map((t) => (
              <button key={t} role="radio" aria-checked={tema === t} onClick={() => onTema(t)}>{TEMA_BILGI[t].simge} {t === "otomatik" ? "Otomatik" : TEMA_BILGI[t].ad}</button>
            ))}
          </div>
        </div>

        <div className="ayar-grup" role="radiogroup" aria-label="Yazı boyutu">
          <div className="yon-baslik">Yazı boyutu</div>
          <div className="segment">
            {BOYUTLAR.map((b) => (
              <button key={b.id} role="radio" aria-checked={yazi === b.id} onClick={() => onYazi(b.id)}>{b.ad}</button>
            ))}
          </div>
        </div>

        <div className="ayar-grup">
          <div className="yon-baslik">Uyarı sesleri</div>
          <button className="ayar-anahtar" role="switch" aria-checked={sesler} onClick={() => onSesler(!sesler)}>
            <span>{sesler ? "🔔 Açık" : "🔕 Kapalı"} <small>mesaj, etiket, odaya giriş/çıkış</small></span>
            <span className="anahtar" aria-hidden="true" />
          </button>
        </div>

        {googleDurum !== "yok" && (
          <div className="ayar-grup">
            <div className="yon-baslik">Hesap</div>
            {googleDurum === "bagli" ? (
              <p className="ayar-not">✓ Google hesabın bağlı. Başka cihazdan Google ile girebilirsin.</p>
            ) : (
              <>
                <button className="ayar-anahtar" onClick={async () => setGoogleHata(await googleBagla())}>
                  <span>Google hesabını bağla <small>başka cihazdan da aynı hesapla girmek için</small></span>
                </button>
                {googleHata && <p className="err" role="alert">{googleHata}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
