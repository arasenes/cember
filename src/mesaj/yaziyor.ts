import { useCallback, useEffect, useRef, useState } from "react";

/** Bir "yazıyor" sinyali bu kadar süre sonra, yenisi gelmezse söner. */
export const YAZIYOR_SURE_MS = 5000;
/** Yazan kişi en fazla bu sıklıkta sinyal yollar. */
export const YAZIYOR_YAYIN_ARALIK_MS = 3000;

export function yaziyorMetni(adlar: string[]): string {
  if (adlar.length === 0) return "";
  if (adlar.length === 1) return `${adlar[0]} yazıyor…`;
  if (adlar.length === 2) return `${adlar[0]} ve ${adlar[1]} yazıyor…`;
  return "Birkaç kişi yazıyor…";
}

type Kayit = { ad: string; kanal: string; bitis: number };

/** Kanal başına "kim yazıyor" durumunu tutar; süresi dolanları kendiliğinden siler. */
export function useYaziyorTakip(aktifKanal: string | null) {
  const [kayitlar, setKayitlar] = useState<Map<string, Kayit>>(new Map());
  const ref = useRef(kayitlar);
  ref.current = kayitlar;

  const kaydet = useCallback((uyeId: string, ad: string, kanal: string) => {
    setKayitlar((x) => new Map(x).set(uyeId, { ad, kanal, bitis: Date.now() + YAZIYOR_SURE_MS }));
  }, []);
  const sil = useCallback((uyeId: string) => {
    setKayitlar((x) => { if (!x.has(uyeId)) return x; const y = new Map(x); y.delete(uyeId); return y; });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const simdi = Date.now();
      if ([...ref.current.values()].some((k) => k.bitis <= simdi)) {
        setKayitlar((x) => new Map([...x].filter(([, k]) => k.bitis > simdi)));
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const adlar = aktifKanal ? [...kayitlar.values()].filter((k) => k.kanal === aktifKanal).map((k) => k.ad) : [];
  return { kaydet, sil, metin: yaziyorMetni(adlar) };
}
