import { useCallback, useState } from "react";
import { supabase } from "../supabase";
import { t } from "../i18n";

/** Sunucu işlevini çağırır; hata varsa Türkçe mesajı döner (işlevlerin raise exception metinleri doğrudan gösterilir). */
export async function rpcCagir(ad: string, args: Record<string, unknown>): Promise<{ veri: unknown; hata: string | null }> {
  const { data, error } = await supabase.rpc(ad, args);
  return { veri: data, hata: error ? (error.message || "İşlem yapılamadı.") : null };
}

export const RENK_PALETI = ["#4fd1a5", "#f5b94a", "#7aa8ff", "#ff8a80", "#c9a7ff", "#9aa3b5", "#E8A33D", "#1F7A4D", "#0B7A91", "#B3261E", "#6B4FA0", "#C2548A"];

export type BildirimDurumu = { metin: string; hata: boolean } | null;

/** Ayar sayfalarında işlem sonucunu ("Kaydedildi" / hata) gösteren küçük durum yöneticisi. */
export function useBildirim() {
  const [bildirim, setBildirim] = useState<BildirimDurumu>(null);
  const [mesgul, setMesgul] = useState(false);
  const calistir = useCallback(async (basari: string, is: () => Promise<string | null>) => {
    setMesgul(true); setBildirim(null);
    try {
      const h = await is();
      setBildirim(h ? { metin: h, hata: true } : { metin: basari, hata: false });
      return !h;
    } finally {
      setMesgul(false);
    }
  }, []);
  return { bildirim, setBildirim, mesgul, calistir };
}

export function BildirimSatiri({ b }: { b: BildirimDurumu }) {
  return <div className={"yon-bildirim" + (b?.hata ? " hata" : "")} role="status" aria-live="polite">{b?.metin ? t(b.metin) : ""}</div>;
}

export async function panoyaKopyala(metin: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(metin); return true; } catch { return false; }
}

export function SayfaBasligi({ baslik, aciklama }: { baslik: string; aciklama?: string }) {
  return (
    <div className="ayar-baslik">
      <h1>{baslik}</h1>
      {aciklama && <p>{aciklama}</p>}
    </div>
  );
}
