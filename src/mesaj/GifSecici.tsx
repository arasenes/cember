import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

type Sonuc = { id: string; url: string; onizleme: string; genislik: number; yukseklik: number };
type Props = { onSec: (url: string) => void; onKapat: () => void };

/** GIF seçici: `gif-ara` edge function'ı Giphy/Tenor'da arar; seçilen GIF'in bağlantısı mesaj olarak gider. */
export default function GifSecici({ onSec, onKapat }: Props) {
  const [q, setQ] = useState("");
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([]);
  const [durum, setDurum] = useState<"yukleniyor" | "tamam" | "hata" | "kurulmadi">("yukleniyor");
  const girdiRef = useRef<HTMLInputElement>(null);

  useEffect(() => { girdiRef.current?.focus(); }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  useEffect(() => {
    let iptal = false;
    setDurum("yukleniyor");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke("gif-ara", { body: { q } });
      if (iptal) return;
      if (error) {
        // 503: anahtar tanımlı değil
        const kod = (error as { context?: { status?: number } }).context?.status;
        return setDurum(kod === 503 ? "kurulmadi" : "hata");
      }
      setSonuclar(((data as { sonuclar?: Sonuc[] })?.sonuclar ?? []));
      setDurum("tamam");
    }, q ? 350 : 0);
    return () => { iptal = true; clearTimeout(t); };
  }, [q]);

  return (
    <div className="gif-secici" role="dialog" aria-label="GIF seç">
      <div className="gif-ust">
        <label htmlFor="gif-ara" className="sr">GIF ara</label>
        <input ref={girdiRef} id="gif-ara" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="GIF ara…" maxLength={60} />
        <button type="button" className="linkbtn" onClick={onKapat}>Kapat</button>
      </div>
      <div className="gif-izgara" aria-live="polite">
        {durum === "yukleniyor" && <p className="hint">Yükleniyor…</p>}
        {durum === "kurulmadi" && <p className="hint">GIF araması henüz kurulmadı. Yönetici Supabase'e GIPHY_API_KEY (ya da TENOR_API_KEY) eklemeli.</p>}
        {durum === "hata" && <p className="hint">GIF'ler yüklenemedi, biraz sonra tekrar dene.</p>}
        {durum === "tamam" && !sonuclar.length && <p className="hint">Sonuç yok.</p>}
        {durum === "tamam" && sonuclar.map((g) => (
          <button key={g.id} type="button" className="gif-oge" aria-label="Bu GIF'i gönder" onClick={() => onSec(g.url)}>
            <img src={g.onizleme} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
    </div>
  );
}
