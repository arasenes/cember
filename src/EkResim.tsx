import { useCallback, useEffect, useRef, useState } from "react";
import { imzaliUrlAl, onbellekTemizle } from "./imzali";
import { gosterimBoyutu } from "./ekler";

type Props = { yol: string; genislik: number; yukseklik: number; alt: string };

export default function EkResim({ yol, genislik, yukseklik, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [hata, setHata] = useState(false);
  const [buyuk, setBuyuk] = useState(false);
  const [deneme, setDeneme] = useState(0);
  const kapatRef = useRef<HTMLButtonElement>(null);
  const acanRef = useRef<HTMLButtonElement>(null);
  const { g, y } = gosterimBoyutu(genislik, yukseklik);

  useEffect(() => {
    let iptal = false;
    setHata(false);
    imzaliUrlAl("ekler", yol).then((u) => { if (iptal) return; if (u) setUrl(u); else setHata(true); });
    return () => { iptal = true; };
  }, [yol, deneme]);

  const kapat = useCallback(() => { setBuyuk(false); acanRef.current?.focus(); }, []);
  useEffect(() => {
    if (!buyuk) return;
    kapatRef.current?.focus();
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") kapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [buyuk, kapat]);

  function tekrarDene() { onbellekTemizle("ekler", yol); setUrl(null); setDeneme((n) => n + 1); }

  return (
    <>
      <div className="ek" style={{ width: g, height: y }}>
        {hata ? (
          <div className="ek-yok" role="alert">
            Resim yüklenemedi. <button className="linkbtn" onClick={tekrarDene}>Tekrar dene</button>
          </div>
        ) : url ? (
          <button ref={acanRef} className="ek-ac" onClick={() => setBuyuk(true)} aria-label={`${alt}, büyütmek için tıkla`}>
            <img src={url} alt={alt} width={g} height={y} loading="lazy" decoding="async" onError={() => (deneme < 1 ? tekrarDene() : setHata(true))} />
          </button>
        ) : (
          <div className="ek-bekle" aria-label="Resim yükleniyor" role="img" />
        )}
      </div>
      {buyuk && url && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={kapat}>
          <button ref={kapatRef} className="lb-kapat" onClick={kapat} aria-label="Kapat">✕</button>
          <img src={url} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
