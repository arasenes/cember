import { supabase } from "./supabase";

// İmzalı bağlantılar bir saat geçerli; 50 dakika önbelleğe alınır, aynı dosya için tek istek atılır.
const SURE_SN = 3600;
const onbellek = new Map<string, { url: string; bitis: number }>();
const bekleyen = new Map<string, Promise<string | null>>();
const anahtar = (kova: string, yol: string) => `${kova}/${yol}`;

export function onbellektenAl(kova: string, yol: string | null | undefined): string | null {
  if (!yol) return null;
  const v = onbellek.get(anahtar(kova, yol));
  return v && v.bitis > Date.now() ? v.url : null;
}

export function imzaliUrlAl(kova: string, yol: string): Promise<string | null> {
  const a = anahtar(kova, yol);
  const hazir = onbellektenAl(kova, yol);
  if (hazir) return Promise.resolve(hazir);
  const b = bekleyen.get(a);
  if (b) return b;
  const p = supabase.storage.from(kova).createSignedUrl(yol, SURE_SN).then(({ data, error }) => {
    bekleyen.delete(a);
    if (error || !data?.signedUrl) return null;
    onbellek.set(a, { url: data.signedUrl, bitis: Date.now() + (SURE_SN - 600) * 1000 });
    return data.signedUrl;
  }, () => { bekleyen.delete(a); return null; });
  bekleyen.set(a, p);
  return p;
}

export function onbellekTemizle(kova: string, yol: string) { onbellek.delete(anahtar(kova, yol)); }
